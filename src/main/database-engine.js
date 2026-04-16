/* ══════════════════════════════════════════════════════════════════════
   database-engine.js  —  Zentrale Datenbank-Verwaltung

   Verwaltet BEIDE Datenbanken gleichzeitig:
   - Local: PGlite (immer aktiv)
   - Remote: PostgreSQL (optional, via Sync-Center)

   FIX: DDL/DML-Erkennung + einheitliches Ergebnis-Format damit
        der IPC-Handler "[]" nicht als Fehler interpretiert.
   ══════════════════════════════════════════════════════════════════════ */

const path   = require('path');
const pg     = require('./pglite-manager');
const remote = require('./pg-remote');

// ── State ──────────────────────────────────────────────────────────────

let localDatabase  = null;   // PGlite
let remoteDatabase = null;   // PostgreSQL (wenn verbunden)
let isInitialized  = false;

// ── Initialisierung ────────────────────────────────────────────────────

async function initialize() {
    if (isInitialized) return;
    try {
        console.log('[DatabaseEngine] Initialisiere...');
        const pgId = await pg.openPG(pg.DEFAULT_PGDATA);
        localDatabase = { type: 'pglite', id: pgId };
        isInitialized = true;
        console.log('[DatabaseEngine] ✓ Bereit (PGlite aktiv)');
    } catch (err) {
        console.error('[DatabaseEngine] Initialisierungsfehler:', err.message);
        throw err;
    }
}

// ── Remote-Datenbank registrieren ──────────────────────────────────────

async function setRemoteDatabase(connectionString) {
    if (!connectionString) { remoteDatabase = null; return; }
    try {
        console.log('[DatabaseEngine] Registriere Remote-DB:', connectionString.substring(0, 50) + '...');
        await remote.openRemote(connectionString);
        remoteDatabase = { type: 'postgresql', connectionString };
        console.log('[DatabaseEngine] ✓ Remote-DB registriert');
    } catch (err) {
        console.error('[DatabaseEngine] Fehler beim Remote-Register:', err.message);
        remoteDatabase = null;
        throw err;
    }
}

function getRemoteDatabase() { return remoteDatabase; }
function getLocalDatabase()  { return localDatabase;  }

function isDDL(sql) {
    return /^\s*(CREATE|INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|GRANT|REVOKE|VACUUM|ANALYZE|DO\s)/i
        .test(sql.trimStart());
}

/**
 * FIX: Einheitliches Ergebnis-Format für DDL-Operationen.
 * Vorher: [] zurückgegeben → IPC-Handler zeigte "Query abgebrochen"
 * Jetzt:  { rows: [], command: 'CREATE', rowCount: 0 } → Renderer zeigt "Erfolgreich"
 */
function wrapDDLResult(sql) {
    const cmd = sql.trimStart().split(/\s+/)[0].toUpperCase();
    return [{ __kynto_ddl: true, command: cmd, rowCount: 0, message: `${cmd} erfolgreich ausgeführt` }];
}

// ── Query Routing ───────────────────────────────────────────────────────

async function executeQuery(sql, params = [], dbType = 'local') {
    try {
        if (dbType === 'remote') {
            if (!remoteDatabase) throw new Error('Keine Remote-Datenbank verbunden');
            return await remote.queryRemote(remoteDatabase.connectionString, sql, params);
        }

        // PGlite (local)
        if (!localDatabase) throw new Error('Keine lokale Datenbank aktiv');
        const rows = await pg.queryPG(localDatabase.id, sql, params);
        
        // Wenn rows leer ist UND es ein DDL/DML Statement war, verpacken wir es als Erfolgsobjekt
        // damit der Renderer nicht "Abgebrochen" anzeigt.
        if (Array.isArray(rows) && rows.length === 0 && isDDL(sql)) {
            return wrapDDLResult(sql);
        }
        return rows;
    } catch (err) {
        console.error(`[DatabaseEngine] ❌ Query-Fehler (${dbType}):`, err.message);
        throw err;
    }
}

async function executeMultiQuery(sql, dbType = 'local') {
    try {
        if (dbType === 'remote') {
            if (!remoteDatabase) throw new Error('Keine Remote-Datenbank verbunden');
            // FIX: remote branch nutzte auch split(';') — jetzt pglite-manager-Logik spiegeln
            const stmts = splitStatements(sql);
            let last = [];
            for (const stmt of stmts) {
                last = await remote.queryRemote(remoteDatabase.connectionString, stmt);
            }
            return last;
        }

        // PGlite — multiQueryPG nutzt jetzt den sicheren Splitter aus pglite-manager
        if (!localDatabase) throw new Error('Keine lokale Datenbank aktiv');
        const rows = await pg.multiQueryPG(localDatabase.id, sql);

        // FIX: Wenn letztes Statement DDL war und [] zurückkommt → wrap
        const lastStmt = splitStatements(sql).pop() || sql;
        if ((!rows || rows.length === 0) && isDDL(lastStmt)) {
            return wrapDDLResult(lastStmt);
        }
        return rows;

    } catch (err) {
        console.error('[DatabaseEngine] Multi-Query Fehler:', err.message);
        throw err;
    }
}

async function executeTransaction(statements, dbType = 'local') {
    try {
        if (dbType === 'remote') {
            if (!remoteDatabase) throw new Error('Keine Remote-Datenbank verbunden');
            return await remote.transactionRemote(remoteDatabase.connectionString, statements);
        }
        if (!localDatabase) throw new Error('Keine lokale Datenbank aktiv');
        return await pg.transactionPG(localDatabase.id, statements);
    } catch (err) {
        console.error('[DatabaseEngine] Transaction-Fehler:', err.message);
        throw err;
    }
}

// ── Hilfsfunktion: sicherer SQL-Splitter (spiegelt pglite-manager) ──────
// Wird für remote-branch genutzt (PGlite hat eigenen Splitter intern)
function splitStatements(sql) {
    const stmts = [];
    let cur = '', inS = false, inD = false, inLine = false, inBlock = false, i = 0;
    while (i < sql.length) {
        const c = sql[i], n = sql[i+1] || '';
        if (inBlock)  { if (c==='*'&&n==='/') { inBlock=false; i+=2; } else i++; continue; }
        if (inLine)   { if (c==='\n') inLine=false; i++; continue; }
        if (inS)      { cur+=c; if (c==="'"&&n!=="'") inS=false; else if(c==="'"&&n==="'"){cur+=n;i+=2;continue;} i++; continue; }
        if (inD)      { cur+=c; if (c==='"') inD=false; i++; continue; }
        if (c==='-'&&n==='-') { inLine=true; i+=2; continue; }
        if (c==='/'&&n==='*') { inBlock=true; i+=2; continue; }
        if (c==="'")  { inS=true; cur+=c; i++; continue; }
        if (c==='"')  { inD=true; cur+=c; i++; continue; }
        if (c===';')  { const t=cur.trim(); if(t) stmts.push(t); cur=''; i++; continue; }
        cur+=c; i++;
    }
    const t = cur.trim(); if (t) stmts.push(t);
    return stmts;
}

// ── Schema-Info ─────────────────────────────────────────────────────────

async function listTables(dbType = 'local') {
    try {
        if (dbType === 'remote') {
            if (!remoteDatabase) throw new Error('Keine Remote-Datenbank verbunden');
            return await remote.listTablesRemote(remoteDatabase.connectionString);
        }
        if (!localDatabase) throw new Error('Keine lokale Datenbank aktiv');
        return await pg.listTablesPG(localDatabase.id);
    } catch (err) {
        console.error('[DatabaseEngine] listTables Fehler:', err.message);
        throw err;
    }
}

async function describeTable(tableName, dbType = 'local') {
    try {
        if (dbType === 'remote') {
            if (!remoteDatabase) throw new Error('Keine Remote-Datenbank verbunden');
            return await remote.describeTableRemote(remoteDatabase.connectionString, tableName);
        }
        if (!localDatabase) throw new Error('Keine lokale Datenbank aktiv');
        return await pg.describeTablePG(localDatabase.id, tableName);
    } catch (err) {
        console.error('[DatabaseEngine] describeTable Fehler:', err.message);
        throw err;
    }
}

async function getAllColumns(dbType = 'local') {
    try {
        if (dbType === 'remote') {
            if (!remoteDatabase) throw new Error('Keine Remote-Datenbank verbunden');
            return await remote.queryRemote(
                remoteDatabase.connectionString,
                `SELECT table_name, column_name
                 FROM information_schema.columns
                 WHERE table_schema = 'public'
                 ORDER BY table_name, ordinal_position`
            );
        }
        if (!localDatabase) throw new Error('Keine lokale Datenbank aktiv');
        return await pg.allColumnsPG(localDatabase.id);
    } catch (err) {
        console.error('[DatabaseEngine] getAllColumns Fehler:', err.message);
        throw err;
    }
}

async function getDatabaseSize(dbType = 'local') {
    try {
        if (dbType === 'remote') {
            if (!remoteDatabase) throw new Error('Keine Remote-Datenbank verbunden');
            const result = await remote.queryRemote(
                remoteDatabase.connectionString,
                `SELECT pg_database_size(current_database()) as size`
            );
            return result[0]?.size || 0;
        }
        if (!localDatabase) throw new Error('Keine lokale Datenbank aktiv');
        return pg.getSizePG(localDatabase.id);
    } catch (err) {
        console.error('[DatabaseEngine] getDatabaseSize Fehler:', err.message);
        throw err;
    }
}

// ── Status ─────────────────────────────────────────────────────────────

function status() {
    return {
        initialized:          isInitialized,
        localDatabase:        localDatabase  ? { ...localDatabase }  : null,
        remoteDatabase:       remoteDatabase ? {
            type:             remoteDatabase.type,
            connectionString: remoteDatabase.connectionString?.substring(0, 50) + '...'
        } : null,
        remoteConnectionString: remoteDatabase?.connectionString || null,
        isDatabaseActive:     localDatabase  !== null,
        isRemoteConnected:    remoteDatabase  !== null,
    };
}

// ── Cleanup ────────────────────────────────────────────────────────────

async function shutdown() {
    try {
        if (localDatabase?.type  === 'pglite')     await pg.closeAllPG();
        if (remoteDatabase?.type === 'postgresql')  await remote.closeRemote(remoteDatabase.connectionString);
        localDatabase = null; remoteDatabase = null; isInitialized = false;
        console.log('[DatabaseEngine] Heruntergefahren');
    } catch (err) {
        console.error('[DatabaseEngine] Fehler beim Herunterfahren:', err.message);
    }
}

// ── Export ─────────────────────────────────────────────────────────────

module.exports = {
    initialize,
    setRemoteDatabase,
    getLocalDatabase,
    getRemoteDatabase,
    executeQuery,
    executeMultiQuery,
    executeTransaction,
    listTables,
    describeTable,
    getAllColumns,
    getDatabaseSize,
    status,
    shutdown,
};
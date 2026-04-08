/* ══════════════════════════════════════════════════════════════════════
   database-engine.js  —  Zentrale Datenbank-Verwaltung
   
   Verwaltet BEIDE Datenbanken gleichzeitig:
   - Local: PGlite (immer aktiv)
   - Remote: PostgreSQL (optional, via Sync-Center)
   
   Diese Schicht ist nur für interne Query-Routing da.
   Die Datenbank-Auswahl bleibt in sidebar.js/UI.
   ══════════════════════════════════════════════════════════════════════ */

const path = require('path');
const pg = require('./pglite-manager');
const remote = require('./pg-remote');

// ── State ──────────────────────────────────────────────────────────────

let localDatabase = null;        // PGlite
let remoteDatabase = null;       // PostgreSQL (wenn verbunden)
let isInitialized = false;

// ── Initialisierung ────────────────────────────────────────────────────

/**
 * Initializes the database engine.
 * Startet PGlite (immer), PostgreSQL wird später via setRemoteDatabase() registriert
 */
async function initialize() {
    if (isInitialized) return;
    
    try {
        console.log('[DatabaseEngine] Initialisiere...');
        
        // PGlite öffnen (Standard)
        const pgId = await pg.openPG(pg.DEFAULT_PGDATA);
        
        localDatabase = {
            type: 'pglite',
            id: pgId
        };
        
        isInitialized = true;
        console.log('[DatabaseEngine] ✓ Bereit (PGlite aktiv)');
    } catch (err) {
        console.error('[DatabaseEngine] Initialisierungsfehler:', err.message);
        throw err;
    }
}

// ── Remote-Datenbank registrieren (wird von Sync-Center aufgerufen) ─────

/**
 * Registriert eine PostgreSQL-Verbindung
 * @param {string} connectionString - z.B. postgresql://user:pass@host/db
 */
async function setRemoteDatabase(connectionString) {
    if (!connectionString) {
        remoteDatabase = null;
        return;
    }

    try {
        console.log('[DatabaseEngine] Registriere Remote-DB:', connectionString.substring(0, 50) + '...');
        await remote.openRemote(connectionString);
        
        remoteDatabase = {
            type: 'postgresql',
            connectionString
        };
        
        console.log('[DatabaseEngine] ✓ Remote-DB registriert');
    } catch (err) {
        console.error('[DatabaseEngine] Fehler beim Remote-Register:', err.message);
        remoteDatabase = null;
        throw err;
    }
}

function getRemoteDatabase() {
    return remoteDatabase;
}

function getLocalDatabase() {
    return localDatabase;
}

// ── Query Routing (für UI: bestimmt automatisch welche DB benutzt wird) ──

/**
 * Führt Query auf einer spezifischen DB aus (UI wählt via dbType)
 * @param {string} dbType - 'local' oder 'remote'
 * @param {string} sql
 * @param {Array} params
 */
async function executeQuery(sql, params = [], dbType = 'local') {
    try {
        if (dbType === 'remote') {
            if (!remoteDatabase) {
                throw new Error('Keine Remote-Datenbank verbunden');
            }
            return await remote.queryRemote(remoteDatabase.connectionString, sql, params);
        } else {
            // Default: local/PGlite
            if (!localDatabase) throw new Error('Keine lokale Datenbank aktiv');
            return await pg.queryPG(localDatabase.id, sql, params);
        }
    } catch (err) {
        console.error('[DatabaseEngine] Query-Fehler:', err.message);
        throw err;
    }
}

/**
 * Multi-Query auf spezifischer DB
 */
async function executeMultiQuery(sql, dbType = 'local') {
    try {
        if (dbType === 'remote') {
            if (!remoteDatabase) throw new Error('Keine Remote-Datenbank verbunden');
            const stmts = sql.split(';').map(s => s.trim()).filter(Boolean);
            let last = [];
            for (const stmt of stmts) {
                last = await remote.queryRemote(remoteDatabase.connectionString, stmt);
            }
            return last;
        } else {
            if (!localDatabase) throw new Error('Keine lokale Datenbank aktiv');
            return await pg.multiQueryPG(localDatabase.id, sql);
        }
    } catch (err) {
        console.error('[DatabaseEngine] Multi-Query Fehler:', err.message);
        throw err;
    }
}

/**
 * Transaktion auf spezifischer DB
 */
async function executeTransaction(statements, dbType = 'local') {
    try {
        if (dbType === 'remote') {
            if (!remoteDatabase) throw new Error('Keine Remote-Datenbank verbunden');
            return await remote.transactionRemote(remoteDatabase.connectionString, statements);
        } else {
            if (!localDatabase) throw new Error('Keine lokale Datenbank aktiv');
            return await pg.transactionPG(localDatabase.id, statements);
        }
    } catch (err) {
        console.error('[DatabaseEngine] Transaction-Fehler:', err.message);
        throw err;
    }
}

// ── Schema-Info (mit dbType spezifisch) ────────────────────────────────

async function listTables(dbType = 'local') {
    try {
        if (dbType === 'remote') {
            if (!remoteDatabase) throw new Error('Keine Remote-Datenbank verbunden');
            return await remote.listTablesRemote(remoteDatabase.connectionString);
        } else {
            if (!localDatabase) throw new Error('Keine lokale Datenbank aktiv');
            return await pg.listTablesPG(localDatabase.id);
        }
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
        } else {
            if (!localDatabase) throw new Error('Keine lokale Datenbank aktiv');
            return await pg.describeTablePG(localDatabase.id, tableName);
        }
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
        } else {
            if (!localDatabase) throw new Error('Keine lokale Datenbank aktiv');
            return await pg.allColumnsPG(localDatabase.id);
        }
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
        } else {
            if (!localDatabase) throw new Error('Keine lokale Datenbank aktiv');
            return pg.getSizePG(localDatabase.id);
        }
    } catch (err) {
        console.error('[DatabaseEngine] getDatabaseSize Fehler:', err.message);
        throw err;
    }
}

// ── Status ─────────────────────────────────────────────────────────────

function status() {
    return {
        initialized: isInitialized,
        localDatabase: localDatabase ? { ...localDatabase } : null,
        remoteDatabase: remoteDatabase ? { 
            type: remoteDatabase.type,
            connectionString: remoteDatabase.connectionString?.substring(0, 50) + '...'
        } : null,
        remoteConnectionString: remoteDatabase?.connectionString || null,
        isDatabaseActive: localDatabase !== null,
        isRemoteConnected: remoteDatabase !== null
    };
}

// ── Cleanup ────────────────────────────────────────────────────────────

async function shutdown() {
    try {
        if (localDatabase?.type === 'pglite') {
            await pg.closeAllPG();
        }
        if (remoteDatabase?.type === 'postgresql') {
            await remote.closeRemote(remoteDatabase.connectionString);
        }
        localDatabase = null;
        remoteDatabase = null;
        isInitialized = false;
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

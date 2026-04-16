/* ══════════════════════════════════════════════════════════════════════
   pg-remote.js  —  Säule C: Verbindung zu externem PostgreSQL-Server
   
   Verwaltet einen Pool von Remote-Verbindungen.
   Unterstützt: Verbindungstest, Schema-Migration, Daten-Push/Pull.
   ══════════════════════════════════════════════════════════════════════ */

const { Pool } = require('pg');

// Pool: connectionString -> { pool, name, status, lastConnected }
const remotePool = new Map();

/**
 * Maskiert Passwörter in Connection Strings für sicheres Logging.
 */
function maskCS(cs) {
    if (typeof cs !== 'string') return cs;
    return cs.replace(/(?<=:\/\/|:)([^@/]+)(?=@)/g, '******');
}

/**
 * Rewrites SQL to fix common compatibility issues with Postgres
 * e.g. converting 'DATETIME' to 'TIMESTAMP'
 */
function rewriteSqlForPostgres(sql) {
    if (typeof sql !== 'string') return sql;
    let rewritten = sql.replace(/\bDATETIME\b/gi, 'TIMESTAMP');

    // Ensure mixed-case identifiers in public schema are quoted
    rewritten = rewritten.replace(/public\.([a-zA-Z0-9_]+)/g, (match, p1) => {
        return p1 === p1.toLowerCase() ? match : `public."${p1}"`;
    });

    return rewritten;
}

/**
 * Interne Hilfe: Stellt sicher, dass wir die ID (den String) haben,
 * auch wenn ein Objekt übergeben wurde.
 */
function _getId(cs) {
    if (cs && typeof cs === 'object') return cs.connectionString;
    return cs;
}

// ── Verbindung öffnen ──────────────────────────────────────────────────

/**
 * Öffnet eine neue Remote-Verbindung oder gibt bestehende zurück.
 * @param {string} connectionString  z.B. "postgresql://user:pass@host:5432/db"
 * @param {string} name              Anzeigename (z.B. "Produktions-Server")
 * @returns {string}  connectionString als ID
 */
async function openRemote(connectionString, name = 'Remote DB') {
    // Sicherheit: Falls ein Objekt statt eines Strings kommt, konvertieren
    if (connectionString && typeof connectionString === 'object') {
        name = connectionString.name || name;
        connectionString = connectionString.connectionString;
    }

    if (!connectionString || typeof connectionString !== 'string') {
        throw new Error('[pg-remote] Ungültige connectionString: ' + connectionString);
    }

    if (remotePool.has(connectionString)) return connectionString;

    const pool = new Pool({
        connectionString,
        connectionTimeoutMillis: 8000,
        idleTimeoutMillis:       30000,
        max:                     3,
        ssl: connectionString.includes('sslmode=require')
            ? { rejectUnauthorized: false }
            : false
    });

    // Fehler im Pool abfangen (verhindert unhandled rejection crash)
    pool.on('error', (err) => {
        console.error('[pg-remote] Pool-Fehler (idle client):', err.message);
    });

    remotePool.set(connectionString, {
        pool,
        name,
        connectionString,
        status:        'unknown',
        lastConnected: null,
        lastError:     null
    });

    return connectionString;
}

// ── Verbindungstest ────────────────────────────────────────────────────

/**
 * Testet ob die Verbindung funktioniert.
 * Aktualisiert Status im Pool.
 * @returns {{ ok: boolean, version?: string, error?: string, latencyMs: number }}
 */
async function testConnection(connectionString) {
    const id = _getId(connectionString);

    // Falls noch nicht geöffnet, jetzt öffnen
    if (!remotePool.has(id)) {
        try {
            await openRemote(id);
        } catch (err) {
            return { ok: false, error: err.message, latencyMs: 0 };
        }
    }

    const entry = remotePool.get(id);
    if (!entry) return { ok: false, error: 'Verbindung nicht gefunden.', latencyMs: 0 };

    const t0 = Date.now();
    let client;
    try {
        client = await entry.pool.connect();
        const res = await client.query('SELECT version()');
        const latencyMs = Date.now() - t0;

        entry.status        = 'online';
        entry.lastConnected = new Date().toISOString();
        entry.lastError     = null;

        return {
            ok:        true,
            version:   res.rows[0]?.version ?? 'unbekannt',
            latencyMs,
        };
    } catch (err) {
        const errMsg = String(err.message ?? err);
        entry.status    = 'offline';
        entry.lastError = errMsg;
        console.error('[pg-remote] testConnection fehlgeschlagen:', errMsg);
        return { ok: false, error: errMsg, latencyMs: Date.now() - t0 };
    } finally {
        client?.release();
    }
}

// ── Abfragen ───────────────────────────────────────────────────────────

/**
 * Führt eine SQL-Abfrage auf dem Remote-Server aus.
 * @returns {Array} Zeilen
 */
async function queryRemote(connectionString, sql, params = []) {
    let finalCS     = connectionString;
    let finalSQL    = sql;
    let finalParams = params;

    // Sicherheit: Falls der Renderer ein Objekt geschickt hat
    if (connectionString && typeof connectionString === 'object' && !sql) {
        finalCS     = connectionString.connectionString;
        finalSQL    = connectionString.sql;
        finalParams = connectionString.params || [];
    }

    const id = _getId(finalCS);
    
    // Falls Verbindung noch nicht offen, jetzt öffnen
    if (!remotePool.has(id)) {
        await openRemote(id);
    }

    const entry = remotePool.get(id);
    if (!entry) throw new Error('[pg-remote] Verbindung nicht offen.');

    let client;
    try {
        client = await entry.pool.connect();
        const result = await client.query(rewriteSqlForPostgres(finalSQL), finalParams);
        return result.rows ?? [];
    } catch (err) {
        console.error('[pg-remote] Query-Fehler:', err.message);
        console.error('[pg-remote] Ziel-DB:', maskCS(id));
        throw err;
    } finally {
        client?.release();
    }
}

// ── Schema-Operationen ─────────────────────────────────────────────────

/**
 * Gibt alle Tabellen der Remote-DB im Schema 'public' zurück.
 * Format: [{ name, schema }]
 * 
 * FIX: War früher NOT IN ('information_schema', 'pg_catalog') was
 *      manchmal interne pg_toast Schemas mitzog und bei manchen
 *      PostgreSQL-Versionen leer zurückkam.
 */
async function listTablesRemote(connectionString) {
    const id = _getId(connectionString);
    console.log('[pg-remote] listTablesRemote für:', maskCS(id));

    const rows = await queryRemote(id, `
        SELECT table_name AS name, table_schema AS schema
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_type   = 'BASE TABLE'
        ORDER BY table_name
    `);

    console.log('[pg-remote] Gefundene Tabellen:', rows.length, rows.map(r => r.name));
    return rows;
}

/**
 * Gibt Spalten einer Tabelle zurück.
 * Format: [{ column_name, column_type, null, default }]
 */
async function describeTableRemote(connectionString, tableName) {
    const id = _getId(connectionString);

    let schema = 'public';
    let table  = tableName;

    if (tableName && tableName.includes('.')) {
        const parts = tableName.split('.');
        schema = parts[0];
        table  = parts[1];
    }

    if (!table) throw new Error('[pg-remote] Ungültiger Tabellenname: ' + tableName);

    return await queryRemote(id, `
        SELECT
            column_name,
            data_type        AS column_type,
            is_nullable      AS "null",
            column_default   AS "default"
        FROM information_schema.columns
        WHERE table_schema = $1
          AND table_name   = $2
        ORDER BY ordinal_position
    `, [schema, table]);
}

/**
 * Erstellt eine Tabelle auf dem Remote-Server basierend auf dem
 * Schema einer lokalen PGlite-Tabelle.
 * Nutzt CREATE TABLE IF NOT EXISTS — sicher bei Mehrfachaufruf.
 */
async function createTableRemote(connectionString, tableName, columns) {
    const id = _getId(connectionString);

    if (!columns || columns.length === 0) {
        throw new Error(`[pg-remote] Keine Spalten für Tabelle "${tableName}" angegeben.`);
    }

    const colDefs = columns.map(c => {
        const notNull = c.null === 'NO' ? ' NOT NULL' : '';
        return `    "${c.column_name}" ${c.column_type}${notNull}`;
    }).join(',\n');

    const sql = `CREATE TABLE IF NOT EXISTS "${tableName}" (\n${colDefs}\n)`;
    console.log('[pg-remote] createTableRemote:', tableName);
    await queryRemote(id, sql);
    return true;
}

/**
 * Löscht eine Tabelle auf dem Remote-Server.
 */
async function dropTableRemote(connectionString, tableName) {
    const id = _getId(connectionString);
    await queryRemote(id, `DROP TABLE IF EXISTS "${tableName}"`);
    return true;
}

// ── Pool-Info ──────────────────────────────────────────────────────────

function listRemotes() {
    return [...remotePool.values()].map(e => ({
        id:            e.connectionString,
        name:          e.name,
        status:        e.status,
        lastConnected: e.lastConnected,
        lastError:     e.lastError,
        type:          'remote'
    }));
}

function getStatus(connectionString) {
    const e = remotePool.get(_getId(connectionString));
    if (!e) return null;
    return {
        status:        e.status,
        lastConnected: e.lastConnected,
        lastError:     e.lastError
    };
}

// ── Verbindung schließen ───────────────────────────────────────────────

async function closeRemote(connectionString) {
    const id    = _getId(connectionString);
    const entry = remotePool.get(id);
    if (!entry) return;
    try {
        await entry.pool.end();
        console.log(`[pg-remote] Geschlossen: ${id}`);
    } catch (err) {
        console.error('[pg-remote] Fehler beim Schließen:', err.message);
    }
    remotePool.delete(id);
}

/**
 * Transaktion ausführen
 */
async function transactionRemote(connectionString, statements) {
    const id    = _getId(connectionString);

    // Falls Verbindung noch nicht offen, jetzt öffnen
    if (!remotePool.has(id)) {
        await openRemote(id);
    }

    const entry = remotePool.get(id);
    if (!entry) throw new Error('[pg-remote] Keine Verbindung aktiv');

    const client = await entry.pool.connect();
    try {
        await client.query('BEGIN');
        const results = [];
        for (const stmt of statements) {
            // stmt kann { sql, params } oder nur ein SQL-String sein
            const sql    = stmt.sql    || stmt;
            const params = stmt.params || [];
            const r = await client.query(rewriteSqlForPostgres(sql), params);
            results.push(r.rows ?? []);
        }
        await client.query('COMMIT');
        return results;
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('[pg-remote] Transaktion fehlgeschlagen, ROLLBACK:', err.message);
        throw err;
    } finally {
        client.release();
    }
}

async function closeAllRemotes() {
    for (const id of [...remotePool.keys()]) {
        await closeRemote(id);
    }
}

// ── Export ─────────────────────────────────────────────────────────────

module.exports = {
    openRemote,
    testConnection,
    queryRemote,
    listTablesRemote,
    describeTableRemote,
    createTableRemote,
    dropTableRemote,
    listRemotes,
    getStatus,
    closeRemote,
    closeAllRemotes,
    transactionRemote,
};
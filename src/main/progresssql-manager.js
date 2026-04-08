/* ══════════════════════════════════════════════════════════════════════
   progresssql-manager.js  —  ProgressSQL Server Connection Manager
   
   Verwaltet die Verbindung zu einem ProgressSQL Server
   (kompatible PostgreSQL-API, läuft lokal oder in der Cloud).
   
   + AKTIVIERT: PostgREST Instant API 
     → Automatische REST-API für alle Tabellen
     → Plattform-übergreifend (Windows/macOS/Linux)
   ══════════════════════════════════════════════════════════════════════ */

const pg = require('pg');
const apiServer = require('./api-server');

// Connection Pool: connectionString -> { pool, config }
const pools = new Map();

// Tracke aktive APIs pro connections String
const activeApis = new Map();

/**
 * Öffne oder wiederhole eine Verbindung zum ProgressSQL Server
 * @param {string} connectionString - z.B. postgresql://user:pass@localhost:5432/db
 * @returns {Promise<void>}
 */
async function openConnection(connectionString) {
    const t0 = Date.now();
    try {
        let pool;
        if (pools.has(connectionString)) {
            pool = pools.get(connectionString).pool;
        } else {
            pool = new pg.Pool({
                connectionString,
                max: 5,
                idleTimeoutMillis: 30000,
                connectionTimeoutMillis: 2000,
            });
            pools.set(connectionString, { pool, config: { connectionString } });
        }

        // Test-Verbindung
        const client = await pool.connect();
        const result = await client.query('SELECT current_database(), version()');
        const latencyMs = Date.now() - t0;
        const version = result.rows[0].version;
        client.release();

        return { version, latencyMs };
    } catch (err) {
        console.error('[ProgressSQL] Verbindungsfehler:', err.message);
        throw err;
    }
}

/**
 * Schließe die Verbindung zu einem Server
 */
async function closeConnection(connectionString) {
    const entry = pools.get(connectionString);
    if (!entry) return;

    try {
        await entry.pool.end();
        pools.delete(connectionString);
        console.log('[ProgressSQL] Verbindung beendet');
    } catch (err) {
        console.error('[ProgressSQL] Fehler beim Schließen:', err.message);
    }
}

/**
 * Führe eine Query aus
 */
async function query(connectionString, sql, params = []) {
    const entry = pools.get(connectionString);
    if (!entry) throw new Error('[ProgressSQL] Keine Verbindung aktiv');

    try {
        const result = await entry.pool.query(sql, params);
        return result.rows ?? [];
    } catch (err) {
        console.error('[ProgressSQL] Query-Fehler:', err.message);
        throw err;
    }
}

/**
 * Beschreibung einer Tabelle (wie pgDescribe)
 */
async function describe(connectionString, tableName) {
    const rows = await query(
        connectionString,
        `SELECT column_name, data_type, is_nullable
         FROM information_schema.columns
         WHERE table_name = $1 AND table_schema = 'public'
         ORDER BY ordinal_position`,
        [tableName]
    );

    return rows.map(r => ({
        name: r.column_name,
        type: r.data_type,
        nullable: r.is_nullable === 'YES',
    }));
}

/**
 * Liste Tabellen auf
 */
async function listTables(connectionString) {
    const rows = await query(
        connectionString,
        `SELECT table_name
         FROM information_schema.tables
         WHERE table_schema = 'public'
         ORDER BY table_name`
    );

    return rows.map(r => ({
        table_name: r.table_name,
        schema_name: 'public',
        type: 'table'
    }));
}

/**
 * Transaktion ausführen
 */
async function transaction(connectionString, statements) {
    const entry = pools.get(connectionString);
    if (!entry) throw new Error('[ProgressSQL] Keine Verbindung aktiv');

    const client = await entry.pool.connect();
    try {
        await client.query('BEGIN');
        const results = [];
        for (const stmt of statements) {
            const r = await client.query(stmt);
            results.push(r.rows ?? []);
        }
        await client.query('COMMIT');
        return results;
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

/* ══════════════════════════════════════════════════════════════════════
   INSTANT API (PostgREST) - Automatische REST-APIs
   ══════════════════════════════════════════════════════════════════════ */

/**
 * Starte Instant API für aktive Datenbankverbindung
 * Erzeugt automatische REST-Endpoints für alle Tabellen
 * @param {string} connectionString - PostgreSQL-Verbindungsstring
 * @param {number} apiPort - Port für REST-API (default: 3001)
 * @returns {Promise<Object>} { success, url, port, pid }
 */
async function startInstantAPI(connectionString, apiPort = 3001) {
    try {
        // Prüfe ob DB-Verbindung existiert
        if (!pools.has(connectionString)) {
            throw new Error('Keine aktive Datenbankverbindung. Bitte zuerst openConnection() aufrufen.');
        }

        // Prüfe ob API bereits läuft
        if (activeApis.has(connectionString)) {
            console.log('[Instant API] API läuft bereits für diese Verbindung');
            return activeApis.get(connectionString);
        }

        console.log('[Instant API] Starte REST-API (Express-basiert)...');
        const result = await apiServer.startAPIServer(connectionString, apiPort);

        if (result.success) {
            // Speichere aktive API-Info
            activeApis.set(connectionString, {
                success: true,
                url: result.url,
                port: result.port,
                startedAt: new Date(),
                type: 'express'
            });

            console.log(`\n╔════════════════════════════════════════════╗`);
            console.log(`║   ✓ INSTANT API ERFOLGREICH GESTARTET      ║`);
            console.log(`╠════════════════════════════════════════════╣`);
            console.log(`║  REST-Endpoint:   ${result.url.padEnd(31)} ║`);
            console.log(`║  Dokumentation:   ${(result.url + '/api/info').padEnd(31)} ║`);
            console.log(`║  Tabellen:        ${(result.url + '/api/tables').padEnd(31)} ║`);
            console.log(`╚════════════════════════════════════════════╝\n`);

            return activeApis.get(connectionString);
        } else {
            throw new Error(result.error || 'Fehler beim Starten der API');
        }
    } catch (err) {
        console.error('[Instant API] Fehler:', err.message);
        return { success: false, error: err.message };
    }
}

/**
 * Stoppe Instant API
 */
async function stopInstantAPI(connectionString) {
    try {
        const result = await apiServer.stopAPIServer();

        if (result.success) {
            activeApis.delete(connectionString);
            console.log('[Instant API] API gestoppt');
        }

        return result;
    } catch (err) {
        console.error('[Instant API] Fehler beim Stoppen:', err.message);
        return { success: false, error: err.message };
    }
}

/**
 * Erhalte Status der Instant API
 */
async function getInstantAPIStatus(connectionString) {
    if (activeApis.has(connectionString)) {
        return activeApis.get(connectionString);
    }

    return {
        success: false,
        running: false,
        message: 'Instant API läuft nicht',
    };
}

/**
 * Erhalte Liste aller REST-Endpoints
 * Diese werden automatisch aus Tabellen generiert
 */
async function getApiEndpoints(connectionString) {
    try {
        const tables = await listTables(connectionString);

        const endpoints = [
            {
                method: 'GET',
                path: '/api/tables',
                description: 'Liste aller Tabellen',
            },
            ...tables.map(t => ({
                method: 'GET',
                path: `/api/tables/${t.table_name}`,
                description: `Alle Zeilen aus ${t.table_name}`,
            })),
            ...tables.map(t => ({
                method: 'POST',
                path: `/api/tables/${t.table_name}`,
                description: `Neue Zeile in ${t.table_name} erstellen`,
            })),
            ...tables.map(t => ({
                method: 'PUT',
                path: `/api/tables/${t.table_name}/:id`,
                description: `Zeile in ${t.table_name} aktualisieren`,
            })),
            ...tables.map(t => ({
                method: 'DELETE',
                path: `/api/tables/${t.table_name}/:id`,
                description: `Zeile aus ${t.table_name} löschen`,
            })),
        ];

        return endpoints;
    } catch (err) {
        console.error('[API] getApiEndpoints Fehler:', err.message);
        return [];
    }
}

/**
 * Erhalte API-Dokumentation (OpenAPI-Schema)
 */
async function getApiDocumentation(connectionString) {
    const status = await getInstantAPIStatus(connectionString);

    if (!status.success) {
        return {
            error: 'API nicht aktiv',
            url: null,
        };
    }

    return {
        openapi: '3.0.0',
        info: {
            title: 'Kynto Instant API',
            version: '1.0.0',
            description: 'Automatisch generierte REST-API basierend auf PostgreSQL-Tabellen',
        },
        servers: [
            {
                url: status.url,
                description: 'Lokale Instant API',
            },
        ],
        documentation: `${status.url}/`,
    };
}

/**
 * Starte API automatisch nach erfolgreicher DB-Verbindung
 * (Wird in openConnection() aufgerufen)
 */
async function autoStartInstantAPI(connectionString) {
    // Optional: Wartet auf DB-Verbindung stabil ist, dann API starten
    try {
        // Kleine Verzögerung damit DB vollständig initialisiert ist
        await new Promise(r => setTimeout(r, 500));
        
        const result = await startInstantAPI(connectionString);
        return result;
    } catch (err) {
        console.warn('[Instant API] Auto-Start fehlgeschlagen:', err.message);
        console.log('[Instant API] Tipp: Starten Sie manuell mit startInstantAPI()');
        return null;
    }
}

module.exports = {
    openConnection,
    closeConnection,
    query,
    describe,
    listTables,
    transaction,
    // Instant API Functions
    startInstantAPI,
    stopInstantAPI,
    getInstantAPIStatus,
    getApiEndpoints,
    getApiDocumentation,
    autoStartInstantAPI,
};

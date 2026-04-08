/* ══════════════════════════════════════════════════════════════════════
   pglite-manager.js  —  Säule B: Eingebettetes PostgreSQL (PGlite)
   ══════════════════════════════════════════════════════════════════════ */

const { PGlite } = require('@electric-sql/pglite');
const path        = require('path');
const fs          = require('fs');
const { DATA_DIR } = require('./paths'); // ← einheitlich über paths.js

// Standard-Projektdatenbank liegt neben der DuckDB-Datei
const DEFAULT_PGDATA = path.join(DATA_DIR, 'kynto');

// Pool: dataDir (string) -> { db: PGlite, name, isDefault }
const pool = new Map();

// ── Interne Hilfsfunktion ──────────────────────────────────────────────

function ensureDir(dataDir) {
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
}

// ── Öffnen / Erstellen ─────────────────────────────────────────────────

async function openPG(dataDir) {
    const id = dataDir || DEFAULT_PGDATA;
    if (pool.has(id)) return id;

    ensureDir(id);

    console.log(`[PGlite] Öffne Datenbank: ${id}`);
    const db = new PGlite(id);

    await db.waitReady;

    pool.set(id, {
        db,
        path:      id,
        name:      path.basename(id).replace('.pgdata', ''),
        isDefault: id === DEFAULT_PGDATA
    });

    console.log(`[PGlite] Bereit: ${id}`);
    return id;
}

// ── Verbindung holen ───────────────────────────────────────────────────

function getDB(pgId) {
    const entry = pool.get(pgId);
    if (!entry) throw new Error(`Keine PGlite-DB mit ID "${pgId}" offen.`);
    return entry.db;
}

// ── Abfragen ───────────────────────────────────────────────────────────

async function queryPG(pgId, sql, params = []) {
    const db = getDB(pgId);
    try {
        const result = await db.query(sql, params);
        return result.rows ?? [];
    } catch (err) {
        console.error(`[PGlite] Query-Fehler:`, err.message);
        throw err;
    }
}

async function multiQueryPG(pgId, sql) {
    const stmts = sql.split(';').map(s => s.trim()).filter(Boolean);
    let last = [];
    for (const stmt of stmts) {
        last = await queryPG(pgId, stmt);
    }
    return last;
}

async function transactionPG(pgId, statements) {
    const db = getDB(pgId);
    return await db.transaction(async (tx) => {
        let last = [];
        for (const { sql, params } of statements) {
            const result = await tx.query(sql, params || []);
            last = result.rows ?? [];
        }
        return last;
    });
}

// ── Schema-Infos ───────────────────────────────────────────────────────

async function listTablesPG(pgId) {
    return await queryPG(pgId, `
        SELECT
            table_name AS name,
            CASE table_type
                WHEN 'BASE TABLE' THEN 'table'
                WHEN 'VIEW'       THEN 'view'
                ELSE 'table'
            END AS type
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_type IN ('BASE TABLE', 'VIEW')
        ORDER BY table_name
    `);
}

async function describeTablePG(pgId, tableName) {
    return await queryPG(pgId, `
        SELECT
            column_name,
            data_type      AS column_type,
            is_nullable    AS "null",
            column_default AS "default"
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name   = $1
        ORDER BY ordinal_position
    `, [tableName]);
}

async function allColumnsPG(pgId) {
    return await queryPG(pgId, `
        SELECT table_name, column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
        ORDER BY table_name, ordinal_position
    `);
}

// ── Datenbank-Größe ────────────────────────────────────────────────────

function getSizePG(pgId) {
    const entry = pool.get(pgId);
    if (!entry || !fs.existsSync(entry.path)) return 0;
    try {
        let total = 0;
        const files = fs.readdirSync(entry.path);
        for (const file of files) {
            const stat = fs.statSync(path.join(entry.path, file));
            if (stat.isFile()) total += stat.size;
        }
        return total;
    } catch {
        return 0;
    }
}

// ── Schließen ──────────────────────────────────────────────────────────

async function closePG(pgId) {
    const entry = pool.get(pgId);
    if (!entry) return;
    try {
        await entry.db.close();
        console.log(`[PGlite] Geschlossen: ${pgId}`);
    } catch (err) {
        console.error(`[PGlite] Fehler beim Schließen:`, err.message);
    }
    pool.delete(pgId);
}

async function closeAllPG() {
    for (const id of [...pool.keys()]) {
        await closePG(id);
    }
}

// ── Pool-Info ──────────────────────────────────────────────────────────

function listPGs() {
    return [...pool.values()].map(e => ({
        id:        e.path,
        name:      e.name,
        path:      e.path,
        isDefault: e.isDefault,
        type:      'pglite'
    }));
}

// ── Standard-DB beim Laden öffnen ─────────────────────────────────────

let _defaultReady = false;
const readyPromise = openPG(DEFAULT_PGDATA)
    .then(() => { _defaultReady = true; })
    .catch(err => console.error('[PGlite] Fehler beim Start der Standard-DB:', err));

// ── Export ─────────────────────────────────────────────────────────────

module.exports = {
    openPG,
    closePG,
    closeAllPG,
    getDB,
    queryPG,
    multiQueryPG,
    transactionPG,
    listTablesPG,
    describeTablePG,
    allColumnsPG,
    getSizePG,
    listPGs,
    readyPromise,
    DEFAULT_PGDATA,
};
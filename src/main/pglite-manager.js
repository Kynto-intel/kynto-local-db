/* ══════════════════════════════════════════════════════════════════════
   pglite-manager.js  —  Säule B: Eingebettetes PostgreSQL (PGlite)
   ══════════════════════════════════════════════════════════════════════ */

// PGlite ist ESM - muss dynamisch importiert werden
let PGliteClass = null;

const path        = require('path');
const fs          = require('fs');
const { DATA_DIR } = require('./paths');

const DEFAULT_PGDATA = path.join(DATA_DIR, 'kynto');

// Pool: dataDir (string) -> { db: PGlite, name, isDefault }
const pool = new Map();

// Initialisierungs-Lock: verhindert Race-Conditions beim Erstellen von Datenbanken
const initPromises = new Map();

// ── Interne Hilfsfunktionen ────────────────────────────────────────────

function ensureDir(dataDir) {
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
}

/**
 * Rewrites SQL to fix common compatibility issues with PGlite/Postgres
 */
function rewriteSqlForPGlite(sql) {
    if (typeof sql !== 'string') return sql;
    let rewritten = sql.replace(/\bDATETIME\b/gi, 'TIMESTAMP');

    // Fix case-sensitivity for common "public.TableName" patterns if not already quoted
    // This handles "public.GartenFlower" -> "public"."GartenFlower"
    rewritten = rewritten.replace(/public\.([a-zA-Z0-9_]+)/g, (match, p1) => {
        return p1 === p1.toLowerCase() ? match : `public."${p1}"`;
    });
    
    return rewritten;
}

/**
 * FIX #1: Erkennt ob ein SQL-Statement DDL/DML ist (kein SELECT).
 * PGlite verhält sich bei DDL mit .query() inkonsistent — .exec() ist zuverlässiger.
 * 
 * SELECT, WITH...SELECT, EXPLAIN → false (nutze .query())
 * CREATE, INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE → true (nutze .exec())
 */
function isDDLorDML(sql) {
    const trimmed = sql.trimStart().toUpperCase();
    return /^(CREATE|INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|GRANT|REVOKE|COMMENT|VACUUM|ANALYZE|REFRESH|DO\s)/.test(trimmed);
}

/**
 * FIX #2: Sicheres SQL-Statement-Splitting.
 * Einfaches split(';') zerstört mehrzeilige CREATE TABLE Statements NICHT —
 * ABER es erzeugt leere Strings und Kommentar-Fragmente die PGlite abbricht.
 * 
 * Diese Funktion splittet korrekt:
 * - ignoriert ; innerhalb von Strings ('...' und "...")
 * - ignoriert ; innerhalb von Kommentaren (-- und /* *\/)
 * - filtert leere / nur-Kommentar Statements
 */
function splitSqlStatements(sql) {
    const statements = [];
    let current = '';
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let inLineComment = false;
    let inBlockComment = false;
    let i = 0;

    while (i < sql.length) {
        const ch   = sql[i];
        const next = sql[i + 1] || '';

        // Block-Kommentar Ende
        if (inBlockComment) {
            if (ch === '*' && next === '/') { inBlockComment = false; i += 2; continue; }
            i++; continue;
        }
        // Zeilen-Kommentar Ende
        if (inLineComment) {
            if (ch === '\n') inLineComment = false;
            i++; continue;
        }
        // String-Ende
        if (inSingleQuote) {
            current += ch;
            if (ch === "'" && next !== "'") inSingleQuote = false; // '' = escaped quote
            else if (ch === "'" && next === "'") { current += next; i += 2; continue; }
            i++; continue;
        }
        if (inDoubleQuote) {
            current += ch;
            if (ch === '"') inDoubleQuote = false;
            i++; continue;
        }

        // Kommentar-Start
        if (ch === '-' && next === '-') { inLineComment = true; i += 2; continue; }
        if (ch === '/' && next === '*') { inBlockComment = true; i += 2; continue; }
        // String-Start
        if (ch === "'") { inSingleQuote = true; current += ch; i++; continue; }
        if (ch === '"') { inDoubleQuote = true; current += ch; i++; continue; }

        // Statement-Ende
        if (ch === ';') {
            const trimmed = current.trim();
            if (trimmed.length > 0) statements.push(trimmed);
            current = '';
            i++; continue;
        }

        current += ch;
        i++;
    }

    // Letztes Statement ohne abschließendes ;
    const trimmed = current.trim();
    if (trimmed.length > 0) statements.push(trimmed);

    return statements;
}

// ── Öffnen / Erstellen ─────────────────────────────────────────────────

async function openPG(dataDir) {
    const id = dataDir || DEFAULT_PGDATA;
    if (pool.has(id)) return id;

    if (initPromises.has(id)) {
        await initPromises.get(id);
        return id;
    }

    if (!PGliteClass) {
        const mod = await import('@electric-sql/pglite');
        PGliteClass = mod.PGlite;
    }

    const initPromise = (async () => {
        console.log(`[PGlite] Öffne Datenbank: ${id}`);
        const db = new PGliteClass(id);
        await db.waitReady;

        pool.set(id, {
            db,
            path:      id,
            name:      path.basename(id).replace('.pgdata', ''),
            isDefault: id === DEFAULT_PGDATA
        });

        console.log(`[PGlite] Bereit: ${id}`);
    })();

    initPromises.set(id, initPromise);
    try {
        await initPromise;
    } finally {
        initPromises.delete(id);
    }

    return id;
}

// ── Verbindung holen ───────────────────────────────────────────────────

function getDB(pgId) {
    const entry = pool.get(pgId);
    if (!entry) throw new Error(`Keine PGlite-DB mit ID "${pgId}" offen.`);
    return entry.db;
}

// ── Abfragen ───────────────────────────────────────────────────────────

/**
 * FIX #3: Haupt-Query-Funktion — nutzt .exec() für DDL/DML, .query() für SELECT.
 * 
 * Problem vorher:
 *   db.query('CREATE TABLE ...') → PGlite gibt { rows: undefined } zurück
 *   → result.rows ?? [] → [] → kein Fehler, aber Renderer zeigt "Query abgebrochen"
 *   weil er ein leeres Ergebnis nicht von einem Abbruch unterscheiden konnte.
 * 
 * Jetzt:
 *   DDL/DML  → db.exec()  → gibt [] zurück + wirft echten Fehler bei Problemen
 *   SELECT   → db.query() → gibt rows zurück wie gewohnt
 */
async function queryPG(pgId, sql, params = []) {
    const db  = getDB(pgId);
    const rewritten = rewriteSqlForPGlite(sql);

    try {
        // DDL/DML ohne Parameter → exec() ist zuverlässiger
        if (isDDLorDML(rewritten) && params.length === 0) {
            await db.exec(rewritten);
            // Einheitliches Rückgabeformat: leeres Array (kein Fehler = Erfolg)
            return [];
        }

        // DDL/DML MIT Parametern (z.B. INSERT ... VALUES ($1, $2))
        // oder SELECT → query() verwenden
        const result = await db.query(rewritten, params);
        return result.rows ?? [];

    } catch (err) {
        console.error(`[PGlite] ❌ Query-Fehler auf "${pgId}":`, err.message);
        console.error(`[PGlite] 🔍 SQL:`, rewritten.substring(0, 500));
        
        // Debug-Hilfe: Falls Tabelle nicht gefunden, verfügbare Tabellen loggen
        if (err.message.includes('does not exist')) {
            try {
                const tables = await listTablesPG(pgId);
                console.log(`[PGlite] 💡 Verfügbare Tabellen:`, tables.map(t => t.name).join(', '));
            } catch (ignore) {}
        }
        throw err;
    }
}

/**
 * FIX #4: multiQueryPG nutzt jetzt den sicheren Splitter.
 * Vorher: split(';') zerstörte CREATE TABLE mit Inline-Strings.
 * Jetzt:  splitSqlStatements() beachtet Strings und Kommentare.
 */
async function multiQueryPG(pgId, sql) {
    const stmts = splitSqlStatements(sql);
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
        for (const stmt of statements) {
            const rawSql = stmt.sql || stmt;
            const params = stmt.params || [];
            const rewritten = rewriteSqlForPGlite(rawSql);

            // FIX #5: Auch in Transaktionen DDL/DML korrekt behandeln
            if (isDDLorDML(rewritten) && params.length === 0) {
                await tx.exec(rewritten);
                last = [];
            } else {
                const result = await tx.query(rewritten, params);
                last = result.rows ?? [];
            }
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
    DEFAULT_PGDATA,
};
/**
 * ═══════════════════════════════════════════════════════════════
 *  DBMaintenance/cleanup-engine.js
 *  Kern-Logik: Regeln, Zeitplanung, Ausführung
 * ═══════════════════════════════════════════════════════════════
 */

const Database = require('better-sqlite3');
const path     = require('path');
const fs       = require('fs');

// ── DB-Pfad ───────────────────────────────────────────────────────
// Sucht zuerst in KYNTO_DATA_DIR (gesetzt von main.js), dann Fallback
const DATA_DIR = process.env.KYNTO_DATA_DIR
    || path.join(__dirname, '../../../../data');

const DB_PATH = path.join(DATA_DIR, 'sovereign.db');

function getDB() {
    if (!fs.existsSync(DB_PATH)) return null;
    try {
        const db = new Database(DB_PATH);
        db.pragma('journal_mode = WAL');
        return db;
    } catch { return null; }
}

// ── Zeitraum-Definitionen ─────────────────────────────────────────
const PRESETS = [
    { key: 'last_hour',    label: 'Letzte Stunde löschen',     unit: 'hours',   value: 1    },
    { key: 'last_2h',      label: 'Letzte 2 Stunden löschen',  unit: 'hours',   value: 2    },
    { key: 'last_6h',      label: 'Letzte 6 Stunden löschen',  unit: 'hours',   value: 6    },
    { key: 'last_12h',     label: 'Letzte 12 Stunden löschen', unit: 'hours',   value: 12   },
    { key: 'last_24h',     label: 'Letzte 24 Stunden löschen', unit: 'hours',   value: 24   },
    { key: 'older_7d',     label: 'Älter als 7 Tage',          unit: 'days',    value: 7,   mode: 'older' },
    { key: 'older_14d',    label: 'Älter als 14 Tage',         unit: 'days',    value: 14,  mode: 'older' },
    { key: 'older_30d',    label: 'Älter als 30 Tage',         unit: 'days',    value: 30,  mode: 'older' },
    { key: 'older_90d',    label: 'Älter als 90 Tage',         unit: 'days',    value: 90,  mode: 'older' },
    { key: 'wipe_all',     label: 'Alles löschen',             unit: null,      value: 0    },
];

// ── Tabellen-Definitionen ─────────────────────────────────────────
const MANAGED_TABLES = [
    {
        id:          'api_cache',
        label:       'API Cache',
        description: 'Gecachte API-Antworten (Wetter, Suche, etc.)',
        dateCol:     'created_at',
        category:    'cache',
        canWipe:     true,
    },
    {
        id:          'request_logs',
        label:       'Request-Logs',
        description: 'Protokoll aller API-Anfragen',
        dateCol:     'created_at',
        category:    'logs',
        canWipe:     true,
    },
    {
        id:          'data_archive',
        label:       'Daten-Archiv',
        description: 'Historische API-Zeitreihen (Aktien, Wetter-Verlauf)',
        dateCol:     'snapshot_at',
        category:    'archive',
        canWipe:     true,
    },
    {
        id:          'api_keys',
        label:       'API Keys',
        description: 'Verschlüsselte API-Zugangsdaten',
        dateCol:     null,
        category:    'config',
        canWipe:     false,   // Sicherheit: Keys nicht automatisch löschen
    },
];

// ── SQL-Builder ────────────────────────────────────────────────────

/**
 * Baut den DELETE-SQL für eine Cleanup-Operation.
 *
 * @param {string} table    - Tabellenname
 * @param {string} dateCol  - Datums-Spalte
 * @param {object} rule     - { unit, value, mode }
 *   mode 'older' → löscht Einträge die ÄLTER als value sind
 *   mode fehlt   → löscht Einträge der LETZTEN value Zeiteinheiten
 *   value 0      → löscht ALLES
 */
function buildDeleteSQL(table, dateCol, rule) {
    const { unit, value, mode } = rule;

    // Alles löschen
    if (!unit || value === 0) {
        return { sql: `DELETE FROM "${table}"`, params: [] };
    }

    const sqlUnit = unit === 'hours' ? 'hours' : 'days';

    if (mode === 'older') {
        // Älter als X Tage/Stunden → created_at < now - interval
        return {
            sql: `DELETE FROM "${table}" WHERE "${dateCol}" < datetime('now', '-${value} ${sqlUnit}')`,
            params: []
        };
    } else {
        // Letzte X Stunden/Tage löschen → created_at > now - interval
        return {
            sql: `DELETE FROM "${table}" WHERE "${dateCol}" > datetime('now', '-${value} ${sqlUnit}')`,
            params: []
        };
    }
}

// ── Kern-Operationen ──────────────────────────────────────────────

/**
 * Einzelne Tabelle bereinigen.
 * Gibt { table, deleted, error } zurück.
 */
function cleanTable(db, tableDef, rule) {
    try {
        // Tabelle existiert?
        const exists = db.prepare(
            `SELECT name FROM sqlite_master WHERE type='table' AND name=?`
        ).get(tableDef.id);
        if (!exists) return { table: tableDef.id, deleted: 0, skipped: true };

        // Vorher zählen
        const before = db.prepare(`SELECT COUNT(*) as cnt FROM "${tableDef.id}"`).get().cnt;

        // DELETE ausführen
        const { sql, params } = buildDeleteSQL(tableDef.id, tableDef.dateCol, rule);
        const result = db.prepare(sql).run(...params);

        console.log(`[Maintenance] ${tableDef.label}: ${result.changes} Zeilen gelöscht (SQL: ${sql.substring(0, 60)})`);
        return { table: tableDef.id, label: tableDef.label, deleted: result.changes, before };

    } catch (err) {
        console.error(`[Maintenance] Fehler bei ${tableDef.id}:`, err.message);
        return { table: tableDef.id, label: tableDef.label, deleted: 0, error: err.message };
    }
}

/**
 * Vollständige Cleanup-Operation ausführen.
 *
 * @param {object} options
 *   tables:   string[] | 'all'   — welche Tabellen
 *   rule:     { unit, value, mode } | preset key string
 *   vacuum:   boolean            — VACUUM danach (default: true)
 */
function runCleanup(options = {}) {
    const db = getDB();
    if (!db) return { success: false, error: 'Datenbank nicht gefunden: ' + DB_PATH };

    const startTime = Date.now();
    const results   = [];

    try {
        // Rule auflösen (Preset-Key → Objekt)
        let rule = options.rule || { unit: null, value: 0 }; // Default: alles
        if (typeof rule === 'string') {
            const preset = PRESETS.find(p => p.key === rule);
            if (!preset) throw new Error(`Unbekanntes Preset: ${rule}`);
            rule = { unit: preset.unit, value: preset.value, mode: preset.mode };
        }

        // Tabellen auflösen
        let tables = MANAGED_TABLES;
        if (options.tables && options.tables !== 'all') {
            tables = MANAGED_TABLES.filter(t => options.tables.includes(t.id));
        }
        // Nie automatisch Keys löschen außer explizit gewünscht
        if (!options.includeKeys) {
            tables = tables.filter(t => t.canWipe !== false);
        }

        // Transaction für Performance & Atomarität
        const tx = db.transaction(() => {
            for (const tableDef of tables) {
                if (!tableDef.dateCol && rule.value !== 0) {
                    // Tabellen ohne dateCol können nur komplett geleert werden
                    continue;
                }
                results.push(cleanTable(db, tableDef, rule));
            }
        });
        tx();

        // VACUUM (Speicher freigeben)
        const doVacuum = options.vacuum !== false;
        if (doVacuum) {
            db.exec('VACUUM');
            console.log('[Maintenance] VACUUM abgeschlossen.');
        }

        const totalDeleted = results.reduce((s, r) => s + (r.deleted || 0), 0);
        const duration     = Date.now() - startTime;

        console.log(`[Maintenance] ✓ ${totalDeleted} Zeilen gelöscht in ${duration}ms`);

        return {
            success:      true,
            totalDeleted,
            duration,
            results,
            vacuumed:     doVacuum,
            timestamp:    new Date().toISOString(),
        };

    } catch (err) {
        console.error('[Maintenance] Fehler:', err.message);
        return { success: false, error: err.message, results };
    } finally {
        try { db.close(); } catch {}
    }
}

/**
 * Statistiken: Wie viele Einträge pro Tabelle, Größe der DB.
 */
function getStats() {
    const db = getDB();
    if (!db) return { available: false };

    try {
        const stats = {};
        for (const t of MANAGED_TABLES) {
            try {
                const exists = db.prepare(
                    `SELECT name FROM sqlite_master WHERE type='table' AND name=?`
                ).get(t.id);
                if (!exists) { stats[t.id] = { count: 0, oldest: null, newest: null }; continue; }

                const row = db.prepare(`
                    SELECT
                        COUNT(*) as count,
                        MIN("${t.dateCol || 'rowid'}") as oldest,
                        MAX("${t.dateCol || 'rowid'}") as newest
                    FROM "${t.id}"
                `).get();
                stats[t.id] = row;
            } catch { stats[t.id] = { count: 0, oldest: null, newest: null }; }
        }

        // DB-Dateigröße
        let dbSize = 0;
        try { dbSize = fs.statSync(DB_PATH).size; } catch {}

        return { available: true, tables: stats, dbSize, dbPath: DB_PATH };
    } finally {
        try { db.close(); } catch {}
    }
}

/**
 * Vorschau: Wie viele Zeilen würde die Operation löschen?
 */
function previewCleanup(options = {}) {
    const db = getDB();
    if (!db) return { available: false };

    try {
        let rule = options.rule || { unit: null, value: 0 };
        if (typeof rule === 'string') {
            const preset = PRESETS.find(p => p.key === rule);
            if (preset) rule = { unit: preset.unit, value: preset.value, mode: preset.mode };
        }

        let tables = MANAGED_TABLES.filter(t => t.canWipe !== false);
        if (options.tables && options.tables !== 'all') {
            tables = MANAGED_TABLES.filter(t => options.tables.includes(t.id));
        }

        const preview = [];
        for (const t of tables) {
            if (!t.dateCol && rule.value !== 0) continue;
            try {
                const exists = db.prepare(
                    `SELECT name FROM sqlite_master WHERE type='table' AND name=?`
                ).get(t.id);
                if (!exists) { preview.push({ table: t.id, label: t.label, wouldDelete: 0 }); continue; }

                const { sql, params } = buildDeleteSQL(t.id, t.dateCol, rule);
                const countSql = sql.replace(/^DELETE FROM/, 'SELECT COUNT(*) as cnt FROM').replace(/ WHERE/, ' WHERE');
                // Einfacherer Weg: COUNT mit gleicher WHERE-Bedingung
                const whereMatch = sql.match(/WHERE (.+)$/i);
                let cnt = 0;
                if (!whereMatch) {
                    cnt = db.prepare(`SELECT COUNT(*) as cnt FROM "${t.id}"`).get().cnt;
                } else {
                    cnt = db.prepare(`SELECT COUNT(*) as cnt FROM "${t.id}" WHERE ${whereMatch[1]}`).get(...params).cnt;
                }
                preview.push({ table: t.id, label: t.label, wouldDelete: cnt });
            } catch (e) {
                preview.push({ table: t.id, label: t.label, wouldDelete: 0, error: e.message });
            }
        }
        return { available: true, preview, rule };
    } finally {
        try { db.close(); } catch {}
    }
}

module.exports = {
    runCleanup,
    getStats,
    previewCleanup,
    PRESETS,
    MANAGED_TABLES,
    buildDeleteSQL,
};
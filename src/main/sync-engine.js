/* ══════════════════════════════════════════════════════════════════════
   sync-engine.js  —  Die Brücke zwischen den drei Säulen

   FIXES in dieser Version:
   1. Live-Progress via Callback (win.webContents.send)
   2. PostgreSQL → PGlite Typ-Konvertierung (ARRAY, character(n), vector, etc.)
   3. Großtabellen (>10k Zeilen) mit COPY-ähnlichem Bulk-Insert
   4. yield_() nach jedem Batch — kein Einfrieren
   5. Timeout-Schutz pro Operation
   ══════════════════════════════════════════════════════════════════════ */

const pg     = require('./pglite-manager');
const remote = require('./pg-remote');

// ── Event-Loop Yield ───────────────────────────────────────────────────
function yield_() {
    return new Promise(resolve => setImmediate(resolve));
}

function withTimeout(promise, ms, label) {
    const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout (${ms}ms): ${label}`)), ms)
    );
    return Promise.race([promise, timeout]);
}

// ── Fortschritts-Callback ──────────────────────────────────────────────
// Wird von main.js gesetzt: sync.setProgressCallback(msg => win.webContents.send(...))

let _progressCallback = null;
function setProgressCallback(fn) { _progressCallback = fn; }

function progress(msg, pct = null, extra = {}) {
    console.log(`[sync-engine] ${msg}`);
    if (_progressCallback) _progressCallback({ msg, pct, ...extra });
}

// ── PostgreSQL → PGlite Typ-Mapping ───────────────────────────────────
// PGlite basiert auf PostgreSQL WASM — es fehlen aber einige Typen.
// Diese Funktion konvertiert inkompatible Typen in sichere Äquivalente.
function mapTypeToPGlite(pgType) {
    if (!pgType) return 'text';
    const t = pgType.toLowerCase().trim();

    // Datetime conversion (Postgres uses TIMESTAMP)
    if (t === 'datetime') return 'timestamp';

    // ARRAY-Typen: PostgreSQL "ARRAY" oder "integer[]" → text (als JSON speichern)
    if (t === 'array' || t.endsWith('[]') || t.startsWith('_')) return 'text';

    // Vector-Typen (pgvector) → text
    if (t.startsWith('vector') || t === 'halfvec' || t === 'sparsevec') return 'text';

    // character(n) / char(n) → varchar (PGlite hat Probleme mit fester Länge > 1)
    // Wir mappen auf text um "value too long" Fehler zu vermeiden
    if (t.startsWith('character(') || t.startsWith('char(') || t === 'character' || t === 'char') return 'text';

    // bpchar (internal name for char) → text
    if (t === 'bpchar') return 'text';

    // user-defined Typen (z.B. Enums, Composite) → text
    if (t === 'user-defined') return 'text';

    // tsvector / tsquery → text
    if (t === 'tsvector' || t === 'tsquery') return 'text';

    // xml → text
    if (t === 'xml') return 'text';

    // money → numeric
    if (t === 'money') return 'numeric';

    // Alles andere bleibt wie es ist (integer, bigint, text, boolean, jsonb, etc.)
    return pgType;
}

// ── Wert-Konvertierung für inkompatible Typen ─────────────────────────
// Wenn ein Typ zu text konvertiert wurde, müssen Array-Werte als JSON-String gespeichert werden
function mapValueForPGlite(value, originalType) {
    if (value === null || value === undefined) return null;
    const t = (originalType || '').toLowerCase().trim();

    // Arrays → JSON-String
    if (t === 'array' || t.endsWith('[]') || t.startsWith('_') || Array.isArray(value)) {
        return JSON.stringify(value);
    }

    // Vectors → JSON-String
    if (t.startsWith('vector') || t === 'halfvec') {
        return typeof value === 'string' ? value : JSON.stringify(value);
    }

    // Alles andere → direkt
    return value;
}

// ══════════════════════════════════════════════════════════════════════
// B → C : PGlite nach Remote PostgreSQL ("Go Live")
// ══════════════════════════════════════════════════════════════════════

async function pgLiteToRemote(pgId, connectionString, tables = null) {
    const result = { ok: true, transferred: [], errors: [] };

    if (!pgId)             throw new Error('[sync-engine] pgId fehlt');
    if (!connectionString) throw new Error('[sync-engine] connectionString fehlt');

    progress('Verbindung zum Remote-Server prüfen...', 0);
    await yield_();

    await remote.openRemote(connectionString);
    const test = await withTimeout(remote.testConnection(connectionString), 10000, 'Verbindungstest');
    if (!test.ok) return { ok: false, transferred: [], errors: [`Verbindungsfehler: ${test.error}`] };

    progress(`Verbunden (${test.latencyMs}ms)`, 5);
    await yield_();

    let tableList = tables;
    if (!tableList) {
        const rows = await pg.listTablesPG(pgId);
        tableList = rows.map(r => r.name);
    }

    if (tableList.length === 0) {
        progress('Keine Tabellen gefunden.', 100, { done: true });
        return { ok: true, transferred: [], errors: [] };
    }

    progress(`Starte Go-Live: ${tableList.length} Tabelle(n)`, 10, { total: tableList.length, current: 0 });
    await yield_();

    const BATCH = 100;

    for (let i = 0; i < tableList.length; i++) {
        const tableName = tableList[i];
        const pct = 10 + Math.round((i / tableList.length) * 85);

        try {
            progress(`Uebertrage: ${tableName}`, pct, {
                tableName, tableIndex: i, total: tableList.length, status: 'running'
            });
            await yield_();

            const cols = await withTimeout(pg.describeTablePG(pgId, tableName), 15000, `describe ${tableName}`);
            if (!cols || cols.length === 0) throw new Error(`Keine Spalten gefunden.`);
            await yield_();

            await withTimeout(remote.createTableRemote(connectionString, tableName, cols), 15000, `create ${tableName}`);
            await yield_();
            await withTimeout(remote.queryRemote(connectionString, `TRUNCATE TABLE "${tableName}"`), 15000, `truncate ${tableName}`);
            await yield_();

            const rows = await withTimeout(pg.queryPG(pgId, `SELECT * FROM "${tableName}"`), 60000, `select ${tableName}`);
            await yield_();

            if (rows.length > 0) {
                const colNames    = cols.map(c => `"${c.column_name}"`).join(', ');
                const totalBatches = Math.ceil(rows.length / BATCH);

                for (let start = 0; start < rows.length; start += BATCH) {
                    const batchNum = Math.floor(start / BATCH) + 1;
                    const batch    = rows.slice(start, start + BATCH);

                    const valueRows  = batch.map((row, rowIdx) =>
                        `(${cols.map((_, ci) => `$${rowIdx * cols.length + ci + 1}`).join(', ')})`
                    ).join(', ');
                    const flatValues = batch.flatMap(row => cols.map(c => row[c.column_name] ?? null));

                    await withTimeout(
                        remote.queryRemote(connectionString, `INSERT INTO "${tableName}" (${colNames}) VALUES ${valueRows}`, flatValues),
                        20000, `insert ${batchNum}/${totalBatches}`
                    );
                    await yield_();

                    progress(
                        `${tableName}: ${Math.min(start + BATCH, rows.length)}/${rows.length} Zeilen`,
                        pct,
                        { tableName, tableIndex: i, total: tableList.length, rowsDone: Math.min(start + BATCH, rows.length), rowsTotal: rows.length, status: 'running' }
                    );
                }
            }

            result.transferred.push(tableName);
            progress(`OK: ${tableName} (${rows.length} Zeilen)`, pct, {
                tableName, tableIndex: i, total: tableList.length, rowsTotal: rows.length, status: 'done'
            });
            await yield_();

        } catch (err) {
            console.error(`[sync-engine] Fehler bei "${tableName}":`, err.message);
            result.errors.push(`${tableName}: ${err.message}`);
            result.ok = false;
            progress(`FEHLER: ${tableName} — ${err.message}`, pct, {
                tableName, tableIndex: i, total: tableList.length, status: 'error', error: err.message
            });
            await yield_();
        }
    }

    progress('Go-Live abgeschlossen.', 100, { done: true, transferred: result.transferred.length, errors: result.errors.length });
    return result;
}

// ══════════════════════════════════════════════════════════════════════
// C → B : Remote nach PGlite ("Pull")
// ══════════════════════════════════════════════════════════════════════

async function remoteToLocal(pgId, connectionString, tables = null) {
    const result = { ok: true, transferred: [], errors: [] };

    if (!pgId)             return { ok: false, transferred: [], errors: ['pgId fehlt.'] };
    if (!connectionString) return { ok: false, transferred: [], errors: ['connectionString fehlt.'] };

    progress('Verbindung initialisieren...', 0);
    await yield_();

    await remote.openRemote(connectionString);
    const test = await withTimeout(remote.testConnection(connectionString), 10000, 'Verbindungstest');
    if (!test.ok) return { ok: false, transferred: [], errors: [`Verbindungsfehler: ${test.error}`] };

    progress(`Verbunden (${test.latencyMs}ms)`, 5);
    await yield_();

    let tableList = tables;
    if (!tableList) {
        const rows = await remote.listTablesRemote(connectionString);
        tableList = rows.map(r => r.name);
    }

    if (tableList.length === 0) {
        progress('Keine Tabellen auf dem Server gefunden.', 100, { done: true });
        return { ok: true, transferred: [], errors: [] };
    }

    progress(`Starte Pull: ${tableList.length} Tabelle(n)`, 5, { total: tableList.length, current: 0 });
    await yield_();

    // Adaptive Batch-Größe: kleine Tabellen größer, riesige Tabellen kleiner
    const getBatchSize = (rowCount) => {
        if (rowCount > 50000) return 200;
        if (rowCount > 10000) return 500;
        return 1000;
    };

    for (let i = 0; i < tableList.length; i++) {
        const tableName = tableList[i];
        const pct = 5 + Math.round((i / tableList.length) * 90);

        try {
            progress(`Ziehe: ${tableName}`, pct, {
                tableName, tableIndex: i, total: tableList.length, status: 'running'
            });
            await yield_();

            // Remote-Schema lesen
            const remoteCols = await withTimeout(
                remote.describeTableRemote(connectionString, tableName),
                15000, `describe ${tableName}`
            );
            if (!remoteCols || remoteCols.length === 0) throw new Error(`Keine Spalten auf dem Server.`);
            await yield_();

            // Typen für PGlite anpassen (FIX: ARRAY, character(n), vector, etc.)
            const localCols = remoteCols.map(c => ({
                ...c,
                _originalType: c.column_type,
                column_type:   mapTypeToPGlite(c.column_type)
            }));

            // Lokale Tabelle neu anlegen
            await pg.multiQueryPG(pgId, `DROP TABLE IF EXISTS "${tableName}"`);
            await yield_();

            const colDefs = localCols.map(c =>
                `    "${c.column_name}" ${c.column_type}`
            ).join(',\n');
            await pg.multiQueryPG(pgId, `CREATE TABLE "${tableName}" (\n${colDefs}\n)`);
            await yield_();

            // Daten vom Remote holen
            const rows = await withTimeout(
                remote.queryRemote(connectionString, `SELECT * FROM "${tableName}"`),
                120000, `selectAll ${tableName}`
            );
            await yield_();

            if (rows.length > 0) {
                const BATCH    = getBatchSize(rows.length);
                const colNames = localCols.map(c => `"${c.column_name}"`).join(', ');
                const totalBatches = Math.ceil(rows.length / BATCH);

                for (let start = 0; start < rows.length; start += BATCH) {
                    const batchNum = Math.floor(start / BATCH) + 1;
                    const batch    = rows.slice(start, start + BATCH);

                    const statements = batch.map(row => {
                        const values       = localCols.map(c =>
                            mapValueForPGlite(row[c.column_name], c._originalType)
                        );
                        const placeholders = values.map((_, j) => `$${j + 1}`).join(', ');
                        return {
                            sql:    `INSERT INTO "${tableName}" (${colNames}) VALUES (${placeholders})`,
                            params: values
                        };
                    });

                    await withTimeout(
                        pg.transactionPG(pgId, statements),
                        30000, `insert batch ${batchNum}/${totalBatches} ${tableName}`
                    );
                    await yield_();

                    const rowsDone = Math.min(start + BATCH, rows.length);
                    progress(
                        `${tableName}: ${rowsDone}/${rows.length} Zeilen (Batch ${batchNum}/${totalBatches})`,
                        pct,
                        {
                            tableName, tableIndex: i, total: tableList.length,
                            rowsDone, rowsTotal: rows.length,
                            batchNum, totalBatches, status: 'running'
                        }
                    );
                }
            }

            result.transferred.push(tableName);
            progress(`OK: ${tableName} (${rows.length} Zeilen)`, pct, {
                tableName, tableIndex: i, total: tableList.length,
                rowsTotal: rows.length, status: 'done'
            });
            await yield_();

        } catch (err) {
            console.error(`[sync-engine] Fehler bei "${tableName}":`, err.message);
            result.errors.push(`${tableName}: ${err.message}`);
            result.ok = false;
            progress(`FEHLER: ${tableName} — ${err.message}`, pct, {
                tableName, tableIndex: i, total: tableList.length,
                status: 'error', error: err.message
            });
            await yield_();
        }
    }

    progress('Pull abgeschlossen.', 100, {
        done: true, transferred: result.transferred.length, errors: result.errors.length
    });
    return result;
}

// ── Export ─────────────────────────────────────────────────────────────

module.exports = {
    pgLiteToRemote,
    remoteToLocal,
    setProgressCallback,
};
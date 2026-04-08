/* ── modules/executor.js ──────────────────────────────────────────────
   SQL ausführen, Query-Builder, quickView.
   Unterstützt alle drei Modi: DuckDB, PGlite, Remote.

   Verbesserungen gegenüber der alten Version:
   ① executeQuery-Ref-Pattern  — analog zu SQLEditor.tsx (kein stale closure)
   ② onHasSelection verdrahtet — Run-Button wird bei Selection aktiv/inaktiv
   ③ isExecuting-Guard         — verhindert doppeltes Abfeuern (wie SQLEditor.tsx)
   ④ abort-Signal              — laufende Query abbrechbar (AbortController)
   ⑤ selectedRows.clear()      — sauber nach jedem Result-Wechsel
   ⑥ Sidebar-Highlight         — aktive Tabelle wird sofort markiert
   ──────────────────────────────────────────────────────────────────── */

import { state }                    from './state.js';
import { esc, escH, setStatus, getEditorVal, setEditorVal } from './utils.js';
import { addToHistory }             from './history.js';
import { refreshTableList }         from './sidebar.js';
import { updateAutocomplete, setEditorError, clearEditorMarkers, getSelectedQuery, setSelectionCallback } from './editor.js';
import { isNonNullable }            from '../../src/lib/isNonNullable.js';
import { checkDestructiveQuery, suffixWithLimit } from './SQLEditor/SQLEditor.utils.js';
import { sanitizeArrayOfObjects }   from '../../src/lib/sanitize.js';
import { showView, clearResults } from './views.js';
import { sqlEventParser }           from '../../src/lib/sql-event-parser.js';
import { initActionBar }            from './action-bar.js';
import { renderTabs }               from './tabs.js';
import { RunQueryWarningModal }     from './SQLEditor/RunQueryWarningModal.js';

// ── Tables (Tabellenstruktur-Verwaltung) ────────────────────────────────────
import {
    getTables,
    createTable,
    deleteTable,
    updateTable,
} from './tables/index.js';

// ── Table Editor (Metadaten & Utilities) ─────────────────────────────────────
import {
    getTableStats,
} from './table-editor/index.js';

// ── ① Executor-Callbacks (kein Zirkel, kein stale closure) ────────────
// Analog zu executeQueryRef.current in SQLEditor.tsx
let _refreshTableList = () => Promise.resolve();
let _showView         = () => {};
let _clearResults     = () => {};

export function setExecutorCallbacks(refreshTableList, showView, clearResults) {
    _refreshTableList = refreshTableList;
    _showView         = showView;
    _clearResults     = clearResults;
}

// ── ③ isExecuting-Guard (wie isExecuting in SQLEditor.tsx) ────────────
let _isExecuting = false;

// Temporärer Speicher für die Query, die auf Bestätigung wartet
let _pendingQuery = null;

// ── ④ AbortController für laufende Queries ────────────────────────────
let _abortController = null;

// Tracking für Abort-Listener, um Duplikate zu vermeiden
let _abortListenerAdded = false;

/**
 * Modal für destruktive Operationen
 */
const warningModal = new RunQueryWarningModal({
    onConfirm: () => {
        if (_pendingQuery) {
            proceedWithExecution(_pendingQuery.sql, _pendingQuery.startLine, _pendingQuery.override);
            _pendingQuery = null;
        }
    },
    onCancel: () => {
        _isExecuting = false;
        _pendingQuery = null;
        const runBtn = document.getElementById('run-btn');
        if (runBtn) {
            runBtn.disabled = false;
            runBtn.textContent = '▶ Ausführen';
        }
    }
});

// ── Modus-aware Query-Funktion ─────────────────────────────────────────

async function runQuery(sql, signal) {
    const mode = state.dbMode || 'pglite';  // Standard: PGlite

    if (mode === 'pglite') {
        // Local PGlite über neue database-engine
        return await window.api.dbQuery(sql, null, 'local');
    }
    if (mode === 'remote') {
        // Remote PostgreSQL über database-engine
        if (!state.serverConnectionString) throw new Error('Keine Remote-DB-Verbindung aktiv.');
        return await window.api.dbQuery(sql, null, 'remote');
    }
    if (mode === 'duckdb_import') {
        // Legacy DuckDB (falls noch verwendet)
        const dbId = state.activeDbId;
        if (!dbId) throw new Error('Keine DuckDB-Datenbank aktiv.');
        return await window.api.query(sql, dbId);
    }
    throw new Error(`Unbekannter Modus: ${mode}`);
}

function modeIcon() {
    if (state.dbMode === 'pglite') return '🐘 ';
    if (state.dbMode === 'remote') return '🔗 ';
    if (state.dbMode === 'duckdb_import') return '🐦 ';
    return '⚙️ ';
}

// ── Hilfsfunktion: Qualifizierten Tabellennamen bauen ─────────────────────
// FIX: DuckDB-lokale Tabellen liegen in 'main', nicht in 'public'.
// Diese Funktion gibt immer den korrekten vollqualifizierten Namen zurück.
function buildQualifiedName(table, schema) {
    if (!isNonNullable(table)) return null;
    // Bereits vollqualifiziert (enthält Punkt) → unverändert
    if (table.includes('.')) return table;
    // Schema auflösen: PGlite/Remote nutzen 'public', DuckDB_import nutzt 'main'
    const resolvedSchema = state.dbMode === 'duckdb_import' ? 'main' : (schema || 'public');
    return `"${resolvedSchema}"."${table}"`;
}

// ── Quick View ─────────────────────────────────────────────────────────

export async function quickView(name) {
    // FIX: Falls name bereits vollqualifiziert ist (z.B. "schema.tabelle"),
    // Komponenten extrahieren. Sonst Schema auf 'public' für PGlite/PostgreSQL setzen.
    let tableName = name;
    let schema = 'public';  // Standard für PGlite und Remote PostgreSQL

    if (isNonNullable(name) && name.includes('.')) {
        const parts = name.split('.');
        if (parts.length === 3) {
            // "catalog.schema.tabelle" (selten bei PostgreSQL)
            tableName = parts[2];
            schema    = parts[1];
        } else if (parts.length === 2) {
            tableName = parts[1];
            schema    = parts[0];
        }
    }

    // ✅ FIX: Nur tableName speichern (NICHT vollqualifiziert)
    state.currentTable     = tableName;
    state.currentSchema    = schema;
    state.currentTableType = 'table';
    state.currentSort      = { col: null, dir: 'ASC' };

    // Tab-Titel aktualisieren
    const activeTab = state.sqlTabs.find(t => t.id === state.activeTab);
    if (activeTab) {
        activeTab.title     = tableName;
        activeTab.tableName = tableName;  // ✅ FIX: tableName statt name
        renderTabs();
    }

    try {
        let cols = [];
        
        // Map state.dbMode zu dbType für database-engine
        const dbType = state.dbMode === 'pglite' ? 'local' : 
                       state.dbMode === 'remote' ? 'remote' : 
                       'local';  // Default Fallback
        
        // Nutze neue database-engine API für beide DB-Typen
        cols = await window.api.dbDescribe(tableName, dbType);

        state.currentCols            = cols.map(c => c.column_name);
        state.knownColumns[tableName] = state.currentCols;
        updateAutocomplete();

        const selSort = document.getElementById('sel-sort');
        if (selSort) {
            selSort.innerHTML = '<option value="">Spalte…</option>' +
                cols.map(c => `<option value="${escH(c.column_name)}">${escH(c.column_name)}</option>`).join('');
        }
        const selTable = document.getElementById('sel-table');
        if (selTable) selTable.value = tableName;

    } catch (err) {
        console.error('[executor] quickView:', err);
    }

    // ⑥ Sidebar-Highlight sofort aktualisieren
    _highlightTableInSidebar(tableName);  // ✅ FIX: tableName statt name

    initActionBar();
    updateTableQuery();
}

// ── Query Builder ──────────────────────────────────────────────────────

export function buildQuery() {
    if (!state.currentTable) return null;
    const limit = state.currentLimit;
    const offset = (state.currentPage - 1) * limit;

    // FIX: Korrekten vollqualifizierten Namen verwenden
    const qualified = buildQualifiedName(state.currentTable, state.currentSchema);
    let sql = `SELECT * FROM ${qualified}`;
    if (state.currentSort.col) sql += ` ORDER BY ${esc(state.currentSort.col)} ${state.currentSort.dir}`;
    return sql + ' LIMIT 500';
    return `${sql} LIMIT ${limit} OFFSET ${offset}`;
}

export function updateTableQuery() {
    const sql = buildQuery();
    if (!sql) {
        console.warn('[executor] buildQuery() returned null - state.currentTable:', state.currentTable);
        return;
    }
    console.log('[executor] updateTableQuery() - Setting SQL:', sql);
    setEditorVal(state, sql + ';');
    // FIX: Nur schreiben, NOT ausführen - der User kann selbst Ausführen klicken
}

// ── SQL Ausführen ──────────────────────────────────────────────────────

export async function execSQL(override) {
    // ③ Doppeltes Abfeuern verhindern
    if (_isExecuting && !override) {
        console.warn('[executor] Query läuft bereits — abgebrochen.');
        return;
    }

    // Falls override genutzt wird (z.B. aus dem Dashboard), parsen wir ad-hoc
    const queryInfo = override 
        ? { sql: override, startLine: 1, events: sqlEventParser.getTableEvents(override) } 
        : getSelectedQuery();
        
    const sql          = queryInfo.sql;
    if (!sql || !sql.trim()) return;

    const startOffsetLine = queryInfo.startLine;
    clearEditorMarkers();

    // Destructive-Query-Check
    const issues = checkDestructiveQuery(sql);
    if (issues.isDestructive && !override) {
        _isExecuting = true;
        _pendingQuery = { sql, startLine: startOffsetLine, override };
        warningModal.show(issues);
        
        const runBtn = document.getElementById('run-btn');
        if (runBtn) {
            runBtn.disabled = true;
            runBtn.textContent = '⚠️ Prüfen...';
        }
        return;
    }

    await proceedWithExecution(sql, startOffsetLine, override, queryInfo);
}

/**
 * Die eigentliche Ausführung nach den Sicherheits-Checks
 */
async function proceedWithExecution(sql, startOffsetLine, override, queryInfo) {
    let finalSql = sql;

    // Auto-Limit
    const autoLimit = state.editorSettings?.autoLimit || 500;
    if (!override) finalSql = suffixWithLimit(sql, autoLimit);

    // Partial-Execution Feedback
    if (!override && state.editor && finalSql !== state.editor.getValue()) {
        setStatus('Führe Auswahl aus…', 'info');
    }

    // ④ AbortController — vorherige Query abbrechen
    _abortController?.abort();
    _abortController = new AbortController();
    const { signal } = _abortController;

    _isExecuting = true;
    const runBtn = document.getElementById('run-btn');
    if (runBtn) {
        runBtn.disabled     = true;
        runBtn.textContent  = '⏹ Abbrechen';
        
        // Abort-Listener nur einmal pro Ausführung hinzufügen
        if (!_abortListenerAdded) {
            const abortHandler = () => {
                _abortController?.abort();
                setStatus('Query abgebrochen.', 'info');
            };
            
            runBtn.addEventListener('click', abortHandler, { once: true });
            _abortListenerAdded = true;
        }
    }
    setStatus('Lädt…');
    const t0 = performance.now();

    try {
        const result = await runQuery(finalSql, signal);

        if (signal.aborted) return; // User hat abgebrochen

        state.lastQueryDuration = performance.now() - t0;

        // ECHTE INTEGRATION: Privacy-Mode via MagicEye
        // Wenn MagicEye aktiv ist und auf 'privacy' steht, werden Daten redigiert
        state.lastData = (state.magicEyeActive && state.magicMode === 'privacy')
            ? sanitizeArrayOfObjects(result ?? [])
            : (result ?? []);

        // WICHTIG: Spalten für den TableGridEditor ableiten, falls nicht gesetzt
        if (state.lastData.length > 0) {
            state.currentCols = Object.keys(state.lastData[0]);
        }

        _showView('table');

        // ⑤ Zeilenauswahl nach jedem neuen Result zurücksetzen
        state.selectedRows?.clear();

        const n = state.lastData.length;
        let msg = '';

        // Calculate total rows and total pages for the footer
        let totalCount = n; // Default to current data length

        if (state.currentTable && finalSql.trim().toUpperCase().startsWith('SELECT')) {
            try {
                // FIX: Qualifizierten Namen für COUNT verwenden
                const qualified = buildQualifiedName(state.currentTable, state.currentSchema);
                let cntSql = `SELECT COUNT(*) as cnt FROM ${qualified}`;
                const cr = await runQuery(cntSql, signal);
                if (cr?.[0]) {
                    msg = `${modeIcon()}Zeige ${n.toLocaleString('de-DE')} von ${cr[0].cnt.toLocaleString('de-DE')} Zeilen.`;
                    totalCount = parseInt(cr[0].cnt);
                }
            } catch {}
        }
        state.totalRows = totalCount;
        state.totalPages = Math.max(1, Math.ceil(state.totalRows / state.currentLimit));

        if (!msg) {
            // Info mit Zeilen- und Spaltenanzahl
            const cols = state.currentTableCols?.length || 0;
            const colInfo = cols > 0 ? ` (${cols} Spalte${cols !== 1 ? 'n' : ''})` : '';
            msg = `${n.toLocaleString('de-DE')} Zeile${n !== 1 ? 'n' : ''}${colInfo} in ${state.lastQueryDuration.toFixed(2)}ms geladen.`;
        }
        

        setStatus(msg, 'success');
        const resultInfo = document.getElementById('result-info');
        const headerInfo = document.getElementById('header-info');

        if (resultInfo) {
            // Wenn eine Tabelle aktiv ist, wird die Zeileninfo im Footer angezeigt.
            // Daher hier den resultInfo-Text leeren, um Redundanz zu vermeiden.
            if (state.currentTable) resultInfo.textContent = '';
            else resultInfo.textContent = msg;
        }

        // Header Info ebenfalls leeren, wenn eine Tabelle aktiv ist (Info steht im Footer)
        // Dies löscht die Angabe "Antwort empfangen" aus dem Header oben.
        if (headerInfo && state.currentTable) headerInfo.textContent = '';

        const exportBtns = document.getElementById('export-btns');
        if (exportBtns) exportBtns.style.display = n > 0 ? 'flex' : 'none';

        if (!override) {
            addToHistory(finalSql.trim());
            const tab = state.sqlTabs.find(x => x.id === state.activeTab);
            if (tab) {
                tab.sql = finalSql;
                tab.tableName = state.currentTable;
                // Falls der Tab noch "Query X" heißt, benennen wir ihn zur Tabelle um
                if (state.currentTable && tab.title.startsWith('Query')) {
                    tab.title = state.currentTable;
                    renderTabs();
                }
            }
        }

        initActionBar();
        _highlightTableInSidebar(state.currentTable);

        // Intelligente Aktualisierung basierend auf den vom Parser erkannten Events
        const events = (queryInfo && queryInfo.events) || [];
        const hasSchemaChanges = events.some(e => e.type === 'TABLE_CREATED') || 
                                 /\b(DROP|ALTER|RENAME)\b/i.test(finalSql);

        if (hasSchemaChanges) {
            await _refreshTableList();
            // Komfort-Feature: Wenn eine Tabelle erstellt wurde, setze sie als aktiv
            const createEvent = events.find(e => e.type === 'TABLE_CREATED');
            if (createEvent && createEvent.tableName) {
                state.currentTable = createEvent.tableName;
            }
        }

        // Update the footer display after data is loaded
        window._updateFooterDisplay();

    } catch (err) {
        if (signal?.aborted) return;

        // Fehlerzeile im Editor markieren
        const errorStr  = err.toString();
        const lineMatch = errorStr.match(/line (\d+)/i);
        if (lineMatch && !override && state.editor) {
            const errorLine    = parseInt(lineMatch[1]);
            const absoluteLine = startOffsetLine + (errorLine - 1);
            setEditorError(errorStr, absoluteLine, 1);
        }

        setStatus('SQL Fehler: ' + err, 'error');
        const resultInfo = document.getElementById('result-info');
        if (resultInfo) resultInfo.textContent = 'Kein Ergebnis.';
        _clearResults();
        // Reset footer display on error
        state.totalRows = 0;
        state.totalPages = 1;
        window._updateFooterDisplay();

    } finally {
        _isExecuting = false;
        _abortListenerAdded = false;  // Reset für die nächste Ausführung
        // Button immer neu vom DOM holen, um sicherzustellen, dass wir auf dem aktuellen Button arbeiten
        const currentRunBtn = document.getElementById('run-btn');
        if (currentRunBtn) {
            currentRunBtn.disabled    = false;
            currentRunBtn.textContent = '▶ Ausführen';
        }
    }
}

// ── Sidebar-Highlight ──────────────────────────────────────────────────

function _highlightTableInSidebar(name) {
    document.querySelectorAll('#table-list .table-item').forEach(el => {
        const nameInEl = el.querySelector('.table-name')?.dataset.name;
        el.classList.toggle('active', nameInEl === name);
    });
}

// ── ② onHasSelection verdrahten ───────────────────────────────────────
// Der Run-Button zeigt "▶ Auswahl" wenn Text markiert ist, sonst "▶ Ausführen"
export function initSelectionTracking() {
    setSelectionCallback((hasSelection) => {
        const runBtn = document.getElementById('run-btn');
        if (!runBtn || _isExecuting) return;
        runBtn.textContent = hasSelection ? '▶ Auswahl ausführen' : '▶ Ausführen';
    });
}

// ── Quick Builder Buttons ──────────────────────────────────────────────

export function initBuilderButtons() {
    const selTable = document.getElementById('sel-table');
    const runBtn   = document.getElementById('run-btn');

    if (!runBtn) {
        console.error('[executor] #run-btn nicht gefunden.');
        return;
    }
    runBtn.addEventListener('click', () => execSQL());

    selTable?.addEventListener('change', () => {
        const v = selTable.value;
        if (v) quickView(v);
    });

    document.getElementById('btn-asc')?.addEventListener('click', () => {
        const t = selTable?.value;
        const c = document.getElementById('sel-sort')?.value;
        if (!t || !c) return;
        setEditorVal(state, `SELECT * FROM ${esc(t)} ORDER BY ${esc(c)} ASC LIMIT 500;`);
        if (!t || !c) return; // Use state.currentLimit here too
        setEditorVal(state, `SELECT * FROM ${esc(t)} ORDER BY ${esc(c)} ASC LIMIT ${state.currentLimit} OFFSET ${(state.currentPage - 1) * state.currentLimit};`);
        execSQL();
    });

    document.getElementById('btn-desc')?.addEventListener('click', () => {
        const t = selTable?.value;
        const c = document.getElementById('sel-sort')?.value;
        if (!t || !c) return;
        setEditorVal(state, `SELECT * FROM ${esc(t)} ORDER BY ${esc(c)} DESC LIMIT 500;`);
        if (!t || !c) return; // Use state.currentLimit here too
        setEditorVal(state, `SELECT * FROM ${esc(t)} ORDER BY ${esc(c)} DESC LIMIT ${state.currentLimit} OFFSET ${(state.currentPage - 1) * state.currentLimit};`);
        execSQL();
    });

    document.getElementById('btn-count')?.addEventListener('click', () => {
        const t = selTable?.value;
        if (!t) return;
        setEditorVal(state, `SELECT COUNT(*) AS anzahl FROM ${esc(t)};`);
        execSQL();
    });

    console.log('[executor] Builder-Buttons initialisiert.');
}
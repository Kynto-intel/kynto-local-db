/* ── modules/views.js ─────────────────────────────────────────────────
   Alle Result-Views: Tabelle, Chart, Schema (ALTER TABLE), Cell-Modal.

   FIXES gegenüber der alten Version:
   1. Bug Zeile 119: `thNum.style` toter Code entfernt.
   2. Spalten-Resize: Drag-Handle am rechten Header-Rand, mousedown/move/up.
   3. Inline-Editing: contentEditable nur bei Doppelklick aktivieren,
      nicht dauerhaft auf jeder Zelle.
   4. Drag-Select Performance: renderRows() im mouseenter-Handler wird
      jetzt per requestAnimationFrame gedrosselt statt bei jedem Event.
   ──────────────────────────────────────────────────────────────────── */

import { state, DUCK_TYPES }        from './state.js';
import { esc, escH, setStatus, setEditorVal } from './utils.js';
import { refreshTableList } from './sidebar.js';
import { showRelationsDiagram, getRelationsSummaryHtml, findPrimaryKey } from './relations.js';
import { KyntoVisualizer, syncVisualizerButton } from './visualizer.js';
import { KyntoDashboard } from './dashboard.js';
import { DataFormatter } from './DataFormatter.js';
import { isNonNullable } from '../../src/lib/isNonNullable.js';
import { initActionBar } from './action-bar.js';
import { renderTabs } from './tabs.js';
import { KyntoGrid } from './kyntoGrid.js';
import { KyntoRealtime } from './useKyntoRealtime.js';
import { renderChartView, buildChart } from './views/chart/index.js';

// ── TableGridEditor-Modul ──────────────────────────────────────────────────
import { TableGridEditor, ENTITY_TYPE, confirmDeleteColumn } from './TableGridEditor/index.js';

// ── Table Rows (Zeilen-Verwaltung für Grid) ────────────────────────────────
import { 
    createTableRow,
    updateTableRow,
} from './table-rows/index.js';

// ── Tables (Tabellenstruktur-Verwaltung) ───────────────────────────────────
import {
    createTable,
    deleteTable,
    updateTable,
    getTables,
} from './tables/index.js';

// ── Table Editor (Metadaten & Typ-Utilities) ───────────────────────────────
import {
    ENTITY_TYPE as TE_ENTITY_TYPE,
    getTableStats,
    formatColumnName,
    formatDataType,
} from './table-editor/index.js';

// ── Drag-to-Select State ───────────────────────────────────────────────

let isDragging    = false;
let dragStartIdx  = -1;
let dragMode      = true;   // true = selektieren, false = deselektieren
// FIX 4: rAF-Flag für Drag-Select – verhindert mehrfaches renderRows() pro Frame
let dragRafPending = false;

// Rekursions-Schutz für clearResults
let isClearing = false;

window.addEventListener('mouseup', () => { isDragging = false; });

// ── REALTIME UPDATE HANDLER ────────────────────────────────────────────────

export function handleRealtimeUpdate(newRows) {
    console.log('[views.handleRealtimeUpdate] Verarbeite', newRows.length, 'neue Zeilen');
    console.log('[views.handleRealtimeUpdate] Erste Zeile:', newRows[0]);
    
    if (!Array.isArray(newRows) || newRows.length === 0) {
        console.warn('[views.handleRealtimeUpdate] Keine Zeilen zum Hinzufügen');
        return;
    }

    try {
        // DEBUG: Überprüfe die neuen Zeilen VOR dem unshift
        const firstNewRow = newRows[0];
        console.log('[views.handleRealtimeUpdate] firstNewRow keys:', firstNewRow ? Object.keys(firstNewRow) : 'null');
        console.log('[views.handleRealtimeUpdate] state.lastData.length VORHER:', state.lastData.length);
        
        // Neue Zeilen an state.lastData hinzufügen (oben)
        state.lastData.unshift(...newRows);
        console.log('[views.handleRealtimeUpdate] state.lastData.length NACHHER:', state.lastData.length);

        // Grid neu rendern mit TableGridEditor (saubere Methode)
        if (typeof TableGridEditor?.renderCurrentData === 'function') {
            TableGridEditor.renderCurrentData();
            console.log('[views.handleRealtimeUpdate] Grid neu gerendert mit neuen Zeilen');
        }
    } catch (err) {
        console.error('[views.handleRealtimeUpdate] Fehler beim Grid-Update:', err);
    }
}

// ── View Switcher ──────────────────────────────────────────────────────

export function showView(view) {
    console.log('[showView] Switching to view:', view);
    
    // Falls 'editor' aufgerufen wird (z.B. von Vorlagen), 
    // klappen wir den Editor auf und zeigen die Tabellen-Ansicht.
    if (view === 'editor') {
        const area = document.querySelector('.editor-area');
        if (area && !area.classList.contains('sql-visible')) {
            area.classList.add('sql-visible');
            if (state.editor) setTimeout(() => state.editor.layout(), 50);
        }
        view = 'table'; // Mapping auf 'table', damit die Tabs nicht verschwinden
    }

    // Fußzeilen-Buttons synchronisieren
    const footDefBtn = document.getElementById('footer-def-btn');
    if (footDefBtn) footDefBtn.classList.toggle('active', view === 'definition');

    // Alle Tab-Buttons deaktivieren, dann nur die aktive aktivieren
    // Dies betrifft die "Daten" / "Schema" Buttons im Header
    document.querySelectorAll('.kha-btn').forEach(b => b.classList.remove('active'));
    
    // Standard-Tabs (Result-Tabs) synchronisieren
    document.querySelectorAll('.result-tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.result-tab').forEach(b => {
        if (b.dataset.view === view) b.classList.add('active');
    });

    const tv = document.getElementById('result-table-view');
    const cv = document.getElementById('result-chart-view');
    const sv = document.getElementById('result-schema-view');
    const rv = document.getElementById('result-rls-view');

    console.log('[showView] DOM Elements:', { tv: !!tv, cv: !!cv, sv: !!sv, rv: !!rv });

    // Alle Views verstecken, dann nur die aktive anzeigen
    [tv, cv, sv, rv].forEach(v => {
        if (v) {
            v.classList.remove('active');
            const wasActive = window.getComputedStyle(v).display !== 'none';
        }
    });
    
    if (tv && (view === 'table' || view === 'definition')) {
        tv.classList.add('active');
        console.log('[showView] TV activated, classes:', tv.className, 'display:', window.getComputedStyle(tv).display);
    }
    if (cv && view === 'chart') {
        cv.classList.add('active');
        console.log('[showView] CV activated, classes:', cv.className, 'display:', window.getComputedStyle(cv).display);
    }
    if (sv && view === 'schema') {
        sv.classList.add('active');
        console.log('[showView] SV activated, classes:', sv.className, 'display:', window.getComputedStyle(sv).display);
    }
    if (rv && view === 'rls-policies') {
        rv.classList.add('active');
        console.log('[showView] RV activated, classes:', rv.className, 'display:', window.getComputedStyle(rv).display);
    }

    // Falls wir aus dem Dashboard kommen, müssen wir die Tabs und Info-Leiste wieder einblenden
    if (['table', 'chart', 'schema', 'definition', 'rls-policies'].includes(view)) {
        document.querySelectorAll('.result-tab, .export-btns').forEach(el => el.style.display = 'flex');
        const resInfo = document.getElementById('result-info');
        if (resInfo) resInfo.style.display = 'block';
        
        const actionBar = document.getElementById('action-bar-container');
        if (actionBar && state.currentTable) actionBar.style.display = 'flex';
    }
    
    // Update footer display whenever view changes
    _updateFooterDisplay();

    // Banner-Sichtbarkeit: Nur wenn eine Tabelle offen ist und wir in der Daten- oder Definitionsansicht sind
    const footer = document.getElementById('result-footer');
    if (footer) {
        footer.style.display = (state.currentTable && (view === 'table' || view === 'definition')) ? 'flex' : 'none';
    }

    // Synchronisiere den Status mit dem TableGridEditor, damit dieser 
    // beim Tabellenwechsel in der Sidebar weiß, in welcher Ansicht er bleiben soll.
    if (window.TableGridEditor) {
        const editorView = view === 'table' ? 'data' : view; 
        window.TableGridEditor.setViewState(editorView);
    }

    // API-Panel synchronisieren, falls vorhanden (verhindert TypeError)
    if (window.instantAPIPanel && typeof window.instantAPIPanel.refreshState === 'function') {
        window.instantAPIPanel.refreshState();
    }

    // Delegation: Wenn Tabelle aktiv, lass den Editor das Grid zeichnen
    if (view === 'table') {
        if (window.TableGridEditor) {
            window.TableGridEditor.renderCurrentData();
        }
    }

    if (view === 'chart') {
        console.log('[showView] Rendering chart view');
        renderChartView();
    } else if (view === 'rls-policies') {
        console.log('[showView] Loading RLS policies panel');
        import('./views/rls-policies/index.js').then(m => m.initRLSPoliciesPanel().then(p => {
            const target = rv || sv;
            if (target) { target.innerHTML = ''; target.appendChild(p); }
        })).catch(err => console.error('[showView] RLS panel error:', err));
    } else if (view === 'schema' || view === 'definition') {
        console.log('[showView] Switching TableGridEditor to view:', view);
        // Tab-Wechsel: Editor anweisen, die entsprechende Ansicht zu laden
        if (window.TableGridEditor) {
            window.TableGridEditor.switchView(view);
        } else {
            console.error('[showView] TableGridEditor not found for schema/definition');
        }
    }
}

// Wichtig für den Zugriff aus Vorlagen-Modulen
window.showView = showView;

/**
 * Dashboard anzeigen (mit Datenbank-Statistiken)
 */
export function showDashboard(showAll = true) {
    // Tabellen-Kontext löschen
    state.currentTable = null;
    state.currentTableType = null;
    state.currentSchema = null;

    const tv = document.getElementById('result-table-view');
    try {
        if (KyntoDashboard && typeof KyntoDashboard.render === 'function') {
            tv.innerHTML = ''; // Clear before rendering
            KyntoDashboard.render(tv, showAll);
            console.log('[showDashboard] Dashboard wurde gerendert (showAll=' + showAll + ')');
        } else {
            throw new Error("Dashboard not loaded");
        }
    } catch (e) {
        console.error("[showDashboard] Dashboard Render Fail:", e);
        tv.innerHTML = '<div class="empty-state"><div class="icon">🏠</div><div>Dashboard konnte nicht geladen werden.</div></div>';
    }

    // Dashboard-Modus: Tabs, Footer und Action-Bar VERSTECKEN
    document.querySelectorAll('.result-tab').forEach(el => el.style.display = 'none');
    document.querySelector('.export-btns')?.style.display === 'flex' && (document.querySelector('.export-btns').style.display = 'none');
    document.getElementById('result-info').style.display = 'none';
    
    // Footer (Pagination/Info unten) verstecken
    const pagination = document.querySelector('[style*="display:flex"][style*="justify-content:space-between"][style*="align-items:center"]');
    if (pagination) pagination.style.display = 'none';
    
    // Alle Footer-Elemente verstecken
    document.querySelectorAll('.result-view + div').forEach(el => el.style.display = 'none');

    const actionBar = document.getElementById('action-bar-container');
    if (actionBar) {
        actionBar.style.display = 'none';
        actionBar.innerHTML = '';
    }

    // Table-View als aktiv setzen
    document.querySelectorAll('.result-view').forEach(v => v.classList.remove('active'));
    document.getElementById('result-table-view')?.classList.add('active');

    const currentDbId = state.dbMode === 'pglite' ? state.pgId : (state.activeDbId || state.pgId || '');
    const dbName = (typeof currentDbId === 'string' ? currentDbId : String(currentDbId || '')).split(/[/\\]/).pop() || 'Kynto';
    setStatus(`🏠 Dashboard${showAll ? '' : ': ' + dbName}`, 'info');

    // Tab-Titel aktualisieren
    const activeTab = state.sqlTabs.find(t => t.id === state.activeTab);
    if (activeTab) {
        activeTab.title = `🏠 ${showAll ? 'Dashboard' : 'Dashboard: ' + dbName}`;
        activeTab.tableName = null;
        renderTabs();
    }
}

window.showDashboard = showDashboard;

export function initViewTabs() {
    document.querySelectorAll('.result-tab').forEach(btn =>
        btn.addEventListener('click', () => showView(btn.dataset.view)));
}

// ── Clear / Empty State ────────────────────────────────────────────────

export function clearResults() {
    if (isClearing) return;
    
    // ✅ Wenn gerade eine Tabelle offen ist, nicht clearResults ausführen!
    if (state.currentTable) {
        console.log('[clearResults] ⚠️ Tabelle ist noch offen:', state.currentTable, '- ignoriere clearResults()');
        return;
    }
    
    console.log('[clearResults] ✅ Keine Tabelle offen, Anfrage-Ergebnisse werden gelöscht');
    isClearing = true;

    // TableGridEditor aufräumen bevor der State geleert wird
    TableGridEditor.close();

    // Wichtig: Beim Wechsel zum Dashboard den Tabellen-Kontext löschen
    state.currentTable = null;
    state.currentTableType = null;
    state.currentSchema = null;

    const tv = document.getElementById('result-table-view');
    
    // ❌ NICHT automatisch Dashboard rendieren!
    // Stattdessen: Leere Ansicht zeigen
    tv.innerHTML = '<div class="empty-state"><div class="icon">🦆</div><div>SQL ausführen oder Tabelle anklicken.</div></div>';

    // Dashboard-Modus: Tabs, Info, Action-Bar und alle Export/Visualizer-Buttons verstecken
    document.querySelectorAll('.result-tab, .export-btns').forEach(el => el.style.display = 'flex');
    document.getElementById('result-info').style.display = 'none';

    const actionBar = document.getElementById('action-bar-container');
    if (actionBar) {
        actionBar.style.display = 'none';
        actionBar.innerHTML = ''; // Inhalt leeren, um alte Buttons zu entfernen
    }

    const currentDbId = state.dbMode === 'pglite' ? state.pgId : (state.activeDbId || state.pgId || '');
    const dbName = (typeof currentDbId === 'string' ? currentDbId : String(currentDbId || '')).split(/[/\\]/).pop() || 'Unbekannt';

    setStatus(`Bereit`, 'info');

    // Tab-Titel aktualisieren
    const activeTab = state.sqlTabs.find(t => t.id === state.activeTab);
    if (activeTab) {
        activeTab.title = `Neue Anfrage`;
        activeTab.tableName = null;
        renderTabs();
    }

    state.lastData = [];
    
    isClearing = false;
}

// Globaler Zugriff damit sidebar.js / andere Module clearResults() aufrufen können
window.clearResults = clearResults;

// ── Tabelle / View im TableGridEditor öffnen ───────────────────────────────
// Wird von sidebar.js aufgerufen wenn der Nutzer eine Tabelle anklickt.
// Auch nutzbar aus dem SQL-Editor heraus: window.openTableInEditor('meine_tabelle')
// Parameter: tableName, schema, entityType, source ('pglite' oder 'remote')

export async function openTableInEditor(tableName, schema = null, entityType = ENTITY_TYPE.TABLE, source = 'pglite') {
    if (!isNonNullable(tableName) || tableName === 'undefined') {
        console.warn('[openTableInEditor] Ungültiger Tabellenname:', tableName);
        return;
    }

    console.log('[openTableInEditor] START für Tabelle:', tableName, 'Schema:', schema, 'Source:', source);

    let actualTableName = tableName;
    let actualSchema = schema;
    let actualDatabase = null;
    
    // Wenn tableName einen dotted path hat, extrahiere die Komponenten
    if (tableName.includes('.')) {
        const parts = tableName.split('.');
        if (parts.length === 3) {
            // 3-teil: "postgres_server.public.tabelle"
            actualDatabase = parts[0];
            actualSchema = parts[1];
            actualTableName = parts[2];
        } else if (parts.length === 2) {
            // 2-teil: "schema.tabelle"
            actualSchema = parts[0];
            actualTableName = parts[1];
        }
    }

    // NEU: Wenn source === 'remote', markiere als Remote-Datenbank
    if (source === 'remote') {
        actualDatabase = 'remote';  // Spezielle Markierung für Remote-DB
        actualSchema = actualSchema || 'public';
        console.log('[openTableInEditor] Remote-Datenbank erkannt von source Parameter');
    }

    // FIX: Wenn kein Catalog im Namen war und source nicht explizit 'pglite' ist,
    // aber eine Remote-Verbindung aktiv ist, setzen wir den Standard-Catalog 'postgres_server'.
    // WICHTIG: source-Parameter hat Vorrang vor automatischer Remote-Erkennung!
    if (!actualDatabase && source !== 'pglite' && (state.dbMode === 'remote' || state.remoteConnectionString)) {
        actualDatabase = 'postgres_server';
        console.log('[openTableInEditor] Verwende postgres_server Katalog für externe Tabelle');
    }

    // CRITICAL FIX: Datenbank-Modus synchronisieren, sonst sucht execSQL in der falschen DB
    if (source === 'remote' || actualDatabase === 'remote' || actualDatabase === 'postgres_server') {
        state.dbMode = 'remote';
        state.pgMode = false;
    } else {
        state.dbMode = 'pglite';
        state.pgMode = true;
    }

    // Fallback-Logik für das Schema: Postgres bevorzugt 'public', DuckDB 'main'
    if (!actualSchema) {
        actualSchema = (actualDatabase === 'postgres_server' || actualDatabase === 'remote' || state.dbMode === 'remote') ? 'public' : 'main';
    }

    // Sicherheits-Guard: Leerer oder ungültiger Name nach Verarbeitung
    if (!actualTableName || actualTableName === 'undefined') {
        console.warn('[openTableInEditor] Tabellenname nach Verarbeitung leer:', tableName);
        return;
    }

    state.currentTable     = tableName; // Vollen Pfad speichern, um Kontext (DB/Schema) zu erhalten
    state.currentTableType = entityType;
    state.currentSchema    = actualSchema;

    // Paginierung auf Seite 1 zurücksetzen beim Tabellenwechsel
    state.currentPage = 1;
    _updateFooterDisplay();

    // Tab-Titel aktualisieren, damit dort nicht mehr nur "Query" steht
    const activeTab = state.sqlTabs.find(t => t.id === state.activeTab);
    if (activeTab) {
        console.log('[views.openTableInEditor] Aktualisiere activeTab - ID:', state.activeTab, 'Alter Titel:', activeTab.title, 'Neue Tabelle:', actualTableName);
        activeTab.title = actualTableName;
        activeTab.tableName = tableName; // Vollen Pfad sichern, damit Tab-Reaktivierung korrekt funktioniert
        activeTab.source = source;  // ✅ Speichere auch die source (remote oder pglite)
        const { renderTabs } = await import('./tabs/index.js');
        renderTabs();
    }

    let dbId = state.dbMode === 'pglite' ? state.pgId : (state.activeDbId || state.pgId || '');
    if (typeof dbId === 'object' && dbId !== null) dbId = dbId.id;
    if (typeof dbId !== 'string') dbId = String(dbId || '');

    // Entity-Objekt zusammenbauen 
    const entity = {
        id:          actualTableName,
        name:        actualTableName,
        schema:      actualSchema,
        database:    actualDatabase,  // z.B. "postgres_server" oder "remote"
        entity_type: entityType,
        rls_enabled: false,
        source:      source,  // NEU: Markierung ob 'pglite' oder 'remote'
    };

    await TableGridEditor.open({ entity, dbId, lints: [] });

    // ✅ WICHTIG: Dashboard-HTML löschen und zu Table-View wechseln
    // Das Dashboard wird in #result-table-view gerendert, muss aber gelöscht werden
    // wenn wir eine Tabelle öffnen
    const tableView = document.getElementById('result-table-view');
    if (tableView) {
        // Lösche Dashboard falls noch vorhanden
        tableView.innerHTML = '';
    }

    // Action-Bar zeigen und aktualisieren
    const actionBar = document.getElementById('action-bar-container');
    if (actionBar) {
        actionBar.style.display = 'flex';  // Sichtbar machen
    }
    initActionBar();

    // Typ-Highlighting Button mit aktuellem State synchen
    syncVisualizerButton();

    // Tabs und Export-Buttons sichtbar machen
    document.querySelectorAll('.result-tab, .export-btns').forEach(el => el.style.display = 'flex');
    document.getElementById('result-info').style.display = 'block';

    // ✅ Tabelle sofort laden, damit Footer und Grid befüllt werden
    // WICHTIG: _reloadCurrentTableData() -> execSQL() wird showView('table') aufrufen
    // Daher müssen wir hier NICHT showView() aufrufen (würde nur duplizieren)
    await _reloadCurrentTableData();

    // ✅ REALTIME-INTEGRATION: KyntoGrid mit Tabelle verbinden
    if (state.realtimeActive && typeof KyntoGrid !== 'undefined') {
        try {
            console.log('[views.openTableInEditor] Startet KyntoGrid.attach...');
            await KyntoGrid.attach(entity);
            console.log('[views.openTableInEditor] KyntoGrid.attach erfolgreich');
        } catch (err) {
            console.error('[views.openTableInEditor] KyntoGrid.attach Fehler:', err);
            setStatus(`Realtime konnte nicht gestartet werden: ${err.message}`, 'error');
        }
    }
}

/**
 * Generiert und zeigt die SELECT-Query für eine Tabelle im SQL-Editor
 */
function _generateAndShowSQL(tableName, schema, limit = state.currentLimit, page = state.currentPage) {
    if (!tableName) return;
    // Wenn tableName bereits einen Punkt enthält (vollqualifiziert), nutze ihn direkt, sonst Schema davor
    const fullPath = tableName.includes('.') ? tableName : `${schema || 'public'}.${tableName}`;
    const qualified = esc(fullPath);
    const offset = (page - 1) * limit;
    // Use state.currentLimit and state.currentPage for the query
    const sql = `SELECT * FROM ${qualified} LIMIT ${limit} OFFSET ${offset};`;
    
    if (window.setEditorVal instanceof Function) {
        window.setEditorVal(state, sql);
    } else if (state.editor?.setValue) {
        state.editor.setValue(sql);
    } else {
        const fb = document.getElementById('sql-fallback');
        if (fb) fb.value = sql;
    }
    return sql;
}

// Globaler Zugriff für sidebar.js (verhindert zirkulären Import)
window.openTableInEditor = openTableInEditor;

// ── Cell Modal ─────────────────────────────────────────────────────────
// Einfachklick  → Inline-Edit auf der Zelle
// Doppelklick   → Minimales Popup: nur dünner Rahmen + Inhalt
//                 Klick irgendwo → schließt es wieder

let _activeTd = null;

export function initCellModal() {
    const tv = document.getElementById('result-table-view');
    _injectCellModal();

    // Der dblclick-Listener wurde in den TableGridEditor verschoben (CellEditorPopup)
    // um ein kontextbezogenes Editieren direkt an der Zelle zu ermöglichen.

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') _closeCellModal();
    });
}

function _injectCellModal() {
    const old = document.getElementById('cell-modal');
    if (old) old.remove();
    const oldO = document.getElementById('cell-modal-overlay');
    if (oldO) oldO.remove();

    if (!document.getElementById('cell-modal-styles')) {
        const s = document.createElement('style');
        s.id = 'cell-modal-styles';
        s.textContent = `
            #cell-modal-overlay {
                display: none;
                position: fixed;
                inset: 0;
                z-index: 3000;
                /* kein Backdrop-Blur, kein dunkles Overlay – transparent */
            }
            #cell-modal-overlay.open { display: block; }

            #cell-modal-box {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: var(--surface);
                border: 1px solid var(--border);
                border-radius: 8px;
                padding: 12px 16px;
                min-width: 160px;
                max-width: min(640px, 88vw);
                max-height: 60vh;
                width: max-content;
                overflow-y: auto;
                box-shadow: 0 8px 32px rgba(0,0,0,0.45);
                animation: cm-pop 0.14s cubic-bezier(0.16,1,0.3,1);
                cursor: pointer;
                user-select: text;
            }
            @keyframes cm-pop {
                from { opacity: 0; transform: translate(-50%, -48%) scale(0.97); }
                to   { opacity: 1; transform: translate(-50%, -50%) scale(1);    }
            }

            #cell-modal-text {
                font-family: var(--font-mono);
                font-size: 13px;
                line-height: 1.7;
                color: var(--text);
                white-space: pre-wrap;
                word-break: break-word;
            }
            #cell-modal-text.is-null {
                color: var(--muted);
                font-style: italic;
            }
        `;
        document.head.appendChild(s);
    }

    const overlay = document.createElement('div');
    overlay.id = 'cell-modal-overlay';
    overlay.innerHTML = `<div id="cell-modal-box"><div id="cell-modal-text"></div></div>`;
    document.body.appendChild(overlay);

    // Klick irgendwo (auch auf den Box-Inhalt) schließt
    overlay.addEventListener('click', _closeCellModal);
}

function _openCellModal(rawVal, isNull) {
    const overlay = document.getElementById('cell-modal-overlay');
    if (!overlay) return;
    const textEl = document.getElementById('cell-modal-text');
    textEl.textContent = isNull ? 'NULL' : rawVal;
    textEl.classList.toggle('is-null', isNull);
    overlay.classList.add('open');
}

function _closeCellModal() {
    document.getElementById('cell-modal-overlay')?.classList.remove('open');
    _activeTd = null;
}

/**
 * Injeziert einen modernen Banner am unteren Rand der Ergebnis-Ansicht.
 * Enthält Informationen über Seiten, Zeilen, Einträge und Schnellzugriff auf die Definition.
 */
function _injectResultFooter() {
    if (document.getElementById('result-footer')) return;

    const style = document.createElement('style');
    style.id = 'result-footer-styles';
    style.textContent = `
        #result-footer {
            display: none; height: 32px; background: var(--surface2);
            border-top: 1px solid var(--border); align-items: center;
            padding: 0 15px; font-size: 11px; color: var(--muted);
            gap: 15px; position: absolute; bottom: 0; left: 0; right: 0;
            z-index: 100; user-select: none;
        }
        .f-sec { display: flex; align-items: center; gap: 4px; }
        .f-val { color: var(--text); font-weight: 600; }
        .f-sep { width: 1px; height: 12px; background: var(--border); opacity: 0.5; }
        .f-btn { cursor: pointer; color: var(--accent); font-weight: 600; transition: opacity 0.2s; padding: 0 4px; border-radius: 4px; }
        .f-btn:hover { opacity: 0.8; background: rgba(255,255,255,0.05); }
        .f-btn.active { color: var(--text); background: rgba(194, 154, 64, 0.2); border: 1px solid var(--accent); }
        #footer-def-btn:hover { text-decoration: underline; }
        .f-input {
            background: rgba(255,255,255,0.05); border: 1px solid var(--border);
            border-radius: 3px; color: var(--text); font-size: 11px; font-weight: 600;
            width: 32px; text-align: center; outline: none; padding: 0; height: 18px;
            margin: 0 2px;
        }
        .f-input:focus { border-color: var(--accent); background: rgba(255,255,255,0.1); }
        .f-input::-webkit-outer-spin-button, .f-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        .f-relative { position: relative; display: flex; align-items: center; }
        .f-menu {
            position: absolute; bottom: 100%; left: 0; background: var(--surface2);
            border: 1px solid var(--border); border-radius: 4px; 
            display: none; flex-direction: column; min-width: 110px;
            box-shadow: 0 -4px 12px rgba(0,0,0,0.3); z-index: 101; margin-bottom: 5px;
        }
        .f-menu.open { display: flex; }
        .f-menu-item { padding: 6px 12px; cursor: pointer; color: var(--text); }
        .f-menu-item:hover { background: var(--accent); color: #000; }
    `;
    document.head.appendChild(style);

    const footer = document.createElement('div');
    footer.id = 'result-footer';
    footer.innerHTML = `
        <div class="f-sec">
            <span class="f-btn" id="footer-prev-page" title="Vorherige Seite" ${state.currentPage <= 1 ? 'disabled' : ''}>◀</span>
            Seite <input type="number" id="footer-curr-page" class="f-input" value="${state.currentPage}" min="1"> von <span class="f-val" id="footer-total-pages">${state.totalPages}</span>
            <span class="f-btn" id="footer-next-page" title="Nächste Seite" ${state.currentPage >= state.totalPages ? 'disabled' : ''}>▶</span>
        </div>
        <div class="f-sep"></div>
        <div class="f-relative">
            <div class="f-sec f-btn" id="footer-rows-btn"><span class="f-val">100</span> Zeilen</div>
            <div id="footer-rows-menu" class="f-menu">
                <div class="f-menu-item" data-val="100">100 Zeilen</div>
                <div class="f-menu-item" data-val="500">500 Zeilen</div>
                <div class="f-menu-item" data-val="1000">1000 Zeilen</div>
            </div>
        </div> 
        <div class="f-sep"></div>
        <div class="f-sec"><span class="f-val" id="footer-total-entries">${state.totalRows.toLocaleString('de-DE')}</span> Einträge gesamt</div>
        <div class="f-sec" style="margin-left: auto; gap: 10px;">
            <div class="f-sec f-btn" id="footer-def-btn">Definition</div>
        </div>
    `;

    const tv = document.getElementById('result-table-view');
    if (tv && tv.parentNode) {
        // Wir hängen den Banner an das Parent-Element an, damit er nicht durch tv.innerHTML = ... (Dashboard) gelöscht wird.
        tv.parentNode.style.position = 'relative';
        tv.parentNode.appendChild(footer);
        tv.style.paddingBottom = '32px'; 
    }

    const footerCurrPage = document.getElementById('footer-curr-page');
    const footerPrevPage = document.getElementById('footer-prev-page');
    const footerNextPage = document.getElementById('footer-next-page');
    const footerRowsBtn = document.getElementById('footer-rows-btn');
    const footerRowsMenu = document.getElementById('footer-rows-menu');
    const footerDefBtn = document.getElementById('footer-def-btn');

    footerCurrPage?.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter') {
            e.target.blur();
            const newPage = parseInt(footerCurrPage.value);
            if (newPage > 0 && newPage <= state.totalPages && newPage !== state.currentPage) {
                state.currentPage = newPage;
                await _reloadCurrentTableData();
            } else {
                footerCurrPage.value = state.currentPage; // Reset if invalid
            }
        }
    });

    footerPrevPage?.addEventListener('click', async () => {
        if (state.currentPage > 1) {
            state.currentPage--;
            await _reloadCurrentTableData();
        }
    });

    footerNextPage?.addEventListener('click', async () => {
        if (state.currentPage < state.totalPages) {
            state.currentPage++;
            await _reloadCurrentTableData();
        }
    });

    footerRowsBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        footerRowsMenu?.classList.toggle('open');
    });
    document.addEventListener('click', () => footerRowsMenu?.classList.remove('open'));

    footerRowsMenu?.querySelectorAll('.f-menu-item').forEach(item => {
        item.addEventListener('click', async (e) => {
            e.stopPropagation();
            const val = item.dataset.val;
            const valSpan = footerRowsBtn.querySelector('.f-val');
            if (valSpan) valSpan.textContent = val;

            const newLimit = parseInt(val);
            if (newLimit !== state.currentLimit) {
                state.currentLimit = newLimit;
                state.currentPage = 1; // Reset to first page when limit changes
                await _reloadCurrentTableData();
            }
        });
    });

    footerDefBtn?.addEventListener('click', async (e) => {
        e.preventDefault();
        
        if (!state.currentTable) {
            setStatus('Keine Tabelle ausgewählt.', 'error');
            return;
        }

        showView('definition');
    });
}

/**
 * Aktualisiert die Anzeige im Footer-Banner.
 */
function _updateFooterDisplay() {
    const footerCurrPage = document.getElementById('footer-curr-page');
    const footerTotalPages = document.getElementById('footer-total-pages');
    const footerTotalEntries = document.getElementById('footer-total-entries');
    const footerPrevPage = document.getElementById('footer-prev-page');
    const footerNextPage = document.getElementById('footer-next-page');
    const footerRowsBtnVal = document.getElementById('footer-rows-btn')?.querySelector('.f-val');

    if (footerCurrPage) footerCurrPage.value = state.currentPage;
    if (footerTotalPages) footerTotalPages.textContent = state.totalPages;
    if (footerTotalEntries) footerTotalEntries.textContent = state.totalRows.toLocaleString('de-DE');
    if (footerRowsBtnVal) footerRowsBtnVal.textContent = state.currentLimit;

    if (footerPrevPage) footerPrevPage.disabled = state.currentPage <= 1;
    if (footerNextPage) footerNextPage.disabled = state.currentPage >= state.totalPages;
}

/**
 * Lädt die Daten der aktuell geöffneten Tabelle neu, unter Berücksichtigung des aktuellen Limits und der Seite.
 */
async function _reloadCurrentTableData() {
    if (!state.currentTable) return;

    // Re-generate the SQL query with the new limit and page
    const sql = _generateAndShowSQL(state.currentTable, state.currentSchema, state.currentLimit, state.currentPage);

    // Execute the query. This will update state.lastData and trigger renderTableView.
    // We need to ensure execSQL is available globally or passed in.
    if (typeof window.execSQL === 'function') {
        await window.execSQL(sql); // SQL direkt übergeben, um Dashboard-Redirect und Selektions-Fehler zu vermeiden
    } else {
        console.error('window.execSQL is not defined. Cannot reload table data.');
    }
    _updateFooterDisplay();
}

// Initialisierung beim Laden des Moduls
_injectResultFooter();
window._updateFooterDisplay = _updateFooterDisplay; // Expose globally
window._reloadCurrentTableData = _reloadCurrentTableData; // Expose globally

// ── Chart View ─────────────────────────────────────────────────────────

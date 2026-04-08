/* ── TableGridEditor/TableGridEditor.js ────────────────────────────────────
   Haupt-Orchestrator des Table-Grid-Editors (PGlite/ProgressSQL).

   FIXES:
   1. Datenladen immer über pgQuery (nicht api.query mit DuckDB-Pfad)
   2. state.currentCols korrekt aus Row-Keys oder pgDescribe befüllen
   3. Schema-Auflösung: PGlite nutzt 'public', kein PRAGMA fallback
   4. fromClause korrekt ohne doppelte Anführungszeichen
   ────────────────────────────────────────────────────────────────────────── */

import { state }           from '../state.js';
import { esc, escH, setStatus } from '../utils.js';
import { refreshTableList }     from '../sidebar.js';
import { showView } from '../views.js';
import { KyntoVisualizer } from '../visualizer.js';
import { showRelationsDiagram, getRelationsSummaryHtml } from '../relations.js';
import { ColumnEditorSidebar } from '../ColumnEditorSidebar.js';
import { renderSchemaGrid } from '../views/schema/index.js';
import { TableContextMenu } from './TableContextMenu.js';
import { CellEditorPopup } from './CellEditorPopup.js';
import { CellTextEditorSidebar } from './CellTextEditorSidebar.js';
import { StorageCellRenderer, STORAGE_CELL_CSS } from './StorageCellRenderer.js';
import { KyntoStorage }                          from '../../../src/components/Storage/KyntoStorage.js';

import { TableDefinition }     from './TableDefinition.js';
import {
    confirmDeleteColumn,
    confirmDeleteTable,
    confirmDeleteRows,
} from './DeleteConfirmationDialogs.js';
import {
    isTableLike, isView, isMaterializedView, isForeignTable, isViewLike,
    ENTITY_TYPE,
} from './TableEntity.utils.js';
import { findPrimaryKey } from '../relations.js';
import { DataFormatter } from '../DataFormatter.js';
import { generateBulkInsertSQL } from '../data-faker.js';

// ── Table Rows (Zeilen-Verwaltung) ────────────────────────────────────────
import { 
    updateTableRow, 
    createTableRow,
    getCellValue
} from '../table-rows/index.js';

// ── Tables (Tabellenstruktur-Verwaltung) ──────────────────────────────────
import {
    createTable,
    deleteTable,
    updateTable,
    getTables,
} from '../tables/index.js';

// ── Table Editor (Metadaten & Typen) ──────────────────────────────────────
import {
    getTableStats,
    formatColumnName,
    formatDataType,
} from '../table-editor/index.js';

// ── Interner State ─────────────────────────────────────────────────────────
let _currentEntity    = null;
let _currentView      = 'data';   // 'data' | 'definition' | 'schema'
let _tableDefinition  = null;
const colWidths       = new Map();

let isDraggingRows    = false;
let dragStartIdx      = -1;
let dragMode          = true;
let dragRafPending    = false;

window.addEventListener('mouseup', () => { isDraggingRows = false; });

// ── Öffentliche API ────────────────────────────────────────────────────────

export const TableGridEditor = {

    async open({ entity, dbId, lints = [] }) {
        _currentEntity = entity;
        state.currentTable     = entity.name;
        state.currentTableType = entity.entity_type;

        // Storage-Renderer für dieses Grid initialisieren
        StorageCellRenderer.init(KyntoStorage);

        // CSS einmalig einfügen
        if (!document.getElementById('storage-cell-css')) {
            const style = document.createElement('style');
            style.id = 'storage-cell-css';
            style.textContent = STORAGE_CELL_CSS;
            document.head.appendChild(style);
        }

        _showTabs(true);
        await this.switchView(_currentView);

        if (typeof window.initActionBar === 'function') {
            window.initActionBar();
        }
    },

    close() {
        _currentEntity = null;
        _currentView   = 'data';
        if (_tableDefinition) { _tableDefinition.destroy(); _tableDefinition = null; }
    },

    renderCurrentData() {
        _renderDataGrid(state.lastData || []);
    },

    setViewState(view) {
        _currentView = view;
    },

    async switchView(view) {
        _currentView = view;

        const entity = _currentEntity;
        if (!entity) return;

        const tv = document.getElementById('result-table-view');
        if (tv && (view === 'data' || view === 'chart')) {
            tv.innerHTML = '<div class="kynto-tabledef-loading">⏳ Daten werden geladen...</div>';
        }

        if (view === 'data' || view === 'chart') {
            if (_tableDefinition) { _tableDefinition.destroy(); _tableDefinition = null; }
            try {
                // WICHTIG: Überprüfe ob die Tabelle von Remote-DB oder PGlite kommt
                const isRemote = entity.source === 'remote' || entity.database === 'remote';
                
                if (isRemote) {
                    // REMOTE-DB: Nutze dbQuery mit 'remote' Parameter
                    console.log('[TableGridEditor] Lade von Remote-DB:', entity.name);
                    const colInfo = await window.api.dbDescribe(entity.name, 'remote');
                    state.columnMetadata = colInfo || [];
                    state.currentCols = state.columnMetadata.map(c => c.column_name || c.name);

                    const sql = `SELECT * FROM "${entity.name}" LIMIT 1000`;
                    const rows = await window.api.dbQuery(sql, null, 'remote');
                    state.lastData = Array.isArray(rows) ? rows : [];
                } else {
                    // PGlite: Nutze pgQuery
                    console.log('[TableGridEditor] Lade von PGlite:', entity.name);
                    const pgId = state.pgId;
                    if (!pgId) throw new Error('Keine PGlite-Datenbank aktiv.');

                    const resolvedSchema = 'public';
                    state.currentSchema   = resolvedSchema;
                    state.currentDatabase = null;

                    const colInfo = await window.api.pgDescribe(pgId, entity.name);
                    state.columnMetadata = colInfo || [];
                    state.currentCols = state.columnMetadata.map(c => c.column_name || c.name);

                    const sql = `SELECT * FROM "${entity.name}" LIMIT 1000`;
                    const rows = await window.api.pgQuery(sql, pgId);
                    state.lastData = Array.isArray(rows) ? rows : [];
                }

                if (view === 'chart') {
                    showView('chart');
                } else {
                    showView('table');
                    setStatus(`${state.lastData.length} Zeilen aus "${entity.name}" geladen.`, 'info');
                    this.renderCurrentData();
                }

            } catch (err) {
                console.error('[TableGridEditor] Fehler beim Laden:', err);
                setStatus(`Fehler beim Laden: ${err.message ?? err}`, 'error');
                if (tv) tv.innerHTML = `<div class="empty-state" style="color:var(--error)">⚠️ ${escH(String(err.message ?? err))}</div>`;
            }

        } else if (view === 'definition') {
            console.log('[TableGridEditor] Switching to definition view for entity:', entity?.name);
            if (_tableDefinition) { _tableDefinition.destroy(); _tableDefinition = null; }

            const tv = document.getElementById('result-table-view');
            if (!tv) {
                console.error('[TableGridEditor] result-table-view container not found');
                return;
            }

            tv.onscroll = null;
            tv.innerHTML = '';

            const dbId = _getDbId();
            console.log('[TableGridEditor] Creating TableDefinition with dbId:', dbId, 'dbType:', (entity.source === 'remote' || entity.database === 'remote') ? 'remote' : 'local');
            _tableDefinition = new TableDefinition({ 
                entity, 
                dbId, 
                container: tv,
                resolvedSchema: entity.schema || 'public',
                dbType: (entity.source === 'remote' || entity.database === 'remote') ? 'remote' : 'local'
            });
            await _tableDefinition.render();
            console.log('[TableGridEditor] Definition view rendered successfully');

        } else if (view === 'schema') {
            try {
                let colInfo = [];
                const isRemote = entity.source === 'remote' || entity.database === 'remote';

                if (isRemote) {
                    // REMOTE-DB: Nutze dbDescribe mit Schema
                    console.log('[TableGridEditor] Schema-View: Lade von Remote-DB');
                    colInfo = await window.api.dbDescribe(entity.name, 'remote');
                } else {
                    // PGlite: Nutze pgDescribe
                    console.log('[TableGridEditor] Schema-View: Lade von PGlite');
                    const pgId = state.pgId;
                    if (!pgId) throw new Error('Keine PGlite-Datenbank aktiv.');
                    colInfo = await window.api.pgDescribe(pgId, entity.name);
                }

                const cols = colInfo.map(c => ({
                    name:    c.column_name,
                    type:    c.column_type ?? c.data_type ?? 'text',
                    notnull: c.null === 'NO' || c.is_nullable === 'NO',
                    default: c.column_default ?? c.default ?? null,
                    pk:      false
                }));
                
                console.log('[TableGridEditor] Schema-View: Geladen', cols.length, 'Spalten');
                await renderSchemaGrid(cols);
            } catch (err) {
                console.error('[TableGridEditor] Schema-View Error:', err);
                setStatus(`Schema-Fehler: ${err.message}`, 'error');
            }
        }

        if (typeof window.initActionBar === 'function') {
            setTimeout(() => window.initActionBar(), 0);
        }
    },

    // ── Exposed Dialogs ──────────────────────────────────────────────────

    async deleteColumn(columnName) {
        if (!_currentEntity) return;
        const dbId = _getDbId();
        confirmDeleteColumn({
            columnName,
            tableName: _currentEntity.name,
            schema:    'public',
            dbId,
            onSuccess: () => this.switchView('data'),
        });
    },

    async deleteTable(onDeleted) {
        if (!_currentEntity) return;
        const dbId = _getDbId();
        confirmDeleteTable({
            tableName: _currentEntity.name,
            schema:    'public',
            dbId,
            onSuccess: () => {
                onDeleted?.();
                this.close();
            },
        });
    },

    async deleteRows({ rows, allRowsSelected = false, numRows = 0, filters = [] }) {
        if (!_currentEntity) return;
        const dbId = _getDbId();
        confirmDeleteRows({
            rows,
            allRowsSelected,
            numRows,
            table:   { ..._currentEntity, schema: _currentEntity.schema || 'public' },
            filters,
            dbId,
            onSuccess: () => this.switchView('data'),
        });
    },

    async performCellUpdate(tableName, colName, newValue, rowIndex, tdElement) {
        const rowData   = state.lastData[rowIndex];
        const oldValue  = rowData[colName];
        const isNewNull = newValue.trim().toUpperCase() === 'NULL' || newValue.trim() === '';
        const finalValue = isNewNull ? null : newValue;

        if (String(oldValue === null ? 'NULL' : oldValue) === (isNewNull ? 'NULL' : newValue)) return;

        const pkName = findPrimaryKey(tableName);
        const dbId   = _getDbId();

        try {
            await updateTableRow({
                table: {
                    name:     tableName,
                    schema:   'public',
                    database: null,
                    columns:  state.currentCols.map(c => ({ name: c }))
                },
                configuration: { identifiers: { [pkName]: rowData[pkName] } },
                payload: { [colName]: finalValue }
            });
            state.lastData[rowIndex][colName] = finalValue;
            tdElement.innerHTML = DataFormatter.format(finalValue);
            tdElement.classList.toggle('null', isNewNull);
            setStatus(`Zelle aktualisiert.`, 'success');
        } catch (err) {
            setStatus('Update fehlgeschlagen: ' + (err.message || err), 'error');
            tdElement.innerHTML = DataFormatter.format(oldValue);
        }
    },

    /** Generiert Fake-Daten via data-faker.js */
    async handleFillWithFakeData(tableName, count = 50) {
        if (!tableName) return;
        setStatus(`✨ Generiere ${count} Testdatensätze für "${tableName}"...`, 'info');
        try {
            const dbType = state.dbMode === 'remote' ? 'remote' : 'local';

            // ── Schritt 1: Spalten-Grundinfo ──────────────────────────────────────
            const colInfo = await window.api.dbDescribe(tableName, dbType);

            // ── Schritt 2: Auto-generierte Spalten (nextval / identity / serial) ──
            let autoGenCols = new Set();
            try {
                const r = await window.api.dbQuery(
                    `SELECT column_name FROM information_schema.columns
                     WHERE table_name=$1 AND table_schema='public'
                       AND (column_default LIKE 'nextval(%' OR is_identity='YES'
                            OR data_type IN ('serial','bigserial','smallserial'))`,
                    [tableName], dbType
                );
                (r?.rows || r || []).forEach(row => autoGenCols.add(row.column_name));
            } catch(e) {
                // Fallback: parameter-freie Query
                try {
                    const r2 = await window.api.dbQuery(
                        `SELECT column_name FROM information_schema.columns
                         WHERE table_name='${tableName}' AND table_schema='public'
                           AND (column_default LIKE 'nextval(%' OR is_identity='YES'
                                OR data_type IN ('serial','bigserial','smallserial'))`,
                        null, dbType
                    );
                    (r2?.rows || r2 || []).forEach(row => autoGenCols.add(row.column_name));
                } catch(e2) { console.warn('[FakeData] autoGen query failed:', e2.message); }
            }
            console.log('[FakeData] Auto-gen cols:', [...autoGenCols]);

            // ── Schritt 3: Array-Element-Typen + VARCHAR-Längen ──────────────────
            let arrayElemTypes = {};
            let charMaxLens    = {};
            try {
                const r = await window.api.dbQuery(
                    `SELECT column_name, data_type, udt_name, character_maximum_length
                     FROM information_schema.columns
                     WHERE table_name='${tableName}' AND table_schema='public'`,
                    null, dbType
                );
                const pgTypeMap = {
                    int2:'integer',int4:'integer',int8:'bigint',
                    float4:'float',float8:'double precision',
                    bool:'boolean',text:'text',varchar:'text',bpchar:'text',
                    uuid:'uuid',timestamp:'timestamp',timestamptz:'timestamptz',
                    date:'date',time:'time'
                };
                (r?.rows || r || []).forEach(row => {
                    // Array-Typ
                    if (row.data_type === 'ARRAY') {
                        const base = (row.udt_name || '').replace(/^_/, '');
                        arrayElemTypes[row.column_name] = pgTypeMap[base] || base || 'text';
                    }
                    // VARCHAR-Länge
                    if (row.character_maximum_length) {
                        charMaxLens[row.column_name] = parseInt(row.character_maximum_length);
                    }
                });
            } catch(e) { console.warn('[FakeData] column meta query failed:', e.message); }
            console.log('[FakeData] Array elem types:', arrayElemTypes);
            console.log('[FakeData] Char max lengths:', charMaxLens);

            // ── Schritt 4: Foreign Keys ───────────────────────────────────────────
            let fkMap = {}; // { colName: { fkTable, fkCol } }
            try {
                const r = await window.api.dbQuery(
                    `SELECT kcu.column_name, ccu.table_name AS fk_table, ccu.column_name AS fk_col
                     FROM information_schema.table_constraints tc
                     JOIN information_schema.key_column_usage kcu
                          ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema
                     JOIN information_schema.referential_constraints rc
                          ON rc.constraint_name = tc.constraint_name AND rc.constraint_schema = tc.constraint_schema
                     JOIN information_schema.constraint_column_usage ccu
                          ON ccu.constraint_name = rc.unique_constraint_name AND ccu.table_schema = rc.unique_constraint_schema
                     WHERE tc.constraint_type = 'FOREIGN KEY'
                       AND tc.table_name = '${tableName}' AND tc.table_schema = 'public'`,
                    null, dbType
                );
                (r?.rows || r || []).forEach(row => {
                    fkMap[row.column_name] = { fkTable: row.fk_table, fkCol: row.fk_col };
                });
            } catch(e) { console.warn('[FakeData] FK query failed:', e.message); }
            console.log('[FakeData] FK map:', fkMap);

            // ── Schritt 5: Echte FK-IDs aus Zieltabellen laden ────────────────────
            let fkValues = {}; // { colName: [1,2,3,...] }
            for (const [col, fk] of Object.entries(fkMap)) {
                try {
                    const r = await window.api.dbQuery(
                        `SELECT "${fk.fkCol}" FROM "${fk.fkTable}" LIMIT 300`,
                        null, dbType
                    );
                    const ids = (r?.rows || r || []).map(row => row[fk.fkCol]).filter(v => v != null);
                    if (ids.length > 0) {
                        fkValues[col] = ids;
                        console.log(`[FakeData] FK "${col}" -> ${fk.fkTable}: ${ids.length} IDs`);
                    } else {
                        console.warn(`[FakeData] FK "${col}" -> ${fk.fkTable}: LEER - ueberspringe Spalte`);
                    }
                } catch(e) { console.warn(`[FakeData] FK-IDs fuer "${col}":`, e.message); }
            }

            // ── Schritt 6: Check-Constraints ──────────────────────────────────────
            let checkValues = {}; // { colName: ['val1','val2',...] }
            try {
                const r = await window.api.dbQuery(
                    `SELECT kcu.column_name, cc.check_clause
                     FROM information_schema.check_constraints cc
                     JOIN information_schema.constraint_column_usage kcu
                          ON cc.constraint_name = kcu.constraint_name AND cc.constraint_schema = kcu.constraint_schema
                     WHERE kcu.table_name = '${tableName}' AND kcu.table_schema = 'public'`,
                    null, dbType
                );
                (r?.rows || r || []).forEach(row => {
                    const clause = row.check_clause || '';
                    const anyMatch = [...clause.matchAll(/'([^']+)'::/g)].map(m => m[1]);
                    const inMatch  = [...clause.matchAll(/'([^']+)'/g)].map(m => m[1]);
                    const vals = anyMatch.length > 0 ? anyMatch : inMatch;
                    if (vals.length > 0) {
                        checkValues[row.column_name] = vals;
                        console.log(`[FakeData] Check "${row.column_name}":`, vals);
                    }
                });
            } catch(e) { console.warn('[FakeData] Check query failed:', e.message); }

            // ── Schritt 7: Spalten zusammenbauen ─────────────────────────────────
            const cols = colInfo
                .filter(c => {
                    const name = c.column_name || c.name;
                    const type = (c.column_type || c.data_type || '').toLowerCase();
                    if (autoGenCols.has(name)) return false;
                    if (['serial','bigserial','smallserial'].includes(type)) return false;
                    // FK-Spalte ohne ladbare IDs weglassen (wuerde eh fehlschlagen)
                    if (fkMap[name] && !fkValues[name]) {
                        console.warn(`[FakeData] Ueberspringe FK-Spalte ohne Daten: ${name}`);
                        return false;
                    }
                    return true;
                })
                .map(c => {
                    const name = c.column_name || c.name;
                    return {
                        name,
                        type:          c.column_type || c.data_type || 'text',
                        charMaxLen:    charMaxLens[name]    || null,
                        arrayElemType: arrayElemTypes[name] || null,
                        fkValues:      fkValues[name]       || null,
                        validValues:   checkValues[name]    || null,
                    };
                });

            console.log('[FakeData] Final cols:', cols.map(c => ({
                name: c.name, type: c.type,
                elemType: c.arrayElemType,
                fk: c.fkValues?.length,
                check: c.validValues
            })));

            // ── Schritt 8: SQL generieren (ohne Semikolon!) + ON CONFLICT ─────────
            const rawSQL  = await generateBulkInsertSQL(tableName, cols, count);
            // Semikolon am Ende entfernen, dann ON CONFLICT anhaengen
            const sql = rawSQL.replace(/;\s*$/, '') + ' ON CONFLICT DO NOTHING;'; // FIX #4

            console.log('[FakeData] SQL (first 400):', sql.substring(0, 400));
            await window.api.dbQuery(sql, null, dbType);

            setStatus(`${count} Testdatensätze wurden in "${tableName}" eingefügt.`, 'success');
            await this.switchView(_currentView || 'data');
        } catch (err) {
            console.error('[TableGridEditor] handleFillWithFakeData error:', err);
            setStatus('Fehler beim Generieren der Testdaten: ' + err.message, 'error');
        }
    },

        async insertRow() {
        if (!state.currentTable || !_currentEntity) return false;
        const dbId = _getDbId();
        try {
            await createTableRow({
                table: {
                    name:     state.currentTable,
                    schema:   'public',
                    database: null,
                    columns:  state.currentCols.map(c => ({ name: c }))
                },
                payload: {}
            });
            await this.switchView(_currentView || 'data');
            return true;
        } catch (err) {
            console.error('[TableGridEditor] insertRow Fehler:', err);
            throw err;
        }
    },

    async getCellValueForModal(colName, ri) {
        const pkName = findPrimaryKey(state.currentTable);
        const pkVal  = state.lastData[ri]?.[pkName];
        if (pkVal !== undefined && pkName) {
            const val = await getCellValue({
                table: {
                    name:     state.currentTable,
                    schema:   'public',
                    database: null,
                },
                column:      colName,
                identifiers: { [pkName]: pkVal }
            });
            return { value: val, isNull: val === null };
        }
        const local = state.lastData[ri][colName];
        return { value: local, isNull: local === null };
    },

    getCurrentEntity() { return _currentEntity; },
    getCurrentView()   { return _currentView; },
};

window.TableGridEditor = TableGridEditor;

// ── Interne Hilfsfunktionen ────────────────────────────────────────────────

function _getDbId() {
    // FIX: Immer pgId für PGlite zurückgeben
    return state.pgId || state.activeDbId;
}

function _showTabs(visible) {
    document.querySelectorAll('.result-tab').forEach((tab) => {
        tab.style.display = visible ? '' : 'none';
    });
}

/** Berechnet die aktuelle Zeilenhöhe basierend auf der Schriftgröße */
const getRowHeight = () => (state.editorSettings?.fontSize || 14) + 18;

function _renderDataGrid(data) {
    const tv = document.getElementById('result-table-view');
    if (!tv) return;
    tv.onscroll = null;
    tv.innerHTML = '';

    tv.classList.toggle('magic-eye-active', !!state.magicEyeActive);

    if (!document.getElementById('tge-dynamic-styles')) {
        const style = document.createElement('style');
        style.id = 'tge-dynamic-styles';
        style.textContent = `
            #result-table-view { 
                position: relative; overflow: auto; height: 100%; 
                background: var(--surface);
                scrollbar-gutter: stable;
            }
            #result-table-view table { 
                border-collapse: separate; border-spacing: 0; 
                width: max-content; min-width: 100%;
                table-layout: auto; font-family: var(--font-sans, system-ui, sans-serif);
            }
            #result-table-view thead { 
                position: sticky; top: 0; z-index: 20; 
                background: var(--surface);
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            }
            #result-table-view th { 
                background: var(--surface1); 
                border-bottom: 2px solid var(--border);
                border-right: 1px solid rgba(255,255,255,0.03);
                padding: 0;
                position: relative;
                vertical-align: top;
                height: auto;
            }
            #result-table-view td { 
                font-size: 13px !important;
                height: var(--table-row-height, 38px);
                border-bottom: 1px solid var(--border);
                border-right: 1px solid rgba(255,255,255,0.02);
                padding: 0 24px;
                box-sizing: border-box;
                white-space: nowrap;
                min-width: 120px;
                overflow: hidden;
                text-overflow: ellipsis;
                color: #ffffff;
                transition: background 0.15s ease;
            }
            #result-table-view tr:hover td { background: rgba(255,255,255,0.06) !important; }
            #result-table-view tr:nth-child(even) td { background: rgba(255,255,255,0.015); }
            #result-table-view tr.selected-row td { 
                background: rgba(var(--accent-rgb), 0.25) !important;
                border-left: 3px solid var(--accent);
            }
            #result-table-view tr.selected-row:hover td { background: rgba(var(--accent-rgb), 0.35) !important; }
            @keyframes tableRefreshFade {
                from { opacity: 0.5; transform: translateY(4px); }
                to   { opacity: 1; transform: translateY(0); }
            }
            .table-refresh-anim { animation: tableRefreshFade 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
            .th-inner { display: flex; flex-direction: column; padding: 8px 10px; gap: 4px; }
            .th-label { 
                display: flex; justify-content: space-between; align-items: center; 
                cursor: pointer; font-weight: 600; font-size: 12px; 
                text-transform: uppercase; letter-spacing: 0.5px; color: var(--muted);
                transition: color 0.2s; padding: 2px 0;
            }
            .th-label:hover { color: var(--text); }
            .th-label.sort-active { color: var(--accent); }
            .sort-ico { font-size: 11px; opacity: 0.5; margin-left: 4px; }
            .sort-active .sort-ico { opacity: 1; }
            #result-table-view td:first-child, #result-table-view th:first-child {
                position: sticky; left: 0; z-index: 10; width: 54px; min-width: 54px; 
                text-align: center; border-right: 1px solid var(--border);
                background: var(--surface1);
                color: var(--muted); font-size: 11px; font-weight: 600; padding: 0;
            }
            #result-table-view th:first-child { z-index: 30; border-bottom: 1px solid var(--border); }
            .col-resize-handle { 
                position: absolute; right: 0; top: 0; bottom: 0; width: 4px; 
                cursor: col-resize; z-index: 5; transition: all 0.2s; 
                border-right: 1px solid transparent;
            }
            .col-resize-handle:hover, .col-resize-handle.resizing { background: var(--accent); opacity: 0.4; }
            #result-table-view td.cell-editing { 
                outline: 2px solid var(--accent) !important; outline-offset: -2px;
                background: rgba(var(--accent-rgb), 0.15) !important; cursor: text; z-index: 5;
            }
            #result-table-view tr.selected-row td { background: rgba(194, 154, 64, 0.15) !important; }
            #result-table-view tr.selected-row td:first-child { 
                background: var(--accent) !important; color: var(--surface) !important; font-weight: 800; 
            }
            .schema-table { border-collapse: separate; border-spacing: 0; background: transparent; }
            .schema-table th { 
                background: rgba(255,255,255,0.03); text-transform: uppercase; 
                font-size: 10px; letter-spacing: 1.2px; color: var(--muted); 
                padding: 16px 20px; border-bottom: 1px solid var(--border); 
            }
            .schema-table td { padding: 18px 20px; border-bottom: 1px solid var(--border); }
            .schema-table tr:last-child td { border-bottom: none; }
            .type-badge { 
                font-family: var(--font-mono); font-size: 10px; font-weight: 700; 
                padding: 4px 10px; border-radius: 20px; 
                background: rgba(var(--accent-rgb), 0.1); color: var(--accent);
                border: 1px solid rgba(var(--accent-rgb), 0.2);
            }
            .action-btn-circle { 
                width: 32px; height: 32px; display: inline-flex; align-items: center; justify-content: center; 
                border-radius: 10px; border: 1px solid var(--border); background: var(--surface2); 
                transition: all 0.2s; color: var(--muted);
            }
            .action-btn-circle:hover { background: var(--error); color: white; border-color: var(--error); }

            /* Styles für das "+" Popover-Menü */
            .add-menu-popover {
                position: absolute; top: 100%; right: 0; background: var(--surface2);
                border: 1px solid var(--border); border-radius: 6px; 
                display: none; flex-direction: column; min-width: 140px;
                box-shadow: 0 8px 24px rgba(0,0,0,0.5); z-index: 1000; margin-top: 2px;
                padding: 4px; overflow: hidden; text-align: left;
                backdrop-filter: blur(10px);
            }
            .add-menu-popover.open { display: flex; }
            .add-menu-item { 
                padding: 6px 10px; cursor: pointer; color: var(--text); 
                font-size: 11px; font-weight: 600; display: flex; align-items: center; gap: 8px;
                transition: all 0.15s ease; white-space: nowrap;
                border-radius: 4px;
            }
            .add-menu-item:hover { background: var(--accent); color: #000; }

            /* Styles für die virtuelle "+" Spalte */
            .add-column-header {
                position: relative;
                width: 46px !important;
                min-width: 46px !important;
                text-align: center !important;
                cursor: pointer !important;
                color: var(--accent) !important;
                font-weight: bold !important;
                font-size: 18px !important;
                background: var(--surface1) !important;
                border-bottom: 2px solid var(--border) !important;
                line-height: 38px;
            }
            .add-column-header:hover { background: var(--surface2) !important; color: var(--text) !important; }
            .add-column-cell {
                background: rgba(255,255,255,0.01);
                border-right: none !important;
            }
        `;
        document.head.appendChild(style);
    }

    const cols = state.currentCols;
    if (!cols || !cols.length) {
        tv.innerHTML = '<div class="empty-state">Keine Spalten gefunden.</div>';
        return;
    }

    // FIX: Sicherstellen dass data ein Array von Objekten ist
    // Wenn data[0] kein Objekt ist (z.B. Array von Arrays), abbrechen
    if (data.length > 0 && (typeof data[0] !== 'object' || Array.isArray(data[0]))) {
        console.error('[TableGridEditor] Ungültiges Datenformat:', typeof data[0], data[0]);
        tv.innerHTML = '<div class="empty-state" style="color:var(--error)">⚠️ Ungültiges Datenformat. Bitte Sync erneut ausführen.</div>';
        return;
    }

    const table = document.createElement('table');
    const thead = document.createElement('thead');
    const tbody = document.createElement('tbody');
    table.appendChild(thead);
    table.appendChild(tbody);
    table.classList.add('table-refresh-anim');

    const headRow = document.createElement('tr');
    const thNum = document.createElement('th');
    thNum.style.width = '46px';
    thNum.innerHTML = '';
    headRow.appendChild(thNum);

    cols.forEach((col, ci) => {
        const th = document.createElement('th');
        th.dataset.ci = ci;
        if (colWidths.has(ci)) {
            th.style.width = th.style.minWidth = colWidths.get(ci) + 'px';
        }

        // Hole den echten Typ aus den Metadaten
        const meta = (state.columnMetadata || []).find(m => (m.column_name || m.name) === col);
        const colType = meta ? (meta.column_type || meta.data_type || 'text') : 'text';

        const inner = document.createElement('div');
        inner.className = 'th-inner';

        const active = state.currentSort.col === col;
        const lbl = document.createElement('div');
        lbl.className = `th-label${active ? ' sort-active' : ''}`;
        lbl.innerHTML = `
            <span class="col-nm">
                ${escH(col)}
                <span style="font-size: 9px; opacity: 0.5; margin-left: 6px; font-weight: normal; font-family: var(--font-mono); text-transform: lowercase;">
                    ${escH(colType)}
                </span>
            </span>
            <span class="sort-ico">${active ? (state.currentSort.dir === 'ASC' ? '▲' : '▼') : '↕'}</span>
        `;
        lbl.addEventListener('click', async () => {
            state.currentSort.dir = (state.currentSort.col === col && state.currentSort.dir === 'ASC') ? 'DESC' : 'ASC';
            state.currentSort.col = col;
            const { updateTableQuery } = await import('../executor.js');
            updateTableQuery();
        });

        inner.appendChild(lbl);
        th.appendChild(inner);

        const handle = document.createElement('div');
        handle.className = 'col-resize-handle';
        handle.addEventListener('mousedown', e => {
            e.preventDefault();
            const startX = e.clientX;
            const startWidth = th.offsetWidth;
            const onMove = mv => {
                const newWidth = Math.max(60, startWidth + (mv.clientX - startX));
                th.style.width = th.style.minWidth = newWidth + 'px';
                colWidths.set(ci, newWidth);
            };
            const onUp = () => {
                window.removeEventListener('mousemove', onMove);
                window.removeEventListener('mouseup', onUp);
            };
            window.addEventListener('mousemove', onMove);
            window.addEventListener('mouseup', onUp);
        });
        th.appendChild(handle);
        headRow.appendChild(th);
    });

    // Virtuelle "+" Spalte im Header hinzufügen
    const thAdd = document.createElement('th');
    thAdd.className = 'add-column-header';
    thAdd.textContent = '+';
    thAdd.title = 'Hinzufügen...';

    // Kleines Auswahl-Menü erstellen
    const menu = document.createElement('div');
    menu.className = 'add-menu-popover';
    menu.innerHTML = `
        <div class="add-menu-item" data-action="row">➕ Zeile einfügen</div>
        <div class="add-menu-item" data-action="col">➕ Spalte einfügen</div>
    `;
    thAdd.appendChild(menu);

    thAdd.onclick = (e) => {
        e.stopPropagation();
        const wasOpen = menu.classList.contains('open');
        if (!wasOpen) {
            menu.classList.add('open');
            const closeHandler = () => {
                menu.classList.remove('open');
                document.removeEventListener('click', closeHandler);
            };
            setTimeout(() => document.addEventListener('click', closeHandler), 10);
        }
    };

    menu.addEventListener('click', (e) => {
        const item = e.target.closest('.add-menu-item');
        if (!item) return;
        e.stopPropagation();
        menu.classList.remove('open');
        
        const action = item.dataset.action;
        if (action === 'row' && RowEditorSidebar) {
            RowEditorSidebar.open(state.currentTable, state.currentSchema || 'public');
        } else if (action === 'col' && ColumnEditorSidebar) {
            ColumnEditorSidebar.open(state.currentTable, state.currentSchema || 'public');
        }
    });

    headRow.appendChild(thAdd);

    thead.appendChild(headRow);
    tv.appendChild(table);

    const ranges = {};
    if (state.magicEyeActive && state.magicMode === 'heatmap') {
        cols.forEach(col => {
            const nums = data.map(r => Number(r[col])).filter(n => !isNaN(n));
            if (nums.length) ranges[col] = { min: Math.min(...nums), max: Math.max(...nums) };
        });
    }

    const rowH = getRowHeight();
    let scrollTicking = false;

    const renderRows = async () => {
        scrollTicking  = false;
        dragRafPending = false;

        // Virtual-Scrolling: Berechne welche Zeilen sichtbar sind
        const rowHeight = 38;  // CSS height vom td
        const startIdx = Math.max(0, Math.floor(tv.scrollTop / rowHeight) - 5);
        const endIdx   = Math.min(data.length, Math.ceil((tv.scrollTop + tv.clientHeight) / rowHeight) + 5);

        tbody.innerHTML = '';
        
        // Spacer oben für scrolling offset
        if (startIdx > 0) {
            const spacer = document.createElement('tr');
            spacer.style.height = `${startIdx * rowHeight}px`;
            tbody.appendChild(spacer);
        }

        // Rendere nur sichtbare Zeilen + Buffer
        for (let ri = startIdx; ri < endIdx; ri++) {
            const row = data[ri];
            const tr  = document.createElement('tr');
            if (state.selectedRows.has(ri)) tr.classList.add('selected-row');

            const tdNum = document.createElement('td');
            tdNum.textContent  = ri + 1;
            tdNum.style.cursor = 'pointer';
            tdNum.style.userSelect = 'none';
            tdNum.addEventListener('mousedown', e => {
                if (e.button !== 0) return;
                e.preventDefault();
                if (!e.shiftKey && !e.ctrlKey && !e.metaKey) state.selectedRows.clear();
                isDraggingRows = true;
                dragStartIdx   = ri;
                dragMode       = !state.selectedRows.has(ri);
                if (dragMode) state.selectedRows.add(ri); else state.selectedRows.delete(ri);
                renderRows();
            });
            tdNum.addEventListener('mouseenter', (e) => {
                if (isDraggingRows && e.buttons === 1) {
                    if (dragRafPending) return;
                    dragRafPending = true;
                    if (dragMode) state.selectedRows.add(ri); else state.selectedRows.delete(ri);
                    requestAnimationFrame(renderRows);
                }
            });
            tr.appendChild(tdNum);

            for (const col of cols) {
                const td  = document.createElement('td');
                const val = row[col];

                const isProtected = (state.currentSchema || '').toLowerCase().match(/information_schema|pg_catalog|pg_toast|pg_temp/);
                const isTable = !!_currentEntity && (
                    _currentEntity.entity_type === ENTITY_TYPE.TABLE ||
                    _currentEntity.entity_type === 'BASE TABLE'
                );

                if (state.currentTable && isTable && !isProtected) {
                    td.addEventListener('click', () => {
                        if (td.classList.contains('cell-editing')) return;
                        td.contentEditable = 'true';
                        td.classList.add('cell-editing');
                        td.focus();
                    });
                    td.addEventListener('blur', () => {
                        td.contentEditable = 'false';
                        td.classList.remove('cell-editing');
                        TableGridEditor.performCellUpdate(state.currentTable, col, td.textContent, ri, td);
                    });
                }

                // Doppelklick für das neue Schnell-Edit-Popup
                td.addEventListener('dblclick', (e) => {
                    e.stopPropagation();
                    CellEditorPopup.open(td, ri, col, val);
                });

                // Auch hier den echten Typ für den Formatter nutzen
                const meta = (state.columnMetadata || []).find(m => (m.column_name || m.name) === col);
                const colType = meta ? (meta.column_type || meta.data_type || 'text') : 'text';

                const props = KyntoVisualizer.getCellProps(val, state.magicEyeActive ? state.magicMode : 'type', ranges[col]?.min, ranges[col]?.max);
                
                // Storage-Check: Falls es eine Medien-Referenz ist, HTML von dort holen
                const storageHtml = await StorageCellRenderer.render(val, colType);
                td.innerHTML = storageHtml ?? DataFormatter.formatWithContext(val, colType);

                if (props.className) td.className = props.className;
                if (state.magicEyeActive && props.style) td.style.cssText += props.style;
                tr.appendChild(td);
            }

            // Virtuelle leere Zelle am Ende der Zeile für das Layout
            const tdAdd = document.createElement('td');
            tdAdd.className = 'add-column-cell';
            tr.appendChild(tdAdd);

            tbody.appendChild(tr);
        }

        // Spacer unten für scrolling offset
        if (endIdx < data.length) {
            const spacer = document.createElement('tr');
            spacer.style.height = `${(data.length - endIdx) * rowHeight}px`;
            tbody.appendChild(spacer);
        }

        // Sichtbare Bilder/Medien im Grid finalisieren (Hydrierung)
        StorageCellRenderer.hydrateImages(tv);
    };

    // Kontextmenü auf dem gesamten Container registrieren
    tv.oncontextmenu = (e) => {
        e.preventDefault();
        const td = e.target.closest('td');
        const tr = e.target.closest('tr');
        const ri = tr ? Array.from(tr.parentNode.children).indexOf(tr) : -1;
        const colName = td ? cols[Array.from(td.parentNode.children).indexOf(td) - 1] : null;

        TableContextMenu.show(e, {
            rowIndex: ri >= 0 ? ri : undefined,
            colName: colName,
            cellValue: (ri >= 0 && colName) ? data[ri][colName] : undefined,
            rowData: ri >= 0 ? data[ri] : undefined,
            TableGridEditor: TableGridEditor,
            tableName: state.currentTable
        });
    };

    tv.onscroll = () => {
        if (!scrollTicking) {
            requestAnimationFrame(renderRows);
            scrollTicking = true;
        }
    };
    renderRows();
}

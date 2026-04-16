/* ── TableGridEditor/SelectionToolbar.js ───────────────────────────────────
   Toolbar für Tabellen-Selektion (Löschen, Kopie, Export).
   Wird eingeblendet, sobald Zeilen im Grid markiert sind.
   ────────────────────────────────────────────────────────────────────────── */

import { state } from '../state.js';
import { setStatus, dlBlob, escH, esc } from '../utils.js';
import { confirmDeleteRows } from './DeleteConfirmationDialogs.js';

let toolbarEl = null;

/**
 * Initialisiert die Toolbar (einmalig beim Laden der Ansicht).
 */
export function initSelectionToolbar() {
    if (document.getElementById('selection-toolbar')) return;

    toolbarEl = document.createElement('div');
    toolbarEl.id = 'selection-toolbar';
    toolbarEl.className = 'selection-toolbar';
    
    toolbarEl.innerHTML = `
        <div class="st-info">
            <span id="st-count">0</span> Zeilen ausgewählt
        </div>
        <div class="st-actions">
            <button class="st-btn st-btn-danger" id="st-delete">
                🗑️ <span id="st-delete-label">Löschen</span>
            </button>
            <button class="st-btn" id="st-copy">
                📋 Kopie
            </button>
            <div class="st-export-wrap">
                <button class="st-btn" id="st-export-trigger">
                    📤 Export ▾
                </button>
                <div class="st-export-menu" id="st-export-menu">
                    <div class="st-menu-item" data-fmt="csv">CSV-Datei (.csv)</div>
                    <div class="st-menu-item" data-fmt="json">JSON-Datei (.json)</div>
                    <div class="st-menu-item" data-fmt="sql">SQL-Dump (.sql)</div>
                </div>
            </div>
            <button class="st-btn-close" id="st-close" title="Auswahl aufheben">✕</button>
        </div>
    `;

    document.body.appendChild(toolbarEl);
    _injectStyles();
    _bindEvents();
}

/**
 * Aktualisiert Sichtbarkeit und Zähler der Toolbar basierend auf state.selectedRows.
 */
export function updateToolbar() {
    if (!toolbarEl) initSelectionToolbar();
    
    // Toolbar nur anzeigen, wenn wir wirklich in der Daten-Tabelle sind
    // (Nicht im Dashboard, Chart oder in der SQL-Definition)
    const tv = document.getElementById('result-table-view');
    const isTableActive = tv && tv.classList.contains('active') && !document.querySelector('.kynto-tabledef-wrap');
    
    const count = (isTableActive && state.selectedRows) ? state.selectedRows.size : 0;

    if (count > 0) {
        const countEl = document.getElementById('st-count');
        const labelEl = document.getElementById('st-delete-label');
        if (countEl) countEl.textContent = count;
        if (labelEl) labelEl.textContent = count === 1 ? '1 Zeile löschen' : `${count} Zeilen löschen`;
        toolbarEl.classList.add('visible');
    } else {
        toolbarEl.classList.remove('visible');
    }
    // Selektion-Alle-Icon im Header synchron halten
    window._updateSelectAllIcon?.();
}

function _injectStyles() {
    if (document.getElementById('st-styles')) return;
    const style = document.createElement('style');
    style.id = 'st-styles';
    style.textContent = `
        .selection-toolbar {
            position: fixed; bottom: 48px; left: 50%;
            transform: translateX(-50%) translateY(100px);
            background: #1c1c20; border: 1px solid rgba(255,255,255,0.12);
            border-radius: 14px; padding: 10px 20px;
            display: flex; align-items: center; gap: 20px;
            z-index: 4000; box-shadow: 0 15px 40px rgba(0,0,0,0.6);
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            backdrop-filter: blur(8px);
            opacity: 0;
            visibility: hidden;
            pointer-events: none;
        }
        .selection-toolbar.visible { transform: translateX(-50%) translateY(0); opacity: 1; visibility: visible; pointer-events: auto; }
        .st-info { font-size: 13px; color: #fff; font-weight: 600; border-right: 1px solid rgba(255,255,255,0.1); padding-right: 20px; }
        .st-actions { display: flex; align-items: center; gap: 10px; }
        .st-btn {
            background: #27272c; border: 1px solid rgba(255,255,255,0.08);
            color: #eee; padding: 7px 14px; border-radius: 8px; font-size: 12px;
            cursor: pointer; display: flex; align-items: center; gap: 8px; transition: all 0.2s;
            font-family: inherit;
        }
        .st-btn:hover { background: #333; border-color: var(--accent); color: var(--accent); }
        .st-btn-danger:hover { color: #f87171; border-color: rgba(248,113,113,0.4); background: rgba(248,113,113,0.05); }
        .st-btn-close { background: none; border: none; color: #71717a; cursor: pointer; font-size: 16px; margin-left: 10px; }
        .st-btn-close:hover { color: #fff; }

        .st-export-wrap { position: relative; }
        .st-export-menu {
            position: absolute; bottom: calc(100% + 10px); left: 0;
            background: #1c1c20; border: 1px solid rgba(255,255,255,0.12);
            border-radius: 10px; padding: 6px; display: none; flex-direction: column;
            min-width: 150px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);
            z-index: 4001; backdrop-filter: blur(10px);
        }
        .st-export-menu.open { display: flex; }
        .st-menu-item {
            padding: 8px 12px; cursor: pointer; color: #eee; font-size: 12px;
            border-radius: 6px; transition: background 0.2s;
        }
        .st-menu-item:hover { background: var(--accent); color: #000; }
    `;
    document.head.appendChild(style);
}

function _bindEvents() {
    document.getElementById('st-delete')?.addEventListener('click', _handleDelete);
    document.getElementById('st-copy')?.addEventListener('click', _handleCopy);
    
    // Export Dropdown Logic
    const trigger = document.getElementById('st-export-trigger');
    const menu    = document.getElementById('st-export-menu');

    trigger?.addEventListener('click', (e) => {
        e.stopPropagation();
        menu?.classList.toggle('open');
    });

    document.addEventListener('click', () => menu?.classList.remove('open'));

    menu?.addEventListener('click', (e) => {
        const item = e.target.closest('.st-menu-item');
        if (!item) return;
        _handleExportAction(item.dataset.fmt);
    });

    document.getElementById('st-close')?.addEventListener('click', () => {
        state.selectedRows.clear();
        updateToolbar();
        if (window.TableGridEditor?.renderCurrentData) window.TableGridEditor.renderCurrentData();
    });
}

async function _handleDelete() {
    const selectedRowsData = Array.from(state.selectedRows).map(idx => state.lastData[idx]);
    if (selectedRowsData.length === 0) return;

    // Schema normalisieren: PGlite kennt nur "public", nicht "main"
    const schema = (!state.currentSchema || state.currentSchema === 'main')
        ? 'public'
        : state.currentSchema;

    confirmDeleteRows({
        rows:            selectedRowsData,
        allRowsSelected: false,
        numRows:         state.lastData.length,
        table:           { name: state.currentTable, schema },
        dbId:            state.dbMode === 'remote' && state.remoteConnectionString 
                            ? state.remoteConnectionString 
                            : (state.activeDbId || state.pgId),
        onSuccess: () => {
            state.selectedRows.clear();
            updateToolbar();
            // Grid live neu laden
            window.TableGridEditor?.switchView('data');
        },
    });
}

function _handleCopy() {
    const selectedRowsData = Array.from(state.selectedRows).map(idx => state.lastData[idx]);
    const text = JSON.stringify(selectedRowsData, null, 2);
    navigator.clipboard.writeText(text).then(() => {
        setStatus(`✓ ${state.selectedRows.size} Zeilen in Zwischenablage kopiert`, 'success');
    });
}

async function _handleExportAction(fmt) {
    const selectedRowsData = Array.from(state.selectedRows).map(idx => state.lastData[idx]);
    if (selectedRowsData.length === 0) return;
    const tableName = state.currentTable || 'export';
    
    if (fmt === 'csv') {
        const cols = state.currentCols.length ? state.currentCols : Object.keys(selectedRowsData[0]);
        const csv = [
            cols.map(c => `"${c}"`).join(','),
            ...selectedRowsData.map(r => cols.map(c => {
                const v = r[c];
                if (v === null || v === undefined) return '';
                const s = (typeof v === 'object') ? JSON.stringify(v) : String(v);
                return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
            }).join(','))
        ].join('\n');
        dlBlob(csv, 'text/csv', `${tableName}_export.csv`);
    } 
    else if (fmt === 'json') {
        dlBlob(JSON.stringify(selectedRowsData, null, 2), 'application/json', `${tableName}_export.json`);
    } 
    else if (fmt === 'sql') {
        try {
            // Spalten-Metadaten für CREATE TABLE nutzen falls vorhanden
            const cols = (state.columnMetadata && state.columnMetadata.length > 0)
                ? state.columnMetadata
                : Object.keys(selectedRowsData[0]).map(k => ({ column_name: k, data_type: 'TEXT' }));

            const colDefs = cols.map(c => {
                const name = c.column_name || c.name;
                const type = c.column_type || c.data_type || 'TEXT';
                return `  ${esc(name)} ${type}`;
            }).join(',\n');

            let dump = `-- SQL-Export: ${tableName} (Auswahl)\n-- ${new Date().toISOString()}\n\n`;
            dump += `CREATE TABLE IF NOT EXISTS ${esc(tableName)} (\n${colDefs}\n);\n\n`;
            
            const colNames = cols.map(c => esc(c.column_name || c.name)).join(', ');
            const vals = selectedRowsData.map(row => 
                '(' + cols.map(c => {
                    const colKey = c.column_name || c.name;
                    const v = row[colKey];
                    if (v === null || v === undefined) return 'NULL';
                    if (typeof v === 'number' || typeof v === 'boolean') return String(v);
                    const strVal = (typeof v === 'object') ? JSON.stringify(v) : String(v);
                    return `'${strVal.replace(/'/g, "''")}'`;
                }).join(', ') + ')'
            ).join(',\n');
            
            dump += `INSERT INTO ${esc(tableName)} (${colNames}) VALUES\n${vals};\n`;
            dlBlob(dump, 'text/plain;charset=utf-8', `${tableName}_export.sql`);
        } catch (e) {
            setStatus('Export Fehler: ' + e.message, 'error');
        }
    }
}
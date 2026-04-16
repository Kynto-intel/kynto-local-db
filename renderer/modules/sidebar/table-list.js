/* ── sidebar/table-list.js ─────────────────────────────────────────
   Tabellen-Liste: Rendering und Event-Handling
   
   CHANGES:
   - kynto_knowledge + kynto_chat_history erhalten ein 🧠-Icon und
     einen speziellen Badge in der Sidebar (visuell hervorgehoben).
   - Alle anderen Funktionen bleiben unverändert.
   ──────────────────────────────────────────────────────────────── */

import { state } from '../state.js';
import { esc, escH, setStatus } from '../utils.js';
import { updateAutocomplete } from '../editor.js';
import { confirmDeleteTable } from '../TableGridEditor/index.js';
import {
    TABLE_ORDER_KEY,
    TABLE_BOTTOM_KEY,
    saveTableOrder,
} from './persistence.js';
import { injectColorPickerStyles, showInputModal } from './utils.js';
import { initTableDragAndDrop } from './drag-drop.js';
import { openColorPicker } from './color-picker.js';
import { TableDefinitionEditor } from '../table-definition-editor.js';

// Tabellen-Namen für das System-Verzeichnis
const KY_TABLES = new Set(['kynto_storage_buckets', 'kynto_storage_objects']);

let _quickView = () => {};
let _clearResults = () => {};

export function setTableListCallbacks(qv, cr) {
    _quickView = qv;
    _clearResults = cr;
}

/**
 * Gibt true zurück wenn es sich um eine System-Tabelle handelt (interne Verwaltung).
 * Funktioniert auch bei qualifizierten Namen wie "public.kynto_knowledge".
 */
function isSystemTable(name) {
    if (!name) return false;
    const base = String(name).split('.').pop().toLowerCase();
    return KY_TABLES.has(base);
}

/**
 * Lädt und rendert die Tabellen-Liste
 */
export async function refreshTableList() {
    const tableListEl = document.getElementById('table-list');
    if (!tableListEl) return;
    const selTable = document.getElementById('sel-table');
    const systemTableListEl = document.getElementById('system-table-list');

    // Styles injizieren
    injectColorPickerStyles();
    _injectSystemTableStyles();

    const mode = state.dbMode || 'pglite';
    let allTables = [];

    try {
        if (mode === 'remote') {
            // ── REMOTE MODE ────────────────────────────────────────────
            console.log('[refreshTableList] Remote-Mode: Lade Remote-Tabellen');

            const remoteRawTables = await window.api
                .dbTables?.('remote')
                .catch(err => {
                    console.error('[refreshTableList] Remote dbTables fehler:', err);
                    tableListEl.innerHTML = `<div style="padding:10px;color:var(--error);font-size:12px">⚠️ Remote-Tabellen fehler: ${escH(err.message)}</div>`;
                    return [];
                });

            const remoteTables = (remoteRawTables || []).map(t => {
                const baseName = t.table_name || t.name || '';
                const normalizedType = t.type === 'view' || t.table_type === 'VIEW' ? 'view' : 'table';
                return {
                    ...t,
                    name: baseName,
                    table_name: baseName,
                    type: normalizedType,
                    _source: 'remote',
                };
            });

            const filteredRemoteTables = remoteTables.filter(t => {
                if (!t.table_name) return false;
                if (t.schema_name && ['information_schema', 'pg_catalog', 'pg_toast', 'pg_temp'].includes(t.schema_name)) {
                    return false;
                }
                return true;
            });

            console.log('[refreshTableList] Remote geladen:', filteredRemoteTables.length, 'Tabellen');
            allTables = filteredRemoteTables;
        } else {
            // ── PGLITE MODE ────────────────────────────────────────────
            console.log('[refreshTableList] PGlite-Mode: Lade PGlite-Tabellen');

            if (!state.pgId) {
                console.warn('[refreshTableList] Keine PGlite-DB aktiv');
                const pgList = await window.api.pgListDBs().catch(() => []);
                if (pgList.length > 0) {
                    state.pgId = pgList[0].id;
                    state.activeDbId = pgList[0].id;
                    state.dbMode = 'pglite';
                } else {
                    tableListEl.innerHTML = '<div class="empty-list">🐘 Keine Datenbank verfügbar.</div>';
                    return;
                }
            }

            const pgContextId = state.pgId;
            const pgRawTables = await window.api.pgTables(pgContextId).catch(err => {
                console.error('[refreshTableList] PGlite Fehler:', err);
                return [];
            });

            const pgColumns = await window.api.pgColumns(pgContextId).catch(() => []);
            state.knownColumns = {};
            pgColumns.forEach(r => {
                if (!state.knownColumns[r.table_name]) state.knownColumns[r.table_name] = [];
                state.knownColumns[r.table_name].push(r.column_name);
            });

            const pgTables = pgRawTables.map(t => {
                const baseName = t.table_name || t.name || '';
                const isExternal = t.database_name && !['main', 'memory'].includes(t.database_name);
                const fullName = isExternal ? `${t.database_name}.${t.schema_name}.${baseName}` : baseName;
                const rawType = t.type || t.table_type || '';
                const normalizedType = rawType === 'view' || rawType === 'VIEW' || rawType === 'MATERIALIZED VIEW' ? 'view' : 'table';
                return {
                    ...t,
                    name: fullName,
                    table_name: baseName,
                    type: normalizedType,
                    _source: 'pglite',
                };
            });

            const filteredPGTables = pgTables.filter(t => {
                if (!t.table_name && !t.name) return false;
                if (t.schema_name && ['information_schema', 'pg_catalog', 'pg_toast', 'pg_temp'].includes(t.schema_name)) {
                    return false;
                }
                if (!t.database_name || t.database_name === 'main') return true;
                if (t.database_name === 'postgres_server' && t.schema_name === 'public') return true;
                return false;
            });

            console.log('[refreshTableList] PGlite geladen:', filteredPGTables.length, 'Tabellen');
            allTables = filteredPGTables;
        }

        // ── Gemeinsame Renderlogik ─────────────────────────────────
        let tables = allTables.map(t => t);

        console.log('[refreshTableList] Total geladen:', tables.length, 'Tabellen');

        state.knownTables = tables.map(t => t.name).filter(Boolean);
        updateAutocomplete();

        const contextId  = mode === 'remote' ? 'remote-context' : state.pgId;
        const order      = state.tableOrder?.[contextId];
        const bottomOrder = state.tableBottomOrder?.[contextId] || [];

        // ── Gruppierung: User vs. System ───────────────────────────
        const standardTables = tables.filter(t => !isSystemTable(t.name));
        const systemTables   = tables.filter(t => isSystemTable(t.name));

        // Sortierung nur für User-Tabellen
        if (order && Array.isArray(order)) {
            standardTables.sort((a, b) => {
                const isAInBottom = bottomOrder.includes(a.name);
                const isBInBottom = bottomOrder.includes(b.name);
                if (isAInBottom !== isBInBottom) return isAInBottom ? 1 : -1;
                const currentList = isAInBottom ? bottomOrder : order;
                const orderMap = {};
                currentList.forEach((name, i) => { orderMap[name] = i; });
                const idxA = orderMap.hasOwnProperty(a.name) ? orderMap[a.name] : 10000;
                const idxB = orderMap.hasOwnProperty(b.name) ? orderMap[b.name] : 10000;
                if (idxA !== idxB) return idxA - idxB;
                return a.name.localeCompare(b.name);
            });
        }
        systemTables.sort((a, b) => a.name.localeCompare(b.name));

        // Helfer für Tabellen-Rendering
        const renderTableItem = (t) => {
                      const sqlPath    = t.name;
                      const safeName   = typeof t.name === 'string' ? t.name : String(t.name || '');
                      const displayLabel = t.table_name || (safeName ? safeName.split('.').pop() : '(unbekannt)');
                      const isSystem   = isSystemTable(safeName);

                      // ── Icon-Logik ────────────────────────────────────────────
                      let sourceIcon;
                      if (isSystem) {
                          // Zahnrad-Icon für System-Tabellen
                          sourceIcon = `<span class="kynto-system-icon" title="System-Tabelle">⚙️</span>`;
                      } else if (t._source === 'remote') {
                          sourceIcon = '🔗 ';
                      } else {
                          sourceIcon = `<img src="../image/Vorlage.png" style="width:14px;height:14px;vertical-align:middle;margin-right:4px;object-fit:contain">`;
                      }

                      const sourceHint  = t._source === 'remote' ? ' (Remote)' : '';
                      const systemBadge = isSystem
                          ? `<span class="kynto-system-badge" title="System-Tabelle">SYS</span>`
                          : '';

                      const isActive = state.currentTable === sqlPath;
                      const isBottom = bottomOrder.includes(t.name);

                      const extraClass  = isSystem ? ' kynto-system-table' : '';
                      const borderStyle = state.tableColors[t.name]
                          ? `border-left: 3px solid ${state.tableColors[t.name]}`
                          : isSystem
                              ? 'border-left: 3px solid rgba(194,154,64,0.5)'
                              : '';

                      return `
                <div class="table-item${extraClass} ${isBottom ? 'is-bottom' : ''} ${isActive ? 'active' : ''}" draggable="true"
                     data-name="${escH(sqlPath)}" data-type="${t.type}" data-schema="${escH(t.schema_name)}" data-database="${escH(t.database_name)}" data-source="${t._source}"
                     style="${borderStyle}">
                    <span class="table-name">
                        ${sourceIcon} ${escH(displayLabel)}${systemBadge}<small style="opacity:0.6;font-size:0.8em">${sourceHint}</small>
                    </span>
                    <div class="sb-dropdown">
                        <button class="sb-dropdown-trigger" title="Optionen">⋮</button>
                        <div class="sb-dropdown-content">
                            <div class="sb-dropdown-item action-btn" data-a="copy-name" data-n="${escH(t.name)}">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                                Name kopieren
                            </div>
                            <div class="sb-dropdown-item action-btn" data-a="copy-schema" data-n="${escH(t.name)}">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
                                Schema kopieren
                            </div>
                            <div class="sb-dropdown-sep"></div>
                            <div class="sb-dropdown-item action-btn" data-a="edit-table" data-n="${escH(t.name)}">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                                Tabelle bearbeiten
                            </div>
                            <div class="sb-dropdown-item action-btn" data-a="duplicate" data-n="${escH(t.name)}">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>
                                Duplizieren
                            </div>
                            <div class="sb-dropdown-item action-btn" data-a="policies" data-n="${escH(t.name)}">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                                Richtlinien
                            </div>
                            <div class="sb-dropdown-item has-submenu">
                                <div style="display:flex; align-items:center; gap:10px; width:100%;">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                                    <span>Exportieren</span>
                                </div>
                                <div class="sb-submenu">
                                    <div class="sb-dropdown-item action-btn" data-a="export-csv" data-n="${escH(t.name)}">Tabelle als CSV Exportieren</div>
                                    <div class="sb-dropdown-item action-btn" data-a="export-sql" data-n="${escH(t.name)}">Tabelle als SQL Exportieren</div>
                                </div>
                            </div>
                            <div class="sb-dropdown-sep"></div>
                            <div class="sb-dropdown-item action-btn" data-a="color" data-n="${escH(t.name)}">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r=".5"></circle><circle cx="17.5" cy="10.5" r=".5"></circle><circle cx="8.5" cy="7.5" r=".5"></circle><circle cx="6.5" cy="12.5" r=".5"></circle><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.688-1.688h1.906c3.08 0 5.626-2.546 5.626-5.626 0-4.922-4.477-8.75-10-8.75z"></path></svg>
                                Farbe wählen
                            </div>
                            <div class="sb-dropdown-item action-btn" data-a="rename" data-n="${escH(t.name)}">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                Umbenennen
                            </div>
                            <div class="sb-dropdown-item action-btn delete" data-a="drop" data-n="${escH(t.name)}">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                                Löschen
                            </div>
                        </div>
                    </div> 
                </div>`;
        };

        // HTML Zusammenbau
        const standardHtml = standardTables.map(renderTableItem).join('');
        tableListEl.innerHTML = standardHtml || '<div class="empty-list">Keine Tabellen.</div>';

        if (systemTableListEl) {
            const systemHtml = systemTables.map(renderTableItem).join('');
            systemTableListEl.innerHTML = systemHtml || '<div class="empty-list">Keine Store.</div>';
        }

        // Event-Delegation Handler
        const handleTableListClick = e => {
            const actionBtn = e.target.closest('.action-btn');
            if (actionBtn) {
                e.stopPropagation();
                const { a, n } = actionBtn.dataset;
                if (a === 'rename')      openRenameTableModal(n);
                if (a === 'color')       openColorPicker(e, n, () => refreshTableList());
                if (a === 'drop')        dropTable(n);
                if (a === 'copy-name')   { navigator.clipboard.writeText(n); setStatus('Tabellenname kopiert', 'success'); }
                if (a === 'copy-schema') copyTableSchema(n);
                if (a === 'edit-table')  { TableDefinitionEditor.open(n); }
                if (a === 'duplicate')   duplicateTable(n);
                if (a === 'policies')    { window.openTableInEditor(n); setTimeout(() => window.showView('rls-policies'), 50); }
                if (a === 'export-csv')  { window.openTableInEditor(n); setTimeout(() => document.getElementById('btn-export-csv')?.click(), 50); }
                if (a === 'export-sql')  { window.openTableInEditor(n); setTimeout(() => document.getElementById('btn-export-sql')?.click(), 50); }
                return;
            }

            const item = e.target.closest('.table-item');
            if (!item) return;

            const name   = item.dataset.name;
            const type   = item.dataset.type || 'table';
            const source = item.dataset.source || 'pglite';

            tableListEl.querySelectorAll('.table-item').forEach(el => el.classList.remove('active'));
            item.classList.add('active');

            if (typeof window.openTableInEditor === 'function') {
                window.openTableInEditor(name, null, type, source);
            } else {
                _quickView(name);
            }
        };

        tableListEl.removeEventListener('click', tableListEl.__tableListClickHandler);
        tableListEl.__tableListClickHandler = handleTableListClick;
        tableListEl.addEventListener('click', handleTableListClick);

        if (systemTableListEl) {
            systemTableListEl.removeEventListener('click', systemTableListEl.__tableListClickHandler);
            systemTableListEl.__tableListClickHandler = handleTableListClick;
            systemTableListEl.addEventListener('click', handleTableListClick);
        }

        // ── Dropdown Management: Click-basiert statt Hover ──
        const closeAllDropdowns = () => {
            tableListEl.querySelectorAll('.sb-dropdown-content').forEach(content => {
                content.style.display = 'none';
            });
        };

        tableListEl.querySelectorAll('.sb-dropdown-trigger').forEach(trigger => {
            trigger.removeEventListener('click', trigger.__dropdownToggleHandler);
            trigger.__dropdownToggleHandler = (e) => {
                e.stopPropagation();
                const dropdown = trigger.closest('.sb-dropdown');
                if (!dropdown) return;
                const content = dropdown.querySelector('.sb-dropdown-content');
                if (!content) return;

                const isVisible = content.style.display !== 'none';
                closeAllDropdowns();
                
                if (!isVisible) {
                    content.style.display = 'block';
                    
                    setTimeout(() => {
                        const triggerRect  = trigger.getBoundingClientRect();
                        const contentRect  = content.getBoundingClientRect();
                        
                        let left = triggerRect.right + 8;
                        let top  = triggerRect.top;
                        
                        if (left + contentRect.width > window.innerWidth) {
                            left = triggerRect.left - contentRect.width - 8;
                        }
                        
                        if (top + contentRect.height > window.innerHeight) {
                            top = Math.max(0, window.innerHeight - contentRect.height - 8);
                        }
                        
                        content.style.left = left + 'px';
                        content.style.top  = top  + 'px';
                    }, 0);
                }
            };
            trigger.addEventListener('click', trigger.__dropdownToggleHandler);
        });

        tableListEl.querySelectorAll('.sb-dropdown-item').forEach(item => {
            if (!item.__dropdownItemHandler) {
                item.__dropdownItemHandler = () => {
                    closeAllDropdowns();
                };
                item.addEventListener('click', item.__dropdownItemHandler);
            }
        });

        if (!document.__dropdownOutsideHandler) {
            document.__dropdownOutsideHandler = (e) => {
                const dropdown = e.target.closest('.sb-dropdown');
                if (!dropdown) {
                    closeAllDropdowns();
                }
            };
            document.addEventListener('click', document.__dropdownOutsideHandler);
        }

        initTableDragAndDrop(tableListEl);

        if (selTable) {
            selTable.innerHTML = '<option value="">Tabelle…</option>' + tables.map(t => `<option value="${escH(t.name)}">${escH(t.name)}</option>`).join('');
            if (state.currentTable) selTable.value = state.currentTable;
        }
    } catch (e) {
        console.error('refreshTableList:', e);
        tableListEl.innerHTML = `<div style="padding:10px;color:var(--error);font-size:12px">⚠️ ${escH(String(e.message ?? e))}</div>`;
    }
}

// ── CSS für KI-Gedächtnis-Tabellen einmalig injizieren ─────────────────

function _injectSystemTableStyles() {
    if (document.getElementById('kynto-system-table-styles')) return;
    const style = document.createElement('style');
    style.id = 'kynto-system-table-styles';
    style.textContent = `
        /* Store erhalten ein leicht goldenes Highlight */
        .table-item.kynto-system-table {
            background: rgba(194, 154, 64, 0.04);
        }
        .table-item.kynto-system-table:hover {
            background: rgba(194, 154, 64, 0.09);
        }
        .table-item.kynto-system-table.active {
            background: rgba(194, 154, 64, 0.14);
        }

        /* System-Icon */
        .kynto-system-icon {
            font-size: 13px;
            margin-right: 4px;
            vertical-align: middle;
            filter: drop-shadow(0 0 4px rgba(194,154,64,0.4));
        }

        /* System-Badge (inline hinter dem Tabellennamen) */
        .kynto-system-badge {
            display: inline-flex;
            align-items: center;
            margin-left: 5px;
            padding: 1px 5px;
            font-size: 9px;
            font-weight: 700;
            letter-spacing: 0.05em;
            color: var(--accent, #c29a40);
            background: rgba(194, 154, 64, 0.12);
            border: 1px solid rgba(194, 154, 64, 0.25);
            border-radius: 4px;
            vertical-align: middle;
            line-height: 1.6;
        }
    `;
    document.head.appendChild(style);
}

// ── Tabellen-Aktionen ──────────────────────────────────────────────

export async function dropTable(name) {
    confirmDeleteTable({
        tableName: name,
        schema: state.currentSchema || 'public',
        dbId: state.activeDbId || state.pgId,
        onSuccess: async () => {
            if (state.currentTable === name) {
                state.currentTable = null;
                state.currentCols = [];
                if (typeof window.clearResults === 'function') {
                    window.clearResults();
                } else {
                    _clearResults();
                }
            }
            await refreshTableList();
        },
    });
}

/**
 * Öffnet einen einfachen Dialog zum Umbenennen der Tabelle
 */
export async function openRenameTableModal(oldName) {
    const newName = await showInputModal(`Tabelle "${oldName}" umbenennen in:`, oldName);
    if (!newName || newName === oldName) return;

    try {
        const sql  = `ALTER TABLE "${oldName}" RENAME TO "${newName}";`;
        const mode = state.dbMode || 'pglite';
        const dbId = mode === 'pglite' ? state.pgId : state.activeDbId;

        if (mode === 'pglite') {
            await window.api.pgQuery(sql, dbId);
        } else {
            await window.api.dbQuery(sql, dbId, 'remote');
        }

        if (state.currentTable === oldName) state.currentTable = newName;

        setStatus(`Tabelle in "${newName}" umbenannt.`, 'success');
        await refreshTableList();
    } catch (err) {
        console.error('Rename table error:', err);
        setStatus('Fehler beim Umbenennen: ' + err.message, 'error');
    }
}

export function initRenameModal() {
    console.log('[sidebar] initRenameModal - TODO');
}

/**
 * Kopiert das CREATE TABLE Schema in die Zwischenablage
 */
async function copyTableSchema(name) {
    try {
        const mode = state.dbMode || 'pglite';
        const dbId = mode === 'pglite' ? state.pgId : state.activeDbId;

        const cols = mode === 'pglite'
            ? await window.api.pgDescribe(dbId, name)
            : await window.api.dbDescribe(name, dbId, 'remote');

        if (!cols || cols.length === 0) {
            setStatus('Schema konnte nicht geladen werden.', 'error');
            return;
        }

        const colDefs = cols.map(c => {
            const colName  = c.column_name || c.name;
            const colType  = c.column_type || c.type || 'TEXT';
            const isNullable = (c.null === 'YES' || c.nullable === true) ? '' : ' NOT NULL';
            return `  "${colName}" ${colType}${isNullable}`;
        }).join(',\n');

        const sql = `CREATE TABLE "${name}" (\n${colDefs}\n);`;

        await navigator.clipboard.writeText(sql);
        setStatus('Tabellenschema in Zwischenablage kopiert', 'success');
    } catch (err) {
        console.error('Copy schema error:', err);
        setStatus('Fehler beim Kopieren des Schemas', 'error');
    }
}

/**
 * Dupliziert eine Tabelle (Struktur + Daten)
 */
async function duplicateTable(name) {
    const baseName      = name.split('.').pop();
    const defaultNewName = `duplicate-${baseName}`;
    
    const newName = await showInputModal(`Neuer Name für die Kopie von "${name}":`, defaultNewName);
    if (!newName || newName === name) return;

    try {
        const sourceTable = name.split('.').map(part => `"${part}"`).join('.');
        const sql  = `CREATE TABLE "${newName}" AS SELECT * FROM ${sourceTable};`;
        const mode = state.dbMode || 'pglite';
        const dbId = mode === 'pglite' ? state.pgId : state.activeDbId;

        if (mode === 'pglite') {
            await window.api.pgQuery(sql, dbId);
        } else {
            await window.api.dbQuery(sql, dbId, 'remote');
        }

        setStatus(`Tabelle "${newName}" erstellt.`, 'success');
        await refreshTableList();
    } catch (err) {
        console.error('Duplicate table error:', err);
        setStatus('Fehler beim Duplizieren: ' + err.message, 'error');
    }
}
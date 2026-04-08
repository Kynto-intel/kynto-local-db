/* ── modules/sidebar.js ───────────────────────────────────────────────
   DB-Panel: DuckDB (Säule A) + PGlite (Säule B) in der Liste.
   Remote (Säule C) persistent via localStorage.
   DB-Umbenennen: Anzeigename via localStorage (echte Datei bleibt unberührt).
   ensurePostgresServerAttached: Stellt sicher, dass Remote-Postgres in DuckDB gemountet ist.
   ──────────────────────────────────────────────────────────────────── */

import { state }                from './state.js';
import { esc, escH, setStatus } from './utils.js';
import { updateAutocomplete }   from './editor.js';

// ── TableGridEditor: echter Lösch-Dialog für Tabellen ─────────────────────
import { confirmDeleteTable } from './TableGridEditor/index.js'; // The original import for confirmDeleteTable
// The duplicate import of setStatus has been removed.

// ── Tables (Tabellenstruktur-Verwaltung) ────────────────────────────────────
import {
    getTables,
    getPrimaryKeys,
} from './tables/index.js';

// ── Table Editor (Metadaten & Utilities) ─────────────────────────────────────
import {
    // keine Utilities nötig hier
} from './table-editor/index.js';

// ── Spreadsheet Import / Export (React Component) ───────────────────────────────
// Wird jetzt via window.ImportDialogManager bereitgestellt (React-basiert)
// Siehe: renderer/react/import-dialog.jsx und webpack build output

let _quickView    = () => {};
let _clearResults = () => {};
export function setSidebarCallbacks(qv, cr) { _quickView = qv; _clearResults = cr; }

// Hinweis: Import-Funktionen werden jetzt von React verwaltet

// Abwärtskompatibilität
export function setPGliteCallback() {}
export function setRemoteCallback()  {}

// ── Persistenz ─────────────────────────────────────────────────────────

const REMOTE_KEY    = 'sidebar_remote_connection';
const DB_NAMES_KEY  = 'sidebar_db_display_names';  // { [id]: customName }
const TABLE_COLORS_KEY = 'sidebar_table_colors'; // { [tableName]: color }
const TABLE_ORDER_KEY = 'sidebar_table_order';  // { [dbId]: [tableName, ...] }
const TABLE_BOTTOM_KEY = 'sidebar_table_bottom_order';

const PRESET_COLORS = [
    '#ef4444', '#f97316', '#f59e0b', '#10b981', 
    '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899'
];

state.tableColors = JSON.parse(localStorage.getItem(TABLE_COLORS_KEY) || '{}');
state.tableOrder  = JSON.parse(localStorage.getItem(TABLE_ORDER_KEY) || '{}');
state.tableBottomOrder = JSON.parse(localStorage.getItem(TABLE_BOTTOM_KEY) || '{}');

function saveRemoteConnection(cs) {
    try {
        if (cs) localStorage.setItem(REMOTE_KEY, cs);
        else    localStorage.removeItem(REMOTE_KEY);
    } catch (e) { console.warn('Remote speichern fehlgeschlagen:', e); }
}

function loadRemoteConnection() {
    try { return localStorage.getItem(REMOTE_KEY) || null; }
    catch (e) { return null; }
}

function loadDBNames() {
    try { return JSON.parse(localStorage.getItem(DB_NAMES_KEY) || '{}'); }
    catch (e) { return {}; }
}

function saveDBName(id, name) {
    try {
        const names = loadDBNames();
        if (name) names[id] = name;
        else       delete names[id];
        localStorage.setItem(DB_NAMES_KEY, JSON.stringify(names));
    } catch (e) { console.warn('DB-Name speichern fehlgeschlagen:', e); }
}

function getDisplayName(id, fallback, dbNames) {
    return dbNames[id] || fallback;
}

function saveTableColor(name, color) {
    state.tableColors[name] = color;
    localStorage.setItem(TABLE_COLORS_KEY, JSON.stringify(state.tableColors));
    refreshTableList();
}

function saveTableOrder() {
    const contextId = state.dbMode === 'remote' ? state.remoteConnectionString : (state.dbMode === 'pglite' ? state.pgId : state.activeDbId);
    if (!contextId) return;

    const listEl = document.getElementById('table-list');
    const topItems = Array.from(listEl.querySelectorAll('.table-item:not(.is-bottom)')).map(el => el.dataset.name);
    const bottomItems = Array.from(listEl.querySelectorAll('.table-item.is-bottom')).map(el => el.dataset.name);

    state.tableOrder[contextId] = topItems;
    state.tableBottomOrder[contextId] = bottomItems;

    localStorage.setItem(TABLE_ORDER_KEY, JSON.stringify(state.tableOrder));
    localStorage.setItem(TABLE_BOTTOM_KEY, JSON.stringify(state.tableBottomOrder));
}

// ── Timeout-Wrapper ────────────────────────────────────────────────────
// Wirft nach `ms` Millisekunden einen Fehler falls das Promise nicht antwortet.
function withTimeout(promise, ms, label = 'Operation') {
    let timer;
    const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label}: Timeout nach ${ms / 1000}s`)), ms);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// Remote-Lade-Spinner mit Abbrechen-Button
let _remoteAbortController = null;

function showRemoteLoading(tableListEl, onCancel) {
    if (_remoteAbortController) _remoteAbortController.abort();
    _remoteAbortController = { aborted: false, abort() { this.aborted = true; } };

    tableListEl.innerHTML = `
        <div style="padding:14px 10px;display:flex;flex-direction:column;gap:10px">
            <div style="display:flex;align-items:center;gap:8px;color:var(--muted);font-size:12px">
                <span style="display:inline-block;width:12px;height:12px;border:2px solid var(--accent);
                      border-top-color:transparent;border-radius:50%;
                      animation:_sb_spin .7s linear infinite;flex-shrink:0"></span>
                Verbinde mit Remote…
            </div>
            <button id="btn-remote-cancel" style="background:none;border:1px solid var(--border);
                    color:var(--muted);font-size:11px;padding:4px 10px;border-radius:5px;
                    cursor:pointer;transition:color .15s,border-color .15s">
                ✕ Abbrechen
            </button>
        </div>
        <style>@keyframes _sb_spin{to{transform:rotate(360deg)}}</style>`;

    const btn = document.getElementById('btn-remote-cancel');
    if (btn) btn.addEventListener('click', () => {
        _remoteAbortController.abort();
        onCancel();
    });

    return _remoteAbortController;
}

// State beim App-Start wiederherstellen
export function restoreRemoteState() {
    const saved = loadRemoteConnection();
    if (saved && !state.remoteConnectionString) {
        state.remoteConnectionString = saved;
    }
}

// ── Hilfsfunktion: Tabellenname normalisieren ──────────────────────────
// FIX: duckdb_tables() liefert 'table_name', PGlite liefert 'name' - beide abdecken
function tableName(t) {
    return t.table_name ?? t.name ?? t.Name ?? '';
}

// ── DB Panel ───────────────────────────────────────────────────────────

export async function refreshDBList() {
    const dbListEl = document.getElementById('db-list');
    if (!dbListEl) return;

    // FIX: Sidebar-Layout stabilisieren (Flexbox-Management)
    // Dies stellt sicher, dass Favoriten und Verlauf nicht nach unten wegspringen.
    if (!document.getElementById('sidebar-layout-fix')) {
        const style = document.createElement('style');
        style.id = 'sidebar-layout-fix';
        style.textContent = `
            #sidebar {
                display: flex !important;
                flex-direction: column !important;
                height: 100% !important;
                overflow: hidden !important;
            }
            /* Datenbank-Sektion: feste Höhe oben, nie weggedrückt */
            #db-section {
                flex: 0 0 auto !important; /* Verhindert das Schrumpfen oder Wachsen */
                min-height: 36px !important;
                max-height: 220px !important;
                display: flex !important;
                flex-direction: column !important;
                overflow: hidden !important;
            }
            #db-list {
                flex: 1 1 auto !important;
                overflow-y: auto !important;
                scrollbar-width: thin;
                scrollbar-color: rgba(255,255,255,0.1) transparent;
            }
            #db-list::-webkit-scrollbar { width: 4px; }
            #db-list::-webkit-scrollbar-track { background: transparent; }
            #db-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 10px; }
            /* Tabellen-Sektion: nimmt den verbleibenden Platz, scrollt intern */
            #sidebar .sb-section.grow {
                flex: 1 1 0 !important; /* Nimmt den restlichen Platz ein */
                min-height: 100px !important; /* Garantiert, dass die Tabellen sichtbar bleiben */
                overflow: hidden !important;
                display: flex !important;
                flex-direction: column !important;
                border-top: 1px solid var(--border);
            }
            #table-list {
                flex: 1 1 0 !important;
                min-height: 0 !important;
                max-height: none !important;
                overflow-y: auto !important;
                display: flex;
                flex-direction: column;
                padding-bottom: 20px;
                scrollbar-width: thin;
                scrollbar-color: rgba(255,255,255,0.1) transparent;
            }
            #table-list::-webkit-scrollbar { width: 4px; }
            #table-list::-webkit-scrollbar-track { background: transparent; }
            #table-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
            #table-list::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
            /* Favoriten + Verlauf: feste Höhe, nie wachsend */
            #sidebar .sb-section.grow-half {
                flex: 0 0 auto !important;
                min-height: 0 !important;
                max-height: 150px !important;
                display: flex !important;
                flex-direction: column !important;
                overflow: hidden !important;
            }
            #sidebar .sb-section.grow-half .sb-scroll {
                overflow-y: auto !important;
                max-height: 110px !important;
            }
            /* Import-Area: immer am Boden */
            #sidebar .import-area {
                flex-shrink: 0 !important;
            }
        `;
        document.head.appendChild(style);
    }

    // Styles für den Farbwähler injizieren
    if (!document.getElementById('sidebar-color-picker-styles')) {
        const style = document.createElement('style');
        style.id = 'sidebar-color-picker-styles';
        style.textContent = `
            .color-picker-popup {
                position: fixed; background: var(--surface2); border: 1px solid var(--border);
                border-radius: 8px; padding: 8px; display: grid; grid-template-columns: repeat(4, 1fr);
                gap: 6px; z-index: 5000; box-shadow: 0 10px 25px rgba(0,0,0,0.5);
            }
            .color-swatch {
                width: 20px; height: 20px; border-radius: 4px; cursor: pointer; border: 1px solid rgba(255,255,255,0.1);
                transition: transform 0.1s;
            }
            .color-swatch:hover { transform: scale(1.2); }
            .color-swatch.clear { 
                grid-column: span 4; width: 100%; height: auto; font-size: 10px; 
                text-align: center; color: var(--muted); padding: 4px 0;
            }
            .table-item.dragging { opacity: 0.4; border: 1px dashed var(--accent); }
            .table-item.drag-over { border-top: 2px solid var(--accent); }
            .table-item {
                cursor: grab;
            }
        `;
        document.head.appendChild(style);
    }

    if (!state.remoteConnectionString) {
        const saved = loadRemoteConnection();
        if (saved) state.remoteConnectionString = saved;
    }

    // PGlite
    const pglites = await window.api.pgListDBs().catch(err => {
        console.error('pgListDBs fehlgeschlagen:', err); return [];
    });

    // ── PGlite ist Standard ─────────────────────────────────────────────
    // Wenn keine PGlite-DB aktiv ist, aber Datenbanken existieren:
    if (!state.pgId && pglites.length) { 
        state.pgId = pglites[0].id;
        state.activeDbId = pglites[0].id;
        state.dbMode = 'pglite'; 
        console.log('[sidebar] PGlite als Standard aktiviert:', pglites[0].id);
    }

    const dbNames = loadDBNames();

    // PGlite + Remote als Liste
    const allEntries = [
        ...pglites.map(p => ({ ...p, _type: 'pglite' })),
    ];

    // NEU: Remote-Datenbank hinzufügen wenn verbunden
    const dbStatus = await window.api.dbStatus?.().catch(() => ({ remoteDatabase: null }));
    let hasRemoteDB = false;
    if (dbStatus?.remoteDatabase) {
        hasRemoteDB = true;
        allEntries.push({
            id: 'remote-db',
            name: 'PostgreSQL Server',
            path: state.serverConnectionString || 'Remote Server',
            _type: 'remote',
            isDefault: false
        });
        console.log('[sidebar] Remote-DB in allEntries hinzugefügt');
    }

    if (!allEntries.length) {
        dbListEl.innerHTML = '<div class="empty-list">Keine DB offen.</div>';
        return;
    }

    dbListEl.innerHTML = allEntries.map(d => {
        let isActive = false;
        if      (d._type === 'remote') isActive = state.dbMode === 'remote';
        else if (d._type === 'pglite') isActive = state.dbMode === 'pglite' && state.pgId === d.id;

        const safeId = typeof d.id === 'string' ? d.id : '';

        let dot   = `<span class="db-dot"></span>`;
        let rawLabel = d.name;

        // Anzeigenamen aus localStorage verwenden falls vorhanden
        const displayName = getDisplayName(d.id, d.name || (safeId ? safeId.split(/[/\\]/).pop().replace('.pgdata','') : 'Unbekannt'), dbNames);

        let label = escH(displayName);
        if (d._type === 'pglite') {
            dot   = `<span class="db-dot" style="background:var(--info)"></span>`;
            const fallback = safeId ? safeId.split(/[/\\]/).pop().replace('.pgdata','') : 'Unbekannt';
            label = `🐘 ${escH(getDisplayName(d.id, d.name || fallback, dbNames))}`;
        } else if (d._type === 'remote') {
            dot   = `<span class="db-dot" style="background:var(--success,#4caf50)"></span>`;
            label = `☁️ ${escH(getDisplayName(d.id, d.name, dbNames))}`;
        }

        // Umbenennen-Button (außer Remote zeigt immer den Connection-String-Alias)
        const renameBtn = `<button class="db-rename" data-id="${escH(d.id)}"
                                   data-type="${d._type}"
                                   data-current="${escH(displayName)}"
                                   title="Umbenennen">✏️</button>`;

        // NEU: Wenn Remote-DB vorhanden ist, kann auch PGlite gelöscht werden!
        const canDelete = d._type === 'remote' || !d.isDefault || hasRemoteDB;
        const closeBtn = canDelete
            ? `<button class="db-close" data-id="${escH(d.id)}"
                       data-type="${d._type}"
                       title="${d._type === 'remote' ? 'Trennen' : 'Löschen'}">×</button>`
            : '';

        return `
            <div class="db-item ${isActive ? 'active' : ''}"
                 data-id="${escH(d.id)}" data-type="${d._type}">
                ${dot}
                <span class="db-name" title="${escH(d.path || d.id)}">${label}</span>
                ${renameBtn}
                ${closeBtn}
            </div>`;
    }).join('');

    dbListEl.querySelectorAll('.db-item').forEach(el =>
        el.addEventListener('click', e => {
            if (e.target.classList.contains('db-close'))  return;
            if (e.target.classList.contains('db-rename')) return;
            if      (el.dataset.type === 'pglite') switchToPGlite(el.dataset.id);
            else if (el.dataset.type === 'remote') switchToRemote(el.dataset.id);
            else                                   switchDB(el.dataset.id);
        }));

    dbListEl.querySelectorAll('.db-rename').forEach(el =>
        el.addEventListener('click', e => {
            e.stopPropagation();
            openRenameDBModal(el.dataset.id, el.dataset.current);
        }));

    dbListEl.querySelectorAll('.db-close').forEach(el =>
        el.addEventListener('click', async e => {
            e.stopPropagation();
            if (el.dataset.type === 'remote') {
                state.remoteConnectionString = null;
                saveRemoteConnection(null);
                if (state.dbMode === 'remote') state.dbMode = 'pglite';  // Standard ist jetzt PGlite
                await refreshDBList();
                await refreshTableList();
                try {
                    const { updateRemoteStatus } = await import('./mode-switcher.js');
                    updateRemoteStatus();
                } catch (_) {}
            } else if (el.dataset.type === 'pglite') {
                await window.api.pgCloseDB(el.dataset.id);
                if (state.pgId === el.dataset.id) {
                    state.pgId   = null;
                    state.pgMode = false;
                    // PGlite bleibt der Standard - neu initialisieren
                }
                await refreshDBList();
                await refreshTableList();
            }
        }));
}

// ── Modus-Wechsel ──────────────────────────────────────────────────────

export async function switchDB(id) {
    if (!id) return;
    // Nur PGlite wird jetzt verwendet 
    state.pgId           = id;
    state.dbMode         = 'pglite';
    state.currentTable   = null;
    state.currentCols    = [];
    state.currentSort    = { col: null, dir: 'ASC' };
    state.currentFilters = {};
    await refreshDBList();
    await refreshTableList();
    _clearResults();
}

export async function switchToPGlite(pgId) {
    if (!pgId) return;
    state.pgId           = pgId;
    state.pgMode         = true;
    state.dbMode         = 'pglite';
    state.currentTable   = null;
    state.currentCols    = [];
    state.currentSort    = { col: null, dir: 'ASC' };
    state.currentFilters = {};
    await refreshDBList();
    await refreshTableList();
    _clearResults();
}

export async function switchToRemote(remoteDbId) {
    // remoteDbId ist 'remote-db' (aus der DB-List)
    // Der eigentliche Connection-String ist in state.serverConnectionString
    if (!state.serverConnectionString && !state.remoteConnectionString) {
        console.warn('[switchToRemote] Keine Remote-Verbindung aktiv');
        return;
    }
    
    // Nutze Connection-String von Sync-Center oder State
    const connectionString = state.serverConnectionString || state.remoteConnectionString;
    state.remoteConnectionString = connectionString;
    state.dbMode         = 'remote';
    state.pgMode         = false;
    state.currentTable   = null;
    state.currentCols    = [];
    state.currentSort    = { col: null, dir: 'ASC' };
    state.currentFilters = {};
    saveRemoteConnection(connectionString);
    await refreshDBList();
    await refreshTableList();
    _clearResults();
    try {
        const { updateRemoteStatus } = await import('./mode-switcher.js');
        updateRemoteStatus();
    } catch (_) {}
}

export function initDBButtons() {
    const btnOpen = document.getElementById('btn-open-db');
    if (btnOpen) btnOpen.addEventListener('click', async () => {
        const id = await window.api.pgOpenDB();
        if (id) { await refreshDBList(); await switchDB(id); }
    });
}

// ── Tabellen-Liste ─────────────────────────────────────────────────────

export async function refreshTableList() {
    const tableListEl = document.getElementById('table-list');
    if (!tableListEl) return;
    const selTable = document.getElementById('sel-table');

    // ── Entscheide ob Remote oder PGlite basierend auf dbMode ──────────────
    const mode = state.dbMode || 'pglite';  // Default zu PGlite
    let allTables = [];
    
    try {
        if (mode === 'remote') {
            // ── REMOTE MODE: Nur Remote-Tabellen laden ──────────────────
            console.log('[refreshTableList] Remote-Mode: Lade Remote-Tabellen');
            
            const remoteRawTables = await window.api.dbTables?.('remote').catch((err) => {
                console.error('[refreshTableList] Remote dbTables fehler:', err);
                tableListEl.innerHTML = `<div style="padding:10px;color:var(--error);font-size:12px">⚠️ Remote-Tabellen fehler: ${escH(err.message)}</div>`;
                return [];
            });
            
            // Remote-Tabellen normalisieren
            const remoteTables = (remoteRawTables || []).map(t => {
                const baseName = t.table_name || t.name || '';
                const normalizedType = (t.type === 'view' || t.table_type === 'VIEW')
                    ? 'view'
                    : 'table';
                return {
                    ...t,
                    name:       baseName,
                    table_name: baseName,
                    type:       normalizedType,
                    _source:    'remote',  // MARKIERUNG: Remote-Quelle
                };
            });
            
            // Remote-Filter (nur public schema)
            const filteredRemoteTables = remoteTables.filter(t => {
                if (!t.table_name) return false;
                // Filter System-Schemas
                if (t.schema_name && ['information_schema', 'pg_catalog', 'pg_toast', 'pg_temp'].includes(t.schema_name)) {
                    return false;
                }
                return true;
            });
            
            console.log('[refreshTableList] Remote geladen:', filteredRemoteTables.length, 'Tabellen');
            allTables = filteredRemoteTables;
            
        } else {
            // ── PGLITE MODE: Nur PGlite-Tabellen laden ──────────────────
            console.log('[refreshTableList] PGlite-Mode: Lade PGlite-Tabellen');
            
            if (!state.pgId) {
                console.warn('[refreshTableList] Keine PGlite-DB aktiv. Versuche zu initialisieren...');
                const pgList = await window.api.pgListDBs().catch(() => []);
                if (pgList.length > 0) {
                    state.pgId = pgList[0].id;
                    state.activeDbId = pgList[0].id;
                    state.dbMode = 'pglite';
                    console.log('[refreshTableList] PGlite initialisiert:', state.pgId);
                } else {
                    tableListEl.innerHTML = '<div class="empty-list">🐘 Keine Datenbank verfügbar.<br/><small>PGlite wird initialisiert...</small></div>';
                    return;
                }
            }

            const pgContextId = state.pgId;
            const pgRawTables = await window.api.pgTables(pgContextId).catch((err) => {
                console.error('[refreshTableList] PGlite Fehler:', err);
                return [];
            });
            
            const pgColumns = await window.api.pgColumns(pgContextId).catch(() => []);
            state.knownColumns = {};
            pgColumns.forEach(r => {
                if (!state.knownColumns[r.table_name]) state.knownColumns[r.table_name] = [];
                state.knownColumns[r.table_name].push(r.column_name);
            });
            
            // PGlite-Tabellen normalisieren
            const pgTables = pgRawTables.map(t => {
                const baseName = t.table_name || t.name || '';
                const isExternal = t.database_name && !['main', 'memory'].includes(t.database_name);
                const fullName = isExternal
                    ? `${t.database_name}.${t.schema_name}.${baseName}`
                    : baseName;
                const rawType = t.type || t.table_type || '';
                const normalizedType = (rawType === 'view' || rawType === 'VIEW' || rawType === 'MATERIALIZED VIEW')
                    ? 'view'
                    : 'table';
                return {
                    ...t,
                    name:       fullName,
                    table_name: baseName,
                    type:       normalizedType,
                    _source:    'pglite',  // MARKIERUNG: PGlite-Quelle
                };
            });
            
            // PGlite-Filter
            const filteredPGTables = pgTables.filter(t => {
                if (!t.table_name && !t.name) return false;
                if (t.schema_name && ['information_schema', 'pg_catalog', 'pg_toast', 'pg_temp'].includes(t.schema_name)) {
                    return false;
                }
                if (!t.database_name || t.database_name === 'main') {
                    return true;
                }
                if (t.database_name === 'postgres_server' && t.schema_name === 'public') {
                    return true;
                }
                return false;
            });
            
            console.log('[refreshTableList] PGlite geladen:', filteredPGTables.length, 'Tabellen');
            allTables = filteredPGTables;
        }
        
        // ── Gemeinsame Renderlogik für beide Modi ──────────────────────
        let tables = allTables.map(t => t);  // Copy
        
        console.log('[refreshTableList] Total geladen:', tables.length, 'Tabellen');
        
        // state.knownTables aktualisieren (für Autocomplete)
        state.knownTables = tables.map(t => t.name).filter(Boolean);
        updateAutocomplete();
        
        // Sortierung anwenden
        const contextId = mode === 'remote' ? 'remote-context' : state.pgId;
        const order = state.tableOrder[contextId];
        const bottomOrder = state.tableBottomOrder[contextId] || [];

        if (order && Array.isArray(order)) {
            tables.sort((a, b) => {
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

        // Rendering mit Quellen-Markierung (PGlite vs Remote)
        tableListEl.innerHTML = tables.length ? tables.map(t => {
            const sqlPath = t.name;
            const safeName = typeof t.name === 'string' ? t.name : String(t.name || '');
            const displayLabel = t.table_name || (safeName ? safeName.split('.').pop() : '(unbekannt)');
            
            // Icon basierend auf Quelle
            const sourceIcon = t._source === 'remote' ? '🔗 ' : '🐘 ';
            const sourceHint = t._source === 'remote' ? ' (Remote)' : '';
            
            console.debug('[Sidebar] Table rendering:', { fullName: t.name, label: displayLabel, source: t._source });
            
            const isBottom = bottomOrder.includes(t.name);
            return `
            <div class="table-item ${isBottom ? 'is-bottom' : ''}" draggable="true"
                 data-name="${escH(sqlPath)}" data-type="${t.type}" data-schema="${escH(t.schema_name)}" data-database="${escH(t.database_name)}" data-source="${t._source}"
                 style="${state.tableColors[t.name] ? `border-left: 3px solid ${state.tableColors[t.name]}` : ''}">
                <span class="table-name">
                    ${sourceIcon} ${escH(displayLabel)}<small style="opacity:0.6;font-size:0.8em">${sourceHint}</small>
                </span>
                <div class="table-actions">
                    <span class="action-btn" title="Farbe wählen" data-a="color" data-n="${escH(t.name)}">🎨</span>
                    <span class="action-btn" title="Umbenennen" data-a="rename" data-n="${escH(t.name)}">✏️</span>
                    <span class="action-btn" title="Löschen" data-a="drop" data-n="${escH(t.name)}">🗑️</span>
                </div>
            </div>`;
        }).join('') : '<div class="empty-list">Keine Tabellen.</div>';

        // ── SINGLE Event-Delegation Handler für alle Tabellenklicks ──────────────────
        // Dies verhindert doppelte Listener und Konflikte
        const handleTableListClick = (e) => {
            console.log('[sidebar.handleTableListClick] CLICK EVENT:', e.target.tagName, e.target.className);
            
            // 1. Zuerst: Action-Buttons prüfen (stopPropagation für diese)
            const actionBtn = e.target.closest('.action-btn');
            if (actionBtn) {
                console.log('[sidebar] ACTION-BUTTON geklickt:', actionBtn.dataset.a);
                e.stopPropagation();
                const { a, n } = actionBtn.dataset;
                if (a === 'rename') openRenameModal(n);
                if (a === 'color')  openColorPicker(e, n);
                if (a === 'drop')   dropTable(n);
                return;  // Exit nach Action-Button
            }

            // 2. Dann: Tabellen-Item prüfen
            const item = e.target.closest('.table-item');
            if (!item) {
                console.log('[sidebar] Kein .table-item gefunden, ignorieren');
                return;
            }

            console.log('[sidebar] ✅ Tabellenklick auf:', item.dataset.name);
            const name = item.dataset.name;
            const type = item.dataset.type || 'table';
            const source = item.dataset.source || 'pglite';

            if (typeof window.openTableInEditor === 'function') {
                console.log('[sidebar] ✅ Rufe openTableInEditor auf mit:', name, type, source);
                window.openTableInEditor(name, null, type, source);
            } else {
                console.log('[sidebar] ❌ openTableInEditor nicht verfügbar, nutze _quickView');
                _quickView(name);
            }
        };

        // Cleanup + registriere EINEN Handler für alle Clicks
        tableListEl.removeEventListener('click', tableListEl.__tableListClickHandler);
        tableListEl.__tableListClickHandler = handleTableListClick;
        tableListEl.addEventListener('click', handleTableListClick);
            
        initTableDragAndDrop(tableListEl);

        if (selTable) {
            selTable.innerHTML = '<option value="">Tabelle…</option>' +
                tables.map(t => `<option value="${escH(t.name)}">${escH(t.name)}</option>`).join('');
            if (state.currentTable) selTable.value = state.currentTable;
        }

    } catch (e) {
        console.error('refreshTableList:', e);
        const tableListEl = document.getElementById('table-list');
        if (!tableListEl) return;
        
        tableListEl.innerHTML = `<div style="padding:10px;color:var(--error);font-size:12px">⚠️ ${escH(String(e.message ?? e))}</div>`;
    }
}

/**
 * Initialisiert Drag & Drop Funktionalität für die Tabellenliste
 */
function initTableDragAndDrop(container) {
    let draggedItem = null;

    // Hilfsfunktion: Findet das Element, vor dem eingefügt werden soll
    const getDragAfterElement = (y) => {
        const draggableElements = [...container.querySelectorAll('.table-item:not(.dragging)')];
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - (box.top + box.height / 2);
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    };

    container.addEventListener('dragover', (e) => {
        e.preventDefault();
        const afterElement = getDragAfterElement(e.clientY);
        if (draggedItem) {
            if (!afterElement) {
                // Wir sind im leeren Raum unter der Liste
                const lastItem = container.querySelector('.table-item:not(.dragging):last-of-type');
                const lastRect = lastItem ? lastItem.getBoundingClientRect() : null;
                
                // Wenn wir deutlich (mehr als 30px) unter der letzten Tabelle sind -> Bottom Zone
                if (lastRect && e.clientY > lastRect.bottom + 30) {
                    draggedItem.classList.add('is-bottom');
                } else if (!lastRect) {
                    draggedItem.classList.add('is-bottom');
                }
                container.appendChild(draggedItem);
            } else {
                // Wir schieben zwischen Tabellen
                if (afterElement.classList.contains('is-bottom')) draggedItem.classList.add('is-bottom');
                else draggedItem.classList.remove('is-bottom');
                container.insertBefore(draggedItem, afterElement);
            }
        }
    });

    container.querySelectorAll('.table-item').forEach(item => {
        item.addEventListener('dragstart', (e) => {
            const name = item.dataset.name;
            e.dataTransfer.setData('application/kynto-table', name);
            draggedItem = item;
            setTimeout(() => item.classList.add('dragging'), 0);
            e.dataTransfer.effectAllowed = 'copyMove';
        });

        item.addEventListener('dragend', () => {
            draggedItem.classList.remove('dragging');
            draggedItem = null;
            container.querySelectorAll('.table-item').forEach(el => el.classList.remove('drag-over'));
            saveTableOrder();
        });
    });
}

/**
 * Öffnet einen kleinen Farbwähler direkt am Maus-Cursor/Icon
 */
function openColorPicker(event, tableName) {
    const existing = document.querySelector('.color-picker-popup');
    if (existing) existing.remove();

    const popup = document.createElement('div');
    popup.className = 'color-picker-popup';
    popup.style.top = `${event.clientY}px`;
    popup.style.left = `${event.clientX - 100}px`;

    PRESET_COLORS.forEach(color => {
        const swatch = document.createElement('div');
        swatch.className = 'color-swatch';
        swatch.style.background = color;
        swatch.setAttribute('data-action', 'save-color');
        swatch.setAttribute('data-color', color);
        swatch.setAttribute('data-table', tableName);
        popup.appendChild(swatch);
    });

    // Event-Delegation für Farbwähler (CSP-konform)
    popup.addEventListener('click', (e) => {
        if (e.target.hasAttribute('data-action')) {
            const action = e.target.getAttribute('data-action');
            const color = e.target.getAttribute('data-color');
            const table = e.target.getAttribute('data-table');
            
            if (action === 'save-color') {
                saveTableColor(table, color);
                popup.remove();
            }
        }
    });

    const clear = document.createElement('div');
    clear.className = 'color-swatch clear';
    clear.textContent = 'Farbe entfernen';
    clear.addEventListener('click', () => {
        saveTableColor(tableName, null);
        popup.remove();
    });
    popup.appendChild(clear);

    document.body.appendChild(popup);

    const close = (e) => { if (!popup.contains(e.target)) { popup.remove(); document.removeEventListener('mousedown', close); } };
    setTimeout(() => document.addEventListener('mousedown', close), 10);
}

// ── Drop / Rename Tabelle ──────────────────────────────────────────────

/**
 * Öffnet Import-Dialog für eine spezifische Tabelle
 */

export async function dropTable(name) {
    // Echter Bestätigungs-Dialog statt browser confirm()
    confirmDeleteTable({
        tableName: name,
        schema:    state.currentSchema || 'public',
        dbId:      state.activeDbId || state.pgId,
        onSuccess: async () => {
            if (state.currentTable === name) {
                state.currentTable = null;
                state.currentCols  = [];
                // clearResults über globale Referenz aufrufen (gesetzt von views.js)
                if (typeof window.clearResults === 'function') {
                    window.clearResults();
                } else {
                    _clearResults();
                }
            }
            setStatus(`"${name}" gelöscht.`, 'success');
            await refreshTableList();
        },
    });
}

let _renameTarget = null;

export function openRenameModal(name) {
    _renameTarget = name;
    document.getElementById('rename-hint').textContent = `Aktueller Name: "${name}"`;
    document.getElementById('rename-input').value      = name;
    document.getElementById('rename-modal').classList.add('open');
    setTimeout(() => {
        const ri = document.getElementById('rename-input');
        ri.focus(); ri.select();
    }, 50);
}

async function doRename() {
    const input   = document.getElementById('rename-input');
    const newName = input.value.trim();
    if (!newName || newName === _renameTarget) {
        document.getElementById('rename-modal').classList.remove('open');
        return;
    }
    try {
        await window.api.query(
            `ALTER TABLE ${esc(_renameTarget)} RENAME TO ${esc(newName)}`,
            state.activeDbId
        );
        // Reihenfolge im State aktualisieren, damit der neue Name an der gleichen Stelle bleibt
        const contextId = state.activeDbId;
        if (state.tableOrder[contextId]) {
            state.tableOrder[contextId] = state.tableOrder[contextId].map(n => n === _renameTarget ? newName : n);
            localStorage.setItem(TABLE_ORDER_KEY, JSON.stringify(state.tableOrder));
        }
        if (state.currentTable === _renameTarget) state.currentTable = newName;
        document.getElementById('rename-modal').classList.remove('open');
        setStatus(`Umbenannt: "${_renameTarget}" → "${newName}"`, 'success');
        await refreshTableList();
    } catch (err) {
        setStatus('Fehler: ' + err, 'error');
        input.style.borderColor = 'var(--error)';
    }
}

export function initRenameModal() {
    const modal = document.getElementById('rename-modal');
    const input = document.getElementById('rename-input');
    document.getElementById('rename-confirm').addEventListener('click', doRename);
    document.getElementById('rename-cancel').addEventListener('click',  () => modal.classList.remove('open'));
    input.addEventListener('keydown', e => {
        input.style.borderColor = '';
        if (e.key === 'Enter')  doRename();
        if (e.key === 'Escape') modal.classList.remove('open');
    });
    modal.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('open'); });
}

// ── Rename Datenbank (Anzeigename) ─────────────────────────────────────

let _renameDBTarget = null;

export function openRenameDBModal(id, currentName) {
    _renameDBTarget = id;
    const hint  = document.getElementById('rename-db-hint');
    const input = document.getElementById('rename-db-input');
    const modal = document.getElementById('rename-db-modal');
    if (!hint || !input || !modal) return;
    hint.textContent = `Aktueller Anzeigename: "${currentName}"`;
    input.value      = currentName;
    modal.classList.add('open');
    setTimeout(() => { input.focus(); input.select(); }, 50);
}

async function doRenameDB() {
    const input   = document.getElementById('rename-db-input');
    const modal   = document.getElementById('rename-db-modal');
    const newName = input.value.trim();
    modal.classList.remove('open');
    if (!newName || !_renameDBTarget) return;
    saveDBName(_renameDBTarget, newName);
    setStatus(`Datenbank umbenannt zu "${newName}".`, 'success');
    await refreshDBList();
}

export function initRenameDBModal() {
    const modal = document.getElementById('rename-db-modal');
    const input = document.getElementById('rename-db-input');
    if (!modal || !input) return;
    document.getElementById('rename-db-confirm').addEventListener('click', doRenameDB);
    document.getElementById('rename-db-cancel').addEventListener('click',  () => modal.classList.remove('open'));
    input.addEventListener('keydown', e => {
        if (e.key === 'Enter')  doRenameDB();
        if (e.key === 'Escape') modal.classList.remove('open');
    });
    modal.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('open'); });
}
/* ── sidebar/db-list.js ────────────────────────────────────────────
   DB-Panel: Rendering und Verwaltung der Datenbankliste
   ──────────────────────────────────────────────────────────────── */

import { state } from '../state.js';
import { esc, escH, setStatus } from '../utils.js';
import {
    loadDBNames,
    getDisplayName,
    saveRemoteConnection,
    loadRemoteConnection,
} from './persistence.js';
import { injectLayoutStyles } from './utils.js';

// Note: refreshTableList wird separat als async import durchgeführt um circular dependencies zu vermeiden

let _clearResults = () => {};
let _quickView = () => {};

export function setClearResultsCallback(cb) {
    _clearResults = cb;
}

export function setQuickViewCallback(cb) {
    _quickView = cb;
}

/**
 * Lädt und rendert die Datenbank-Liste
 */
export async function refreshDBList() {
    const dbListEl = document.getElementById('db-list');
    if (!dbListEl) return;

    // Styles injizieren
    injectLayoutStyles();

    if (!state.remoteConnectionString) {
        const saved = loadRemoteConnection();
        if (saved) state.remoteConnectionString = saved;
    }

    // PGlite
    const pglites = await window.api.pgListDBs().catch(err => {
        console.error('pgListDBs fehlgeschlagen:', err);
        return [];
    });

    // ── PGlite ist Standard ────────────────────────────────────────
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

    // Remote-Datenbank hinzufügen wenn verbunden
    const dbStatus = await window.api.dbStatus?.().catch(() => ({ remoteDatabase: null }));
    let hasRemoteDB = false;
    if (dbStatus?.remoteDatabase) {
        hasRemoteDB = true;
        allEntries.push({
            id: 'remote-db',
            name: 'PostgreSQL Server',
            path: state.serverConnectionString || 'Remote Server',
            _type: 'remote',
            isDefault: false,
        });
        console.log('[sidebar] Remote-DB in allEntries hinzugefügt');
    }

    if (!allEntries.length) {
        dbListEl.innerHTML = '<div class="empty-list">Keine DB offen.</div>';
        return;
    }

    dbListEl.innerHTML = allEntries
        .map(d => {
            let isActive = false;
            if (d._type === 'remote') isActive = state.dbMode === 'remote';
            else if (d._type === 'pglite') isActive = state.dbMode === 'pglite' && state.pgId === d.id;

            const safeId = typeof d.id === 'string' ? d.id : '';

            let dot = `<span class="db-dot"></span>`;
            const displayName = getDisplayName(d.id, d.name || (safeId ? safeId.split(/[/\\]/).pop().replace('.pgdata', '') : 'Unbekannt'), dbNames);

            let label = escH(displayName);
            if (d._type === 'pglite') {
                dot = `<span class="db-dot" style="background:var(--info)"></span>`;
                const fallback = safeId ? safeId.split(/[/\\]/).pop().replace('.pgdata', '') : 'Unbekannt';
                label = `🐘 ${escH(getDisplayName(d.id, d.name || fallback, dbNames))}`;
            } else if (d._type === 'remote') {
                dot = `<span class="db-dot" style="background:var(--success,#4caf50)"></span>`;
                label = `☁️ ${escH(getDisplayName(d.id, d.name, dbNames))}`;
            }

            // Umbenennen-Button
            const renameBtn = `<button class="db-rename" data-id="${escH(d.id)}"
                                   data-type="${d._type}"
                                   data-current="${escH(displayName)}"
                                   title="Umbenennen">✏️</button>`;

            // Delete-Button
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
        })
        .join('');

    // Event-Handler
    dbListEl.querySelectorAll('.db-item').forEach(el =>
        el.addEventListener('click', e => {
            if (e.target.classList.contains('db-close')) return;
            if (e.target.classList.contains('db-rename')) return;
            if (el.dataset.type === 'pglite') switchToPGlite(el.dataset.id);
            else if (el.dataset.type === 'remote') switchToRemote(el.dataset.id);
            else switchDB(el.dataset.id);
        }),
    );

    dbListEl.querySelectorAll('.db-rename').forEach(el =>
        el.addEventListener('click', e => {
            e.stopPropagation();
            // TODO: Implementiere openRenameDBModal
            console.log('[sidebar] Rename DB:', el.dataset.id);
        }),
    );

    dbListEl.querySelectorAll('.db-close').forEach(el =>
        el.addEventListener('click', async e => {
            e.stopPropagation();
            const { refreshTableList } = await import('./table-list.js');
            
            if (el.dataset.type === 'remote') {
                state.remoteConnectionString = null;
                saveRemoteConnection(null);
                if (state.dbMode === 'remote') state.dbMode = 'pglite';
                await refreshDBList();
                await refreshTableList();
                try {
                    const { updateRemoteStatus } = await import('../mode-switcher.js');
                    updateRemoteStatus();
                } catch (_) {}
            } else if (el.dataset.type === 'pglite') {
                await window.api.pgCloseDB(el.dataset.id);
                if (state.pgId === el.dataset.id) {
                    state.pgId = null;
                    state.pgMode = false;
                }
                await refreshDBList();
                await refreshTableList();
            }
        }),
    );
}

// ── Modus-Wechsel ──────────────────────────────────────────────────

export async function switchDB(id) {
    if (!id) return;
    const { refreshTableList } = await import('./table-list.js');
    
    state.pgId = id;
    state.dbMode = 'pglite';
    state.currentTable = null;
    state.currentCols = [];
    state.currentSort = { col: null, dir: 'ASC' };
    state.currentFilters = {};
    await refreshDBList();
    await refreshTableList();
    _clearResults();
}

export async function switchToPGlite(pgId) {
    if (!pgId) return;
    const { refreshTableList } = await import('./table-list.js');
    
    state.pgId = pgId;
    state.pgMode = true;
    state.dbMode = 'pglite';
    state.currentTable = null;
    state.currentCols = [];
    state.currentSort = { col: null, dir: 'ASC' };
    state.currentFilters = {};
    await refreshDBList();
    await refreshTableList();
    _clearResults();
}

export async function switchToRemote(remoteDbId) {
    if (!state.serverConnectionString && !state.remoteConnectionString) {
        console.warn('[switchToRemote] Keine Remote-Verbindung aktiv');
        return;
    }

    const { refreshTableList } = await import('./table-list.js');

    const connectionString = state.serverConnectionString || state.remoteConnectionString;
    state.remoteConnectionString = connectionString;
    state.dbMode = 'remote';
    state.pgMode = false;
    state.currentTable = null;
    state.currentCols = [];
    state.currentSort = { col: null, dir: 'ASC' };
    state.currentFilters = {};
    saveRemoteConnection(connectionString);
    await refreshDBList();
    await refreshTableList();
    _clearResults();
    try {
        const { updateRemoteStatus } = await import('../mode-switcher.js');
        updateRemoteStatus();
    } catch (_) {}
}

export function initDBButtons() {
    const btnOpen = document.getElementById('btn-open-db');
    if (btnOpen)
        btnOpen.addEventListener('click', async () => {
            const { refreshTableList } = await import('./table-list.js');
            
            const id = await window.api.pgOpenDB();
            if (id) {
                await refreshDBList();
                await switchDB(id);
            }
        });
}
// ── Modal für DB-Umbenennung ──────────────────────────────────────
export function initRenameDBModal() {
    // TODO: Implementiere Umbenennungs-Modal für Datenbanken
    console.log('[sidebar] initRenameDBModal - TODO');
}

export function openRenameDBModal(id, currentName) {
    // TODO: Öffne Umbenennungs-Dialog
    console.log('[sidebar] openRenameDBModal:', id, currentName);
}
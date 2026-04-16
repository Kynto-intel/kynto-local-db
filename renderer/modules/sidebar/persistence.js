/* ── sidebar/persistence.js ───────────────────────────────────────
   localStorage Verwaltung und DB-Namen/Farben/Sortierung
   ──────────────────────────────────────────────────────────────── */

import { state } from '../state.js';

// ── Storage Keys ───────────────────────────────────────────────────
export const REMOTE_KEY = 'sidebar_remote_connection';
export const DB_NAMES_KEY = 'sidebar_db_display_names';      // { [id]: customName }
export const TABLE_COLORS_KEY = 'sidebar_table_colors';     // { [tableName]: color }
export const TABLE_ORDER_KEY = 'sidebar_table_order';        // { [dbId]: [tableName, ...] }
export const TABLE_BOTTOM_KEY = 'sidebar_table_bottom_order';

// ── Init State beim Laden ──────────────────────────────────────────
export function initPersistenceState() {
    state.tableColors = JSON.parse(localStorage.getItem(TABLE_COLORS_KEY) || '{}');
    state.tableOrder = JSON.parse(localStorage.getItem(TABLE_ORDER_KEY) || '{}');
    state.tableBottomOrder = JSON.parse(localStorage.getItem(TABLE_BOTTOM_KEY) || '{}');
}

// ── Remote Connection ──────────────────────────────────────────────
export function saveRemoteConnection(cs) {
    try {
        if (cs) localStorage.setItem(REMOTE_KEY, cs);
        else localStorage.removeItem(REMOTE_KEY);
    } catch (e) {
        console.warn('Remote speichern fehlgeschlagen:', e);
    }
}

export function loadRemoteConnection() {
    try {
        return localStorage.getItem(REMOTE_KEY) || null;
    } catch (e) {
        return null;
    }
}

export function restoreRemoteState() {
    const saved = loadRemoteConnection();
    if (saved && !state.remoteConnectionString) {
        state.remoteConnectionString = saved;
    }
}

// ── DB Display Names ───────────────────────────────────────────────
export function loadDBNames() {
    try {
        return JSON.parse(localStorage.getItem(DB_NAMES_KEY) || '{}');
    } catch (e) {
        return {};
    }
}

export function saveDBName(id, name) {
    try {
        const names = loadDBNames();
        if (name) names[id] = name;
        else delete names[id];
        localStorage.setItem(DB_NAMES_KEY, JSON.stringify(names));
    } catch (e) {
        console.warn('DB-Name speichern fehlgeschlagen:', e);
    }
}

export function getDisplayName(id, fallback, dbNames) {
    return dbNames[id] || fallback;
}

// ── Table Colors & Order ──────────────────────────────────────────
export function saveTableColor(name, color) {
    state.tableColors[name] = color;
    localStorage.setItem(TABLE_COLORS_KEY, JSON.stringify(state.tableColors));
}

export function saveTableOrder() {
    const contextId = state.dbMode === 'remote'
        ? state.remoteConnectionString
        : state.dbMode === 'pglite'
            ? state.pgId
            : state.activeDbId;
    if (!contextId) return;

    const listEl = document.getElementById('table-list');
    const topItems = Array.from(listEl.querySelectorAll('.table-item:not(.is-bottom)')).map(el => el.dataset.name);
    const bottomItems = Array.from(listEl.querySelectorAll('.table-item.is-bottom')).map(el => el.dataset.name);

    state.tableOrder[contextId] = topItems;
    state.tableBottomOrder[contextId] = bottomItems;

    localStorage.setItem(TABLE_ORDER_KEY, JSON.stringify(state.tableOrder));
    localStorage.setItem(TABLE_BOTTOM_KEY, JSON.stringify(state.tableBottomOrder));
}

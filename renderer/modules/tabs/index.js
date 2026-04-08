/* ── tabs/index.js ──────────────────────────────────────────────────
   Public API für das native Tab-System
   ──────────────────────────────────────────────────────────────────── */

import { tabManager } from './manager.js';
import { tabRenderer } from './renderer.js';
import { setOnTableDropCallback } from './handlers.js';

// Initialisiere Renderer beim Import
try {
    tabRenderer.init();
} catch (e) {
    console.error('[tabs] Init Error:', e);
}

// ── Public API ──────────────────────────────────────────────────────

export function newTab(sql = '', title = null) {
    const tab = tabManager.createTab(sql, title);
    tabRenderer.render();
    return tab;
}

export function renderTabs() {
    tabRenderer.render();
}

export function activateTab(id) {
    tabManager.activateTab(id);
    tabRenderer.render();
}

export function closeTab(id) {
    if (tabManager.closeTab(id)) {
        tabRenderer.render();
    }
}

export function setTabActivateCallback(fn) {
    tabManager.setOnActivateCallback(fn);
}

export function initTabsDragAndDrop(onTableDrop) {
    setOnTableDropCallback(onTableDrop);
}

export function updateTabTitle(id, title) {
    tabRenderer.updateTabTitle(id, title);
}

export function getActiveTab() {
    return tabManager.getActiveTab();
}

export function getTabs() {
    return tabManager.getTabs();
}

export { tabManager, tabRenderer };

/**
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ Settings Tabs Coordinator                                               │
 * │ Verwaltet alle Settings Tabs zentral                                    │
 * └─────────────────────────────────────────────────────────────────────────┘
 */

import { uiTab } from './ui-tab.js';
import { editorTab } from './editor-tab.js';
import { databaseTab } from './database-tab.js';
import { aiTab } from './ai-tab.js';
import { apiKeysTab } from './api-keys-tab.js';
import { storageTab } from './storage-tab.js';
import { templatesTab } from './templates-tab.js';
import { shortcutsTab } from './shortcuts-tab.js';

/**
 * Alle Tabs registriert
 */
export const ALL_TABS = [
    uiTab,
    editorTab,
    databaseTab,
    aiTab,
    apiKeysTab,
    storageTab,
    templatesTab,
    shortcutsTab
    // Externe Tabs (schon vorhanden):
    // - API Settings (settings-api-tab.js)
    // - Maintenance (DBMaintenance/maintenance-ui.js)
    // - Sync Center (sync-center.js)
];

/**
 * Initialisiert alle Tabs
 */
export function initAllTabs() {
    ALL_TABS.forEach(tab => {
        if (tab.init && typeof tab.init === 'function') {
            tab.init();
        }
    });
}

/**
 * Lädt alle Tabs mit Daten
 */
export async function loadAllTabs(settings) {
    for (const tab of ALL_TABS) {
        if (tab.load && typeof tab.load === 'function') {
            await tab.load(settings);
        }
    }
}

/**
 * Wendet alle Tabs an (nach Speichern)
 */
export async function applyAllTabs(settings) {
    for (const tab of ALL_TABS) {
        if (tab.apply && typeof tab.apply === 'function') {
            await tab.apply(settings);
        }
    }
}

/**
 * Speichert alle Tabs-Daten
 */
export function saveAllTabs(formData) {
    const result = {};
    ALL_TABS.forEach(tab => {
        if (tab.save && typeof tab.save === 'function') {
            const tabData = tab.save(formData);
            Object.assign(result, tabData);
        }
    });
    return result;
}

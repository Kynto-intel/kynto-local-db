/**
 * ⚙️ Settings & Storage Handler
 * Settings, History, Favorites, API Keys
 */

const { ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');

/**
 * 🔧 Registriere alle Settings Handler
 */
function registerSettingsHandlers(app, defaultSettings, CURRENT_SETTINGS_VERSION) {
    const DATA_DIR = path.join(app.getAppPath(), 'data');
    const HISTORY_FILE = path.join(DATA_DIR, 'sql_history.json');
    const FAVORITES_FILE = path.join(DATA_DIR, 'sql_favorites.json');
    const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
    const API_KEYS_FILE = path.join(DATA_DIR, 'api-keys.json');

    // ====================================================================
    // 📋 History
    // ====================================================================

    ipcMain.handle('history:load', () => {
        try {
            return fs.existsSync(HISTORY_FILE) ? JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8')) : [];
        } catch (e) {
            console.error('[history:load] Fehler beim Laden der Historie:', e); return [];
        }
    });

    ipcMain.handle('history:save', (_, data) => {
        try {
            fs.writeFileSync(HISTORY_FILE, JSON.stringify(data), 'utf8'); return true;
        } catch (e) {
            console.error('[history:save] Fehler beim Speichern der Historie:', e); return false;
        }
    });

    // ====================================================================
    // ⭐ Favorites
    // ====================================================================

    ipcMain.handle('favorites:load', () => {
        try {
            return fs.existsSync(FAVORITES_FILE) ? JSON.parse(fs.readFileSync(FAVORITES_FILE, 'utf8')) : [];
        } catch (e) {
            console.error('[favorites:load] Fehler beim Laden der Favoriten:', e); return [];
        }
    });

    ipcMain.handle('favorites:save', (_, data) => {
        try {
            fs.writeFileSync(FAVORITES_FILE, JSON.stringify(data), 'utf8'); return true;
        } catch (e) {
            console.error('[favorites:save] Fehler beim Speichern der Favoriten:', e); return false;
        }
    });

    // ====================================================================
    // 🎛️ Settings
    // ====================================================================

    ipcMain.handle('settings:load', () => {
        let userSettings = {};
        try {
            if (fs.existsSync(SETTINGS_FILE)) {
                userSettings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
            }
        } catch (e) {
            console.error('Fehler beim Laden der Benutzereinstellungen:', e);
        }

        const merged = { ...defaultSettings, version: CURRENT_SETTINGS_VERSION };

        Object.keys(defaultSettings).forEach(key => {
            if (key === 'ui' && userSettings.ui) {
                merged.ui = { ...defaultSettings.ui };
                Object.keys(defaultSettings.ui).forEach(uiKey => {
                    if (userSettings.ui.hasOwnProperty(uiKey)) merged.ui[uiKey] = userSettings.ui[uiKey];
                });
            } else if (key === 'editor' && userSettings.editor) {
                merged.editor = { ...defaultSettings.editor };
                Object.keys(defaultSettings.editor).forEach(edKey => {
                    if (userSettings.editor.hasOwnProperty(edKey)) merged.editor[edKey] = userSettings.editor[edKey];
                });
            } else if (userSettings.hasOwnProperty(key)) {
                merged[key] = userSettings[key];
            }
        });

        return merged;
    });

    ipcMain.handle('settings:save', (_, data) => {
        try {
            let current = {};
            if (fs.existsSync(SETTINGS_FILE)) {
                current = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
            }
            const merged = {
                ...current, ...data,
                ui:       { ...(current.ui       || {}), ...(data.ui       || {}) },
                database: { ...(current.database || {}), ...(data.database || {}) },
                version: CURRENT_SETTINGS_VERSION
            };
            fs.writeFileSync(SETTINGS_FILE, JSON.stringify(merged, null, 2), 'utf8');

            if (data.database?.activeType || data.database?.postgresqlConnectionString) {
                if (data.database?.activeType === 'postgresql' && data.database?.postgresqlConnectionString) {
                    console.log('[settings:save] DB-Konfiguration gespeichert');
                }
            }

            return true;
        } catch (e) {
            console.error('[settings:save] Fehler:', e.message);
            return false;
        }
    });

    // ====================================================================
    // 🔑 API Keys
    // ====================================================================

    ipcMain.handle('api-keys:load', () => {
        try {
            if (fs.existsSync(API_KEYS_FILE)) {
                const data = JSON.parse(fs.readFileSync(API_KEYS_FILE, 'utf8'));
                return Array.isArray(data) ? data : [];
            }
            return [];
        } catch (e) {
            console.error('[api-keys:load] Fehler:', e.message);
            return [];
        }
    });

    ipcMain.handle('api-keys:add', (_, keyData) => {
        try {
            let keys = [];
            if (fs.existsSync(API_KEYS_FILE)) {
                keys = JSON.parse(fs.readFileSync(API_KEYS_FILE, 'utf8'));
                if (!Array.isArray(keys)) keys = [];
            }
            keys.push(keyData);
            fs.writeFileSync(API_KEYS_FILE, JSON.stringify(keys, null, 2), 'utf8');
            console.log(`[api-keys:add] Neuer API Key hinzugefügt: ${keyData.label}`);
            return true;
        } catch (e) {
            console.error('[api-keys:add] Fehler:', e.message);
            return false;
        }
    });

    ipcMain.handle('api-keys:delete', (_, index) => {
        try {
            let keys = [];
            if (fs.existsSync(API_KEYS_FILE)) {
                keys = JSON.parse(fs.readFileSync(API_KEYS_FILE, 'utf8'));
                if (!Array.isArray(keys)) keys = [];
            }

            if (index >= 0 && index < keys.length) {
                const deleted = keys.splice(index, 1)[0];
                fs.writeFileSync(API_KEYS_FILE, JSON.stringify(keys, null, 2), 'utf8');
                console.log(`[api-keys:delete] API Key gelöscht: ${deleted.label}`);
                return true;
            }

            return false;
        } catch (e) {
            console.error('[api-keys:delete] Fehler:', e.message);
            return false;
        }
    });

    console.log('✅ Settings Handler registriert');
}

module.exports = { registerSettingsHandlers };

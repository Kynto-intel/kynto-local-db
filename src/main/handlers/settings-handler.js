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

        // Start mit den Defaults
        const merged = { ...defaultSettings, version: CURRENT_SETTINGS_VERSION };

        // Merge User Settings über Defaults (überschreibe / ergänze)
        Object.keys(userSettings).forEach(key => {
            // Special handling für nested Objects: Merge statt Replace
            if ((key === 'ui' || key === 'editor' || key === 'database' || key === 'ai' || key === 'apis' || key === 'shortcuts') && typeof userSettings[key] === 'object' && userSettings[key] !== null) {
                merged[key] = { ...(defaultSettings[key] || {}), ...userSettings[key] };
            } else {
                // Top-level Werte einfach überschreiben
                merged[key] = userSettings[key];
            }
        });

        console.log('[settings:load] PostgreSQL Connection:', merged.database?.postgresqlConnectionString ? '✅' : '❌');
        console.log('[settings:load] Language:', merged.language);
        return merged;
    });

    ipcMain.handle('settings:save', (_, data) => {
        try {
            let current = {};
            if (fs.existsSync(SETTINGS_FILE)) {
                current = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
            }
            
            // 🔧 WICHTIG: Nur ungültige "setting-*" FormData-Keys ENTFERNEN
            // Der Rest wird normalerweise zusammengeführt
            const incomingData = {};
            
            Object.keys(data).forEach(key => {
                // Ignoriere "setting-*", "shortcut-*", "sync-*", "maint*" FormData-Keys
                if (!key.startsWith('setting-') && 
                    !key.startsWith('shortcut-') && 
                    !key.startsWith('sync-') &&
                    !key.startsWith('maint')) {
                    incomingData[key] = data[key];
                }
            });
            
            // Merge: Current Settings + Incoming Data (vollständiges Merge, nicht selektiv)
            const merged = {
                ...current,
                ...incomingData,
                // Nested Object Merges
                ui:       { ...(current.ui       || {}), ...(incomingData.ui       || {}) },
                database: { ...(current.database || {}), ...(incomingData.database || {}) },
                editor:   { ...(current.editor   || {}), ...(incomingData.editor   || {}) },
                ai:       { ...(current.ai       || {}), ...(incomingData.ai       || {}) },
                apis:     { ...(current.apis     || {}), ...(incomingData.apis     || {}) },
                templates: { ...(current.templates || {}), ...(incomingData.templates || {}) },
                storage:  { ...(current.storage  || {}), ...(incomingData.storage  || {}) },
                shortcuts: { ...(current.shortcuts || {}), ...(incomingData.shortcuts || {}) },
                version: CURRENT_SETTINGS_VERSION
            };
            
            console.log('[settings:save] Speichere Settings:', Object.keys(merged));
            fs.writeFileSync(SETTINGS_FILE, JSON.stringify(merged, null, 2), 'utf8');

            if (merged.database?.postgresqlConnectionString) {
                console.log('[settings:save] PostgreSQL Connection gespeichert');
            }
            if (merged.language) {
                console.log('[settings:save] Sprache gespeichert:', merged.language);
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

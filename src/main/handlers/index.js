/**
 * 📦 Handler Factory
 * Alle Handler werden hier zentral registriert
 */

const { ipcMain } = require('electron');
const { aiGenerateHandler } = require('./ai-handler');
const { registerDatabaseHandlers } = require('./db-handler');
const { registerFileHandlers } = require('./file-handler');
const { registerSettingsHandlers } = require('./settings-handler');
const { registerSyncHandlers } = require('./sync-handler');
const { registerInstantAPIHandlers } = require('./instant-api-handler');
const { registerEditorHandlers } = require('./editor-handler');
const { registerApiBridgeHandlers } = require('./api-bridge-handler');
const { registerMaintenanceHandlers } = require('./maintenance-handler');

/**
 * 🔧 Registriere ALLE Handler in der IPC
 * Wird aus main.js aufgerufen nach app.whenReady()
 */
function registerAllHandlers(win, app, databaseEngine, pgManager, remote, syncEngine, progressqlManager, defaultSettings, CURRENT_SETTINGS_VERSION) {
    // =========================================================================
    // 🤖 AI Generate Handler (Tool-Calling System)
    // =========================================================================
    ipcMain.handle('ai:generate', aiGenerateHandler);

    // =========================================================================
    // 🗄️ Database Handlers (pg, sql, db:*, postgresql:*, progresssql:*)
    // =========================================================================
    registerDatabaseHandlers(databaseEngine, pgManager, remote);

    // =========================================================================
    // 📁 File & Dialog Handlers
    // =========================================================================
    registerFileHandlers(app);

    // =========================================================================
    // ⚙️ Settings, History, Favorites, API Keys
    // =========================================================================
    registerSettingsHandlers(app, defaultSettings, CURRENT_SETTINGS_VERSION);

    // =========================================================================
    // 🔄 Sync Engine
    // =========================================================================
    registerSyncHandlers(syncEngine);

    // =========================================================================
    // 🚀 Instant API (PostgREST)
    // =========================================================================
    registerInstantAPIHandlers(progressqlManager);

    // =========================================================================
    // 📝 README Editor
    // =========================================================================
    registerEditorHandlers(app);

    // =========================================================================
    // � Sovereign API-Bridge
    // =========================================================================
    registerApiBridgeHandlers();

    // =========================================================================
    // 🧹 Maintenance Handlers (Stats, Preview, Run, Scheduler)
    // =========================================================================
    registerMaintenanceHandlers();

    // =========================================================================
    // �💬 Storage Manager Events
    // =========================================================================
    let storageManagerOpen = false;

    ipcMain.on('open-storage-manager', () => {
        if (!win) return;
        if (storageManagerOpen) {
            storageManagerOpen = false;
            console.log('[Main] Sende hide-storage-manager Signal an Renderer');
            win.webContents.send('hide-storage-manager');
        } else {
            storageManagerOpen = true;
            console.log('[Main] Sende show-storage-manager Signal an Renderer');
            win.webContents.send('show-storage-manager');
        }
    });

    ipcMain.on('close-storage-manager', () => {
        if (!win) return;
        storageManagerOpen = false;
        console.log('[Main] Sende hide-storage-manager Signal an Renderer');
        win.webContents.send('hide-storage-manager');
    });

    console.log('✅ Alle Handler registriert:');
    console.log('  - AI: ai:generate (Tool-Calling)');
    console.log('  - Database: db:*, pg:*, sql:*, postgresql:*, progresssql:*');
    console.log('  - File & Dialog: file:*, dialog:*, csv:import-file');
    console.log('  - Settings: settings:*, history:*, favorites:*, api-keys:*');
    console.log('  - Sync: sync:*');
    console.log('  - Instant API: instant-api:*');
    console.log('  - Editor: editor:*');
    console.log('  - API-Bridge: apiBridge:* (weather, search, news, geocode, etc.)');
    console.log('  - Storage Manager: open/close-storage-manager');
}

module.exports = {
    registerAllHandlers,
    aiGenerateHandler: require('./ai-handler').aiGenerateHandler,
};

const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs   = require('fs');
const http = require('http');
const WebSocket = require('ws');
const pg = require('./pglite-manager');
const remote = require('./pg-remote');
const databaseEngine = require('./database-engine');
const defaultSettings = require('./config/settings');
const sync = require('./sync-engine');
const progressqlManager = require('./progresssql-manager');
const { registerPolicyHandlers } = require('../../renderer/modules/Policies/policy-handlers');
const { startApi } = require('./api/server');
const { registerAllHandlers } = require('./handlers');

const DATA_DIR       = path.join(app.getAppPath(), 'data');
const HISTORY_FILE   = path.join(DATA_DIR, 'sql_history.json');
const FAVORITES_FILE = path.join(DATA_DIR, 'sql_favorites.json');
const SETTINGS_FILE  = path.join(DATA_DIR, 'settings.json');
const API_KEYS_FILE  = path.join(DATA_DIR, 'api-keys.json');

// ── README Editor Datei ────────────────────────────────────────────────────
// Speicherort: C:\Users\Felix\Desktop\Kynto\Kynto\data\editor-data.json
// DATA_DIR zeigt bereits auf den richtigen data/-Ordner der App.
const EDITOR_DATA_FILE = path.join(DATA_DIR, 'editor-data.json');

const CURRENT_SETTINGS_VERSION = 1;

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

let win;
let quitting = false;

function createWindow() {
    win = new BrowserWindow({
        width: 1500, height: 920, minWidth: 960, minHeight: 640,
        backgroundColor: '#18181b',
        webPreferences: {
            preload: path.join(__dirname, '../preload/preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false
        }
    });
    win.loadFile(path.join(__dirname, '../../renderer/index.html'));
    win.setMenuBarVisibility(false);

    win.webContents.on('before-input-event', (event, input) => {
        if (input.type === 'keyDown' && input.key === 'F12') {
            win.webContents.toggleDevTools();
            event.preventDefault();
        }
    });
}

// ── Sync Progress Live-Update ──────────────────────────────────────────────
// Sendet jeden Progress-Event direkt an den Renderer → Live-Anzeige
function setupSyncProgress() {
    sync.setProgressCallback((data) => {
        try {
            if (win && !win.isDestroyed() && win.webContents) {
                win.webContents.send('sync:progress', data);
            }
        } catch (e) {
            // Fenster evtl. geschlossen — ignorieren
        }
    });
}

// ════════════════════════════════════════════════════════════════════════════
// 📦 IPC HANDLERS - ALLE IN SEPARATEN DATEIEN
// ════════════════════════════════════════════════════════════════════════════
// Die Handler sind ausgelagert in: src/main/handlers/
// - ai-handler.js          🤖 AI mit Tool-Calling
// - db-handler.js          🗄️ Alle Datenbankoperationen
// - file-handler.js        📁 Datei I/O + Dialoge
// - settings-handler.js    ⚙️ Settings, History, Favorites, API Keys
// - sync-handler.js        🔄 Sync Engine
// - instant-api-handler.js 🚀 PostgREST/Instant API
// - editor-handler.js      📝 README Editor
// ────────────────────────────────────────────────────────────────────────────

// ── Lifecycle ──────────────────────────────────────────────────────────────
app.on('before-quit', async (e) => {
    if (quitting) return;
    e.preventDefault();
    quitting = true;
    try { await databaseEngine.shutdown(); } catch (err) { console.error('Error shutting down database engine:', err); }
    try { await remote.closeAllRemotes(); } catch (err) { console.error('Error closing Remotes:', err); }
    app.quit();
});

app.whenReady().then(async () => {
    console.log('[Main] App startet...');
    console.log('[Main] appPath:', app.getAppPath());

    // 1. Datenbank-Engine initialisieren (öffnet PGlite als Standard)
    await databaseEngine.initialize();
    console.log('[Main] Datenbank-Engine initialisiert');

    // 2. Settings laden und Remote DB verbinden (BEVOR API startet!)
    const settings = require('./config/settings');
    let remoteDbConnection = null;
    
    if (settings.database?.activeType === 'postgresql' && settings.database?.postgresqlConnectionString) {
        try {
            console.log('[Main] Verbinde Remote PostgreSQL...');
            await databaseEngine.setRemoteDatabase(settings.database.postgresqlConnectionString);
            remoteDbConnection = settings.database.postgresqlConnectionString;
            console.log('[Main] ✅ Remote PostgreSQL verbunden');
        } catch (err) {
            console.error('[Main] Fehler beim Verbinden von Remote PostgreSQL:', err.message);
        }
    }

    // 3. Start Engine API mit Remote DB (wenn vorhanden)
    try {
        const pgClient = pg.getDB(pg.DEFAULT_PGDATA);
        
        let remoteDbAdapter = null;
        
        if (remoteDbConnection) {
            remoteDbAdapter = {
                query: (sql, params = []) => remote.queryRemote(remoteDbConnection, sql, params),
                exec: (sql) => remote.queryRemote(remoteDbConnection, sql, []),
                waitReady: Promise.resolve()
            };
        }
        
        const wsServer = new WebSocket.Server({ noServer: true });
        console.log('[Main] WebSocket Server vorbereitet');
        
        process.env.KYNTO_DATA_DIR = DATA_DIR;
        
        await startApi(pgClient, wsServer, remoteDbAdapter);
        
        if (remoteDbConnection) {
            console.log('[Main] ✅ Engine API aktiv (PGlite + Remote PostgreSQL verfügbar)');
        } else {
            console.log('[Main] ✅ Engine API aktiv (PGlite)');
        }
    } catch (apiErr) {
        console.error("[Main] Fehler beim Starten der Engine API:", apiErr.message);
    }

    // 4. Policy-Handler für RLS-Management registrieren
    try {
        registerPolicyHandlers(databaseEngine);
        console.log('[Main] ✅ Policy-Handler registriert');
    } catch (err) {
        console.error('[Main] Fehler bei der Registrierung von Policy-Handlern:', err.message);
    }

    // 4b. Alle IPC Handler registrieren (AI, Database, Files, Settings, Sync, etc.)
    try {
        registerAllHandlers(win, app, databaseEngine, pg, remote, sync, progressqlManager, defaultSettings, CURRENT_SETTINGS_VERSION);
        console.log('[Main] ✅ Alle IPC Handler registriert');
    } catch (err) {
        console.error('[Main] Fehler bei der Registrierung der IPC Handler:', err.message);
    }

    // 5. Fenster erstellen
    createWindow();

    // 6. Progress-Callback für Sync-Engine registrieren
    setupSyncProgress();

    console.log('[Main] ✓ Startup abgeschlossen');
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('node:path');

require('electron-reload')(__dirname, {
  electron: path.join(__dirname, '..', '..', 'node_modules', '.bin', 'electron')
});

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
const { recipeJobHandler, recipeCancelHandler, recipeCommitDraftHandler } = require('../lib/ai/recipe-engine');
const { toolFetchWebpage, toolSearchWeb } = require('../lib/ai/web-tools');

// ── Google Search Console ──────────────────────────────────────────────────
const {
    registerGSC,
    getGSCAuthUrl,
    exchangeGSCCodeForTokens,
    refreshGSCTokenIfNeeded,
    isGSCAuthenticated,
    getGSCSites,
    getGSCSearchPerformance,
    getGSCSitemaps,
    inspectGSCUrl,
} = require('../components/api/Module/google-search-console-modul'); // ← Pfad ggf. anpassen
    registerGSC();

// ── Shopify OAuth Handler ──────────────────────────────────────────────────
const axios = require('axios');
let shopifyOAuthServer = null;
let shopifyCallbackWindowId = null;

function startShopifyOAuthServer() {
    if (shopifyOAuthServer) return; // Bereits laufen
    
    shopifyOAuthServer = http.createServer(async (req, res) => {
        const url = new URL(req.url, 'http://localhost:3000');
        
        if (url.pathname === '/shopify-callback') {
            const code = url.searchParams.get('code');
            const shop = url.searchParams.get('shop');
            
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            
            if (!code || !shop) {
                res.end('<h1>❌ Fehler</h1><p>Kein Autorisierungscode erhalten</p>');
                return;
            }
            
            res.end('<h1>✅ Verbunden!</h1><p>Du kannst dieses Fenster jetzt schließen.</p>');
            
            // Verarbeite den Code asynchron
            try {
                // Hole die gespeicherten Credentials
                const { dbApi } = require('../components/api/database');
                const credentialsJson = dbApi.getApiKey('shopify');
                
                if (!credentialsJson) {
                    console.error('[Shopify] Credentials nicht gefunden');
                    return;
                }
                
                let clientId, clientSecret;
                try {
                    const creds = JSON.parse(credentialsJson);
                    clientId = creds.clientId;
                    clientSecret = creds.clientSecret;
                } catch {
                    console.error('[Shopify] Ungültige Credentials');
                    return;
                }
                
                // Tausche Code gegen Access Token
                const tokenResponse = await axios.post(
                    `https://${shop}/admin/oauth/access_token`,
                    {
                        client_id: clientId,
                        client_secret: clientSecret,
                        code: code,
                        grant_type: 'authorization_code',
                        redirect_uri: 'http://localhost:3000/shopify-callback'
                    }
                );
                
                if (tokenResponse.data.access_token) {
                    // Speichere Token in DB
                    const tokenData = {
                        access_token: tokenResponse.data.access_token,
                        store: shop,
                        scope: tokenResponse.data.scope,
                        expires_in: tokenResponse.data.expires_in,
                    };
                    
                    dbApi.saveApiKey('shopify', JSON.stringify(tokenData));
                    console.log('[Shopify] ✅ Access Token gespeichert für', shop);
                    
                    // Sende Nachricht an alle Fenster
                    const { BrowserWindow } = require('electron');
                    BrowserWindow.getAllWindows().forEach(win => {
                        win.webContents.send('shopify:oauth-success', { shop, scope: tokenResponse.data.scope });
                    });
                } else {
                    console.error('[Shopify] Kein Access Token im Response');
                }
            } catch (error) {
                console.error('[Shopify] OAuth Token Exchange Fehler:', error.message);
                BrowserWindow.getAllWindows().forEach(win => {
                    win.webContents.send('shopify:oauth-error', { error: error.message });
                });
            }
        } else {
            res.writeHead(404);
            res.end('Nicht gefunden');
        }
    });
    
    shopifyOAuthServer.listen(3000, 'localhost', () => {
        console.log('[Shopify] OAuth Callback Server läuft auf http://localhost:3000');
    });
    
    shopifyOAuthServer.on('error', (err) => {
        console.error('[Shopify] OAuth Server Fehler:', err);
    });
}
    
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
let splash;
let quitting = false;
let splashShownTime = 0;

function createSplashWindow() {
    splash = new BrowserWindow({
        width: 600,
        height: 400,
        transparent: true,
        frame: false,
        alwaysOnTop: true,
        center: true,
        resizable: false,
        show: false,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
        }
    });
    splash.loadFile(path.join(__dirname, '../../renderer/templates/splash.html'));
    splash.once('ready-to-show', () => {
        splash.show();
        splashShownTime = Date.now();
    });
}

function closeSplashAndShowMain() {
    const splashDuration = 3000; // 3 Sekunden anzeigen
    const elapsedTime = Date.now() - splashShownTime;
    const remainingTime = Math.max(0, splashDuration - elapsedTime);
    
    setTimeout(() => {
        if (splash && !splash.isDestroyed()) {
            splash.close();
            splash = null;
        }
        win.show();
    }, remainingTime);
}

function createWindow() {
    win = new BrowserWindow({
        width: 1500, height: 920, minWidth: 960, minHeight: 640,
        backgroundColor: '#18181b',
        icon: path.join(__dirname, '../../image/LOGO.png'),
        show: false, // Erst zeigen, wenn bereit
        webPreferences: {
            preload: path.join(__dirname, '../preload/preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false
        }
    });
    win.loadFile(path.join(__dirname, '../../renderer/index.html'));
    win.setMenuBarVisibility(false);

    // Sobald das Hauptfenster bereit ist, Splash schließen und Hauptfenster zeigen
    win.once('ready-to-show', () => {
        closeSplashAndShowMain();
    });

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
//  GSC OAuth2 IPC Handler
//  Renderer kann via window.sovereignApi oder direkte ipcRenderer.invoke-Calls
//  den OAuth2-Flow starten und den Callback verarbeiten.
// ════════════════════════════════════════════════════════════════════════════
function registerGSCHandlers() {
    const { shell } = require('electron');

    // Renderer fragt: "Bin ich bereits angemeldet?"
    ipcMain.handle('gsc:isAuthenticated', () => {
        return isGSCAuthenticated();
    });

    // Renderer fragt: "Öffne Google Login"
    ipcMain.handle('gsc:startAuth', async () => {
        try {
            const url = getGSCAuthUrl();
            await shell.openExternal(url);
            return { ok: true };
        } catch (e) {
            console.error('[GSC] Fehler beim Öffnen des Auth-URL:', e.message);
            return { ok: false, error: e.message };
        }
    });

    // Renderer übergibt den OAuth2-Code (z.B. aus Deep-Link oder manuellem Input)
    ipcMain.handle('gsc:exchangeCode', async (_, code) => {
        try {
            const tokens = await exchangeGSCCodeForTokens(code);
            console.log('[GSC] ✅ OAuth2 erfolgreich – Tokens gespeichert');
            return { ok: true, expires_in: tokens.expires_in };
        } catch (e) {
            console.error('[GSC] ❌ Code Exchange fehlgeschlagen:', e.message);
            return { ok: false, error: e.message };
        }
    });

    // Renderer kann Token-Refresh manuell anstoßen (optional)
    ipcMain.handle('gsc:refreshToken', async () => {
        try {
            const success = await refreshGSCTokenIfNeeded();
            return { ok: success };
        } catch (e) {
            console.error('[GSC] ❌ Token Refresh fehlgeschlagen:', e.message);
            return { ok: false, error: e.message };
        }
    });

    // --- Daten-Abfragen ---

    ipcMain.handle('gsc:getSites', async () => {
        try {
            return { ok: true, data: await getGSCSites() };
        } catch (e) {
            return { ok: false, error: e.message };
        }
    });

    ipcMain.handle('gsc:getPerformance', async (_, { siteUrl, startDate, endDate, dimensions }) => {
        try {
            const data = await getGSCSearchPerformance(siteUrl, startDate, endDate, dimensions);
            return { ok: true, data };
        } catch (e) {
            return { ok: false, error: e.message };
        }
    });

    ipcMain.handle('gsc:getSitemaps', async (_, { siteUrl }) => {
        try {
            const data = await getGSCSitemaps(siteUrl);
            return { ok: true, data };
        } catch (e) {
            return { ok: false, error: e.message };
        }
    });

    ipcMain.handle('gsc:inspectUrl', async (_, { siteUrl, inspectionUrl }) => {
        try {
            const data = await inspectGSCUrl(siteUrl, inspectionUrl);
            return { ok: true, data };
        } catch (e) {
            return { ok: false, error: e.message };
        }
    });

    console.log('[Main] ✅ GSC IPC Handler registriert');
}

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
    // ── OAuth Server starten ──────────────────────────────────────
    startShopifyOAuthServer();
    
    // 0. Splash-Screen sofort anzeigen, während die Engine lädt
    createSplashWindow();

    console.log('[Main] App startet...');
    console.log('[Main] appPath:', app.getAppPath());

    // 1. Datenbank-Engine initialisieren (öffnet PGlite als Standard)
    await databaseEngine.initialize();
    console.log('[Main] Datenbank-Engine initialisiert');

    // 2. Settings laden und Remote DB verbinden (BEVOR API startet!)
    // 🔧 WICHTIG: Gespeicherte Settings laden und mit Defaults zusammenführen
    let userSettings = {};
    try {
        if (fs.existsSync(SETTINGS_FILE)) {
            userSettings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
            console.log('[Main] ✅ Gespeicherte Settings aus', SETTINGS_FILE, 'geladen');
        }
    } catch (e) {
        console.error('[Main] Fehler beim Laden der benutzerdefinierten Settings:', e.message);
    }
    
    // Settings zusammenführen: Gespeicherte überschreiben Defaults
    const settings = { ...defaultSettings };
    Object.keys(defaultSettings).forEach(key => {
        if (key === 'database' && userSettings.database) {
            settings.database = { ...defaultSettings.database, ...userSettings.database };
        } else if (key === 'ui' && userSettings.ui) {
            settings.ui = { ...defaultSettings.ui, ...userSettings.ui };
        } else if (key === 'editor' && userSettings.editor) {
            settings.editor = { ...defaultSettings.editor, ...userSettings.editor };
        } else if (userSettings.hasOwnProperty(key)) {
            settings[key] = userSettings[key];
        }
    });
    
    // 🔧 WICHTIG: PostgreSQL Connection aus database.postgresqlConnectionString
    const pgConnectionString = settings.database?.postgresqlConnectionString;
    
    console.log('[Main] Settings zusammengeführt. PostgreSQL Connection:', 
        pgConnectionString ? '✅ vorhanden' : '❌ nicht vorhanden');
    
    let remoteDbConnection = null;
    
    // Prüfe auf aktive PostgreSQL Connection
    // Priorität: 1) database.postgresqlConnectionString, 2) Falls activeType === 'postgresql'
    const isPostgresqlActive = settings.database?.activeType === 'postgresql' && pgConnectionString;
    
    if (isPostgresqlActive) {
        try {
            console.log('[Main] Verbinde Remote PostgreSQL...');
            await databaseEngine.setRemoteDatabase(pgConnectionString);
            remoteDbConnection = pgConnectionString;
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

        // NEU: Recipe Job Handler
        ipcMain.handle('recipe-run-job',    (event, payload) => recipeJobHandler(event, payload));
        ipcMain.handle('recipe-cancel-job', (event, { jobId }) => recipeCancelHandler(event, jobId));
        ipcMain.handle('recipe-commit-draft', (event, payload) => recipeCommitDraftHandler(event, payload));

        // NEU: Web-Tools (direkter Fetch/Search, auch für Debug/Test nutzbar)
        ipcMain.handle('web-fetch',  async (event, { url, keywords }) => toolFetchWebpage({ url, keywords }));
        ipcMain.handle('web-search', async (event, { query })         => toolSearchWeb({ query }));
    } catch (err) {
        console.error('[Main] Fehler bei der Registrierung der IPC Handler:', err.message);
    }

    // 4c. Google Search Console registrieren + IPC Handler
    try {
        registerGSC();          // ← Config in DB + configCache eintragen
        registerGSCHandlers();  // ← IPC Handler für OAuth2-Flow
    } catch (err) {
        console.error('[Main] Fehler bei der GSC-Initialisierung:', err.message);
    }

    // 4d. Automatischer Cleanup-Scheduler
    const scheduler = require('./config/DBMaintenance/scheduler');
    scheduler.start({
        enabled:       true,
        intervalHours: 24,
        rule:          'older_30d',
        vacuum:        true,
        runOnStartup:  false,
    });

    // 5. Fenster erstellen
    createWindow();

    // 6. Progress-Callback für Sync-Engine registrieren
    setupSyncProgress();

    console.log('[Main] ✓ Startup abgeschlossen');
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
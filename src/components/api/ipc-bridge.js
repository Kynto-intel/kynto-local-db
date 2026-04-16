/**
 * ═══════════════════════════════════════════════════════════════
 *  THE SOVEREIGN API-BRIDGE — ipc-bridge.js
 *  Electron IPC: Renderer <-> Main Process Brücke
 * ═══════════════════════════════════════════════════════════════
 */

const { ipcMain, ipcRenderer, contextBridge } = require('electron');
const api = require('./apiHandler');
const { dbApi } = require('./database');

// ═══════════════════════════════════════════════════════════════
//  MAIN PROCESS — IPC Handler registrieren
//  (in main.js aufrufen: require('./ipc-bridge').registerMain())
// ═══════════════════════════════════════════════════════════════
function registerMain() {
  // ── API Calls ──────────────────────────────────────────────
  ipcMain.handle('api:call', async (_, configId, endpoint, params, options) => {
    try {
      return { ok: true, result: await api.call(configId, endpoint, params, options) };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  ipcMain.handle('api:weather', async (_, city, provider) => {
    try { return { ok: true, result: await api.weather(city, provider) }; }
    catch (e) { return { ok: false, error: e.message }; }
  });

  ipcMain.handle('api:search', async (_, query, provider) => {
    try { return { ok: true, result: await api.search(query, provider) }; }
    catch (e) { return { ok: false, error: e.message }; }
  });

  ipcMain.handle('api:news', async (_, query, options) => {
    try { return { ok: true, result: await api.news(query, options) }; }
    catch (e) { return { ok: false, error: e.message }; }
  });

  ipcMain.handle('api:geocode', async (_, address, provider) => {
    try { return { ok: true, result: await api.geocode(address, provider) }; }
    catch (e) { return { ok: false, error: e.message }; }
  });

  ipcMain.handle('api:translate', async (_, text, lang) => {
    try { return { ok: true, result: await api.translate(text, lang) }; }
    catch (e) { return { ok: false, error: e.message }; }
  });

  ipcMain.handle('api:stockQuote', async (_, symbol) => {
    try { return { ok: true, result: await api.stockQuote(symbol) }; }
    catch (e) { return { ok: false, error: e.message }; }
  });

  // ── Verwaltung ─────────────────────────────────────────────
  ipcMain.handle('api:list',        () => api.listApis());
  ipcMain.handle('api:stats',       (_, id) => api.stats(id));
  ipcMain.handle('api:clearCache',  (_, id) => { api.clearCache(id); return true; });
  ipcMain.handle('api:setKey',      (_, id, key) => { api.setApiKey(id, key); return true; });
  ipcMain.handle('api:setRetention', (_, id, rule) => { api.setRetention(id, rule); return true; });
  ipcMain.handle('api:getHistory',  (_, id, ep, limit) => api.getHistory(id, ep, limit));
  ipcMain.handle('api:register',    (_, config) => { api.register(config); return true; });
  ipcMain.handle('api:setMapping',  (_, id, ep, map) => { api.setMapping(id, ep, map); return true; });
}

// ═══════════════════════════════════════════════════════════════
//  PRELOAD — contextBridge für Renderer
//  (in preload.js aufrufen: require('./ipc-bridge').exposeRenderer())
// ═══════════════════════════════════════════════════════════════
function exposeRenderer() {
  contextBridge.exposeInMainWorld('sovereignApi', {
    // Shortcuts
    weather:     (city, provider)             => ipcRenderer.invoke('api:weather', city, provider),
    search:      (query, provider)            => ipcRenderer.invoke('api:search', query, provider),
    news:        (query, options)             => ipcRenderer.invoke('api:news', query, options),
    geocode:     (address, provider)          => ipcRenderer.invoke('api:geocode', address, provider),
    translate:   (text, lang)                 => ipcRenderer.invoke('api:translate', text, lang),
    stockQuote:  (symbol)                     => ipcRenderer.invoke('api:stockQuote', symbol),
    // Generisch
    call:        (id, ep, params, opts)       => ipcRenderer.invoke('api:call', id, ep, params, opts),
    // Verwaltung
    list:        ()                           => ipcRenderer.invoke('api:list'),
    stats:       (id)                         => ipcRenderer.invoke('api:stats', id),
    clearCache:  (id)                         => ipcRenderer.invoke('api:clearCache', id),
    setKey:      (id, key)                    => ipcRenderer.invoke('api:setKey', id, key),
    setRetention:(id, rule)                   => ipcRenderer.invoke('api:setRetention', id, rule),
    getHistory:  (id, ep, limit)              => ipcRenderer.invoke('api:getHistory', id, ep, limit),
    register:    (config)                     => ipcRenderer.invoke('api:register', config),
    setMapping:  (id, ep, map)                => ipcRenderer.invoke('api:setMapping', id, ep, map),
  });
}

module.exports = { registerMain, exposeRenderer };
/* ═══════════════════════════════════════════════════════════════════════
   instant-api-panel.js — Instant API Control Panel
   
   Verwaltet die Konfiguration und Steuerung der PostgREST Instant API
   ═════════════════════════════════════════════════════════════════════ */

class InstantAPIPanel {
  constructor() {
    // Injeziert HTML und Styles dynamisch, um Redundanz in index.html zu vermeiden
    this._injectHTML();
    this._injectStyles();

    // Elements
    this.panel = document.getElementById('api-panel');
    this.closeBtn = document.getElementById('api-panel-close');
    this.statusBtn = document.getElementById('api-btn-instant'); // Wird in index.html definiert
    
    // Status-Elemente
    this.statusIndicator = document.getElementById('api-status-indicator');
    this.statusLabel = document.getElementById('api-status-label');
    this.statusDetail = document.getElementById('api-status-detail');
    this.infoGrid = document.getElementById('api-info-grid');
    
    // Kontroll-Buttons
    this.startBtn = document.getElementById('api-start-btn');
    this.stopBtn = document.getElementById('api-stop-btn');
    this.openBrowserBtn = document.getElementById('api-open-browser');
    
    // Input-Felder
    this.portInput = document.getElementById('api-port-input');
    this.autostartCheck = document.getElementById('api-autostart-check');
    
    // Endpoints
    this.endpointsList = document.getElementById('api-endpoints-list');
    this.endpointCount = document.getElementById('api-endpoint-count');
    
    // Dokumentation Links
    this.docsBtn = document.getElementById('api-docs-button');
    this.schemaBtn = document.getElementById('api-schema-button');
    this.infoBtn = document.getElementById('api-info-button');
    
    // Status
    this.apiRunning = false;
    this.apiUrl = 'http://127.0.0.1:3001';
    this.apiPort = 3001;
    this.connectionString = null;  // Wird vom Main Process gesetzt

    // Event-Listener IMMER binden – Panel muss öffnen/schließen unabhängig von window.api
    this.initEventListeners();

    if (!window.api) {
      console.warn('[API Panel] window.api ist nicht definiert – Panel-Toggle trotzdem aktiv.');
      return;
    }

    this.loadSettings();
    this.getActiveConnectionString();  // Frage Verbindung ab
    this.checkAPIStatus();
    this.startStatusPoller();
  }

  /**
   * Injeziert die HTML-Struktur des Panels direkt in den Body
   */
  _injectHTML() {
    if (document.getElementById('api-panel')) return;
    const aside = document.createElement('aside');
    aside.id = 'api-panel';
    aside.className = 'api-panel';
    aside.innerHTML = `
      <div class="api-panel-header">
        <div class="api-panel-title">
          <span class="api-icon">⚡</span>
          <span>Instant API</span>
        </div>
        <button class="api-close-btn" id="api-panel-close" title="Schließen">✕</button>
      </div>
      <div class="api-panel-content">
        <div class="api-section">
          <h3 class="api-section-title">Status</h3>
          <div class="api-status-box" id="api-status-box">
            <div class="api-status-indicator" id="api-status-indicator">⚫</div>
            <div class="api-status-text">
              <div class="api-status-label" id="api-status-label">Inaktiv</div>
              <div class="api-status-detail" id="api-status-detail">API nicht gestartet</div>
            </div>
          </div>
        </div>
        <div class="api-section">
          <h3 class="api-section-title">Konfiguration</h3>
          <div style="display: flex; flex-direction: column; gap: 10px;">
            <div class="api-form-group">
              <div style="font-size: 10px; color: var(--muted); margin-bottom: 4px; text-transform: uppercase;">Netzwerk Port</div>
              <input type="number" id="api-port-input" class="api-input" value="3001" min="1024" max="65535">
            </div>
            <label class="api-checkbox" style="display: flex; align-items: center; gap: 8px; cursor: pointer; user-select: none;">
              <input type="checkbox" id="api-autostart-check">
              <span style="font-size: 11px; color: var(--muted);">Mit App-Start aktivieren</span>
            </label>
          </div>
        </div>
        <div class="api-section">
          <h3 class="api-section-title">Steuerung</h3>
          <div class="api-button-group">
            <button class="api-btn api-btn-primary" id="api-start-btn">▶ Starten</button>
            <button class="api-btn api-btn-secondary" id="api-stop-btn" disabled>⏹ Stoppen</button>
          </div>
          <button class="api-btn api-btn-outline" id="api-open-browser" style="width: 100%; margin-top: 8px; display: none;">🌐 API im Browser öffnen</button>
        </div>
        <div class="api-section" id="api-info-grid" style="display: none;">
          <h3 class="api-section-title">Verbindungs-Info</h3>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
            <div class="api-endpoint-item">
              <span style="font-size: 9px; opacity: 0.6;">URL</span>
              <code id="api-info-url">-</code>
            </div>
            <div class="api-endpoint-item">
              <span style="font-size: 9px; opacity: 0.6;">Port</span>
              <code id="api-info-port">-</code>
            </div>
          </div>
        </div>
        <div class="api-section">
          <h3 class="api-section-title">
            Endpoints <span id="api-endpoint-count" style="margin-left: auto; background: var(--accent-lo); color: var(--accent); padding: 1px 6px; border-radius: 10px; font-size: 9px;">0</span>
          </h3>
          <div class="api-endpoints-list" id="api-endpoints-list">
            <div class="api-empty-message">API nicht aktiv</div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(aside);
  }

  /**
   * Injeziert das einheitliche Panel-Design (CSS)
   */
  _injectStyles() {
    if (document.getElementById('api-panel-design-styles')) return;
    const style = document.createElement('style');
    style.id = 'api-panel-design-styles';
    style.textContent = `
/* ═══════════════════════════════════════════════════════════════════
   api-panel-design.css  —  Einheitliches Panel-Design für Instant API
   ═══════════════════════════════════════════════════════════════════ */

/* ── Instant API Panel ───────────────────────────────────────────── */
.api-panel {
    position: fixed;
    top: 0; right: 0; bottom: 0;
    width: 380px;
    background: #1c1c20;
    display: flex;
    flex-direction: column;
    z-index: 5000;
    transform: translateX(100%);
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    /* Nutzt zentrale CSS-Variablen aus index.html für 100% Konsistenz */
    box-shadow: var(--panel-shadow);
    border-left: var(--panel-border);
}
.api-panel.open {
    transform: translateX(0);
}

/* Goldene Akzentlinie oben — wie bei allen anderen Panels */
.api-panel::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 2px;
    background: linear-gradient(90deg, transparent 0%, #c29a40 40%, #d4aa50 60%, transparent 100%);
    opacity: 0.7;
    z-index: 1;
    pointer-events: none;
}

.api-panel-header {
    padding: 20px 20px 16px;
    border-bottom: 1px solid rgba(255,255,255,0.07);
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
    background: linear-gradient(180deg, rgba(194,154,64,0.05) 0%, transparent 100%);
}

.api-panel-title {
    display: flex;
    align-items: center;
    gap: 7px;
    font-weight: 700;
    font-size: 10px;
    flex-grow: 1;
    color: var(--accent);
    text-transform: uppercase;
    letter-spacing: 0.15em;
}

.api-icon { font-size: 12px; }

.api-close-btn {
    background: var(--surface2);
    border: 1px solid rgba(255,255,255,0.11);
    color: var(--muted);
    cursor: pointer;
    font-size: 14px;
    padding: 5px 8px;
    border-radius: 5px;
    transition: all 0.15s;
    line-height: 1;
    flex-shrink: 0;
}
.api-close-btn:hover {
    color: var(--text);
    background: var(--surface3);
}

.api-panel-content {
    flex: 1;
    overflow-y: auto;
    padding: 18px;
}
.api-panel-content::-webkit-scrollbar { width: 4px; }
.api-panel-content::-webkit-scrollbar-track { background: transparent; }
.api-panel-content::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.11); border-radius: 4px; }

/* API Sections */
.api-section {
    margin-bottom: 18px;
    padding-bottom: 16px;
    border-bottom: 1px solid rgba(255,255,255,0.07);
}
.api-section:last-child { border-bottom: none; }

.api-section-title {
    font-size: 10px; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.12em;
    color: var(--accent); margin-bottom: 12px;
    display: flex; align-items: center; gap: 6px;
    opacity: 0.9;
}

/* Status Box */
.api-status-box {
    background: var(--surface2);
    border: 1px solid rgba(255,255,255,0.07);
    padding: 12px 14px;
    border-radius: 8px;
    display: flex; gap: 12px; margin-bottom: 12px; align-items: flex-start;
    transition: border-color 0.2s;
}
.api-status-box:hover { border-color: rgba(255,255,255,0.12); }

/* Buttons */
.api-btn {
    background: var(--surface2);
    border: 1px solid rgba(255,255,255,0.07);
    color: var(--text); padding: 8px 12px;
    border-radius: 6px; cursor: pointer; font-size: 12px;
    font-weight: 500; transition: all 0.15s; white-space: nowrap;
    font-family: inherit;
}
.api-btn:hover:not(:disabled) {
    background: rgba(194,154,64,0.1);
    border-color: rgba(194,154,64,0.35);
    color: var(--accent);
}
.api-btn:active:not(:disabled) { transform: scale(0.98); }
.api-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.api-btn-primary {
    background: linear-gradient(135deg, #c29a40, #d4aa50);
    color: #18181b; border: none;
    font-weight: 700;
    box-shadow: 0 2px 14px rgba(194,154,64,0.28);
}
.api-btn-primary:hover:not(:disabled) {
    opacity: 0.9;
    box-shadow: 0 4px 20px rgba(194,154,64,0.38);
    transform: translateY(-1px);
    color: #18181b;
    background: linear-gradient(135deg, #c29a40, #d4aa50);
    border: none;
}

.api-btn-outline {
    border: 1px solid rgba(194,154,64,0.4);
    color: var(--accent);
    background: transparent;
}
.api-btn-outline:hover:not(:disabled) {
    background: rgba(194,154,64,0.1);
    box-shadow: 0 0 10px rgba(194,154,64,0.2);
}

/* Input */
.api-input {
    background: var(--surface2);
    border: 1px solid rgba(255,255,255,0.07);
    color: var(--text); padding: 8px 10px;
    border-radius: 5px; font-size: 12px;
    font-family: 'Cascadia Code','Fira Code','Consolas',monospace;
    transition: border-color 0.15s, box-shadow 0.15s;
    width: 100%;
}
.api-input:focus {
    outline: none;
    border-color: rgba(194,154,64,0.5);
    box-shadow: 0 0 0 2px rgba(194,154,64,0.12);
}

/* Endpoint items */
.api-endpoint-item {
    background: var(--surface2);
    padding: 7px 10px;
    border-radius: 5px;
    border: 1px solid rgba(255,255,255,0.06);
    font-size: 11px; display: flex; flex-direction: column; gap: 2px;
    transition: border-color 0.15s;
}
.api-endpoint-item:hover { border-color: rgba(194,154,64,0.2); }
.api-endpoint-item code {
    font-family: 'Cascadia Code','Fira Code','Consolas',monospace;
    color: var(--accent); word-break: break-all; font-size: 10px;
}

/* API Docs Grid & Cards */
.api-docs-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 8px;
    margin-top: 10px;
}
.api-doc-card {
    background: var(--surface2);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 6px;
    padding: 10px;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    flex-direction: column;
    gap: 4px;
}
.api-doc-card:hover {
    background: rgba(194,154,64,0.08);
    border-color: var(--accent);
}
.api-doc-title {
    font-weight: 700;
    font-size: 11px;
    color: var(--accent);
}
.api-doc-desc {
    font-size: 10px;
    color: var(--muted);
}

/* Features List */
.api-feature-list {
    list-style: none;
    padding: 0;
    margin: 10px 0 0;
    font-size: 10px;
    color: var(--muted);
    line-height: 1.5;
}
.api-feature-list li {
    padding: 3px 0;
    display: flex;
    gap: 6px;
}
    `;
    document.head.appendChild(style);
  }

  /**
   * Hole den aktiven Connection String vom Main Process
   */
  async getActiveConnectionString() {
    try {
      // Der Main Process sendet den aktuellen aktiven connection string
      if (window.api && typeof window.api.dbStatus === 'function') {
        const status = await window.api.dbStatus();
        if (status && status.remoteConnectionString) {
          this.connectionString = status.remoteConnectionString;
          console.log('[API Panel] Connection String:', this.connectionString.substring(0, 30) + '...');
        }
      }
    } catch (err) {
      console.warn('[API Panel] Fehler beim Abrufen des Connection Strings:', err.message);
    }
  }

  /**
   * Initialisiere Event-Listener
   */
  initEventListeners() {
    // Header-Toggle-Button öffnet/schließt das Panel
    if (this.statusBtn) {
      this.statusBtn.addEventListener('click', () => this.togglePanel());
    }

    // Panel schließen
    if (this.closeBtn) {
      this.closeBtn.addEventListener('click', () => this.closePanel());
    }

    // API Control
    if (this.startBtn) {
      this.startBtn.addEventListener('click', () => this.startAPI());
    }
    if (this.stopBtn) {
      this.stopBtn.addEventListener('click', () => this.stopAPI());
    }
    
    if (this.openBrowserBtn) {
      this.openBrowserBtn.addEventListener('click', () => this.openInBrowser());
    }

    // Konfiguration
    if (this.portInput) {
      this.portInput.addEventListener('change', () => this.updatePort());
    }
    if (this.autostartCheck) {
      this.autostartCheck.addEventListener('change', () => this.toggleAutostart());
    }

    // Dokumentation
    if (this.docsBtn) {
      this.docsBtn.addEventListener('click', () => this.openDocumentation('docs'));
    }
    if (this.schemaBtn) {
      this.schemaBtn.addEventListener('click', () => this.openDocumentation('schema'));
    }
    if (this.infoBtn) {
      this.infoBtn.addEventListener('click', () => this.openDocumentation('info'));
    }

    // Keyboard: ESC schließt Panel
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.panel?.classList.contains('open')) {
        this.closePanel();
      }
    });
  }

  /**
   * Lade gespeicherte Einstellungen aus localStorage
   */
  loadSettings() {
    try {
      const settings = JSON.parse(localStorage.getItem('kynto-api-settings') || '{}');
      
      if (settings.port && this.portInput) {
        this.portInput.value = settings.port;
        this.apiPort = settings.port;
        this.apiUrl = `http://127.0.0.1:${settings.port}`;
      }
      
      if (settings.autostart !== undefined && this.autostartCheck) {
        this.autostartCheck.checked = settings.autostart;
      }
    } catch (err) {
      console.warn('[API Panel] Settings load error:', err.message);
    }
  }

  /**
   * Speichere Einstellungen
   */
  saveSettings() {
    const settings = {
      port: this.portInput ? parseInt(this.portInput.value, 10) : this.apiPort,
      autostart: this.autostartCheck ? this.autostartCheck.checked : false,
      lastUpdated: new Date().toISOString()
    };
    
    localStorage.setItem('kynto-api-settings', JSON.stringify(settings));
  }

  /**
   * Prüfe API-Status (mit Timeout)
   */
  async checkAPIStatus() {
    try {
      // Erstelle AbortController für Timeout nach 2 Sekunden
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      
      const response = await fetch(`${this.apiUrl}/`, {
        signal: controller.signal,
        method: 'HEAD'  // HEAD Request ist schneller
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        this.setAPIRunning(true);
        await this.loadEndpoints();
      } else {
        this.setAPIRunning(false);
      }
    } catch (err) {
      // Connection refused, timeout, oder anderer Fehler - das ist ok, Server läuft eben nicht
      // Nicht gelogt, um Console sauber zu halten
      this.setAPIRunning(false);
    }
  }

  /**
   * Starte API
   */
  async startAPI() {
    try {
      this.startBtn.disabled = true;
      this.startBtn.textContent = '⏳ Starte...';
      this.updateStatus('connecting', 'Verbinde...', 'API wird gestartet');

      // Hole aktuelle Connection String falls nicht vorhanden
      if (!this.connectionString) {
        await this.getActiveConnectionString();
      }

      if (!this.connectionString) {
        this.updateStatus('error', 'Fehler', 'Keine Datenbankverbindung aktiv');
        this.startBtn.disabled = false;
        this.startBtn.textContent = '▶ Starten';
        return;
      }

      // Sende Signal an Main-Prozess über IPC
      if (window.api && typeof window.api.instantApiStart === 'function') {
        const result = await window.api.instantApiStart(this.connectionString, this.apiPort);
        
        if (result && result.success) {
          this.apiUrl = result.url;
          this.apiPort = result.port;
          
          // Warte bis API verfügbar ist
          await this.waitForAPI(5000);
          
          this.setAPIRunning(true);
          if (this.openBrowserBtn) {
            this.openBrowserBtn.style.display = 'block';
          }
          await this.loadEndpoints();
          
          this.updateStatus('running', 'Aktiv', `Läuft auf Port ${this.apiPort}`);
        } else {
          this.updateStatus('error', 'Fehler', result?.error || 'API-Start fehlgeschlagen');
        }
      } else {
        console.warn('[API Panel] window.api.instantApiStart nicht verfügbar');
        this.updateStatus('error', 'Fehler', 'Hauptprozess nicht erreichbar');
      }
    } catch (err) {
      this.updateStatus('error', 'Fehler', err.message);
      console.error('[API Panel] Start error:', err);
    } finally {
      this.startBtn.disabled = false;
      this.startBtn.textContent = '▶ Starten';
    }
  }

  /**
   * Stoppe API
   */
  async stopAPI() {
    try {
      this.stopBtn.disabled = true;
      this.stopBtn.textContent = '⏳ Stoppe...';
      this.updateStatus('stopping', 'Werden gestoppt...', 'API wird beendet');

      // Sende Signal an Main-Prozess
      if (window.api && typeof window.api.instantApiStop === 'function') {
        await window.api.instantApiStop(this.connectionString || 'postgresql://localhost:5432');
      }

      this.setAPIRunning(false);
      if (this.openBrowserBtn) {
        this.openBrowserBtn.style.display = 'none';
      }
      this.updateStatus('stopped', 'Inaktiv', 'API wurde gestoppt');
      this.clearEndpoints();
    } catch (err) {
      this.updateStatus('error', 'Fehler', err.message);
      console.error('[API Panel] Stop error:', err);
    } finally {
      this.stopBtn.disabled = false;
      this.stopBtn.textContent = '⏹ Stoppen';
    }
  }

  /**
   * Warte bis API verfügbar ist
   */
  waitForAPI(timeout = 5000) {
    return new Promise((resolve) => {
      const startTime = Date.now();
      
      const checkAPI = async () => {
        try {
          const response = await fetch(`${this.apiUrl}/`);
          if (response.ok) {
            resolve(true);
            return;
          }
        } catch (err) {
          // Retry
        }

        if (Date.now() - startTime < timeout) {
          setTimeout(checkAPI, 300);
        } else {
          resolve(false);
        }
      };

      checkAPI();
    });
  }

  /**
   * Lade verfügbare Endpoints
   */
  async loadEndpoints() {
    try {
      // Fetch direkt vom API Server - holt echte Daten mit counts!
      const response = await fetch(`${this.apiUrl}/api/schema`);
      const schemaData = await response.json();
      
      if (schemaData.schema && schemaData.schema.length > 0) {
        this.displayEndpointsWithData(schemaData.schema);
        if (this.endpointCount) {
          this.endpointCount.textContent = schemaData.schema.length;
        }
      } else {
        this.endpointsList.innerHTML = `
          <div class="api-empty-message">
            Keine Tabellen verfügbar
          </div>
        `;
      }
    } catch (err) {
      console.warn('[API Panel] Load endpoints error:', err.message);
    }
  }

  /**
   * Zeige Endpoints MIT echten Daten (Counts, Spalten, etc)
   */
  displayEndpointsWithData(tablesInfo) {
    this.endpointsList.innerHTML = '';
    
    for (const table of tablesInfo) {
      const tableDiv = document.createElement('div');
      tableDiv.className = 'api-endpoint-group';
      
      // Tabellenkopf mit Eintrag-Count
      const headerDiv = document.createElement('div');
      headerDiv.className = 'api-endpoint-method';
      headerDiv.innerHTML = `📊 ${table.name} <span style="font-size: 12px; opacity: 0.7;">(${table.count} Einträge)</span>`;
      tableDiv.appendChild(headerDiv);
      
      // Spalten-Info
      const columnsDiv = document.createElement('div');
      columnsDiv.style.cssText = 'font-size: 12px; opacity: 0.8; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.1); margin-bottom: 8px;';
      const columnNames = table.columns.map(c => c.name).slice(0, 8).join(', ');
      const moreColumns = table.columns.length > 8 ? ` +${table.columns.length - 8}` : '';
      columnsDiv.textContent = `📄 Spalten: ${columnNames}${moreColumns}`;
      tableDiv.appendChild(columnsDiv);
      
      // Endpoints für diese Tabelle
      const methodColors = { GET: '🟢', POST: '🔵', PUT: '🟠', PATCH: '🟡', DELETE: '🔴' };
      
      for (const endpoint of table.endpoints) {
        const epDiv = document.createElement('div');
        epDiv.className = 'api-endpoint-item';
        epDiv.style.cssText = 'padding: 6px 8px; border-left: 2px solid rgba(255,255,255,0.3);';
        
        const methodColor = methodColors[endpoint.method] || '⚪';
        const fullUrl = `${this.apiUrl}${endpoint.path}`;
        
        epDiv.innerHTML = `
          <div style="display: flex; gap: 8px; align-items: center;">
            <span>${methodColor} ${endpoint.method}</span>
            <code style="flex: 1; font-size: 11px; opacity: 0.9;">${endpoint.path}</code>
            <button class="api-test-btn" data-url="${fullUrl}" style="font-size: 10px; padding: 2px 6px; cursor: pointer; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 3px; color: #fff;">Test</button>
          </div>
        `;
        
        epDiv.querySelector('.api-test-btn').addEventListener('click', (e) => {
          this.testEndpoint(e.target.getAttribute('data-url'), endpoint.method);
        });
        
        tableDiv.appendChild(epDiv);
      }
      
      this.endpointsList.appendChild(tableDiv);
    }
  }

  /**
   * Teste einen API-Endpoint
   */
  async testEndpoint(url, method) {
    try {
      const options = { method };
      const response = await fetch(url, options);
      const data = await response.json();
      
      // Zeige Ergebnis in Alert
      const resultText = typeof data === 'object' ? JSON.stringify(data, null, 2) : data;
      alert(`${method} ${url}\n\n${resultText.substring(0, 500)}...`);
    } catch (err) {
      alert(`Fehler: ${err.message}`);
    }
  }

  /**
   * Zeige Endpoints an
   */
  displayEndpoints(endpoints) {
    if (this.endpointCount) {
      this.endpointCount.textContent = endpoints.length;
    }
    
    const grouped = {};
    
    for (const ep of endpoints) {
      if (!grouped[ep.method]) {
        grouped[ep.method] = [];
      }
      grouped[ep.method].push(ep);
    }

    let html = '';
    const methodColors = { GET: '🟢', POST: '🔵', PATCH: '🟠', DELETE: '🔴' };
    
    for (const [method, eps] of Object.entries(grouped)) {
      html += `<div class="api-endpoint-group">
        <div class="api-endpoint-method">${methodColors[method] || '⚪'} ${method}</div>`;
      
      for (const ep of eps.slice(0, 5)) { // Zeige max 5 pro Method
        const shortPath = ep.path.length > 40 ? ep.path.substring(0, 37) + '...' : ep.path;
        html += `
          <div class="api-endpoint-item" title="${ep.path}">
            <code>${shortPath}</code>
            <span class="api-endpoint-desc">${ep.description || ''}</span>
          </div>`;
      }
      
      if (eps.length > 5) {
        html += `<div class="api-endpoint-more">... und ${eps.length - 5} weitere</div>`;
      }
      
      html += '</div>';
    }

    this.endpointsList.innerHTML = html;
  }

  /**
   * Leere Endpoints-Liste
   */
  clearEndpoints() {
    if (this.endpointCount) {
      this.endpointCount.textContent = '0';
    }
    this.endpointsList.innerHTML = `
      <div class="api-empty-message">
        API nicht aktiv. Starten Sie zuerst die API um verfügbare Endpoints zu sehen.
      </div>
    `;
  }

  /**
   * Aktualisiere Status-Anzeige
   */
  updateStatus(status, label, detail) {
    const statusMap = {
      running: { icon: '🟢', color: '#4caf7d' },
      stopped: { icon: '⚫', color: '#7a7a8c' },
      connecting: { icon: '🟡', color: '#c29a40' },
      stopping: { icon: '🟡', color: '#c29a40' },
      error: { icon: '🔴', color: '#e05555' },
    };

    const statusInfo = statusMap[status] || statusMap.stopped;
    
    if (this.statusIndicator) {
      this.statusIndicator.textContent = statusInfo.icon;
      this.statusIndicator.style.color = statusInfo.color;
    }
    if (this.statusLabel) this.statusLabel.textContent = label;
    if (this.statusDetail) this.statusDetail.textContent = detail;

    if (status === 'running' && this.infoGrid) {
      this.infoGrid.style.display = 'grid';
      const urlEl = document.getElementById('api-info-url');
      const portEl = document.getElementById('api-info-port');
      if (urlEl) urlEl.textContent = this.apiUrl;
      if (portEl) portEl.textContent = this.apiPort;
    } else if (this.infoGrid) {
      this.infoGrid.style.display = 'none';
    }
  }

  /**
   * Setze API-Running Status
   */
  setAPIRunning(running) {
    this.apiRunning = running;
    if (this.startBtn) this.startBtn.disabled = running;
    if (this.stopBtn) this.stopBtn.disabled = !running;
    
    if (running) {
      this.updateStatus('running', 'Aktiv', `Läuft auf Port ${this.apiPort}`);
    } else {
      this.updateStatus('stopped', 'Inaktiv', 'API nicht gestartet');
    }
  }

  /**
   * Aktualisiere Port
   */
  updatePort() {
    if (!this.portInput) return;
    const newPort = parseInt(this.portInput.value, 10);
    
    if (newPort >= 1024 && newPort <= 65535) {
      this.apiPort = newPort;
      this.apiUrl = `http://127.0.0.1:${newPort}`;
      this.saveSettings();
      this.updateStatus('info', 'Port-Änderung', `Neuer Port: ${newPort} (Neustart erforderlich)`);
    } else {
      this.portInput.value = this.apiPort;
    }
  }

  /**
   * Schalte Autostart um
   */
  toggleAutostart() {
    this.saveSettings();
  }

  /**
   * Öffne API im Browser
   */
  openInBrowser() {
    if (window.api && typeof window.api.instantApiOpenBrowser === 'function') {
      window.api.instantApiOpenBrowser(this.apiUrl);
    } else {
      window.open(this.apiUrl, '_blank');
    }
  }

  /**
   * Öffne API Dokumentation
   */
  openDocumentation(type = 'docs') {
    let url;
    
    switch(type) {
      case 'docs':
        url = `${this.apiUrl}/api/docs`;
        break;
      case 'schema':
        url = `${this.apiUrl}/api/schema`;
        break;
      case 'info':
        url = `${this.apiUrl}/api/info`;
        break;
      default:
        url = `${this.apiUrl}/api/docs`;
    }
    
    if (window.api && typeof window.api.instantApiOpenBrowser === 'function') {
      window.api.instantApiOpenBrowser(url);
    } else {
      window.open(url, '_blank');
    }
  }

  /**
   * Öffne Swagger/OpenAPI Dokumentation
   */
  /**
   * Öffne/Schließe Panel
   */
  openPanel() {
    this.panel?.classList.add('open');
    // Nutzt die einheitliche Header-Logik aus index.html
    if (typeof window.setHeaderBtnActive === 'function') {
      window.setHeaderBtnActive('api-btn-instant', true);
    }
  }

  closePanel() {
    this.panel?.classList.remove('open');
    if (typeof window.setHeaderBtnActive === 'function') {
      window.setHeaderBtnActive('api-btn-instant', false);
    }
  }

  refreshState() {
    this.getActiveConnectionString();
    this.checkAPIStatus();
  }

  togglePanel() {
    if (this.panel?.classList.contains('open')) {
      this.closePanel();
    } else {
      this.openPanel();
      this.refreshState?.();
    }
  }

  /**
   * Starten Sie Status-Poller (aktualisiere alle 5 Sekunden)
   */
  startStatusPoller() {
    setInterval(() => {
      if (this.apiRunning) {
        this.checkAPIStatus().catch(() => {
          // Stille Fehler, um Konsole nicht zu überlasten
        });
      }
    }, 5000);
  }

  /**
   * Exportiere API-Status für Debugging
   */
  getStatus() {
    return {
      running: this.apiRunning,
      url: this.apiUrl,
      port: this.apiPort,
      autostart: this.autostartCheck ? this.autostartCheck.checked : false,
    };
  }
}

// Initialisiere Panel beim Document-Ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.instantAPIPanel = new InstantAPIPanel();
  });
} else {
  window.instantAPIPanel = new InstantAPIPanel();
}

// Exportiere für externe Nutzung
if (typeof module !== 'undefined' && module.exports) {
  module.exports = InstantAPIPanel;
}
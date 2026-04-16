/**
 * ═══════════════════════════════════════════════════════════════
 *  Kynto Intel — renderer/modules/settings-api-tab.js
 *
 *  NEU: GSC Daten-Export Button + Modal
 *       - Daten-Typ wählen (Performance, Sitemaps, Sites, …)
 *       - Neue Tabelle erstellen ODER bestehende Tabelle wählen
 *       - JSON-Datei in data/ speichern
 *       - Datenbank-Export via PGlite
 *
 *  Einbinden in settings.js (Renderer) mit:
 *    import { initApiSettingsTab } from './settings-api-tab.js';
 *    initApiSettingsTab();
 * ═══════════════════════════════════════════════════════════════
 */

// ─── API-Definitionen ────────────────────────────────────────────
const API_GROUPS = [
    {
        label: '🌤️ Wetter',
        category: 'weather',
        apis: [
            { id: 'openweathermap',  name: 'OpenWeatherMap',              keyHint: 'API Key von openweathermap.org',   free: false },
            { id: 'weatherapi',      name: 'WeatherAPI.com',              keyHint: 'API Key von weatherapi.com',       free: false },
            { id: 'open-meteo',      name: 'Open-Meteo',                  keyHint: 'Kein Key nötig — 100% kostenlos',  free: true  },
        ]
    },
    {
        label: '🔍 Suche',
        category: 'search',
        apis: [
            { id: 'bing-search',          name: 'Bing Web Search',        keyHint: 'Azure Cognitive Services Key',     free: false },
            { id: 'google-custom-search', name: 'Google Custom Search',   keyHint: 'Google API Key (+ cx= Engine ID)', free: false },
        ]
    },
    {
        label: '🗺️ Karten',
        category: 'maps',
        apis: [
            { id: 'google-maps',             name: 'Google Maps',             keyHint: 'Google Maps Platform API Key',  free: false },
            { id: 'openstreetmap-nominatim', name: 'OpenStreetMap Nominatim', keyHint: 'Kein Key nötig — kostenlos',   free: true  },
        ]
    },
    {
        label: '📰 News',
        category: 'news',
        apis: [
            { id: 'newsapi', name: 'NewsAPI.org', keyHint: 'API Key von newsapi.org', free: false },
        ]
    },
    {
        label: '📈 Finanzen',
        category: 'finance',
        apis: [
            { id: 'alpha-vantage', name: 'Alpha Vantage (Aktien/Krypto)', keyHint: 'API Key von alphavantage.co', free: false },
        ]
    },

    {
        label: '📧 Mail',
        category: 'mail',
        apis: [
            { id: 'gmail',    name: 'Gmail (OAuth2)', keyHint: 'OAuth2 Access Token', free: false },
            { id: 'sendgrid', name: 'SendGrid',       keyHint: 'SendGrid API Key',    free: false },
        ]
    },
    {
        label: '📅 Kalender',
        category: 'calendar',
        apis: [
            { id: 'google-calendar', name: 'Google Calendar (OAuth2)', keyHint: 'OAuth2 Access Token', free: false },
        ]
    },
    {
        label: '🛒 E-Commerce',
        category: 'ecommerce',
        apis: [
            { id: 'shopify', name: 'Shopify', keyHint: 'OAuth2: Store-URL + App API Key/Secret', free: false },
        ]
    },
    {
        label: '💻 Developer',
        category: 'developer',
        apis: [
            { id: 'github', name: 'GitHub API', keyHint: 'GitHub Personal Access Token', free: true },
        ]
    },
    {
        label: '📊 SEO',
        category: 'seo',
        apis: [
            {
                id:      'google-search-console',
                name:    'Google Search Console',
                keyHint: 'OAuth2 — klicke "Konto verbinden" um dich bei Google anzumelden',
                free:    false,
                isOAuth: true,
            },
            { id: 'google-keyword-planner', name: 'Google Keyword Planner', keyHint: 'OAuth2 Access Token (Google Ads API — Developer-Token zusätzlich nötig)', free: false },
            { id: 'dataforseo',             name: 'DataForSEO',             keyHint: 'login:password (z.B. user@mail.com:deinPasswort — Basic Auth)',           free: false },
            { id: 'google-trends',          name: 'Google Trends (SerpAPI)', keyHint: 'SerpAPI Key von serpapi.com',                                             free: false },
        ]
    },
];

// ─── GSC Daten-Typen ─────────────────────────────────────────────
const GSC_DATA_TYPES = [
    { value: 'performance',   label: '📈 Search Performance (Queries, Pages, CTR, Position)' },
    { value: 'device',        label: '📱 Performance nach Gerät (Desktop / Mobile / Tablet)' },
    { value: 'discover',      label: '🔭 Discover / News Performance' },
    { value: 'sitemaps',      label: '🗺️ Sitemaps (eingereichte URLs, Index-Status)' },
    { value: 'sites',         label: '🌐 Verifizierte Websites (Berechtigungen)' },
    { value: 'urlInspection', label: '🔍 URL Inspection (Index, Mobile, AMP, Rich Results)' },
];

// ─── Globaler State ──────────────────────────────────────────────
let _statsCache    = null;
let _keyStates     = {};
let _retentionData = {};

// ─── IPC-Hilfsfunktion ───────────────────────────────────────────
async function ipc(channel, ...args) {
    const fn = window.api?.[channel];
    if (fn) {
        const res = await fn(...args);
        if (res && !res.ok) throw new Error(res.error || channel + ' fehlgeschlagen');
        return res?.result ?? res;
    }
    const res2 = await window.electron?.ipcRenderer?.invoke(channel, ...args);
    if (res2 && !res2.ok) throw new Error(res2.error || channel + ' fehlgeschlagen');
    return res2?.result ?? res2;
}

// ─── HTML generieren ─────────────────────────────────────────────
function buildTabHtml() {
    return `
<div class="api-settings-root">

  <!-- Header: Global-Stats -->
  <div class="api-stats-bar" id="apiStatsBar">
    <div class="api-stat"><span class="api-stat-val" id="apiStatApis">–</span><span class="api-stat-lbl">Aktive APIs</span></div>
    <div class="api-stat"><span class="api-stat-val" id="apiStatCached">–</span><span class="api-stat-lbl">Gecachte Responses</span></div>
    <div class="api-stat"><span class="api-stat-val" id="apiStatHits">–</span><span class="api-stat-lbl">Cache-Hits</span></div>
    <div class="api-stat green"><span class="api-stat-val" id="apiStatSaved">–</span><span class="api-stat-lbl">Kosten gespart</span></div>
    <button class="api-btn-ghost" id="apiBtnClearAll" title="Gesamten Cache leeren">🗑 Cache leeren</button>
  </div>

  <!-- Zwei-Spalten-Layout -->
  <div class="api-layout">

    <!-- Linke Spalte: API-Gruppen -->
    <div class="api-group-list" id="apiGroupList">
      ${API_GROUPS.map(g => `
        <div class="api-group-section">
          <div class="api-group-header">${g.label}</div>
          ${g.apis.map(a => `
            <div class="api-group-item" data-id="${a.id}" data-name="${a.name}">
              <span class="api-item-name">${a.name}</span>
              ${a.free
                ? '<span class="api-badge free">Kostenlos</span>'
                : '<span class="api-key-dot" id="keyDot_' + a.id + '">○</span>'}
            </div>
          `).join('')}
        </div>
      `).join('')}
    </div>

    <!-- Rechte Spalte: Detail-Panel -->
    <div class="api-detail-panel" id="apiDetailPanel">
      <div class="api-detail-placeholder">
        <div class="api-placeholder-icon">🔌</div>
        <div class="api-placeholder-text">API auswählen um Details anzuzeigen</div>
      </div>
    </div>

  </div>
</div>

<!-- ═══════════════════════════════════════════════════════════════
     GSC EXPORT MODAL
═══════════════════════════════════════════════════════════════ -->
<div id="gscExportModal" class="gsc-modal-overlay" style="display:none">
  <div class="gsc-modal-box">

    <div class="gsc-modal-header">
      <span class="gsc-modal-title">📊 GSC Daten exportieren</span>
      <button class="gsc-modal-close" id="gscModalClose">✕</button>
    </div>

    <div class="gsc-modal-body">

      <!-- Schritt 1: Daten-Typ -->
      <div class="gsc-section">
        <label class="gsc-label">1. Daten-Typ</label>
        <select class="gsc-select" id="gscDataType">
          ${GSC_DATA_TYPES.map(t => `<option value="${t.value}">${t.label}</option>`).join('')}
        </select>
      </div>

      <!-- Schritt 2: Parameter (nur bei performance/device/discover/urlInspection) -->
      <div class="gsc-section" id="gscParamSection">
        <label class="gsc-label">2. Parameter</label>

        <div class="gsc-param-row">
          <label class="gsc-param-label">Website URL</label>
          <input class="gsc-input" id="gscSiteUrl" placeholder="https://example.com/" />
        </div>

        <div class="gsc-param-row" id="gscDateRow">
          <label class="gsc-param-label">Zeitraum</label>
          <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
            <input type="date" class="gsc-input gsc-date-input" id="gscStartDate" />
            <span style="color:var(--muted,#71717a);white-space:nowrap">bis</span>
            <input type="date" class="gsc-input gsc-date-input" id="gscEndDate" />
            <button class="api-btn-ghost gsc-preset" data-days="7" style="font-size:10px;padding:4px 8px;">7T</button>
            <button class="api-btn-ghost gsc-preset" data-days="28" style="font-size:10px;padding:4px 8px;">28T</button>
            <button class="api-btn-ghost gsc-preset" data-days="90" style="font-size:10px;padding:4px 8px;">90T</button>
          </div>
        </div>

        <div class="gsc-param-row" id="gscInspectRow" style="display:none">
          <label class="gsc-param-label">Zu prüfende URL</label>
          <input class="gsc-input" id="gscInspectUrl" placeholder="https://example.com/seite" />
        </div>
      </div>

      <!-- Schritt 3: Vorschau -->
      <div class="gsc-section">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
          <label class="gsc-label" style="margin:0">3. Daten-Vorschau</label>
          <button class="api-btn-test" id="gscBtnFetch">▶ Daten abrufen</button>
        </div>
        <div id="gscPreviewStatus" class="gsc-status"></div>
        <div id="gscPreviewTable" class="gsc-preview-wrap" style="display:none"></div>
      </div>

      <!-- Schritt 4: Export-Ziel -->
      <div class="gsc-section" id="gscExportTarget" style="display:none">
        <label class="gsc-label">4. Export-Ziel</label>

        <!-- Modus: Neue Tabelle / Bestehende Tabelle -->
        <div class="gsc-radio-row">
          <label class="gsc-radio-label">
            <input type="radio" name="gscMode" value="new" checked /> Neue Tabelle erstellen
          </label>
          <label class="gsc-radio-label">
            <input type="radio" name="gscMode" value="append" /> In bestehende Tabelle einfügen
          </label>
          <label class="gsc-radio-label">
            <input type="radio" name="gscMode" value="replace" /> Bestehende Tabelle ersetzen
          </label>
        </div>

        <!-- Neue Tabelle: Name eingeben -->
        <div id="gscNewTableWrap" class="gsc-param-row">
          <label class="gsc-param-label">Tabellenname</label>
          <input class="gsc-input" id="gscNewTableName" placeholder="gsc_performance" />
        </div>

        <!-- Bestehende Tabelle: Select -->
        <div id="gscExistTableWrap" class="gsc-param-row" style="display:none">
          <label class="gsc-param-label">Tabelle wählen</label>
          <select class="gsc-select" id="gscExistTable">
            <option value="">— wird geladen —</option>
          </select>
        </div>

        <!-- Schema-Vorschau -->
        <div id="gscSchemaInfo" class="gsc-schema-info"></div>

        <!-- Export-Aktionen -->
        <div class="gsc-export-actions">
          <button class="api-btn-save" id="gscBtnExportDb">💾 In Datenbank exportieren</button>
          <button class="api-btn-ghost" id="gscBtnExportJson">📄 Als JSON speichern</button>
        </div>

        <div id="gscExportStatus" class="gsc-status" style="margin-top:8px"></div>
      </div>

    </div>
  </div>
</div>

<!-- ═══════════════════════════════════════════════════════════════
     SHOPIFY EXPORT MODAL
═══════════════════════════════════════════════════════════════ -->
<div id="shopifyExportModal" class="gsc-modal-overlay" style="display:none">
  <div class="gsc-modal-box">

    <div class="gsc-modal-header">
      <span class="gsc-modal-title">🛍️ Shopify Daten exportieren</span>
      <button class="gsc-modal-close" id="shopifyModalClose">✕</button>
    </div>

    <div class="gsc-modal-body">

      <!-- Schritt 1: Authentifizierung -->
      <div class="gsc-section">
        <label class="gsc-label">1. Verbindung mit Shopify</label>
        
        <div class="gsc-param-row">
          <label class="gsc-param-label">Shop-Domain</label>
          <input class="gsc-input" id="shopifyDomain" placeholder="z.B. mein-shop.myshopify.com" />
        </div>
        
        <div class="gsc-param-row">
          <button class="api-btn-save" id="shopifyBtnConnect" style="width:100%">🔗 Mit Shopify verbinden (OAuth)</button>
        </div>
        <div id="shopifyAuthStatus" class="gsc-status"></div>
      </div>

      <!-- Schritt 2: Daten-Typ -->
      <div class="gsc-section">
        <label class="gsc-label">2. Daten-Typ</label>
        <select class="gsc-select" id="shopifyDataType">
          <option value="products">📦 Produkte</option>
          <option value="orders">📋 Bestellungen</option>
          <option value="customers">👥 Kunden</option>
        </select>
      </div>

      <!-- Schritt 3: Filter -->
      <div class="gsc-section">
        <label class="gsc-label">3. Filter (optional)</label>
        <div class="gsc-param-row">
          <label class="gsc-param-label">Max. Einträge</label>
          <input type="number" class="gsc-input" id="shopifyLimit" value="250" min="1" max="250" />
        </div>
      </div>

      <!-- Schritt 4: Vorschau -->
      <div class="gsc-section">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
          <label class="gsc-label" style="margin:0">4. Daten-Vorschau</label>
          <button class="api-btn-test" id="shopifyBtnFetch">▶ Daten abrufen</button>
        </div>
        <div id="shopifyPreviewStatus" class="gsc-status"></div>
        <div id="shopifyPreviewTable" class="gsc-preview-wrap" style="display:none"></div>
      </div>

      <!-- Schritt 5: Export-Ziel -->
      <div class="gsc-section" id="shopifyExportTarget" style="display:none">
        <label class="gsc-label">5. Export-Ziel</label>

        <div class="gsc-radio-row">
          <label class="gsc-radio-label">
            <input type="radio" name="shopifyMode" value="new" checked /> Neue Tabelle
          </label>
          <label class="gsc-radio-label">
            <input type="radio" name="shopifyMode" value="append" /> An bestehende anfügen
          </label>
          <label class="gsc-radio-label">
            <input type="radio" name="shopifyMode" value="replace" /> Tabelle ersetzen
          </label>
        </div>

        <div id="shopifyNewTableWrap" class="gsc-param-row">
          <label class="gsc-param-label">Tabellenname</label>
          <input class="gsc-input" id="shopifyNewTableName" placeholder="shopify_products" />
        </div>

        <div id="shopifyExistTableWrap" class="gsc-param-row" style="display:none">
          <label class="gsc-param-label">Tabelle wählen</label>
          <select class="gsc-select" id="shopifyExistTable">
            <option value="">— wird geladen —</option>
          </select>
        </div>

        <div id="shopifySchemaInfo" class="gsc-schema-info"></div>

        <div class="gsc-export-actions">
          <button class="api-btn-save" id="shopifyBtnExportDb">💾 In Datenbank exportieren</button>
          <button class="api-btn-ghost" id="shopifyBtnExportJson">📄 Als JSON speichern</button>
        </div>

        <div id="shopifyExportStatus" class="gsc-status" style="margin-top:8px"></div>
      </div>

    </div>
  </div>
</div>`;
}

function buildDetailHtml(api, hasKey, retention) {
    const r = retention || { mode: 'ttl', ttl_hours: 24, auto_archive: false };
    const isGSC = api.id === 'google-search-console';
    const isShopify = api.id === 'shopify';
    return `
<div class="api-detail-content" data-id="${api.id}">

  <div class="api-detail-title">
    <span class="api-detail-name">${api.name}</span>
    ${api.free
        ? '<span class="api-badge free">Kein API Key nötig</span>'
        : (hasKey
            ? '<span class="api-badge active">Key gespeichert ✓</span>'
            : '<span class="api-badge missing">Kein Key</span>')}
  </div>

  ${!api.free ? `
  <!-- API Key / OAuth -->
  <div class="api-form-section">
    <label class="api-form-label">${api.isOAuth ? 'Authentifizierung' : 'API Anmeldedaten'}</label>
    <div class="api-key-row">
      ${isShopify ? `
        <div style="display:flex;flex-direction:column;gap:8px;width:100%">
          <input type="text" class="api-key-input" id="keyInput_${api.id}_clientId" placeholder="Client ID (aus Dev Dashboard)" autocomplete="off" />
          <input type="password" class="api-key-input" id="keyInput_${api.id}_clientSecret" placeholder="Client Secret (aus Dev Dashboard)" autocomplete="off" />
          <button class="api-btn-save" id="btnSave_${api.id}">Speichern</button>
          ${hasKey ? `<button class="api-btn-del" id="btnDel_${api.id}">Löschen</button>` : ''}
        </div>
      ` : (api.isOAuth ? `
        <button class="api-btn-save" id="btnConnect_${api.id}">🔗 Konto verbinden (OAuth2)</button>
        ${hasKey ? `<span class="api-badge active" style="margin-left:8px">Verbunden ✓</span>` : ''}
      ` : `
      <input type="password" class="api-key-input" id="keyInput_${api.id}" placeholder="${api.keyHint}" autocomplete="off" />
      <button class="api-btn-eye" id="btnEye_${api.id}" title="Key anzeigen/verbergen">👁</button>
      <button class="api-btn-save" id="btnSave_${api.id}">Speichern</button>
      `)}
      ${hasKey && !isShopify ? `<button class="api-btn-del" id="btnDel_${api.id}">Löschen</button>` : ''}
    </div>
    <div class="api-key-hint">${isShopify ? 'Finde diese im Shopify Dev Dashboard unter deiner App-Einstellung' : api.keyHint}</div>
  </div>
  ` : `
  <div class="api-form-section">
    <div class="api-free-note">✅ Diese API benötigt keinen Schlüssel und ist kostenlos nutzbar.</div>
  </div>
  `}

  ${isGSC && hasKey ? `
  <!-- GSC Export -->
  <div class="api-form-section gsc-export-section">
    <label class="api-form-label">Daten exportieren</label>
    <div class="gsc-export-info">
      Importiere GSC-Daten direkt in deine Datenbank oder speichere sie als JSON-Datei.
    </div>
    <button class="api-btn-export" id="btnGscExport_${api.id}">
      📊 Daten exportieren / importieren
    </button>
  </div>
  ` : (isGSC && !hasKey ? `
  <div class="api-form-section">
    <div class="gsc-export-info gsc-export-info--warning">
      ⚠️ Bitte verbinde dein Google-Konto zuerst, um Daten exportieren zu können.
    </div>
  </div>
  ` : '')}

  ${isShopify && hasKey ? `
  <!-- Shopify Export -->
  <div class="api-form-section gsc-export-section">
    <label class="api-form-label">Daten exportieren</label>
    <div class="gsc-export-info">
      Importiere Shopify-Daten (Produkte, Bestellungen, Kunden) in deine Datenbank.
    </div>
    <button class="api-btn-export" id="btnShopifyExport_${api.id}">
      🛍️ Daten exportieren / importieren
    </button>
  </div>
  ` : (isShopify && !hasKey ? `
  <div class="api-form-section">
    <div class="gsc-export-info gsc-export-info--warning">
      ⚠️ Bitte speichere deine Client ID und Client Secret zuerst, um Daten exportieren zu können.
    </div>
  </div>
  ` : '')}

  <!-- Cache / Retention -->
  <div class="api-form-section">
    <label class="api-form-label">Cache & Speicher-Strategie</label>
    <div class="api-retention-row">
      <select class="api-select" id="retMode_${api.id}">
        <option value="ttl"       ${r.mode === 'ttl'       ? 'selected' : ''}>TTL — nach Zeit löschen</option>
        <option value="permanent" ${r.mode === 'permanent' ? 'selected' : ''}>Permanent — nie löschen</option>
        <option value="disabled"  ${r.mode === 'disabled'  ? 'selected' : ''}>Deaktiviert — kein Cache</option>
      </select>
      <div id="ttlWrap_${api.id}" style="${r.mode !== 'ttl' ? 'display:none' : ''}">
        <input type="number" class="api-input-small" id="retTTL_${api.id}" value="${r.ttl_hours}" min="0.1" step="0.5" />
        <span class="api-unit">Stunden</span>
      </div>
    </div>
    <label class="api-checkbox-row">
      <input type="checkbox" id="retArchive_${api.id}" ${r.auto_archive ? 'checked' : ''} />
      <span>Historisches Archiv aufbauen (Zeitreihe)</span>
    </label>
  </div>

  <!-- Cache-Info & Aktionen -->
  <div class="api-form-section">
    <label class="api-form-label">Cache</label>
    <div class="api-cache-info" id="cacheInfo_${api.id}">Wird geladen…</div>
    <div class="api-btn-row">
      <button class="api-btn-save" id="btnSaveRetention_${api.id}">Einstellungen speichern</button>
      <button class="api-btn-ghost" id="btnClearCache_${api.id}">🗑 Cache leeren</button>
    </div>
  </div>

  <!-- Quick-Test -->
  <div class="api-form-section">
    <label class="api-form-label">Verbindungstest</label>
    <button class="api-btn-test" id="btnTest_${api.id}">▶ Test ausführen</button>
    <pre class="api-test-output" id="testOutput_${api.id}"></pre>
  </div>

</div>`;
}

// ─── Styles ──────────────────────────────────────────────────────
function injectStyles() {
    if (document.getElementById('kynto-api-styles')) return;
    const style = document.createElement('style');
    style.id = 'kynto-api-styles';
    style.textContent = `
/* ── Root ── */
.api-settings-root { display:flex; flex-direction:column; height:100%; gap:12px; font-size:13px; color:var(--text,#e2e2e2); }

/* ── Stats Bar ── */
.api-stats-bar { display:flex; align-items:center; gap:20px; padding:10px 16px; background:var(--bg2,#27272a); border-radius:8px; flex-shrink:0; }
.api-stat { display:flex; flex-direction:column; align-items:center; gap:2px; }
.api-stat-val { font-size:18px; font-weight:700; color:var(--text,#e2e2e2); }
.api-stat-lbl { font-size:10px; color:var(--muted,#71717a); text-transform:uppercase; letter-spacing:.5px; }
.api-stat.green .api-stat-val { color:#22c55e; }
.api-stats-bar .api-btn-ghost { margin-left:auto; }

/* ── Layout ── */
.api-layout { display:flex; gap:12px; flex:1; min-height:0; overflow:hidden; }
.api-group-list { width:210px; flex-shrink:0; overflow-y:auto; display:flex; flex-direction:column; gap:4px; padding-right:4px; }
.api-detail-panel { flex:1; overflow-y:auto; background:var(--bg2,#27272a); border-radius:8px; padding:16px; }

/* ── Group List ── */
.api-group-section { margin-bottom:6px; }
.api-group-header { font-size:11px; color:var(--muted,#71717a); text-transform:uppercase; letter-spacing:.6px; padding:4px 8px 2px; }
.api-group-item { display:flex; align-items:center; justify-content:space-between; padding:6px 10px; border-radius:6px; cursor:pointer; transition:background .15s; gap:6px; }
.api-group-item:hover { background:var(--hover,#3f3f46); }
.api-group-item.active { background:var(--accent,#3b82f6)22; border-left:2px solid var(--accent,#3b82f6); }
.api-item-name { flex:1; font-size:12px; }
.api-key-dot { font-size:14px; color:var(--muted,#71717a); }
.api-key-dot.has-key { color:#22c55e; }

/* ── Badges ── */
.api-badge { font-size:10px; padding:2px 6px; border-radius:4px; font-weight:600; letter-spacing:.3px; }
.api-badge.free   { background:#16a34a22; color:#22c55e; }
.api-badge.active { background:#16a34a22; color:#22c55e; }
.api-badge.missing{ background:#dc262622; color:#f87171; }

/* ── Placeholder ── */
.api-detail-placeholder { display:flex; flex-direction:column; align-items:center; justify-content:center; height:200px; gap:12px; opacity:.4; }
.api-placeholder-icon { font-size:40px; }
.api-placeholder-text { font-size:13px; }

/* ── Detail Content ── */
.api-detail-title { display:flex; align-items:center; gap:10px; margin-bottom:16px; padding-bottom:12px; border-bottom:1px solid var(--border,#3f3f46); }
.api-detail-name { font-size:16px; font-weight:600; }
.api-form-section { margin-bottom:16px; }
.api-form-label { display:block; font-size:11px; color:var(--muted,#71717a); text-transform:uppercase; letter-spacing:.5px; margin-bottom:6px; }
.api-free-note { font-size:12px; color:#22c55e; padding:8px 12px; background:#16a34a11; border-radius:6px; }

/* ── Key Input ── */
.api-key-row { display:flex; gap:6px; align-items:center; }
.api-key-input { flex:1; padding:7px 10px; background:var(--bg,#18181b); border:1px solid var(--border,#3f3f46); border-radius:6px; color:var(--text,#e2e2e2); font-size:12px; font-family:monospace; outline:none; }
.api-key-input:focus { border-color:var(--accent,#3b82f6); }
.api-key-hint { font-size:11px; color:var(--muted,#71717a); margin-top:4px; }

/* ── Retention ── */
.api-retention-row { display:flex; gap:8px; align-items:center; margin-bottom:8px; }
.api-select { padding:6px 10px; background:var(--bg,#18181b); border:1px solid var(--border,#3f3f46); border-radius:6px; color:var(--text,#e2e2e2); font-size:12px; outline:none; }
.api-input-small { width:72px; padding:6px 8px; background:var(--bg,#18181b); border:1px solid var(--border,#3f3f46); border-radius:6px; color:var(--text,#e2e2e2); font-size:12px; outline:none; text-align:center; }
.api-unit { font-size:12px; color:var(--muted,#71717a); }
.api-checkbox-row { display:flex; align-items:center; gap:8px; font-size:12px; cursor:pointer; }
.api-checkbox-row input { cursor:pointer; accent-color:var(--accent,#3b82f6); }

/* ── Cache Info ── */
.api-cache-info { font-size:12px; color:var(--muted,#71717a); margin-bottom:8px; padding:6px 10px; background:var(--bg,#18181b); border-radius:6px; }

/* ── Buttons ── */
.api-btn-row { display:flex; gap:6px; }
.api-btn-save  { padding:6px 14px; background:var(--accent,#3b82f6); color:#fff; border:none; border-radius:6px; font-size:12px; cursor:pointer; transition:opacity .15s; }
.api-btn-save:hover { opacity:.85; }
.api-btn-del   { padding:6px 12px; background:#dc262622; color:#f87171; border:1px solid #dc262633; border-radius:6px; font-size:12px; cursor:pointer; }
.api-btn-del:hover { background:#dc262633; }
.api-btn-ghost { padding:5px 12px; background:transparent; border:1px solid var(--border,#3f3f46); color:var(--muted,#71717a); border-radius:6px; font-size:12px; cursor:pointer; }
.api-btn-ghost:hover { border-color:var(--text,#e2e2e2); color:var(--text,#e2e2e2); }
.api-btn-eye   { padding:6px 10px; background:transparent; border:1px solid var(--border,#3f3f46); border-radius:6px; font-size:13px; cursor:pointer; }
.api-btn-test  { padding:6px 16px; background:#22c55e22; color:#22c55e; border:1px solid #22c55e33; border-radius:6px; font-size:12px; cursor:pointer; }
.api-btn-test:hover { background:#22c55e33; }

/* ── Test Output ── */
.api-test-output { display:none; margin-top:10px; padding:10px; background:var(--bg,#18181b); border-radius:6px; font-size:11px; color:#a1a1aa; white-space:pre-wrap; word-break:break-all; max-height:200px; overflow-y:auto; }
.api-test-output.visible { display:block; }
.api-test-output.error { color:#f87171; }

/* ══════════════════════════════════════════════
   GSC EXPORT BUTTON & SEKTION
══════════════════════════════════════════════ */
.gsc-export-section { background:var(--bg,#18181b); border:1px solid var(--accent,#3b82f6)44; border-radius:8px; padding:12px 14px; }
.gsc-export-info { font-size:12px; color:var(--muted,#71717a); margin-bottom:10px; line-height:1.5; }
.gsc-export-info--warning { color:#f59e0b; background:#f59e0b11; padding:8px 10px; border-radius:6px; }
.api-btn-export { padding:8px 18px; background:linear-gradient(135deg,var(--accent,#3b82f6),#8b5cf6); color:#fff; border:none; border-radius:7px; font-size:13px; cursor:pointer; font-weight:600; transition:opacity .15s; }
.api-btn-export:hover { opacity:.85; }

/* ══════════════════════════════════════════════
   GSC EXPORT MODAL
══════════════════════════════════════════════ */
.gsc-modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,.7); z-index:10001; display:flex; align-items:center; justify-content:center; }
.gsc-modal-box { background:var(--bg2,#27272a); border:1px solid var(--border,#3f3f46); border-radius:12px; width:520px; max-width:92vw; max-height:75vh; display:flex; flex-direction:column; box-shadow:0 20px 60px #0009; }
.gsc-modal-header { display:flex; align-items:center; justify-content:space-between; padding:12px 16px 10px; border-bottom:1px solid var(--border,#3f3f46); flex-shrink:0; }
.gsc-modal-title { font-size:14px; font-weight:700; color:var(--text,#e2e2e2); }
.gsc-modal-close { background:none; border:none; font-size:16px; color:var(--muted,#71717a); cursor:pointer; padding:2px 6px; border-radius:4px; }
.gsc-modal-close:hover { color:var(--text,#e2e2e2); background:var(--hover,#3f3f46); }
.gsc-modal-body { overflow-y:auto; padding:12px 14px 14px; display:flex; flex-direction:column; gap:11px; }
.gsc-section { display:flex; flex-direction:column; gap:5px; }
.gsc-label { font-size:10px; color:var(--muted,#71717a); text-transform:uppercase; letter-spacing:.4px; font-weight:600; }
.gsc-select { padding:6px 8px; background:var(--bg,#18181b); border:1px solid var(--border,#3f3f46); border-radius:6px; color:var(--text,#e2e2e2); font-size:11px; outline:none; width:100%; }
.gsc-input { padding:6px 8px; background:var(--bg,#18181b); border:1px solid var(--border,#3f3f46); border-radius:6px; color:var(--text,#e2e2e2); font-size:11px; outline:none; width:100%; }
.gsc-date-input { width:130px !important; flex-shrink:0; }
.gsc-input:focus, .gsc-select:focus { border-color:var(--accent,#3b82f6); }
.gsc-param-row { display:flex; flex-direction:column; gap:3px; }
.gsc-param-label { font-size:10px; color:var(--muted,#71717a); }
.gsc-preset { padding:3px 8px; font-size:10px; }
.gsc-status { font-size:11px; padding:6px 8px; border-radius:6px; background:var(--bg,#18181b); color:var(--muted,#71717a); }
.gsc-status.ok    { color:#22c55e; background:#16a34a11; }
.gsc-status.error { color:#f87171; background:#dc262611; }
.gsc-status.loading { color:#f59e0b; }

/* Tabellen-Vorschau */
.gsc-preview-wrap { overflow-x:auto; max-height:120px; border:1px solid var(--border,#3f3f46); border-radius:6px; }
.gsc-preview-table { width:100%; border-collapse:collapse; font-size:10px; }
.gsc-preview-table th { background:var(--bg,#18181b); padding:4px 6px; text-align:left; color:var(--muted,#71717a); font-weight:600; border-bottom:1px solid var(--border,#3f3f46); white-space:nowrap; position:sticky; top:0; }
.gsc-preview-table td { padding:3px 6px; border-bottom:1px solid var(--border,#3f3f46)44; white-space:nowrap; max-width:150px; overflow:hidden; text-overflow:ellipsis; }
.gsc-preview-table tr:last-child td { border-bottom:none; }
.gsc-preview-table tr:hover td { background:var(--hover,#3f3f46)44; }

/* Radio-Gruppe */
.gsc-radio-row { display:flex; gap:12px; flex-wrap:wrap; margin-bottom:6px; }
.gsc-radio-label { display:flex; align-items:center; gap:5px; font-size:11px; cursor:pointer; }
.gsc-radio-label input { accent-color:var(--accent,#3b82f6); cursor:pointer; }

/* Schema Info */
.gsc-schema-info { font-size:10px; color:var(--muted,#71717a); padding:6px 8px; background:var(--bg,#18181b); border-radius:6px; line-height:1.6; }

/* Export Aktionen */
.gsc-export-actions { display:flex; gap:6px; margin-top:8px; }
    `;
    document.head.appendChild(style);
}

// ─── Toast ───────────────────────────────────────────────────────
function toast(msg, type = 'success') {
    if (typeof window.showToast === 'function') { window.showToast(msg, type); return; }
    if (typeof window.toast   === 'function') { window.toast(msg, type); return; }
    const t = document.createElement('div');
    t.style.cssText = `position:fixed;bottom:24px;right:24px;padding:10px 18px;border-radius:8px;font-size:13px;z-index:9999;
      background:${type === 'error' ? '#dc2626' : type === 'warn' ? '#d97706' : '#22c55e'};color:#fff;box-shadow:0 4px 16px #0006;`;
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3000);
}

// ─── Custom Input Modal ──────────────────────────────────────────
async function showInputModal(message, placeholder = '') {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:10002;display:flex;align-items:center;justify-content:center;`;

        const box = document.createElement('div');
        box.style.cssText = `background:var(--bg2,#27272a);padding:20px;border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,.5);width:420px;max-width:90vw;color:var(--text,#e2e2e2);font-size:13px;`;

        const msg = document.createElement('p');
        msg.textContent = message;
        msg.style.cssText = 'margin-bottom:15px;line-height:1.5;white-space:pre-line;';

        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = placeholder;
        input.style.cssText = 'width:100%;padding:8px 10px;margin-bottom:15px;background:var(--bg,#18181b);border:1px solid var(--border,#3f3f46);border-radius:6px;color:var(--text,#e2e2e2);font-size:12px;outline:none;';

        const btns = document.createElement('div');
        btns.style.cssText = 'display:flex;justify-content:flex-end;gap:10px;';

        const cancel  = document.createElement('button'); cancel.textContent = 'Abbrechen'; cancel.className = 'api-btn-ghost';
        const confirm = document.createElement('button'); confirm.textContent = 'Bestätigen'; confirm.className = 'api-btn-save';

        cancel.onclick  = () => { document.body.removeChild(overlay); resolve(null); };
        confirm.onclick = () => { document.body.removeChild(overlay); resolve(input.value); };
        input.addEventListener('keydown', e => { if (e.key === 'Enter') confirm.click(); });

        btns.append(cancel, confirm);
        box.append(msg, input, btns);
        overlay.appendChild(box);
        document.body.appendChild(overlay);
        input.focus();
    });
}

// ════════════════════════════════════════════════════════════════
//  SHOPIFY EXPORT MODAL LOGIK
// ════════════════════════════════════════════════════════════════

let _shopifyFetchedRows   = null;
let _shopifyFetchedSchema = null;

const SHOPIFY_DATA_TYPES = [
  { value: 'products',  label: '📦 Produkte' },
  { value: 'orders',    label: '📋 Bestellungen' },
  { value: 'customers', label: '👥 Kunden' },
];



function openShopifyExportModal() {
    const modal = document.getElementById('shopifyExportModal');
    if (!modal) {
        console.error('[Shopify] Modal nicht gefunden');
        return;
    }

    modal.style.display = 'flex';
    _shopifyFetchedRows   = null;
    _shopifyFetchedSchema = null;

    document.getElementById('shopifyPreviewTable').style.display = 'none';
    document.getElementById('shopifyExportTarget').style.display = 'none';

    // Lade gespeicherte Shop-Domain
    (async () => {
        try {
            const domainField = document.getElementById('shopifyDomain');
            const connectBtn = document.getElementById('shopifyBtnConnect');
            
            if (!domainField) return;
            
            // Versuche Domain aus dem Handler zu laden
            const res = await window.api.apiBridge_getShopifyDomain?.();
            
            if (res?.ok && res.result) {
                // Domain wurde gefunden
                domainField.value = res.result;
                domainField.disabled = true;
                connectBtn.textContent = '✓ Bereits verbunden';
                connectBtn.disabled = true;
                console.log('[Shopify] Domain geladen:', res.result);
            } else {
                // Keine Domain gefunden - User muss eingeben
                domainField.value = '';
                domainField.disabled = false;
                connectBtn.textContent = '🔗 Mit Shopify verbinden (OAuth)';
                connectBtn.disabled = false;
            }
        } catch (e) {
            console.log('[Shopify Modal] Konnte Domain nicht laden:', e.message);
        }
    })();

    // Connect Button
    document.getElementById('shopifyBtnConnect').onclick = () => _shopifyConnect();

    // Fetch Button
    document.getElementById('shopifyBtnFetch').onclick = () => _shopifyFetchData();

    // Export Button
    document.getElementById('shopifyBtnExportDb').onclick = () => _shopifyExportToDb();

    // JSON Export
    document.getElementById('shopifyBtnExportJson').onclick = () => _shopifyExportToJson();

    // Mode Change
    document.querySelectorAll('input[name="shopifyMode"]').forEach(radio => {
        radio.onchange = () => _shopifyOnModeChange(radio.value);
    });

    // Close
    document.getElementById('shopifyModalClose').onclick = () => { modal.style.display = 'none'; };
    modal.onclick = (e) => { if (e.target === modal) modal.style.display = 'none'; };
}

async function _shopifyConnect() {
    const domain = document.getElementById('shopifyDomain').value.trim();
    
    if (!domain) { 
        _setStatus('shopifyAuthStatus', '❌ Shop-Domain erforderlich', 'error'); 
        return; 
    }
    
    // Validiere Shop-Domain Format
    if (!domain.includes('.myshopify.com')) {
        _setStatus('shopifyAuthStatus', '❌ Ungültige Domain (muss .myshopify.com enthalten)', 'error'); 
        return;
    }
    
    _setStatus('shopifyAuthStatus', '⏳ Leite zu Shopify weiter…', 'loading');
    
    try {
        // Starte OAuth-Flow im Electron Main Process
        const res = await window.api.apiBridge_startShopifyOAuth({ domain });
        
        if (res?.ok) {
            _setStatus('shopifyAuthStatus', '✅ Browser öffnet sich - gib der App Zugriff', 'ok');
            // Nach OAuth-Callback wird der Token gespeichert
        } else {
            _setStatus('shopifyAuthStatus', '❌ ' + (res?.error || 'OAuth-Fehler'), 'error');
        }
    } catch (e) {
        _setStatus('shopifyAuthStatus', '❌ ' + e.message, 'error');
    }
}

async function _shopifyFetchData() {
    const btn = document.getElementById('shopifyBtnFetch');
    btn.disabled = true;
    btn.textContent = '⏳ Laden…';
    _setStatus('shopifyPreviewStatus', 'Lade Daten…', 'loading');
    
    try {
        const payload = {
            dataType: document.getElementById('shopifyDataType').value,
            limit: parseInt(document.getElementById('shopifyLimit').value) || 250,
        };

        const res = await window.api.shopify_fetchData?.(payload)
                 ?? await window.electron?.ipcRenderer?.invoke('shopify:fetchData', payload);

        if (!res?.ok) throw new Error(res?.error || 'Fehler');

        _shopifyFetchedRows   = res.rows;
        _shopifyFetchedSchema = res.schema;

        _setStatus('shopifyPreviewStatus', `✅ ${res.count} Datensätze`, 'ok');
        _renderPreviewTable(res.rows, res.schema);

        document.getElementById('shopifyExportTarget').style.display = '';
        document.getElementById('shopifySchemaInfo').innerHTML = _renderSchemaInfo(res.schema);

        const nameInput = document.getElementById('shopifyNewTableName');
        if (!nameInput.value) {
            nameInput.value = 'shopify_' + payload.dataType + '_' + new Date().toISOString().slice(0, 10).replace(/-/g, '');
        }

    } catch (e) {
        _setStatus('shopifyPreviewStatus', '❌ ' + e.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = '▶ Daten abrufen';
    }
}

async function _shopifyExportToDb() {
    if (!_shopifyFetchedRows?.length) { toast('Bitte zuerst Daten abrufen', 'error'); return; }

    const mode = document.querySelector('input[name="shopifyMode"]:checked')?.value || 'new';
    const tableName = mode === 'new' || mode === 'replace'
        ? document.getElementById('shopifyNewTableName').value.trim()
        : document.getElementById('shopifyExistTable').value;

    if (!tableName) { toast('Tabellenname erforderlich', 'error'); return; }

    const btn = document.getElementById('shopifyBtnExportDb');
    btn.disabled = true;
    btn.textContent = '⏳ Exportiere…';
    _setStatus('shopifyExportStatus', 'Exportiere zu Datenbank…', 'loading');

    try {
        const dataType = document.getElementById('shopifyDataType').value;
        
        const res = await window.api.shopify_exportToDb?.({
            rows: _shopifyFetchedRows,
            tableName,
            mode,
            schema: _shopifyFetchedSchema,
            dataType
        }) ?? await window.electron?.ipcRenderer?.invoke('shopify:exportToDb', {
            rows: _shopifyFetchedRows,
            tableName,
            mode,
            schema: _shopifyFetchedSchema,
            dataType
        });

        if (res?.ok) {
            _setStatus('shopifyExportStatus', `✅ ${res.inserted} Zeilen in "${tableName}" gespeichert`, 'ok');
            toast(`✅ Erfolgreich exportiert: ${res.inserted} Zeilen`, 'success');
        } else {
            throw new Error(res?.error || 'Export fehlgeschlagen');
        }
    } catch (e) {
        _setStatus('shopifyExportStatus', '❌ ' + e.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = '💾 In Datenbank exportieren';
    }
}

async function _shopifyExportToJson() {
    if (!_shopifyFetchedRows?.length) { toast('Bitte zuerst Daten abrufen', 'error'); return; }
    
    const filename = 'shopify_' + document.getElementById('shopifyDataType').value + '_' + 
                     new Date().toISOString().slice(0, 10) + '.json';
    const blob = new Blob([JSON.stringify(_shopifyFetchedRows, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast(`✅ ${filename} heruntergeladen`, 'success');
}

function _shopifyOnModeChange(mode) {
    const newWrap = document.getElementById('shopifyNewTableWrap');
    const existWrap = document.getElementById('shopifyExistTableWrap');
    
    if (mode === 'new' || mode === 'replace') {
        newWrap.style.display = '';
        existWrap.style.display = 'none';
    } else {
        newWrap.style.display = 'none';
        existWrap.style.display = '';
        _loadShopifyExistingTables();
    }
}

async function _loadShopifyExistingTables() {
    try {
        const res = await window.api.shopify_getTables?.() ?? await window.electron?.ipcRenderer?.invoke('shopify:getTables');
        const tables = res?.tables || [];
        const sel = document.getElementById('shopifyExistTable');
        sel.innerHTML = tables.length
            ? tables.map(t => `<option value="${t}">${t}</option>`).join('')
            : '<option value="">Keine Tabellen gefunden</option>';
    } catch (e) {
        console.error('[Shopify] Tabellen laden fehlgeschlagen:', e);
    }
}

// ════════════════════════════════════════════════════════════════
//  GSC EXPORT MODAL LOGIK
// ════════════════════════════════════════════════════════════════

let _gscFetchedRows   = null;
let _gscFetchedSchema = null;

function openGscExportModal() {
    const modal = document.getElementById('gscExportModal');
    if (!modal) return;

    // Datum-Defaults setzen (28 Tage)
    _setDatePreset(28);

    modal.style.display = 'flex';
    _gscFetchedRows   = null;
    _gscFetchedSchema = null;

    // Status zurücksetzen
    _setStatus('gscPreviewStatus', '');
    _setStatus('gscExportStatus', '');
    document.getElementById('gscPreviewTable').style.display = 'none';
    document.getElementById('gscExportTarget').style.display = 'none';

    // Daten-Typ Change Handler
    const typeSelect = document.getElementById('gscDataType');
    typeSelect.onchange = () => _updateParamVisibility(typeSelect.value);
    _updateParamVisibility(typeSelect.value);

    // Datum Preset Buttons - direkt im Modal suchen und binden
    const presetBtns = modal.querySelectorAll('.gsc-preset');
    console.log('[GSC] Gefundene Preset-Buttons:', presetBtns.length);
    
    presetBtns.forEach((btn, idx) => {
        const days = parseInt(btn.dataset.days);
        console.log(`[GSC] Button ${idx}:`, { days, text: btn.textContent, hasDataDays: !!btn.dataset.days });
        
        // Neuen Listener hinzufügen
        btn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('[GSC] ✅✅ Preset-Button geklickt - days:', days);
            _setDatePreset(days);
        };
    });

    // Modus Radio: Neue / Bestehende Tabelle
    document.querySelectorAll('input[name="gscMode"]').forEach(radio => {
        radio.onchange = () => _onModeChange(radio.value);
    });

    // Daten abrufen
    document.getElementById('gscBtnFetch').onclick = _fetchGscData;

    // DB Export
    document.getElementById('gscBtnExportDb').onclick = _exportToDb;

    // JSON speichern
    document.getElementById('gscBtnExportJson').onclick = _exportToJson;

    // Modal schließen
    document.getElementById('gscModalClose').onclick = () => { modal.style.display = 'none'; };
    modal.onclick = (e) => { if (e.target === modal) modal.style.display = 'none'; };
}

function _updateParamVisibility(dataType) {
    const dateRow    = document.getElementById('gscDateRow');
    const inspectRow = document.getElementById('gscInspectRow');
    if (dataType === 'urlInspection') {
        if (dateRow)    dateRow.style.display    = 'none';
        if (inspectRow) inspectRow.style.display = '';
    } else if (dataType === 'sites') {
        if (dateRow)    dateRow.style.display    = 'none';
        if (inspectRow) inspectRow.style.display = 'none';
    } else {
        if (dateRow)    dateRow.style.display    = '';
        if (inspectRow) inspectRow.style.display = 'none';
    }
}

function _setDatePreset(days) {
    const end   = new Date();
    const start = new Date(); start.setDate(end.getDate() - days);
    const fmt   = d => d.toISOString().slice(0, 10);
    const s = document.getElementById('gscStartDate');
    const e = document.getElementById('gscEndDate');
    
    const startStr = fmt(start);
    const endStr = fmt(end);
    
    console.log('[GSC] _setDatePreset aufgerufen:', { 
        days, 
        startDate: startStr, 
        endDate: endStr,
        foundStartInput: !!s,
        foundEndInput: !!e
    });
    
    if (s) {
        s.value = startStr;
        s.dispatchEvent(new Event('change', { bubbles: true }));
        console.log('[GSC] ✓ Start-Datum gesetzt auf:', s.value);
    } else {
        console.warn('[GSC] ⚠ gscStartDate Input nicht gefunden!');
    }
    if (e) {
        e.value = endStr;
        e.dispatchEvent(new Event('change', { bubbles: true }));
        console.log('[GSC] ✓ End-Datum gesetzt auf:', e.value);
    } else {
        console.warn('[GSC] ⚠ gscEndDate Input nicht gefunden!');
    }
}

async function _onModeChange(mode) {
    const newWrap    = document.getElementById('gscNewTableWrap');
    const existWrap  = document.getElementById('gscExistTableWrap');
    const schemaInfo = document.getElementById('gscSchemaInfo');

    if (mode === 'new') {
        if (newWrap)   newWrap.style.display   = '';
        if (existWrap) existWrap.style.display = 'none';
        if (schemaInfo) schemaInfo.innerHTML   = _renderSchemaInfo(_gscFetchedSchema);
    } else {
        if (newWrap)   newWrap.style.display   = 'none';
        if (existWrap) existWrap.style.display = '';
        // Tabellen laden
        try {
            const res = await window.api.gsc_getTables?.() ?? await window.electron?.ipcRenderer?.invoke('gsc:getTables');
            const tables = res?.tables || [];
            const sel = document.getElementById('gscExistTable');
            sel.innerHTML = tables.length
                ? tables.map(t => `<option value="${t}">${t}</option>`).join('')
                : '<option value="">Keine Tabellen gefunden</option>';

            // Spalten der gewählten Tabelle zeigen
            sel.onchange = async () => {
                if (!sel.value) return;
                const colRes = await window.api.gsc_getTableColumns?.(sel.value) ?? await window.electron?.ipcRenderer?.invoke('gsc:getTableColumns', sel.value);
                const cols = colRes?.columns || [];
                if (schemaInfo) schemaInfo.innerHTML = `<strong>Spalten in "${sel.value}":</strong><br>` +
                    cols.map(c => `<span style="color:var(--text,#e2e2e2)">${c.name}</span> <span style="color:var(--muted,#71717a)">(${c.type})</span>`).join(' · ');
            };
            if (tables.length) sel.dispatchEvent(new Event('change'));
        } catch (e) {
            if (schemaInfo) schemaInfo.textContent = 'Tabellen konnten nicht geladen werden: ' + e.message;
        }
    }
}

async function _fetchGscData() {
    const btn = document.getElementById('gscBtnFetch');
    btn.disabled = true;
    btn.textContent = '⏳ Abrufen…';
    _setStatus('gscPreviewStatus', 'Rufe Daten von Google Search Console ab…', 'loading');
    document.getElementById('gscPreviewTable').style.display = 'none';
    document.getElementById('gscExportTarget').style.display = 'none';

    try {
        const payload = {
            dataType:      document.getElementById('gscDataType').value,
            siteUrl:       document.getElementById('gscSiteUrl').value.trim(),
            startDate:     document.getElementById('gscStartDate').value,
            endDate:       document.getElementById('gscEndDate').value,
            inspectionUrl: document.getElementById('gscInspectUrl').value.trim(),
        };

        // Validiere Datumswerte
        if (payload.startDate && payload.endDate) {
            const start = new Date(payload.startDate);
            const end = new Date(payload.endDate);
            console.log('[GSC] Datums-Validierung:', { 
                startDate: payload.startDate, 
                endDate: payload.endDate, 
                startMs: start.getTime(),
                endMs: end.getTime(),
                isValid: start < end 
            });
            if (start > end) {
                throw new Error(`Ungültiger Zeitraum: Start-Datum (${payload.startDate}) muss vor End-Datum (${payload.endDate}) liegen`);
            }
        }

        if (!payload.siteUrl && payload.dataType !== 'sites') {
            throw new Error('Bitte Website-URL eingeben (z.B. https://example.com/)');
        }

        const res = await window.api.gsc_fetchData?.(payload)
                 ?? await window.electron?.ipcRenderer?.invoke('gsc:fetchData', payload);

        if (!res?.ok) throw new Error(res?.error || 'Unbekannter Fehler');

        _gscFetchedRows   = res.rows;
        _gscFetchedSchema = res.schema;

        _setStatus('gscPreviewStatus', `✅ ${res.count} Datensätze abgerufen`, 'ok');

        // Vorschau-Tabelle rendern
        _renderPreviewTable(res.rows, res.schema);

        // Export-Bereich einblenden
        document.getElementById('gscExportTarget').style.display = '';
        document.getElementById('gscSchemaInfo').innerHTML = _renderSchemaInfo(res.schema);

        // Standard-Tabellenname vorschlagen
        const nameInput = document.getElementById('gscNewTableName');
        if (nameInput && !nameInput.value) {
            nameInput.value = 'gsc_' + payload.dataType + '_' + new Date().toISOString().slice(0, 10).replace(/-/g, '');
        }

    } catch (e) {
        _setStatus('gscPreviewStatus', '❌ ' + e.message, 'error');
    } finally {
        btn.disabled    = false;
        btn.textContent = '▶ Daten abrufen';
    }
}

async function _exportToDb() {
    if (!_gscFetchedRows?.length) { toast('Bitte zuerst Daten abrufen', 'error'); return; }

    const mode = document.querySelector('input[name="gscMode"]:checked')?.value || 'new';
    const tableName = mode === 'new' || mode === 'replace'
        ? document.getElementById('gscNewTableName').value.trim()
        : document.getElementById('gscExistTable').value;

    if (!tableName) { toast('Bitte Tabellenname angeben', 'error'); return; }

    const btn = document.getElementById('gscBtnExportDb');
    btn.disabled    = true;
    btn.textContent = '⏳ Exportiere…';
    _setStatus('gscExportStatus', 'Schreibe Daten in die Datenbank…', 'loading');

    try {
        const payload = { rows: _gscFetchedRows, tableName, mode, schema: _gscFetchedSchema };
        const res = await window.api.gsc_exportToDb?.(payload)
                 ?? await window.electron?.ipcRenderer?.invoke('gsc:exportToDb', payload);

        if (!res?.ok) throw new Error(res?.error || 'Export fehlgeschlagen');

        _setStatus('gscExportStatus', `✅ ${res.inserted} Zeilen in Tabelle "${res.tableName}" exportiert`, 'ok');
        toast(`✓ ${res.inserted} Datensätze in "${res.tableName}" importiert`);
    } catch (e) {
        _setStatus('gscExportStatus', '❌ ' + e.message, 'error');
        toast('Export fehlgeschlagen: ' + e.message, 'error');
    } finally {
        btn.disabled    = false;
        btn.textContent = '💾 In Datenbank exportieren';
    }
}

async function _exportToJson() {
    if (!_gscFetchedRows?.length) { toast('Bitte zuerst Daten abrufen', 'error'); return; }

    const dataType = document.getElementById('gscDataType').value;
    const filename = 'gsc_' + dataType + '_' + new Date().toISOString().slice(0, 10).replace(/-/g, '');

    const btn = document.getElementById('gscBtnExportJson');
    btn.disabled    = true;
    btn.textContent = '⏳ Speichern…';

    try {
        const res = await window.api.gsc_saveJson?.({ rows: _gscFetchedRows, filename })
                 ?? await window.electron?.ipcRenderer?.invoke('gsc:saveJson', { rows: _gscFetchedRows, filename });

        if (!res?.ok) throw new Error(res?.error || 'Speichern fehlgeschlagen');

        _setStatus('gscExportStatus', `✅ JSON gespeichert: ${res.filePath}`, 'ok');
        toast('✓ JSON-Datei gespeichert');
    } catch (e) {
        _setStatus('gscExportStatus', '❌ ' + e.message, 'error');
        toast('Speichern fehlgeschlagen: ' + e.message, 'error');
    } finally {
        btn.disabled    = false;
        btn.textContent = '📄 Als JSON speichern';
    }
}

function _renderPreviewTable(rows, schema) {
    const wrap = document.getElementById('gscPreviewTable');
    if (!rows?.length || !wrap) return;

    const cols  = schema.map(s => s.name);
    const limit = Math.min(rows.length, 5);
    let html = `<table class="gsc-preview-table"><thead><tr>`;
    cols.forEach(c => { html += `<th>${c}</th>`; });
    html += `</tr></thead><tbody>`;
    for (let i = 0; i < limit; i++) {
        html += '<tr>';
        cols.forEach(c => {
            const v = rows[i][c];
            const display = v === null || v === undefined ? '—'
                : typeof v === 'object' ? JSON.stringify(v)
                : String(v);
            html += `<td title="${display}">${display}</td>`;
        });
        html += '</tr>';
    }
    if (rows.length > limit) {
        html += `<tr><td colspan="${cols.length}" style="color:var(--muted,#71717a);padding:4px 8px">… ${rows.length - limit} weitere Zeilen</td></tr>`;
    }
    html += '</tbody></table>';
    wrap.innerHTML = html;
    wrap.style.display = '';
}

function _renderSchemaInfo(schema) {
    if (!schema?.length) return '';
    return `<strong>Erkannte Spalten (${schema.length}):</strong><br>` +
        schema.map(c => `<span style="color:var(--text,#e2e2e2)">${c.name}</span> <span style="color:var(--muted,#71717a)">(${c.pgType})</span>`).join(' · ');
}

function _setStatus(elId, msg, type = '') {
    const el = document.getElementById(elId);
    if (!el) return;
    el.textContent = msg;
    el.className   = 'gsc-status' + (type ? ' ' + type : '');
    el.style.display = msg ? '' : 'none';
}

// ─── Detail-Panel befüllen ────────────────────────────────────────
async function openDetail(apiDef) {
    const panel = document.getElementById('apiDetailPanel');
    if (!panel) return;

    // Prüfe, ob hasKey bereits in _keyStates gespeichert ist (z.B. nach einem Speichern)
    let hasKey = _keyStates[apiDef.id];
    if (hasKey === undefined) {
        // Nur abfragen, wenn nicht bereits gespeichert
        hasKey = await window.api.apiBridge_hasKey(apiDef.id).then(r => r?.result ?? false).catch(() => false);
    }

    const retention = await window.api.apiBridge_getRetention(apiDef.id).then(r => r?.result ?? null).catch(() => null);

    _keyStates[apiDef.id]     = hasKey;
    _retentionData[apiDef.id] = retention;

    panel.innerHTML = buildDetailHtml(apiDef, hasKey, retention);
    loadCacheInfo(apiDef.id);
    bindDetailEvents(apiDef);
}

async function loadCacheInfo(configId) {
    const el = document.getElementById(`cacheInfo_${configId}`);
    if (!el) return;
    try {
        const res = await window.api.apiBridge_getCacheSize(configId);
        const d   = res?.result || { entries: 0, bytes: 0 };
        el.textContent = `${d.entries} Einträge · ${(d.bytes / 1024).toFixed(1)} KB gespeichert`;
    } catch { el.textContent = 'Cache-Info nicht verfügbar'; }
}

async function loadGlobalStats() {
    try {
        const res   = await window.api.apiBridge_stats();
        const stats = res?.result || res || {};
        const q = id => document.getElementById(id);
        if (q('apiStatApis'))   q('apiStatApis').textContent   = stats.active_apis       ?? '–';
        if (q('apiStatCached')) q('apiStatCached').textContent = stats.cached_responses  ?? '–';
        if (q('apiStatHits'))   q('apiStatHits').textContent   = stats.total_cache_hits  ?? '–';
        if (q('apiStatSaved'))  q('apiStatSaved').textContent  = stats.total_saved != null
            ? '€ ' + parseFloat(stats.total_saved).toFixed(3) : '–';
    } catch (e) { console.warn('[API-Tab] Stats Fehler:', e.message); }
}

// ─── Detail-Events ───────────────────────────────────────────────
function bindDetailEvents(apiDef) {
    const id = apiDef.id;

    document.getElementById(`btnEye_${id}`)?.addEventListener('click', () => {
        const inp = document.getElementById(`keyInput_${id}`);
        if (inp) inp.type = inp.type === 'password' ? 'text' : 'password';
    });

    // ── GSC Export Button ─────────────────────────────────────
    document.getElementById(`btnGscExport_${id}`)?.addEventListener('click', () => {
        openGscExportModal();
    });

    // ── Shopify Export Button ──────────────────────────────────
    document.getElementById(`btnShopifyExport_${id}`)?.addEventListener('click', () => {
        openShopifyExportModal();
    });

    // ── OAuth Verbindung ──────────────────────────────────────
    document.getElementById(`btnConnect_${id}`)?.addEventListener('click', async () => {
        const btn = document.getElementById(`btnConnect_${id}`);
        if (btn) { btn.disabled = true; btn.textContent = '⏳ Öffne Browser…'; }

        try {
            const startRes = await window.api.apiBridge_startGSCAuth();
            if (!startRes?.ok) throw new Error(startRes?.error || 'Fehler beim Starten der OAuth-Verbindung');

            if (btn) btn.textContent = '⏳ Warte auf Code…';

            const code = await showInputModal(
                'Google hat dich nach dem Login zu einer URL weitergeleitet.\n\n' +
                'Kopiere den "code=..." Wert aus der URL-Leiste und füge ihn hier ein:'
            );

            if (!code?.trim()) { toast('Verbindung abgebrochen — kein Code eingegeben', 'error'); return; }

            if (btn) btn.textContent = '⏳ Verbinde…';

            const finishRes = await window.api.apiBridge_finishGSCAuth(code.trim());
            if (finishRes?.ok) {
                toast('✓ Google Search Console erfolgreich verbunden');
                openDetail(apiDef);
            } else {
                throw new Error(finishRes?.error || 'Unbekannter Fehler beim Token-Exchange');
            }
        } catch (e) {
            console.error('[GSC OAuth]', e);
            toast('❌ ' + e.message, 'error');
        } finally {
            if (btn) { btn.disabled = false; btn.textContent = '🔗 Konto verbinden (OAuth2)'; }
        }
    });

    // Key speichern
    document.getElementById(`btnSave_${id}`)?.addEventListener('click', async () => {
        const isShopify = apiDef.id === 'shopify';
        
        if (isShopify) {
            const clientId = document.getElementById(`keyInput_${id}_clientId`)?.value?.trim();
            const clientSecret = document.getElementById(`keyInput_${id}_clientSecret`)?.value?.trim();
            
            if (!clientId || !clientSecret) {
                toast('Bitte Client ID und Client Secret eingeben', 'error');
                return;
            }
            
            try {
                // Speichere beide Werte als JSON-String
                const credentials = JSON.stringify({ clientId, clientSecret });
                const res = await window.api.apiBridge_setKey(id, credentials);
                
                if (!res?.ok) {
                    toast('❌ Fehler beim Speichern: ' + (res?.error || 'Unbekannter Fehler'), 'error');
                    return;
                }
                
                toast(`✓ Shopify-Anmeldedaten gespeichert`);
                
                // Eingabefelder leeren (aus Sicherheitsgründen)
                document.getElementById(`keyInput_${id}_clientId`).value = '';
                document.getElementById(`keyInput_${id}_clientSecret`).value = '';
                
                // Setze hasKey direkt auf true
                _keyStates[id] = true;
                
                // UI aktualisieren
                openDetail(apiDef);
            } catch (e) { toast(e.message, 'error'); }
        } else {
            // Standard-Handler für andere APIs
            const val = document.getElementById(`keyInput_${id}`)?.value?.trim();
            if (!val) { toast('Bitte API Key eingeben', 'error'); return; }
            try {
                const res = await window.api.apiBridge_setKey(id, val);
                
                if (!res?.ok) {
                    toast('❌ Fehler beim Speichern: ' + (res?.error || 'Unbekannter Fehler'), 'error');
                    return;
                }
                
                toast(`✓ Key für ${apiDef.name} gespeichert`);
                
                // Setze hasKey direkt auf true
                _keyStates[id] = true;
                
                // UI aktualisieren
                openDetail(apiDef);
            } catch (e) { toast(e.message, 'error'); }
        }
    });

    // Key löschen
    document.getElementById(`btnDel_${id}`)?.addEventListener('click', async () => {
        if (!confirm(`API Key für "${apiDef.name}" wirklich löschen?`)) return;
        try {
            await window.api.apiBridge_deleteKey(id);
            toast(`Key für ${apiDef.name} gelöscht`);
            const dot = document.getElementById(`keyDot_${id}`);
            if (dot) { dot.textContent = '○'; dot.classList.remove('has-key'); }
            openDetail(apiDef);
        } catch (e) { toast(e.message, 'error'); }
    });

    // TTL toggle
    document.getElementById(`retMode_${id}`)?.addEventListener('change', (e) => {
        const wrap = document.getElementById(`ttlWrap_${id}`);
        if (wrap) wrap.style.display = e.target.value === 'ttl' ? '' : 'none';
    });

    // Retention speichern
    document.getElementById(`btnSaveRetention_${id}`)?.addEventListener('click', async () => {
        const mode    = document.getElementById(`retMode_${id}`)?.value    || 'ttl';
        const ttl     = parseFloat(document.getElementById(`retTTL_${id}`)?.value)  || 24;
        const archive = document.getElementById(`retArchive_${id}`)?.checked ?? false;
        try {
            await window.api.apiBridge_setRetention(id, { mode, ttl_hours: ttl, auto_archive: archive ? 1 : 0 });
            toast('Einstellungen gespeichert');
        } catch (e) { toast(e.message, 'error'); }
    });

    // Cache leeren
    document.getElementById(`btnClearCache_${id}`)?.addEventListener('click', async () => {
        if (!confirm(`Cache für "${apiDef.name}" leeren?`)) return;
        try {
            await window.api.apiBridge_clearCache(id);
            toast('Cache geleert');
            loadCacheInfo(id);
            loadGlobalStats();
        } catch (e) { toast(e.message, 'error'); }
    });

    // Test ausführen
    document.getElementById(`btnTest_${id}`)?.addEventListener('click', () => runTest(apiDef));
}

// ─── Verbindungstest ─────────────────────────────────────────────
const TEST_CALLS = {
    'openweathermap':         () => window.api.apiBridge_weather('Berlin', 'openweathermap'),
    'weatherapi':             () => window.api.apiBridge_weather('Berlin', 'weatherapi'),
    'open-meteo':             () => window.api.apiBridge_call('open-meteo', '/forecast', { latitude: 52.52, longitude: 13.4, hourly: 'temperature_2m', forecast_days: 1 }),
    'bing-search':            () => window.api.apiBridge_search('Kynto Test', 'bing-search'),
    'google-custom-search':   () => window.api.apiBridge_search('Kynto Test', 'google-custom-search'),
    'google-maps':            () => window.api.apiBridge_geocode('Berlin', 'google-maps'),
    'openstreetmap-nominatim':() => window.api.apiBridge_geocode('Berlin', 'openstreetmap-nominatim'),
    'newsapi':                () => window.api.apiBridge_news('Technologie', {}),
    'alpha-vantage':          () => window.api.apiBridge_stockQuote('AAPL'),
    'gmail':                  () => window.api.apiBridge_call('gmail', '/messages', { maxResults: 1 }),
    'google-calendar':        () => window.api.apiBridge_call('google-calendar', '/calendars/primary/events', { maxResults: 1 }),
    'github':                 () => window.api.apiBridge_call('github', '/rate_limit'),
    'shopify':                () => window.api.apiBridge_call('shopify', '/shop.json'),
    'sendgrid':               () => window.api.apiBridge_call('sendgrid', '/user/account'),
    'google-search-console':  () => window.api.apiBridge_call('google-search-console', '/sites'),
    'google-keyword-planner': () => window.api.apiBridge_call('google-keyword-planner', '/customers:listAccessibleCustomers'),
    'dataforseo':             () => window.api.apiBridge_call('dataforseo', '/serp/google/organic/live/advanced', {}, {
                                  method: 'POST',
                                  body: [{ keyword: 'seo tools', location_code: 2276, language_code: 'de', device: 'desktop', os: 'windows', depth: 3 }],
                              }),
    'google-trends':          () => window.api.apiBridge_call('google-trends', '/search', { q: 'SEO', data_type: 'TIMESERIES', geo: 'DE' }),
};

async function runTest(apiDef) {
    const out = document.getElementById(`testOutput_${apiDef.id}`);
    if (!out) return;
    out.classList.add('visible');
    out.classList.remove('error');
    out.textContent = '⏳ Verbinde…';

    const testFn = TEST_CALLS[apiDef.id];
    if (!testFn) { out.textContent = 'Kein Test für diese API definiert.'; return; }

    try {
        const t0  = Date.now();
        const res = await testFn();
        const ms  = Date.now() - t0;
        const src = res?.result?.fromCache ? '📦 Cache' : '🌐 API';
        out.textContent = `✅ ${src} · ${ms}ms\n\n` + JSON.stringify(res?.result?.data ?? res, null, 2).slice(0, 800);
        loadGlobalStats();
    } catch (e) {
        out.classList.add('error');
        out.textContent = '❌ Fehler: ' + e.message;
    }
}

// ─── Key-Status für alle APIs ────────────────────────────────────
async function refreshAllKeyDots() {
    for (const group of API_GROUPS) {
        for (const api of group.apis) {
            if (api.free) continue;
            try {
                const res = await window.api.apiBridge_hasKey(api.id);
                const has = res?.result ?? false;
                const dot = document.getElementById(`keyDot_${api.id}`);
                if (dot) {
                    dot.textContent = has ? '●' : '○';
                    if (has) dot.classList.add('has-key');
                    else     dot.classList.remove('has-key');
                }
            } catch { /* ignore */ }
        }
    }
}

// ─── Haupt-Init ──────────────────────────────────────────────────
export function initApiSettingsTab() {
    // ── Shopify OAuth Event-Listener registrieren ──────────────────
    if (window.electron?.ipcRenderer) {
        window.electron.ipcRenderer.on('shopify:oauth-success', (event, data) => {
            console.log('[Shopify] OAuth erfolgreich:', data);
            
            // Speichere die Shop-Domain
            const domainField = document.getElementById('shopifyDomain');
            if (domainField?.value) {
                sessionStorage.setItem('shopify_domain', domainField.value);
                domainField.disabled = true;
            }
            
            const statusDiv = document.getElementById('shopifyAuthStatus');
            if (statusDiv) {
                _setStatus('shopifyAuthStatus', 
                    `✅ Mit ${data.shop} verbunden! (Scope: ${data.scope})`, 'ok');
            }
            // Zeige nächsten Schritt
            const exportTarget = document.getElementById('shopifyExportTarget');
            if (exportTarget) {
                exportTarget.style.display = 'block';
                // Lade existierende Tabellen
                _loadShopifyExistingTables();
            }
        });
        
        window.electron.ipcRenderer.on('shopify:oauth-error', (event, data) => {
            console.error('[Shopify] OAuth Fehler:', data);
            const statusDiv = document.getElementById('shopifyAuthStatus');
            if (statusDiv) {
                _setStatus('shopifyAuthStatus', '❌ OAuth Fehler: ' + data.error, 'error');
            }
        });
    }
    
    injectStyles();
    console.log('[API-Tab] Initialisiere...');

    setTimeout(() => {
        const sidebar     = document.querySelector('.settings-sidebar');
        const contentArea = document.querySelector('.settings-content');

        if (!sidebar)     { console.error('[API-Tab] .settings-sidebar nicht gefunden'); return; }
        if (!contentArea) { console.error('[API-Tab] .settings-content nicht gefunden'); return; }
        if (document.getElementById('settingsTabApis')) { console.warn('[API-Tab] Tab bereits eingebaut'); return; }

        console.log('[API-Tab] Modal gefunden, baue Tab ein...');

        // Tab-Button
        const btn = document.createElement('div');
        btn.id             = 'settingsTabApis';
        btn.className      = 'nav-item';
        btn.dataset.target = 'apis';

        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('fill', 'none');
        svg.setAttribute('stroke', 'currentColor');
        svg.setAttribute('stroke-width', '2');
        svg.innerHTML = '<path d="M7 10V7a2 2 0 012-2h6a2 2 0 012 2v3"></path><path d="M10 16h4"></path><path d="M6 14h12a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4a2 2 0 012-2z"></path>';
        const span = document.createElement('span');
        span.setAttribute('data-i18n', 'settings.nav.api');
        span.textContent = 'Instant API';
        btn.append(svg, span);

        const nav    = sidebar.querySelector('nav');
        const dbItem = nav.querySelector('[data-target="pane-db"]');
        if (dbItem?.nextElementSibling) nav.insertBefore(btn, dbItem.nextElementSibling);
        else nav.appendChild(btn);

        // Tab-Content (inkl. GSC Modal)
        const pane = document.createElement('div');
        pane.id             = 'settingsPaneApis';
        pane.className      = 'settings-pane';
        pane.style.height   = '100%';
        pane.style.overflow = 'auto';
        pane.innerHTML      = buildTabHtml();
        contentArea.appendChild(pane);

        // Tab-Klick
        btn.addEventListener('click', () => {
            contentArea.querySelectorAll('.settings-pane').forEach(p => { p.classList.remove('active'); p.style.display = 'none'; });
            sidebar.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
            pane.classList.add('active');
            pane.style.display = 'block';
            btn.classList.add('active');
            setTimeout(() => { loadGlobalStats(); refreshAllKeyDots(); }, 200);
        });

        // Cache leeren global
        document.getElementById('apiBtnClearAll')?.addEventListener('click', async () => {
            if (!confirm('Gesamten API-Cache leeren?')) return;
            try { await window.api.apiBridge_clearCache(null); } catch (e) { console.warn(e); }
            toast('Gesamter Cache geleert');
            loadGlobalStats();
        });

        // API-Items klickbar
        const groupList = document.getElementById('apiGroupList');
        groupList?.addEventListener('click', (e) => {
            const item = e.target.closest('.api-group-item');
            if (!item) return;
            document.querySelectorAll('.api-group-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            const def = API_GROUPS.flatMap(g => g.apis).find(a => a.id === item.dataset.id);
            if (def) openDetail(def);
        });

        console.log('[API-Tab] ✅✅ TAB VOLLSTÄNDIG INITIALISIERT');
    }, 100);
}
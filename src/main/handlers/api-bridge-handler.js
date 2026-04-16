/**
 * ═══════════════════════════════════════════════════════════════
 *  Kynto Intel — src/main/handlers/api-bridge-handler.js
 *
 *  Registriert alle IPC-Handler für die Sovereign API-Bridge.
 *  Wird in registerAllHandlers() eingebunden.
 *
 *  NEU: GSC Daten-Export Handler
 *       - gsc:getTables        → alle Tabellen der PGlite-DB
 *       - gsc:getTableColumns  → Spalten einer bestimmten Tabelle
 *       - gsc:fetchData        → Daten von GSC API abrufen
 *       - gsc:exportToDb       → Daten in Tabelle schreiben (neu oder bestehend)
 *       - gsc:saveJson         → JSON in data/ Ordner speichern
 * ═══════════════════════════════════════════════════════════════
 */

const { ipcMain, app } = require('electron');
const path             = require('path');
const fs               = require('fs');
const { shell }        = require('electron');

// ─── Pfade ──────────────────────────────────────────────────────
const DATA_DIR = process.env.KYNTO_DATA_DIR
    || path.join(app.getAppPath(), 'data');

// Lazy-Load: erst beim ersten IPC-Call initialisieren
let _api = null;
function getApi() {
    if (!_api) _api = require(path.join(__dirname, '../../components/api/apiHandler'));
    return _api;
}

let _db = null;
function getDb() {
    if (!_db) _db = require(path.join(__dirname, '../../components/api/database'));
    return _db;
}

let _shopifyInstance = null;
function getShopifyInstance() {
    if (!_shopifyInstance) {
        const ShopifyAPI = require(path.join(__dirname, '../../components/api/Module/shopify-modul'));
        _shopifyInstance = new ShopifyAPI({ dbApi: getDb().dbApi });
    }
    return _shopifyInstance;
}

/**
 * Alle API-Bridge IPC-Handler registrieren.
 */
function registerApiBridgeHandlers() {

    // ── Direkte API-Calls ─────────────────────────────────────
    ipcMain.handle('apiBridge:call', async (_, configId, endpoint, params, options) => {
        try {
            const result = await getApi().call(configId, endpoint, params || {}, options || {});
            return { ok: true, result };
        } catch (e) {
            return { ok: false, error: e.message };
        }
    });

    // ── Shortcuts ─────────────────────────────────────────────
    ipcMain.handle('apiBridge:weather', async (_, city, provider) => {
        try   { return { ok: true, result: await getApi().weather(city, provider) }; }
        catch (e) { return { ok: false, error: e.message }; }
    });

    ipcMain.handle('apiBridge:forecast', async (_, city, days, provider) => {
        try   { return { ok: true, result: await getApi().forecast(city, days, provider) }; }
        catch (e) { return { ok: false, error: e.message }; }
    });

    ipcMain.handle('apiBridge:search', async (_, query, provider) => {
        try   { return { ok: true, result: await getApi().search(query, provider) }; }
        catch (e) { return { ok: false, error: e.message }; }
    });

    ipcMain.handle('apiBridge:news', async (_, query, options) => {
        try   { return { ok: true, result: await getApi().news(query, options || {}) }; }
        catch (e) { return { ok: false, error: e.message }; }
    });

    ipcMain.handle('apiBridge:geocode', async (_, address, provider) => {
        try   { return { ok: true, result: await getApi().geocode(address, provider) }; }
        catch (e) { return { ok: false, error: e.message }; }
    });

    ipcMain.handle('apiBridge:translate', async (_, text, lang) => {
        try   { return { ok: true, result: await getApi().translate(text, lang) }; }
        catch (e) { return { ok: false, error: e.message }; }
    });

    ipcMain.handle('apiBridge:stockQuote', async (_, symbol) => {
        try   { return { ok: true, result: await getApi().stockQuote(symbol) }; }
        catch (e) { return { ok: false, error: e.message }; }
    });

    ipcMain.handle('apiBridge:shopify', async (_, shopUrl, accessToken, endpoint, params, options) => {
        try   { return { ok: true, result: await getApi().shopify(shopUrl, accessToken, endpoint, params || {}, options || {}) }; }
        catch (e) { return { ok: false, error: e.message }; }
    });

    // ── Verwaltung ────────────────────────────────────────────
    ipcMain.handle('apiBridge:list', () => {
        try   { return { ok: true, result: getApi().listApis() }; }
        catch (e) { return { ok: false, error: e.message }; }
    });

    ipcMain.handle('apiBridge:stats', (_, configId) => {
        try   { return { ok: true, result: getApi().stats(configId || null) }; }
        catch (e) { return { ok: false, error: e.message }; }
    });

    ipcMain.handle('apiBridge:setKey', (_, configId, key) => {
        try {
            const { dbApi } = getDb();
            console.log(`[apiBridge:setKey] Speichere Key für ${configId}`);
            dbApi.saveApiKey(configId, key);
            console.log(`[apiBridge:setKey] ✓ Key gespeichert für ${configId}`);
            return { ok: true };
        } catch (e) {
            console.error(`[apiBridge:setKey] ✗ Fehler für ${configId}:`, e);
            return { ok: false, error: e.message };
        }
    });

    ipcMain.handle('apiBridge:hasKey', (_, configId) => {
        try {
            const { dbApi } = getDb();
            const key = dbApi.getApiKey(configId);
            console.log(`[apiBridge:hasKey] Key für ${configId}: ${key ? '✓ vorhanden' : '✗ fehlt'}`);
            return { ok: true, result: !!key };
        } catch (e) {
            console.error(`[apiBridge:hasKey] ✗ Fehler für ${configId}:`, e);
            return { ok: false, error: e.message };
        }
    });

    ipcMain.handle('apiBridge:deleteKey', (_, configId) => {
        try {
            const { db } = getDb();
            db.prepare('DELETE FROM api_keys WHERE config_id = ?').run(configId);
            return { ok: true };
        } catch (e) { return { ok: false, error: e.message }; }
    });

    ipcMain.handle('apiBridge:clearCache', (_, configId) => {
        try   { getApi().clearCache(configId || null); return { ok: true }; }
        catch (e) { return { ok: false, error: e.message }; }
    });

    ipcMain.handle('apiBridge:setRetention', (_, configId, rule) => {
        try   { getApi().setRetention(configId, rule); return { ok: true }; }
        catch (e) { return { ok: false, error: e.message }; }
    });

    ipcMain.handle('apiBridge:getRetention', (_, configId) => {
        try {
            const { dbApi } = getDb();
            return { ok: true, result: dbApi.getRetention(configId) };
        } catch (e) { return { ok: false, error: e.message }; }
    });

    ipcMain.handle('apiBridge:getHistory', (_, configId, endpoint, limit) => {
        try   { return { ok: true, result: getApi().getHistory(configId, endpoint, limit || 100) }; }
        catch (e) { return { ok: false, error: e.message }; }
    });

    ipcMain.handle('apiBridge:register', (_, config) => {
        try   { getApi().register(config); return { ok: true }; }
        catch (e) { return { ok: false, error: e.message }; }
    });

    ipcMain.handle('apiBridge:setMapping', (_, configId, endpoint, mapping) => {
        try   { getApi().setMapping(configId, endpoint, mapping); return { ok: true }; }
        catch (e) { return { ok: false, error: e.message }; }
    });

    ipcMain.handle('apiBridge:getCacheSize', (_, configId) => {
        try {
            const { db } = getDb();
            const row = configId
                ? db.prepare('SELECT COUNT(*) as cnt, SUM(LENGTH(raw_response)) as bytes FROM api_cache WHERE config_id = ?').get(configId)
                : db.prepare('SELECT COUNT(*) as cnt, SUM(LENGTH(raw_response)) as bytes FROM api_cache').get();
            return { ok: true, result: { entries: row.cnt, bytes: row.bytes || 0 } };
        } catch (e) { return { ok: false, error: e.message }; }
    });

    // ── OAuth2 Flow für Google Search Console ────────────────
    ipcMain.handle('apiBridge:startGSCAuth', async () => {
        try {
            const { getGSCAuthUrl } = require(
                path.join(__dirname, '../../components/api/Module/google-search-console-modul')
            );
            const url = getGSCAuthUrl();
            await shell.openExternal(url);
            return { ok: true };
        } catch (e) {
            console.error('[GSC] startGSCAuth Fehler:', e);
            return { ok: false, error: e.message };
        }
    });

    ipcMain.handle('apiBridge:finishGSCAuth', async (_, code) => {
        try {
            const { exchangeGSCCodeForTokens } = require(
                path.join(__dirname, '../../components/api/Module/google-search-console-modul')
            );
            const tokens = await exchangeGSCCodeForTokens(code);
            if (tokens && tokens.access_token) return { ok: true };
            throw new Error('Kein Access Token von Google erhalten');
        } catch (e) {
            console.error('[GSC] finishGSCAuth Fehler:', e);
            return { ok: false, error: e.message };
        }
    });

    /**
     * Überprüft, ob GSC bereits authentifiziert ist (Tokens gespeichert).
     */
    ipcMain.handle('apiBridge:checkGSCAuth', async () => {
        try {
            const { isGSCAuthenticated } = require(
                path.join(__dirname, '../../components/api/Module/google-search-console-modul')
            );
            const authenticated = isGSCAuthenticated();
            return { ok: true, authenticated };
        } catch (e) {
            console.error('[GSC] checkGSCAuth Fehler:', e);
            return { ok: false, authenticated: false, error: e.message };
        }
    });

    // ════════════════════════════════════════════════════════════
    //  NEU: GSC DATEN-EXPORT HANDLER
    // ════════════════════════════════════════════════════════════

    /**
     * Gibt alle Tabellen aus der PGlite-Datenbank zurück.
     * Renderer braucht das für die "bestehende Tabelle"-Auswahl.
     */
    ipcMain.handle('gsc:getTables', async () => {
        try {
            const databaseEngine = require(path.join(__dirname, '../database-engine'));
            const result = await databaseEngine.executeQuery(
                `SELECT table_name FROM information_schema.tables
                 WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
                 ORDER BY table_name`
            );
            const tables = (result.rows || []).map(r => r.table_name);
            return { ok: true, tables };
        } catch (e) {
            console.error('[GSC] getTables Fehler:', e);
            return { ok: false, error: e.message };
        }
    });

    /**
     * Gibt die Spalten einer bestehenden Tabelle zurück.
     * Damit kann der Renderer prüfen ob die Spalten kompatibel sind.
     */
    ipcMain.handle('gsc:getTableColumns', async (_, tableName) => {
        try {
            const databaseEngine = require(path.join(__dirname, '../database-engine'));
            const result = await databaseEngine.executeQuery(
                `SELECT column_name, data_type
                 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = $1
                 ORDER BY ordinal_position`,
                [tableName]
            );
            const columns = (result.rows || []).map(r => ({ name: r.column_name, type: r.data_type }));
            return { ok: true, columns };
        } catch (e) {
            console.error('[GSC] getTableColumns Fehler:', e);
            return { ok: false, error: e.message };
        }
    });

    /**
     * Ruft GSC-Daten von der API ab und gibt das gemappte Ergebnis zurück.
     * payload: { dataType, siteUrl, startDate, endDate, dimensions, searchType }
     *
     * dataType: 'performance' | 'sitemaps' | 'sites' | 'urlInspection' | 'device' | 'discover'
     */
    ipcMain.handle('gsc:fetchData', async (_, payload) => {
        try {
            const {
                getGSCSites,
                getGSCSearchPerformance,
                getGSCSitemaps,
                inspectGSCUrl,
                refreshGSCTokenIfNeeded,
            } = require(path.join(__dirname, '../../components/api/Module/google-search-console-modul'));

            const GSCMapper = require(
                path.join(__dirname, '../../components/api/Module/google-search-console-data-mapper')
            );

            const isReady = await refreshGSCTokenIfNeeded();
            if (!isReady) {
                return { ok: false, error: 'Nicht authentifiziert - bitte zuerst GSC verbinden' };
            }

            let rows = [];
            const { dataType, siteUrl, startDate, endDate, dimensions, searchType, inspectionUrl } = payload;
            
            console.log('[GSC:fetchData] Start:', { dataType, siteUrl, startDate, endDate });

            switch (dataType) {
                case 'performance':
                case 'discover':
                    rows = await getGSCSearchPerformance(
                        siteUrl,
                        startDate  || _defaultDate(28),
                        endDate    || _defaultDate(0),
                        dimensions || ['query', 'page', 'country', 'device', 'date']
                    );
                    break;

                case 'device':
                    // Performance gruppiert nach Device
                    const rawRows = await getGSCSearchPerformance(
                        siteUrl,
                        startDate || _defaultDate(28),
                        endDate   || _defaultDate(0),
                        ['device']
                    );
                    rows = GSCMapper.groupBy(rawRows, 'device').map(r => ({
                        ...r,
                        totalClicks:      r.clicks,
                        totalImpressions: r.impressions,
                        avgCtr:           r.ctr,
                        avgPosition:      r.position,
                        shareOfClicks:    0, // wird unten berechnet
                    }));
                    // Share of clicks berechnen
                    const totalC = rows.reduce((s, r) => s + r.totalClicks, 0);
                    rows = rows.map(r => ({
                        ...r,
                        shareOfClicks: totalC > 0 ? +((r.totalClicks / totalC) * 100).toFixed(2) : 0,
                    }));
                    break;

                case 'sitemaps':
                    rows = await getGSCSitemaps(siteUrl);
                    break;

                case 'sites':
                    rows = await getGSCSites();
                    break;

                case 'urlInspection':
                    if (!inspectionUrl) throw new Error('inspectionUrl fehlt');
                    const inspection = await inspectGSCUrl(siteUrl, inspectionUrl);
                    rows = [GSCMapper.flattenUrlInspection(inspection)];
                    break;

                default:
                    throw new Error(`Unbekannter dataType: ${dataType}`);
            }

            // Schema automatisch erkennen (Spaltenstruktur aus den Daten ableiten)
            const schema = _inferSchema(rows);

            return { ok: true, rows, schema, count: rows.length };
        } catch (e) {
            console.error('[GSC] fetchData Fehler:', e);
            return { ok: false, error: e.message };
        }
    });

    /**
     * Exportiert Daten in die PGlite-Datenbank.
     * payload: {
     *   rows        : Array<Object>   — die gemappten Daten
     *   tableName   : string          — Ziel-Tabellenname
     *   mode        : 'new' | 'append' | 'replace'
     *   schema      : Array<{name, pgType}> — Spaltenstruktur
     * }
     */
    ipcMain.handle('gsc:exportToDb', async (_, payload) => {
        try {
            const databaseEngine = require(path.join(__dirname, '../database-engine'));
            const { rows, tableName, mode, schema } = payload;

            if (!rows?.length)      throw new Error('Keine Daten zum Exportieren');
            if (!tableName?.trim()) throw new Error('Kein Tabellenname angegeben');

            // Tabellen-Name bereinigen (nur a-z, 0-9, _)
            const safeTable = tableName.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');

            if (mode === 'new' || mode === 'replace') {
                // Tabelle ggf. droppen
                if (mode === 'replace') {
                    await databaseEngine.executeQuery(`DROP TABLE IF EXISTS "${safeTable}"`);
                }
                // Tabelle neu anlegen basierend auf Schema
                const colDefs = schema.map(col =>
                    `"${col.name}" ${col.pgType || 'TEXT'}`
                ).join(', ');
                await databaseEngine.executeQuery(
                    `CREATE TABLE IF NOT EXISTS "${safeTable}" (
                        _id SERIAL PRIMARY KEY,
                        _imported_at TIMESTAMPTZ DEFAULT NOW(),
                        ${colDefs}
                    )`
                );
            }

            // Daten einfügen (Batch in Chunks von 500)
            const cols = schema.map(c => c.name);
            let inserted = 0;
            const CHUNK = 500;

            for (let i = 0; i < rows.length; i += CHUNK) {
                const chunk = rows.slice(i, i + CHUNK);
                for (const row of chunk) {
                    const vals    = cols.map(c => _toDbValue(row[c]));
                    const colList = cols.map(c => `"${c}"`).join(', ');
                    const plcList = cols.map((_, idx) => `$${idx + 1}`).join(', ');
                    await databaseEngine.executeQuery(
                        `INSERT INTO "${safeTable}" (${colList}) VALUES (${plcList})`,
                        vals
                    );
                    inserted++;
                }
            }

            console.log(`[GSC] ✅ ${inserted} Zeilen in Tabelle "${safeTable}" exportiert`);
            return { ok: true, inserted, tableName: safeTable };
        } catch (e) {
            console.error('[GSC] exportToDb Fehler:', e);
            return { ok: false, error: e.message };
        }
    });

    /**
     * Speichert die Rohdaten als JSON-Datei in DATA_DIR.
     * payload: { rows, filename }
     * Speicherort: C:\Users\Felix\Desktop\Kynto\Kynto\data\<filename>.json
     */
    ipcMain.handle('gsc:saveJson', async (_, payload) => {
        try {
            const { rows, filename } = payload;
            if (!rows?.length) throw new Error('Keine Daten zum Speichern');

            // Dateiname bereinigen
            const safeName = (filename || 'gsc-export-' + Date.now())
                .replace(/[^a-zA-Z0-9_\-]/g, '_')
                .replace(/\.json$/i, '');

            if (!fs.existsSync(DATA_DIR)) {
                fs.mkdirSync(DATA_DIR, { recursive: true });
            }

            const filePath = path.join(DATA_DIR, `${safeName}.json`);
            const output   = {
                exportedAt: new Date().toISOString(),
                count:      rows.length,
                data:       rows,
            };

            fs.writeFileSync(filePath, JSON.stringify(output, null, 2), 'utf8');
            console.log(`[GSC] ✅ JSON gespeichert: ${filePath}`);
            return { ok: true, filePath };
        } catch (e) {
            console.error('[GSC] saveJson Fehler:', e);
            return { ok: false, error: e.message };
        }
    });

    console.log('[Main] ✅ API-Bridge Handler registriert (inkl. GSC-Export)');
}

// ─── Hilfsfunktionen ────────────────────────────────────────────

/** Datum vor N Tagen als YYYY-MM-DD */
function _defaultDate(daysAgo) {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return d.toISOString().slice(0, 10);
}

/**
 * Schema aus den Daten ableiten — erkennt automatisch welche Spalten
 * existieren und welchen PostgreSQL-Typ sie haben sollen.
 */
function _inferSchema(rows) {
    if (!rows?.length) return [];
    const sample = rows[0];
    return Object.keys(sample).map(key => {
        const val = sample[key];
        let pgType = 'TEXT';
        if (typeof val === 'number') {
            pgType = Number.isInteger(val) ? 'INTEGER' : 'NUMERIC';
        } else if (typeof val === 'boolean') {
            pgType = 'BOOLEAN';
        } else if (val instanceof Date) {
            pgType = 'TIMESTAMPTZ';
        } else if (typeof val === 'string') {
            // Datum-Strings erkennen (YYYY-MM-DD)
            if (/^\d{4}-\d{2}-\d{2}$/.test(val)) pgType = 'DATE';
        } else if (Array.isArray(val) || typeof val === 'object') {
            pgType = 'JSONB';
        }
        return { name: key, pgType };
    });
}

/** Konvertiert Werte für den DB-Insert */
function _toDbValue(val) {
    if (val === null || val === undefined) return null;
    if (Array.isArray(val) || (typeof val === 'object' && !(val instanceof Date))) {
        return JSON.stringify(val);
    }
    return val;
}

// ════════════════════════════════════════════════════════════════
//  SHOPIFY DATEN-EXPORT HANDLER
// ════════════════════════════════════════════════════════════════

/**
 * Shopify OAuth Flow starten
 * payload: { domain }
 * Öffnet die OAuth-URL im Browser
 */
ipcMain.handle('apiBridge:startShopifyOAuth', async (_, payload) => {
    try {
        const { domain } = payload;
        console.log(`[Shopify:startOAuth] Domain: ${domain}`);
        
        if (!domain?.trim()) throw new Error('Shop-Domain erforderlich');
        
        const { dbApi } = getDb();
        console.log(`[Shopify:startOAuth] Lade Credentials...`);
        const credentials = dbApi.getApiKey('shopify');
        
        if (!credentials) {
            console.error(`[Shopify:startOAuth] ✗ Keine Credentials gefunden`);
            throw new Error('Shopify Client ID und Secret nicht gespeichert');
        }
        console.log(`[Shopify:startOAuth] ✓ Credentials gefunden`);
        
        let clientId, clientSecret;
        try {
            const creds = JSON.parse(credentials);
            clientId = creds.clientId;
            clientSecret = creds.clientSecret;
        } catch {
            throw new Error('Ungültige Shopify-Anmeldedaten');
        }
        
        if (!clientId || !clientSecret) {
            throw new Error('Client ID oder Secret fehlt');
        }
        
        // OAuth-URL konstruieren
        const scopes = ['read_products', 'read_orders', 'read_customers'].join(',');
        const redirectUri = 'http://localhost:3000/shopify-callback'; // Local callback
        
        const oauthUrl = `https://${domain}/admin/oauth/authorize?` +
            `client_id=${encodeURIComponent(clientId)}&` +
            `scope=${encodeURIComponent(scopes)}&` +
            `redirect_uri=${encodeURIComponent(redirectUri)}`;
        
        console.log('[Shopify] OAuth URL öffnet:', oauthUrl);
        
        // Öffne in externem Browser
        await shell.openExternal(oauthUrl);
        
        return { ok: true };
    } catch (e) {
        console.error('[Shopify] startOAuth Fehler:', e);
        return { ok: false, error: e.message };
    }
});

/**
 * Hole gespeicherte Shopify Shop-Domain
 * Gibt den Store-Namen aus dem Access Token zurück
 */
ipcMain.handle('apiBridge:getShopifyDomain', async (_) => {
    try {
        const { dbApi } = getDb();
        const tokenJson = dbApi.getApiKey('shopify');
        
        if (!tokenJson) {
            return { ok: true, result: null };
        }
        
        let tokenData;
        try {
            tokenData = JSON.parse(tokenJson);
        } catch {
            return { ok: true, result: null };
        }
        
        return { ok: true, result: tokenData.store || null };
    } catch (e) {
        console.error('[Shopify] getShopifyDomain Fehler:', e);
        return { ok: false, error: e.message };
    }
});

/**
 * Shopify Token Request Handler (Client Credentials)
 * payload: { storeName }
 * VERALTET - wird durch OAuth ersetzt
 */
ipcMain.handle('shopify:requestToken', async (_, payload) => {
    try {
        const { storeName } = payload;
        
        if (!storeName?.trim()) throw new Error('Store-Name erforderlich');

        const { dbApi } = getDb();
        const key = dbApi.getApiKey('shopify');
        
        if (!key) throw new Error('Shopify-Anmeldedaten nicht gespeichert. Bitte zuerst Client ID und Secret speichern.');
        
        let clientId, clientSecret;
        try {
            const creds = JSON.parse(key);
            clientId = creds.clientId;
            clientSecret = creds.clientSecret;
        } catch {
            clientId = key;
            clientSecret = null;
        }

        if (!clientId || !clientSecret) {
            throw new Error('Unvollständige Shopify-Anmeldedaten');
        }

        // Erstelle neue Shopify-Instanz mit aktuellen Credentials
        const ShopifyAPI = require(path.join(__dirname, '../../components/api/Module/shopify-modul'));
        const shopifyApi = new ShopifyAPI({
            clientId,
            clientSecret,
            dbApi,
        });

        const result = await shopifyApi.requestAccessToken(storeName);
        if (!result || !result.store) {
            throw new Error('Token-Abruf fehlgeschlagen');
        }

        return { ok: true, store: result.store };
    } catch (e) {
        console.error('[Shopify] requestToken Fehler:', e);
        return { ok: false, error: e.message };
    }
});

/**
 * Shopify Daten-Abruf Handler
 * payload: { dataType, limit }
 * dataType: 'products' | 'orders' | 'customers'
 */
ipcMain.handle('shopify:fetchData', async (_, payload) => {
    try {
        const { dataType, limit } = payload;
        
        if (!['products', 'orders', 'customers'].includes(dataType)) {
            throw new Error(`Unbekannter Datentyp: ${dataType}`);
        }

        // Lade Shopify-Instanz
        const shopifyApi = getShopifyInstance();
        const { dbApi } = getDb();
        
        // Lade Access Token aus DB
        const tokenJson = dbApi.getApiKey('shopify');
        if (!tokenJson) {
            throw new Error('Kein Shopify Access Token gefunden - bitte zuerst OAuth durchführen');
        }
        
        let tokenData;
        try {
            tokenData = JSON.parse(tokenJson);
        } catch {
            throw new Error('Ungültiges Token-Format');
        }
        
        if (!tokenData.access_token || !tokenData.store) {
            throw new Error('Token unvollständig');
        }
        
        // Setze Token und Store in der API-Instanz
        shopifyApi.accessToken = tokenData.access_token;
        shopifyApi.store = tokenData.store;
        shopifyApi.baseUrl = `https://${tokenData.store}/admin/api/${shopifyApi.apiVersion}`;
        
        console.log(`[Shopify] Abrufen mit Store: ${shopifyApi.store}`);
        
        const ShopifyMapper = require(path.join(__dirname, '../../components/api/Module/shopify-data-mapper'));
        let rows = [];
        
        switch (dataType) {
            case 'products': {
                const result = await shopifyApi.getProducts(limit || 250);
                // getProducts() gibt bereits die vollständigen Rows zurück, keine Mapper nötig
                rows = result.rows || [];
                break;
            }
            case 'orders': {
                const result = await shopifyApi.getOrders(limit || 250, 'any');
                rows = ShopifyMapper.mapOrders(result.rows || []);
                break;
            }
            case 'customers': {
                const result = await shopifyApi.getCustomers(limit || 250);
                rows = ShopifyMapper.mapCustomers(result.rows || []);
                break;
            }
        }

        const schema = _inferSchema(rows);
        return { ok: true, rows, schema, count: rows.length };
    } catch (e) {
        console.error('[Shopify] fetchData Fehler:', e);
        return { ok: false, error: e.message };
    }
});

/**
 * Shopify DB-Export Handler
 * payload: { rows, tableName, mode, schema, dataType }
 */
ipcMain.handle('shopify:exportToDb', async (_, payload) => {
    try {
        const databaseEngine = require(path.join(__dirname, '../database-engine'));
        const { rows, tableName, mode, schema, dataType } = payload;

        if (!rows?.length) throw new Error('Keine Daten zum Exportieren');
        if (!tableName?.trim()) throw new Error('Kein Tabellenname angegeben');

        // Tabellen-Name bereinigen
        const safeTable = tableName.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');

        if (mode === 'new' || mode === 'replace') {
            if (mode === 'replace') {
                await databaseEngine.executeQuery(`DROP TABLE IF EXISTS "${safeTable}"`);
            }
            const colDefs = schema.map(col =>
                `"${col.name}" ${col.pgType || 'TEXT'}`
            ).join(', ');
            await databaseEngine.executeQuery(
                `CREATE TABLE IF NOT EXISTS "${safeTable}" (
                    _id SERIAL PRIMARY KEY,
                    _imported_at TIMESTAMPTZ DEFAULT NOW(),
                    _source VARCHAR(50) DEFAULT 'shopify',
                    _data_type VARCHAR(50) DEFAULT '${dataType || 'unknown'}',
                    ${colDefs}
                )`
            );
        }

        // Daten einfügen
        const cols = schema.map(c => c.name);
        let inserted = 0;
        const CHUNK = 500;

        for (let i = 0; i < rows.length; i += CHUNK) {
            const chunk = rows.slice(i, i + CHUNK);
            for (const row of chunk) {
                const vals = cols.map(c => _toDbValue(row[c]));
                const colList = cols.map(c => `"${c}"`).join(', ');
                const placeholders = vals.map((_, i) => `$${i + 1}`).join(', ');
                await databaseEngine.executeQuery(
                    `INSERT INTO "${safeTable}" (${colList}) VALUES (${placeholders})`,
                    vals
                );
                inserted++;
            }
        }

        console.log(`[Shopify] Erfolgreich ${inserted} Zeilen in ${safeTable} eingefügt`);
        return { ok: true, inserted };
    } catch (e) {
        console.error('[Shopify] exportToDb Fehler:', e);
        return { ok: false, error: e.message };
    }
});

/**
 * Shopify Tabellen laden
 * Gibt alle existierenden Shopify-Tabellen zurück
 */
ipcMain.handle('shopify:getTables', async () => {
    try {
        const databaseEngine = require(path.join(__dirname, '../database-engine'));
        const result = await databaseEngine.executeQuery(
            `SELECT table_name FROM information_schema.tables
             WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
             AND table_name LIKE 'shopify_%'
             ORDER BY table_name`
        );
        const tables = (result.rows || []).map(r => r.table_name);
        return { ok: true, tables };
    } catch (e) {
        console.error('[Shopify] getTables Fehler:', e);
        return { ok: false, error: e.message };
    }
});

module.exports = { registerApiBridgeHandlers };
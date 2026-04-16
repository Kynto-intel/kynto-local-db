/**
 * ═══════════════════════════════════════════════════════════════
 *  THE SOVEREIGN API-BRIDGE — database.js
 *  Lokale Daten-Souveränität: Einmal bezahlt, für immer besessen.
 * ═══════════════════════════════════════════════════════════════
 */

const Database = require('better-sqlite3');
const crypto   = require('crypto');
const path     = require('path');
const fs       = require('fs');

// ─── Pfad & Verschlüsselung ─────────────────────────────────────
const DB_DIR  = path.join(process.env.APPDATA || process.env.HOME, '.sovereign-bridge');
const DB_PATH = path.join(DB_DIR, 'sovereign.db');

if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

const db = new Database(DB_PATH);

// WAL-Mode für bessere Performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ─── Schema ─────────────────────────────────────────────────────
db.exec(`
  -- ┌─────────────────────────────────────┐
  -- │  API Konfigurationen & Zugangsdaten │
  -- └─────────────────────────────────────┘
  CREATE TABLE IF NOT EXISTS api_configs (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    category        TEXT DEFAULT 'custom',   -- 'weather','search','maps','mail','calendar','custom'
    base_url        TEXT NOT NULL,
    auth_type       TEXT DEFAULT 'none',     -- 'none','apikey','bearer','oauth2','basic'
    auth_config     TEXT DEFAULT '{}',       -- JSON: { keyParam, headerName, prefix }
    default_headers TEXT DEFAULT '{}',       -- JSON: immer gesendete Header
    default_params  TEXT DEFAULT '{}',       -- JSON: immer gesendete Query-Params
    rate_limit_ms   INTEGER DEFAULT 1000,    -- Mindestabstand zwischen Calls (ms)
    last_called_at  INTEGER DEFAULT 0,       -- Unix timestamp ms
    is_active       INTEGER DEFAULT 1,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- ┌─────────────────────────────────────┐
  -- │  API Keys (verschlüsselt gespeichert)│
  -- └─────────────────────────────────────┘
  CREATE TABLE IF NOT EXISTS api_keys (
    config_id   TEXT PRIMARY KEY,
    key_data    TEXT NOT NULL,               -- AES-256 verschlüsselt
    iv          TEXT NOT NULL
  );

  -- ┌─────────────────────────────────────┐
  -- │  Request Cache (Herzstück)          │
  -- └─────────────────────────────────────┘
  CREATE TABLE IF NOT EXISTS api_cache (
    request_hash    TEXT PRIMARY KEY,
    config_id       TEXT NOT NULL,
    endpoint        TEXT NOT NULL,
    params_json     TEXT NOT NULL,
    raw_response    TEXT,                    -- Roh-JSON der API
    mapped_data     TEXT,                    -- Bereinigtes JSON (nach KI-Mapping)
    status_code     INTEGER,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at      DATETIME,
    access_count    INTEGER DEFAULT 0,       -- Wie oft aus Cache bedient
    cost_saved      REAL DEFAULT 0.0,        -- Geschätzte gesparte Kosten (€)
    FOREIGN KEY(config_id) REFERENCES api_configs(id) ON DELETE CASCADE
  );

  -- ┌─────────────────────────────────────┐
  -- │  KI-Mappings (Schema-Erkennung)     │
  -- └─────────────────────────────────────┘
  CREATE TABLE IF NOT EXISTS api_mappings (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    config_id   TEXT NOT NULL,
    endpoint    TEXT NOT NULL,
    mapping     TEXT NOT NULL,              -- JSON: { "api.path": "clean_name" }
    confidence  REAL DEFAULT 1.0,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(config_id, endpoint),
    FOREIGN KEY(config_id) REFERENCES api_configs(id) ON DELETE CASCADE
  );

  -- ┌─────────────────────────────────────┐
  -- │  Request Logs (Audit & Analyse)     │
  -- └─────────────────────────────────────┘
  CREATE TABLE IF NOT EXISTS request_logs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    config_id   TEXT,
    endpoint    TEXT,
    params_json TEXT,
    source      TEXT DEFAULT 'api',         -- 'api' oder 'cache'
    status_code INTEGER,
    duration_ms INTEGER,
    error_msg   TEXT,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- ┌─────────────────────────────────────┐
  -- │  Retention-Regeln                   │
  -- └─────────────────────────────────────┘
  CREATE TABLE IF NOT EXISTS retention_rules (
    config_id       TEXT PRIMARY KEY,
    mode            TEXT DEFAULT 'ttl',     -- 'ttl','permanent','disabled'
    ttl_hours       INTEGER DEFAULT 24,
    max_entries     INTEGER DEFAULT 1000,
    auto_archive    INTEGER DEFAULT 0,      -- historische DB aufbauen
    FOREIGN KEY(config_id) REFERENCES api_configs(id) ON DELETE CASCADE
  );

  -- ┌─────────────────────────────────────┐
  -- │  Historisches Archiv                │
  -- └─────────────────────────────────────┘
  CREATE TABLE IF NOT EXISTS data_archive (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    config_id   TEXT,
    endpoint    TEXT,
    data        TEXT,                       -- JSON
    snapshot_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- ┌─────────────────────────────────────┐
  -- │  Allgemeine Secrets (KEIN FK!)      │
  -- │  Für OAuth Refresh Tokens u.ä.     │
  -- └─────────────────────────────────────┘
  CREATE TABLE IF NOT EXISTS api_secrets (
    key       TEXT PRIMARY KEY,   -- beliebiger Schlüsselname, z.B. 'gsc:refresh_token'
    key_data  TEXT NOT NULL,      -- AES-256 verschlüsselt
    iv        TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Indizes für Performance
  CREATE INDEX IF NOT EXISTS idx_cache_config   ON api_cache(config_id);
  CREATE INDEX IF NOT EXISTS idx_cache_expires  ON api_cache(expires_at);
  CREATE INDEX IF NOT EXISTS idx_logs_config    ON request_logs(config_id);
  CREATE INDEX IF NOT EXISTS idx_logs_created   ON request_logs(created_at);
  CREATE INDEX IF NOT EXISTS idx_archive_config ON data_archive(config_id, snapshot_at);
`);

// ─── Migration: Alte api_keys Tabelle mit Foreign Key entfernen ─────
try {
  const hasOldApiKeys = db.prepare(`
    SELECT sql FROM sqlite_master 
    WHERE type='table' AND name='api_keys' AND sql LIKE '%FOREIGN KEY%'
  `).get();
  
  if (hasOldApiKeys) {
    console.log('[DB Migration] Migriere api_keys Tabelle (entferne Foreign Key)...');
    
    // Speichere alte Daten
    const oldData = db.prepare('SELECT * FROM api_keys').all();
    
    // Lösche alte Tabelle
    db.exec('DROP TABLE api_keys');
    
    // Erstelle neue Tabelle ohne Foreign Key
    db.exec(`
      CREATE TABLE api_keys (
        config_id   TEXT PRIMARY KEY,
        key_data    TEXT NOT NULL,
        iv          TEXT NOT NULL
      )
    `);
    
    // Stelle Daten wieder her
    for (const row of oldData) {
      db.prepare(`
        INSERT INTO api_keys (config_id, key_data, iv) 
        VALUES (?, ?, ?)
      `).run(row.config_id, row.key_data, row.iv);
    }
    
    console.log('[DB Migration] ✓ api_keys Tabelle erfolgreich migriert');
  }
} catch (e) {
  console.error('[DB Migration] Fehler bei api_keys Migration:', e.message);
}

// ─── Verschlüsselung ─────────────────────────────────────────────
// Schlüssel aus Maschinen-ID ableiten (kein Server nötig)
function getMachineKey() {
  const seed = process.env.SOVEREIGN_KEY
    || (process.env.USERNAME || 'user') + (process.env.COMPUTERNAME || 'pc') + 'sovereign-bridge';
  return crypto.createHash('sha256').update(seed).digest(); // 32 Bytes
}

function encryptKey(plaintext) {
  const iv  = crypto.randomBytes(16);
  const key = getMachineKey();
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return { key_data: encrypted.toString('hex'), iv: iv.toString('hex') };
}

function decryptKey(keyData, iv) {
  const key     = getMachineKey();
  const ivBuf   = Buffer.from(iv, 'hex');
  const encBuf  = Buffer.from(keyData, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, ivBuf);
  return Buffer.concat([decipher.update(encBuf), decipher.final()]).toString('utf8');
}

// ─── Hilfsfunktionen ─────────────────────────────────────────────
function buildRequestHash(configId, endpoint, params) {
  return crypto.createHash('sha256')
    .update(configId + endpoint + JSON.stringify(params))
    .digest('hex');
}

function safeJson(str, fallback = {}) {
  try { return JSON.parse(str || '{}'); } catch { return fallback; }
}

// ─── Haupt-DB-API ────────────────────────────────────────────────
const dbApi = {
  // Config CRUD
  getConfig:    (id) => db.prepare('SELECT * FROM api_configs WHERE id = ?').get(id),
  getAllConfigs: ()   => db.prepare('SELECT * FROM api_configs WHERE is_active = 1 ORDER BY category, name').all(),
  
  saveConfig(config) {
    db.prepare(`
      INSERT INTO api_configs (id, name, category, base_url, auth_type, auth_config, default_headers, default_params, rate_limit_ms)
      VALUES (@id, @name, @category, @base_url, @auth_type, @auth_config, @default_headers, @default_params, @rate_limit_ms)
      ON CONFLICT(id) DO UPDATE SET
        name=excluded.name, category=excluded.category, base_url=excluded.base_url,
        auth_type=excluded.auth_type, auth_config=excluded.auth_config,
        default_headers=excluded.default_headers, default_params=excluded.default_params,
        rate_limit_ms=excluded.rate_limit_ms
    `).run({
      id: config.id,
      name: config.name,
      category: config.category || 'custom',
      base_url: config.base_url,
      auth_type: config.auth_type || 'none',
      auth_config: JSON.stringify(config.auth_config || {}),
      default_headers: JSON.stringify(config.default_headers || {}),
      default_params: JSON.stringify(config.default_params || {}),
      rate_limit_ms: config.rate_limit_ms || 1000,
    });
  },

  deleteConfig(id) {
    db.prepare('DELETE FROM api_configs WHERE id = ?').run(id);
  },

  // API Keys (verschlüsselt)
  saveApiKey(configId, plainKey) {
    const { key_data, iv } = encryptKey(plainKey);
    db.prepare(`
      INSERT INTO api_keys (config_id, key_data, iv) VALUES (?, ?, ?)
      ON CONFLICT(config_id) DO UPDATE SET key_data=excluded.key_data, iv=excluded.iv
    `).run(configId, key_data, iv);
  },

  getApiKey(configId) {
    const row = db.prepare('SELECT * FROM api_keys WHERE config_id = ?').get(configId);
    if (!row) return null;
    return decryptKey(row.key_data, row.iv);
  },

  // Cache
  getCached(requestHash) {
    return db.prepare(`
      SELECT * FROM api_cache 
      WHERE request_hash = ? AND (expires_at IS NULL OR expires_at > DATETIME('now'))
    `).get(requestHash);
  },

  saveCache(data) {
    db.prepare(`
      INSERT OR REPLACE INTO api_cache 
        (request_hash, config_id, endpoint, params_json, raw_response, mapped_data, status_code, expires_at)
      VALUES (@request_hash, @config_id, @endpoint, @params_json, @raw_response, @mapped_data, @status_code, @expires_at)
    `).run(data);
  },

  incrementCacheHit(requestHash, costSaved = 0) {
    db.prepare(`
      UPDATE api_cache SET access_count = access_count + 1, cost_saved = cost_saved + ?
      WHERE request_hash = ?
    `).run(costSaved, requestHash);
  },

  clearCache(configId) {
    if (configId) db.prepare('DELETE FROM api_cache WHERE config_id = ?').run(configId);
    else          db.prepare('DELETE FROM api_cache').run();
  },

  // Mappings
  getMapping(configId, endpoint) {
    const row = db.prepare('SELECT mapping FROM api_mappings WHERE config_id = ? AND endpoint = ?').get(configId, endpoint);
    return row ? safeJson(row.mapping) : null;
  },

  saveMapping(configId, endpoint, mapping) {
    db.prepare(`
      INSERT INTO api_mappings (config_id, endpoint, mapping) VALUES (?, ?, ?)
      ON CONFLICT(config_id, endpoint) DO UPDATE SET mapping=excluded.mapping
    `).run(configId, endpoint, JSON.stringify(mapping));
  },

  // Logs
  log(entry) {
    db.prepare(`
      INSERT INTO request_logs (config_id, endpoint, params_json, source, status_code, duration_ms, error_msg)
      VALUES (@config_id, @endpoint, @params_json, @source, @status_code, @duration_ms, @error_msg)
    `).run(entry);
  },

  getStats(configId) {
    return db.prepare(`
      SELECT 
        COUNT(*) as total_requests,
        SUM(CASE WHEN source='cache' THEN 1 ELSE 0 END) as cache_hits,
        SUM(CASE WHEN source='api'   THEN 1 ELSE 0 END) as api_calls,
        ROUND(AVG(CASE WHEN source='api' THEN duration_ms END), 0) as avg_api_ms,
        SUM(cost_saved) as total_cost_saved
      FROM request_logs r
      LEFT JOIN api_cache c ON c.config_id = r.config_id
      WHERE r.config_id = ?
    `).get(configId);
  },

  getGlobalStats() {
    return db.prepare(`
      SELECT
        (SELECT COUNT(*) FROM api_cache)       as cached_responses,
        (SELECT SUM(access_count) FROM api_cache) as total_cache_hits,
        (SELECT SUM(cost_saved) FROM api_cache)   as total_saved,
        (SELECT COUNT(*) FROM api_configs WHERE is_active=1) as active_apis,
        (SELECT COUNT(*) FROM request_logs)       as total_requests
    `).get();
  },

  // Retention
  getRetention: (configId) => db.prepare('SELECT * FROM retention_rules WHERE config_id = ?').get(configId),

  saveRetention(configId, rule) {
    db.prepare(`
      INSERT INTO retention_rules (config_id, mode, ttl_hours, max_entries, auto_archive)
      VALUES (@config_id, @mode, @ttl_hours, @max_entries, @auto_archive)
      ON CONFLICT(config_id) DO UPDATE SET
        mode=excluded.mode, ttl_hours=excluded.ttl_hours,
        max_entries=excluded.max_entries, auto_archive=excluded.auto_archive
    `).run({ config_id: configId, ...rule });
  },

  // Archiv (historische Daten)
  archive(configId, endpoint, data) {
    db.prepare('INSERT INTO data_archive (config_id, endpoint, data) VALUES (?, ?, ?)').run(configId, endpoint, JSON.stringify(data));
  },

  getArchive(configId, endpoint, limit = 100) {
    return db.prepare(`
      SELECT * FROM data_archive WHERE config_id = ? AND endpoint = ?
      ORDER BY snapshot_at DESC LIMIT ?
    `).all(configId, endpoint, limit);
  },

  // ─── Secrets (ohne FK-Constraint) ───────────────────────────
  // Für OAuth Refresh Tokens und andere Werte die keinen api_configs-Eintrag brauchen.

  saveSecret(key, plaintext) {
    const { key_data, iv } = encryptKey(plaintext);
    db.prepare(`
      INSERT INTO api_secrets (key, key_data, iv) VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET key_data=excluded.key_data, iv=excluded.iv
    `).run(key, key_data, iv);
  },

  getSecret(key) {
    const row = db.prepare('SELECT * FROM api_secrets WHERE key = ?').get(key);
    if (!row) return null;
    try { return decryptKey(row.key_data, row.iv); }
    catch { return null; }
  },

  deleteSecret(key) {
    db.prepare('DELETE FROM api_secrets WHERE key = ?').run(key);
  },
};

module.exports = { db, dbApi, buildRequestHash, safeJson };
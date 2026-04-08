const fastify = require('fastify')({ logger: false });
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

// WebSocket & Realtime-Unterstützung
const WebSocket = require('ws');
const EventEmitter = require('events');

// ═══════════════════════════════════════════════════════════════════════
// REALTIME EVENT BUS — für Broadcast an alle WebSocket Clients
// ═══════════════════════════════════════════════════════════════════════
const realtimeEmitter = new EventEmitter();
realtimeEmitter.setMaxListeners(100);

const connectedClients = new Map(); // userId -> Set<WebSocket>
const subscriptions = new Map();    // tableId -> Set<userId>

// ═══════════════════════════════════════════════════════════════════════
// SECURITY & CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════
const JWT_SECRET = process.env.KYNTO_JWT_SECRET || 'your-super-secret-key-change-in-production';
const API_PORT = parseInt(process.env.KYNTO_API_PORT || '54321');
const API_HOST = process.env.KYNTO_API_HOST || '127.0.0.1';
const DATA_DIR = process.env.KYNTO_DATA_DIR || path.join(process.cwd(), 'data');
const API_KEYS_FILE = path.join(DATA_DIR, 'api-keys.json');

// Erlaubte Operationen für SQL Injection Prevention
const ALLOWED_OPERATIONS = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'CALL'];

// Hash-Felder (können in Zukunft dynamisch geladen werden)
const HASH_FIELDS = ['password', 'email_private', 'api_key'];
const HASH_SECRET = process.env.KYNTO_HASH_SECRET || 'your-hash-pepper';

// ═══════════════════════════════════════════════════════════════════════
// API KEYS — Lade aus Datei
// ═══════════════════════════════════════════════════════════════════════
let apiKeys = [];

function loadApiKeys() {
    try {
        if (fs.existsSync(API_KEYS_FILE)) {
            apiKeys = JSON.parse(fs.readFileSync(API_KEYS_FILE, 'utf8'));
            console.log(`[API] ${apiKeys.length} API Keys geladen`);
        }
    } catch (err) {
        console.warn('[API] Fehler beim Laden von API Keys:', err.message);
        apiKeys = [];
    }
}

function saveApiKeys() {
    try {
        fs.writeFileSync(API_KEYS_FILE, JSON.stringify(apiKeys, null, 2), 'utf8');
    } catch (err) {
        console.warn('[API] Fehler beim Speichern von API Keys:', err.message);
    }
}

// Lade API Keys beim Starten
loadApiKeys();

// ═══════════════════════════════════════════════════════════════════════
// SECURITY: Token & RLS Authentifizierung
// ═══════════════════════════════════════════════════════════════════════

/**
 * Validiere einen API Key (aus Kynto UI generiert)
 * Markiert den Key als "verwendet" nach Authentifizierung
 */
function validateApiKey(token) {
    const keyIndex = apiKeys.findIndex(key => key.token === token);
    
    if (keyIndex === -1) return false;
    
    const key = apiKeys[keyIndex];
    
    // Markiere Key als verwendet (aber lösche ihn nicht!)
    // Das gibt dem Nutzer die Chance zu sehen welche Keys verwendet wurden
    key.used = true;
    key.lastUsed = new Date().toISOString();
    saveApiKeys();
    
    console.log(`[API] Key '${key.label}' wurde verwendet`);
    return true;
}

/**
 * JWT Token generieren (Legacy - für direkte Token-Generierung)
 */
function generateToken(userId, role = 'user', metadata = {}) {
    return jwt.sign(
        { userId, role, metadata, iat: Date.now() },
        JWT_SECRET,
        { expiresIn: '24h' }
    );
}

/**
 * JWT Token validieren
 */
function validateToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (err) {
        return null;
    }
}

/**
 * Auth Middleware — Extract & Validate Token (API Key oder JWT)
 * 
 * PRIORITÄT:
 * 1. Prüfe auf API Key (generiert aus Kynto UI)
 * 2. Prüfe auf JWT Token (Fallback)
 * 3. Prüfe auf X-User-ID Header (Test/Development)
 */
async function authenticateRequest(request, reply) {
    const authHeader = request.headers.authorization;
    const token = authHeader?.replace('Bearer ', '');
    const userId = request.headers['x-user-id'];

    if (!token && !userId) {
        return reply.status(401).send({ 
            error: 'Authentifizierung erforderlich',
            details: 'Bearer Token oder X-User-ID Header fehlt'
        });
    }

    let user = { userId: userId || 'anonymous', role: 'user' };
    
    if (token) {
        // 1. Prüfe auf API Key (Priorität!)
        if (validateApiKey(token)) {
            // API Key ist gültig
            user = { userId: 'api-user', role: 'api', apiKeyUsed: true };
        } else {
            // 2. Prüfe auf JWT Token
            const decoded = validateToken(token);
            if (!decoded) {
                return reply.status(401).send({ error: 'Ungültiger Token' });
            }
            user = decoded;
        }
    }

    request.user = user;
}

/**
 * Database Selector — Wähle DB basierend auf Header
 * Header: X-Database: local oder remote
 */
function selectDatabase(request, databases) {
    const dbChoice = (request.headers['x-database'] || 'local').toLowerCase();
    
    // Validiere Choice
    if (dbChoice === 'remote' && !databases.remote) {
        throw new Error('Remote Datenbank nicht verfügbar. Nutze local.');
    }
    
    return databases[dbChoice] || databases.local;
}

/**
 * RLS aktivieren — setzt PostgreSQL GUC Variable für Row-Level Security
 */
async function enableRLS(db, userId, role = 'user') {
    try {
        // PGlite benötigt string literals statt parametrisierte queries für SET LOCAL
        const safeUserId = userId.replace(/'/g, "''");
        const safeRole = role.replace(/'/g, "''");
        
        // Nutze string literals statt $1/$2
        await db.query(`SET LOCAL app.current_user_id = '${safeUserId}'`);
        await db.query(`SET LOCAL app.current_user_role = '${safeRole}'`);
        return true;
    } catch (err) {
        // RLS ist optional - wenn es fehlschlägt, weitermachen
        console.warn(`[RLS] Fehler beim Setzen (optional): ${err.message}`);
        return false;
    }
}

// ═══════════════════════════════════════════════════════════════════════
// DATA SECURITY: Hashing & Validation
// ═══════════════════════════════════════════════════════════════════════

/**
 * Sensitive Felder hashen (z.B. Passwörter, Private Keys)
 */
function hashSensitiveFields(data, fieldsToHash = HASH_FIELDS) {
    const hashedData = { ...data };
    
    for (const field of fieldsToHash) {
        if (field in hashedData && hashedData[field]) {
            hashedData[field] = crypto
                .createHmac('sha256', HASH_SECRET)
                .update(String(hashedData[field]))
                .digest('hex');
        }
    }
    
    return hashedData;
}

/**
 * SQL Injection Protection — Table & Column Names validieren
 */
function validateIdentifier(identifier) {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier)) {
        throw new Error(`Ungültige Tabellenname: "${identifier}"`);
    }
    return identifier;
}

/**
 * Sichere SQL Query zusammenstellen
 */
function buildSafeQuery(table, data = {}, action = 'INSERT') {
    const validTable = validateIdentifier(table);
    const columns = Object.keys(data);
    
    for (const col of columns) {
        validateIdentifier(col); // Prüfe Spaltennamen
    }

    if (action === 'INSERT' && columns.length === 0) {
        throw new Error('Keine Daten zum Einfügen angegeben');
    }

    const values = Object.values(data);
    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
    const columnList = columns.join(', ');

    return {
        sql: `INSERT INTO ${validTable} (${columnList}) VALUES (${placeholders}) RETURNING *`,
        values
    };
}

// ═══════════════════════════════════════════════════════════════════════
// API ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════

/**
 * Der API Server für deine Engine
 * @param {object} localDb - PGlite Datenbank (immer vorhanden)
 * @param {object} wsServer - WebSocket Server für Realtime (optional)
 * @param {object} remoteDb - Remote PostgreSQL Datenbank (optional)
 */
async function startApi(localDb, wsServer = null, remoteDb = null) {
    
    // Speichere BEIDE Datenbanken
    const databases = {
        local: localDb,
        remote: remoteDb
    };
    
    // ─────────────────────────────────────────────────────────────────
    // CORS & Middleware
    // ─────────────────────────────────────────────────────────────────
    await fastify.register(require('@fastify/cors'), {
        origin: process.env.KYNTO_ALLOWED_ORIGINS?.split(',') || '*',
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-User-ID', 'X-API-Key']
    });

    // ─────────────────────────────────────────────────────────────────
    // HEALTH CHECK
    // ─────────────────────────────────────────────────────────────────
    fastify.get('/health', async (request, reply) => {
        try {
            const db = selectDatabase(request, databases);
            const result = await db.query('SELECT 1');
            return { 
                status: 'ok', 
                database: 'connected',
                timestamp: new Date().toISOString(),
                dbUsed: request.headers['x-database'] || 'local'
            };
        } catch (err) {
            return reply.status(503).send({ 
                status: 'error', 
                database: 'disconnected',
                error: err.message 
            });
        }
    });

    // ─────────────────────────────────────────────────────────────────
    // AUTH: Tokens generieren
    // ─────────────────────────────────────────────────────────────────
    fastify.post('/auth/token', async (request, reply) => {
        const { userId, role = 'user', email } = request.body;

        if (!userId) {
            return reply.status(400).send({ error: 'userId erforderlich' });
        }

        const token = generateToken(userId, role, { email });
        return { 
            token, 
            userId, 
            role,
            expiresIn: '24h'
        };
    });

    // ─────────────────────────────────────────────────────────────────
    // GET: Daten auslesen mit RLS & Authentifizierung
    // ─────────────────────────────────────────────────────────────────
    fastify.get('/data/:table', async (request, reply) => {
        await authenticateRequest(request, reply);
        if (reply.sent) return;

        const { table } = request.params;
        const { columns = '*', where = '', limit = 100, offset = 0 } = request.query;

        try {
            const db = selectDatabase(request, databases);
            const validTable = validateIdentifier(table);
            
            // RLS aktivieren
            await enableRLS(db, request.user.userId, request.user.role);

            // Sichere Query zusammenstellen
            let sql = `SELECT ${columns} FROM ${validTable}`;
            let params = [];

            if (where) {
                // Basis-WHERE Validierung (komplexe Queries sollten über Stored Procedures gehen)
                sql += ` WHERE ${where}`;
            }

            sql += ` LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`;

            const result = await db.query(sql, params);

            // Realtime Subscription hinzufügen
            if (!subscriptions.has(table)) {
                subscriptions.set(table, new Set());
            }
            subscriptions.get(table).add(request.user.userId);

            return {
                success: true,
                table,
                count: result.rows?.length || 0,
                data: result.rows || [],
                user: request.user.userId,
                database: request.headers['x-database'] || 'local'
            };
        } catch (err) {
            console.error(`[GET /data/:table] Fehler: ${err.message}`);
            return reply.status(500).send({ 
                error: 'Datenabruf fehlgeschlagen',
                details: err.message 
            });
        }
    });

    // ─────────────────────────────────────────────────────────────────
    // POST: Neue Daten einfügen
    // ─────────────────────────────────────────────────────────────────
    fastify.post('/data/:table', async (request, reply) => {
        await authenticateRequest(request, reply);
        if (reply.sent) return;

        const { table } = request.params;
        let data = request.body;

        try {
            const db = selectDatabase(request, databases);
            const validTable = validateIdentifier(table);

            // Sensitive Felder hashen
            data = hashSensitiveFields(data);

            // RLS aktivieren
            await enableRLS(db, request.user.userId, request.user.role);

            // Sichere Query bauen
            const { sql, values } = buildSafeQuery(validTable, data, 'INSERT');

            const result = await db.query(sql, values);
            const insertedRow = result.rows?.[0];

            // Realtime Event broadcasten
            broadcastRealtimeEvent('INSERT', table, insertedRow);

            return {
                success: true,
                action: 'INSERT',
                table,
                data: insertedRow,
                user: request.user.userId,
                database: request.headers['x-database'] || 'local'
            };
        } catch (err) {
            console.error(`[POST /data/:table] Fehler: ${err.message}`);
            return reply.status(500).send({ 
                error: 'Daten einfügen fehlgeschlagen',
                details: err.message 
            });
        }
    });

    // ─────────────────────────────────────────────────────────────────
    // PUT: Daten aktualisieren
    // ─────────────────────────────────────────────────────────────────
    fastify.put('/data/:table/:id', async (request, reply) => {
        await authenticateRequest(request, reply);
        if (reply.sent) return;

        const { table, id } = request.params;
        let data = request.body;

        try {
            const db = selectDatabase(request, databases);
            const validTable = validateIdentifier(table);

            // Sensitive Felder hashen
            data = hashSensitiveFields(data);

            // RLS aktivieren
            await enableRLS(db, request.user.userId, request.user.role);

            // UPDATE Query bauen
            const setClause = Object.keys(data)
                .map((col, i) => `${validateIdentifier(col)} = $${i + 1}`)
                .join(', ');

            const values = [...Object.values(data), id];
            const sql = `UPDATE ${validTable} SET ${setClause} WHERE id = $${values.length} RETURNING *`;

            const result = await db.query(sql, values);
            const updatedRow = result.rows?.[0];

            // Realtime Event
            broadcastRealtimeEvent('UPDATE', table, updatedRow);

            return {
                success: true,
                action: 'UPDATE',
                table,
                id,
                data: updatedRow,
                user: request.user.userId,
                database: request.headers['x-database'] || 'local'
            };
        } catch (err) {
            console.error(`[PUT /data/:table/:id] Fehler: ${err.message}`);
            return reply.status(500).send({ 
                error: 'Daten aktualisieren fehlgeschlagen',
                details: err.message 
            });
        }
    });

    // ─────────────────────────────────────────────────────────────────
    // DELETE: Daten löschen
    // ─────────────────────────────────────────────────────────────────
    fastify.delete('/data/:table/:id', async (request, reply) => {
        await authenticateRequest(request, reply);
        if (reply.sent) return;

        const { table, id } = request.params;

        try {
            const db = selectDatabase(request, databases);
            const validTable = validateIdentifier(table);

            // RLS aktivieren
            await enableRLS(db, request.user.userId, request.user.role);

            const sql = `DELETE FROM ${validTable} WHERE id = $1 RETURNING *`;
            const result = await db.query(sql, [id]);

            // Realtime Event
            broadcastRealtimeEvent('DELETE', table, { id });

            return {
                success: true,
                action: 'DELETE',
                table,
                id,
                user: request.user.userId,
                database: request.headers['x-database'] || 'local'
            };
        } catch (err) {
            console.error(`[DELETE /data/:table/:id] Fehler: ${err.message}`);
            return reply.status(500).send({ 
                error: 'Daten löschen fehlgeschlagen',
                details: err.message 
            });
        }
    });

    // ─────────────────────────────────────────────────────────────────
    // Advanced Query (für komplexere Queries)
    // ─────────────────────────────────────────────────────────────────
    fastify.post('/query', async (request, reply) => {
        await authenticateRequest(request, reply);
        if (reply.sent) return;

        const { sql, params = [] } = request.body;

        try {
            const db = selectDatabase(request, databases);
            
            // Basic SQL Injection Check
            const firstWord = sql.trim().split(/\s+/)[0].toUpperCase();
            if (!ALLOWED_OPERATIONS.includes(firstWord)) {
                return reply.status(403).send({ 
                    error: 'Operation nicht erlaubt',
                    allowed: ALLOWED_OPERATIONS
                });
            }

            // RLS aktivieren
            await enableRLS(db, request.user.userId, request.user.role);

            const result = await db.query(sql, params);

            return {
                success: true,
                rows: result.rows || [],
                rowCount: result.rowCount || result.rows?.length || 0,
                user: request.user.userId,
                database: request.headers['x-database'] || 'local'
            };
        } catch (err) {
            console.error(`[POST /query] Fehler: ${err.message}`);
            return reply.status(500).send({ 
                error: 'Query-Ausführung fehlgeschlagen',
                details: err.message 
            });
        }
    });

    // ─────────────────────────────────────────────────────────────────
    // REALTIME: WebSocket Connection für Live Updates
    // ─────────────────────────────────────────────────────────────────
    if (wsServer) {
        wsServer.on('connection', (ws, req) => {
            const token = new URL(`http://localhost${req.url}`).searchParams.get('token');
            const userId = new URL(`http://localhost${req.url}`).searchParams.get('userId');

            let user = { userId: userId || 'anonymous' };

            if (token) {
                const decoded = validateToken(token);
                if (decoded) {
                    user = decoded;
                }
            }

            // Client zur Liste hinzufügen
            if (!connectedClients.has(user.userId)) {
                connectedClients.set(user.userId, new Set());
            }
            connectedClients.get(user.userId).add(ws);

            console.log(`[WebSocket] Client verbunden: ${user.userId}`);

            // Nachrichten empfangen
            ws.on('message', (message) => {
                try {
                    const msg = JSON.parse(message);
                    
                    if (msg.type === 'subscribe') {
                        // Abonniere Updates für eine Tabelle
                        if (!subscriptions.has(msg.table)) {
                            subscriptions.set(msg.table, new Set());
                        }
                        subscriptions.get(msg.table).add(user.userId);
                        ws.send(JSON.stringify({ type: 'subscribed', table: msg.table }));
                    }
                } catch (err) {
                    console.error(`[WebSocket] Parse-Fehler: ${err.message}`);
                }
            });

            ws.on('close', () => {
                connectedClients.get(user.userId)?.delete(ws);
                console.log(`[WebSocket] Client getrennt: ${user.userId}`);
            });

            ws.on('error', (err) => {
                console.error(`[WebSocket] Fehler: ${err.message}`);
            });
        });
    }

    // ─────────────────────────────────────────────────────────────────
    // START SERVER
    // ─────────────────────────────────────────────────────────────────
    try {
        const address = await fastify.listen({ 
            port: API_PORT, 
            host: API_HOST 
        });
        console.log(`✅ [API-Server] Aktiv auf ${address}`);
        console.log(`   - RLS Policies: Aktiv`);
        console.log(`   - Authentifizierung: JWT Token`);
        console.log(`   - Realtime: WebSocket-bereit`);
        return address;
    } catch (err) {
        console.error('❌ [API-Server] KRITISCHER FEHLER:', err);
        throw err;
    }
}

// ═══════════════════════════════════════════════════════════════════════
// REALTIME BROADCAST
// ═══════════════════════════════════════════════════════════════════════

/**
 * Broadcast Realtime Event an alle verbundenen Clients (WebSocket)
 */
function broadcastRealtimeEvent(action, table, data) {
    const subscribers = subscriptions.get(table);
    if (!subscribers) return;

    const event = {
        type: 'realtime',
        action,
        table,
        data,
        timestamp: new Date().toISOString()
    };

    for (const userId of subscribers) {
        const clientSockets = connectedClients.get(userId);
        if (clientSockets) {
            for (const ws of clientSockets) {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify(event));
                }
            }
        }
    }
}

module.exports = { startApi, generateToken, validateToken, enableRLS };
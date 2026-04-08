/* ══════════════════════════════════════════════════════════════════════
   api-server.js — Express-basierter REST API Server
   
   Automatische REST-API-Generierung aus PostgreSQL-Tabellen
   Ersetzt PostgREST - keine externe Binary nötig!
   ══════════════════════════════════════════════════════════════════════ */

const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

let apiServer = null;
let apiPool = null;
let apiApp = null;

/**
 * Starten Sie den API-Server
 */
async function startAPIServer(connectionString, port = 3001) {
    return new Promise((resolve, reject) => {
        try {
            // Wenn bereits läuft, return
            if (apiServer) {
                console.log('[API Server] Server läuft bereits auf Port', port);
                resolve({
                    success: true,
                    port,
                    url: `http://127.0.0.1:${port}`,
                    message: 'API-Server läuft bereits'
                });
                return;
            }

            // Express App erstellen
            apiApp = express();
            
            // Middleware
            apiApp.use(cors());
            apiApp.use(express.json());
            apiApp.use(express.urlencoded({ extended: true }));

            // PostgreSQL Pool erstellen
            apiPool = new Pool({ connectionString });

            // Haupt-Health-Check Endpoint
            apiApp.get('/', (req, res) => {
                res.json({
                    status: 'ok',
                    message: 'Kynto Instant API aktiv',
                    timestamp: new Date().toISOString()
                });
            });

            // API-Dokumentation
            apiApp.get('/api/info', async (req, res) => {
                try {
                    const tables = await getTables();
                    const endpoints = await generateEndpoints(tables);
                    
                    res.json({
                        name: 'Kynto Instant API',
                        version: '1.0.0',
                        tables: tables.length,
                        endpoints: endpoints.length,
                        baseUrl: `http://127.0.0.1:${port}`,
                        endpoints
                    });
                } catch (err) {
                    res.status(500).json({ error: err.message });
                }
            });

            // Endpoints für alle Tabellen dynamisch generieren
            apiApp.get('/api/tables', getTablesHandler);
            apiApp.get('/api/schema', getSchemaHandler);
            apiApp.get('/api/docs', getDocsHandler);
            apiApp.get('/api/tables/:table', getTableHandler);
            apiApp.post('/api/tables/:table', createRowHandler);
            apiApp.put('/api/tables/:table/:id', updateRowHandler);
            apiApp.delete('/api/tables/:table/:id', deleteRowHandler);
            apiApp.patch('/api/tables/:table/:id', updateRowHandler);

            // Server starten
            apiServer = apiApp.listen(port, '127.0.0.1', () => {
                console.log(`[API Server] Läuft auf http://127.0.0.1:${port}`);
                resolve({
                    success: true,
                    port,
                    url: `http://127.0.0.1:${port}`,
                    message: 'API-Server erfolgreich gestartet'
                });
            });

            apiServer.on('error', (err) => {
                console.error('[API Server] Server-Fehler:', err.message);
                apiServer = null;
                reject(err);
            });

        } catch (err) {
            console.error('[API Server] Fehler beim Starten:', err.message);
            apiServer = null;
            reject(err);
        }
    });
}

/**
 * Stoppe den API-Server
 */
async function stopAPIServer() {
    return new Promise((resolve) => {
        if (!apiServer) {
            console.log('[API Server] Kein Server läuft');
            resolve({ success: true });
            return;
        }

        apiServer.close(async () => {
            console.log('[API Server] Server gestoppt');
            apiServer = null;

            if (apiPool) {
                await apiPool.end();
                apiPool = null;
            }

            resolve({ success: true });
        });
    });
}

/**
 * Hole alle Tablenen
 */
async function getTables() {
    const query = `
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        ORDER BY table_name
    `;
    
    const result = await apiPool.query(query);
    return result.rows.map(r => r.table_name);
}

/**
 * Hole Tabellen MIT detaillierten Infos (Spalten, Count, etc)
 */
async function getTablesWithInfo() {
    const tables = await getTables();
    const tablesInfo = [];

    for (const table of tables) {
        try {
            // Zähle Einträge
            const countQuery = `SELECT COUNT(*) as count FROM public."${table}"`;
            const countResult = await apiPool.query(countQuery);
            const count = parseInt(countResult.rows[0].count);

            // Hole Spalten
            const columnsQuery = `
                SELECT column_name, data_type, is_nullable
                FROM information_schema.columns
                WHERE table_name = $1
                ORDER BY ordinal_position
            `;
            const columnsResult = await apiPool.query(columnsQuery, [table]);
            const columns = columnsResult.rows.map(r => ({
                name: r.column_name,
                type: r.data_type,
                nullable: r.is_nullable === 'YES'
            }));

            tablesInfo.push({
                name: table,
                count,
                columns,
                endpoints: [
                    { method: 'GET', path: `/api/tables/${table}` },
                    { method: 'POST', path: `/api/tables/${table}` },
                    { method: 'PUT', path: `/api/tables/${table}/:id` },
                    { method: 'DELETE', path: `/api/tables/${table}/:id` }
                ]
            });
        } catch (err) {
            console.error(`[API] Fehler bei Tabelle ${table}:`, err.message);
        }
    }

    return tablesInfo;
}

/**
 * Generiere Endpoints aus Tabellen
 */
async function generateEndpoints(tables) {
    const endpoints = [];

    for (const table of tables) {
        endpoints.push({
            method: 'GET',
            path: `/api/tables/${table}`,
            description: `Alle Einträge aus "${table}" abrufen`
        });

        endpoints.push({
            method: 'POST',
            path: `/api/tables/${table}`,
            description: `Neuen Eintrag in "${table}" erstellen`
        });

        endpoints.push({
            method: 'PUT',
            path: `/api/tables/${table}/:id`,
            description: `Eintrag in "${table}" ändern`
        });

        endpoints.push({
            method: 'DELETE',
            path: `/api/tables/${table}/:id`,
            description: `Eintrag aus "${table}" löschen`
        });
    }

    return endpoints;
}

/**
 * GET /api/tables/:table - Alle Einträge abrufen
 */
async function getTableHandler(req, res) {
    try {
        const { table } = req.params;
        const { limit = 100, offset = 0 } = req.query;

        // Validiere Tabellennamen
        if (!isValidTableName(table)) {
            return res.status(400).json({ error: 'Ungültiger Tabellenname' });
        }

        const query = `SELECT * FROM public."${table}" LIMIT $1 OFFSET $2`;
        const result = await apiPool.query(query, [parseInt(limit), parseInt(offset)]);

        // Count-Query
        const countQuery = `SELECT COUNT(*) as count FROM public."${table}"`;
        const countResult = await apiPool.query(countQuery);
        const total = parseInt(countResult.rows[0].count);

        res.json({
            table,
            count: result.rows.length,
            total,
            limit: parseInt(limit),
            offset: parseInt(offset),
            data: result.rows
        });
    } catch (err) {
        console.error('[API] getTableHandler:', err.message);
        res.status(500).json({ error: err.message });
    }
}

/**
 * GET /api/tables - Alle Tabellen auflisten
 */
async function getTablesHandler(req, res) {
    try {
        const tables = await getTables();
        res.json({
            tables,
            count: tables.length
        });
    } catch (err) {
        console.error('[API] getTablesHandler:', err.message);
        res.status(500).json({ error: err.message });
    }
}

/**
 * POST /api/tables/:table - Neuen Eintrag erstellen
 */
async function createRowHandler(req, res) {
    try {
        const { table } = req.params;
        const data = req.body;

        if (!isValidTableName(table)) {
            return res.status(400).json({ error: 'Ungültiger Tabellenname' });
        }

        const columns = Object.keys(data);
        const values = Object.values(data);
        const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');

        const query = `
            INSERT INTO public."${table}" (${columns.map(c => `"${c}"`).join(', ')})
            VALUES (${placeholders})
            RETURNING *
        `;

        const result = await apiPool.query(query, values);
        res.status(201).json({
            table,
            data: result.rows[0],
            message: 'Eintrag erstellt'
        });
    } catch (err) {
        console.error('[API] createRowHandler:', err.message);
        res.status(500).json({ error: err.message });
    }
}

/**
 * PUT/PATCH /api/tables/:table/:id - Eintrag ändern
 */
async function updateRowHandler(req, res) {
    try {
        const { table, id } = req.params;
        const data = req.body;

        if (!isValidTableName(table)) {
            return res.status(400).json({ error: 'Ungültiger Tabellenname' });
        }

        // Finde Primary Key
        const pkQuery = `
            SELECT a.attname
            FROM pg_index i
            JOIN pg_attribute a ON a.attrelid = i.indrelid
            WHERE i.indrelname = (
                SELECT constraint_name FROM information_schema.table_constraints
                WHERE table_name = $1 AND constraint_type = 'PRIMARY KEY'
            )
        `;

        const pkResult = await apiPool.query(pkQuery, [table]);
        const pkColumn = pkResult.rows[0]?.attname || 'id';

        const columns = Object.keys(data);
        const values = Object.values(data);
        const setClause = columns.map((col, i) => `"${col}" = $${i + 1}`).join(', ');

        const query = `
            UPDATE public."${table}"
            SET ${setClause}
            WHERE "${pkColumn}" = $${values.length + 1}
            RETURNING *
        `;

        const result = await apiPool.query(query, [...values, id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Eintrag nicht gefunden' });
        }

        res.json({
            table,
            data: result.rows[0],
            message: 'Eintrag aktualisiert'
        });
    } catch (err) {
        console.error('[API] updateRowHandler:', err.message);
        res.status(500).json({ error: err.message });
    }
}

/**
 * DELETE /api/tables/:table/:id - Eintrag löschen
 */
async function deleteRowHandler(req, res) {
    try {
        const { table, id } = req.params;

        if (!isValidTableName(table)) {
            return res.status(400).json({ error: 'Ungültiger Tabellenname' });
        }

        // Finde Primary Key
        const pkQuery = `
            SELECT a.attname
            FROM pg_index i
            JOIN pg_attribute a ON a.attrelid = i.indrelid
            WHERE i.indrelname = (
                SELECT constraint_name FROM information_schema.table_constraints
                WHERE table_name = $1 AND constraint_type = 'PRIMARY KEY'
            )
        `;

        const pkResult = await apiPool.query(pkQuery, [table]);
        const pkColumn = pkResult.rows[0]?.attname || 'id';

        const query = `
            DELETE FROM public."${table}"
            WHERE "${pkColumn}" = $1
            RETURNING *
        `;

        const result = await apiPool.query(query, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Eintrag nicht gefunden' });
        }

        res.json({
            table,
            data: result.rows[0],
            message: 'Eintrag gelöscht'
        });
    } catch (err) {
        console.error('[API] deleteRowHandler:', err.message);
        res.status(500).json({ error: err.message });
    }
}

/**
 * GET /api/schema - Detaillierte Tabellenschema-Informationen
 */
async function getSchemaHandler(req, res) {
    try {
        const tablesWithInfo = await getTablesWithInfo();
        res.json({
            schema: tablesWithInfo,
            totalTables: tablesWithInfo.length,
            totalRows: tablesWithInfo.reduce((sum, t) => sum + t.count, 0)
        });
    } catch (err) {
        console.error('[API] getSchemaHandler:', err.message);
        res.status(500).json({ error: err.message });
    }
}

/**
 * GET /api/docs - HTML Dokumentation für Entwickler
 */
async function getDocsHandler(req, res) {
    try {
        const tablesWithInfo = await getTablesWithInfo();
        const baseUrl = `http://${req.get('host')}`;
        
        const html = `
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Kynto Instant API - Dokumentation</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: #1a1a1a;
            color: #e0e0e0;
            line-height: 1.6;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 40px 20px;
        }
        header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 40px;
            border-radius: 10px;
            margin-bottom: 40px;
            color: white;
        }
        h1 { font-size: 2.5em; margin-bottom: 10px; }
        .subtitle { opacity: 0.9; font-size: 1.1em; }
        
        .section {
            background: #2a2a2a;
            padding: 30px;
            margin-bottom: 30px;
            border-radius: 8px;
            border-left: 4px solid #667eea;
        }
        h2 {
            font-size: 1.8em;
            margin-bottom: 20px;
            color: #667eea;
        }
        h3 {
            margin-top: 20px;
            margin-bottom: 10px;
            color: #a0a0ff;
        }
        
        code {
            background: #1a1a1a;
            padding: 2px 6px;
            border-radius: 3px;
            font-family: 'Courier New', monospace;
            color: #ffa500;
        }
        
        pre {
            background: #1a1a1a;
            padding: 15px;
            border-radius: 5px;
            overflow-x: auto;
            margin: 10px 0;
            border-left: 3px solid #667eea;
        }
        
        .example {
            margin: 15px 0;
            padding: 15px;
            background: #1a1a1a;
            border-radius: 5px;
            border-left: 3px solid #4caf50;
        }
        
        .endpoint {
            background: #1a1a1a;
            padding: 15px;
            margin: 10px 0;
            border-radius: 5px;
            border-left: 3px solid #2196f3;
        }
        
        .method {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 3px;
            font-weight: bold;
            margin-right: 10px;
            font-size: 0.9em;
        }
        .get { background: #4caf50; color: white; }
        .post { background: #2196f3; color: white; }
        .put { background: #ff9800; color: white; }
        .delete { background: #f44336; color: white; }
        
        .url {
            font-family: 'Courier New', monospace;
            color: #ffa500;
            word-break: break-all;
        }
        
        .tables-list {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
            gap: 15px;
            margin: 20px 0;
        }
        
        .table-card {
            background: #1a1a1a;
            padding: 15px;
            border-radius: 5px;
            border: 1px solid rgba(102, 126, 234, 0.3);
        }
        
        .table-name {
            font-weight: bold;
            color: #667eea;
            margin-bottom: 8px;
        }
        
        .table-count {
            font-size: 0.9em;
            opacity: 0.7;
            margin-bottom: 8px;
        }
        
        .copy-btn {
            background: #667eea;
            color: white;
            border: none;
            padding: 6px 12px;
            border-radius: 3px;
            cursor: pointer;
            font-size: 0.9em;
            margin-top: 10px;
            transition: background 0.3s;
        }
        
        .copy-btn:hover {
            background: #764ba2;
        }
        
        footer {
            text-align: center;
            padding: 20px;
            opacity: 0.6;
            border-top: 1px solid rgba(255,255,255,0.1);
            margin-top: 40px;
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>⚡ Kynto Instant API</h1>
            <p class="subtitle">REST API für alle deine PostgreSQL-Tabellen</p>
        </header>
        
        <div class="section">
            <h2>🚀 Schnelleinstieg</h2>
            <p>Die Instant API funktioniert mit einfachen HTTP-Requests. Keine Konfiguration nötig!</p>
            
            <h3>Basis-URL</h3>
            <code>${baseUrl}</code>
            
            <h3>Beispiel: Daten abrufen</h3>
            <div class="example">
                <strong>cURL:</strong>
                <pre>curl "${baseUrl}/api/tables/collections"</pre>
                
                <strong>JavaScript:</strong>
                <pre>fetch('${baseUrl}/api/tables/collections')
  .then(r => r.json())
  .then(data => console.log(data.data))</pre>
                
                <strong>Python:</strong>
                <pre>import requests
data = requests.get('${baseUrl}/api/tables/collections').json()
print(data['data'])</pre>
            </div>
        </div>
        
        <div class="section">
            <h2>📊 Alle Tabellen (${tablesWithInfo.length})</h2>
            <p>Insgesamt <strong>${tablesWithInfo.reduce((sum, t) => sum + t.count, 0)}</strong> Einträge in deiner Datenbank:</p>
            
            <div class="tables-list">
                ${tablesWithInfo.map(table => `
                    <div class="table-card">
                        <div class="table-name">📌 ${table.name}</div>
                        <div class="table-count">📊 ${table.count} Einträge</div>
                        <div style="font-size: 0.85em; opacity: 0.7;">📄 ${table.columns.length} Spalten</div>
                        <button class="copy-btn" data-action="copy-url" data-url="${baseUrl}/api/tables/${table.name}">URL kopieren</button>
                    </div>
                `).join('')}
            </div>
        </div>
        
        <div class="section">
            <h2>📖 API Dokumentation</h2>
            
            <h3>GET - Daten abrufen</h3>
            <div class="endpoint">
                <span class="method get">GET</span>
                <span class="url">/api/tables/{tableName}</span>
            </div>
            <p>Alle Einträge aus einer Tabelle abrufen (mit Pagination)</p>
            <div class="example">
                <pre>curl "${baseUrl}/api/tables/collections?limit=10&offset=0"</pre>
                <strong>Parameter:</strong>
                <ul style="margin-left: 20px; margin-top: 10px;">
                    <li><code>limit</code> - Anzahl Einträge (default: 100)</li>
                    <li><code>offset</code> - Offset (default: 0)</li>
                </ul>
            </div>
            
            <h3>POST - Neuen Eintrag erstellen</h3>
            <div class="endpoint">
                <span class="method post">POST</span>
                <span class="url">/api/tables/{tableName}</span>
            </div>
            <div class="example">
                <pre>curl -X POST "${baseUrl}/api/tables/collections" \\
  -H "Content-Type: application/json" \\
  -d '{"title": "Neue Collection", "beschreibung": "Test"}'</pre>
            </div>
            
            <h3>PUT - Eintrag ändern</h3>
            <div class="endpoint">
                <span class="method put">PUT</span>
                <span class="url">/api/tables/{tableName}/{id}</span>
            </div>
            <div class="example">
                <pre>curl -X PUT "${baseUrl}/api/tables/collections/5" \\
  -H "Content-Type: application/json" \\
  -d '{"title": "Geändert"}'</pre>
            </div>
            
            <h3>DELETE - Eintrag löschen</h3>
            <div class="endpoint">
                <span class="method delete">DELETE</span>
                <span class="url">/api/tables/{tableName}/{id}</span>
            </div>
            <div class="example">
                <pre>curl -X DELETE "${baseUrl}/api/tables/collections/5"</pre>
            </div>
        </div>
        
        <div class="section">
            <h2>🔧 Erweiterte Beispiele</h2>
            
            <h3>JavaScript (Fetch)</h3>
            <pre>// Daten abrufen
const response = await fetch('${baseUrl}/api/tables/collections');
const json = await response.json();
console.log(json.count, 'Einträge');
json.data.forEach(item => console.log(item));

// Neuen Eintrag erstellen
const result = await fetch('${baseUrl}/api/tables/collections', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ title: 'Neu', beschreibung: 'Test' })
});
console.log(await result.json());</pre>
            
            <h3>Python (Requests)</h3>
            <pre>import requests

# Daten abrufen
response = requests.get('${baseUrl}/api/tables/collections')
data = response.json()
print(f"{data['count']} Einträge")

# Neuen Eintrag erstellen
new_data = {
    'title': 'Neue Collection',
    'beschreibung': 'Test'
}
result = requests.post('${baseUrl}/api/tables/collections', json=new_data)
print(result.json())</pre>
            
            <h3>cURL (Shell)</h3>
            <pre># GET
curl "${baseUrl}/api/tables/collections"

# POST
curl -X POST "${baseUrl}/api/tables/collections" \\
  -H "Content-Type: application/json" \\
  -d '{"title":"Neu","beschreibung":"Test"}'

# PUT
curl -X PUT "${baseUrl}/api/tables/collections/5" \\
  -H "Content-Type: application/json" \\
  -d '{"title":"Geändert"}'

# DELETE
curl -X DELETE "${baseUrl}/api/tables/collections/5"</pre>
        </div>
        
        <footer>
            <p>Kynto Instant API v1.0 | Erzeuge REST APIs aus deinen PostgreSQL-Daten</p>
            <p>Basis: ${baseUrl}</p>
        </footer>
    </div>
    
    <script>
        // Event-Delegation für Copy-Buttons (CSP-konform, kein inline onclick)
        document.addEventListener('click', (event) => {
            if (event.target.classList.contains('copy-btn') && event.target.dataset.action === 'copy-url') {
                const url = event.target.dataset.url;
                navigator.clipboard.writeText(url).then(() => {
                    alert('URL kopiert!');
                });
            }
        });
    </script>
</body>
</html>
        `;
        
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(html);
    } catch (err) {
        console.error('[API] getDocsHandler:', err.message);
        res.status(500).json({ error: err.message });
    }
}

/**
 * SQL Injection Prevention
 */
function isValidTableName(name) {
    // Nur alphanumerische Zeichen, Unterstriche
    return /^[a-zA-Z0-9_]+$/.test(name) && name.length > 0 && name.length < 100;
}

/**
 * Hole API-Status
 */
function getAPIStatus() {
    return {
        running: !!apiServer,
        url: apiServer ? `http://127.0.0.1:3001` : null
    };
}

/**
 * Exports
 */
module.exports = {
    startAPIServer,
    stopAPIServer,
    getAPIStatus,
    getTables,
    getTablesWithInfo,
    generateEndpoints
};

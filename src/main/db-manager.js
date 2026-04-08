const duckdb = require('duckdb');
const path   = require('path');
const { app } = require('electron');

// Robuster absoluter Pfad — funktioniert sowohl im Dev- als auch im
// ASAR-gepackten Produktionsmodus.
// app.getAppPath() → C:\Users\Felix\Desktop\Kynto\Kynto
// Von dort zwei Ebenen hoch wäre falsch — wir wollen direkt ins
// Projekt-Root/data, also direkt neben src/.
const APP_ROOT   = path.join(app.getAppPath());
const DEFAULT_PATH = path.join(APP_ROOT, 'data', 'Kynto.ddb');

// Map: filePath (string) -> { db, conn, name, isDefault }
const pool = new Map();

function openDB(filePath) {
    const id = filePath || DEFAULT_PATH;
    if (pool.has(id)) return id;
    const db   = new duckdb.Database(id);
    const conn = db.connect();
    pool.set(id, { db, conn, path: id, name: path.basename(id), isDefault: id === DEFAULT_PATH });
    return id;
}

function getConn(dbId) {
    const entry = pool.get(dbId);
    if (!entry) throw new Error(`Keine DB mit ID "${dbId}" offen.`);
    return entry.conn;
}

/**
 * Erzwungenes Neu-Öffnen einer Datenbank-Connection.
 * Behebt "Zombie-Katalog" Probleme wo postgres_server existiert aber nicht nutzbar ist.
 * @returns {string} Neue Connection ID (gleich wie alte)
 */
async function reopenDB(dbId) {
    console.log(`[DB-Manager] Erzwinge Neu-Öffnen der Datenbank: ${dbId}`);
    const entry = pool.get(dbId);
    if (!entry) throw new Error(`Datenbank ${dbId} nicht im Pool`);
    
    const filePath = entry.path;
    const isDefault = entry.isDefault;
    
    try {
        // Checkpoint und schließen
        await new Promise(r => entry.conn.all('CHECKPOINT', err => r()));
    } catch (e) {
        console.warn('[DB-Manager] CHECKPOINT vor Close fehlgeschlagen (OK):', e.message);
    }
    
    try {
        await new Promise(r => entry.conn.close(r));
    } catch (e) {
        console.warn('[DB-Manager] conn.close() fehlgeschlagen (OK):', e.message);
    }
    
    try {
        await new Promise(r => entry.db.close(r));
    } catch (e) {
        console.warn('[DB-Manager] db.close() fehlgeschlagen (OK):', e.message);
    }
    
    // Aus Pool entfernen
    pool.delete(dbId);
    
    // Neu öffnen
    const newId = openDB(filePath);
    console.log(`[DB-Manager] Datenbank neu geöffnet (alte ID=${dbId}, neue ID=${newId})`);
    
    return newId;
}


/**
 * Übersetzt Postgres-Schema-Syntax in DuckDB-kompatible Syntax.
 * Problem: TableGridEditor & andere Module bauen Queries mit "public"."tabelle",
 *          aber DuckDB kennt kein Schema 'public' für lokale Tabellen (liegen in 'main').
 *          Falls die Tabelle via postgres_server attached ist, bleibt der Query korrekt.
 * Lösung: Vor der Ausführung prüfen ob die Tabelle in 'main' existiert → Schema umschreiben.
 */
async function rewriteSchemaIfNeeded(conn, sql) {
    // Nur Queries mit "public"."..." umschreiben
    const publicSchemaPattern = /["'`]public["'`]\s*\.\s*["'`]([^"'`]+)["'`]/gi;
    if (!publicSchemaPattern.test(sql)) return sql;

    // Tabellennamen extrahieren
    publicSchemaPattern.lastIndex = 0;
    const tableNames = [];
    let match;
    while ((match = publicSchemaPattern.exec(sql)) !== null) {
        tableNames.push(match[1]);
    }
    if (!tableNames.length) return sql;

    try {
        const placeholders = tableNames.map(n => `'${n.replace(/'/g, "''")}'`).join(', ');
        const checkResult = await new Promise((resolve) => {
            conn.all(
                `SELECT table_name FROM duckdb_tables() WHERE database_name = 'main' AND table_name IN (${placeholders})`,
                (err, res) => resolve(err ? [] : (res ?? []))
            );
        });

        const mainTables = new Set(checkResult.map(r => r.table_name));
        if (!mainTables.size) return sql; // Alle Tabellen sind extern (postgres_server) → unverändert

        let rewritten = sql;
        for (const tbl of mainTables) {
            const tblEscaped = tbl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            rewritten = rewritten.replace(
                new RegExp(`(["'\`])public\\1\\s*\\.\\s*(["'\`])${tblEscaped}\\2`, 'gi'),
                `"main"."${tbl}"`
            );
        }

        if (rewritten !== sql) {
            console.log(`[DB-Manager] Schema-Rewrite: "public" → "main" für: ${[...mainTables].join(', ')}`);
        }
        return rewritten;
    } catch (err) {
        console.warn('[DB-Manager] Schema-Check fehlgeschlagen, Original wird verwendet:', err.message);
        return sql;
    }
}

async function queryDB(dbId, sql) {
    const conn = getConn(dbId);
    const rewrittenSql = await rewriteSchemaIfNeeded(conn, sql);
    return new Promise((resolve, reject) => {
        conn.all(rewrittenSql, (err, res) => {
            if (err) reject(err); else resolve(res ?? []);
        });
    });
}

// Fallback-Query für NameListToString Parser Fehler
async function queryDBSafe(dbId, sql) {
    try {
        return await queryDB(dbId, sql);
    } catch (err) {
        const errMsg = String(err).toUpperCase();
        // Fallback für duckdb_tables/duckdb_views Parser Fehler
        if (errMsg.includes('NAMELISTTOSTRING') || errMsg.includes('BINDER')) {
            console.warn('[DB-Manager] Parser/Binder Fehler erkannt - verwende Fallback-Queries');
            try {
                // Versuche mit information_schema.tables
                if (sql.includes('duckdb_tables')) {
                    // Fallback: Nur 'main' database (verwende 'main', nicht wal/temp)
                    const result = await queryDB(dbId, 
                        "SELECT 'main' as database_name, table_schema as schema_name, table_name FROM information_schema.tables WHERE table_schema NOT IN ('information_schema', 'pg_catalog') ORDER BY table_name"
                    );
                    return result.map(r => ({ ...r, type: 'table' }));
                }
                if (sql.includes('duckdb_views')) {
                    const result = await queryDB(dbId, 
                        "SELECT 'main' as database_name, table_schema as schema_name, table_name as view_name FROM information_schema.views WHERE table_schema NOT IN ('information_schema', 'pg_catalog') ORDER BY table_name"
                    );
                    return result.map(r => ({ ...r, type: 'view' }));
                }
            } catch (fallbackErr) {
                console.error('[DB-Manager] Fallback-Query fehlgeschlagen:', fallbackErr);
            }
        }
        throw err;
    }
}

async function multiQueryDB(dbId, sql) {
    const stmts = sql.split(';').map(s => s.trim()).filter(Boolean);
    let last = [];
    for (const s of stmts) {
        try {
            // Verwende Safe-Query für Metadaten-Abfragen
            if (s.includes('duckdb_tables') || s.includes('duckdb_views') || s.includes('duckdb_columns') || s.includes('duckdb_databases')) {
                last = await queryDBSafe(dbId, s);
            } else {
                last = await queryDB(dbId, s);
            }
        } catch (err) {
            const errMsg = String(err.message ?? err);
            // Catalog Error: Tabelle nicht gefunden → einmal mit Fallback-Schema versuchen
            // (kann passieren wenn Rewrite-Check selbst fehlschlug)
            if (errMsg.includes('Catalog Error') && errMsg.includes('does not exist')) {
                console.warn('[DB-Manager] Catalog Error bei Query, versuche Schema-Fallback:', s.substring(0, 80));
                // Direkter Ersatz ohne DB-Check als letzter Fallback
                const fallback = s.replace(/"public"\."([^"]+)"/g, '"main"."$1"');
                if (fallback !== s) {
                    try {
                        console.log('[DB-Manager] Fallback-Rewrite:', fallback.substring(0, 80));
                        last = await new Promise((resolve, reject) => {
                            getConn(dbId).all(fallback, (e, res) => e ? reject(e) : resolve(res ?? []));
                        });
                        continue; // Erfolg → nächste Statement
                    } catch (fallbackErr) {
                        console.error('[DB-Manager] Fallback ebenfalls fehlgeschlagen:', fallbackErr.message);
                    }
                }
            }
            console.error('[DB-Manager] Query Error:', s.substring(0, 100), err);
            throw err;
        }
    }
    return last;
}

async function checkpointClose(dbId) {
    const e = pool.get(dbId);
    if (!e) return;
    await new Promise(r => e.conn.all('CHECKPOINT', err => { if (err) console.error('CHECKPOINT:', err); r(); }));
    await new Promise(r => e.conn.close(r));
    await new Promise(r => e.db.close(r));
    pool.delete(dbId);
}

/**
 * Prüft ob der postgres_server Katalog existiert und funktioniert.
 * Falls nicht oder falls er im Ghost-Zustand ist, versucht ihn zu löschen.
 */
async function validatePostgresServerCatalog(dbId) {
    const conn = getConn(dbId);
    
    try {
        // Prüfe mit PRAGMA database_list ob postgres_server existiert
        const databaseList = await new Promise((resolve, reject) => {
            conn.all(
                `PRAGMA database_list;`,
                (err, res) => {
                    if (err) {
                        console.warn('[DB-Manager] PRAGMA database_list fehlgeschlagen:', err.message);
                        resolve([]);
                    } else {
                        resolve(res ?? []);
                    }
                }
            );
        });

        const pgServerExists = databaseList.some(d => d.name === 'postgres_server' || d.database === 'postgres_server');
        console.log('[DB-Manager] PRAGMA database_list result:', databaseList.map(d => d.name || d.database).join(', '));
        
        if (!pgServerExists) {
            console.log('[DB-Manager] postgres_server nicht in PRAGMA database_list gefunden');
            return { exists: false, valid: false };
        }

        // Versuche ein einfaches Query
        const testResult = await new Promise((resolve) => {
            conn.all(
                `SELECT 1;`,
                (err, res) => resolve(!err)
            );
        });

        if (!testResult) {
            console.error('[DB-Manager] postgres_server existiert aber ist nicht funktionsfähig (Ghost-Zustand)');
            return { exists: true, valid: false, isGhost: true };
        }

        return { exists: true, valid: true };
    } catch (e) {
        console.error('[DB-Manager] Katalog-Validierung fehlgeschlagen:', e.message);
        return { exists: false, valid: false, error: e.message };
    }
}

/**
 * Forciertes Detach mit Fallback auf Connection-Reset
 * WARNUNG: DETACH IF EXISTS ist NICHT valide DuckDB-Syntax!
 */
async function forceDetachPostgresServer(dbId) {
    const conn = getConn(dbId);
    
    // Nur valide DuckDB DETACH-Syntaxen verwenden
    const detachAttempts = [
        'DETACH postgres_server;',
        'DETACH DATABASE postgres_server;',
    ];

    for (const detachSql of detachAttempts) {
        try {
            await new Promise((resolve, reject) => {
                conn.all(detachSql, (err) => {
                    if (err) reject(err);
                    else {
                        console.log('[DB-Manager] DETACH erfolgreich mit:', detachSql);
                        resolve();
                    }
                });
            });
            return { success: true, method: detachSql };
        } catch (e) {
            console.warn('[DB-Manager] DETACH Versuch fehlgeschlagen:', detachSql, e.message);
        }
    }

    // Alle DETACH-Versuche fehlgeschlagen → Connection-Reset erforderlich
    console.error('[DB-Manager] Alle DETACH-Versuche fehlgeschlagen, Connection-Reset erforderlich');
    return { success: false, requiresReset: true };
}

/**
 * Versucht, einen Ghost-Katalog zu reparieren, indem die Connection neu erstellt wird.
 */
async function repairGhostCatalog(dbId) {
    console.error('[DB-Manager] Versuche Ghost-Katalog zu reparieren...');
    try {
        // Versuch 1: Forciertes Detach mit verschiedenen Syntaxen
        console.log('[DB-Manager] Versuch 1: Forciertes Detach...');
        try {
            const detachResult = await forceDetachPostgresServer(dbId);
            if (detachResult.success) {
                console.log('[DB-Manager] Ghost-Katalog durch DETACH entfernt');
                return { success: true, newId: dbId };
            }
        } catch (e) {
            console.warn('[DB-Manager] Forciertes Detach fehlgeschlagen:', e.message);
        }

        // Versuch 2: Connection komplett neu starten
        console.log('[DB-Manager] Versuch 2: Connection-Reset...');
        const entry = pool.get(dbId);
        if (!entry) throw new Error('DB nicht im Pool');
        
        const filePath = entry.path;
        
        // Schließe alte Connection mit checkpoint
        try {
            await new Promise(r => entry.conn.all('CHECKPOINT', err => r()));
        } catch (e) {
            console.warn('[DB-Manager] CHECKPOINT vor Close fehlgeschlagen:', e.message);
        }
        
        await checkpointClose(dbId);
        
        // Öffne neue Connection
        const id = openDB(filePath);
        console.log('[DB-Manager] Neue Connection erstellt nach Ghost-Repair:', id);
        return { success: true, newId: id };
    } catch (err) {
        console.error('[DB-Manager] Ghost-Repair KRITISCH FEHLGESCHLAGEN:', err);
        throw err;
    }
}

async function vacuumDatabase(dbId) {
    console.log(`[DB-Manager] Starte Wartung (VACUUM) für: ${dbId}`);
    const e = pool.get(dbId);
    if (!e) {
        console.error(`[DB-Manager] Fehler: Datenbank ${dbId} nicht im Pool gefunden!`);
        return { success: false, error: 'Datenbank nicht gefunden' };
    }
    try {
        await new Promise((resolve, reject) => {
            e.conn.all('CHECKPOINT', err => err ? reject(err) : resolve());
        });
        await new Promise((resolve, reject) => {
            e.conn.all('VACUUM', err => err ? reject(err) : resolve());
        });
        await new Promise((resolve, reject) => {
            e.conn.all('PRAGMA force_checkpoint', err => err ? reject(err) : resolve());
        });
        console.log('[DB-Manager] Wartung erfolgreich abgeschlossen.');
        return { success: true };
    } catch (err) {
        console.error('[DB-Manager] KRITISCHER FEHLER bei Wartung:', err);
        throw err;
    }
}

async function closeAll() {
    for (const id of [...pool.keys()]) await checkpointClose(id);
}

function listDBs() {
    return [...pool.values()].map(e => ({
        id: e.path, name: e.name, path: e.path, isDefault: e.isDefault
    }));
}

// Reparaturmodus: Problematische Views löschen
async function repairCorruptedViews(dbId) {
    console.log(`[DB-Manager] Starte Datenbankreparatur für: ${dbId}`);
    const e = pool.get(dbId);
    if (!e) throw new Error('Datenbank nicht gefunden');
    
    try {
        // Versuche mit information_schema.views zu arbeiten (fallback)
        const views = await new Promise((resolve, reject) => {
            e.conn.all(
                "SELECT table_name FROM information_schema.views WHERE table_schema = 'main'",
                (err, res) => err ? reject(err) : resolve(res ?? [])
            );
        });
        
        console.log(`[DB-Manager] Gefundene Views: ${views.map(v => v.table_name).join(', ')}`);
        
        // Versuche jede View zu laden - wenn Fehler, lösche sie
        for (const v of views) {
            try {
                await new Promise((resolve, reject) => {
                    e.conn.all(`SELECT * FROM "${v.table_name}" LIMIT 1`, 
                        (err) => err ? reject(err) : resolve()
                    );
                });
            } catch (viewErr) {
                if (String(viewErr).includes('NAMELISTTOSTRING')) {
                    console.warn(`[DB-Manager] Problematische View erkannt: ${v.table_name} - wird gelöscht`);
                    try {
                        await new Promise((resolve) => {
                            e.conn.all(`DROP VIEW IF EXISTS "${v.table_name}"`, () => resolve());
                        });
                    } catch (dropErr) {
                        console.error(`[DB-Manager] Konnte View nicht löschen: ${v.table_name}`, dropErr);
                    }
                }
            }
        }
        
        // Führe VACUUM durch
        await vacuumDatabase(dbId);
        console.log('[DB-Manager] Datenbankreparatur abgeschlossen.');
        return { success: true };
    } catch (err) {
        console.error('[DB-Manager] Fehler bei Reparatur:', err);
        return { success: false, error: err.message };
    }
}

// ── DuckDB wird NICHT mehr automatisch geladen ──────────────────────────
// Es ist jetzt nur optional für Import. PGlite ist das Primärsystem.
// openDB(DEFAULT_PATH) wurde entfernt!

module.exports = { openDB, multiQueryDB, checkpointClose, vacuumDatabase, closeAll, listDBs, queryDBSafe, repairCorruptedViews, validatePostgresServerCatalog, repairGhostCatalog, reopenDB };
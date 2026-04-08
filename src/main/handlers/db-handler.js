/**
 * 🗄️ Database Handler
 * Alle Datenbankbezogenen IPC-Handler
 */

const { ipcMain, BrowserWindow, dialog } = require('electron');

/**
 * 🔧 Registriere alle Database Handler
 */
function registerDatabaseHandlers(databaseEngine, pgManager, remote) {
    // ====================================================================
    // 📊 Database Engine (Zentrale Schicht)
    // ====================================================================
    
    ipcMain.handle('db:query', async (_, { sql, params, dbType }) => {
        try {
            const result = await databaseEngine.executeQuery(sql, params || [], dbType || 'local');
            
            // BigInt zu String konvertieren
            if (Array.isArray(result)) {
                return result.map(row => {
                    const cleanRow = {};
                    for (const key in row) {
                        cleanRow[key] = typeof row[key] === 'bigint' ? row[key].toString() : row[key];
                    }
                    return cleanRow;
                });
            }
            return result;
        } catch (err) {
            const errorString = `Database Error: ${err.message ?? err}`;
            console.error('[db:query] Fehler:', errorString.substring(0, 200));
            throw errorString;
        }
    });

    ipcMain.handle('db:multi-query', async (_, { sql, dbType }) => {
        const replacer = (key, value) => {
            if (typeof value === 'bigint') return value.toString();
            return value;
        };

        try {
            const result = await databaseEngine.executeMultiQuery(sql, dbType || 'local');
            return JSON.parse(JSON.stringify(result, replacer));
        } catch (err) {
            const errorString = `Database Error: ${err.message ?? err}`;
            console.error('[db:multi-query] Fehler:', errorString.substring(0, 200));
            throw errorString;
        }
    });

    ipcMain.handle('db:transaction', async (_, { statements, dbType }) => {
        try {
            return await databaseEngine.executeTransaction(statements, dbType || 'local');
        } catch (err) {
            throw `Transaction Error: ${err.message ?? err}`;
        }
    });

    ipcMain.handle('db:tables', async (_, { dbType }) => {
        try {
            return await databaseEngine.listTables(dbType || 'local');
        } catch (err) {
            throw `Error listTables: ${err.message ?? err}`;
        }
    });

    ipcMain.handle('db:describe', async (_, { tableName, dbType }) => {
        try {
            return await databaseEngine.describeTable(tableName, dbType || 'local');
        } catch (err) {
            throw `Error describeTable: ${err.message ?? err}`;
        }
    });

    ipcMain.handle('db:columns', async (_, { dbType }) => {
        try {
            return await databaseEngine.getAllColumns(dbType || 'local');
        } catch (err) {
            throw `Error getAllColumns: ${err.message ?? err}`;
        }
    });

    ipcMain.handle('db:size', async (_, { dbType }) => {
        try {
            return await databaseEngine.getDatabaseSize(dbType || 'local');
        } catch (err) {
            throw `Error getDatabaseSize: ${err.message ?? err}`;
        }
    });

    ipcMain.handle('db:status', () => {
        return databaseEngine.status();
    });

    ipcMain.handle('db:register-remote', async (_, connectionString) => {
        try {
            if (connectionString) {
                await databaseEngine.setRemoteDatabase(connectionString);
                console.log('[Main] Remote-DB registriert');
                return { ok: true };
            } else {
                await databaseEngine.setRemoteDatabase(null);
                console.log('[Main] Remote-DB deregistriert');
                return { ok: true };
            }
        } catch (err) {
            console.error('[db:register-remote] Fehler:', err.message);
            return { ok: false, error: err.message };
        }
    });

    // ====================================================================
    // 🔌 PGlite SQL
    // ====================================================================

    ipcMain.handle('sql:query', async (_, { sql, dbId }) => {
        try {
            console.log('[sql:query] Eingehend - SQL:', sql.substring(0, 300));
            console.log('[sql:query] DbId:', dbId);
            const result = await pgManager.queryPG(dbId || pgManager.DEFAULT_PGDATA, sql, []);
            if (Array.isArray(result)) {
                return result.map(row => {
                    const cleanRow = {};
                    for (const key in row) {
                        cleanRow[key] = typeof row[key] === 'bigint' ? row[key].toString() : row[key];
                    }
                    return cleanRow;
                });
            }
            return result;
        } catch (err) {
            const errorString = `SQL Query Error: ${err.message ?? err}`;
            console.error('[sql:query] Fehler:', errorString.substring(0, 200));
            throw errorString;
        }
    });

    ipcMain.handle('pg:query', async (_, { sql, pgId, params }) => {
        try {
            console.log('[pg:query] Eingehend - SQL:', sql.substring(0, 300));
            console.log('[pg:query] pgId:', pgId);
            console.log('[pg:query] params:', params);
            return await pgManager.multiQueryPG(pgId || pgManager.DEFAULT_PGDATA, sql);
        }
        catch (err) {
            console.error('[pg:query] Fehler:', String(err.message ?? err).substring(0, 200));
            throw String(err.message ?? err);
        }
    });

    ipcMain.handle('pg:transaction', async (_, { pgId, statements }) => {
        try {
            return await pgManager.transactionPG(pgId || pgManager.DEFAULT_PGDATA, statements);
        }
        catch (err) {
            throw String(err.message ?? err);
        }
    });

    // ====================================================================
    // 📁 PGlite DB Management
    // ====================================================================

    ipcMain.handle('pg:list', () => pgManager.listPGs());

    ipcMain.handle('pg:open', async (event) => {
        const parentWin = BrowserWindow.fromWebContents(event.sender);
        const { canceled, filePaths } = await dialog.showOpenDialog(parentWin, {
            title:       'App-Datenbank öffnen',
            properties:  ['openDirectory'],
            buttonLabel: 'Öffnen'
        });
        if (canceled || !filePaths[0]) return null;
        return await pgManager.openPG(filePaths[0]);
    });

    ipcMain.handle('pg:create', async (event) => {
        const parentWin = BrowserWindow.fromWebContents(event.sender);
        const { canceled, filePath } = await dialog.showSaveDialog(parentWin, {
            title:       'Neue App-Datenbank erstellen',
            defaultPath: 'meine_app.pgdata',
            buttonLabel: 'Erstellen'
        });
        if (canceled || !filePath) return null;
        return await pgManager.openPG(filePath);
    });

    ipcMain.handle('pg:close', async (_, pgId) => {
        if (pgId === pgManager.DEFAULT_PGDATA) return false;
        await pgManager.closePG(pgId);
        return true;
    });

    // ====================================================================
    // 🔍 PGlite Schema
    // ====================================================================

    ipcMain.handle('pg:tables',   async (_, pgId)                => pgManager.listTablesPG(pgId   || pgManager.DEFAULT_PGDATA));
    ipcMain.handle('pg:describe', async (_, { pgId, tableName }) => pgManager.describeTablePG(pgId || pgManager.DEFAULT_PGDATA, tableName));
    ipcMain.handle('pg:columns',  async (_, pgId)                => pgManager.allColumnsPG(pgId   || pgManager.DEFAULT_PGDATA));
    ipcMain.handle('pg:size',           (_, pgId)                => pgManager.getSizePG(pgId      || pgManager.DEFAULT_PGDATA));

    // ====================================================================
    // 🐘 PostgreSQL / Remote
    // ====================================================================

    ipcMain.handle('postgresql:connect', async (_, connectionString) => {
        console.log('[Main] PostgreSQL Connect-Versuch');
        try {
            if (!connectionString || typeof connectionString !== 'string') {
                return { ok: false, error: 'Ungültige Verbindungszeichenkette.' };
            }
            await remote.openRemote(connectionString);
            const info = await remote.testConnection(connectionString);
            if (!info.ok) {
                return { ok: false, error: info.error };
            }
            console.log('[Main] PostgreSQL erfolgreich verbunden');
            return { ok: true, version: info.version, latencyMs: info.latencyMs };
        } catch (err) {
            console.error('[postgresql:connect] Fehler:', err.message);
            return { ok: false, error: err.message };
        }
    });

    ipcMain.handle('postgresql:disconnect', async (_, connectionString) => {
        try {
            await remote.closeRemote(connectionString);
            return { ok: true };
        } catch (err) {
            return { ok: false, error: err.message };
        }
    });

    // ====================================================================
    // 🔄 ProgressSQL (ALT - für Rückwärtskompatibilität)
    // ====================================================================

    ipcMain.handle('progresssql:connect', async (_, connectionString) => {
        console.log('[Main] progresssql:connect ->', connectionString);
        try {
            if (!connectionString || typeof connectionString !== 'string') {
                return { ok: false, error: 'Ungültige Verbindungszeichenkette.' };
            }
            await remote.openRemote(connectionString);
            const info = await remote.testConnection(connectionString);
            if (!info.ok) {
                console.error('[Main] progresssql:connect fehlgeschlagen:', info.error);
                return { ok: false, error: info.error };
            }
            console.log('[Main] progresssql:connect OK —', info.version, info.latencyMs + 'ms');
            return { ok: true, version: info.version, latencyMs: info.latencyMs };
        } catch (err) {
            const msg = String(err.message ?? err);
            console.error('[Main] progresssql:connect Exception:', msg);
            return { ok: false, error: msg };
        }
    });

    ipcMain.handle('progresssql:disconnect', async (_, connectionString) => {
        try {
            await remote.closeRemote(connectionString);
            return { success: true };
        } catch (err) {
            return { success: false, error: String(err.message ?? err) };
        }
    });

    ipcMain.handle('progresssql:query', async (_, { connectionString, sql, params }) => {
        try {
            return await remote.queryRemote(connectionString, sql, params);
        } catch (err) {
            console.error('[Main] progresssql:query Fehler:', err.message);
            throw String(err.message ?? err);
        }
    });

    ipcMain.handle('progresssql:tables', async (_, connectionString) => {
        try {
            console.log('[Main] progresssql:tables ->', connectionString);
            await remote.openRemote(connectionString);
            const rows = await remote.listTablesRemote(connectionString);
            console.log('[Main] progresssql:tables -> Gefunden:', rows.length);
            return rows.map(r => ({
                table_name:  r.name,
                schema_name: r.schema || 'public',
                type:        'table'
            }));
        } catch (err) {
            console.error('[Main] progresssql:tables Fehler:', err.message);
            throw String(err.message ?? err);
        }
    });

    ipcMain.handle('progresssql:describe', async (_, { connectionString, tableName }) => {
        try {
            return await remote.describeTableRemote(connectionString, tableName);
        } catch (err) {
            console.error('[Main] progresssql:describe Fehler:', err.message);
            throw String(err.message ?? err);
        }
    });

    ipcMain.handle('progresssql:transaction', async (_, { connectionString, statements }) => {
        try {
            return await remote.transactionRemote(connectionString, statements);
        } catch (err) {
            console.error('[Main] progresssql:transaction Fehler:', err.message);
            throw String(err.message ?? err);
        }
    });

    console.log('✅ Database Handler registriert');
}

module.exports = { registerDatabaseHandlers };

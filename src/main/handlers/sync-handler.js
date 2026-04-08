/**
 * 🔄 Sync Engine Handler
 * Datensynchronisation zwischen PGlite und Remote
 */

const { ipcMain } = require('electron');

/**
 * 🔧 Registriere alle Sync Handler
 */
function registerSyncHandlers(syncEngine) {
    ipcMain.handle('sync:pglite-to-server', async (_, { pgId, connectionString }) => {
        try {
            console.log('[Main] sync:pglite-to-server -> pgId:', pgId);
            if (!pgId) throw new Error('pgId fehlt');
            if (!connectionString) throw new Error('connectionString fehlt');
            return await syncEngine.pgLiteToRemote(pgId, connectionString);
        } catch (err) {
            console.error('[Main] Sync Error (Local->Server):', err.message);
            throw String(err.message ?? err);
        }
    });

    ipcMain.handle('sync:server-to-local', async (_, { pgId, connectionString }) => {
        try {
            console.log('[Main] sync:server-to-local -> pgId:', pgId);
            if (!pgId) throw new Error('pgId fehlt');
            if (!connectionString) throw new Error('connectionString fehlt');
            return await syncEngine.remoteToLocal(pgId, connectionString);
        } catch (err) {
            console.error('[Main] Sync Error (Server->Local):', err.message);
            throw String(err.message ?? err);
        }
    });

    console.log('✅ Sync Handler registriert');
}

module.exports = { registerSyncHandlers };

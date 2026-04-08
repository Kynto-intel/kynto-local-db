/**
 * 🚀 Instant API Handler
 * Express-basierter PostgREST Server
 */

const { ipcMain } = require('electron');
const { shell } = require('electron');

/**
 * 🔧 Registriere alle Instant API Handler
 */
function registerInstantAPIHandlers(progressqlManager) {
    ipcMain.handle('instant-api:start', async (_, { connectionString, port = 3001 }) => {
        try {
            console.log('[IPC] instant-api:start aufgerufen', connectionString, port);
            await progressqlManager.openConnection(connectionString);
            const result = await progressqlManager.startInstantAPI(connectionString, port);
            return result;
        } catch (err) {
            console.error('[IPC] instant-api:start Fehler:', err.message);
            return { success: false, error: err.message };
        }
    });

    ipcMain.handle('instant-api:stop', async (_, { connectionString }) => {
        try {
            console.log('[IPC] instant-api:stop aufgerufen');
            const result = await progressqlManager.stopInstantAPI(connectionString);
            return result;
        } catch (err) {
            console.error('[IPC] instant-api:stop Fehler:', err.message);
            return { success: false, error: err.message };
        }
    });

    ipcMain.handle('instant-api:status', async (_, { connectionString }) => {
        try {
            const status = await progressqlManager.getInstantAPIStatus(connectionString);
            return status;
        } catch (err) {
            console.error('[IPC] instant-api:status Fehler:', err.message);
            return { running: false, error: err.message };
        }
    });

    ipcMain.handle('instant-api:endpoints', async (_, { connectionString }) => {
        try {
            const endpoints = await progressqlManager.getApiEndpoints(connectionString);
            return endpoints;
        } catch (err) {
            console.error('[IPC] instant-api:endpoints Fehler:', err.message);
            return [];
        }
    });

    ipcMain.handle('instant-api:docs', async (_, { connectionString }) => {
        try {
            const docs = await progressqlManager.getApiDocumentation(connectionString);
            return docs;
        } catch (err) {
            console.error('[IPC] instant-api:docs Fehler:', err.message);
            return null;
        }
    });

    ipcMain.handle('instant-api:open-browser', async (_, { url }) => {
        try {
            await shell.openExternal(url);
            return { success: true };
        } catch (err) {
            console.error('[IPC] instant-api:open-browser Fehler:', err.message);
            return { success: false, error: err.message };
        }
    });

    console.log('✅ Instant API Handler registriert');
}

module.exports = { registerInstantAPIHandlers };

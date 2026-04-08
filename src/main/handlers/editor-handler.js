/**
 * 📝 README Editor Handler
 * Speichert und lädt Editor-Zustand
 */

const { ipcMain, BrowserWindow, dialog } = require('electron');
const fs = require('fs');
const path = require('path');

/**
 * 🔧 Registriere alle Editor Handler
 */
function registerEditorHandlers(app) {
    const DATA_DIR = path.join(app.getAppPath(), 'data');
    const EDITOR_DATA_FILE = path.join(DATA_DIR, 'editor-data.json');

    ipcMain.handle('editor:saveData', async (_, data) => {
        try {
            fs.writeFileSync(EDITOR_DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
            return { success: true };
        } catch (err) {
            console.error('[editor:saveData] Fehler:', err.message);
            throw err.message;
        }
    });

    ipcMain.handle('editor:loadData', async () => {
        try {
            if (!fs.existsSync(EDITOR_DATA_FILE)) return null;
            const raw = fs.readFileSync(EDITOR_DATA_FILE, 'utf-8');
            return JSON.parse(raw);
        } catch (err) {
            console.error('[editor:loadData] Fehler:', err.message);
            return null;
        }
    });

    ipcMain.handle('editor:writeHtmlFile', async (_, filePath, content) => {
        try {
            fs.writeFileSync(filePath, content, 'utf-8');
            console.log('[editor:writeHtmlFile] Aktualisiert:', filePath);
            return { success: true, path: filePath };
        } catch (err) {
            console.error('[editor:writeHtmlFile] Fehler:', err.message);
            throw err.message;
        }
    });

    ipcMain.handle('editor:openHtmlFile', async (event) => {
        const parentWin = BrowserWindow.fromWebContents(event.sender);
        const result = await dialog.showOpenDialog(parentWin, {
            title:      'HTML-Datei verknüpfen',
            filters:    [{ name: 'HTML', extensions: ['html', 'htm'] }],
            properties: ['openFile'],
        });
        if (result.canceled || result.filePaths.length === 0) return null;
        const filePath = result.filePaths[0];
        const content  = fs.readFileSync(filePath, 'utf-8');
        console.log('[editor:openHtmlFile] Verknüpft mit:', filePath);
        return { path: filePath, content };
    });

    ipcMain.handle('editor:saveHtmlFile', async (event, content) => {
        const parentWin = BrowserWindow.fromWebContents(event.sender);
        const result = await dialog.showSaveDialog(parentWin, {
            title:       'HTML-Datei speichern',
            defaultPath: path.join(DATA_DIR, 'Dokumentation.html'),
            filters:     [{ name: 'HTML', extensions: ['html'] }],
        });
        if (result.canceled || !result.filePath) return null;
        fs.writeFileSync(result.filePath, content, 'utf-8');
        console.log('[editor:saveHtmlFile] Gespeichert:', result.filePath);
        return { path: result.filePath };
    });

    console.log('✅ Editor Handler registriert');
}

module.exports = { registerEditorHandlers };

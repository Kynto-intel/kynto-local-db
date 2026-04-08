/**
 * 📁 File & Dialog Handler
 * Datei-I/O, Dialoge und CSV Import
 */

const { ipcMain, BrowserWindow, dialog } = require('electron');
const fs = require('fs');
const path = require('path');

/**
 * 🔧 Registriere all File & Dialog Handler
 */
function registerFileHandlers(app) {
    const Papa = require('papaparse');

    // ====================================================================
    // 📂 File I/O
    // ====================================================================

    ipcMain.handle('file:size', (_, p) => {
        try { return fs.existsSync(p) ? fs.statSync(p).size : 0; } catch (e) {
            console.error('[file:size] Fehler:', e); return 0;
        }
    });

    ipcMain.handle('file:write', (_, { path: p, content }) => {
        const resolvedPath = path.resolve(p);
        const appRoot = path.resolve(app.getAppPath());
        const dataDir = path.join(appRoot, 'data');

        // Sicherheit: Verhindere das Überschreiben von Systemdateien
        if (resolvedPath.startsWith(appRoot) && !resolvedPath.startsWith(dataDir)) {
            console.error(`[Sicherheit] Schreibzugriff auf geschützte Datei blockiert: ${resolvedPath}`);
            return false;
        }

        try { fs.writeFileSync(p, content, 'utf8'); return true; } catch (e) {
            console.error('[file:write] Fehler:', e); return false;
        }
    });

    ipcMain.handle('file:write-binary', (_, { path: p, buffer }) => {
        try {
            fs.writeFileSync(p, Buffer.from(buffer));
            return true;
        } catch (e) {
            console.error('[file:write-binary] Fehler:', e); return false;
        }
    });

    ipcMain.handle('file:read', (_, p) => {
        const fullPath = path.isAbsolute(p) ? p : path.join(app.getAppPath(), p);
        try { return fs.readFileSync(fullPath, 'utf8'); } catch (e) { console.error('[file:read] Fehler:', e); return null; }
    });

    ipcMain.handle('file:read-binary', (_, p) => {
        try { return fs.readFileSync(p); } catch (e) { console.error('[file:read-binary] Fehler:', e); return null; }
    });

    ipcMain.handle('file:exists', (_, p) => {
        return fs.existsSync(p);
    });

    ipcMain.handle('file:mkdir', (_, p) => {
        try { fs.mkdirSync(p, { recursive: true }); return true; } catch (e) { return false; }
    });

    ipcMain.handle('file:readdir', (_, p) => {
        try { return fs.readdirSync(p); } catch (e) { return []; }
    });

    ipcMain.handle('file:unlink', (_, p) => {
        try {
            if (fs.existsSync(p)) fs.unlinkSync(p);
            return true;
        } catch (e) { return false; }
    });

    // ====================================================================
    // 📋 Dialoge
    // ====================================================================

    ipcMain.handle('dialog:open', async (event, { title, extensions } = {}) => {
        const parentWin = BrowserWindow.fromWebContents(event.sender);
        const { canceled, filePaths } = await dialog.showOpenDialog(parentWin, {
            title: title || 'Datei öffnen',
            filters: [{ name: 'Dateien', extensions: extensions || ['*'] }],
            properties: ['openFile']
        });
        return canceled ? null : filePaths[0];
    });

    ipcMain.handle('dialog:save', async (event, { title, defaultName, extensions } = {}) => {
        const parentWin = BrowserWindow.fromWebContents(event.sender);
        const suggestion = path.join(app.getPath('downloads'), defaultName || 'export.json');

        const { canceled, filePath } = await dialog.showSaveDialog(parentWin, {
            title: title || 'Speichern unter',
            defaultPath: suggestion,
            filters: [{ name: 'Dateien', extensions: extensions || ['*'] }]
        });
        return canceled ? null : filePath;
    });

    ipcMain.handle('dialog:select-folder', async (event) => {
        const parentWin = BrowserWindow.fromWebContents(event.sender);
        const { canceled, filePaths } = await dialog.showOpenDialog(parentWin, {
            title: 'Speicherort für Medien auswählen',
            properties: ['openDirectory', 'createDirectory', 'promptToCreate']
        });
        if (canceled) return null;
        return filePaths[0];
    });

    // ====================================================================
    // 📥 CSV Import
    // ====================================================================

    ipcMain.handle('csv:import-file', async (_, { filePath }) => {
        try {
            console.log('[csv:import-file] Lese CSV:', filePath);
            const buffer = fs.readFileSync(filePath);
            let fileContent = buffer.toString('utf-8');

            // Fallback: Wenn Replacement Character enthalten ist → Latin1
            if (fileContent.includes('\ufffd')) {
                fileContent = buffer.toString('latin1');
            }

            const parsed = Papa.parse(fileContent, { header: true, skipEmptyLines: true });

            console.log('[csv:import-file] Geladen:', parsed.data.length, 'Zeilen');
            return {
                headers: parsed.data.length > 0 ? Object.keys(parsed.data[0]) : [],
                rows: parsed.data,
                errors: parsed.errors
            };
        } catch (err) {
            console.error('[csv:import-file] Fehler:', err.message);
            throw new Error(`CSV Import Fehler: ${err.message}`);
        }
    });

    // ====================================================================
    // 📝 Logging
    // ====================================================================

    ipcMain.handle('sidebar:log', (_, message) => {
        console.log('[SIDEBAR]', message);
    });

    ipcMain.on('app:log', (_, msg) => {
        console.log(`[Renderer-Log] ${msg}`);
    });

    console.log('✅ File Handler registriert');
}

module.exports = { registerFileHandlers };

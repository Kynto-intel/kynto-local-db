/**
 * ═══════════════════════════════════════════════════════════════
 *  src/main/handlers/maintenance-handler.js
 *  IPC-Handler für Main Process
 *
 *  In src/main/handlers/index.js einbinden:
 *    const { registerMaintenanceHandlers } = require('./maintenance-handler');
 *    registerMaintenanceHandlers();
 * ═══════════════════════════════════════════════════════════════
 */

const { ipcMain } = require('electron');
const engine    = require('../config/DBMaintenance/cleanup-engine');
const scheduler = require('../config/DBMaintenance/scheduler');

function registerMaintenanceHandlers() {

    // ── Statistiken ───────────────────────────────────────────────
    ipcMain.handle('maintenance:stats', () => {
        try {
            return { ok: true, result: engine.getStats() };
        } catch (e) { return { ok: false, error: e.message }; }
    });

    // ── Vorschau ──────────────────────────────────────────────────
    ipcMain.handle('maintenance:preview', (_, options) => {
        try {
            return { ok: true, result: engine.previewCleanup(options || {}) };
        } catch (e) { return { ok: false, error: e.message }; }
    });

    // ── Cleanup ausführen ─────────────────────────────────────────
    ipcMain.handle('maintenance:run', (_, options) => {
        try {
            const result = engine.runCleanup(options || {});
            return { ok: true, result };
        } catch (e) { return { ok: false, error: e.message }; }
    });

    // ── Preset-Liste ──────────────────────────────────────────────
    ipcMain.handle('maintenance:presets', () => {
        return { ok: true, result: engine.PRESETS };
    });

    // ── Tabellen-Liste ────────────────────────────────────────────
    ipcMain.handle('maintenance:tables', () => {
        return { ok: true, result: engine.MANAGED_TABLES };
    });

    // ── Scheduler-Status ──────────────────────────────────────────
    ipcMain.handle('maintenance:schedulerStatus', () => {
        return { ok: true, result: scheduler.getStatus() };
    });

    // ── Scheduler konfigurieren ───────────────────────────────────
    ipcMain.handle('maintenance:schedulerUpdate', (_, config) => {
        try {
            scheduler.updateConfig(config);
            return { ok: true, result: scheduler.getStatus() };
        } catch (e) { return { ok: false, error: e.message }; }
    });

    console.log('[Main] ✅ Maintenance-Handler registriert');
}

module.exports = { registerMaintenanceHandlers };
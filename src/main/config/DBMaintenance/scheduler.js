/**
 * ═══════════════════════════════════════════════════════════════
 *  DBMaintenance/scheduler.js
 *  Automatischer Cleanup-Scheduler (läuft im Main Process)
 * ═══════════════════════════════════════════════════════════════
 */

const { runCleanup } = require('./cleanup-engine');

let _timer      = null;
let _config     = null;   // Aktive Scheduler-Config
let _lastRun    = null;
let _running    = false;

// ── Standard-Konfiguration ────────────────────────────────────────
const DEFAULT_CONFIG = {
    enabled:         true,
    intervalHours:   24,          // Alle 24 Stunden
    runOnStartup:    false,       // Beim App-Start ausführen?
    tables:          'all',
    rule:            'older_30d', // Preset-Key
    vacuum:          true,
};

// ── Scheduler starten ─────────────────────────────────────────────

function start(config = {}) {
    stop(); // Vorherigen Timer sicher beenden

    _config = { ...DEFAULT_CONFIG, ...config };

    if (!_config.enabled) {
        console.log('[Scheduler] Deaktiviert — kein automatischer Cleanup.');
        return;
    }

    const intervalMs = _config.intervalHours * 60 * 60 * 1000;
    console.log(`[Scheduler] Gestartet: alle ${_config.intervalHours}h, Regel: ${_config.rule}`);

    // Sofort beim Start ausführen (optional)
    if (_config.runOnStartup) {
        console.log('[Scheduler] Führe Startup-Cleanup aus...');
        _execute();
    }

    _timer = setInterval(_execute, intervalMs);

    // Node.js: Timer soll App nicht am Beenden hindern
    if (_timer.unref) _timer.unref();
}

function stop() {
    if (_timer) {
        clearInterval(_timer);
        _timer = null;
        console.log('[Scheduler] Gestoppt.');
    }
}

function _execute() {
    if (_running) {
        console.log('[Scheduler] Läuft bereits — übersprungen.');
        return;
    }
    _running = true;
    console.log('[Scheduler] Automatischer Cleanup startet...');

    try {
        const result = runCleanup({
            tables: _config.tables,
            rule:   _config.rule,
            vacuum: _config.vacuum,
        });
        _lastRun = { ...result, triggeredBy: 'scheduler' };
        console.log(`[Scheduler] ✓ ${result.totalDeleted} Zeilen gelöscht.`);
    } catch (err) {
        console.error('[Scheduler] Fehler:', err.message);
        _lastRun = { success: false, error: err.message, triggeredBy: 'scheduler' };
    } finally {
        _running = false;
    }
}

function getStatus() {
    return {
        active:       _timer !== null,
        config:       _config,
        lastRun:      _lastRun,
        nextRunIn:    _timer && _config
            ? `ca. ${_config.intervalHours}h`
            : null,
    };
}

// Config live aktualisieren (ohne Neustart)
function updateConfig(newConfig) {
    start({ ..._config, ...newConfig });
}

module.exports = { start, stop, getStatus, updateConfig };
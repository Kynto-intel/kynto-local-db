/* ══════════════════════════════════════════════════════════════════════
   modules/sync-center.js  —  Sync-Center Logik (PGlite ↔ ProgressSQL nur)
   
   Das HTML liegt in settings-modal.html (pane-sync).
   initSyncCenter() lädt den gespeicherten Connection-String und
   stellt beim Start automatisch die Verbindung wieder her.
   wireSyncEvents() wird von settings.js aufgerufen sobald das HTML da ist.
   Die Live-Fortschrittsanzeige wird von sync-center-progress.js verwaltet.
   ══════════════════════════════════════════════════════════════════════ */

import { state }         from './state.js';
import { setStatus }     from './utils.js';
import { refreshTableList } from './sidebar.js';
import { updateRemoteStatus } from './mode-switcher.js';
let _serverConnectionString = '';

// ── Beim App-Start: gespeicherten Connection-String laden ──────────────

export async function initSyncCenter() {
    const settings = await window.api.loadSettings().catch(() => ({}));
    const saved = settings.database?.postgresqlConnectionString || '';

    if (!saved) return; // Nichts gespeichert → nichts tun

    _serverConnectionString = saved;
    state.serverConnectionString = saved;

    // Verbindung mit ProgressSQL Server testen
    try {
        const result = await window.api.serverConnect(_serverConnectionString);

        if (result.ok) {
            state.serverConnectionString = _serverConnectionString;
            state.serverVersion = result.version;
            state.serverLatency = result.latencyMs;
            
            // NEU: Remote-DB in database-engine registrieren (Auto-Reconnect)
            try {
                await window.api.dbRegisterRemote(_serverConnectionString);
                console.log('[sync-center] Remote-DB automatisch registriert (Auto-Reconnect)');
            } catch (err) {
                console.error('[sync-center] Fehler beim Auto-Reconnect DB-Registrieren:', err.message);
            }
            
            updateRemoteStatus();
            console.log('[sync-center] ProgressSQL Server-Verbindung wiederhergestellt');
            
            // NEU: DB-Liste aktualisieren damit Remote-DB sofort sichtbar ist
            try {
                const { refreshDBList } = await import('./sidebar.js');
                await refreshDBList();
            } catch (err) {
                console.warn('[sync-center] Auto-refresh DBList fehlgeschlagen:', err);
            }
        } else {
            console.warn('[sync-center] Gespeicherte Verbindung fehlgeschlagen:', result.error);
        }
    } catch (e) {
        console.warn('[sync-center] Auto-Reconnect fehlgeschlagen:', e.message);
    }
}

// ── Events verdrahten (wird von settings.js aufgerufen) ────────────────

export function wireSyncEvents() {
    const btnConnect = document.getElementById('btn-sync-connect');
    if (!btnConnect) return;

    // Gespeicherten Connection-String ins Input schreiben (falls bereits geladen)
    const input = document.getElementById('sync-conn-input');
    if (input && state.serverConnectionString) {
        input.value = state.serverConnectionString;
        _serverConnectionString = state.serverConnectionString;
        
        // Status-Dot aktualisieren falls bereits verbunden
        setDot('online');
        setText('Verbunden');
        
        const latEl = document.getElementById('sync-latency');
        if (latEl && state.serverLatency) latEl.textContent = `${state.serverLatency}ms`;
        
        const versionEl = document.getElementById('sync-server-version');
        if (versionEl && state.serverVersion) {
            versionEl.textContent = state.serverVersion.split(' ').slice(0, 2).join(' ');
            versionEl.style.display = 'block';
        }
    }

    // Event-Listeners für Verbindung
    btnConnect.addEventListener('click', handleConnect);
    // Sync-Buttons entfernt - nicht mehr notwendig (Daten reside in separate local + remote DBs)
}

// ── Verbindung herstellen ──────────────────────────────────────────────

async function handleConnect() {
    const input = document.getElementById('sync-conn-input')?.value.trim();
    if (!input) return;

    _serverConnectionString = input;
    setDot('checking');
    setText('Verbinde…');
    const latEl = document.getElementById('sync-latency');
    if (latEl) latEl.textContent = '';

    try {
        const result = await window.api.serverConnect(_serverConnectionString);

        if (result.ok) {
            setDot('online');
            setText('Verbunden');
            if (latEl) latEl.textContent = `${result.latencyMs}ms`;

            const versionEl = document.getElementById('sync-server-version');
            if (versionEl) {
                versionEl.textContent = result.version?.split(' ').slice(0, 2).join(' ') || '';
                versionEl.style.display = 'block';
            }

            // State aktualisieren
            state.serverConnectionString = _serverConnectionString;
            state.serverVersion = result.version;
            state.serverLatency = result.latencyMs;

            // Remote-DB in database-engine registrieren
            try {
                await window.api.dbRegisterRemote(_serverConnectionString);
                console.log('[sync-center] Remote-DB in database-engine registriert');
            } catch (err) {
                console.error('[sync-center] Fehler beim DB-Registrieren:', err.message);
            }

            // Persistent speichern IN settings.database.postgresqlConnectionString
            const settings = await window.api.loadSettings();
            settings.database = settings.database || {};
            settings.database.postgresqlConnectionString = _serverConnectionString;
            await window.api.saveSettings(settings);

            setStatus('ProgressSQL Server-Verbindung hergestellt.', 'success');

            // Header-Status aktualisieren
            updateRemoteStatus();

            // NEU: Datenbank-Liste + Tabellenliste aktualisieren (Live-Update!)
            const { refreshDBList } = await import('./sidebar.js');
            await refreshDBList();
            await refreshTableList();

        } else {
            setDot('offline');
            setText('Verbindung fehlgeschlagen');
            logError(result.error || 'Unbekannter Fehler');
        }
    } catch (err) {
        setDot('offline');
        setText('Fehler');
        logError(err.message || String(err));
    }
}

// ── Hilfsfunktionen ────────────────────────────────────────────────────

function setDot(dotState) {
    const dot = document.getElementById('sync-status-dot');
    if (!dot) return;
    dot.style.background = dotState === 'online'
        ? 'var(--success)'
        : dotState === 'checking'
            ? 'var(--accent)'
            : 'var(--error)';
}

function setText(text) {
    const el = document.getElementById('sync-status-text');
    if (el) el.textContent = text;
}

function disableButtons(disabled) {
    ['btn-sync-connect'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.disabled = disabled;
    });
}
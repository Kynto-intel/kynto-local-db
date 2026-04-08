/* ── modules/useKyntoRealtime.js ───────────────────────────────────────────
   Kynto Realtime Manager – PostgreSQL-optimiert, reines Vanilla JS.

   Ersetzt den React-Hook useKyntoRealtime.js vollständig.

   Funktionsweise:
   ┌─────────────────────────────────────────────────────────────────────┐
   │  Modus 1: LISTEN/NOTIFY  (aktiv wenn Postgres LISTEN unterstützt)  │
   │    → KyntoEvents.startListen() → pg_notify → sofortiges Reload     │
   │                                                                     │
   │  Modus 2: Smart Polling  (immer als Basis/Fallback)                 │
   │    → Hash-Vergleich via COUNT(*) + MAX(ctid)                        │
   │    → Reload nur bei echter Änderung, nicht bei jedem Tick          │
   └─────────────────────────────────────────────────────────────────────┘

   Verwendung:
     import { KyntoRealtime } from './useKyntoRealtime.js';

     // Starten wenn Tabelle geöffnet wird
     KyntoRealtime.start({ table: 'users', schema: 'public', interval: 3000 });

     // Stoppen wenn Tabelle geschlossen / gewechselt wird
     KyntoRealtime.stop();
   ────────────────────────────────────────────────────────────────────────── */

import { state }    from './state.js';
import { setStatus } from './utils.js';
import { KyntoEvents, buildNotifyTriggerSql, buildDropTriggerSql } from '../../src/lib/kynto-events.js';

// ── Interne State-Variablen ────────────────────────────────────────────────

let _pollTimer       = null;   // setInterval Handle
let _activeTable     = null;   // aktuell beobachtete Tabelle
let _activeSchema    = 'public';
let _lastHash        = null;   // letzte bekannte Daten-Signatur
let _lastSyncedCtid  = null;   // letzte synced ctid/rowid - für inkrementelle Updates
let _isRunning       = false;
let _unsubscribeEvent = null;  // KyntoEvents.subscribe() Cleanup
let _triggerInstalled = false; // ob NOTIFY-Trigger installiert wurde
let _lastReloadTime  = 0;      // Debounce: letzte Reload-Zeit
let _reloadDebounceMs = 250;   // Debounce: minimale Zeit zwischen Reloads

// ── Öffentliche API ────────────────────────────────────────────────────────

export const KyntoRealtime = {

    /**
     * Startet Realtime-Beobachtung für eine Tabelle.
     *
     * @param {object} opts
     * @param {string}   opts.table           – Tabellenname
     * @param {string}   [opts.schema]        – Schema (default: 'public')
     * @param {number}   [opts.interval]      – Polling-Intervall ms (default: 500 für flüssiges Realtime)
     * @param {boolean}  [opts.installTrigger]– NOTIFY-Trigger installieren (default: false)
     * @param {function} [opts.onReload]      – Callback wenn Daten neu geladen werden
     */
    async start({ table, schema = 'public', interval = 500, installTrigger = false, onReload = null } = {}) {
        console.log('[KyntoRealtime.start] Startet mit table:', table, 'schema:', schema, 'interval:', interval);
        
        // Vorherige Session stoppen
        this.stop();

        if (!table) {
            console.warn('[KyntoRealtime.start] Keine Tabelle angegeben');
            return;
        }

        _activeTable  = table;
        _activeSchema = schema;
        _isRunning    = true;
        _lastHash     = null;

        console.info(`[KyntoRealtime] Gestartet: ${schema}.${table} (Intervall: ${interval}ms)`);

        // ── Schritt 1: LISTEN/NOTIFY aktivieren ────────────────────────
        const connStr = _getConnectionString();
        console.log('[KyntoRealtime] ConnectionString verfügbar:', !!connStr);
        
        if (connStr) {
            try {
                await KyntoEvents.startListen(connStr);
                console.log('[KyntoRealtime] LISTEN gestartet');

                // NOTIFY-Trigger optional installieren
                if (installTrigger && !_triggerInstalled) {
                    await _installTrigger(schema, table);
                }
            } catch (err) {
                console.warn('[KyntoRealtime] LISTEN fehlgeschlagen:', err.message);
            }
        } else {
            console.log('[KyntoRealtime] Keine ConnectionString – nutze nur Polling');
        }

        // ── Schritt 2: Event-Bus abonnieren ────────────────────────────
        _unsubscribeEvent = KyntoEvents.subscribe(async (event) => {
            if (event.detail.tableId === table) {
                console.debug(`[KyntoRealtime] Event empfangen: ${event.detail.operation} in ${table} (via ${event.detail.source})`);
                await _doReload(onReload);
            }
        }, table);

        // ── Schritt 3: Polling starten ─────────────────────────────────
        console.log('[KyntoRealtime] Starte Polling mit Intervall:', interval);
        _pollTimer = setInterval(async () => {
            if (!_isRunning) return;
            try {
                const changed = await _checkForChanges(schema, table);
                if (changed) {
                    console.debug(`[KyntoRealtime] Polling: Änderung in ${schema}.${table} erkannt.`);
                    KyntoEvents.notify(table, 'POLLING', schema);
                }
            } catch (err) {
                console.warn('[KyntoRealtime] Polling-Fehler:', err.message);
            }
        }, interval);

        // Initialen Hash setzen ohne Reload
        await _checkForChanges(schema, table);
        console.log('[KyntoRealtime.start] Erfolgreich gestartet');
    },

    /**
     * Stoppt alle Realtime-Aktivitäten für die aktuelle Tabelle.
     */
    stop() {
        if (!_isRunning && !_pollTimer) return;

        _isRunning = false;

        // Polling stoppen
        if (_pollTimer) {
            clearInterval(_pollTimer);
            _pollTimer = null;
        }

        // Event-Subscription beenden
        if (_unsubscribeEvent) {
            _unsubscribeEvent();
            _unsubscribeEvent = null;
        }

        // LISTEN stoppen (nur wenn kein anderes Modul es nutzt)
        KyntoEvents.stopListen();

        // Trigger NICHT automatisch deinstallieren – bleibt für nächste Session
        _triggerInstalled = false;

        const prev = _activeTable;
        _activeTable  = null;
        _activeSchema = 'public';
        _lastHash     = null;

        if (prev) console.info(`[KyntoRealtime] Gestoppt: ${prev}`);
    },

    /**
     * Installiert den NOTIFY-Trigger manuell auf der aktuellen Tabelle.
     * Nützlich wenn der Nutzer Realtime dauerhaft aktivieren will.
     */
    async installTrigger(schema, table) {
        return _installTrigger(schema ?? _activeSchema, table ?? _activeTable);
    },

    /**
     * Entfernt den NOTIFY-Trigger von der aktuellen Tabelle.
     */
    async removeTrigger(schema, table) {
        return _removeTrigger(schema ?? _activeSchema, table ?? _activeTable);
    },

    /** Gibt zurück ob Realtime gerade aktiv ist */
    isRunning() { return _isRunning; },

    /** Gibt zurück ob LISTEN/NOTIFY verfügbar ist */
    isListening() { return KyntoEvents.isListening(); },

    /** Gibt die aktuelle Tabelle zurück */
    currentTable() { return _activeTable; },
};

// Globaler Zugriff für action-bar.js
window.KyntoRealtime = KyntoRealtime;

// ── Private Hilfsfunktionen ────────────────────────────────────────────────

/**
 * Vergleicht Tabellenzustand und gibt an ob sich etwas geändert hat
 */
async function _checkForChanges(schema, table) {
    try {
        const dbId = _getDbId();
        const mode = state.dbMode || 'duck';

        console.log('[KyntoRealtime._checkForChanges] mode:', mode, 'dbId:', dbId);

        let hashVal;

        if (mode === 'remote' || mode === 'pglite') {
            // PostgreSQL: ctid ändert sich bei UPDATE (MVCC), perfekt als Change-Marker
            const sql = `
                SELECT
                    COUNT(*)::text                          AS cnt,
                    COALESCE(MAX(ctid::text), 'none')       AS last_ctid,
                    COALESCE(MAX(xmax::text), '0')          AS last_xmax
                FROM "${schema}"."${table}"
            `;
            
            // Map dbMode zu dbType für database-engine
            const dbType = mode === 'pglite' ? 'local' : 'remote';
            
            console.log('[KyntoRealtime._checkForChanges] Exec SQL:', sql.substring(0, 50) + '...');
            console.log('[KyntoRealtime._checkForChanges] dbType:', dbType);

            if (!window.api?.dbQuery) {
                console.error('[KyntoRealtime._checkForChanges] window.api.dbQuery nicht verfügbar!');
                throw new Error('window.api.dbQuery nicht verfügbar');
            }

            // Nutze neue database-engine für beide DB-Typen
            const rows = await window.api.dbQuery(sql, null, dbType);
            console.log('[KyntoRealtime._checkForChanges] Rows:', rows);
            
            const r = rows?.[0];
            hashVal = `${r?.cnt}|${r?.last_ctid}|${r?.last_xmax}`;

        } else {
            // DuckDB: kein ctid, nutze COUNT + rowid falls vorhanden
            const sql = `SELECT COUNT(*)::TEXT AS cnt FROM "${schema}"."${table}"`;
            const rows = await window.api.query(sql, dbId);
            hashVal = rows?.[0]?.cnt ?? '0';
        }

        if (_lastHash === null) {
            _lastHash = hashVal;
            console.log('[KyntoRealtime._checkForChanges] Erste Messung, hash:', hashVal);
            return false; // Erstmessung, kein Reload
        }

        if (hashVal !== _lastHash) {
            console.log('[KyntoRealtime._checkForChanges] Hash geändert von', _lastHash, 'zu', hashVal);
            _lastHash = hashVal;
            return true; // Geändert!
        }

        console.log('[KyntoRealtime._checkForChanges] Keine Änderung');
        return false;

    } catch (err) {
        // Leise scheitern – Tabelle existiert möglicherweise noch nicht
        console.warn('[KyntoRealtime._checkForChanges] Fehler:', err.message);
        return false;
    }
}

/**
 * NEUE FUNKTION: Fetcht nur die neuen/geänderten Zeilen seit letztem Sync
 */
async function _fetchIncrementalChanges(schema, table) {
    try {
        const dbId = _getDbId();
        const mode = state.dbMode || 'duck';
        
        console.log('[KyntoRealtime._fetchIncrementalChanges] Starte inkrementellen Fetch');

        if (mode === 'remote' || mode === 'pglite') {
            const dbType = mode === 'pglite' ? 'local' : 'remote';
            
            // Query nur NEUE Zeilen seit dem letzten Sync
            // Nutzt ctid für PostgreSQL - das ist die Zeilen-Adresse und ändert sich bei Einfügungen
            let sql;
            if (_lastSyncedCtid) {
                sql = `
                    SELECT * FROM "${schema}"."${table}"
                    WHERE ctid > '${_lastSyncedCtid}'::tid
                    ORDER BY ctid ASC
                    LIMIT 100
                `;
            } else {
                // Erste Synchronisation - hole die letzten 100 Zeilen
                sql = `
                    SELECT * FROM "${schema}"."${table}"
                    ORDER BY ctid DESC
                    LIMIT 100
                `;
            }
            
            console.log('[KyntoRealtime] Hole neue Zeilen:', sql.substring(0, 70) + '...');
            const newRows = await window.api.dbQuery(sql, null, dbType);
            console.log('[KyntoRealtime] Kehabenen neue Zeilen:', newRows?.length || 0);
            
            if (newRows && newRows.length > 0) {
                // Update die letzte synced ctid
                const lastRow = newRows[newRows.length - 1];
                if (lastRow && lastRow.ctid) {
                    _lastSyncedCtid = lastRow.ctid;
                    console.log('[KyntoRealtime] Neue ctid gesetzt:', _lastSyncedCtid);
                }
                
                return {
                    type: 'INSERT',
                    newRows: newRows,
                    rowCount: newRows.length
                };
            }
        }
        
        return null;
    } catch (err) {
        console.warn('[KyntoRealtime._fetchIncrementalChanges] Fehler:', err.message);
        return null;
    }
}

/**
 * Statt die ganze Tabelle neu zu laden
 */
async function _doReload(onReload) {
    if (!_activeTable) return;

    // Debounce: nicht öfter als alle 250ms reloaden
    const now = Date.now();
    if (now - _lastReloadTime < _reloadDebounceMs) {
        console.debug(`[KyntoRealtime] Reload zu schnell, debounced. (${now - _lastReloadTime}ms seit letztem Reload)`);
        return;
    }
    _lastReloadTime = now;

    try {
        // Versuche inkrementelle Updates (nur neue Zeilen)
        const changes = await _fetchIncrementalChanges(_activeSchema, _activeTable);
        
        if (changes && changes.newRows && changes.newRows.length > 0) {
            console.log(`[KyntoRealtime] ✨ ${changes.newRows.length} neue Zeilen gefunden!`);
            
            // Dispatch neuer Event für UI zum Hinzufügen der Zeilen
            const event = new CustomEvent('kynto:realtime-update', {
                detail: {
                    type: 'INSERT',
                    table: _activeTable,
                    schema: _activeSchema,
                    newRows: changes.newRows,
                    rowCount: changes.newRows.length,
                    timestamp: Date.now(),
                    source: 'realtime-polling'
                }
            });
            window.dispatchEvent(event);
            console.log('[KyntoRealtime] Event "kynto:realtime-update" dispatched');
            return;
        }
        
        // Fallback: Wenn inkrementelle Updates nicht funktionieren, verwende onReload
        if (typeof onReload === 'function') {
            console.log('[KyntoRealtime] Fallback: Rufe onReload callback auf');
            await onReload(_activeTable, _activeSchema);
        }
        
    } catch (err) {
        console.warn('[KyntoRealtime._doReload] Fehler:', err.message);
        // Im Fehlerfall einen Full-Reload versuchen
        try {
            if (typeof window.openTableInEditor === 'function') {
                await window.openTableInEditor(_activeTable, _activeSchema);
            }
        } catch (innerErr) {
            console.error('[KyntoRealtime] Auch Fallback fehlgeschlagen:', innerErr);
        }
    }
}

/**
 * Installiert den NOTIFY-Trigger auf einer Tabelle.
 * Läuft nur bei Remote/PGlite-Verbindung.
 */
async function _installTrigger(schema, table) {
    if (!table) return;
    const mode = state.dbMode || 'duck';
    if (mode === 'duck') {
        console.debug('[KyntoRealtime] NOTIFY-Trigger nur für PostgreSQL verfügbar.');
        return;
    }

    try {
        const sql = buildNotifyTriggerSql(schema, table);

        // Map dbMode zu dbType für database-engine
        const dbType = mode === 'pglite' ? 'local' : 'remote';

        // Nutze neue database-engine für beide DB-Typen
        await window.api.dbQuery(sql, null, dbType);

        _triggerInstalled = true;
        console.info(`[KyntoRealtime] NOTIFY-Trigger installiert: ${schema}.${table}`);
        setStatus(`Realtime-Trigger für "${table}" aktiviert.`, 'success');
    } catch (err) {
        console.warn('[KyntoRealtime] Trigger-Installation fehlgeschlagen:', err.message);
        // Kein Fehler anzeigen – Polling übernimmt als Fallback
    }
}

/**
 * Entfernt den NOTIFY-Trigger von einer Tabelle.
 */
async function _removeTrigger(schema, table) {
    if (!table) return;
    const mode = state.dbMode || 'duck';
    if (mode === 'duck') return;

    try {
        const sql = buildDropTriggerSql(schema, table);

        // Map dbMode zu dbType für database-engine
        const dbType = mode === 'pglite' ? 'local' : 'remote';

        // Nutze neue database-engine für beide DB-Typen
        await window.api.dbQuery(sql, null, dbType);

        _triggerInstalled = false;
        console.info(`[KyntoRealtime] NOTIFY-Trigger entfernt: ${schema}.${table}`);
    } catch (err) {
        console.warn('[KyntoRealtime] Trigger-Entfernung fehlgeschlagen:', err.message);
    }
}

function _getDbId() {
    return state.dbMode === 'pglite' ? state.pgId : state.activeDbId;
}

function _getConnectionString() {
    if (state.dbMode === 'remote') return state.remoteConnectionString;
    if (state.dbMode === 'pglite') return state.pgId;
    return null;
}

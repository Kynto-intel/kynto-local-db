/**
 * Realtime Connection Manager mit Auto-Reconnect
 * 
 * Architektur:
 * - Verwaltet Verbindung zu PostgreSQL LISTEN/NOTIFY
 * - Auto-Reconnect mit exponentiall backoff (1s, 2s, 4s, 8s...max 30s)
 * - Status-Tracking (connected, connecting, disconnected, error)
 * - Benachrichtigungen bei Status-Änderung
 * 
 * State Machine:
 * disconnected ↔ connecting → connected
 *                           ↘ error → disconnected → connecting (retry)
 */

import { KyntoEvents } from '../../../src/lib/kynto-events.js';

// ── Konstanten ──────────────────────────────────────────────────────────────

const MIN_BACKOFF_MS = 1000;     // 1 Sekunde
const MAX_BACKOFF_MS = 30000;    // 30 Sekunden
const BACKOFF_MULTIPLIER = 2;

const CONNECTION_STATES = {
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  ERROR: 'error',
  STOPPING: 'stopping',
};

const DOM_EVENT = 'realtime:connection-changed';

// ── Realtime Connection Manager ─────────────────────────────────────────────

export const RealtimeConnection = {

  // ── Interne State ────────────────────────────────────────────────────────
  
  _state: CONNECTION_STATES.DISCONNECTED,
  _backoffMs: MIN_BACKOFF_MS,
  _reconnectTimeout: null,
  _connectionString: null,
  _lastError: null,
  _reconnectAttempts: 0,
  _maxReconnectAttempts: Infinity,  // Unendlich versuchen
  _isManuallyStopped: false,

  // ── Getter ───────────────────────────────────────────────────────────────

  /**
   * Gibt aktuellen Connection-Status zurück
   * @returns {string} 'disconnected' | 'connecting' | 'connected' | 'error'
   */
  getState() {
    return this._state;
  },

  /**
   * Gibt Anzahl Reconnect-Versuche zurück
   */
  getReconnectAttempts() {
    return this._reconnectAttempts;
  },

  /**
   * Ist die Verbindung aktiv?
   */
  isConnected() {
    return this._state === CONNECTION_STATES.CONNECTED;
  },

  /**
   * Versucht gerade zu verbinden?
   */
  isConnecting() {
    return this._state === CONNECTION_STATES.CONNECTING;
  },

  /**
   * Gibt den letzten Fehler zurück
   */
  getLastError() {
    return this._lastError;
  },

  // ── Status Management ────────────────────────────────────────────────────

  /**
   * Ändert den State und feuert Event
   * @private
   */
  _setState(newState) {
    if (this._state === newState) return;  // Keine doppelten Events

    const oldState = this._state;
    this._state = newState;

    console.log(`[RealtimeConnection] Status: ${oldState} → ${newState}`);

    // Feuere Event für UI Update
    const event = new CustomEvent(DOM_EVENT, {
      detail: {
        state: newState,
        previousState: oldState,
        attempts: this._reconnectAttempts,
        error: this._lastError,
        timestamp: Date.now(),
      }
    });
    window.dispatchEvent(event);
  },

  /**
   * Abonniert Connection-Status-Änderungen
   * @param {function} callback
   * @returns {function} unsubscribe
   */
  onConnectionChanged(callback) {
    window.addEventListener(DOM_EVENT, callback);
    return () => window.removeEventListener(DOM_EVENT, callback);
  },

  // ── Connection Management ────────────────────────────────────────────────

  /**
   * Startet automatische Verbindung mit Auto-Reconnect
   * @param {string} connectionString - PostgreSQL Connection String
   * @param {number} [maxAttempts=Infinity] - Max Reconnect-Versuche (0=unendlich)
   */
  async start(connectionString, maxAttempts = Infinity) {
    this._connectionString = connectionString;
    this._maxReconnectAttempts = maxAttempts === 0 ? Infinity : maxAttempts;
    this._isManuallyStopped = false;

    console.info(`[RealtimeConnection] ▶️ Starten mit Auto-Reconnect (max ${maxAttempts} Versuche)`);

    return this._tryConnect();
  },

  /**
   * Stoppt die Verbindung und Reconnect-Versuche
   */
  async stop() {
    console.info(`[RealtimeConnection] ⏹️ Manuell gestoppt`);

    this._isManuallyStopped = true;
    this._clearReconnectTimeout();

    await KyntoEvents.stopListen();
    this._setState(CONNECTION_STATES.DISCONNECTED);
    this._backoffMs = MIN_BACKOFF_MS;
    this._reconnectAttempts = 0;
  },

  /**
   * Force Reconnect (z.B. wenn Server neu gestartet)
   */
  async forceReconnect() {
    console.info(`[RealtimeConnection] 🔄 Erzwinge Neuverbindung`);

    this._isManuallyStopped = false;
    this._backoffMs = MIN_BACKOFF_MS;  // Reset backoff
    this._reconnectAttempts = 0;

    await KyntoEvents.stopListen();
    this._setState(CONNECTION_STATES.DISCONNECTED);

    return this._tryConnect();
  },

  // ── Interne Retry-Logik ────────────────────────────────────────────────

  /**
   * Versucht Verbindung herzustellen
   * @private
   */
  async _tryConnect() {
    if (this._isManuallyStopped) {
      console.debug('[RealtimeConnection] Keine Verbindung: manuell gestoppt');
      return false;
    }

    if (!this._connectionString) {
      console.warn('[RealtimeConnection] ❌ Keine Connection String verfügbar');
      this._setState(CONNECTION_STATES.ERROR);
      this._lastError = 'No connection string provided';
      return false;
    }

    this._reconnectAttempts++;
    this._setState(CONNECTION_STATES.CONNECTING);

    console.log(`[RealtimeConnection] 🔌 Verbindungsversuch #${this._reconnectAttempts}...`);

    try {
      // Öffne LISTEN
      await KyntoEvents.startListen(this._connectionString);

      // Check ob erfolgreich
      if (KyntoEvents.isListening()) {
        this._setState(CONNECTION_STATES.CONNECTED);
        this._backoffMs = MIN_BACKOFF_MS;  // Reset backoff
        this._lastError = null;
        console.info(`[RealtimeConnection] ✅ Verbunden`);
        return true;
      } else {
        throw new Error('LISTEN konnte nicht gestartet werden');
      }

    } catch (err) {
      console.error(`[RealtimeConnection] ❌ Verbindungsversuch #${this._reconnectAttempts} fehlgeschlagen:`, err.message);

      this._lastError = err.message;
      this._setState(CONNECTION_STATES.ERROR);

      // Prüfe ob max Versuche erreicht
      if (this._reconnectAttempts >= this._maxReconnectAttempts) {
        console.error(`[RealtimeConnection] ❌ Max Versuche (${this._maxReconnectAttempts}) erreicht`);
        return false;
      }

      // Plane Retry mit Backoff
      this._scheduleReconnect();
      return false;
    }
  },

  /**
   * Plant nächsten Reconnect-Versuch mit Backoff
   * @private
   */
  _scheduleReconnect() {
    this._clearReconnectTimeout();

    // Exponentialer Backoff: 1s, 2s, 4s, 8s, 16s, 30s, 30s, ...
    this._backoffMs = Math.min(
      this._backoffMs * BACKOFF_MULTIPLIER,
      MAX_BACKOFF_MS
    );

    console.log(`[RealtimeConnection] ⏱️ Retry in ${this._backoffMs}ms...`);

    this._reconnectTimeout = setTimeout(() => {
      this._reconnectTimeout = null;
      if (!this._isManuallyStopped) {
        this._tryConnect();
      }
    }, this._backoffMs);
  },

  /**
   * Löscht geplanten Reconnect
   * @private
   */
  _clearReconnectTimeout() {
    if (this._reconnectTimeout) {
      clearTimeout(this._reconnectTimeout);
      this._reconnectTimeout = null;
    }
  },
};

// Globaler Zugriff
window.RealtimeConnection = RealtimeConnection;

export const CONNECTION_STATES_EXPORT = CONNECTION_STATES;

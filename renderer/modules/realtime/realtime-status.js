/**
 * Realtime Connection Status UI
 * 
 * Zeigt visuellen Status der Realtime-Verbindung:
 * - Grüner Punkt: Connected
 * - Gelber Punkt mit Spinner: Connecting/Reconnecting
 * - Roter Punkt: Disconnected/Error
 * - Mit Tooltip und Fehler-Message
 */

import { RealtimeConnection } from './realtime-connection.js';

const STATUS_INDICATOR_ID = 'realtime-status-indicator';
const TOOLTIP_CLASS = 'realtime-status-tooltip';

export const RealtimeStatusUI = {

  _container: null,
  _unsubscribeConnection: null,
  _unsubscribeI18n: null,

  /**
   * Initialisiert den Status-Indikator
   * Wird normalerweise von app.js aufgerufen
   */
  init() {
    // Finde bestehenden Container (aus HTML)
    this._container = document.getElementById('realtime-status-indicator-container');
    
    if (!this._container) {
      console.error('[RealtimeStatusUI] Container #realtime-status-indicator-container nicht gefunden!');
      return;
    }
    
    // Listen auf Connection-Status Änderungen
    this._unsubscribeConnection = RealtimeConnection.onConnectionChanged((event) => {
      this._updateStatus(event.detail);
    });

    // Listen auf Language Changes
    this._unsubscribeI18n = window.addEventListener('i18n:loaded', () => this._updateStatus());

    // Initial Status anzeigen
    this._updateStatus();

    console.log('[RealtimeStatusUI] ✅ Initialisiert');
  },

  /**
   * Zerstört den Status-Indikator
   */
  destroy() {
    if (this._unsubscribeConnection) {
      this._unsubscribeConnection();
      this._unsubscribeConnection = null;
    }
    if (this._unsubscribeI18n) {
      this._unsubscribeI18n();
      this._unsubscribeI18n = null;
    }
    if (this._container?.parentElement) {
      this._container.remove();
    }
    this._container = null;
  },

  /**
   * Erstellt den DOM-Indikator
   * @private
   */
  _createIndicator() {
    // Container wird bereits von der HTML bereitgestellt
    // Diese Methode ist nur ein Fallback
    if (!this._container) {
      this._container = document.getElementById(STATUS_INDICATOR_ID);
    }
  },

  /**
   * Aktualisiert Status-Anzeige
   * @private
   */
  _updateStatus(details = {}) {
    if (!this._container) return;

    const state = details.state || RealtimeConnection.getState();
    const attempts = details.attempts || RealtimeConnection.getReconnectAttempts();
    const error = details.error || RealtimeConnection.getLastError();

    // Bestimme CSS-Klasse und Icon
    let statusClass = 'realtime-status-';
    let icon = '🔴';
    let label = 'Realtime Offline';
    let detail = '';

    switch (state) {
      case 'connected':
        statusClass += 'connected';
        icon = '🟢';
        label = 'Realtime Aktiv';
        detail = 'Live-Daten werden synchronisiert';
        break;

      case 'connecting':
        statusClass += 'connecting';
        icon = '🟡';
        label = 'Verbindung wird hergestellt';
        detail = `Versuch ${attempts}...`;
        break;

      case 'error':
        statusClass += 'error';
        icon = '🔴';
        label = 'Realtime Fehler';
        detail = error ? `${error} – Neuverbindung in Kürze...` : 'Fehler beim Verbinden';
        break;

      case 'disconnected':
      default:
        statusClass += 'disconnected';
        icon = '⚫';
        label = 'Realtime Offline';
        detail = attempts > 0 ? `Neuverbindung fehlgeschlagen (${attempts} Versuche)` : 'Nicht verbunden';
        break;
    }

    // Erstelle HTML
    this._container.className = `realtime-status-indicator ${statusClass}`;
    this._container.innerHTML = `
      <div class="realtime-status-dot" title="${label}">
        ${icon}
        ${state === 'connecting' ? '<span class="realtime-spinner"></span>' : ''}
      </div>
      <div class="${TOOLTIP_CLASS}">
        <div class="realtime-tooltip-label">${label}</div>
        <div class="realtime-tooltip-detail">${detail}</div>
        ${error ? `<div class="realtime-tooltip-error">Fehler: ${error}</div>` : ''}
      </div>
    `;

    // Attache Click Handler für manuelles Reconnect
    if (state === 'error' || state === 'disconnected') {
      this._container.style.cursor = 'pointer';
      this._container.onclick = () => this._handleReconnectClick();
    } else {
      this._container.style.cursor = 'default';
      this._container.onclick = null;
    }
  },

  /**
   * Handler für manuelles Reconnect (Click auf Indikator)
   * @private
   */
  async _handleReconnectClick() {
    console.log('[RealtimeStatusUI] Manuelles Reconnect angefordert');
    await RealtimeConnection.forceReconnect();
  },
};

// Globaler Zugriff
window.RealtimeStatusUI = RealtimeStatusUI;

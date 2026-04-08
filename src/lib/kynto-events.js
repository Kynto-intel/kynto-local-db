/* ── modules/lib/kynto-events.js ───────────────────────────────────────────
   Kynto Realtime Event Bus – optimiert für PostgreSQL LISTEN/NOTIFY.

   Architektur:
   ┌─────────────────────────────────────────────────────────────────────┐
   │  PostgreSQL          Electron Main          Renderer (hier)         │
   │                                                                     │
   │  NOTIFY kynto_changes  →  pg-listen IPC  →  KyntoEvents.notify()  │
   │  (nach INSERT/UPDATE/    (main.js polling  →  'kynto:db-change'    │
   │   DELETE via Trigger)     oder LISTEN)         CustomEvent          │
   └─────────────────────────────────────────────────────────────────────┘

   Zwei Signalwege:
   1. LISTEN/NOTIFY (Echtzeit, <1ms Latenz) – wenn IPC verfügbar
   2. Polling-Fallback (konfigurierbares Intervall) – immer verfügbar
   ────────────────────────────────────────────────────────────────────────── */

import { state } from '../../renderer/modules/state.js';

// ── Konstanten ─────────────────────────────────────────────────────────────

/** Name des PostgreSQL-Notification-Kanals */
const PG_CHANNEL = 'kynto_changes';

/** Name des DOM-CustomEvents */
const DOM_EVENT = 'kynto:db-change';

/** Standard-Polling-Intervall in ms (wird von KyntoRealtime überschrieben) */
const DEFAULT_POLL_INTERVAL = 3000;

// ── SQL: Trigger-Setup für NOTIFY ──────────────────────────────────────────

/**
 * SQL zum Einrichten des PostgreSQL NOTIFY-Triggers auf einer Tabelle.
 * Sendet bei INSERT, UPDATE, DELETE eine Notification mit Tabellenname + Operation.
 */
export function buildNotifyTriggerSql(schema, tableName) {
    const fnName  = `kynto_notify_${tableName.replace(/[^a-z0-9]/gi, '_')}`;
    const trgName = `kynto_trg_${tableName.replace(/[^a-z0-9]/gi, '_')}`;

    return `
-- Trigger-Funktion
CREATE OR REPLACE FUNCTION "${schema}"."${fnName}"()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_notify(
    '${PG_CHANNEL}',
    json_build_object(
      'table',     TG_TABLE_NAME,
      'schema',    TG_TABLE_SCHEMA,
      'operation', TG_OP,
      'ts',        extract(epoch from now())
    )::text
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Trigger (einmalig anlegen, idempotent)
DROP TRIGGER IF EXISTS "${trgName}" ON "${schema}"."${tableName}";
CREATE TRIGGER "${trgName}"
AFTER INSERT OR UPDATE OR DELETE ON "${schema}"."${tableName}"
FOR EACH ROW EXECUTE FUNCTION "${schema}"."${fnName}"();
`.trim();
}

/**
 * SQL zum Entfernen des Triggers von einer Tabelle.
 */
export function buildDropTriggerSql(schema, tableName) {
    const fnName  = `kynto_notify_${tableName.replace(/[^a-z0-9]/gi, '_')}`;
    const trgName = `kynto_trg_${tableName.replace(/[^a-z0-9]/gi, '_')}`;
    return `
DROP TRIGGER IF EXISTS "${trgName}" ON "${schema}"."${tableName}";
DROP FUNCTION IF EXISTS "${schema}"."${fnName}"();
`.trim();
}

// ── Event Bus ──────────────────────────────────────────────────────────────

export const KyntoEvents = {

    // ── Intern ───────────────────────────────────────────────────────────
    _listenActive: false,
    _listenUnsubscribe: null,

    // ── Öffentliche API ───────────────────────────────────────────────────

    /**
     * Feuert ein Änderungs-Signal für eine Tabelle.
     * Wird von Mutations und dem LISTEN-Empfänger aufgerufen.
     *
     * @param {string} tableId     – Tabellenname
     * @param {string} [operation] – 'INSERT' | 'UPDATE' | 'DELETE' | 'UNKNOWN'
     * @param {string} [schema]    – Schema-Name
     */
    notify(tableId, operation = 'UNKNOWN', schema = 'public') {
        const event = new CustomEvent(DOM_EVENT, {
            detail: {
                tableId,
                schema,
                operation,
                timestamp: Date.now(),
                source: this._listenActive ? 'pg_notify' : 'manual',
            }
        });
        window.dispatchEvent(event);
    },

    /**
     * Abonniert Tabellenänderungen.
     * Gibt eine Unsubscribe-Funktion zurück.
     *
     * @param {function} callback – wird mit (event) aufgerufen
     * @param {string}   [filterTable] – nur Events für diese Tabelle
     * @returns {function} unsubscribe
     */
    subscribe(callback, filterTable = null) {
        const handler = (event) => {
            if (!filterTable || event.detail.tableId === filterTable) {
                callback(event);
            }
        };
        window.addEventListener(DOM_EVENT, handler);
        return () => window.removeEventListener(DOM_EVENT, handler);
    },

    /**
     * Startet PostgreSQL LISTEN via IPC (window.api.pgListen).
     * Funktioniert nur wenn der Main-Prozess `pgListen` implementiert.
     * Fällt schweigend zurück wenn nicht verfügbar.
     *
     * @param {string} connectionString
     */
    async startListen(connectionString) {
        if (this._listenActive) return;
        if (!window.api?.pgListen) {
            console.debug('[KyntoEvents] pgListen nicht verfügbar – nur Polling.');
            return;
        }

        try {
            this._listenUnsubscribe = await window.api.pgListen(
                connectionString,
                PG_CHANNEL,
                (payload) => {
                    // Payload ist der JSON-String aus dem Trigger
                    try {
                        const data = typeof payload === 'string' ? JSON.parse(payload) : payload;
                        this.notify(data.table ?? 'unknown', data.operation ?? 'UNKNOWN', data.schema ?? 'public');
                    } catch {
                        this.notify('unknown', 'UNKNOWN', 'public');
                    }
                }
            );
            this._listenActive = true;
            console.info(`[KyntoEvents] PostgreSQL LISTEN aktiv auf Kanal "${PG_CHANNEL}"`);
        } catch (err) {
            console.warn('[KyntoEvents] LISTEN fehlgeschlagen:', err.message);
        }
    },

    /**
     * Stoppt den LISTEN-Listener.
     */
    async stopListen() {
        if (!this._listenActive) return;
        try {
            if (typeof this._listenUnsubscribe === 'function') {
                await this._listenUnsubscribe();
            } else if (window.api?.pgUnlisten) {
                await window.api.pgUnlisten(PG_CHANNEL);
            }
        } catch (err) {
            console.warn('[KyntoEvents] stopListen Fehler:', err.message);
        }
        this._listenActive = false;
        this._listenUnsubscribe = null;
        console.info('[KyntoEvents] LISTEN gestoppt.');
    },

    /** Gibt zurück ob LISTEN aktiv ist */
    isListening() { return this._listenActive; },
};

// Globaler Zugriff
window.KyntoEvents = KyntoEvents;
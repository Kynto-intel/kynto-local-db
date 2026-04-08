/**
 * SQL zum Einrichten des PostgreSQL NOTIFY-Triggers auf einer Tabelle.
 * Sendet bei INSERT, UPDATE, DELETE eine Notification mit Tabellenname + Operation.
 */
export function buildNotifyTriggerSql(schema: any, tableName: any): string;
/**
 * SQL zum Entfernen des Triggers von einer Tabelle.
 */
export function buildDropTriggerSql(schema: any, tableName: any): string;
export namespace KyntoEvents {
    let _listenActive: boolean;
    let _listenUnsubscribe: any;
    /**
     * Feuert ein Änderungs-Signal für eine Tabelle.
     * Wird von Mutations und dem LISTEN-Empfänger aufgerufen.
     *
     * @param {string} tableId     – Tabellenname
     * @param {string} [operation] – 'INSERT' | 'UPDATE' | 'DELETE' | 'UNKNOWN'
     * @param {string} [schema]    – Schema-Name
     */
    function notify(tableId: string, operation?: string, schema?: string): void;
    /**
     * Abonniert Tabellenänderungen.
     * Gibt eine Unsubscribe-Funktion zurück.
     *
     * @param {function} callback – wird mit (event) aufgerufen
     * @param {string}   [filterTable] – nur Events für diese Tabelle
     * @returns {function} unsubscribe
     */
    function subscribe(callback: Function, filterTable?: string): Function;
    /**
     * Startet PostgreSQL LISTEN via IPC (window.api.pgListen).
     * Funktioniert nur wenn der Main-Prozess `pgListen` implementiert.
     * Fällt schweigend zurück wenn nicht verfügbar.
     *
     * @param {string} connectionString
     */
    function startListen(connectionString: string): Promise<void>;
    /**
     * Stoppt den LISTEN-Listener.
     */
    function stopListen(): Promise<void>;
    /** Gibt zurück ob LISTEN aktiv ist */
    function isListening(): boolean;
}

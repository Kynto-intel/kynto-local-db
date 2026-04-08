export namespace KyntoRealtime {
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
    function start({ table, schema, interval, installTrigger, onReload }?: {
        table: string;
        schema?: string;
        interval?: number;
        installTrigger?: boolean;
        onReload?: Function;
    }): Promise<void>;
    /**
     * Stoppt alle Realtime-Aktivitäten für die aktuelle Tabelle.
     */
    function stop(): void;
    /**
     * Installiert den NOTIFY-Trigger manuell auf der aktuellen Tabelle.
     * Nützlich wenn der Nutzer Realtime dauerhaft aktivieren will.
     */
    function installTrigger(schema: any, table: any): Promise<void>;
    /**
     * Entfernt den NOTIFY-Trigger von der aktuellen Tabelle.
     */
    function removeTrigger(schema: any, table: any): Promise<void>;
    /** Gibt zurück ob Realtime gerade aktiv ist */
    function isRunning(): boolean;
    /** Gibt zurück ob LISTEN/NOTIFY verfügbar ist */
    function isListening(): boolean;
    /** Gibt die aktuelle Tabelle zurück */
    function currentTable(): any;
}

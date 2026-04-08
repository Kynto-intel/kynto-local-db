export namespace KyntoGrid {
    /**
     * Bindet Realtime-Beobachtung an eine Tabelle.
     * Wird von openTableInEditor in views.js aufgerufen.
     *
     * @param {{ name: string, schema: string, entity_type: string }} entity
     * @param {boolean} [forceStart] – Startet auch wenn btn-realtime aus ist
     */
    function attach(entity: {
        name: string;
        schema: string;
        entity_type: string;
    }, forceStart?: boolean): Promise<void>;
    /**
     * Trennt den Realtime-Listener.
     * Wird aufgerufen wenn Tabelle gewechselt oder Dashboard geöffnet wird.
     */
    function detach(): void;
    /**
     * Schaltet Realtime für die aktuelle Tabelle ein/aus.
     * Wird von btn-realtime in action-bar.js aufgerufen.
     */
    function toggle(): Promise<void>;
    /**
     * Ändert das Polling-Intervall zur Laufzeit.
     * @param {number} ms
     */
    function setInterval(ms: number): void;
    /**
     * Installiert den PostgreSQL NOTIFY-Trigger auf der aktuellen Tabelle.
     * Ermöglicht echtes Push-Realtime statt Polling.
     */
    function installTrigger(): Promise<void>;
    /**
     * Entfernt den NOTIFY-Trigger von der aktuellen Tabelle.
     */
    function removeTrigger(): Promise<void>;
    /** Manuell eine Änderung signalisieren (z.B. nach eigenem INSERT/UPDATE) */
    function notifyChange(table: any, operation?: string): void;
    /** Gibt aktuellen Status zurück */
    function status(): {
        running: boolean;
        listening: boolean;
        table: any;
        interval: number;
        mode: string;
    };
}

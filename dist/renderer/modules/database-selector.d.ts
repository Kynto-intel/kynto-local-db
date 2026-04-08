export function initDatabaseSelector(): Promise<void>;
export namespace databaseSelector {
    let initialized: boolean;
    let statusEl: any;
    let modalEl: any;
    let currentDb: any;
    /**
     * Initialisiert den Database-Selector
     */
    function initialize(): Promise<void>;
    /**
     * Ruft den aktuellen Status der Datenbank ab
     */
    function updateStatus(): Promise<void>;
    /**
     * Rendert den Status-Anzeiger
     */
    function renderStatus(): void;
    /**
     * Öffnet das Modal zur PostgreSQL-Konfiguration
     */
    function openModal(): void;
    /**
     * Erstellt das Modal-HTML
     */
    function createModal(): void;
    /**
     * Rendert den Modal-Inhalt
     */
    function renderModal(): void;
    /**
     * Testet die PostgreSQL-Verbindung
     */
    function testPostgreSQL(): Promise<void>;
    /**
     * Wechselt zu PGlite
     */
    function switchToPGlite(): Promise<void>;
    /**
     * Wechselt zu PostgreSQL
     */
    function switchToPostgreSQL(): Promise<void>;
    /**
     * Schließt das Modal
     */
    function closeModal(): void;
    /**
     * Injiziert CSS-Styles
     */
    function injectCSS(): void;
}

export = InstantAPIPanel;
declare class InstantAPIPanel {
    panel: HTMLElement;
    closeBtn: HTMLElement;
    statusBtn: HTMLElement;
    statusIndicator: HTMLElement;
    statusLabel: HTMLElement;
    statusDetail: HTMLElement;
    infoGrid: HTMLElement;
    startBtn: HTMLElement;
    stopBtn: HTMLElement;
    openBrowserBtn: HTMLElement;
    portInput: HTMLElement;
    autostartCheck: HTMLElement;
    endpointsList: HTMLElement;
    endpointCount: HTMLElement;
    docsBtn: HTMLElement;
    schemaBtn: HTMLElement;
    infoBtn: HTMLElement;
    apiRunning: boolean;
    apiUrl: string;
    apiPort: number;
    connectionString: any;
    /**
     * Injeziert die HTML-Struktur des Panels direkt in den Body
     */
    _injectHTML(): void;
    /**
     * Injeziert das einheitliche Panel-Design (CSS)
     */
    _injectStyles(): void;
    /**
     * Hole den aktiven Connection String vom Main Process
     */
    getActiveConnectionString(): Promise<void>;
    /**
     * Initialisiere Event-Listener
     */
    initEventListeners(): void;
    /**
     * Lade gespeicherte Einstellungen aus localStorage
     */
    loadSettings(): void;
    /**
     * Speichere Einstellungen
     */
    saveSettings(): void;
    /**
     * Prüfe API-Status (mit Timeout)
     */
    checkAPIStatus(): Promise<void>;
    /**
     * Starte API
     */
    startAPI(): Promise<void>;
    /**
     * Stoppe API
     */
    stopAPI(): Promise<void>;
    /**
     * Warte bis API verfügbar ist
     */
    waitForAPI(timeout?: number): Promise<any>;
    /**
     * Lade verfügbare Endpoints
     */
    loadEndpoints(): Promise<void>;
    /**
     * Zeige Endpoints MIT echten Daten (Counts, Spalten, etc)
     */
    displayEndpointsWithData(tablesInfo: any): void;
    /**
     * Teste einen API-Endpoint
     */
    testEndpoint(url: any, method: any): Promise<void>;
    /**
     * Zeige Endpoints an
     */
    displayEndpoints(endpoints: any): void;
    /**
     * Leere Endpoints-Liste
     */
    clearEndpoints(): void;
    /**
     * Aktualisiere Status-Anzeige
     */
    updateStatus(status: any, label: any, detail: any): void;
    /**
     * Setze API-Running Status
     */
    setAPIRunning(running: any): void;
    /**
     * Aktualisiere Port
     */
    updatePort(): void;
    /**
     * Schalte Autostart um
     */
    toggleAutostart(): void;
    /**
     * Öffne API im Browser
     */
    openInBrowser(): void;
    /**
     * Öffne API Dokumentation
     */
    openDocumentation(type?: string): void;
    /**
     * Öffne Swagger/OpenAPI Dokumentation
     */
    /**
     * Öffne/Schließe Panel
     */
    openPanel(): void;
    closePanel(): void;
    refreshState(): void;
    togglePanel(): void;
    /**
     * Starten Sie Status-Poller (aktualisiere alle 5 Sekunden)
     */
    startStatusPoller(): void;
    /**
     * Exportiere API-Status für Debugging
     */
    getStatus(): {
        running: boolean;
        url: string;
        port: number;
        autostart: any;
    };
}

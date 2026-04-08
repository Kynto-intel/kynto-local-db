export class GridHeaderActions {
    /**
     * @param {object} opts
     * @param {object}      opts.entity       – Entity-Objekt
     * @param {string}      opts.dbId         – aktive DB-ID
     * @param {HTMLElement} opts.container    – Ziel-Element
     * @param {boolean}     [opts.editable]   – ob Bearbeitungen erlaubt sind
     * @param {object[]}    [opts.lints]      – Lint-Ergebnisse
     * @param {function}    [opts.onAddRow]   – Callback: neue Zeile
     * @param {function}    [opts.onAddCol]   – Callback: neue Spalte
     * @param {function}    [opts.onRefresh]  – Callback: Tabelle neu laden
     * @param {function}    [opts.onInsertSql]– Callback: INSERT SQL öffnen
     */
    constructor(opts: {
        entity: object;
        dbId: string;
        container: HTMLElement;
        editable?: boolean;
        lints?: object[];
        onAddRow?: Function;
        onAddCol?: Function;
        onRefresh?: Function;
        onInsertSql?: Function;
    });
    entity: any;
    dbId: string;
    container: HTMLElement;
    editable: boolean;
    lints: any[];
    onAddRow: Function;
    onAddCol: Function;
    onRefresh: Function;
    onInsertSql: Function;
    _openPopover: any;
    /** Rendert die Header-Aktionsleiste in den Container. */
    render(): void;
    _makeBtn(label: any, extraClass: any, onClick: any): HTMLButtonElement;
    _togglePopover(anchor: any, popoverEl: any): void;
    _closePopover(): void;
    _buildViewSecPopover(entity: any, dbId: any, lint: any): HTMLDivElement;
    _buildMvPopover(): HTMLDivElement;
    _buildForeignTablePopover(): HTMLDivElement;
    _handleToggleRls(entity: any, currentlyEnabled: any, dbId: any): Promise<void>;
}

export namespace ColumnEditorSidebar {
    let isOpen: boolean;
    let currentTable: any;
    let currentSchema: any;
    /**
     * Initialisiert die Sidebar (einmalig) und fügt sie dem DOM hinzu.
     */
    function _init(): void;
    /**
     * Öffnet die Seitenleiste für eine bestimmte Tabelle.
     */
    function open(table: any, schema: any): void;
    function close(): void;
    function save(): Promise<void>;
}

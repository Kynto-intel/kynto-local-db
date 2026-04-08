export namespace StorageCellRenderer {
    let _storage: any;
    /**
     * Einmalig aufrufen mit der KyntoStorage-Instanz.
     * @param {import('../../../src/components/Storage/KyntoStorage.js').KyntoStorageManager} storageInstance
     */
    function init(storageInstance: import("../../../src/components/Storage/KyntoStorage.js").KyntoStorageManager): void;
    /**
     * Rendert einen Zellwert – erkennt Storage-Refs und gibt Vorschau-HTML zurück.
     * Fällt auf DataFormatter zurück wenn kein Storage-Ref erkannt.
     *
     * @param {*}      val      - Zellwert aus PGlite
     * @param {string} colType  - Spalten-Typ ('text', 'varchar', ...)
     * @returns {Promise<string>} HTML-String
     */
    function render(val: any, colType: string): Promise<string>;
    function _renderKnownRef(ref: any, originalUrl: any): string;
    function _renderImageUrl(url: any): string;
    /**
     * Lazy-lädt Bilder in Storage-Cells.
     * Muss aufgerufen werden nachdem die Tabelle gerendert wurde.
     * @param {HTMLElement} container - Das table-view Element
     */
    function hydrateImages(container: HTMLElement): Promise<void>;
}
export const STORAGE_CELL_CSS: "\n.storage-cell {\n    display: inline-flex;\n    align-items: center;\n    gap: 5px;\n    max-width: 150px;\n    cursor: default;\n}\n.storage-cell__icon { font-size: 14px; flex-shrink: 0; }\n.storage-cell__name {\n    font-size: 11px;\n    opacity: .7;\n    overflow: hidden;\n    text-overflow: ellipsis;\n    white-space: nowrap;\n}\n.storage-cell--image .storage-cell__thumb-placeholder {\n    font-size: 16px;\n    opacity: .4;\n}\n";

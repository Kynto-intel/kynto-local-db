/**
 * Generiert SQL-Befehl zum TRUNCATE einer Tabelle
 * @param {Object} params - Parameter
 * @param {Object} params.table - Tabellenmetadaten
 * @returns {string} SQL-Befehl
 */
export function getTableRowTruncateSql({ table }: {
    table: any;
}): string;
/**
 * Truncated eine Tabelle
 * ACHTUNG: Diese Operation löscht ALLE Datensätze und kann nicht rückgängig gemacht werden!
 * @param {Object} params - Parameter
 * @param {Object} params.table - Tabellenmetadaten
 * @returns {Promise<Object>} Ergebnis
 */
export function truncateTableRow({ table }: {
    table: any;
}): Promise<any>;
export namespace TableRowTruncateMutation {
    function mutate(vars: any, { onSuccess, onError }?: {}): Promise<any>;
}

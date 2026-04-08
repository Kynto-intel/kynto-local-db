/**
 * Generiert SQL-Befehl zum Einfügen einer Zeile
 * @param {Object} params - Parameter
 * @param {Object} params.table - Tabellenmetadaten
 * @param {Object} params.payload - Zeilendaten
 * @param {Array} params.enumArrayColumns - Liste von Enum-Array-Spalten
 * @param {boolean} params.returning - Ob Werte zurückgegeben werden sollen
 * @returns {string} SQL-Befehl
 */
export function getTableRowCreateSql({ table, payload, enumArrayColumns, returning, }: {
    table: any;
    payload: any;
    enumArrayColumns: any[];
    returning: boolean;
}): string;
/**
 * Führt einen INSERT durch
 * @param {Object} params - Parameter
 * @param {Object} params.table - Tabellenmetadaten
 * @param {Object} params.payload - Zeilendaten
 * @param {Array} params.enumArrayColumns - Enum-Array-Spalten
 * @param {boolean} params.returning - Werte zurückgeben
 * @returns {Promise<Object>} Ergebnis
 */
export function createTableRow({ table, payload, enumArrayColumns, returning, roleImpersonationState, }: {
    table: any;
    payload: any;
    enumArrayColumns: any[];
    returning: boolean;
}): Promise<any>;
export namespace tableRowCreateMutation {
    function mutate(vars: any, { onSuccess, onError }?: {}): Promise<any>;
}

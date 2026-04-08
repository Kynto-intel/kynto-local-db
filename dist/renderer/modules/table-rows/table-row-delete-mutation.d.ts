/**
 * Generiert SQL-Befehl zum Löschen von Zeilen
 * @param {Object} params - Parameter
 * @param {Object} params.table - Tabellenmetadaten
 * @param {Array} params.rows - Zu löschende Zeilen
 * @returns {string} SQL-Befehl
 */
export function getTableRowDeleteSql({ table, rows }: {
    table: any;
    rows: any[];
}): string;
/**
 * Löscht eine oder mehrere Tabellenzeilen
 * @param {Object} params - Parameter
 * @param {Object} params.table - Tabellenmetadaten (muss Entity-Objekt sein)
 * @param {Array} params.rows - Zu löschende Zeilen
 * @returns {Promise<Object>} Ergebnis
 */
export function deleteTableRows({ table, rows, roleImpersonationState, }: {
    table: any;
    rows: any[];
}): Promise<any>;
export namespace tableRowDeleteMutation {
    function mutate(vars: any, { onSuccess, onError }?: {}): Promise<any>;
}

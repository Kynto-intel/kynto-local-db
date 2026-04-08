/**
 * Erstellt das SQL-Statement zum Abrufen eines Zellwerts.
 * @param {Object} params - Parameter (table, column, pkMatch)
 * @returns {string} Das fertige SQL-Statement.
 */
export function getCellValueSql({ table, column, pkMatch }: any): string;
/**
 * Führt die Abfrage aus, um einen spezifischen Zellwert zu erhalten.
 * Nutzt die im Projekt vorhandene IPC-API (window.api).
 */
export function getCellValue({ table, column, pkMatch }: {
    table: any;
    column: any;
    pkMatch: any;
}): Promise<any>;
export namespace getCellValueMutation {
    function mutate(vars: any, { onSuccess, onError }?: {}): Promise<any>;
}

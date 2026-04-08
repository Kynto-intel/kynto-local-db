/**
 * Generiert SQL-Befehl zum Aktualisieren von Zeilen
 * @param {Object} params - Parameter
 * @param {Object} params.table - Tabellenmetadaten
 * @param {Object} params.configuration - UPDATE-Konfiguration mit Identifiern
 * @param {Object} params.payload - Zu aktualisierende Daten
 * @param {Array} params.enumArrayColumns - Enum-Array-Spalten
 * @param {boolean} params.returning - Werte zurückgeben
 * @returns {string} SQL-Befehl
 */
export function getTableRowUpdateSql({ table, configuration, payload, enumArrayColumns, returning, }: {
    table: any;
    configuration: any;
    payload: any;
    enumArrayColumns: any[];
    returning: boolean;
}): string;
/**
 * Formatiert einen Wert für SQL-Verwendung
 * @param {*} value - Wert
 * @param {boolean} isEnumArray - Ob es sich um Enum-Array handelt
 * @returns {string} Formatierter SQL-Wert
 */
export function formatSqlValue(value: any, isEnumArray?: boolean): string;
/**
 * Führt ein UPDATE aus
 * @param {Object} params - Parameter
 * @param {Object} params.table - Tabellenmetadaten
 * @param {Object} params.configuration - UPDATE-Konfiguration
 * @param {Object} params.payload - Zu aktualisierende Daten
 * @param {Array} params.enumArrayColumns - Enum-Array-Spalten
 * @param {boolean} params.returning - Werte zurückgeben
 * @returns {Promise<Object>} Ergebnis
 */
export function updateTableRow({ table, configuration, payload, enumArrayColumns, returning, roleImpersonationState, }: {
    table: any;
    configuration: any;
    payload: any;
    enumArrayColumns: any[];
    returning: boolean;
}): Promise<any>;
export namespace tableRowUpdateMutation {
    function mutate(vars: any, { onSuccess, onError }?: {}): Promise<any>;
}

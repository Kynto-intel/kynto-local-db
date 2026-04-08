/**
 * Zeigt einen Modal Dialog zur Eingabe von Spalten-Name und Typ
 * (prompt() funktioniert nicht in Electron)
 *
 * @param {string} tableName - Name der Tabelle
 * @param {string} schema - Schema der Tabelle
 * @param {Function} onSubmit - Callback(colName, colType) bei OK
 */
export function showAddColumnDialog(tableName: string, schema: string, onSubmit: Function): void;

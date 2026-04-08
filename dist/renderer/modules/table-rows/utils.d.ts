/**
 * Formatiert Filterwerte basierend auf dem Spaltentyp
 * Konvertiert numerische Werte zu Zahlen
 * @param {Object} table - Tabellenkonfiguration mit Spalten
 * @param {Object} filter - Filterobjekt mit column, operator, value
 * @returns {*} Formatierter Filterwert
 */
export function formatFilterValue(table: any, filter: any): any;
/**
 * Prüft, ob eine Spalte numerisch ist
 * @param {string} format - Spaltenformat
 * @returns {boolean}
 */
export function isNumericalColumn(format: string): boolean;
/**
 * Extrahiert Primärschlüssel aus einer Tabelle
 * @param {Object} table - Tabellenentität
 * @returns {Object} { primaryKeys: string[], error?: Object }
 */
export function getPrimaryKeys({ table }: any): any;
/**
 * Prüft, ob ein Entity eine Tabelle ist
 * @param {Object} entity - Entity-Objekt
 * @returns {boolean}
 */
export function isTableLike(entity: any): boolean;
/**
 * Konvertiert Tabellenmetadaten in lesbares Format
 * @param {Object} entity - Tabellenentität
 * @returns {Object} Konvertierte Tabelle
 */
export function parseSupaTable(entity: any): any;
/**
 * Validiert Zeilendaten gegen Tabellenspezifikation
 * @param {Object} row - Zeilendaten
 * @param {Object} table - Tabellenspezifikation
 * @returns {Object} { isValid: boolean, errors?: string[] }
 */
export function validateRowData(row: any, table: any): any;
/**
 * Konvertiert Filter in SQL WHERE-Klausel Format
 * @param {Array} filters - Array von Filtern
 * @returns {string} SQL-Fragment
 */
export function buildWhereClause(filters: any[]): string;
/**
 * Escapt Werte für SQL-Verwendung
 * @param {*} value - Wert zum Escapen
 * @returns {string} Gescapeter Wert
 */
export function escapeValue(value: any): string;

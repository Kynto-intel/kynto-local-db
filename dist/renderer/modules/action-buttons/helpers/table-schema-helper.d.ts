/**
 * Gibt den korrekten Schema-Namen mit Remote-Prefix zurück
 * @param {string} schema - Original Schema-Name (z.B. "public")
 * @returns {string} Schema mit Prefix wenn Remote (z.B. "postgres_server.public")
 */
export function getCorrectSchema(schema?: string): string;
/**
 * Gibt den korrekten Tabellen-Namen mit Schema zurück
 * @param {string} tableName - Tabellenname
 * @param {string} schema - Schema-Name
 * @returns {Object} { name, schema } mit korrektem Prefix
 */
export function getCorrectTable(tableName: string, schema?: string): any;
/**
 * Helper für Debug-Logging von Schema-Informationen
 */
export function logTableInfo(): void;

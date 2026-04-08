/* ── action-buttons/helpers/table-schema-helper.js ───────────────────
   Helper für korrekté Schema-Namen bei Remote-Tabellen
   ──────────────────────────────────────────────────────────────────── */

import { state } from '../../state.js';

/**
 * Gibt den korrekten Schema-Namen mit Remote-Prefix zurück
 * @param {string} schema - Original Schema-Name (z.B. "public")
 * @returns {string} Schema mit Prefix wenn Remote (z.B. "postgres_server.public")
 */
export function getCorrectSchema(schema = state.currentSchema) {
    // Wenn Remote DB Mode → mit postgres_server Prefix
    if (state.dbMode === 'remote' || state.remoteConnectionString) {
        // Wenn der Prefix noch nicht da ist, hinzufügen
        if (!schema?.startsWith('postgres_server.')) {
            return `postgres_server.${schema || 'public'}`;
        }
        return schema;
    }
    
    // DuckDB oder PGlite → Schema direkt nutzen
    return schema || 'public';
}

/**
 * Gibt den korrekten Tabellen-Namen mit Schema zurück
 * @param {string} tableName - Tabellenname
 * @param {string} schema - Schema-Name
 * @returns {Object} { name, schema } mit korrektem Prefix
 */
export function getCorrectTable(tableName, schema = state.currentSchema) {
    return {
        name: tableName,
        schema: getCorrectSchema(schema)
    };
}

/**
 * Helper für Debug-Logging von Schema-Informationen
 */
export function logTableInfo() {
    console.log(`
🗄️  Database Mode: ${state.dbMode || 'default'}
📊 Current Table: ${state.currentTable}
📁 Current Schema: ${state.currentSchema}
✅ Korrektes Schema: ${getCorrectSchema()}
    `);
}

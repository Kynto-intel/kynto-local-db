/**
 * ────────────────────────────────────────────────────────────────
 * Aktualisiert Tabellenzeilen basierend auf Primärschlüsseln
 * Unterstützt Enum-Array-Spalten und Role-Impersonation
 * ────────────────────────────────────────────────────────────────
 */
import { state } from '../state.js';
import { esc, setStatus } from '../utils.js';
import { tableRowKeys } from './keys.js';

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
export function getTableRowUpdateSql({
  table,
  configuration,
  payload,
  enumArrayColumns = [],
  returning = false,
}) {
  if (!table?.name) {
    throw new Error('Table name is required');
  }

  if (!configuration?.identifiers || Object.keys(configuration.identifiers).length === 0) {
    throw new Error('Identifiers are required for update');
  }

  const schemaPrefix = table.schema ? `${esc(table.schema)}.` : '';
  const tableName = esc(table.name);

  // SET-Klausel erstellen
  const setClauses = Object.entries(payload)
    .map(([col, value]) => {
      const isEnumArray = enumArrayColumns.includes(col);
      return `${esc(col)} = ${formatSqlValue(value, isEnumArray)}`;
    })
    .join(', ');

  // WHERE-Klausel erstellen
  const whereClauses = Object.entries(configuration.identifiers)
    .map(([col, value]) => {
      if (value === null) {
        return `${esc(col)} IS NULL`;
      }
      return `${esc(col)} = ${formatSqlValue(value, false)}`;
    })
    .join(' AND ');

  let sql = `UPDATE ${schemaPrefix}${tableName} SET ${setClauses} WHERE ${whereClauses}`;

  if (returning) {
    sql += ' RETURNING *';
  }

  return sql;
}

/**
 * Formatiert einen Wert für SQL-Verwendung
 * @param {*} value - Wert
 * @param {boolean} isEnumArray - Ob es sich um Enum-Array handelt
 * @returns {string} Formatierter SQL-Wert
 */
export function formatSqlValue(value, isEnumArray = false) {
  if (value === null || value === undefined) {
    return 'NULL';
  }

  if (typeof value === 'boolean') {
    return value ? 'TRUE' : 'FALSE';
  }

  if (typeof value === 'number') {
    return isFinite(value) ? value.toString().replace(',', '.') : 'NULL';
  }

  if (Array.isArray(value)) {
    if (isEnumArray) {
      const items = value.map((v) => `'${String(v).replace(/'/g, "''")}'`).join(',');
      return `ARRAY[${items}]::text[]`;
    }
    const items = value.map((v) => formatSqlValue(v, false)).join(',');
    return `ARRAY[${items}]`;
  }

  if (typeof value === 'object') {
    return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
  }

  return `'${String(value).replace(/'/g, "''")}'`;
}

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
export async function updateTableRow({ 
  table, 
  configuration, 
  payload, 
  enumArrayColumns = [],
  returning = false,
  roleImpersonationState,
}) {
  const sql = getTableRowUpdateSql({
    table,
    configuration,
    payload,
    enumArrayColumns,
    returning,
  });

  const mode = state.dbMode || 'pglite';
  
  // Map dbMode zu dbType für database-engine
  const dbType = mode === 'pglite' ? 'local' : 
                 mode === 'remote' ? 'remote' : 
                 'local';

  try {
    let result;
    // Nutze neue database-engine für beide DB-Typen
    result = await window.api.dbQuery(sql, null, dbType);
    return result;
  } catch (error) {
    console.error('Failed to update table row:', error?.message || error);
    throw error;
  }
}

export const tableRowUpdateMutation = {
  mutate: async (vars, { onSuccess, onError } = {}) => {
    try {
      const data = await updateTableRow(vars);
      if (onSuccess) onSuccess(data);
      return data;
    } catch (err) {
      console.error('Update Fehler:', err);
      setStatus(`Fehler beim Aktualisieren: ${err.message}`, 'error');
      if (onError) onError(err);
      throw err;
    }
  }
};
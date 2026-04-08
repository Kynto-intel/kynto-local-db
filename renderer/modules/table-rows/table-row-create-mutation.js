/**
 * ────────────────────────────────────────────────────────────────
 * Erstellt neue Tabellenzeilen mit optionalen Rückgabewerten
 * Unterstützt Enum-Array-Spalten und Role-Impersonation
 * ────────────────────────────────────────────────────────────────
 */
import { state } from '../state.js';
import { esc, setStatus } from '../utils.js';
import { tableRowKeys } from './keys.js';

/**
 * Generiert SQL-Befehl zum Einfügen einer Zeile
 * @param {Object} params - Parameter
 * @param {Object} params.table - Tabellenmetadaten
 * @param {Object} params.payload - Zeilendaten
 * @param {Array} params.enumArrayColumns - Liste von Enum-Array-Spalten
 * @param {boolean} params.returning - Ob Werte zurückgegeben werden sollen
 * @returns {string} SQL-Befehl
 */
export function getTableRowCreateSql({
  table,
  payload,
  enumArrayColumns = [],
  returning = false,
}) {
  if (!table?.name) {
    throw new Error('Table name is required');
  }

  // Falls das Payload leer ist, nutzen wir den SQL-Standard für Standardwerte
  if (!payload || Object.keys(payload).length === 0) {
    const schemaPrefix = table.schema ? `${esc(table.schema)}.` : '';
    return `INSERT INTO ${schemaPrefix}${esc(table.name)} DEFAULT VALUES`;
  }

  const schemaPrefix = table.schema ? `${esc(table.schema)}.` : '';
  const columns = Object.keys(payload).map(k => esc(k)).join(', ');
  const values = Object.values(payload)
    .map((val, idx) => {
      const isEnumArray = enumArrayColumns.includes(Object.keys(payload)[idx]);
      return formatSqlValue(val, isEnumArray);
    })
    .join(', ');

  let sql = `INSERT INTO ${schemaPrefix}${esc(table.name)} (${columns}) VALUES (${values})`;

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
function formatSqlValue(value, isEnumArray = false) {
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
 * Führt einen INSERT durch
 * @param {Object} params - Parameter
 * @param {Object} params.table - Tabellenmetadaten
 * @param {Object} params.payload - Zeilendaten
 * @param {Array} params.enumArrayColumns - Enum-Array-Spalten
 * @param {boolean} params.returning - Werte zurückgeben
 * @returns {Promise<Object>} Ergebnis
 */
export async function createTableRow({ 
  table, 
  payload, 
  enumArrayColumns = [],
  returning = false,
  roleImpersonationState,
}) {
  const sql = getTableRowCreateSql({ 
    table, 
    payload, 
    enumArrayColumns, 
    returning 
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
    console.error('Failed to create table row:', error?.message || error);
    throw error;
  }
}

export const tableRowCreateMutation = {
  mutate: async (vars, { onSuccess, onError } = {}) => {
    try {
      const data = await createTableRow(vars);
      if (onSuccess) onSuccess(data);
      return data;
    } catch (err) {
      console.error('Create Fehler:', err);
      setStatus(`Fehler beim Erstellen: ${err.message}`, 'error');
      if (onError) onError(err);
      throw err;
    }
  }
};
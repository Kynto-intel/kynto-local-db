/**
 * ────────────────────────────────────────────────────────────────
 * Löscht Tabellenzeilen basierend auf Primärschlüsseln
 * Mit intelligenter Fehlerbehandlung für FK-Constraints
 * ────────────────────────────────────────────────────────────────
 */
import { state } from '../state.js';
import { esc, setStatus } from '../utils.js';
import { tableRowKeys } from './keys.js';
import { getPrimaryKeys } from './utils.js';

/**
 * Generiert SQL-Befehl zum Löschen von Zeilen
 * @param {Object} params - Parameter
 * @param {Object} params.table - Tabellenmetadaten
 * @param {Array} params.rows - Zu löschende Zeilen
 * @returns {string} SQL-Befehl
 */
export function getTableRowDeleteSql({ table, rows }) {
  if (!table?.name) {
    throw new Error('Table name is required');
  }

  if (!rows || rows.length === 0) {
    throw new Error('At least one row is required to delete');
  }

  const { primaryKeys, error } = getPrimaryKeys({ table });

  if (error) {
    throw error;
  }

  const schemaPrefix = table.schema ? `${esc(table.schema)}.` : '';
  const tableName = esc(table.name);

  if (rows.length === 1) {
    // Single row delete mit WHERE-Klausel
    const whereClauses = primaryKeys
      .map((key) => {
        const value = rows[0][key];
        if (value === null) {
          return `${esc(key)} IS NULL`;
        }
        return `${esc(key)} = ${formatSqlValue(value)}`;
      })
      .join(' AND ');

    return `DELETE FROM ${schemaPrefix}${tableName} WHERE ${whereClauses}`;
  }

  // Multi-row delete mit OR-Klauseln
  const conditions = rows
    .map((row) => {
      const rowConditions = primaryKeys
        .map((key) => {
          const value = row[key];
          if (value === null) {
            return `${esc(key)} IS NULL`;
          }
          return `${esc(key)} = ${formatSqlValue(value)}`;
        })
        .join(' AND ');

      return `(${rowConditions})`;
    })
    .join(' OR ');

  return `DELETE FROM ${schemaPrefix}${tableName} WHERE ${conditions}`;
}

/**
 * Formatiert einen Wert für SQL
 * @param {*} value - Wert
 * @returns {string} SQL-formatierter Wert
 */
function formatSqlValue(value) {
  if (value === null || value === undefined) {
    return 'NULL';
  }

  if (typeof value === 'boolean') {
    return value ? 'TRUE' : 'FALSE';
  }

  if (typeof value === 'number') {
    return isFinite(value) ? value.toString().replace(',', '.') : 'NULL';
  }

  if (typeof value === 'string') {
    return `'${value.replace(/'/g, "''")}'`;
  }

  if (typeof value === 'object') {
    return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
  }

  return `'${String(value).replace(/'/g, "''")}'`;
}

/**
 * Löscht eine oder mehrere Tabellenzeilen
 * @param {Object} params - Parameter
 * @param {Object} params.table - Tabellenmetadaten (muss Entity-Objekt sein)
 * @param {Array} params.rows - Zu löschende Zeilen
 * @returns {Promise<Object>} Ergebnis
 */
export async function deleteTableRows({
  table,
  rows,
  roleImpersonationState,
}) {
  const sql = getTableRowDeleteSql({ table, rows });
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
    console.error('Failed to delete table row:', error?.message || error);
    throw error;
  }
}

export const tableRowDeleteMutation = {
    mutate: async (vars, { onSuccess, onError } = {}) => {
        try {
            const data = await deleteTableRows(vars);
            if (onSuccess) onSuccess(data);
            return data;
        } catch (err) {
            console.error('Delete Fehler:', err);
            setStatus(`Fehler beim Löschen: ${err.message}`, 'error');
            if (onError) onError(err);
            throw err;
        }
    }
};
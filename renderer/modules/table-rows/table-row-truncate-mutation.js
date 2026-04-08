/**
 * Truncated eine Tabelle (löscht alle Datensätze und setzt Sequenzen zurück)
 * Diese Operation ist nicht rückgängig zu machen!
 */

import { state } from '../state.js';
import { esc, setStatus } from '../utils.js';

/**
 * Generiert SQL-Befehl zum TRUNCATE einer Tabelle
 * @param {Object} params - Parameter
 * @param {Object} params.table - Tabellenmetadaten
 * @returns {string} SQL-Befehl
 */
export function getTableRowTruncateSql({ table }) {
  if (!table || !table.name) {
    throw new Error('Table name is required');
  }

  const schemaPrefix = table.schema ? `${esc(table.schema)}.` : '';
  
  // TRUNCATE mit CASCADE für Fremdschlüssel-Abhängigkeiten
  return `TRUNCATE TABLE ${schemaPrefix}${esc(table.name)} CASCADE`;
}

/**
 * Truncated eine Tabelle
 * ACHTUNG: Diese Operation löscht ALLE Datensätze und kann nicht rückgängig gemacht werden!
 * @param {Object} params - Parameter
 * @param {Object} params.table - Tabellenmetadaten
 * @returns {Promise<Object>} Ergebnis
 */
export async function truncateTableRow({ table }) {
  const sql = getTableRowTruncateSql({ table });
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
    console.error('Failed to truncate table:', error?.message || error);
    setStatus(`Fehler beim Truncaten: ${error?.message}`, 'error');
    throw error;
  }
}

export const TableRowTruncateMutation = {
  mutate: async (vars, { onSuccess, onError } = {}) => {
    try {
      const confirmed = window?.confirm?.(
        `Are you absolutely sure? This will TRUNCATE "${vars.table.name}" - ALL records will be deleted and cannot be undone!`
      );
      
      if (!confirmed) {
        const error = new Error('Truncate operation cancelled');
        if (onError) onError(error);
        throw error;
      }

      const data = await truncateTableRow(vars);
      if (onSuccess) onSuccess(data);
      return data;
    } catch (err) {
      console.error('Truncate Fehler:', err);
      if (onError) onError(err);
      throw err;
    }
  }
};

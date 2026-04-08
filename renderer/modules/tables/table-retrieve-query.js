/**
 * Table Retrieve Query
 * Fetches detailed information about a specific table
 */

import { tableKeys } from './keys.js';

/**
 * Table variables type
 * @typedef {Object} TablesVariables
 * @property {string|undefined} projectRef - Project reference
 * @property {string|null} [connectionString] - Connection string (optional)
 * @property {string} name - Table name
 * @property {string} schema - Schema name
 */

/**
 * Fetch detailed table information
 * @async
 * @param {TablesVariables} params - Query parameters
 * @param {AbortSignal} [signal] - Abort signal
 * @returns {Promise<Object>} Table details including columns
 * @throws {Error} If table retrieval fails
 */
async function getTable(
  { projectRef, connectionString, name, schema },
  signal
) {
  try {
    if (!projectRef) {
      throw new Error('projectRef is required');
    }

    const quotedName = '"' + schema + '"."' + name + '"';
    const sql = 'SELECT * FROM information_schema.tables WHERE table_schema = ' 
      + "'" + schema + "' AND table_name = '" + name + "';";

    const { ipcRenderer } = require('electron');
    const result = await ipcRenderer.invoke('execute-sql', {
      projectRef,
      connectionString,
      sql,
      queryKey: tableKeys.retrieve(projectRef, name, schema),
    });

    if (!result || !result[0]) {
      throw new Error('Table not found: ' + name);
    }

    return result[0];
  } catch (error) {
    console.error('Error retrieving table:', error);
    throw error;
  }
}

/**
 * React Query hook for table retrieval
 * @param {TablesVariables} params - Query parameters
 * @param {Object} options - Query options
 * @param {boolean} [options.enabled=true] - Whether query is enabled
 * @returns {Object} Query object with data, error, isLoading
 */
function useTableQuery({ projectRef, connectionString, name, schema }, { enabled = true } = {}) {
  return {
    async queryFn({ signal }) {
      return getTable({ projectRef, connectionString, name, schema }, signal);
    },
    queryKey: tableKeys.retrieve(projectRef, name, schema),
    enabled: enabled && typeof projectRef !== 'undefined',
    staleTime: 5 * 60 * 1000, // 5 minutes
  };
}

/**
 * Non-hook usage to fetch and cache table data
 * @async
 * @param {Object} params - Parameters
 * @param {string} params.projectRef - Project reference
 * @param {string} params.name - Table name
 * @param {string} params.schema - Schema name
 * @param {string|null} [params.connectionString] - Connection string (optional)
 * @returns {Promise<Object>} Table details
 */
async function getTableQuery({ projectRef, name, schema, connectionString }) {
  try {
    const result = await getTable(
      { projectRef, connectionString, name, schema },
      null
    );
    return result;
  } catch (error) {
    console.error('Error in getTableQuery:', error);
    throw error;
  }
}

export {
  getTable,
  useTableQuery,
  getTableQuery,
};

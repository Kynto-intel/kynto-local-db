/**
 * Tables List Query
 * Fetches all tables from a schema with optional sorting and column inclusion
 */

import { tableKeys } from './keys.js';

/**
 * Tables variables type
 * @typedef {Object} TablesVariables
 * @property {string|undefined} projectRef - Project reference
 * @property {string|null} [connectionString] - Connection string (optional)
 * @property {string} [schema] - Schema name (default: 'public')
 * @property {boolean} [includeColumns] - Include column details (default: false)
 * @property {string} [sortByProperty] - Sort property name (default: 'name')
 */

/**
 * Fetch all tables from schema
 * @async
 * @param {TablesVariables} params - Query parameters
 * @param {AbortSignal} [signal] - Abort signal
 * @returns {Promise<Array>} Array of table objects
 * @throws {Error} If fetch fails
 */
async function getTables(
  {
    projectRef,
    connectionString,
    schema = 'public',
    includeColumns = false,
    sortByProperty = 'name',
  },
  signal
) {
  try {
    if (!projectRef) {
      throw new Error('projectRef is required');
    }

    const schemaClause = schema ? " WHERE table_schema = '" + schema + "'" : '';
    const sql = 'SELECT * FROM information_schema.tables' + schemaClause
      + " ORDER BY table_name ASC;";

    const { ipcRenderer } = require('electron');
    let result = await ipcRenderer.invoke('execute-sql', {
      projectRef,
      connectionString,
      sql,
      queryKey: tableKeys.list(projectRef, schema, includeColumns),
    });

    // Ensure result is an array
    if (!Array.isArray(result)) {
      result = [];
    }

    // Sort by property if specified
    if (result.length > 0 && sortByProperty) {
      result.sort((a, b) => {
        const aVal = a[sortByProperty] || '';
        const bVal = b[sortByProperty] || '';
        return String(aVal).localeCompare(String(bVal));
      });
    }

    return result;
  } catch (error) {
    console.error('Error fetching tables:', error);
    throw error;
  }
}

/**
 * React Query hook for tables list
 * @param {TablesVariables} params - Query parameters
 * @param {Object} options - Query options
 * @param {boolean} [options.enabled=true] - Whether query is enabled
 * @returns {Object} Query object
 */
function useTablesQuery(
  { projectRef, connectionString, schema, includeColumns },
  { enabled = true } = {}
) {
  return {
    async queryFn({ signal }) {
      return getTables(
        { projectRef, connectionString, schema, includeColumns },
        signal
      );
    },
    queryKey: tableKeys.list(projectRef, schema, includeColumns),
    enabled: enabled && typeof projectRef !== 'undefined',
    staleTime: 5 * 60 * 1000, // 5 minutes
  };
}

/**
 * Get tables from cache or fetch if not cached
 * @param {Object} params - Parameters
 * @param {string} params.projectRef - Project reference
 * @param {string|null} [params.connectionString] - Connection string (optional)
 * @returns {Function} Function to fetch tables with optional schema and includeColumns
 */
function useGetTables({ projectRef, connectionString }) {
  return function(schema, includeColumns) {
    return getTables(
      { projectRef, connectionString, schema, includeColumns },
      null
    );
  };
}

export {
  getTables,
  useTablesQuery,
  useGetTables,
};

/**
 * Tables Roles Access Query
 * Fetches tables accessible with anonymous and authenticated roles
 */

import { tableKeys } from './keys.js';

/**
 * Tables roles access variables type
 * @typedef {Object} TablesRolesAccessVariables
 * @property {string} [projectRef] - Project reference
 * @property {string|null} [connectionString] - Connection string (optional)
 * @property {string} schema - Schema name (required)
 */

/**
 * Fetch tables with anon and authenticated role access
 * @async
 * @param {TablesRolesAccessVariables} params - Query parameters
 * @param {AbortSignal} [signal] - Abort signal
 * @returns {Promise<Set>} Set of table names accessible to anon/authenticated roles
 * @throws {Error} If query fails
 */
async function getTablesWithAnonAuthenticatedAccess(
  { schema, projectRef, connectionString },
  signal
) {
  try {
    if (!schema) {
      throw new Error('schema is required');
    }

    const sql = 'SELECT table_name FROM information_schema.role_table_grants '
      + 'WHERE table_schema = ' + "'" + schema + "' "
      + "AND (grantee = 'anon' OR grantee = 'authenticated') "
      + 'GROUP BY table_name;';

    const { ipcRenderer } = require('electron');
    const result = await ipcRenderer.invoke('execute-sql', {
      projectRef,
      connectionString,
      sql,
      queryKey: ['TablesRolesAccess', schema],
    });

    if (!Array.isArray(result)) {
      return new Set();
    }

    // Convert to Set of table names
    const tableSet = new Set();
    result.forEach(row => {
      if (row.table_name) {
        tableSet.add(row.table_name);
      }
    });

    return tableSet;
  } catch (error) {
    console.error('Error fetching tables with role access:', error);
    throw error;
  }
}

/**
 * React Query hook for tables roles access
 * @param {TablesRolesAccessVariables} params - Query parameters
 * @param {Object} options - Query options
 * @param {boolean} [options.enabled=true] - Whether query is enabled
 * @returns {Object} Query object
 */
function useTablesRolesAccessQuery(
  { projectRef, connectionString, schema },
  { enabled = true } = {}
) {
  return {
    async queryFn({ signal }) {
      return getTablesWithAnonAuthenticatedAccess(
        { projectRef, connectionString, schema },
        signal
      );
    },
    queryKey: tableKeys.rolesAccess(projectRef, schema),
    enabled: enabled && typeof projectRef !== 'undefined' && typeof schema !== 'undefined',
    staleTime: 10 * 60 * 1000, // 10 minutes
  };
}

export {
  getTablesWithAnonAuthenticatedAccess,
  useTablesRolesAccessQuery,
};

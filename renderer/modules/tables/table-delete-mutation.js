/**
 * Table Delete Mutation
 * Handles safe table deletion with cascade option
 */

import { tableKeys } from './keys.js';

/**
 * Delete table variables type
 * @typedef {Object} TableDeleteVariables
 * @property {string} projectRef - Project reference
 * @property {string|null} [connectionString] - Connection string (optional)
 * @property {number} id - Table OID
 * @property {string} name - Table name
 * @property {string} schema - Schema name
 * @property {boolean} [cascade] - Drop cascade (default: false)
 */

/**
 * Delete a database table
 * @async
 * @param {TableDeleteVariables} params - Deletion parameters
 * @returns {Promise<void>} Result of table deletion
 * @throws {Error} If table deletion fails
 */
async function deleteTable({
  projectRef,
  connectionString,
  id,
  name,
  schema,
  cascade = false,
}) {
  try {
    const cascadeClause = cascade ? ' CASCADE' : '';
    const quotedName = '"' + schema + '"."' + name + '"';
    const sql = 'DROP TABLE IF EXISTS ' + quotedName + cascadeClause + ';';

    const { ipcRenderer } = require('electron');
    const result = await ipcRenderer.invoke('execute-sql', {
      projectRef,
      connectionString,
      sql,
      queryKey: ['table', 'delete', id],
    });

    return result;
  } catch (error) {
    console.error('Error deleting table:', error);
    throw error;
  }
}

/**
 * React Query mutation hook for table deletion
 * @param {Object} options - Mutation options
 * @param {Function} [options.onSuccess] - Success callback
 * @param {Function} [options.onError] - Error callback
 * @returns {Object} Mutation object with mutate function
 */
function useTableDeleteMutation({ onSuccess, onError } = {}) {
  return {
    /**
     * Execute table deletion mutation
     * @async
     * @param {TableDeleteVariables} variables - Deletion variables
     */
    mutateAsync: async (variables) => {
      try {
        const data = await deleteTable(variables);
        const { id, projectRef, schema } = variables;

        // Invalidate related queries
        const { ipcRenderer } = require('electron');
        await ipcRenderer.invoke('cache-invalidate', {
          queryKeys: [
            tableKeys.list(projectRef, schema),
            tableKeys.retrieve(projectRef, variables.name, schema),
          ],
        });

        if (onSuccess) onSuccess(data, variables);
        return data;
      } catch (error) {
        if (onError) {
          onError(error, variables);
        } else {
          const message = error?.message || 'Failed to delete database table';
          console.error(message);
        }
        throw error;
      }
    },

    mutate: function(variables, callbacks) {
      this.mutateAsync(variables)
        .then(data => callbacks?.onSuccess?.(data))
        .catch(error => callbacks?.onError?.(error));
    },
  };
}

export {
  deleteTable,
  useTableDeleteMutation,
};

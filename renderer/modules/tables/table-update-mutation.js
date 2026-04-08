/**
 * Table Update Mutation
 * Handles table modifications including RLS and replica identity settings
 */

import { tableKeys } from './keys.js';

/**
 * Update table body type
 * @typedef {Object} UpdateTableBody
 * @property {string} [name] - New table name
 * @property {string} [schema] - Schema name
 * @property {string|null} [comment] - Table comment
 * @property {boolean} [rls_enabled] - Row Level Security enabled
 * @property {boolean} [rls_forced] - Row Level Security forced
 * @property {'DEFAULT'|'INDEX'|'FULL'|'NOTHING'} [replica_identity] - Replica identity type
 * @property {string} [replica_identity_index] - Replica identity index name
 */

/**
 * Table update variables type
 * @typedef {Object} TableUpdateVariables
 * @property {string} projectRef - Project reference
 * @property {string|null} [connectionString] - Connection string (optional)
 * @property {number} id - Table OID
 * @property {string} name - Current table name
 * @property {string} schema - Schema name
 * @property {UpdateTableBody} payload - Update payload
 */

/**
 * Update a database table
 * @async
 * @param {TableUpdateVariables} params - Update parameters
 * @returns {Promise<void>} Result of table update
 * @throws {Error} If table update fails
 */
async function updateTable({
  projectRef,
  connectionString,
  id,
  name,
  schema,
  payload,
}) {
  try {
    const quotedName = '"' + schema + '"."' + name + '"';
    let sql = '';

    // Handle table rename
    if (payload.name && payload.name !== name) {
      sql += 'ALTER TABLE ' + quotedName + ' RENAME TO "' + payload.name + '";\n';
    }

    // Handle comment update
    if (payload.comment !== undefined) {
      const comment = payload.comment 
        ? "'" + payload.comment.replace(/'/g, "''") + "'"
        : 'NULL';
      sql += 'COMMENT ON TABLE ' + quotedName + ' IS ' + comment + ';\n';
    }

    // Handle RLS enable/disable
    if (payload.rls_enabled !== undefined) {
      const rlsClause = payload.rls_enabled ? 'ENABLE' : 'DISABLE';
      sql += 'ALTER TABLE ' + quotedName + ' ' + rlsClause + ' ROW LEVEL SECURITY;\n';
    }

    // Handle RLS forced
    if (payload.rls_forced !== undefined) {
      const forceClause = payload.rls_forced ? 'ENABLE' : 'DISABLE';
      sql += 'ALTER TABLE ' + quotedName + ' ' + forceClause + ' ROW LEVEL SECURITY;\n';
    }

    // Handle replica identity
    if (payload.replica_identity !== undefined) {
      if (payload.replica_identity === 'INDEX' && payload.replica_identity_index) {
        sql += 'ALTER TABLE ' + quotedName + ' REPLICA IDENTITY USING INDEX "'
          + payload.replica_identity_index + '";\n';
      } else {
        sql += 'ALTER TABLE ' + quotedName + ' REPLICA IDENTITY ' + payload.replica_identity + ';\n';
      }
    }

    if (!sql) {
      return null; // No changes
    }

    const { ipcRenderer } = require('electron');
    const result = await ipcRenderer.invoke('execute-sql', {
      projectRef,
      connectionString,
      sql,
      queryKey: ['table', 'update', id],
    });

    return result;
  } catch (error) {
    console.error('Error updating table:', error);
    throw error;
  }
}

/**
 * React Query mutation hook for table updates
 * @param {Object} options - Mutation options
 * @param {Function} [options.onSuccess] - Success callback
 * @param {Function} [options.onError] - Error callback
 * @returns {Object} Mutation object with mutate function
 */
function useTableUpdateMutation({ onSuccess, onError } = {}) {
  return {
    /**
     * Execute table update mutation
     * @async
     * @param {TableUpdateVariables} variables - Update variables
     */
    mutateAsync: async (variables) => {
      try {
        const data = await updateTable(variables);
        const { projectRef, schema, id } = variables;

        // Invalidate related queries
        const { ipcRenderer } = require('electron');
        await ipcRenderer.invoke('cache-invalidate', {
          queryKeys: [
            tableKeys.list(projectRef, schema),
          ],
        });

        if (onSuccess) onSuccess(data, variables);
        return data;
      } catch (error) {
        if (onError) {
          onError(error, variables);
        } else {
          const message = error?.message || 'Failed to update database table';
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
  updateTable,
  useTableUpdateMutation,
};

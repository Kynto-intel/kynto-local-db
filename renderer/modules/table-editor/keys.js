/**
 * Table Editor Query Keys Management (ES6)
 * Manages React Query cache keys for table editor operations
 * @module table-editor/keys
 */

/**
 * Query key factory for table editor operations
 * @type {Object}
 */
export const tableEditorKeys = {
  /**
   * Generate query key for a specific table editor
   * @param {string|undefined} projectRef - Project reference identifier
   * @param {number} [id] - Entity ID (table, view, etc.)
   * @returns {Array} Array of query key components
   */
  tableEditor: (projectRef, id) => {
    const keys = ['projects', projectRef, 'table-editor', id];
    return keys.filter(Boolean); // Remove undefined/null values
  },

  /**
   * Get all table editor related keys
   * @param {string|undefined} projectRef - Project reference
   * @returns {Array} Base query key
   */
  all: (projectRef) => ['projects', projectRef, 'table-editor'].filter(Boolean),

  /**
   * Get list keys for table editor
   * @param {string|undefined} projectRef - Project reference
   * @returns {Array} List query key
   */
  lists: (projectRef) => [...tableEditorKeys.all(projectRef), 'list'],

  /**
   * Get detail keys for specific entity
   * @param {string|undefined} projectRef - Project reference
   * @param {number} [id] - Entity ID
   * @returns {Array} Detail query key
   */
  detail: (projectRef, id) => [...tableEditorKeys.all(projectRef), id],
};

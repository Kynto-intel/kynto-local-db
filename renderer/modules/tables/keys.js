/**
 * Table Query Keys (ES6)
 * Provides consistent cache key generation for React Query
 * Used for data invalidation and cache management
 */

export const tableKeys = {
  /**
   * List all tables in a schema
   * @param {string|undefined} projectRef - Project reference
   * @param {string} [schema] - Database schema name
   * @param {boolean} [includeColumns] - Whether to include column details
   * @returns {Array} Query key array
   */
  list: (projectRef, schema, includeColumns) =>
    ['projects', projectRef, 'tables', schema, includeColumns].filter(Boolean),

  /**
   * Retrieve single table details
   * @param {string|undefined} projectRef - Project reference
   * @param {string} name - Table name
   * @param {string} schema - Schema name
   * @returns {Array} Query key array
   */
  retrieve: (projectRef, name, schema) =>
    ['projects', projectRef, 'table', schema, name].filter(Boolean),

  /**
   * Roles access query key
   * @param {string|undefined} projectRef - Project reference
   * @param {string} schema - Schema name
   * @returns {Array} Query key array with role access context
   */
  rolesAccess: (projectRef, schema) => [
    'projects',
    projectRef,
    'roles-access',
    { schema },
  ],
};

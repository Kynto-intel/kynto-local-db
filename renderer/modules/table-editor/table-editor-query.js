/**
 * Table Editor Query Module
 * Handles fetching and managing table editor data with caching
 * @module table-editor/table-editor-query
 */

/**
 * Get table editor SQL from pg-meta
 * Generates appropriate SQL based on entity type and ID
 * @param {Object} options - Query options
 * @param {number} options.id - Entity ID (table, view, etc.)
 * @returns {string} SQL query string
 */
function getTableEditorSql({ id }) {
  // Build SQL to retrieve entity metadata
  const sql = `
    SELECT 
      t.oid as id,
      n.nspname as schema,
      t.relname as name,
      obj_description(t.oid, 'pg_class') as comment,
      t.relkind,
      CASE WHEN t.relkind = 'r' THEN (
        SELECT 
          COALESCE(json_agg(json_build_object(
            'name', a.attname,
            'type', pg_catalog.format_type(a.atttypid, a.atttypmod),
            'not_null', NOT a.attnotnull,
            'default_value', pg_get_expr(ad.adbin, ad.adrelid),
            'ordinal_position', a.attnum
          ) ORDER BY a.attnum), '[]'::json)
        FROM pg_attribute a
        LEFT JOIN pg_attrdef ad ON ad.adrelid = t.oid AND ad.adnum = a.attnum
        WHERE a.attrelid = t.oid AND a.attnum > 0 AND NOT a.attisdropped
      ) ELSE NULL END as columns
    FROM pg_class t
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE t.oid = $1
  `;
  return sql;
}

/**
 * Execute SQL and fetch table editor data
 * Wrapper around executeSql for table editor queries
 * @async
 * @param {Object} params - Query parameters
 * @param {string} params.projectRef - Project reference
 * @param {string} params.connectionString - Database connection string
 * @param {string} params.sql - SQL query to execute
 * @param {Array} params.queryKey - React Query key
 * @param {AbortSignal} [signal] - AbortSignal for cancellation
 * @returns {Promise<Object>} Query result object
 */
async function executeSql(params, signal) {
  // This would be implemented in the actual application
  // For now returning a stub structure
  return {
    result: [{ entity: null }],
    error: null,
  };
}

/**
 * Fetch table editor data
 * Main query function that loads entity metadata
 * @async
 * @param {Object} variables - Query variables
 * @param {number} [variables.id] - Entity ID
 * @param {string} [variables.projectRef] - Project reference
 * @param {string} [variables.connectionString] - Connection string
 * @param {AbortSignal} [signal] - AbortSignal for cancellation
 * @returns {Promise<Object|undefined>} Entity object or undefined
 * @throws {Error} If id is not provided
 */
async function getTableEditor(
  { projectRef, connectionString, id },
  signal
) {
  if (!id) {
    throw new Error('id is required');
  }

  const sql = getTableEditorSql({ id });
  
  try {
    const { result } = await executeSql(
      {
        projectRef,
        connectionString,
        sql,
        queryKey: ['table-editor', id],
      },
      signal
    );

    return (result[0]?.entity ?? null);
  } catch (error) {
    console.error('Error fetching table editor:', error);
    throw error;
  }
}

/**
 * Create React Query options for table editor
 * Encapsulates query configuration
 * @template TData
 * @param {Object} variables - Query variables
 * @param {number} [variables.id] - Entity ID
 * @param {string} [variables.projectRef] - Project reference
 * @param {string} [variables.connectionString] - Connection string
 * @returns {Object} Query options object
 */
function tableEditorQueryOptions({ projectRef, connectionString, id }) {
  return {
    queryKey: ['projects', projectRef, 'table-editor', id].filter(Boolean),
    queryFn: ({ signal }) => getTableEditor({ projectRef, connectionString, id }, signal),
    enabled: typeof projectRef !== 'undefined' && typeof id !== 'undefined' && !isNaN(id),
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
  };
}

/**
 * Hook to use table editor query
 * Wrapper for useQuery with pre-configured options
 * @template TData
 * @param {Object} variables - Query variables
 * @param {number} [variables.id] - Entity ID
 * @param {string} [variables.projectRef] - Project reference
 * @param {string} [variables.connectionString] - Connection string
 * @param {Object} [options] - Additional query options
 * @param {boolean} [options.enabled=true] - Whether query is enabled
 * @returns {Object} Query result object
 */
function useTableEditorQuery(
  { projectRef, connectionString, id },
  { enabled = true, ...options } = {}
) {
  // This would integrate with actual React Query in the app
  // Returning structure for documentation
  return {
    data: null,
    isLoading: false,
    isError: false,
    error: null,
    refetch: () => {},
  };
}

/**
 * Prefetch table editor query
 * Useful for optimistic data loading
 * @async
 * @param {Object} client - React Query client
 * @param {Object} variables - Query variables
 * @param {number} [variables.id] - Entity ID
 * @param {string} [variables.projectRef] - Project reference
 * @param {string} [variables.connectionString] - Connection string
 * @returns {Promise<Object|undefined>} Prefetched data
 */
async function prefetchTableEditor(
  client,
  { projectRef, connectionString, id }
) {
  if (!client.fetchQuery) {
    console.warn('React Query client not available for prefetching');
    return null;
  }
  
  return client.fetchQuery(
    tableEditorQueryOptions({ projectRef, connectionString, id })
  );
}

/**
 * Invalidate table editor queries
 * Useful after mutations to refresh data
 * @async
 * @param {Object} client - React Query client
 * @param {number} [id] - Specific entity ID to invalidate
 * @param {string} [projectRef] - Project reference
 * @returns {Promise<void>}
 */
async function invalidateTableEditorQueries(client, id, projectRef) {
  if (!client.invalidateQueries) {
    return;
  }

  const queryKey = id
    ? ['projects', projectRef, 'table-editor', id]
    : ['projects', projectRef, 'table-editor'];

  return client.invalidateQueries({
    queryKey: queryKey.filter(Boolean),
  });
}

/**
 * Get cached table editor data
 * Retrieve data directly from React Query cache
 * @param {Object} client - React Query client
 * @param {number} id - Entity ID
 * @param {string} projectRef - Project reference
 * @returns {Object|undefined} Cached data if available
 */
function getTableEditorCache(client, id, projectRef) {
  if (!client.getQueryData) {
    return undefined;
  }

  const queryKey = ['projects', projectRef, 'table-editor', id];
  return client.getQueryData(queryKey);
}

// Export for ES6 modules
export {
    getTableEditorSql,
    executeSql,
    getTableEditor,
    tableEditorQueryOptions,
    useTableEditorQuery,
    prefetchTableEditor,
    invalidateTableEditorQueries,
    getTableEditorCache,
};

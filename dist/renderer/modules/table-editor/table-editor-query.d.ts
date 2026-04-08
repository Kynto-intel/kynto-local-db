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
export function getTableEditorSql({ id }: {
    id: number;
}): string;
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
export function executeSql(params: {
    projectRef: string;
    connectionString: string;
    sql: string;
    queryKey: any[];
}, signal?: AbortSignal): Promise<any>;
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
export function getTableEditor({ projectRef, connectionString, id }: {
    id?: number;
    projectRef?: string;
    connectionString?: string;
}, signal?: AbortSignal): Promise<any | undefined>;
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
export function tableEditorQueryOptions<TData>({ projectRef, connectionString, id }: {
    id?: number;
    projectRef?: string;
    connectionString?: string;
}): any;
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
export function useTableEditorQuery<TData>({ projectRef, connectionString, id }: {
    id?: number;
    projectRef?: string;
    connectionString?: string;
}, { enabled, ...options }?: {
    enabled?: boolean;
}): any;
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
export function prefetchTableEditor(client: any, { projectRef, connectionString, id }: {
    id?: number;
    projectRef?: string;
    connectionString?: string;
}): Promise<any | undefined>;
/**
 * Invalidate table editor queries
 * Useful after mutations to refresh data
 * @async
 * @param {Object} client - React Query client
 * @param {number} [id] - Specific entity ID to invalidate
 * @param {string} [projectRef] - Project reference
 * @returns {Promise<void>}
 */
export function invalidateTableEditorQueries(client: any, id?: number, projectRef?: string): Promise<void>;
/**
 * Get cached table editor data
 * Retrieve data directly from React Query cache
 * @param {Object} client - React Query client
 * @param {number} id - Entity ID
 * @param {string} projectRef - Project reference
 * @returns {Object|undefined} Cached data if available
 */
export function getTableEditorCache(client: any, id: number, projectRef: string): any | undefined;

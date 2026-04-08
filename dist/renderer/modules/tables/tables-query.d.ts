/**
 * Tables variables type
 */
export type TablesVariables = {
    /**
     * - Project reference
     */
    projectRef: string | undefined;
    /**
     * - Connection string (optional)
     */
    connectionString?: string | null;
    /**
     * - Schema name (default: 'public')
     */
    schema?: string;
    /**
     * - Include column details (default: false)
     */
    includeColumns?: boolean;
    /**
     * - Sort property name (default: 'name')
     */
    sortByProperty?: string;
};
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
export function getTables({ projectRef, connectionString, schema, includeColumns, sortByProperty, }: TablesVariables, signal?: AbortSignal): Promise<any[]>;
/**
 * React Query hook for tables list
 * @param {TablesVariables} params - Query parameters
 * @param {Object} options - Query options
 * @param {boolean} [options.enabled=true] - Whether query is enabled
 * @returns {Object} Query object
 */
export function useTablesQuery({ projectRef, connectionString, schema, includeColumns }: TablesVariables, { enabled }?: {
    enabled?: boolean;
}): any;
/**
 * Get tables from cache or fetch if not cached
 * @param {Object} params - Parameters
 * @param {string} params.projectRef - Project reference
 * @param {string|null} [params.connectionString] - Connection string (optional)
 * @returns {Function} Function to fetch tables with optional schema and includeColumns
 */
export function useGetTables({ projectRef, connectionString }: {
    projectRef: string;
    connectionString?: string | null;
}): Function;

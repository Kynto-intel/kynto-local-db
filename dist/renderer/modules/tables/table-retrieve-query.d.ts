/**
 * Table variables type
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
     * - Table name
     */
    name: string;
    /**
     * - Schema name
     */
    schema: string;
};
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
export function getTable({ projectRef, connectionString, name, schema }: TablesVariables, signal?: AbortSignal): Promise<any>;
/**
 * React Query hook for table retrieval
 * @param {TablesVariables} params - Query parameters
 * @param {Object} options - Query options
 * @param {boolean} [options.enabled=true] - Whether query is enabled
 * @returns {Object} Query object with data, error, isLoading
 */
export function useTableQuery({ projectRef, connectionString, name, schema }: TablesVariables, { enabled }?: {
    enabled?: boolean;
}): any;
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
export function getTableQuery({ projectRef, name, schema, connectionString }: {
    projectRef: string;
    name: string;
    schema: string;
    connectionString?: string | null;
}): Promise<any>;

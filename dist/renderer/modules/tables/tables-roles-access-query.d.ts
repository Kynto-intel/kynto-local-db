/**
 * Tables roles access variables type
 */
export type TablesRolesAccessVariables = {
    /**
     * - Project reference
     */
    projectRef?: string;
    /**
     * - Connection string (optional)
     */
    connectionString?: string | null;
    /**
     * - Schema name (required)
     */
    schema: string;
};
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
export function getTablesWithAnonAuthenticatedAccess({ schema, projectRef, connectionString }: TablesRolesAccessVariables, signal?: AbortSignal): Promise<Set<any>>;
/**
 * React Query hook for tables roles access
 * @param {TablesRolesAccessVariables} params - Query parameters
 * @param {Object} options - Query options
 * @param {boolean} [options.enabled=true] - Whether query is enabled
 * @returns {Object} Query object
 */
export function useTablesRolesAccessQuery({ projectRef, connectionString, schema }: TablesRolesAccessVariables, { enabled }?: {
    enabled?: boolean;
}): any;

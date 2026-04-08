/**
 * Delete table variables type
 */
export type TableDeleteVariables = {
    /**
     * - Project reference
     */
    projectRef: string;
    /**
     * - Connection string (optional)
     */
    connectionString?: string | null;
    /**
     * - Table OID
     */
    id: number;
    /**
     * - Table name
     */
    name: string;
    /**
     * - Schema name
     */
    schema: string;
    /**
     * - Drop cascade (default: false)
     */
    cascade?: boolean;
};
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
export function deleteTable({ projectRef, connectionString, id, name, schema, cascade, }: TableDeleteVariables): Promise<void>;
/**
 * React Query mutation hook for table deletion
 * @param {Object} options - Mutation options
 * @param {Function} [options.onSuccess] - Success callback
 * @param {Function} [options.onError] - Error callback
 * @returns {Object} Mutation object with mutate function
 */
export function useTableDeleteMutation({ onSuccess, onError }?: {
    onSuccess?: Function;
    onError?: Function;
}): any;

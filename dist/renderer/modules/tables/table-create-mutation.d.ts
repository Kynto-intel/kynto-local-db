/**
 * Create table payload type
 */
export type CreateTableBody = {
    /**
     * - Table name
     */
    name: string;
    /**
     * - Schema name
     */
    schema?: string;
    /**
     * - Table comment/description
     */
    comment?: string | null;
};
/**
 * Create table variables type
 */
export type TableCreateVariables = {
    /**
     * - Project reference
     */
    projectRef: string;
    /**
     * - Database connection string (optional)
     */
    connectionString?: string | null;
    /**
     * - Table creation payload
     */
    payload: CreateTableBody & {
        schema: string;
    };
};
/**
 * Create table payload type
 * @typedef {Object} CreateTableBody
 * @property {string} name - Table name
 * @property {string} [schema] - Schema name
 * @property {string|null} [comment] - Table comment/description
 */
/**
 * Create table variables type
 * @typedef {Object} TableCreateVariables
 * @property {string} projectRef - Project reference
 * @property {string|null} [connectionString] - Database connection string (optional)
 * @property {CreateTableBody & {schema: string}} payload - Table creation payload
 */
/**
 * Create a new database table
 * @async
 * @param {TableCreateVariables} params - Creation parameters
 * @returns {Promise<void>} Result of table creation
 * @throws {Error} If table creation fails
 */
export function createTable({ projectRef, connectionString, payload }: TableCreateVariables): Promise<void>;
/**
 * React Query mutation hook for table creation
 * @param {Object} options - Mutation options
 * @param {Function} [options.onSuccess] - Success callback
 * @param {Function} [options.onError] - Error callback
 * @returns {Object} Mutation object with mutate function
 */
export function useTableCreateMutation({ onSuccess, onError }?: {
    onSuccess?: Function;
    onError?: Function;
}): any;

/**
 * Update table body type
 */
export type UpdateTableBody = {
    /**
     * - New table name
     */
    name?: string;
    /**
     * - Schema name
     */
    schema?: string;
    /**
     * - Table comment
     */
    comment?: string | null;
    /**
     * - Row Level Security enabled
     */
    rls_enabled?: boolean;
    /**
     * - Row Level Security forced
     */
    rls_forced?: boolean;
    /**
     * - Replica identity type
     */
    replica_identity?: "DEFAULT" | "INDEX" | "FULL" | "NOTHING";
    /**
     * - Replica identity index name
     */
    replica_identity_index?: string;
};
/**
 * Table update variables type
 */
export type TableUpdateVariables = {
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
     * - Current table name
     */
    name: string;
    /**
     * - Schema name
     */
    schema: string;
    /**
     * - Update payload
     */
    payload: UpdateTableBody;
};
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
export function updateTable({ projectRef, connectionString, id, name, schema, payload, }: TableUpdateVariables): Promise<void>;
/**
 * React Query mutation hook for table updates
 * @param {Object} options - Mutation options
 * @param {Function} [options.onSuccess] - Success callback
 * @param {Function} [options.onError] - Error callback
 * @returns {Object} Mutation object with mutate function
 */
export function useTableUpdateMutation({ onSuccess, onError }?: {
    onSuccess?: Function;
    onError?: Function;
}): any;

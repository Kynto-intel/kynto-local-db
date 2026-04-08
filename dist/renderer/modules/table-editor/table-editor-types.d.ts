/**
 * Entity type constants
 */
export type ENTITY_TYPE = string;
export namespace ENTITY_TYPE {
    let TABLE: string;
    let PARTITIONED_TABLE: string;
    let VIEW: string;
    let MATERIALIZED_VIEW: string;
    let FOREIGN_TABLE: string;
}
/**
 * Foreign data wrapper handler constants
 */
export type WRAPPER_HANDLERS = string;
export namespace WRAPPER_HANDLERS {
    let MSSQL: string;
    let MYSQL: string;
    let POSTGRES: string;
    let REDIS: string;
    let ELASTICSEARCH: string;
}
/**
 * Check if entity is a regular table
 * @param {Object} entity - Entity object to check
 * @returns {boolean} True if entity is a table
 */
export function isTable(entity: any): boolean;
/**
 * Check if entity is a partitioned table
 * @param {Object} entity - Entity object to check
 * @returns {boolean} True if entity is a partitioned table
 */
export function isPartitionedTable(entity: any): boolean;
/**
 * Check if entity is table-like (Table or PartitionedTable)
 * Foreign tables are not considered table-like
 * @param {Object} entity - Entity object to check
 * @returns {boolean} True if entity is table-like
 */
export function isTableLike(entity: any): boolean;
/**
 * Check if entity is a foreign table
 * @param {Object} entity - Entity object to check
 * @returns {boolean} True if entity is a foreign table
 */
export function isForeignTable(entity: any): boolean;
/**
 * Check if entity is a MS SQL foreign table
 * @param {Object} entity - Entity object to check
 * @returns {boolean} True if entity is MS SQL foreign table
 */
export function isMsSqlForeignTable(entity: any): boolean;
/**
 * Check if entity is a regular view
 * @param {Object} entity - Entity object to check
 * @returns {boolean} True if entity is a view
 */
export function isView(entity: any): boolean;
/**
 * Check if entity is a materialized view
 * @param {Object} entity - Entity object to check
 * @returns {boolean} True if entity is a materialized view
 */
export function isMaterializedView(entity: any): boolean;
/**
 * Check if entity is view-like (View or MaterializedView)
 * @param {Object} entity - Entity object to check
 * @returns {boolean} True if entity is view-like
 */
export function isViewLike(entity: any): boolean;
/**
 * Convert PostgresTable to Entity type
 * Handles conversion with proper error checking
 * @param {Object} table - PostgreSQL table object
 * @returns {Object|undefined} Converted entity or undefined if invalid
 */
export function postgresTableToEntity(table: any): any | undefined;
/**
 * Get entity type display name
 * @param {Object} entity - Entity object
 * @returns {string} Human-readable entity type
 */
export function getEntityTypeName(entity: any): string;
/**
 * Check if entity supports certain operations
 * @param {Object} entity - Entity object
 * @returns {Object} Operations support object
 */
export function getEntityOperations(entity: any): any;

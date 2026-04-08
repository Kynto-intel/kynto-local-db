/**
 * Format column name for display
 * Converts snake_case to Title Case
 * @param {string} columnName - Column name to format
 * @returns {string} Formatted column name
 */
export function formatColumnName(columnName: string): string;
/**
 * Format data type for display
 * Adds friendly labels to PostgreSQL types
 * @param {string} dataType - PostgreSQL data type
 * @returns {string} Formatted data type
 */
export function formatDataType(dataType: string): string;
/**
 * Check if column type is numeric
 * @param {string} dataType - PostgreSQL data type
 * @returns {boolean} True if numeric type
 */
export function isNumericType(dataType: string): boolean;
/**
 * Check if column type is text-based
 * @param {string} dataType - PostgreSQL data type
 * @returns {boolean} True if text type
 */
export function isTextType(dataType: string): boolean;
/**
 * Check if column type is date/time based
 * @param {string} dataType - PostgreSQL data type
 * @returns {boolean} True if date/time type
 */
export function isDateTimeType(dataType: string): boolean;
/**
 * Get column constraints as string
 * @param {Object} column - Column object
 * @returns {string} Constraint description
 */
export function getColumnConstraints(column: any): string;
/**
 * Sort columns by ordinal position
 * @param {Array} columns - Array of column objects
 * @returns {Array} Sorted columns
 */
export function sortColumnsByPosition(columns: any[]): any[];
/**
 * Group columns by type
 * @param {Array} columns - Array of column objects
 * @returns {Object} Columns grouped by data type
 */
export function groupColumnsByType(columns: any[]): any;
/**
 * Get primary key columns
 * @param {Object} entity - Entity object with columns
 * @returns {Array} Primary key column objects
 */
export function getPrimaryKeyColumns(entity: any): any[];
/**
 * Build column selection query
 * @param {Array} columns - Columns to select
 * @param {boolean} [includeSystemColumns=false] - Include system columns
 * @returns {string} Column list for SELECT
 */
export function buildColumnSelection(columns: any[], includeSystemColumns?: boolean): string;
/**
 * Generate table statistics summary
 * @param {Object} entity - Entity object
 * @returns {Object} Statistics summary
 */
export function getTableStats(entity: any): any;
/**
 * Format entity size in human-readable format
 * @param {number} bytes - Size in bytes
 * @returns {string} Formatted size
 */
export function formatSize(bytes: number): string;
/**
 * Generate ALTER TABLE statement
 * @param {Object} entity - Entity object
 * @param {Array} changes - Array of change objects
 * @returns {string} ALTER TABLE SQL
 */
export function generateAlterTableSql(entity: any, changes: any[]): string;
/**
 * Export table structure as JSON
 * @param {Object} entity - Entity object
 * @returns {string} JSON representation
 */
export function exportTableStructure(entity: any): string;

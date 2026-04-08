/**
 * Tables Utility Functions
 * Common helpers for table operations
 */
/**
 * Escape SQL identifier (table name, column name, etc.)
 * @param {string} identifier - Identifier to escape
 * @returns {string} Escaped identifier
 */
export function escapeIdentifier(identifier: string): string;
/**
 * Escape SQL string value
 * @param {string} value - String value to escape
 * @returns {string} Escaped value with quotes
 */
export function escapeStringValue(value: string): string;
/**
 * Build WHERE clause from filter object
 * @param {Object} filters - Filter object {columnName: value}
 * @returns {string} WHERE clause SQL
 */
export function buildWhereClause(filters: any): string;
/**
 * Check if column is a numerical type
 * @param {string} dataType - PostgreSQL data type
 * @returns {boolean} True if numerical
 */
export function isNumericalColumn(dataType: string): boolean;
/**
 * Check if column is a text/string type
 * @param {string} dataType - PostgreSQL data type
 * @returns {boolean} True if text type
 */
export function isTextColumn(dataType: string): boolean;
/**
 * Check if column is a boolean type
 * @param {string} dataType - PostgreSQL data type
 * @returns {boolean} True if boolean type
 */
export function isBooleanColumn(dataType: string): boolean;
/**
 * Check if column is a date/time type
 * @param {string} dataType - PostgreSQL data type
 * @returns {boolean} True if date/time type
 */
export function isDateTimeColumn(dataType: string): boolean;
/**
 * Format value for display based on column type
 * @param {*} value - Value to format
 * @param {string} dataType - Column data type
 * @returns {string} Formatted value
 */
export function formatColumnValue(value: any, dataType: string): string;
/**
 * Validate table data object
 * @param {Object} data - Data to validate
 * @param {Array} columns - Column definitions
 * @returns {Object} {valid: boolean, errors: string[]}
 */
export function validateTableData(data: any, columns: any[]): any;
/**
 * Get primary key columns from table definition
 * @param {Object} table - Table object
 * @returns {Array} Primary key column names
 */
export function getPrimaryKeys(table: any): any[];
/**
 * Get foreign key constraints
 * @param {Object} table - Table object
 * @returns {Array} Array of FK definitions
 */
export function getForeignKeys(table: any): any[];
/**
 * Check if table has column
 * @param {Object} table - Table object
 * @param {string} columnName - Column name to check
 * @returns {boolean} True if column exists
 */
export function hasColumn(table: any, columnName: string): boolean;

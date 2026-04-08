/**
 * Tables Utility Functions
 * Common helpers for table operations
 */

/**
 * Escape SQL identifier (table name, column name, etc.)
 * @param {string} identifier - Identifier to escape
 * @returns {string} Escaped identifier
 */
function escapeIdentifier(identifier) {
  if (!identifier) return '""';
  return '"' + identifier.replace(/"/g, '""') + '"';
}

/**
 * Escape SQL string value
 * @param {string} value - String value to escape
 * @returns {string} Escaped value with quotes
 */
function escapeStringValue(value) {
  if (value === null || value === undefined) return 'NULL';
  return "'" + String(value).replace(/'/g, "''") + "'";
}

/**
 * Build WHERE clause from filter object
 * @param {Object} filters - Filter object {columnName: value}
 * @returns {string} WHERE clause SQL
 */
function buildWhereClause(filters) {
  if (!filters || Object.keys(filters).length === 0) {
    return '';
  }

  const conditions = Object.entries(filters)
    .map(([col, val]) => {
      if (val === null || val === undefined) {
        return escapeIdentifier(col) + ' IS NULL';
      }
      return escapeIdentifier(col) + ' = ' + escapeStringValue(val);
    })
    .join(' AND ');

  return conditions ? ' WHERE ' + conditions : '';
}

/**
 * Check if column is a numerical type
 * @param {string} dataType - PostgreSQL data type
 * @returns {boolean} True if numerical
 */
function isNumericalColumn(dataType) {
  if (!dataType) return false;
  const numTypes = ['int2', 'int4', 'int8', 'numeric', 'float4', 'float8', 'decimal'];
  return numTypes.some(t => dataType.toLowerCase().includes(t));
}

/**
 * Check if column is a text/string type
 * @param {string} dataType - PostgreSQL data type
 * @returns {boolean} True if text type
 */
function isTextColumn(dataType) {
  if (!dataType) return false;
  const textTypes = ['text', 'varchar', 'char', 'name'];
  return textTypes.some(t => dataType.toLowerCase().includes(t));
}

/**
 * Check if column is a boolean type
 * @param {string} dataType - PostgreSQL data type
 * @returns {boolean} True if boolean type
 */
function isBooleanColumn(dataType) {
  if (!dataType) return false;
  return dataType.toLowerCase() === 'bool' || dataType.toLowerCase() === 'boolean';
}

/**
 * Check if column is a date/time type
 * @param {string} dataType - PostgreSQL data type
 * @returns {boolean} True if date/time type
 */
function isDateTimeColumn(dataType) {
  if (!dataType) return false;
  const dateTypes = ['timestamp', 'date', 'time'];
  return dateTypes.some(t => dataType.toLowerCase().includes(t));
}

/**
 * Format value for display based on column type
 * @param {*} value - Value to format
 * @param {string} dataType - Column data type
 * @returns {string} Formatted value
 */
function formatColumnValue(value, dataType) {
  if (value === null || value === undefined) return 'NULL';

  if (isBooleanColumn(dataType)) {
    return value ? 'true' : 'false';
  }

  if (isDateTimeColumn(dataType)) {
    if (value instanceof Date) {
      return value.toISOString();
    }
    return String(value);
  }

  if (isNumericalColumn(dataType)) {
    return String(value);
  }

  return String(value);
}

/**
 * Validate table data object
 * @param {Object} data - Data to validate
 * @param {Array} columns - Column definitions
 * @returns {Object} {valid: boolean, errors: string[]}
 */
function validateTableData(data, columns) {
  const errors = [];

  if (!data || typeof data !== 'object') {
    errors.push('Data must be an object');
    return { valid: false, errors };
  }

  // Validate required columns (not nullable)
  columns.forEach(col => {
    if (!col.is_nullable && !(col.name in data)) {
      errors.push('Missing required column: ' + col.name);
    }
  });

  // Validate column types
  Object.entries(data).forEach(([colName, value]) => {
    const col = columns.find(c => c.name === colName);
    if (col && value !== null && value !== undefined) {
      if (isNumericalColumn(col.data_type) && isNaN(value)) {
        errors.push('Invalid numeric value for column: ' + colName);
      }
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get primary key columns from table definition
 * @param {Object} table - Table object
 * @returns {Array} Primary key column names
 */
function getPrimaryKeys(table) {
  if (!table || !table.columns) return [];

  return table.columns
    .filter(col => col.is_primary_key)
    .map(col => col.name);
}

/**
 * Get foreign key constraints
 * @param {Object} table - Table object
 * @returns {Array} Array of FK definitions
 */
function getForeignKeys(table) {
  if (!table || !table.constraints) return [];

  return table.constraints.filter(c => c.constraint_type === 'FOREIGN KEY');
}

/**
 * Check if table has column
 * @param {Object} table - Table object
 * @param {string} columnName - Column name to check
 * @returns {boolean} True if column exists
 */
function hasColumn(table, columnName) {
  if (!table || !table.columns) return false;
  return table.columns.some(col => col.name === columnName);
}

export {
  escapeIdentifier,
  escapeStringValue,
  buildWhereClause,
  isNumericalColumn,
  isTextColumn,
  isBooleanColumn,
  isDateTimeColumn,
  formatColumnValue,
  validateTableData,
  getPrimaryKeys,
  getForeignKeys,
  hasColumn,
};

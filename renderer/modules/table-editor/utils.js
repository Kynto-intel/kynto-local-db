/**
 * Table Editor Utility Functions
 * Helper functions for table editor operations
 * @module table-editor/utils
 */

import { ENTITY_TYPE, WRAPPER_HANDLERS } from './table-editor-types.js';

/**
 * Format column name for display
 * Converts snake_case to Title Case
 * @param {string} columnName - Column name to format
 * @returns {string} Formatted column name
 */
function formatColumnName(columnName) {
  if (!columnName) return '';
  return columnName
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Format data type for display
 * Adds friendly labels to PostgreSQL types
 * @param {string} dataType - PostgreSQL data type
 * @returns {string} Formatted data type
 */
function formatDataType(dataType) {
  const typeMap = {
    'boolean': 'Boolean',
    'bigint': 'Long Integer',
    'integer': 'Integer',
    'smallint': 'Small Integer',
    'text': 'Text',
    'varchar': 'Varchar',
    'numeric': 'Decimal',
    'float': 'Float',
    'double precision': 'Double',
    'timestamp': 'Timestamp',
    'date': 'Date',
    'time': 'Time',
    'json': 'JSON',
    'jsonb': 'JSONB',
    'uuid': 'UUID',
  };

  return typeMap[dataType] || dataType;
}

/**
 * Check if column type is numeric
 * @param {string} dataType - PostgreSQL data type
 * @returns {boolean} True if numeric type
 */
function isNumericType(dataType) {
  const numericTypes = [
    'bigint', 'integer', 'smallint', 'numeric',
    'float', 'double precision', 'real', 'money'
  ];
  return numericTypes.includes(dataType?.toLowerCase());
}

/**
 * Check if column type is text-based
 * @param {string} dataType - PostgreSQL data type
 * @returns {boolean} True if text type
 */
function isTextType(dataType) {
  const textTypes = ['text', 'varchar', 'character', 'char'];
  return textTypes.includes(dataType?.toLowerCase());
}

/**
 * Check if column type is date/time based
 * @param {string} dataType - PostgreSQL data type
 * @returns {boolean} True if date/time type
 */
function isDateTimeType(dataType) {
  const dateTimeTypes = [
    'timestamp', 'timestamptz', 'date', 'time', 'timetz'
  ];
  return dateTimeTypes.some(type => dataType?.toLowerCase().includes(type));
}

/**
 * Get column constraints as string
 * @param {Object} column - Column object
 * @returns {string} Constraint description
 */
function getColumnConstraints(column) {
  const constraints = [];
  
  if (column.not_null) constraints.push('NOT NULL');
  if (column.is_primary_key) constraints.push('PRIMARY KEY');
  if (column.is_unique) constraints.push('UNIQUE');
  if (column.default_value) constraints.push(`DEFAULT ${column.default_value}`);
  
  return constraints.length > 0 ? constraints.join(', ') : 'None';
}

/**
 * Sort columns by ordinal position
 * @param {Array} columns - Array of column objects
 * @returns {Array} Sorted columns
 */
function sortColumnsByPosition(columns) {
  return [...columns].sort((a, b) => 
    (a.ordinal_position || 0) - (b.ordinal_position || 0)
  );
}

/**
 * Group columns by type
 * @param {Array} columns - Array of column objects
 * @returns {Object} Columns grouped by data type
 */
function groupColumnsByType(columns) {
  return columns.reduce((grouped, column) => {
    const type = column.type || 'unknown';
    if (!grouped[type]) grouped[type] = [];
    grouped[type].push(column);
    return grouped;
  }, {});
}

/**
 * Get primary key columns
 * @param {Object} entity - Entity object with columns
 * @returns {Array} Primary key column objects
 */
function getPrimaryKeyColumns(entity) {
  if (!entity?.columns || !entity?.primary_keys) return [];
  return entity.columns.filter(col => 
    entity.primary_keys.includes(col.name)
  );
}

/**
 * Build column selection query
 * @param {Array} columns - Columns to select
 * @param {boolean} [includeSystemColumns=false] - Include system columns
 * @returns {string} Column list for SELECT
 */
function buildColumnSelection(columns, includeSystemColumns = false) {
  let selectedColumns = columns;
  
  if (!includeSystemColumns) {
    selectedColumns = columns.filter(col => 
      !col.name.startsWith('_') && col.name !== 'ctid'
    );
  }
  
  return selectedColumns.map(col => '"' + col.name + '"').join(', ');
}

/**
 * Generate table statistics summary
 * @param {Object} entity - Entity object
 * @returns {Object} Statistics summary
 */
function getTableStats(entity) {
  return {
    totalColumns: entity.columns?.length || 0,
    primaryKeyColumns: getPrimaryKeyColumns(entity).length,
    estimatedRows: entity.live_rows_estimate || 0,
    estimatedSize: entity.size || 0,
    replicaIdentity: entity.replica_identity || 'default',
    rlsEnabled: entity.rls_enabled || false,
    rlsForced: entity.rls_forced || false,
  };
}

/**
 * Format entity size in human-readable format
 * @param {number} bytes - Size in bytes
 * @returns {string} Formatted size
 */
function formatSize(bytes) {
  if (!bytes) return '0 B';
  
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return size.toFixed(2) + ' ' + units[unitIndex];
}

/**
 * Generate ALTER TABLE statement
 * @param {Object} entity - Entity object
 * @param {Array} changes - Array of change objects
 * @returns {string} ALTER TABLE SQL
 */
function generateAlterTableSql(entity, changes) {
  if (!entity || !changes || changes.length === 0) return '';
  
  const alterStatements = changes.map(change => {
    switch (change.type) {
      case 'add_column':
        return `ADD COLUMN "${change.name}" ${change.dataType}`;
      case 'drop_column':
        return `DROP COLUMN "${change.name}"`;
      case 'rename_column':
        return `RENAME COLUMN "${change.oldName}" TO "${change.newName}"`;
      case 'modify_column':
        return `ALTER COLUMN "${change.name}" TYPE ${change.dataType}`;
      default:
        return '';
    }
  }).filter(stmt => stmt !== '');
  
  return `ALTER TABLE "${entity.schema}"."${entity.name}"\n` +
         alterStatements.join(',\n') + ';';
}

/**
 * Export table structure as JSON
 * @param {Object} entity - Entity object
 * @returns {string} JSON representation
 */
function exportTableStructure(entity) {
  const structure = {
    name: entity.name,
    schema: entity.schema,
    comment: entity.comment,
    columns: (entity.columns || []).map(col => ({
      name: col.name,
      type: col.type,
      notNull: col.not_null,
      default: col.default_value,
      ordinalPosition: col.ordinal_position,
    })),
    primaryKeys: entity.primary_keys || [],
    relationships: entity.relationships || [],
    stats: getTableStats(entity),
  };
  
  return JSON.stringify(structure, null, 2);
}

// Export for ES6 modules
export {
    formatColumnName,
    formatDataType,
    isNumericType,
    isTextType,
    isDateTimeType,
    getColumnConstraints,
    sortColumnsByPosition,
    groupColumnsByType,
    getPrimaryKeyColumns,
    buildColumnSelection,
    getTableStats,
    formatSize,
    generateAlterTableSql,
    exportTableStructure,
};

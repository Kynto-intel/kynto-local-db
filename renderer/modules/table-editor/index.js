/**
 * ────────────────────────────────────────────────────────────────
 * Table Editor Module - Central Exports (ES6)
 * Aggregates all table editor functionality
 * @module table-editor
 * ────────────────────────────────────────────────────────────────
 */

// Keys
export { tableEditorKeys } from './keys.js';

// Query functions
export {
  getTableEditorSql,
  executeSql,
  getTableEditor,
  tableEditorQueryOptions,
  useTableEditorQuery,
  prefetchTableEditor,
  invalidateTableEditorQueries,
  getTableEditorCache,
} from './table-editor-query.js';

// Types and type checkers
export {
  ENTITY_TYPE,
  WRAPPER_HANDLERS,
  isTable,
  isPartitionedTable,
  isTableLike,
  isForeignTable,
  isMsSqlForeignTable,
  isView,
  isMaterializedView,
  isViewLike,
  postgresTableToEntity,
  getEntityTypeName,
  getEntityOperations,
} from './table-editor-types.js';

// Utilities
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
} from './utils.js';

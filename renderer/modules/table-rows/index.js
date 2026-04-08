/**
 * ────────────────────────────────────────────────────────────────
 * Index für Table-Rows Modul
 * Zentrale Verwaltung aller Table-Row Operationen und Utilities
 * ────────────────────────────────────────────────────────────────
 */

// Export Query Keys
export { tableRowKeys } from './keys.js';

// Export Create Mutation
export {
  getTableRowCreateSql,
  createTableRow,
} from './table-row-create-mutation.js';

// Export Update Mutation
export {
  getTableRowUpdateSql,
  updateTableRow,
} from './table-row-update-mutation.js';

// Export Delete Mutation
export {
  getTableRowDeleteSql,
  deleteTableRows,
} from './table-row-delete-mutation.js';

// Export Delete All Mutation
export {
  getTableRowDeleteAllSql,
  deleteAllTableRow,
  TableRowDeleteAllMutation,
} from './table-row-delete-all-mutation.js';

// Export Truncate Mutation
export {
  getTableRowTruncateSql,
  truncateTableRow,
  TableRowTruncateMutation,
} from './table-row-truncate-mutation.js';

// Export Count Query
export {
  getTableRowsCountSql,
  getTableRowsCount,
  TableRowsCountQuery,
} from './table-rows-count-query.js';

// Export Get Cell Value Mutation
export {
  getCellValue
} from './get-cell-value-mutation.js';

// Export Operation Queue
export {
  saveOperationQueue
} from './operation-queue-save-mutation.js';

// Export Utilities
export {
  formatFilterValue,
  isNumericalColumn,
  getPrimaryKeys,
  isTableLike,
  parseSupaTable,
  validateRowData,
  buildWhereClause,
  escapeValue,
} from './utils.js';

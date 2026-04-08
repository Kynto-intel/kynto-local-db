/**
 * ────────────────────────────────────────────────────────────────
 * Tables Module (ES6)
 * Central export point for all table-related queries and mutations
 * Verantwortung: Tabellenstruktur (CREATE, UPDATE, DELETE, RETRIEVE)
 * ────────────────────────────────────────────────────────────────
 */

// Query Keys
export { tableKeys } from './keys.js';

// Mutations - Tabellenstruktur ändern
export {
  createTable,
  useTableCreateMutation,
} from './table-create-mutation.js';

export {
  deleteTable,
  useTableDeleteMutation,
} from './table-delete-mutation.js';

export {
  updateTable,
  useTableUpdateMutation,
} from './table-update-mutation.js';

// Queries - Tabellen abrufen
export {
  getTable,
  useTableQuery,
  getTableQuery,
} from './table-retrieve-query.js';

export {
  getTables,
  useTablesQuery,
  useGetTables,
} from './tables-query.js';

export {
  getTablesWithAnonAuthenticatedAccess,
  useTablesRolesAccessQuery,
} from './tables-roles-access-query.js';

// Utilities
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
} from './utils.js';

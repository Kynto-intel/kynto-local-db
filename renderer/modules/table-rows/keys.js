/* ── modules/table-rows/keys.js ──────────────────────────────────────
   Zentrale Definition der Cache-Keys für Tabellenzeilen.
   ──────────────────────────────────────────────────────────────────── */

export const tableRowKeys = {
  all: (projectRef) => ['projects', projectRef, 'table-rows'].filter(Boolean),
  
  tableRowsAndCount: (projectRef, tableId) => [
    ...tableRowKeys.all(projectRef),
    tableId
  ],
  
  tableRows: (projectRef, { table, roleImpersonationState, ...args } = {}) => [
    ...tableRowKeys.tableRowsAndCount(projectRef, table?.id || table?.name || 'unknown'),
    'rows',
    { roleImpersonation: roleImpersonationState?.role, ...args },
  ],
  
  tableRowsCount: (projectRef, { table, ...args } = {}) => [
    ...tableRowKeys.tableRowsAndCount(projectRef, table?.id || table?.name || 'unknown'),
    'count',
    args,
  ],

  tableRow: (projectRef, tableId, pkMatch) => [
    ...tableRowKeys.tableRowsAndCount(projectRef, tableId),
    'row',
    pkMatch
  ],
};
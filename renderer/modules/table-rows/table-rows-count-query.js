/**
 * Zählt Tabellenzeilen mit optionalen Filterkriterien
 */

import { state } from "../state.js";
import { esc } from "../utils.js";
import { formatFilterValue } from "./utils.js";
import { tableRowKeys } from "./keys.js";

function formatSqlValue(value) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "string") return "'" + value.replace(/'/g, "''") + "'";
  return "'" + String(value).replace(/'/g, "''") + "'";
}

function buildFilterClause(table, filter) {
  const { column, operator, value } = filter;
  const formattedValue = formatFilterValue(table, filter);
  const operatorMap = { eq: "=", "=": "=", neq: "!=", "!=": "!=", lt: "<", lte: "<=", gt: ">", gte: ">=", like: "LIKE", ilike: "ILIKE", "in": "IN", is: "IS" };
  const sqlOperator = operatorMap[operator] || "=";
  const columnRef = esc(column);

  if (operator === "in" && Array.isArray(formattedValue)) {
    const values = formattedValue.map((v) => formatSqlValue(v)).join(", ");
    return columnRef + " IN (" + values + ")";
  }

  if (operator === "is") {
    if (!formattedValue || formattedValue === "NULL") return columnRef + " IS NULL";
    if (formattedValue === "NOT NULL" || formattedValue === "notnull") return columnRef + " IS NOT NULL";
  }

  return columnRef + " " + sqlOperator + " " + formatSqlValue(formattedValue);
}

function buildWhereClause(table, filters) {
  if (!Array.isArray(filters) || filters.length === 0) return "";
  const whereClauseParts = filters
    .filter((f) => f.value !== "" && f.value !== null && f.value !== undefined)
    .map((filter) => buildFilterClause(table, filter));
  return whereClauseParts.join(" AND ");
}

export function getTableRowsCountSql({ table, filters = [], enforceExactCount = false }) {
  if (!table || !table.name) throw new Error("Table name is required");
  const schemaPrefix = table.schema ? esc(table.schema) + "." : "";
  const whereClauses = buildWhereClause(table, filters);
  const whereClause = whereClauses ? " WHERE " + whereClauses : "";
  if (enforceExactCount) return "SELECT COUNT(*) as count FROM " + schemaPrefix + esc(table.name) + whereClause;
  return "SELECT COUNT(*) as count FROM " + schemaPrefix + esc(table.name) + whereClause;
}

export async function getTableRowsCount({ table, filters = [] }) {
  const sql = getTableRowsCountSql({ table, filters });
  const mode = state.dbMode || "pglite";
  
  // Map dbMode zu dbType für database-engine
  const dbType = mode === 'pglite' ? 'local' : 
                 mode === 'remote' ? 'remote' : 
                 'local';
  
  try {
    let result;
    // Nutze neue database-engine für beide DB-Typen
    result = await window.api.dbQuery(sql, null, dbType);
    return result?.[0]?.count || 0;
  } catch (error) {
    console.error("Failed to get row count:", error?.message || error);
    throw error;
  }
}

export class TableRowsCountQuery {
  constructor({ queryClient, executeSql, onSuccess, onError }) {
    this.queryClient = queryClient;
    this.executeSql = executeSql;
    this.onSuccess = onSuccess;
    this.onError = onError;
  }

  getQueryOptions({ tableId, filters = [], enforceExactCount = false, enabled = true } = {}) {
    return {
      queryKey: tableRowKeys.tableRowsCount(null, { table: { id: tableId }, filters }),
      queryFn: async () => {
        return getTableRowsCount({ table: { id: tableId }, filters });
      },
      enabled: enabled && typeof tableId !== "undefined",
    };
  }

  invalidateQuery(tableId) {
    if (this.queryClient && tableId) {
      const queryKey = tableRowKeys.count(tableId);
      this.queryClient.invalidateQueries({ queryKey });
    }
  }
}

export default TableRowsCountQuery;

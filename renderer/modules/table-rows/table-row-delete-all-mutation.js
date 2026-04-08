﻿/**
 * Löscht mehrere Tabellenzeilen basierend auf Filterkriterien
 */

import { tableRowKeys } from "./keys.js";
import { formatFilterValue } from "./utils.js";
import { state } from "../state.js";
import { esc, setStatus } from "../utils.js";

function formatSqlValue(value) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);
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

  if (operator === "is" && (formattedValue === "NULL" || formattedValue === null)) {
    return columnRef + " IS NULL";
  }

  if (operator === "is" && (formattedValue === "NOT NULL" || formattedValue === "notnull")) {
    return columnRef + " IS NOT NULL";
  }

  return columnRef + " " + sqlOperator + " " + formatSqlValue(formattedValue);
}

export function getTableRowDeleteAllSql({ table, filters = [] }) {
  if (!table || !table.name) throw new Error("Table name is required");
  const schemaPrefix = table.schema ? esc(table.schema) + "." : "";
  let sql = "DELETE FROM " + schemaPrefix + esc(table.name);
  const activeFilters = filters.filter((f) => f.value && f.value !== "");
  if (activeFilters.length > 0) {
    const whereClauses = activeFilters.map((filter) => buildFilterClause(table, filter)).join(" AND ");
    sql += " WHERE " + whereClauses;
  }
  return sql;
}

export async function deleteAllTableRow({ table, filters = [] }) {
  const sql = getTableRowDeleteAllSql({ table, filters });
  const mode = state.dbMode || "pglite";
  
  // Map dbMode zu dbType für database-engine
  const dbType = mode === 'pglite' ? 'local' : 
                 mode === 'remote' ? 'remote' : 
                 'local';
  
  try {
    let result;
    // Nutze neue database-engine für beide DB-Typen
    result = await window.api.dbQuery(sql, null, dbType);
    return result;
  } catch (error) {
    console.error("Failed to delete table rows:", error?.message || error);
    setStatus("Fehler beim Löschen: " + (error?.message || error), "error");
    throw error;
  }
}

export class TableRowDeleteAllMutation {
  constructor({ queryClient, executeSql, onSuccess, onError }) {
    this.queryClient = queryClient;
    this.executeSql = executeSql;
    this.onSuccess = onSuccess;
    this.onError = onError;
  }

  validateFilters(filters) {
    if (!Array.isArray(filters)) return { isValid: false, errorMessage: "Filters must be an array" };
    const hasActiveFilters = filters.some((f) => f.value && f.value !== "");
    if (!hasActiveFilters) return { isValid: false, errorMessage: "At least one filter required" };
    return { isValid: true };
  }

  async mutate(variables) {
    const validation = this.validateFilters(variables.filters);
    if (!validation.isValid) {
      const error = new Error(validation.errorMessage);
      error.type = "VALIDATION_ERROR";
      if (this.onError) this.onError(error, variables);
      throw error;
    }

    try {
      const result = await deleteAllTableRow(variables);
      if (this.queryClient && variables.table?.id) {
        const queryKey = tableRowKeys.tableRows(null, { table: { id: variables.table.id } });
        await this.queryClient.invalidateQueries({ queryKey });
      }
      if (this.onSuccess) this.onSuccess(result, variables);
      return result;
    } catch (error) {
      if (this.onError) this.onError(error, variables);
      else console.error("Failed:", error?.message);
      throw error;
    }
  }
}

export default TableRowDeleteAllMutation;

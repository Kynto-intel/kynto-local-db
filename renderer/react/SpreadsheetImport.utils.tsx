/**
 * SpreadsheetImport Utils - Professional Type Inference for CSV Import
 */

import dayjs from 'dayjs'
import { has } from 'lodash'
import Papa from 'papaparse'

// ═════════════════════════════════════════════════════════════════════════════
// Type Definitions
// ═════════════════════════════════════════════════════════════════════════════

export type InferredColumnType = 'int8' | 'int4' | 'float8' | 'numeric' | 'bool' | 'jsonb' | 'text' | 'uuid' | 'timestamptz' | 'date'

// ═════════════════════════════════════════════════════════════════════════════
// Helper Functions
// ═════════════════════════════════════════════════════════════════════════════

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function tryParseJson(value: unknown): boolean {
  if (typeof value !== 'string') return false
  try {
    JSON.parse(value)
    return true
  } catch {
    return false
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// Helper: Normalize German/International Number Formats
// ═════════════════════════════════════════════════════════════════════════════
const normalizeNumber = (val: string): number => {
  let normalized = String(val).trim().replace(/\s/g, '')
  // German format: 1.234,56 → 1234.56
  if (normalized.match(/^\d{1,3}(\.\d{3})*,\d+$/)) {
    normalized = normalized.replace(/\./g, '').replace(/,/, '.')
  }
  // Simple: 30,42 → 30.42
  else if (normalized.match(/^\d+,\d+$/)) {
    normalized = normalized.replace(',', '.')
  }
  return Number(normalized)
}

// ═════════════════════════════════════════════════════════════════════════════
// Advanced Type Inference Engine (REAL Logic)
// ═════════════════════════════════════════════════════════════════════════════

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2})?/
const DATE_FORMATS = [
  'YYYY-MM-DD HH:mm:ss',
  'YYYY-MM-DD HH:mm:ss.SSS',
  'YYYY-MM-DDTHH:mm:ss',
  'YYYY-MM-DDTHH:mm:ssZ',
  'YYYY-MM-DD',
  'DD.MM.YYYY',
  'DD/MM/YYYY',
  'YYYY/MM/DD',
]

export const inferColumnType = (column: string, rows: unknown[]): InferredColumnType => {
  if (rows.length === 0) return 'text'

  const firstRow = rows[0]
  if (!isObject(firstRow)) return 'text'

  const columnData = firstRow[column]
  const columnDataAcrossRows = rows.map((row) => (isObject(row) ? row[column] : undefined))

  // No data in column
  if (columnData === undefined || columnData === null || columnData === '') {
    return 'text'
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HELPER: Normalize number (convert German format 1.234,56 to 1234.56)
  // ─────────────────────────────────────────────────────────────────────────
  const normalizeNumber = (val: string): number => {
    // Remove spaces
    let normalized = String(val).trim().replace(/\s/g, '')
    // German format: 1.234,56 -> 1234.56
    if (normalized.match(/^\d{1,3}(\.\d{3})*,\d+$/)) {
      normalized = normalized.replace(/\./g, '').replace(/,/, '.')
    }
    // Or just: 30,42 -> 30.42
    else if (normalized.match(/^\d+,\d+$/)) {
      normalized = normalized.replace(',', '.')
    }
    return Number(normalized)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 1. Check for UUID (before number check, since UUID is very specific)
  // ─────────────────────────────────────────────────────────────────────────
  const str = String(columnData).trim()
  if (UUID_REGEX.test(str)) {
    const allUUIDs = columnDataAcrossRows.every(item => {
      if (!item) return true
      return UUID_REGEX.test(String(item).trim())
    })
    if (allUUIDs) return 'uuid'
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 2. Check for Integer
  // ─────────────────────────────────────────────────────────────────────────
  const asNum = normalizeNumber(str)
  if (!isNaN(asNum) && Number.isInteger(asNum) && asNum >= Number.MIN_SAFE_INTEGER) {
    const allIntegers = columnDataAcrossRows.every(item => {
      if (!item && item !== 0) return true
      const n = normalizeNumber(String(item))
      return !isNaN(n) && Number.isInteger(n)
    })
    if (allIntegers) return 'int8'
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 3. Check for Float/Numeric
  // ─────────────────────────────────────────────────────────────────────────
  if (!isNaN(asNum) && isFinite(asNum)) {
    const allNumeric = columnDataAcrossRows.every(item => {
      if (!item && item !== 0) return true
      const n = normalizeNumber(String(item))
      return !isNaN(n) && isFinite(n)
    })
    if (allNumeric) return 'float8'
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 4. Check for Boolean
  // ─────────────────────────────────────────────────────────────────────────
  const boolStr = String(columnData).toLowerCase().trim()
  if (['true', 'false', 'yes', 'no', 'ja', 'nein', '1', '0', 'on', 'off'].includes(boolStr)) {
    const allBooleans = columnDataAcrossRows.every(item => {
      if (!item) return true
      const lower = String(item).toLowerCase().trim()
      return ['true', 'false', 'yes', 'no', 'ja', 'nein', '1', '0', 'on', 'off'].includes(lower)
    })
    if (allBooleans) return 'bool'
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 5. Check for JSON
  // ─────────────────────────────────────────────────────────────────────────
  if (tryParseJson(columnData)) {
    const allJson = columnDataAcrossRows.every(item => {
      if (!item) return true
      return tryParseJson(item)
    })
    if (allJson) return 'jsonb'
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 6. Check for Date/Timestamp (MULTIPLE FORMAT DETECTION)
  // ─────────────────────────────────────────────────────────────────────────
  if (ISO_DATE_REGEX.test(str)) {
    const allDates = columnDataAcrossRows.every(item => {
      if (!item) return true
      const s = String(item).trim()
      for (const fmt of DATE_FORMATS) {
        if (dayjs(s, fmt).isValid()) return true
      }
      return false
    })
    if (allDates) return 'timestamptz'
  }

  // Try dayjs parsing with multiple formats
  for (const fmt of DATE_FORMATS) {
    if (dayjs(str, fmt).isValid()) {
      const allDates = columnDataAcrossRows.every(item => {
        if (!item) return true
        const s = String(item).trim()
        for (const f of DATE_FORMATS) {
          if (dayjs(s, f).isValid()) return true
        }
        return false
      })
      if (allDates) return 'timestamptz'
      break
    }
  }

  // Default to text
  return 'text'
}

// ═════════════════════════════════════════════════════════════════════════════
// CSV Parsing
// ═════════════════════════════════════════════════════════════════════════════

export function parseSpreadsheetText({
  text,
  emptyStringAsNullHeaders,
}: {
  text: string
  emptyStringAsNullHeaders?: Array<string>
}): Promise<{
  headers: Array<string>
  emptyStringAsNullHeaders: Array<string>
  rows: Array<unknown>
  previewRows: Array<unknown>
  columnTypeMap: Record<string, InferredColumnType>
  errors: Array<any>
}> {
  const columnTypeMap: Record<string, InferredColumnType> = {}
  let previewRows: Array<unknown> = []

  return new Promise((resolve) => {
    (Papa as any).parse(text, {
      header: true,
      dynamicTyping: false,
      skipEmptyLines: true,
      complete: (results: any) => {
        const headers = results.meta.fields || []
        const rows = results.data
        const errors = results.errors.map((error: any) => ({ ...error, data: results.data[error.row] }))

        // Determine which headers to treat empty strings as null
        const resolvedEmptyStringAsNullHeaders = emptyStringAsNullHeaders
          ? emptyStringAsNullHeaders.filter((header) => headers.includes(header))
          : headers

        // Transform rows: convert empty strings to null for specified headers
        const transformedRows =
          resolvedEmptyStringAsNullHeaders.length > 0
            ? rows.map((row: any) => {
                const rowAsObject = isObject(row) ? row : {}
                return Object.fromEntries(
                  Object.entries(rowAsObject).map(([k, v]) => [
                    k,
                    v === '' && resolvedEmptyStringAsNullHeaders.includes(k) ? null : v,
                  ])
                )
              })
            : rows

        // Infer types for each column
        headers.forEach((header: string) => {
          const type = inferColumnType(header, transformedRows)
          if (!has(columnTypeMap, header)) {
            columnTypeMap[header] = type
          } else if (columnTypeMap[header] !== type) {
            columnTypeMap[header] = 'text'
          }
        })

        previewRows = transformedRows.slice(0, 20)

        resolve({
          headers,
          emptyStringAsNullHeaders: resolvedEmptyStringAsNullHeaders,
          rows: transformedRows,
          previewRows,
          columnTypeMap,
          errors,
        })
      },
    })
  })
}

export const revertSpreadsheet = (headers: string[], rows: any[]) => {
  return (Papa as any).unparse(rows, { columns: headers })
}

// ═════════════════════════════════════════════════════════════════════════════
// SQL Type Mapping
// ═════════════════════════════════════════════════════════════════════════════

export const inferredTypeToPostgreSQLType = (type: InferredColumnType): string => {
  const map: Record<InferredColumnType, string> = {
    int8: 'BIGINT',
    int4: 'INTEGER',
    float8: 'NUMERIC',
    numeric: 'NUMERIC(20,10)',
    bool: 'BOOLEAN',
    jsonb: 'JSONB',
    uuid: 'UUID',
    timestamptz: 'TIMESTAMP WITH TIME ZONE',
    date: 'DATE',
    text: 'TEXT',
  }
  return map[type] || 'TEXT'
}

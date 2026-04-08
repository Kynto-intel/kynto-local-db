/**
 * Formatiert Filterwerte basierend auf dem Spaltentyp
 * Konvertiert numerische Werte zu Zahlen
 * @param {Object} table - Tabellenkonfiguration mit Spalten
 * @param {Object} filter - Filterobjekt mit column, operator, value
 * @returns {*} Formatierter Filterwert
 */
export function formatFilterValue(table, filter) {
  const column = table?.columns?.find((x) => x.name === filter.column);
  
  if (column && isNumericalColumn(column.format)) {
    const numberValue = Number(filter.value);
    // Unterstützt BigInt-Filterwerte
    if (Number.isNaN(numberValue) || numberValue > Number.MAX_SAFE_INTEGER) {
      return filter.value;
    }
    return Number(filter.value);
  }
  
  return filter.value;
}

/**
 * Prüft, ob eine Spalte numerisch ist
 * @param {string} format - Spaltenformat
 * @returns {boolean}
 */
export function isNumericalColumn(format) {
  if (!format) return false;
  
  const numericalFormats = [
    'int2',
    'int4',
    'int8',
    'float4',
    'float8',
    'numeric',
    'decimal',
    'integer',
    'bigint',
    'smallint',
    'real',
    'double precision',
  ];
  
  return numericalFormats.includes(format.toLowerCase());
}

/**
 * Extrahiert Primärschlüssel aus einer Tabelle
 * @param {Object} table - Tabellenentität
 * @returns {Object} { primaryKeys: string[], error?: Object }
 */
export function getPrimaryKeys({ table }) {
  // Prüfe, ob es sich um eine Tabelle handelt
  if (!table || !isTableLike(table)) {
    return {
      error: { message: 'Nur Tabellenzeilen können aktualisiert oder gelöscht werden' },
    };
  }

  const pkColumns = table.primary_keys;
  
  if (!pkColumns || pkColumns.length === 0) {
    return {
      error: { 
        message: 'Bitte fügen Sie einen Primärschlüssel hinzu, um Zeilen zu aktualisieren oder zu löschen' 
      },
    };
  }
  
  return { 
    primaryKeys: pkColumns.map((x) => x.name) 
  };
}

/**
 * Prüft, ob ein Entity eine Tabelle ist
 * @param {Object} entity - Entity-Objekt
 * @returns {boolean}
 */
export function isTableLike(entity) {
  return entity && entity.type === 'table' || (entity?.routes && entity?.routes?.rowsRead);
}

/**
 * Konvertiert Tabellenmetadaten in lesbares Format
 * @param {Object} entity - Tabellenentität
 * @returns {Object} Konvertierte Tabelle
 */
export function parseSupaTable(entity) {
  if (!entity) return null;
  
  return {
    id: entity.id,
    name: entity.name,
    schema: entity.schema,
    columns: entity.columns || [],
    primary_keys: entity.primary_keys || [],
    relationships: entity.relationships || [],
  };
}

/**
 * Validiert Zeilendaten gegen Tabellenspezifikation
 * @param {Object} row - Zeilendaten
 * @param {Object} table - Tabellenspezifikation
 * @returns {Object} { isValid: boolean, errors?: string[] }
 */
export function validateRowData(row, table) {
  const errors = [];
  
  if (!row || typeof row !== 'object') {
    errors.push('Zeilendaten müssen ein Objekt sein');
    return { isValid: false, errors };
  }
  
  if (!table?.columns || !Array.isArray(table.columns)) {
    errors.push('Ungültige Tabellenspezifikation');
    return { isValid: false, errors };
  }
  
  // Validiere erforderliche Spalten
  for (const column of table.columns) {
    if (column.is_nullable === false && !(column.name in row)) {
      errors.push(`Spalte '${column.name}' ist erforderlich`);
    }
  }
  
  return { 
    isValid: errors.length === 0, 
    errors: errors.length > 0 ? errors : undefined 
  };
}

/**
 * Konvertiert Filter in SQL WHERE-Klausel Format
 * @param {Array} filters - Array von Filtern
 * @returns {string} SQL-Fragment
 */
export function buildWhereClause(filters) {
  if (!filters || filters.length === 0) return '';
  
  return filters
    .filter((f) => f.value !== '' && f.value !== null && f.value !== undefined)
    .map((f) => {
      const operator = mapOperator(f.operator);
      const value = formatFilterValue({ columns: [] }, f);
      return `${f.column} ${operator} ${escapeValue(value)}`;
    })
    .join(' AND ');
}

/**
 * Mapped Filteropetatoren auf SQL-Operatoren
 * @param {string} operator - Filteroperator
 * @returns {string} SQL-Operator
 */
function mapOperator(operator) {
  const operatorMap = {
    'eq': '=',
    'neq': '!=',
    'lt': '<',
    'lte': '<=',
    'gt': '>',
    'gte': '>=',
    'like': 'LIKE',
    'in': 'IN',
    'is': 'IS',
  };
  
  return operatorMap[operator] || '=';
}

/**
 * Escapt Werte für SQL-Verwendung
 * @param {*} value - Wert zum Escapen
 * @returns {string} Gescapeter Wert
 */
export function escapeValue(value) {
  if (value === null || value === undefined) {
    return 'NULL';
  }
  
  if (typeof value === 'number') {
    return String(value);
  }
  
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  
  if (typeof value === 'string') {
    return `'${value.replace(/'/g, "''")}'`;
  }
  
  if (Array.isArray(value)) {
    return '(' + value.map(escapeValue).join(', ') + ')';
  }
  
  return `'${String(value).replace(/'/g, "''")}'`;
}

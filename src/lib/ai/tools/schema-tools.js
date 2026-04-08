/**
 * 🛠️ Kynto AI - Database Schema Tools & Execution
 * Ermöglicht der KI echte Datenbankabfragen auszuführen
 * 
 * WICHTIG: Execution Tools geben der KI echte Daten zur Analyse!
 */

// ============================================================================
// 🚀 EXECUTION TOOLS - ECHTE DATENBANKABFRAGEN!
// ============================================================================

/**
 * 🚀 Execute Query - Die KI führt ECHTE SQL aus!
 * CRITICAL: Die KI soll das nutzen statt nur SQL-Beispiele zu generieren
 */
export function createExecuteQueryTool(state) {
  return {
    name: 'execute_query',
    description: 'Führe ECHTE SQL-Abfrage aus. Nutze das für konkrete Analysen statt Theorie!',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Die SQL-Abfrage (mit gequoteten Identifiers!)',
        },
      },
      required: ['query'],
    },
    execute: async ({ query }) => {
      if (typeof window !== 'undefined' && window.api) {
        try {
          let result;
          if (state.dbMode === 'remote') {
            result = await window.api.execSQL(query, 'remote');
          } else {
            result = await window.api.pgExec(state.pgId, query);
          }
          return formatQueryResult(result, query);
        } catch (err) {
          return `❌ SQL Error: ${err.message}`;
        }
      }
      return '❌ Keine Datenbank-Verbindung';
    },
  };
}

/**
 * 📊 Table Stats - Live-Statistiken
 */
export function createTableStatsTool(state) {
  return {
    name: 'get_table_stats',
    description: 'Hole LIVE Statistiken: MAX, MIN, AVG, COUNT',
    inputSchema: {
      type: 'object',
      properties: {
        table: {
          type: 'string',
          description: 'Tabellen-Name',
        },
        column: {
          type: 'string',
          description: 'Spalten-Name für Statistiken',
        },
      },
      required: ['table', 'column'],
    },
    execute: async ({ table, column }) => {
      if (typeof window !== 'undefined' && window.api) {
        try {
          const query = `
            SELECT 
              COUNT(*) as "Anzahl",
              MAX("${column}") as "Maximum",
              MIN("${column}") as "Minimum",
              AVG("${column}") as "Durchschnitt"
            FROM "${table}"
          `;
          
          let result;
          if (state.dbMode === 'remote') {
            result = await window.api.execSQL(query, 'remote');
          } else {
            result = await window.api.pgExec(state.pgId, query);
          }
          return formatStats(result, table, column);
        } catch (err) {
          return `❌ Fehler: ${err.message}`;
        }
      }
      return '❌ Keine Datenbank-Verbindung';
    },
  };
}

/**
 * 📋 Sample Data - Echte Beispieldaten laden
 */
export function createTableSampleTool(state) {
  return {
    name: 'get_table_sample',
    description: 'Lade echte Beispieldaten (erste 10 Zeilen)',
    inputSchema: {
      type: 'object',
      properties: {
        table: {
          type: 'string',
          description: 'Tabellen-Name',
        },
        limit: {
          type: 'number',
          description: 'Anzahl Zeilen (max 100)',
          default: 10,
        },
      },
      required: ['table'],
    },
    execute: async ({ table, limit = 10 }) => {
      if (typeof window !== 'undefined' && window.api) {
        try {
          const query = `SELECT * FROM "${table}" LIMIT ${Math.min(limit, 100)}`;
          
          let result;
          if (state.dbMode === 'remote') {
            result = await window.api.execSQL(query, 'remote');
          } else {
            result = await window.api.pgExec(state.pgId, query);
          }
          return formatSample(result, table);
        } catch (err) {
          return `❌ Fehler: ${err.message}`;
        }
      }
      return '❌ Keine Datenbank-Verbindung';
    },
  };
}

// ============================================================================
// 📚 SCHEMA TOOLS
// ============================================================================

export function createListTablesTool(state) {
  return {
    name: 'list_tables',
    description: 'Zeige alle Tabellen',
    inputSchema: { type: 'object', properties: {}, required: [] },
    execute: async () => {
      const tables = Object.keys(state.knownColumns || {});
      if (tables.length === 0) return '⚠️ Keine Tabellen';
      return `📦 Tabellen:\n${tables.map(t => `• ${t}`).join('\n')}`;
    },
  };
}

export function createTableColumnsTool(state) {
  return {
    name: 'get_columns',
    description: 'Spalten einer Tabelle',
    inputSchema: {
      type: 'object',
      properties: { table: { type: 'string' } },
      required: ['table'],
    },
    execute: async ({ table }) => {
      const cols = state.knownColumns?.[table];
      if (!cols) return `❌ "${table}" nicht gefunden`;
      return `📋 "${table}" Spalten:\n${cols.map(c => `• ${c}`).join('\n')}`;
    },
  };
}

export function createSchemaInspectorTool(state) {
  return {
    name: 'inspect_schema',
    description: 'Inspiziere eine Tabelle',
    inputSchema: {
      type: 'object',
      properties: { table: { type: 'string' } },
      required: ['table'],
    },
    execute: async ({ table }) => {
      const cols = state.knownColumns?.[table];
      if (!cols) return `❌ "${table}" nicht gefunden`;
      return `📊 **${table}**\n• Spalten: ${cols.length}\n${cols.map(c => `  - ${c}`).join('\n')}`;
    },
  };
}

// ============================================================================
// 🎯 ALLE TOOLS REGISTRIEREN
// ============================================================================

export function getAvailableTools(state) {
  return {
    // 🚀 EXECUTION (WICHTIG!)
    execute_query: createExecuteQueryTool(state),
    get_table_stats: createTableStatsTool(state),
    get_table_sample: createTableSampleTool(state),
    
    // 📚 SCHEMA
    list_tables: createListTablesTool(state),
    get_columns: createTableColumnsTool(state),
    inspect_schema: createSchemaInspectorTool(state),
  };
}

// ============================================================================
// 🎨 FORMATTER
// ============================================================================

function formatQueryResult(result, query) {
  if (!result) return '⚠️ Keine Resultate';
  const rows = Array.isArray(result) ? result : [result];
  if (rows.length === 0) return '📊 0 Zeilen';
  
  const keys = Object.keys(rows[0]);
  if (rows.length === 1 && keys.length <= 3) {
    return `✅ **Ergebnis:**\n${keys.map(k => `• **${k}**: ${rows[0][k]}`).join('\n')}`;
  }
  
  const header = `| ${keys.map(k => k.slice(0, 10)).join(' | ')} |`;
  const sep = `| ${keys.map(() => '---').join(' | ')} |`;
  const rows_str = rows.slice(0, 10).map(r => 
    `| ${keys.map(k => String(r[k] ?? '').slice(0, 10)).join(' | ')} |`
  ).join('\n');
  
  return `✅ **${rows.length} Zeilen:**\n${header}\n${sep}\n${rows_str}`;
}

function formatStats(result, table, column) {
  if (!result?.[0]) return '❌ Fehler';
  const s = result[0];
  return `📊 **Statistiken "${column}"**
• **Anzahl:** ${s.Anzahl}
• **Maximum:** ${s.Maximum}
• **Minimum:** ${s.Minimum}
• **Durchschnitt:** ${Number(s.Durchschnitt || 0).toFixed(2)}`;
}

function formatSample(result, table) {
  if (!result || result.length === 0) return `⚠️ Keine Daten in "${table}"`;
  const rows = Array.isArray(result) ? result : [result];
  const keys = Object.keys(rows[0]);
  
  const header = `| ${keys.map(k => k.slice(0, 10)).join(' | ')} |`;
  const sep = `| ${keys.map(() => '---').join(' | ')} |`;
  const rows_str = rows.slice(0, 10).map(r =>
    `| ${keys.map(k => String(r[k] ?? '').slice(0, 10)).join(' | ')} |`
  ).join('\n');
  
  return `📋 **"${table}" (${rows.length} Zeilen)**\n${header}\n${sep}\n${rows_str}`;
}

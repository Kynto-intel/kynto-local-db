/**
 * Kynto AI Tools - Main Export
 * WICHTIG: Execution Tools damit die KI echte Daten analysieren kann!
 */

export {
  // 🚀 EXECUTION TOOLS (WICHTIG!)
  createExecuteQueryTool,
  createTableStatsTool,
  createTableSampleTool,
  
  // 📚 SCHEMA TOOLS
  createSchemaInspectorTool,
  createListTablesTool,
  createTableColumnsTool,
  
  // 🎯 REGISTRY
  getAvailableTools,
} from './schema-tools.js';

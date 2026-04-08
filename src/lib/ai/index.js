/**
 * Kynto AI Library - Main Export
 * 
 * Nutze diese Exports in:
 * - editor.js (Inline-Widget)
 * - ai.js (Sidebar)
 * - autres Unterstützungs-Dateien
 */

// 🛠️ Utility-Funktionen
export {
  fixSqlBackslashEscapes,
  normalizeSQLIdentifiers,
  extractSQLFromResponse,
  cleanupSQL,
  isSQLCode,
} from './util.js';

// 📝 Prompt-Konstruktion
export {
  KYNTO_GENERAL_PROMPT,
  KYNTO_SQL_QUERY_PROMPT,
  KYNTO_CHAT_PROMPT,
  KYNTO_LIMITATIONS_PROMPT,
  KYNTO_SECURITY_PROMPT,
  buildSystemPrompt,
  generateDatabaseContext,
} from './prompts.js';

// 🎯 Response-Generierung
export {
  generateAssistantResponse,
  buildAIResponseProcessor,
  createAIHelper,
} from './generate-response.js';

// 🧩 Tools
export { getAvailableTools, createSchemaInspectorTool } from './tools/index.js';

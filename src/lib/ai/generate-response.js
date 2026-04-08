/**
 * Kynto AI - Generate Assistant Response
 * Basierend auf Supabase generate-assistant-response Pattern
 * 
 * Haupt-Koordinator für AI-Responses mit:
 * - Kontext-Verwaltung (Messages, Schema)
 * - Tool-Integration
 * - System-Prompt-Konstruktion
 * - Response-Säuberung
 */

import { buildSystemPrompt, generateDatabaseContext } from './prompts.js';
import { extractSQLFromResponse, cleanupSQL, isSQLCode } from './util.js';
import { getAvailableTools } from './tools/index.js';

/**
 * 🎯 Hauptfunktion: Generiere eine KI-Assistenten-Antwort
 * 
 * @param {Object} options - Konfiguration
 * @returns {Promise<string>} Die verarbeitete KI-Antwort
 */
export async function generateAssistantResponse({
  prompt,
  mode = 'chat', // 'query' | 'chat' | 'analysis'
  state,
  aiCompletion, // Funktion um KI-Response zu erhalten
  forceQueryMode = false,
}) {
  try {
    // 1. Konstruiere System-Prompt
    const dbContext = generateDatabaseContext(state);
    const useMode = forceQueryMode ? 'query' : mode;
    const systemPrompt = buildSystemPrompt(useMode, dbContext);

    console.log('[AI] Generate Response', {
      mode: useMode,
      hasContext: !!dbContext,
      promptLength: prompt?.length,
    });

    // 2. Rufe KI auf
    const rawResponse = await aiCompletion(prompt, forceQueryMode);

    // 3. Verarbeite Response basierend auf Modus
    const processed = await processResponse(rawResponse, useMode, state);

    return processed;
  } catch (err) {
    console.error('[AI] Error generating response:', err);
    throw err;
  }
}

/**
 * 🔄 Verarbeite die KI-Antwort basierend auf Modus
 */
async function processResponse(response, mode, state) {
  if (!response) return '';

  const result = {
    raw: response,
    text: response,
    sql: null,
    isSql: false,
  };

  // 1. Extrahiere SQL falls vorhanden
  if (response.includes('```sql') || response.includes('SELECT ')) {
    const sql = extractSQLFromResponse(response);
    if (isSQLCode(sql)) {
      result.sql = cleanupSQL(sql);
      result.isSql = true;

      console.log('[AI] Detected SQL:', {
        sqlLength: result.sql.length,
        hasQuotedIdentifiers: result.sql.includes('"'),
      });
    }
  }

  // 2. Bei Query-Mode: Validiere dass SQL generiert wurde
  if (mode === 'query' && !result.isSql) {
    console.warn('[AI] Query mode but no SQL detected');
  }

  return result;
}

/**
 * 🧩 Builder-Funktion für AI-Text
 * Nutze mit dem ursprünglichen ai.js getAICompletion()
 */
export async function buildAIResponseProcessor(state) {
  return {
    async generate(prompt, forceQueryMode = false) {
      // Importiere die ursprüngliche getAICompletion aus ai.js
      const { getAICompletion } = await import('../../../renderer/modules/ai.js');

      const response = await getAICompletion(prompt, forceQueryMode);
      const processed = await processResponse(
        response,
        forceQueryMode ? 'query' : 'chat',
        state
      );

      return processed;
    },

    /**
     * Extrahiere nur den SQL-Teil
     */
    extractSQL(response) {
      if (typeof response === 'string') {
        return cleanupSQL(extractSQLFromResponse(response));
      }
      return response?.sql || '';
    },

    /**
     * Hole verfügbare Tools für diese Session
     */
    getTools() {
      return getAvailableTools(state);
    },
  };
}

/**
 * 📊 Factory-Funktion zum Erstellen eines AI-Helpers
 * Nutzen im editor.js oder InlineWidget.js
 */
export async function createAIHelper(state) {
  const processor = await buildAIResponseProcessor(state);

  return {
    /**
     * Generiere SQL-Query
     */
    async generateSQL(prompt) {
      const response = await processor.generate(prompt, true);
      return processor.extractSQL(response.raw);
    },

    /**
     * Generiere Analyse-Response
     */
    async generateAnalysis(prompt) {
      return processor.generate(prompt, false);
    },

    /**
     * Verarbeite beliebige Prompt
     */
    async process(prompt, mode = 'chat') {
      const response = await processor.generate(prompt, mode === 'query');
      return response;
    },

    /**
     * Hole Schema-Info
     */
    getSchema() {
      return generateDatabaseContext(state);
    },

    /**
     * Hole verfügbare Tools
     */
    getTools() {
      return processor.getTools();
    },
  };
}

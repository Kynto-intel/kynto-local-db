/**
 * 🤖 AI Handler with Tool-Calling System + Web Agent
 *
 * NEU: Web-Tools integriert!
 * - fetch_webpage: Lese eine Webseite
 * - search_web: Suche im Web
 * - search_and_read: Suche + erste Seite direkt lesen
 *
 * Architecture:
 * 1. Nutzer sendet Anfrage + SystemPrompt
 * 2. KI antwortet (möglicherweise mit Tool-Call)
 * 3. Wenn Tool-Call erkannt → ausführen
 * 4. Ergebnis zurück zur KI (Loop)
 * 5. Final Response an Nutzer
 */

const https = require('https');
const http = require('http');
const databaseEngine = require('../database-engine');
const webTools = require('../../lib/ai/web-tools');
const { runRecipeJob, cancelJob, getJobStatus, buildAntiHallucinationPrompt } = require('../../lib/ai/recipe-engine');

// ============================================================================
// 🛠️ DB TOOLS (unverändert)
// ============================================================================

async function toolExecuteQuery(params, dbMode, pgId) {
  if (!params.query) return { error: 'Keine Query angegeben' };
  try {
    const sql = params.query;
    console.log('[Tool] execute_query:', sql.substring(0, 100));
    let result;
    if (dbMode === 'remote') {
      result = await databaseEngine.executeQuery(sql, [], 'remote');
    } else {
      result = await databaseEngine.executeQuery(sql, [], 'local', pgId);
    }
    return { success: true, rows: Array.isArray(result) ? result : [result], count: Array.isArray(result) ? result.length : 1 };
  } catch (err) {
    return { error: `Query Error: ${err.message}` };
  }
}

async function toolGetStats(params, dbMode, pgId) {
  if (!params.table || !params.column) return { error: 'table und column erforderlich' };
  try {
    const query = `SELECT COUNT(*) as "Anzahl", MAX("${params.column}") as "Maximum", MIN("${params.column}") as "Minimum", AVG("${params.column}") as "Durchschnitt" FROM "${params.table}"`;
    let result;
    if (dbMode === 'remote') {
      result = await databaseEngine.executeQuery(query, [], 'remote');
    } else {
      result = await databaseEngine.executeQuery(query, [], 'local', pgId);
    }
    const stats = result[0];
    return { success: true, stats: { table: params.table, column: params.column, count: stats.Anzahl, max: stats.Maximum, min: stats.Minimum, avg: stats.Durchschnitt } };
  } catch (err) {
    return { error: `Stats Error: ${err.message}` };
  }
}

async function toolGetSample(params, dbMode, pgId) {
  if (!params.table) return { error: 'table erforderlich' };
  try {
    const limit = Math.min(params.limit || 10, 100);
    const query = `SELECT * FROM "${params.table}" LIMIT ${limit}`;
    let result;
    if (dbMode === 'remote') {
      result = await databaseEngine.executeQuery(query, [], 'remote');
    } else {
      result = await databaseEngine.executeQuery(query, [], 'local', pgId);
    }
    return { success: true, table: params.table, rows: Array.isArray(result) ? result : [result], count: Array.isArray(result) ? result.length : 1 };
  } catch (err) {
    return { error: `Sample Error: ${err.message}` };
  }
}

async function toolDeleteRows(params, dbMode, pgId) {
  if (!params.table || !params.whereClause) return { error: 'table und whereClause erforderlich' };
  try {
    const query = `DELETE FROM "${params.table}" WHERE ${params.whereClause}`;
    await databaseEngine.executeQuery(query, [], dbMode === 'remote' ? 'remote' : 'local', pgId);
    return { success: true, message: `Gelöschte Zeilen: ${params.table}`, whereClause: params.whereClause };
  } catch (err) {
    return { error: `Delete Error: ${err.message}` };
  }
}

async function toolUpdateRows(params, dbMode, pgId) {
  if (!params.table || !params.setClause || !params.whereClause) return { error: 'table, setClause und whereClause erforderlich' };
  try {
    const query = `UPDATE "${params.table}" SET ${params.setClause} WHERE ${params.whereClause}`;
    await databaseEngine.executeQuery(query, [], dbMode === 'remote' ? 'remote' : 'local', pgId);
    return { success: true, message: `Aktualisierte Zeilen in: ${params.table}`, setClauses: params.setClause, whereClause: params.whereClause };
  } catch (err) {
    return { error: `Update Error: ${err.message}` };
  }
}

async function toolInsertRows(params, dbMode, pgId) {
  if (!params.table || !params.columns || !params.values) return { error: 'table, columns und values erforderlich' };
  try {
    const cols = params.columns.map(c => `"${c}"`).join(', ');
    const valuesStr = Array.isArray(params.values[0])
      ? params.values.map(row => `(${row.map(v => typeof v === 'string' ? `'${v.replace(/'/g, "''")}'` : v).join(', ')})`).join(', ')
      : `(${params.values.map(v => typeof v === 'string' ? `'${v.replace(/'/g, "''")}'` : v).join(', ')})`;
    const query = `INSERT INTO "${params.table}" (${cols}) VALUES ${valuesStr}`;
    await databaseEngine.executeQuery(query, [], dbMode === 'remote' ? 'remote' : 'local', pgId);
    return { success: true, message: `Eingefügt in: ${params.table}`, rowCount: Array.isArray(params.values[0]) ? params.values.length : 1 };
  } catch (err) {
    return { error: `Insert Error: ${err.message}` };
  }
}

// ============================================================================
// 🔧 TOOL-CALLING LOGIC (mit Web-Tools!)
// ============================================================================

/**
 * Erkenne Tool-Calls in der KI-Antwort
 * Unterstützt jetzt auch Web-Tools
 */
function parseToolCall(text) {
  if (!text) return null;

  const allTools = [
    'execute_query', 'get_table_stats', 'get_table_sample',
    'update_rows', 'insert_rows', 'delete_rows',
    // 🌐 NEU: Web-Tools
    'fetch_webpage', 'search_web', 'search_and_read',
  ];

  // Format 1: "tool_name: params"
  const toolPattern = allTools.join('|');
  const simpleMatch = text.match(new RegExp(`^(${toolPattern}):\\s*(.+)$`, 'm'));

  if (simpleMatch) {
    const toolName = simpleMatch[1];
    const content = simpleMatch[2].trim();

    // DB Tools (bestehend)
    if (toolName === 'execute_query') {
      return { tool: toolName, params: { query: content } };
    }
    if (toolName === 'get_table_stats') {
      const tableMatch = content.match(/table=([^,]+)/);
      const columnMatch = content.match(/column=(.+)$/);
      if (tableMatch && columnMatch) {
        return { tool: toolName, params: { table: tableMatch[1].trim(), column: columnMatch[1].trim() } };
      }
    }
    if (toolName === 'get_table_sample') {
      const tableMatch = content.match(/table=([^,]+)/);
      const limitMatch = content.match(/limit=(\d+)/);
      if (tableMatch) {
        return { tool: toolName, params: { table: tableMatch[1].trim(), limit: limitMatch ? parseInt(limitMatch[1]) : 10 } };
      }
    }
    if (toolName === 'update_rows') {
      const tableMatch = content.match(/table=([^,]+)/);
      const setMatch = content.match(/set=(.+?(?=,\s*where=|$))/);
      const whereMatch = content.match(/where=(.+)$/);
      if (tableMatch && setMatch && whereMatch) {
        return { tool: toolName, params: { table: tableMatch[1].trim(), setClause: setMatch[1].trim(), whereClause: whereMatch[1].trim() } };
      }
    }
    if (toolName === 'insert_rows') {
      const tableMatch = content.match(/table=([^,]+)/);
      const columnsMatch = content.match(/columns=([^,]+)/);
      const valuesMatch = content.match(/values=(.+)$/);
      if (tableMatch && columnsMatch && valuesMatch) {
        return { tool: toolName, params: { table: tableMatch[1].trim(), columns: columnsMatch[1].trim().split('|'), values: valuesMatch[1].trim().split('|') } };
      }
    }
    if (toolName === 'delete_rows') {
      const tableMatch = content.match(/table=([^,]+)/);
      const whereMatch = content.match(/where=(.+)$/);
      if (tableMatch && whereMatch) {
        return { tool: toolName, params: { table: tableMatch[1].trim(), whereClause: whereMatch[1].trim() } };
      }
    }

    // 🌐 NEU: Web-Tools
    if (toolName === 'fetch_webpage') {
      // fetch_webpage: url=https://example.com, keywords=CEO|Gründer
      const urlMatch = content.match(/url=([^\s,]+)/);
      const kwMatch = content.match(/keywords=([^\s,]+(?:\|[^\s,]+)*)/);
      if (urlMatch) {
        return {
          tool: toolName,
          params: {
            url: urlMatch[1].trim(),
            keywords: kwMatch ? kwMatch[1].split('|') : [],
          },
        };
      }
      // Alternativ: direkte URL
      if (content.startsWith('http')) {
        return { tool: toolName, params: { url: content } };
      }
    }

    if (toolName === 'search_web') {
      // search_web: Wetter Berlin heute
      return { tool: toolName, params: { query: content } };
    }

    if (toolName === 'search_and_read') {
      // search_and_read: query=CEO von SAP, keywords=CEO|Vorstand
      const queryMatch = content.match(/query=(.+?)(?=,\s*keywords=|$)/);
      const kwMatch = content.match(/keywords=(.+)$/);
      if (queryMatch) {
        return {
          tool: toolName,
          params: {
            query: queryMatch[1].trim(),
            keywords: kwMatch ? kwMatch[1].split('|') : [],
          },
        };
      }
      // Alternativ: direkt als Query
      return { tool: toolName, params: { query: content } };
    }
  }

  // Format 2: JSON
  try {
    const jsonMatch = text.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/);
    if (jsonMatch) {
      const toolCall = JSON.parse(jsonMatch[0]);
      if (toolCall.tool && allTools.includes(toolCall.tool)) {
        return toolCall;
      }
    }
  } catch (_) {}

  return null;
}

/**
 * Tool ausführen (DB + Web)
 */
async function executeTool(toolCall, dbMode, pgId) {
  const toolName = toolCall.tool;
  const params = toolCall.params || {};

  try {
    switch (toolName) {
      // DB Tools
      case 'execute_query': return await toolExecuteQuery(params, dbMode, pgId);
      case 'get_table_stats': return await toolGetStats(params, dbMode, pgId);
      case 'get_table_sample': return await toolGetSample(params, dbMode, pgId);
      case 'update_rows': return await toolUpdateRows(params, dbMode, pgId);
      case 'insert_rows': return await toolInsertRows(params, dbMode, pgId);
      case 'delete_rows': return await toolDeleteRows(params, dbMode, pgId);

      // 🌐 NEU: Web Tools
      case 'fetch_webpage': return await webTools.toolFetchWebpage(params);
      case 'search_web': return await webTools.toolSearchWeb(params);
      case 'search_and_read': return await webTools.toolSearchAndRead(params);

      default: return { error: `Tool nicht bekannt: ${toolName}` };
    }
  } catch (err) {
    return { error: `Tool Error: ${err.message}` };
  }
}

// ============================================================================
// 📡 OLLAMA & ANTHROPIC API
// ============================================================================

function callOllamaAPI(endpoint, model, messages, temperature = 0.1) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${endpoint}/api/chat`);
    const isHttps = url.protocol === 'https:';
    const client = isHttps ? https : http;

    const payload = JSON.stringify({
      model,
      messages,
      stream: false,
      options: {
        temperature, // 🛡️ Niedrige Temperatur → weniger Halluzinationen
        num_ctx: 4096,
      },
    });

    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
      timeout: 120000,
    };

    const req = (isHttps ? https : http).request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          if (res.statusCode !== 200) {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
            return;
          }
          const response = JSON.parse(data);
          resolve(response.message?.content || response.response || '');
        } catch (err) {
          reject(new Error(`Parse Error: ${err.message}`));
        }
      });
    });

    req.on('error', (err) => reject(new Error(`Request Error: ${err.message}`)));
    req.on('timeout', () => { req.destroy(); reject(new Error('Request Timeout')); });
    req.write(payload);
    req.end();
  });
}

async function callAnthropicAPI(apiKey, model, messages, systemPrompt, temperature = 0.1) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      model: model || 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      temperature,
      system: systemPrompt,
      messages: messages.filter(m => m.role !== 'system'),
    });

    const options = {
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(payload),
      },
      timeout: 60000,
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (res.statusCode !== 200) {
            reject(new Error(`Anthropic API Fehler: ${response.error?.message || data}`));
            return;
          }
          resolve(response.content?.[0]?.text || '');
        } catch (err) {
          reject(new Error(`Parse Error: ${err.message}`));
        }
      });
    });

    req.on('error', (err) => reject(new Error(`Request Error: ${err.message}`)));
    req.on('timeout', () => { req.destroy(); reject(new Error('Request Timeout')); });
    req.write(payload);
    req.end();
  });
}

// ============================================================================
// 🤖 MAIN AI HANDLER mit Web-Tool Loop
// ============================================================================

async function aiGenerateHandler(event, payload) {
  try {
    const {
      provider,
      model,
      prompt,
      systemPrompt,
      endpoint,
      apiKey,
      dbMode,
      pgId,
      temperature = 0.1, // 🛡️ Standard: niedrig für mehr Präzision
    } = payload;

    console.log('[AI] Generate Request:', {
      provider,
      model,
      prompt: prompt.substring(0, 100),
      dbMode,
      pgId,
      temperature,
    });

    // ========================================================================
    // 🔄 TOOL-CALLING LOOP
    // ========================================================================

    let messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt },
    ];

    let maxIterations = 6; // Web-Calls brauchen manchmal mehr Iterationen
    let iteration = 0;
    let finalResponse = '';

    while (iteration < maxIterations) {
      iteration++;
      console.log(`[AI] Iteration ${iteration}/${maxIterations}`);

      // KI aufrufen
      let aiResponse;
      if (provider === 'anthropic') {
        aiResponse = await callAnthropicAPI(apiKey, model, messages, systemPrompt, temperature);
      } else {
        // Ollama (default)
        if (!endpoint || !model) {
          return JSON.stringify({ error: 'Endpoint und Model erforderlich' });
        }
        aiResponse = await callOllamaAPI(endpoint, model, messages, temperature);
      }

      console.log('[AI] Response:', aiResponse.substring(0, 200));

      // Tool-Call erkennen?
      const toolCall = parseToolCall(aiResponse);

      if (toolCall) {
        console.log('[Tool] Erkannt:', toolCall.tool);

        // Tool ausführen
        const toolResult = await executeTool(toolCall, dbMode, pgId);
        console.log('[Tool] Result:', JSON.stringify(toolResult).substring(0, 300));

        // Log für Frontend
        const logMsg = toolCall.tool.startsWith('fetch_') || toolCall.tool.startsWith('search_')
          ? `🌐 Web-Tool "${toolCall.tool}": ${JSON.stringify(toolCall.params).substring(0, 80)}`
          : `🔧 Tool "${toolCall.tool}"`;

        console.log(`[AI] ${logMsg}`);

        // Tool-Result in Conversation
        messages.push({ role: 'assistant', content: aiResponse });
        messages.push({
          role: 'user',
          content: `Tool "${toolCall.tool}" Ergebnis:\n${JSON.stringify(toolResult, null, 2).substring(0, 3000)}`,
        });
      } else {
        // Keine Tool-Calls → Final Response
        finalResponse = aiResponse;
        break;
      }
    }

    if (!finalResponse) {
      finalResponse = '⚠️ Zu viele Tool-Aufrufe, abgebrochen';
    }

    console.log('[AI] Final Response:', finalResponse.substring(0, 200));
    return finalResponse;

  } catch (err) {
    console.error('[AI] Error:', err);
    return JSON.stringify({ error: `AI Error: ${err.message}` });
  }
}

// ============================================================================
// 🍳 RECIPE JOB HANDLER (für IPC)
// ============================================================================

/**
 * Starte einen Recipe-Job über IPC
 */
async function recipeJobHandler(event, payload) {
  const { recipe, pgId, dbMode, ollamaEndpoint, ollamaModel, apiKey, provider, dryRun, maxRows } = payload;

  // AI-Call Funktion
  const aiCallFn = async (systemPrompt, userPrompt) => {
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    if (provider === 'anthropic') {
      return await callAnthropicAPI(apiKey, null, messages, systemPrompt, 0.0);
    } else {
      return await callOllamaAPI(ollamaEndpoint, ollamaModel, messages, 0.0);
    }
  };

  return await runRecipeJob({
    recipe,
    pgId,
    dbMode,
    aiCallFn,
    webTools,
    dryRun: dryRun !== false,
    maxRows: maxRows || 10,
    onProgress: (progress) => {
      // Sende Fortschritt an Renderer via IPC
      if (event?.sender && !event.sender.isDestroyed()) {
        event.sender.send('recipe-job-progress', progress);
      }
    },
  });
}

/**
 * Brich einen Recipe-Job ab
 */
function recipeCancelHandler(event, payload) {
  const { jobId } = payload;
  const success = cancelJob(jobId);
  return { success };
}

// ============================================================================
// ✅ EXPORTS
// ============================================================================

module.exports = {
  aiGenerateHandler,
  recipeJobHandler,
  recipeCancelHandler,
  parseToolCall,
  executeTool,
  callOllamaAPI,
  callAnthropicAPI,

  // DB Tools
  toolExecuteQuery,
  toolGetStats,
  toolGetSample,
  toolUpdateRows,
  toolInsertRows,
  toolDeleteRows,
};
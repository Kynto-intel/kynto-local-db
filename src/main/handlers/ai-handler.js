/**
 * 🤖 AI Handler with Tool-Calling System
 * Die KI hat direkten Zugriff auf Datenbankabfragen via Tools!
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

// ============================================================================
// 🛠️ TOOLS - Die KI kann damit auf echte Daten zugreifen
// ============================================================================

/**
 * 🚀 Execute Query Tool - Echte SQL ausführen
 */
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
    
    return {
      success: true,
      rows: Array.isArray(result) ? result : [result],
      count: Array.isArray(result) ? result.length : 1,
    };
  } catch (err) {
    return { error: `Query Error: ${err.message}` };
  }
}

/**
 * 📊 Table Stats Tool - Statistiken abrufen
 */
async function toolGetStats(params, dbMode, pgId) {
  if (!params.table || !params.column) {
    return { error: 'table und column erforderlich' };
  }
  
  try {
    const query = `
      SELECT 
        COUNT(*) as "Anzahl",
        MAX("${params.column}") as "Maximum",
        MIN("${params.column}") as "Minimum",
        AVG("${params.column}") as "Durchschnitt"
      FROM "${params.table}"
    `;
    
    console.log('[Tool] get_table_stats:', params.table, params.column);
    
    let result;
    if (dbMode === 'remote') {
      result = await databaseEngine.executeQuery(query, [], 'remote');
    } else {
      result = await databaseEngine.executeQuery(query, [], 'local', pgId);
    }
    
    const stats = result[0];
    return {
      success: true,
      stats: {
        table: params.table,
        column: params.column,
        count: stats.Anzahl,
        max: stats.Maximum,
        min: stats.Minimum,
        avg: stats.Durchschnitt,
      },
    };
  } catch (err) {
    return { error: `Stats Error: ${err.message}` };
  }
}

/**
 * 📋 Sample Data Tool - Beispieldaten laden
 */
async function toolGetSample(params, dbMode, pgId) {
  if (!params.table) return { error: 'table erforderlich' };
  
  try {
    const limit = Math.min(params.limit || 10, 100);
    const query = `SELECT * FROM "${params.table}" LIMIT ${limit}`;
    
    console.log('[Tool] get_table_sample:', params.table, limit);
    
    let result;
    if (dbMode === 'remote') {
      result = await databaseEngine.executeQuery(query, [], 'remote');
    } else {
      result = await databaseEngine.executeQuery(query, [], 'local', pgId);
    }
    
    return {
      success: true,
      table: params.table,
      rows: Array.isArray(result) ? result : [result],
      count: Array.isArray(result) ? result.length : 1,
    };
  } catch (err) {
    return { error: `Sample Error: ${err.message}` };
  }
}

/**
 * ❌ Delete Rows Tool - Zeilen löschen
 */
async function toolDeleteRows(params, dbMode, pgId) {
  if (!params.table || !params.whereClause) {
    return { error: 'table und whereClause erforderlich' };
  }
  
  try {
    const query = `DELETE FROM "${params.table}" WHERE ${params.whereClause}`;
    
    console.log('[Tool] delete_rows:', query.substring(0, 150));
    
    let result;
    if (dbMode === 'remote') {
      result = await databaseEngine.executeQuery(query, [], 'remote');
    } else {
      result = await databaseEngine.executeQuery(query, [], 'local', pgId);
    }
    
    return {
      success: true,
      message: `Gelöschte Zeilen: ${params.table}`,
      whereClause: params.whereClause,
    };
  } catch (err) {
    return { error: `Delete Error: ${err.message}` };
  }
}

/**
 * ✏️ Update Rows Tool - Zeilen aktualisieren
 */
async function toolUpdateRows(params, dbMode, pgId) {
  if (!params.table || !params.setClause || !params.whereClause) {
    return { error: 'table, setClause und whereClause erforderlich' };
  }
  
  try {
    const query = `UPDATE "${params.table}" SET ${params.setClause} WHERE ${params.whereClause}`;
    
    console.log('[Tool] update_rows:', query.substring(0, 200));
    
    let result;
    if (dbMode === 'remote') {
      result = await databaseEngine.executeQuery(query, [], 'remote');
    } else {
      result = await databaseEngine.executeQuery(query, [], 'local', pgId);
    }
    
    return {
      success: true,
      message: `Aktualisierte Zeilen in: ${params.table}`,
      setClauses: params.setClause,
      whereClause: params.whereClause,
    };
  } catch (err) {
    return { error: `Update Error: ${err.message}` };
  }
}

/**
 * ➕ Insert Rows Tool - Neue Zeilen einfügen
 */
async function toolInsertRows(params, dbMode, pgId) {
  if (!params.table || !params.columns || !params.values) {
    return { error: 'table, columns und values erforderlich' };
  }
  
  try {
    // Format: columns = ["col1", "col2"], values = [["val1a", "val2a"], ["val1b", "val2b"]]
    const cols = params.columns.map(c => `"${c}"`).join(', ');
    const valuesStr = Array.isArray(params.values[0])
      ? params.values.map(row => `(${row.map(v => typeof v === 'string' ? `'${v.replace(/'/g, "''")}'` : v).join(', ')})`).join(', ')
      : `(${params.values.map(v => typeof v === 'string' ? `'${v.replace(/'/g, "''")}'` : v).join(', ')})`;
    
    const query = `INSERT INTO "${params.table}" (${cols}) VALUES ${valuesStr}`;
    
    console.log('[Tool] insert_rows:', query.substring(0, 200));
    
    let result;
    if (dbMode === 'remote') {
      result = await databaseEngine.executeQuery(query, [], 'remote');
    } else {
      result = await databaseEngine.executeQuery(query, [], 'local', pgId);
    }
    
    return {
      success: true,
      message: `Eingefügt in: ${params.table}`,
      rowCount: Array.isArray(params.values[0]) ? params.values.length : 1,
    };
  } catch (err) {
    return { error: `Insert Error: ${err.message}` };
  }
}

// ============================================================================
// 🔧 TOOL-CALLING LOGIC
// ============================================================================

/**
 * 🎯 Erkenne Tool-Calls in der KI-Antwort
 * Format: "execute_query: SELECT MAX(...)" oder "{tool: 'name', params: {...}}"
 */
function parseToolCall(text) {
  if (!text) return null;
  
  // Format 1: "tool_name: params"
  const simpleMatch = text.match(/^(execute_query|get_table_stats|get_table_sample|update_rows|insert_rows|delete_rows):\s*(.+)$/m);
  if (simpleMatch) {
    const toolName = simpleMatch[1];
    const content = simpleMatch[2].trim();
    
    if (toolName === 'execute_query') {
      return {
        tool: toolName,
        params: { query: content },
      };
    } else if (toolName === 'get_table_stats') {
      // Parse: "table=allvallhalla_csv, column=Eingänge (EUR)"
      const tableMatch = content.match(/table=([^,]+)/);
      const columnMatch = content.match(/column=(.+)$/);
      if (tableMatch && columnMatch) {
        return {
          tool: toolName,
          params: {
            table: tableMatch[1].trim(),
            column: columnMatch[1].trim(),
          },
        };
      }
    } else if (toolName === 'get_table_sample') {
      const tableMatch = content.match(/table=([^,]+)/);
      const limitMatch = content.match(/limit=(\d+)/);
      if (tableMatch) {
        return {
          tool: toolName,
          params: {
            table: tableMatch[1].trim(),
            limit: limitMatch ? parseInt(limitMatch[1]) : 10,
          },
        };
      }
    } else if (toolName === 'update_rows') {
      // Parse: "table=mytable, set=column1='wert', where=id=5"
      const tableMatch = content.match(/table=([^,]+)/);
      const setMatch = content.match(/set=(.+?(?=,\s*where=|$))/);
      const whereMatch = content.match(/where=(.+)$/);
      if (tableMatch && setMatch && whereMatch) {
        return {
          tool: toolName,
          params: {
            table: tableMatch[1].trim(),
            setClause: setMatch[1].trim(),
            whereClause: whereMatch[1].trim(),
          },
        };
      }
    } else if (toolName === 'insert_rows') {
      // Parse: "table=mytable, columns=col1|col2, values=val1|val2"
      const tableMatch = content.match(/table=([^,]+)/);
      const columnsMatch = content.match(/columns=([^,]+)/);
      const valuesMatch = content.match(/values=(.+)$/);
      if (tableMatch && columnsMatch && valuesMatch) {
        return {
          tool: toolName,
          params: {
            table: tableMatch[1].trim(),
            columns: columnsMatch[1].trim().split('|'),
            values: valuesMatch[1].trim().split('|'),
          },
        };
      }
    } else if (toolName === 'delete_rows') {
      // Parse: "table=mytable, where=status='invalid'"
      const tableMatch = content.match(/table=([^,]+)/);
      const whereMatch = content.match(/where=(.+)$/);
      if (tableMatch && whereMatch) {
        return {
          tool: toolName,
          params: {
            table: tableMatch[1].trim(),
            whereClause: whereMatch[1].trim(),
          },
        };
      }
    }
  }
  
  // Format 2: JSON-ähnlich
  try {
    if (text.includes('execute_query') || text.includes('get_table_stats') || text.includes('get_table_sample') || text.includes('update_rows') || text.includes('insert_rows') || text.includes('delete_rows')) {
      const jsonMatch = text.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/);
      if (jsonMatch) {
        const toolCall = JSON.parse(jsonMatch[0]);
        if (toolCall.tool || toolCall.execute_query || toolCall.get_table_stats || toolCall.get_table_sample || toolCall.update_rows || toolCall.insert_rows || toolCall.delete_rows) {
          return toolCall;
        }
      }
    }
  } catch (e) {
    // Kein gültiges JSON
  }
  
  return null;
}

/**
 * 🔄 Tool ausführen
 */
async function executeTool(toolCall, dbMode, pgId) {
  const toolName = toolCall.tool;
  const params = toolCall.params || {};
  
  try {
    switch (toolName) {
      case 'execute_query':
        return await toolExecuteQuery(params, dbMode, pgId);
      case 'get_table_stats':
        return await toolGetStats(params, dbMode, pgId);
      case 'get_table_sample':
        return await toolGetSample(params, dbMode, pgId);
      case 'update_rows':
        return await toolUpdateRows(params, dbMode, pgId);
      case 'insert_rows':
        return await toolInsertRows(params, dbMode, pgId);
      case 'delete_rows':
        return await toolDeleteRows(params, dbMode, pgId);
      default:
        return { error: `Tool nicht bekannt: ${toolName}` };
    }
  } catch (err) {
    return { error: `Tool Error: ${err.message}` };
  }
}

// ============================================================================
// 🤖 MAIN AI HANDLER mit Tool-Calling Loop
// ============================================================================

/**
 * 🚀 Main AI Generate Handler
 * Vollständige Tool-Calling Integration
 */
async function aiGenerateHandler(event, payload) {
  try {
    const { provider, model, prompt, systemPrompt, endpoint, apiKey, dbMode, pgId } = payload;
    
    console.log('[AI] Generate Request:', {
      provider,
      model,
      prompt: prompt.substring(0, 100),
      dbMode,
      pgId,
    });

    // Nur Ollama implementiert für jetzt
    if (provider !== 'ollama') {
      return JSON.stringify({ error: 'Nur Ollama unterstützt' });
    }

    if (!endpoint || !model) {
      return JSON.stringify({ error: 'Endpoint und Model erforderlich' });
    }

    // ========================================================================
    // 🔄 TOOL-CALLING LOOP
    // ========================================================================
    
    let messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt },
    ];
    
    let maxIterations = 5; // Verhindere infinite loops
    let iteration = 0;
    let finalResponse = '';

    while (iteration < maxIterations) {
      iteration++;
      console.log(`[AI] Iteration ${iteration}/${maxIterations}`);

      // KI aufrufen
      const aiResponse = await callOllamaAPI(endpoint, model, messages);
      console.log('[AI] Response:', aiResponse.substring(0, 200));

      // Tool-Call erkennen?
      const toolCall = parseToolCall(aiResponse);

      if (toolCall) {
        console.log('[Tool] Erkannt:', toolCall.tool);
        
        // Tool ausführen
        const toolResult = await executeTool(toolCall, dbMode, pgId);
        console.log('[Tool] Result:', JSON.stringify(toolResult).substring(0, 200));

        // Response + Tool-Result zur Conversation hinzufügen
        messages.push({ role: 'assistant', content: aiResponse });
        messages.push({
          role: 'user',
          content: `Tool "${toolCall.tool}" Ergebnis: ${JSON.stringify(toolResult)}`,
        });
      } else {
        // Keine Tool-Calls → das ist die Final Response
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
// 📡 OLLAMA API CALL
// ============================================================================

/**
 * Rufe Ollama API auf
 */
function callOllamaAPI(endpoint, model, messages) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${endpoint}/api/chat`);
    const isHttps = url.protocol === 'https:';
    const client = isHttps ? https : http;

    const payload = JSON.stringify({
      model,
      messages,
      stream: false,
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
      timeout: 120000, // 2 Minuten Timeout
    };

    const req = client.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          if (res.statusCode !== 200) {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
            return;
          }

          const response = JSON.parse(data);
          const message = response.message?.content || response.response || '';
          resolve(message);
        } catch (err) {
          reject(new Error(`Parse Error: ${err.message}`));
        }
      });
    });

    req.on('error', (err) => {
      reject(new Error(`Request Error: ${err.message}`));
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request Timeout'));
    });

    req.write(payload);
    req.end();
  });
}

// ============================================================================
// ✅ EXPORTS
// ============================================================================

module.exports = {
  aiGenerateHandler,
  parseToolCall,
  executeTool,
  // Tools einzeln exportieren falls nötig
  toolExecuteQuery,
  toolGetStats,
  toolGetSample,
  toolUpdateRows,
  toolInsertRows,
  toolDeleteRows,
};

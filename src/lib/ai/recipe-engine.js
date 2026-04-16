/**
 * 🍳 Kynto Recipe Engine - Batch KI-Verarbeitung
 *
 * Ein "Rezept" = Master Prompt + Input-Spalten + Output-Spalten + Regeln
 * Die Engine rattert die Datenbank durch und füllt automatisch Spalten.
 *
 * Anti-Halluzinations-System:
 * - Temperature = 0 (deterministisch)
 * - JSON-Format erzwungen
 * - NULL-Regel: "Wenn unbekannt → null"
 * - Validierung vor DB-Schreibung
 * - Draft-Modus: Vorschau vor echtem Schreiben
 */

const databaseEngine = require('../../main/database-engine');

// ============================================================================
// 📋 RECIPE STORE - Rezepte persistent speichern (via SQLite/PGlite)
// ============================================================================

/**
 * Initialisiere die Rezept-Tabelle in der Kynto-Config-DB
 */
async function initRecipeStore(pgId) {
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS "_kynto_recipes" (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      target_table TEXT NOT NULL,
      input_columns TEXT NOT NULL,
      output_columns TEXT NOT NULL,
      master_prompt TEXT NOT NULL,
      source_type TEXT DEFAULT 'column',
      source_config TEXT DEFAULT '{}',
      flags TEXT DEFAULT '{}',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `;
  try {
    await databaseEngine.executeQuery(createTableSQL, [], 'local', pgId);
    console.log('[Recipe] Tabelle initialisiert');
  } catch (err) {
    console.log('[Recipe] Tabelle existiert bereits oder Fehler:', err.message);
  }
}

// ============================================================================
// 🛡️ ANTI-HALLUZINATIONS SYSTEM PROMPT BUILDER
// ============================================================================

/**
 * Erstelle einen Anti-Halluzinations System-Prompt
 * Kombiniert den Master-Prompt des Nutzers mit harten Regeln
 *
 * @param {Object} recipe - Das Rezept
 * @param {string[]} outputColumns - Spaltenname(n) der Ausgabe
 * @returns {string} Fertiger System-Prompt
 */
function buildAntiHallucinationPrompt(recipe, outputColumns) {
  const flags = recipe.flags || {};

  const outputSchema = outputColumns.map(col => `"${col}": "<Wert oder null>"`).join(',\n  ');

  const strictRules = [];

  if (flags.strictFacts !== false) {
    strictRules.push('- Wenn eine Information NICHT im bereitgestellten Text steht, schreibe null (NICHT erfinden!)');
    strictRules.push('- Verwende AUSSCHLIESSLICH Informationen aus dem gegebenen Kontext');
  }

  if (flags.jsonOutput !== false) {
    strictRules.push('- Antworte NUR im JSON-Format, kein anderer Text davor oder danach');
    strictRules.push('- Gib KEINE Erklärungen oder Einleitungen aus');
  }

  if (flags.noBlaBla !== false) {
    strictRules.push('- Kein Fließtext, keine Beschreibungen, nur das JSON-Objekt');
  }

  return `${recipe.masterPrompt || 'Du bist ein Daten-Extraktor.'}

## ABSOLUTE REGELN (NIEMALS BRECHEN):
${strictRules.join('\n')}

## AUSGABE-FORMAT:
Du musst exakt dieses JSON zurückgeben:
\`\`\`json
{
  ${outputSchema}
}
\`\`\`

Nutze null für unbekannte Werte. Erfinde NICHTS.`;
}

// ============================================================================
// 🔧 JSON VALIDATOR - Schützt die Datenbank vor Müll
// ============================================================================

/**
 * Parse und validiere KI-Antwort als JSON
 * Mehrere Fallback-Strategien
 */
function parseAndValidateJSON(responseText, outputColumns) {
  if (!responseText) return { success: false, error: 'Leere Antwort', data: null };

  // Strategie 1: Direktes JSON
  try {
    const parsed = JSON.parse(responseText.trim());
    return { success: true, data: parsed };
  } catch (_) {}

  // Strategie 2: JSON in ```json``` Block
  const jsonBlockMatch = responseText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  if (jsonBlockMatch) {
    try {
      const parsed = JSON.parse(jsonBlockMatch[1]);
      return { success: true, data: parsed };
    } catch (_) {}
  }

  // Strategie 3: Erstes { ... } im Text
  const jsonInlineMatch = responseText.match(/\{[\s\S]*\}/);
  if (jsonInlineMatch) {
    try {
      const parsed = JSON.parse(jsonInlineMatch[0]);
      return { success: true, data: parsed };
    } catch (_) {}
  }

  // Strategie 4: Wenn nur 1 Output-Spalte → nehme ganzen Text als Wert
  if (outputColumns.length === 1) {
    const cleanText = responseText
      .replace(/```[\s\S]*?```/g, '')
      .replace(/^(Antwort:|Ergebnis:|Result:)/i, '')
      .trim();

    if (cleanText.length > 0 && cleanText.length < 5000) {
      return {
        success: true,
        data: { [outputColumns[0]]: cleanText },
        warning: 'Kein JSON gefunden, Text als Wert verwendet',
      };
    }
  }

  return {
    success: false,
    error: 'Konnte kein valides JSON aus der KI-Antwort extrahieren',
    rawResponse: responseText.substring(0, 200),
    data: null,
  };
}

/**
 * Validiere dass die Output-Werte sinnvoll sind
 */
function validateOutputValues(data, outputColumns) {
  const validated = {};
  const warnings = [];

  for (const col of outputColumns) {
    const value = data[col];

    if (value === undefined || value === null || value === '' || value === 'null' || value === 'NULL') {
      validated[col] = null;
    } else if (typeof value === 'string' && value.length > 10000) {
      // Zu langer Text → kürzen
      validated[col] = value.substring(0, 10000);
      warnings.push(`${col}: Wert auf 10000 Zeichen gekürzt`);
    } else {
      validated[col] = value;
    }
  }

  return { validated, warnings };
}

// ============================================================================
// 🚀 QUEUE PROCESSOR - Das Herzstück
// ============================================================================

/**
 * Status-Tracking für laufende Jobs
 */
const activeJobs = new Map();

/**
 * Erstelle einen neuen Job
 */
function createJob(recipeId, totalRows) {
  const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const job = {
    id: jobId,
    recipeId,
    status: 'pending', // pending | running | paused | done | error | cancelled
    totalRows,
    processedRows: 0,
    successRows: 0,
    errorRows: 0,
    skippedRows: 0,
    startTime: Date.now(),
    logs: [],
    results: [], // Draft-Modus: Ergebnisse vor dem Schreiben
    errors: [],
    currentUrl: null,
  };

  activeJobs.set(jobId, job);
  return job;
}

/**
 * Füge Log-Eintrag zum Job hinzu
 */
function addJobLog(job, type, message, extra = {}) {
  const entry = {
    time: new Date().toLocaleTimeString('de-DE'),
    type, // 'info' | 'success' | 'error' | 'warning'
    message,
    ...extra,
  };
  job.logs.push(entry);

  // Max 500 Logs behalten
  if (job.logs.length > 500) job.logs.shift();

  console.log(`[Job ${job.id}] [${type.toUpperCase()}] ${message}`);
  return entry;
}

/**
 * 🎯 Verarbeite eine einzelne Zeile mit einem Rezept
 */
async function processRow(row, recipe, aiCallFn, webTools, options = {}) {
  const { dryRun = false } = options;

  try {
    // 1. Baue Input-Kontext aus den Input-Spalten
    const inputData = {};
    const inputColumns = recipe.inputColumns || [];
    for (const col of inputColumns) {
      if (row[col] !== undefined) {
        inputData[col] = row[col];
      }
    }

    // 2. Web-Quelle wenn konfiguriert
    let webContext = '';
    const sourceConfig = recipe.sourceConfig || {};

    if (recipe.sourceType === 'url_column' && sourceConfig.urlColumn) {
      // URL aus einer Spalte lesen
      const url = row[sourceConfig.urlColumn];
      if (url && url.startsWith('http')) {
        const webResult = await webTools.toolFetchWebpage({
          url,
          keywords: sourceConfig.keywords || [],
          maxWords: sourceConfig.maxWords || 1000,
          forcePlaywright: !!recipe.flags?.forcePlaywright,
        });
        if (webResult.success) {
          webContext = `\nWebseiten-Inhalt von ${url}:\n${webResult.content}`;
        } else {
          throw new Error(`Webseiten-Abruf fehlgeschlagen: ${webResult.error || 'Unbekannter Fehler'}`);
        }
      }
    } else if (recipe.sourceType === 'web_search' && sourceConfig.searchTemplate) {
      // Dynamische Suche basierend auf Zeilen-Daten
      let searchQuery = sourceConfig.searchTemplate;
      for (const [key, val] of Object.entries(inputData)) {
        searchQuery = searchQuery.replace(`{${key}}`, val || '');
      }

      const searchResult = await webTools.toolSearchAndRead({
        query: searchQuery,
        keywords: sourceConfig.keywords || [],
        maxWords: sourceConfig.maxWords || 800,
      });

      if (searchResult.success) {
        webContext = `\nSuchergebnisse für "${searchQuery}" (Quelle: ${searchResult.source}):\n${searchResult.content}`;
      }
    }

    // 3. Baue User-Prompt
    const userPrompt = `Verarbeite folgende Daten:

Eingabedaten: ${JSON.stringify(inputData, null, 2)}
${webContext}

Liefere das Ergebnis als JSON für die Felder: ${recipe.outputColumns.join(', ')}`;

    // 4. System-Prompt mit Anti-Halluzinations-Regeln
    const systemPrompt = buildAntiHallucinationPrompt(recipe, recipe.outputColumns);

    // 5. KI aufrufen
    const rawResponse = await aiCallFn(systemPrompt, userPrompt);

    // 6. Validiere JSON-Antwort
    const parseResult = parseAndValidateJSON(rawResponse, recipe.outputColumns);
    if (!parseResult.success) {
      return {
        success: false,
        error: parseResult.error,
        rawResponse: parseResult.rawResponse,
        rowId: row[recipe.idColumn || 'id'],
      };
    }

    // 7. Validiere Werte
    const { validated, warnings } = validateOutputValues(parseResult.data, recipe.outputColumns);

    return {
      success: true,
      rowId: row[recipe.idColumn || 'id'],
      data: validated,
      warnings,
      webSource: webContext ? (sourceConfig.urlColumn ? row[sourceConfig.urlColumn] : 'Websuche') : null,
    };

  } catch (err) {
    return {
      success: false,
      error: err.message,
      rowId: row[recipe.idColumn || 'id'],
    };
  }
}

/**
 * 🚀 Starte einen Recipe-Job
 *
 * @param {Object} options
 * @param {Object} options.recipe - Das Rezept
 * @param {string} options.pgId - Datenbank-ID
 * @param {string} options.dbMode - DB-Modus
 * @param {Function} options.aiCallFn - Funktion für KI-Aufruf
 * @param {Object} options.webTools - Web-Tools
 * @param {Function} options.onProgress - Callback für Fortschritt
 * @param {boolean} options.dryRun - Nur Vorschau, nicht schreiben
 * @param {number} options.batchSize - Zeilen pro Batch
 * @param {number} options.maxRows - Maximale Zeilenanzahl
 */
async function runRecipeJob(options) {
  const {
    recipe,
    pgId,
    dbMode = 'local',
    aiCallFn,
    webTools,
    onProgress,
    dryRun = true,
    batchSize = 1,
    maxRows = 10,
    safetyStop = 10, // Pause nach X Zeilen für manuelle Prüfung
  } = options;

  // 1. Hole die zu verarbeitenden Zeilen
  const whereClause = recipe.whereClause ? `WHERE ${recipe.whereClause}` : '';
  const limitClause = maxRows ? `LIMIT ${maxRows}` : 'LIMIT 100';
  const idCol = recipe.idColumn || 'id';

  let rows;
  try {
    const query = `SELECT * FROM "${recipe.targetTable}" ${whereClause} ${limitClause}`;
    const result = await databaseEngine.executeQuery(query, [], dbMode, pgId);
    rows = Array.isArray(result) ? result : [result];
  } catch (err) {
    return { success: false, error: `Konnte Zeilen nicht laden: ${err.message}` };
  }

  if (rows.length === 0) {
    return { success: true, message: 'Keine Zeilen gefunden', processedRows: 0 };
  }

  // 2. Erstelle Job
  const job = createJob(recipe.id || 'manual', rows.length);
  job.status = 'running';
  addJobLog(job, 'info', `Job gestartet: ${rows.length} Zeilen, Modus: ${dryRun ? 'Vorschau' : 'Schreiben'}`);

  // 3. Verarbeite Zeilen
  let shouldStop = false;

  for (let i = 0; i < rows.length; i++) {
    // Abbruch-Check
    const currentJob = activeJobs.get(job.id);
    if (currentJob?.status === 'cancelled') {
      addJobLog(job, 'warning', 'Job abgebrochen vom Nutzer');
      break;
    }

    const row = rows[i];
    job.processedRows = i + 1;

    addJobLog(job, 'info', `Verarbeite Zeile ${i + 1}/${rows.length} (ID: ${row[idCol] || i})`);

    // Fortschritt-Callback
    if (onProgress) {
      onProgress({
        jobId: job.id,
        progress: Math.round((job.processedRows / job.totalRows) * 100),
        processedRows: job.processedRows,
        totalRows: job.totalRows,
        successRows: job.successRows,
        errorRows: job.errorRows,
        currentRow: i + 1,
        logs: job.logs.slice(-5), // Letzte 5 Logs
        status: job.status,
      });
    }

    // Verarbeite Zeile
    const result = await processRow(row, recipe, aiCallFn, webTools, { dryRun });

    if (result.success) {
      job.successRows++;
      job.results.push({ rowId: result.rowId, data: result.data, warnings: result.warnings });

      addJobLog(job, 'success',
        `✅ Zeile ${i + 1} OK${result.warnings?.length ? ' (mit Warnungen)' : ''}`,
        { data: result.data, warnings: result.warnings }
      );

      // Wenn nicht DryRun → schreibe in DB
      if (!dryRun && result.data) {
        try {
          const columns = Object.keys(result.data);
          const values = Object.values(result.data);
          
          // Wir bauen das SET dynamisch mit Platzhaltern ($1, $2...)
          // Das ist sicherer gegen SQL-Injection und Format-Fehler
          const setPart = columns
            .map((col, index) => `"${col}" = $${index + 1}`)
            .join(', ');

          const updateSQL = `UPDATE "${recipe.targetTable}" SET ${setPart} WHERE "${idCol}" = $${columns.length + 1}`;
          
          // Die ID kommt als letzter Parameter ($x)
          const params = [...values, result.rowId];

          await databaseEngine.executeQuery(updateSQL, params, dbMode, pgId);
          addJobLog(job, 'info', `  → In DB geschrieben (ID: ${result.rowId})`);
        } catch (dbErr) {
          addJobLog(job, 'error', `  → DB-Fehler: ${dbErr.message}`);
          job.errorRows++;
        }
      }
    } else {
      job.errorRows++;
      job.errors.push({ rowId: result.rowId, error: result.error });
      addJobLog(job, 'error', `❌ Zeile ${i + 1} Fehler: ${result.error}`);
    }

    // Safety Stop: Pause nach X Zeilen für Nutzer-Review
    if (safetyStop > 0 && job.processedRows % safetyStop === 0 && i < rows.length - 1 && dryRun) {
      addJobLog(job, 'warning', `⏸️ Safety Stop nach ${safetyStop} Zeilen. Bitte Ergebnisse prüfen.`);
      job.status = 'paused';

      if (onProgress) {
        onProgress({
          jobId: job.id,
          progress: Math.round((job.processedRows / job.totalRows) * 100),
          processedRows: job.processedRows,
          totalRows: job.totalRows,
          successRows: job.successRows,
          errorRows: job.errorRows,
          logs: job.logs.slice(-5),
          status: 'paused',
          safetyStop: true,
          draftResults: job.results,
        });
      }
      break;
    }

    // Kurze Pause zwischen Anfragen (GPU schonen)
    if (i < rows.length - 1) {
      await new Promise(r => setTimeout(r, 200));
    }
  }

  job.status = job.status === 'paused' ? 'paused' : 'done';
  job.endTime = Date.now();
  const durationSec = ((job.endTime - job.startTime) / 1000).toFixed(1);

  addJobLog(job, 'info',
    `Job ${job.status === 'paused' ? 'pausiert' : 'fertig'}: ${job.successRows} ✅ / ${job.errorRows} ❌ / ${durationSec}s`
  );

  // Finaler Progress-Callback
  if (onProgress) {
    onProgress({
      jobId: job.id,
      progress: Math.round((job.processedRows / job.totalRows) * 100),
      processedRows: job.processedRows,
      totalRows: job.totalRows,
      successRows: job.successRows,
      errorRows: job.errorRows,
      logs: job.logs,
      status: job.status,
      draftResults: job.results,
      done: true,
    });
  }

  return {
    success: true,
    jobId: job.id,
    processedRows: job.processedRows,
    successRows: job.successRows,
    errorRows: job.errorRows,
    draftResults: job.results,
    status: job.status,
    durationSec,
  };
}

/**
 * Brich einen Job ab
 */
function cancelJob(jobId) {
  const job = activeJobs.get(jobId);
  if (job) {
    job.status = 'cancelled';
    return true;
  }
  return false;
}

/**
 * Hole Job-Status
 */
function getJobStatus(jobId) {
  return activeJobs.get(jobId) || null;
}

// ============================================================================
// 💾 COMMIT DRAFT RESULTS — Schreibe Dry-Run-Ergebnisse in die Datenbank
// ============================================================================

/**
 * Schreibe bereits berechnete Dry-Run-Ergebnisse in die Datenbank.
 *
 * Das ist der "Commit"-Schritt nach einem Dry Run.
 * Die KI wird NICHT nochmal aufgerufen — nur pure DB-Writes.
 *
 * @param {Object} options
 * @param {Object} options.recipe        - Das Rezept (braucht targetTable, idColumn, outputColumns)
 * @param {Array}  options.draftResults  - Array von { rowId, data, success } aus dem Dry Run
 * @param {string} options.pgId          - Datenbank-ID
 * @param {string} options.dbMode        - 'local' | 'remote'
 */
async function commitDraftResults({ recipe, draftResults, pgId, dbMode = 'local' }) {
  if (!draftResults || draftResults.length === 0) {
    return { success: false, error: 'Keine Draft-Ergebnisse zum Committen' };
  }

  const idCol = recipe.idColumn || 'id';
  let writtenRows = 0;
  let errorRows = 0;
  const errors = [];

  console.log(`[Recipe] Committing ${draftResults.length} draft results to "${recipe.targetTable}"`);

  for (const result of draftResults) {
    // Überspringe fehlgeschlagene Dry-Run-Einträge
    if (!result.success || !result.data) {
      console.log(`[Recipe] Überspringe Zeile ${result.rowId} (Dry-Run war fehlgeschlagen)`);
      continue;
    }

    // Baue SET-Klausel mit Parametern ($1, $2, ...) — sicher gegen SQL-Injection
    const columns = Object.keys(result.data);
    const values  = Object.values(result.data);

    if (columns.length === 0) {
      console.log(`[Recipe] Überspringe Zeile ${result.rowId} (keine Werte zum Schreiben)`);
      continue;
    }

    const setPart   = columns.map((col, i) => `"${col}" = $${i + 1}`).join(', ');
    const updateSQL = `UPDATE "${recipe.targetTable}" SET ${setPart} WHERE "${idCol}" = $${columns.length + 1}`;
    const params    = [...values, result.rowId];

    try {
      console.log(`[Recipe] UPDATE Zeile ${result.rowId}:`, updateSQL.substring(0, 150));

      if (dbMode === 'remote') {
        await databaseEngine.executeQuery(updateSQL, params, 'remote');
      } else {
        await databaseEngine.executeQuery(updateSQL, params, 'local', pgId);
      }

      writtenRows++;
    } catch (err) {
      console.error(`[Recipe] Fehler bei Zeile ${result.rowId}:`, err.message);
      errorRows++;
      errors.push({ rowId: result.rowId, error: err.message, sql: updateSQL.substring(0, 200) });
    }
  }

  console.log(`[Recipe] Commit fertig: ${writtenRows} ✅ / ${errorRows} ❌`);

  return {
    success: errorRows === 0,
    writtenRows,
    errorRows,
    errors: errors.length > 0 ? errors : undefined,
    message: `${writtenRows} Zeilen erfolgreich geschrieben${errorRows > 0 ? `, ${errorRows} Fehler` : ''}`,
  };
}

// ============================================================================
// 📦 IPC HANDLERS - Wrapper für Electron Integration
// ============================================================================

/**
 * IPC Handler Wrapper für runRecipeJob
 * Diese Funktion wird von main.js aufgerufen
 */
async function recipeJobHandler(event, payload) {
  const webTools = require('./web-tools');
  
  // Hilfsfunktion für KI-Aufruf (unterstützt Ollama & OpenAI-kompatible APIs)
  const aiCallFn = async (systemPrompt, userPrompt) => {
    const { provider, ollamaEndpoint, ollamaModel, apiKey } = payload;
    
    if (provider === 'ollama') {
      const response = await fetch(`${ollamaEndpoint}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: ollamaModel,
          system: systemPrompt,
          prompt: userPrompt,
          stream: false,
          options: { temperature: 0 }
        })
      });
      const json = await response.json();
      return json.response;
    }
    
    // Placeholder für weitere Provider
    throw new Error(`KI-Provider "${provider}" ist in der Recipe-Engine noch nicht implementiert.`);
  };

  return runRecipeJob({
    ...payload,
    webTools,
    aiCallFn,
    onProgress: (progress) => {
      // Sendet Fortschritt an den Renderer-Prozess (Kanal aus recipe-ui.js)
      event.sender.send('recipe-job-progress', progress);
    }
  });
}

/**
 * IPC Handler Wrapper für cancelJob
 */
function recipeCancelHandler(event, jobId) {
  return cancelJob(jobId);
}

/**
 * IPC Handler Wrapper für commitDraftResults
 */
async function recipeCommitDraftHandler(event, payload) {
  const { recipe, draftResults, pgId, dbMode } = payload;
  return await commitDraftResults({ recipe, draftResults, pgId, dbMode });
}

// ============================================================================
// ✅ EXPORTS
// ============================================================================

module.exports = {
  // Core Functions
  runRecipeJob,
  initRecipeStore,
  cancelJob,
  commitDraftResults,

  // IPC Handlers (für main.js)
  recipeJobHandler,
  recipeCancelHandler,
  recipeCommitDraftHandler,

  // Internal/Helper
  processRow,
  createJob,
  getJobStatus,
  activeJobs,
  buildAntiHallucinationPrompt,
  parseAndValidateJSON,
  validateOutputValues,
};
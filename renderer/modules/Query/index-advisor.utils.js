/* ── modules/Query/index-advisor.utils.js ────────────────────────────
   Index Advisor Utilities: Analysiert Tabellen und gibt Index-Empfehlungen
   ────────────────────────────────────────────────────────────────────── */

import { setStatus } from '../utils.js';

// Geschützte Schemas analog zur action-bar.js Logik
export const INTERNAL_SCHEMAS = ['auth', 'storage', 'extensions', 'pg_catalog', 'information_schema'];

/**
 * Ermittelt die erforderlichen Extensions für den Indexberater
 * @param {Array} extensions - Array der Datenbank-Extensions
 * @returns {Object} Objekt mit hypopg und index_advisor Extensions, falls vorhanden
 */
export function getIndexAdvisorExtensions(extensions = []) {
  const hypopg = Array.isArray(extensions) ? extensions.find((ext) => ext?.name === 'hypopg') : null;
  const indexAdvisor = Array.isArray(extensions) ? extensions.find((ext) => ext?.name === 'index_advisor') : null;
  return { hypopg, indexAdvisor };
}

/**
 * Berechnet die prozentuale Verbesserung zwischen den Kosten vorher und nachher
 */
export function calculateImprovement(costBefore, costAfter) {
  if (
    costBefore === undefined ||
    costAfter === undefined ||
    costBefore <= 0 ||
    costBefore <= costAfter
  ) {
    return 0;
  }

  return ((costBefore - costAfter) / costBefore) * 100;
}

/**
 * ✅ HAUPT-FUNKTION: Führe echte Performance-Analyse durch
 * Misst Query-Performance und generiert Optimierungsempfehlungen
 * 
 * @param {string} tableName - Name der Tabelle
 * @param {string} schema - Schema-Name
 * @param {string} dbType - 'local' oder 'remote'
 * @param {Array} columnData - Spalten-Metadaten
 * @param {Array} rowData - Tatsächliche Daten aus der Tabelle
 * @param {Array} relations - Optional: Beziehungen/Foreign Keys (von relations.js)
 */
export async function analyzeTablePerformance(tableName, schema = 'public', dbType = 'local', columnData = [], rowData = [], relations = []) {
  console.log(`[analyzeTablePerformance] Starte Performance-Analyse für ${schema}.${tableName}`);
  console.log(`[analyzeTablePerformance] Relationen:`, relations);
  
  const analysis = {
    tableName,
    schema,
    timestamp: new Date().toISOString(),
    rowCount: rowData?.length || 0,
    columnCount: columnData?.length || 0,
    relations: relations || [],
    queries: [],
    bottlenecks: [],
    recommendations: [],
    estimatedImprovement: 0,
    reportSummary: ''
  };

  try {
    // 1️⃣ Teste verschiedene Query-Patterns
    const queries = generatePerformanceTestQueries(tableName, schema, columnData);
    
    console.log(`[analyzeTablePerformance] Teste ${queries.length} Query-Patterns...`);
    
    for (const q of queries) {
      try {
        const result = await measureQueryPerformance(q.sql, dbType);
        analysis.queries.push({
          name: q.name,
          sql: q.sql,
          executionTime: result.executionTime,
          planJson: result.planJson,
          hasSeqScan: result.hasSeqScan,
          executionNodes: result.executionNodes
        });
        
        // Identifiziere Bottlenecks
        if (result.hasSeqScan && rowData.length > 1000) {
          analysis.bottlenecks.push({
            severity: 'HIGH',
            issue: `"${q.name}" nutzt Seq Scan auf großer Tabelle (${rowData.length} Zeilen)`,
            affectedQuery: q.name,
            suggestion: `Erstelle Index auf dieser WHERE-Bedingung`
          });
        }
      } catch (e) {
        console.warn(`[analyzeTablePerformance] Query-Test fehlgeschlagen:`, e);
      }
    }

    // 2️⃣ Generiere konkrete Recommendations
    analysis.recommendations = generateConcreteRecommendations(
      analysis.bottlenecks, 
      columnData, 
      rowData,
      tableName,
      schema,
      relations
    );

    // 3️⃣ Berechne geschätzte Verbesserung
    analysis.estimatedImprovement = calculateEstimatedImprovement(analysis.recommendations, analysis.queries);

    // 4️⃣ Generiere Report-Summary
    analysis.reportSummary = generateReportSummary(analysis);

    console.log('[analyzeTablePerformance] ✅ Analyse abgeschlossen:', analysis);
    return analysis;

  } catch (e) {
    console.error('[analyzeTablePerformance] Fehler:', e);
    analysis.reportSummary = `❌ Fehler bei der Analyse: ${e.message}`;
    return analysis;
  }
}

/**
 * Generiere Query-Test-Patterns für Performance-Messung
 */
function generatePerformanceTestQueries(tableName, schema, columnData) {
  const queries = [];
  
  // Query 1: SELECT *
  queries.push({
    name: 'SELECT * (alle Zeilen)',
    sql: `SELECT * FROM "${schema}"."${tableName}" LIMIT 1000;`
  });

  // Query 2: WHERE auf erste text-Spalte (häufiger Use-Case)
  const textCol = columnData?.find(c => (c.data_type || '').includes('text'));
  if (textCol) {
    queries.push({
      name: `Suchquery (WHERE auf "${textCol.column_name}")`,
      sql: `SELECT * FROM "${schema}"."${tableName}" WHERE "${textCol.column_name}" IS NOT NULL LIMIT 100;`
    });
  }

  // Query 3: WHERE auf numerische Spalte
  const numCol = columnData?.find(c => {
    const t = (c.data_type || '').toLowerCase();
    return t.includes('int') || t.includes('date');
  });
  if (numCol) {
    queries.push({
      name: `Filter (WHERE auf "${numCol.column_name}")`,
      sql: `SELECT * FROM "${schema}"."${tableName}" WHERE "${numCol.column_name}" IS NOT NULL LIMIT 100;`
    });
  }

  // Query 4: GROUP BY
  if (columnData?.length > 0) {
    const col = columnData[0];
    queries.push({
      name: `Aggregation (GROUP BY)`,
      sql: `SELECT "${col.column_name}", COUNT(*) FROM "${schema}"."${tableName}" GROUP BY "${col.column_name}" LIMIT 50;`
    });
  }

  return queries;
}

/**
 * Misst die Performance eines einzelnen Queries mit EXPLAIN ANALYZE (oder Fallback)
 */
async function measureQueryPerformance(sql, dbType) {
  try {
    // Versuche EXPLAIN ANALYZE mit JSON Format
    const explainSql = `EXPLAIN (ANALYZE, FORMAT JSON) ${sql}`;
    console.log('[measureQueryPerformance] Führe aus:', explainSql);
    
    const result = await window.api.dbQuery(explainSql, null, dbType);
    console.log('[measureQueryPerformance] Result:', result);
    
    // Parse das Ergebnis
    let planJson = null;
    if (Array.isArray(result) && result.length > 0) {
      const item = result[0];
      if (typeof item === 'string') {
        planJson = JSON.parse(item);
      } else if (typeof item === 'object') {
        planJson = item;
      }
    } else if (typeof result === 'string') {
      planJson = JSON.parse(result);
    } else if (typeof result === 'object') {
      planJson = result;
    }
    
    if (!planJson) {
      console.warn('[measureQueryPerformance] Konnte Plan nicht parsen, nutze Fallback');
      return measureQueryPerformanceFallback(sql, dbType);
    }
    
    // Extrahiere Performance-Informationen (handle beide Query Plan Formate)
    let planData, executionTime, planRootNode;
    
    // Format 1: Array mit Plan-Info (standard PostgreSQL)
    if (Array.isArray(planJson) && planJson.length > 0) {
      planData = planJson[0];
      executionTime = planData?.["Execution Time"] || 0;
      planRootNode = planData?.Plan || {};
    } else if (planJson.Plan) {
      // Format 2: Direktes Plan-Objekt
      planRootNode = planJson.Plan;
      executionTime = planJson["Execution Time"] || 0;
    } else {
      // Fallback: verwende ein default Object
      planRootNode = planJson;
      executionTime = 0;
    }
    
    const hasSeqScan = JSON.stringify(planRootNode).includes('Seq Scan');
    
    console.log('[measureQueryPerformance] ✅ Execution Time:', executionTime, 'ms, Seq Scan:', hasSeqScan);
    
    return {
      executionTime: Math.max(executionTime, 0.01), // Minimum 0.01ms damit nicht 0.00
      planJson,
      hasSeqScan,
      executionNodes: extractExecutionNodes(planRootNode)
    };
  } catch (e) {
    console.warn('[measureQueryPerformance] EXPLAIN ANALYZE fehlgeschlagen:', e);
    // Fallback: Messe die Query-Zeit selbst mit timing
    return await measureQueryPerformanceFallback(sql, dbType);
  }
}

/**
 * Fallback: Messe Query-Ausführungszeit direktwithout EXPLAIN ANALYZE
 */
async function measureQueryPerformanceFallback(sql, dbType) {
  try {
    const startTime = performance.now();
    const result = await window.api.dbQuery(sql, null, dbType);
    const endTime = performance.now();
    const executionTime = Math.max(endTime - startTime, 0.01);
    
    console.log('[measureQueryPerformanceFallback] Query Time:', executionTime, 'ms');
    
    return {
      executionTime,
      planJson: null,
      hasSeqScan: false, // Können ohne EXPLAIN nicht sicher feststellen
      executionNodes: []
    };
  } catch (e) {
    console.warn('[measureQueryPerformanceFallback] Auch Query selbst fehlgeschlagen:', e);
    return {
      executionTime: 0,
      planJson: null,
      hasSeqScan: false,
      executionNodes: []
    };
  }
}

/**
 * Extrahiere alle Execution-Nodes aus dem Plan
 */
function extractExecutionNodes(plan) {
  const nodes = [];
  
  function traverse(node) {
    if (!node) return;
    nodes.push({
      type: node['Node Type'] || 'Unknown',
      duration: node['Actual Total Time'] || 0,
      rows: node['Actual Rows'] || 0
    });
    if (node.Plans && Array.isArray(node.Plans)) {
      node.Plans.forEach(traverse);
    }
  }
  
  traverse(plan);
  return nodes;
}

/**
 * Generiere konkrete Recommendations basierend auf Bottlenecks + Relationen
 */
function generateConcreteRecommendations(bottlenecks, columnData, rowData, tableName, schema, relations = []) {
  const recommendations = [];

  // ===== PASS 1: FOREIGN KEY INDIZES (HIGHEST PRIORITY) =====
  // Foreign Keys sollten IMMER indiziert sein für bessere JOIN-Performance
  if (relations && relations.length > 0) {
    console.log(`[generateConcreteRecommendations] Verarbeite ${relations.length} Relationen`);
    
    relations.forEach(rel => {
      // Nur outgoing Relations (wo diese Tabelle die FK hat)
      if (rel.type === 'outgoing' && rel.from === tableName) {
        recommendations.push({
          priority: 'HIGH',
          reason: `Foreign Key Index für bessere JOIN-Performance mit Tabelle "${rel.to}"`,
          columnName: rel.fromCol,
          indexName: `idx_fk_${tableName}_${rel.fromCol}`,
          sqlStatement: `CREATE INDEX idx_fk_${tableName}_${rel.fromCol} ON "${schema}"."${tableName}" ("${rel.fromCol}");`,
          estimatedSpeedup: '25-35% schneller',
          description: `🔗 Foreign Key Index auf "${rel.fromCol}" → "${rel.to}".${rel.toCol}`
        });
      }
    });
  }

  // ===== PASS 2: BOTTLENECK-SPEZIFISCHE INDIZES =====
  if (bottlenecks.length > 0) {
    bottlenecks.filter(b => b.severity === 'HIGH').forEach(b => {
      // Finde die beste Spalte für einen Index
      const bestColumns = columnData
        ?.filter(c => {
          const dt = (c.data_type || '').toLowerCase();
          return dt.includes('int') || dt.includes('text') || dt.includes('date');
        })
        .slice(0, 3) || [];

      bestColumns.forEach((col, idx) => {
        // Prüfe ob bereits eine FK-empfehlung für diese spalte existiert
        const alreadyRecommended = recommendations.some(r => r.columnName === col.column_name);
        if (alreadyRecommended) return;
        
        const priority = idx === 0 ? 'HIGH' : 'MEDIUM';
        recommendations.push({
          priority,
          reason: `Index für häufige WHERE-Clauses und Filterung`,
          columnName: col.column_name,
          indexName: `idx_${tableName}_${col.column_name}`,
          sqlStatement: `CREATE INDEX idx_${tableName}_${col.column_name} ON "${schema}"."${tableName}" ("${col.column_name}");`,
          estimatedSpeedup: `${20 + idx * 10}% schneller`,
          description: `Index auf Spalte "${col.column_name}" (${col.data_type}) für schnellere Filterung`
        });
      });
    });
  }

  // ===== PASS 3: ALLGEMEINE EMPFEHLUNGEN WENN KEINE BOTTLENECKS =====
  if (recommendations.length === 0) {
    const indexCandidates = columnData
      ?.filter(c => {
        const dt = (c.data_type || '').toLowerCase();
        const colName = (c.column_name || '').toLowerCase();
        // Häufig gesuchte Spalten (id, name, email, date, etc)
        return (dt.includes('int') || dt.includes('text') || dt.includes('date') || dt.includes('uuid')) &&
               (colName.includes('id') || colName.includes('name') || colName.includes('date') || 
                colName.includes('email') || colName.includes('code'));
      })
      .slice(0, 3) || [];

    indexCandidates.forEach((col, idx) => {
      const priority = idx === 0 ? 'MEDIUM' : 'LOW';
      recommendations.push({
        priority,
        reason: `Potentieller Index auf häufig genutzter Spalte`,
        columnName: col.column_name,
        indexName: `idx_${tableName}_${col.column_name}`,
        sqlStatement: `CREATE INDEX idx_${tableName}_${col.column_name} ON "${schema}"."${tableName}" ("${col.column_name}");`,
        estimatedSpeedup: `${10 + idx * 5}% schneller`,
        description: `Index auf "${col.column_name}" für optimierte Suche`
      });
    });
  }

  return recommendations;
}

/**
 * Berechne geschätzte Verbesserung aller Recommendations
 */
function calculateEstimatedImprovement(recommendations, queries) {
  if (!recommendations || recommendations.length === 0) return 0;
  
  // Erste HIGH Priority gibt ~20-30%
  const highPri = recommendations.filter(r => r.priority === 'HIGH').length;
  const mediumPri = recommendations.filter(r => r.priority === 'MEDIUM').length;
  
  return (highPri * 25) + (mediumPri * 10);
}

/**
 * Generiere einen lesbaren Performance-Report
 */
function generateReportSummary(analysis) {
  let summary = `
📊 PERFORMANCE-ANALYSE REPORT
===============================
Tabelle: "${analysis.schema}"."${analysis.tableName}"
Zeilen: ${(analysis.rowCount || 0).toLocaleString('de-DE')}
Spalten: ${analysis.columnCount || 0}
Zeitstempel: ${new Date(analysis.timestamp).toLocaleString('de-DE')}

🔍 GEMESSENE QUERIES: ${analysis.queries.length}
${analysis.queries.map(q => `  • ${q.name}: ${q.executionTime?.toFixed(2) || '?'} ms`).join('\n')}

⚠️ IDENTIFIZIERTE BOTTLENECKS: ${analysis.bottlenecks.length}
${analysis.bottlenecks.map(b => `  • [${b.severity}] ${b.issue}`).join('\n')}

💡 OPTIMIERUNGSEMPFEHLUNGEN: ${analysis.recommendations.length}
${analysis.recommendations.map(r => `
  🔹 ${r.description}
     Priority: ${r.priority}
     SQL: ${r.sqlStatement}
     Geschätzte Speedup: ${r.estimatedSpeedup}
`).join('\n')}

📈 GESAMTE GESCHÄTZTE VERBESSERUNG: ~${analysis.estimatedImprovement}% schneller
${analysis.estimatedImprovement > 0 ? '✅ Indizes werden diese Tabelle deutlich schneller machen!' : 'ℹ️ Diese Tabelle ist bereits gut optimiert.'}
  `;
  
  return summary;
}

/**
 * ✅ Neue Funktion: Berechnet Cardinality (Anzahl einzigartiger Werte)
 */
function calculateCardinality(columnName, rowData) {
  if (!rowData || rowData.length === 0) return 0;
  const uniqueValues = new Set();
  rowData.forEach(row => {
    const val = row[columnName];
    if (val !== null && val !== undefined && val !== '') {
      uniqueValues.add(String(val));
    }
  });
  return uniqueValues.size;
}

/**
 * ✅ Neue Funktion: Prüft existierende Indizes einer Tabelle
 */
export async function getExistingIndexes(tableName, schema = 'public', dbType = 'local') {
  try {
    const sql = `
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = '${tableName}' AND schemaname = '${schema}'
      AND indexname NOT LIKE '%_pkey'
      ORDER BY indexname;
    `;
    
    const result = await window.api.dbQuery(sql, null, dbType);
    return Array.isArray(result) ? result : [];
  } catch (e) {
    console.warn('[getExistingIndexes] Error:', e);
    return [];
  }
}

/**
 * ✅ Neue Funktion: Gibt Performance-Tipps basierend auf Spaltentypausanlyse
 */
export function getPerformanceTips(columnData = []) {
  const tips = [];
  
  if (!Array.isArray(columnData)) return tips;

  // Analyse: Zu viele Text-Spalten?
  const textCols = columnData.filter(c => (c.data_type || '').toLowerCase().includes('text')).length;
  if (textCols > 5) {
    tips.push('💡 Viele Text-Spalten: Erwäge Volltext-Indizes (TSVECTOR) für Such-Queries');
  }

  // Analyse: Keine Numerischen Spalten?
  const numericCols = columnData.filter(c => {
    const type = (c.data_type || '').toLowerCase();
    return type.includes('int') || type.includes('float') || type.includes('decimal');
  }).length;
  if (numericCols === 0) {
    tips.push('⚠️ Keine numerischen Spalten: Verwende numerische Typen für große Ranges');
  }

  // Analyse: Viele Nullable Spalten?
  const nullableCols = columnData.filter(c => c.is_nullable !== 'NO').length;
  if (nullableCols > columnData.length * 0.5) {
    tips.push('💡 Viele NULL-Werte: Nullable Spalten können Index-Performance beeinträchtigen');
  }

  tips.push('📊 Analyse-Tipp: Führe ANALYZE TABLE durch für bessere Query-Statistiken');
  tips.push('🔍 EXPLAIN ANALYZE nutzen um echte Performance-Probleme zu identifizieren');

  return tips;
}

/**
 * Erstellt Datenbank-Indizes mit den bereitgestellten SQL-Statements
 * @param {Object} params - Parameter (dbId, indexStatements, etc.)
 */
export async function createIndexes({
  activeDbId,
  indexStatements,
  onSuccess,
  onError,
}) {
  if (!activeDbId) {
    const error = new Error('Database ID is required');
    if (onError) onError(error);
    return Promise.reject(error);
  }

  if (!Array.isArray(indexStatements) || indexStatements.length === 0) {
    const error = new Error('No index statements provided');
    if (onError) onError(error);
    return Promise.reject(error);
  }

  try {
    // Nutzt die vorhandene Electron IPC API
    await window.api.query(indexStatements.join(';\n') + ';', activeDbId);

    setStatus('Index erfolgreich erstellt', 'success');
    if (onSuccess) onSuccess();
    return Promise.resolve();
  } catch (error) {
    setStatus(`Fehler beim Erstellen des Index: ${error.message}`, 'error');
    if (onError) onError(error);
    return Promise.reject(error);
  }
}

/**
 * Prüft, ob das Ergebnis des Indexberaters Empfehlungen enthält
 */
export function hasIndexRecommendations(result, isSuccess) {
  return Boolean(isSuccess && result && Array.isArray(result.index_statements) && result.index_statements.length > 0);
}

/**
 * Filtert Index-Statements heraus, die sich auf geschützte Schemas beziehen
 */
export function filterProtectedSchemaIndexStatements(indexStatements) {
  if (!Array.isArray(indexStatements) || indexStatements.length === 0) return [];

  return indexStatements.filter((statement) => {
    const schemaMatch = statement.match(/ON\s+(?:"?(\w+)"?\.|(\w+)\.)/i);
    if (!schemaMatch) return true;
    const schemaName = schemaMatch[1] || schemaMatch[2];
    if (!schemaName) return true;
    return !INTERNAL_SCHEMAS.includes(schemaName.toLowerCase());
  });
}

/**
 * Filtert ein Indexberater-Ergebnis, um Empfehlungen für geschützte Schemas zu entfernen
 */
export function filterProtectedSchemaIndexAdvisorResult(result) {
  if (!result || !result.index_statements) return result ?? null;
  const filteredStatements = filterProtectedSchemaIndexStatements(Array.isArray(result.index_statements) ? result.index_statements : []);
  if (filteredStatements.length === 0) return null;
  return { ...result, index_statements: filteredStatements };
}

/**
 * Prüft, ob eine Query geschützte Schemas involviert
 */
export function queryInvolvesProtectedSchemas(query) {
  if (!query) return false;
  const queryLower = query.toLowerCase();
  return INTERNAL_SCHEMAS.some((schema) => {
    const pattern = new RegExp(`(?:from|join|update|insert\\s+into|delete\\s+from)\\s+(?:${schema}\\.|"${schema}"\\.)`, 'i');
    return pattern.test(queryLower);
  });
}
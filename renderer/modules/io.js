/* ── modules/io.js ────────────────────────────────────────────────────
   Import (CSV / JSON / Excel / Parquet) und Export (CSV / JSON / SQL).
   ──────────────────────────────────────────────────────────────────── */

import { state }           from './state.js';
import { esc, setStatus, dlBlob } from './utils.js';
import { refreshTableList } from './sidebar.js';
import { quickView }        from './executor.js';
import { sanitizeArrayOfObjects } from '../../src/lib/sanitize.js';
import { isDateDE, toISO } from './validators/isDate.js';

// ── Export globale Referensen für React-Komponenten ────────────────
window.state = state;

// ── Import ─────────────────────────────────────────────────────────────

// Hilfsfunktion: Wählt den richtigen Query-Handler basierend auf dbMode
async function executeQuery(sql, params = [], isRemote = false) {
    if (isRemote && state.dbMode === 'remote' && state.serverConnectionString) {
        return await window.api.serverQuery(state.serverConnectionString, sql, params || []);
    } else {
        if (params && params.length > 0) {
            // Mit Parameters - nutze dbQuery API
            return await window.api.dbQuery(sql, params, 'local');
        } else {
            // Ohne Parameter - nutze legacy sql:query
            return await window.api.query(sql, state.activeDbId);
        }
    }
}

// Exportiere executeQuery global für SpreadsheetImport & andere Komponenten
window.executeQuery = executeQuery;

export async function importFile(filePath, fileName) {
    const ext  = fileName.split('.').pop().toLowerCase();
    const name = fileName.replace(/\.[^.]+$/, '').replace(/[^a-z0-9_]/gi, '_');
    setStatus('Importiere…');
    
    try {
        // CSV-Datei lesen über IPC (fs ist nur im main-process verfügbar)
        if (ext === 'csv') {
            const isRemote = state.dbMode === 'remote' && state.serverConnectionString;
            
            console.log('═══════════════════════════════════════════════════════════════════');
            console.log('[io.js] 📥 CSV-IMPORT GESTARTET');
            console.log('[io.js] Datei:', fileName);
            console.log('[io.js] Pfad:', filePath);
            console.log('[io.js] Zieldatenbank:', isRemote ? '🔗 Remote PostgreSQL' : '💾 PGlite (Lokal)');
            console.log('[io.js] Datenbank-URL:', isRemote 
                ? state.serverConnectionString?.substring(0, 50) + '...'
                : state.activeDbId?.substring(0, 50) + '...');
            console.log('═══════════════════════════════════════════════════════════════════');
            
            setStatus(`📥 Lese CSV von "${fileName}"...`);
            
            // Nutze neuen IPC-Handler via window.api.csvImportFile
            const csvData = await window.api.csvImportFile(filePath);
            
            // Fehlerbehandlung für ungültige CSV
            if (!csvData) {
                setStatus('❌ CSV konnte nicht geparst werden', 'error');
                console.error('[io.js] ❌ csvData ist null!');
                return;
            }
            
            if (csvData.errors && csvData.errors.length > 0) {
                console.warn('[io.js] ⚠️  CSV Parse-Warnungen:', csvData.errors);
            }
            
            if (!csvData.rows || csvData.rows.length === 0) {
                setStatus('❌ CSV ist leer (0 Zeilen)', 'error');
                console.error('[io.js] ❌ CSV war leer!');
                return;
            }
            
            const headers = csvData.headers;
            const rows = csvData.rows;
            
            // Validierung der Headers
            if (!headers || headers.length === 0) {
                setStatus('❌ Keine Spalten gefunden (CSV-Header ungültig?)', 'error');
                console.error('[io.js] ❌ Keine Headers gefunden');
                return;
            }
            
            console.log(`[io.js] ✓ CSV geladen: ${headers.length} Spalten, ${rows.length} Zeilen`);
            console.log('[io.js] Headers:', headers);
            
            // ✨ INTELLIGENTE TYPE INFERENCE FÜR JEDE SPALTE
            const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2})?/;
            const DATE_FORMATS = [
              'YYYY-MM-DD HH:mm:ss',
              'YYYY-MM-DD HH:mm:ss.SSS',
              'YYYY-MM-DDTHH:mm:ss',
              'YYYY-MM-DDTHH:mm:ssZ',
              'YYYY-MM-DD',
              'DD.MM.YYYY',
              'DD/MM/YYYY',
              'YYYY/MM/DD',
            ];

            const normalizeNumber = (val) => {
              // Entferne Währungssymbole und Leerzeichen vor der Prüfung
              let normalized = String(val).trim().replace(/[€$£¥\s]/g, '');
              // German format: 1.234,56 → 1234.56
              if (normalized.match(/^\d{1,3}(\.\d{3})*,\d+$/)) {
                normalized = normalized.replace(/\./g, '').replace(/,/, '.');
              }
              // Simple: 30,42 → 30.42
              else if (normalized.match(/^\d+,\d+$/)) {
                normalized = normalized.replace(',', '.');
              }
              return Number(normalized);
            };

            const inferColumnType = (headerName, rows) => {
              if (!rows || rows.length === 0) return 'text';
              const samples = rows.slice(0, Math.min(100, rows.length)).map(r => r[headerName]);
              const nonEmpty = samples.filter(v => v !== null && v !== undefined && v !== '');
              if (nonEmpty.length === 0) return 'text';

              const str = String(nonEmpty[0]).trim();

              // 1. UUID
              if (UUID_REGEX.test(str)) {
                if (nonEmpty.every(v => UUID_REGEX.test(String(v).trim()))) return 'uuid';
              }

              // 2. Integer (BIGINT / INT8)
              const asInt = parseInt(String(nonEmpty[0]), 10);
              if (!isNaN(asInt) && String(asInt) === String(nonEmpty[0]).trim()) {
                if (nonEmpty.every(v => {
                  const vStr = String(v).trim();
                  return vStr === '' || !isNaN(parseInt(vStr, 10));
                })) {
                  return Math.abs(asInt) > 2147483647 ? 'int8' : 'int4';
                }
              }

              // 3. Float / Numeric (mit German Decimal Support!)
              const asNum = normalizeNumber(str);
              if (!isNaN(asNum) && asNum.toString().includes('.')) {
                if (nonEmpty.every(v => {
                  if (v === null || v === undefined || v === '') return true;
                  return !isNaN(normalizeNumber(String(v)));
                })) {
                  return 'float8';
                }
              }

              // 4. Boolean
              const boolStr = str.toLowerCase();
              if (['true', 'false', 'yes', 'no', 'ja', 'nein', '1', '0', 'on', 'off'].includes(boolStr)) {
                if (nonEmpty.every(v => {
                  const vStr = String(v).toLowerCase().trim();
                  return ['true', 'false', 'yes', 'no', 'ja', 'nein', '1', '0', 'on', 'off'].includes(vStr);
                })) {
                  return 'bool';
                }
              }

              // 5. JSON
              try {
                JSON.parse(str);
                if (nonEmpty.every(v => {
                  try { JSON.parse(String(v)); return true; } catch { return false; }
                })) {
                  return 'jsonb';
                }
              } catch {}

              // 6. Date/Timestamp (Regex-basierte Erkennung)
              if (ISO_DATE_REGEX.test(str)) {
                return 'timestamptz';
              }
              // German Date Format: DD.MM.YYYY (auch mit Ellipsen/Spaces)
              if (/^\d{1,2}[.\s\u2026]+\d{1,2}[.\s\u2026]+\d{2,4}[.\s\u2026]*$/.test(str)) {
                return 'timestamptz';
              }
              // Slash Format: DD/MM/YYYY
              if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(str)) {
                return 'timestamptz';
              }

              return 'text';
            };

            // Store column types for later value conversion
            const columnTypes = {};
            const columnDefs = headers.map(h => {
              const type = inferColumnType(h, rows);
              columnTypes[h] = type;
              const pgType = {
                'int8': 'BIGINT',
                'int4': 'INTEGER',
                'float8': 'NUMERIC',
                'numeric': 'NUMERIC',
                'bool': 'BOOLEAN',
                'jsonb': 'JSONB',
                'uuid': 'UUID',
                'date': 'DATE',
                'timestamptz': 'TIMESTAMP WITH TIME ZONE',
                'text': 'TEXT'
              }[type] || 'TEXT';
              console.log(`[io.js] Spalte "${h}" → ${pgType} (type: ${type})`);
              return `"${h.replace(/"/g, '""')}" ${pgType}`;
            }).join(', ');

            // Value conversion function based on detected types
            const convertValue = (val, type) => {
              if (val === null || val === undefined || val === '') return 'NULL';
              const str = String(val).trim();
              if (str === '') return 'NULL';

              if (type === 'timestamptz' || type === 'date') {
                // Nutze den zentralen Validator für die Bereinigung und Konvertierung
                const dCheck = isDateDE(str);
                if (dCheck.valid) {
                  return `'${toISO(dCheck.day, dCheck.month, dCheck.year)}'`;
                }
                // Already in ISO format
                if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
                  return `'${str}'`;
                }
                return `'${str}'`;
              }

              if (type === 'int8' || type === 'int4') {
                const n = parseInt(str, 10);
                return isNaN(n) ? 'NULL' : String(n);
              }

              if (type === 'float8' || type === 'numeric') {
                // German format: 30,42 → 30.42
                let normalized = str.replace(/\s/g, '');
                if (normalized.match(/^\d{1,3}(\.\d{3})*,\d+$/)) {
                  normalized = normalized.replace(/\./g, '').replace(/,/, '.');
                } else if (normalized.match(/^\d+,\d+$/)) {
                  normalized = normalized.replace(',', '.');
                }
                const n = parseFloat(normalized);
                return isNaN(n) ? 'NULL' : String(n);
              }

              if (type === 'bool') {
                const lower = str.toLowerCase();
                return ['true', 'yes', 'ja', '1', 'on'].includes(lower) ? 'true' : 'false';
              }

              if (type === 'jsonb') {
                try {
                  JSON.parse(str);
                  return `'${str.replace(/'/g, "''")}'`;
                } catch {
                  return `'${str.replace(/'/g, "''")}'`;
                }
              }

              // Default: text
              return `'${str.replace(/'/g, "''")}'`;
            };
            
            const createSql = `CREATE TABLE IF NOT EXISTS "${name.replace(/"/g, '""')}" (${columnDefs})`;
            
            console.log('[io.js] 📋 Erstelle Tabelle:', createSql.substring(0, 100) + '...');
            setStatus(`✅ Erstelle Tabelle "${name}"...`);
            
            try {
                await executeQuery(createSql, isRemote);
                console.log('[io.js] ✓ Tabelle erstellt');
                setStatus(`✅ Tabelle "${name}" erstellt`);
            } catch (tableErr) {
                console.error('[io.js] ❌ Fehler beim Erstellen der Tabelle:', tableErr);
                setStatus(`❌ Tabelle konnte nicht erstellt werden: ${tableErr.message}`, 'error');
                return;
            }
            
            // INSERT die Daten - GRÖSSERE BATCH-SIZE (1000 Zeilen statt 100)
            console.log(`[io.js] 📊 Füge ${rows.length} Zeilen in Batches ein...`);
            setStatus(`📥 Importiere ${rows.length} Zeilen...`);
            
            const batchSize = 1000; // 10x größer für bessere Performance
            let successCount = 0;
            let errorCount = 0;
            
            for (let i = 0; i < rows.length; i += batchSize) {
                const batch = rows.slice(i, i + batchSize);
                const batchNum = Math.floor(i / batchSize) + 1;
                const totalBatches = Math.ceil(rows.length / batchSize);
                
                try {
                    let insertSql = `INSERT INTO "${name.replace(/"/g, '""')}" (${headers.map(h => `"${h.replace(/"/g, '""')}"`).join(', ')}) VALUES `;
                    
                    const values = batch.map((row, rowIdx) => {
                        try {
                            const vals = headers.map(h => {
                                const val = row[h];
                                const type = columnTypes[h] || 'text';
                                return convertValue(val, type);
                            }).join(', ');
                            return `(${vals})`;
                        } catch (rowErr) {
                            console.warn(`[io.js] ⚠️  Fehler in Zeile ${i + rowIdx}:`, rowErr);
                            errorCount++;
                            return null;
                        }
                    }).filter(v => v !== null);
                    
                    if (values.length === 0) {
                        console.warn(`[io.js] ⚠️  Batch ${batchNum} hat keine gültigen Werte`);
                        continue;
                    }
                    
                    insertSql += values.join(', ');
                    
                    await executeQuery(insertSql, isRemote);
                    successCount += values.length;
                    console.log(`[io.js] Batch ${batchNum}/${totalBatches}: ✓ ${values.length} Zeilen`);
                    setStatus(`📥 Batch ${batchNum}/${totalBatches}: ${Math.min(i + batchSize, rows.length)}/${rows.length} Zeilen`);
                } catch (batchErr) {
                    console.error(`[io.js] ❌ Fehler in Batch ${batchNum}:`, batchErr);
                    errorCount += batch.length;
                    setStatus(`⚠️  Batch ${batchNum} hatte Fehler - fahre fort...`, 'warning');
                }
            }
            
            console.log('═══════════════════════════════════════════════════════════════════');
            console.log(`[io.js] ✅ IMPORT ABGESCHLOSSEN!`);
            console.log(`[io.js] Tabelle: "${name}"`);
            console.log(`[io.js] Erfolgreich eingefügt: ${successCount}/${rows.length} Zeilen`);
            if (errorCount > 0) console.log(`[io.js] ⚠️  Fehler: ${errorCount} Zeilen`);
            console.log(`[io.js] Ziel: ${isRemote ? '🔗 Remote' : '💾 PGlite'}`);
            console.log('═══════════════════════════════════════════════════════════════════');
            
            const msg = errorCount > 0 
                ? `✅ "${name}" importiert! ${successCount}/${rows.length} Zeilen (${errorCount} Fehler)`
                : `✅ "${name}" importiert! ${successCount} Zeilen`;
            
            setStatus(msg + ` (${isRemote ? '🔗 Remote' : '💾 PGlite'})`, 'success');
            await refreshTableList();
            quickView(name);
            return;
        }
        
        setStatus('⚠️ Nur CSV-Import unterstützt (nicht ' + ext + ')', 'warning');
    } catch (e) { 
        console.error('[io.js] ❌ IMPORT FEHLER:', e);
        setStatus(`❌ Import Fehler: ${e.message || e}`, 'error'); 
    }
}

export function initImportControls() {
    const dropZone = document.getElementById('drop-zone');
    console.log('[io.js] initImportControls - Dialog Manager Status:', 
        window.DialogManager ? '✓ Verfügbar' : '❌ Nicht verfügbar (wird versucht zu warten)');

    // Hilfsfunktion: Warte bis DialogManager verfügbar ist
    async function waitForDialogManager(maxWait = 5000) {
        const start = Date.now();
        while (!window.DialogManager && Date.now() - start < maxWait) {
            await new Promise(r => setTimeout(r, 100));
        }
        if (!window.DialogManager) {
            console.warn('[io.js] DialogManager wurde nicht verfügbar - Fallback zu Datei-Dialog');
        }
        return !!window.DialogManager;
    }

    // Drag & Drop
    dropZone.addEventListener('dragover',  e => { 
        e.preventDefault(); 
        dropZone.classList.add('drag-over'); 
        console.log('[io.js] Drag-over erkannt');
    });
    
    dropZone.addEventListener('dragleave', e => { 
        e.preventDefault(); 
        dropZone.classList.remove('drag-over'); 
    });
    
    dropZone.addEventListener('drop', async e => {
        e.preventDefault(); 
        dropZone.classList.remove('drag-over');
        const f = e.dataTransfer.files[0];
        if (f) {
            console.log('[io.js] Datei dropped:', f.name);
            await importFile(f.path, f.name);
        }
    });
    
    // Click-Handler - Versuche IMMER den React Dialog zu öffnen
    dropZone.addEventListener('click', async () => {
        console.log('[io.js] 🎯 Drop-Zone geklickt!');
        setStatus('📂 CSV-Import Dialog öffnet sich...');
        
        // Versuche maximal 10x zu warten bis DialogManager verfügbar ist
        let attempts = 0;
        const maxAttempts = 10;
        while (!window.DialogManager && attempts < maxAttempts) {
            console.log(`[io.js] ⏳ Warte auf DialogManager... (${attempts + 1}/${maxAttempts})`);
            await new Promise(r => setTimeout(r, 200));
            attempts++;
        }
        
        if (!window.DialogManager) {
            console.error('[io.js] ❌ DialogManager wurde nicht geladen - Fallback zu File-Dialog');
            const p = await window.api.openFile({ title: 'CSV importieren', extensions: ['csv'] });
            if (p) {
                console.log('[io.js] Datei gewählt via Fallback-Dialog:', p);
                await importFile(p, p.split(/[/\\]/).pop());
            }
            return;
        }
        
        try {
            console.log('[io.js] ✅ DialogManager verfügbar - öffne SpreadsheetImport...');
            console.log('[io.js] window.SpreadsheetImport verfügbar?', !!window.SpreadsheetImport);
            console.log('[io.js] window.showSpreadsheetImport verfügbar?', !!window.showSpreadsheetImport);
            
            // Rufe den Dialog auf
            window.DialogManager.spreadsheetImportOpen(state.currentTable || null, async () => {
                console.log('[io.js] ✅ SpreadsheetImport Callback - Datei wurde importiert!');
                setStatus('📋 Tabellenliste wird aktualisiert...');
                await refreshTableList();
                setStatus('✅ Fertig!');
            });
            
            // Log die aktuelle UI-State
            setTimeout(() => {
                const container = document.getElementById('dialog-container');
                console.log('[io.js] dialog-container sichtbar?', container ? 'JA' : 'NEIN');
                if (container) {
                    console.log('[io.js] dialog-container HTML:', container.innerHTML.substring(0, 100));
                }
            }, 100);
            
        } catch (err) {
            console.error('[io.js] ❌ DialogManager Fehler:', err);
            setStatus('❌ Dialog konnte nicht geöffnet werden: ' + err.message, 'error');
            
            // Fallback
            console.log('[io.js] Fallback: Öffne File-Dialog');
            const p = await window.api.openFile({ title: 'CSV importieren', extensions: ['csv'] });
            if (p) {
                console.log('[io.js] Datei gewählt via Fallback-Dialog:', p);
                await importFile(p, p.split(/[/\\]/).pop());
            }
        }
    });

    console.log('[io.js] Import-Controls initialisiert (Drag&Drop + Click-Handler)');

    // Format-Buttons (JSON / Excel / Parquet)
    const extMap = { json: ['json', 'ndjson'], excel: ['xlsx', 'xls'], parquet: ['parquet'] };
    document.querySelectorAll('.import-btns .btn').forEach(btn => {
        const fmt = btn.dataset.fmt;
        btn.addEventListener('click', async () => {
            const p = await window.api.openFile({
                title: `${fmt.toUpperCase()} importieren`,
                extensions: extMap[fmt] || ['*']
            });
            if (p) await importFile(p, p.split(/[/\\]/).pop());
        });
    });
}

// ── Export ─────────────────────────────────────────────────────────────

export function initExportControls() {
    document.getElementById('exp-csv').addEventListener('click', () => {
        if (!state.lastData.length) return;
        const cols = state.currentCols.length ? state.currentCols : Object.keys(state.lastData[0]);
        const rows = [
            cols.map(c => `"${c}"`).join(','),
            ...state.lastData.map(r => cols.map(c => {
                const v = r[c];
                if (v === null || v === undefined) return '';
                const s = String(v);
                return s.includes(',') || s.includes('"') || s.includes('\n')
                    ? `"${s.replace(/"/g, '""')}"` : s;
            }).join(','))
        ];
        dlBlob(rows.join('\n'), 'text/csv', (state.currentTable ?? 'export') + '.csv');
    });

    document.getElementById('exp-json').addEventListener('click', () => {
        if (!state.lastData.length) return;
        dlBlob(JSON.stringify(state.lastData, null, 2), 'application/json',
            (state.currentTable ?? 'export') + '.json');
    });

    document.getElementById('exp-sql').addEventListener('click', async () => {
        if (!state.currentTable) { setStatus('Bitte eine Tabelle auswählen.', 'error'); return; }
        try {
            const isRemote = state.dbMode === 'remote' && state.serverConnectionString;
            
            // DuckDB Fix: PRAGMA table_info ist robuster als DESCRIBE (nur für PGlite)
            let cols;
            if (isRemote) {
                // Remote PostgreSQL - benutze information_schema
                const rawCols = await window.api.serverQuery(state.serverConnectionString,
                    `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position`,
                    [state.currentTable]);
                cols = rawCols.map(c => ({
                    column_name: c.column_name,
                    column_type: c.data_type,
                    null: c.is_nullable === 'YES' ? 'YES' : 'NO'
                }));
            } else {
                // PGlite
                const rawCols = await window.api.query(`PRAGMA table_info(${esc(state.currentTable)})`, state.activeDbId);
                cols = rawCols.map(c => ({
                    column_name: c.name,
                    column_type: c.type,
                    null: c.notnull === 0 ? 'YES' : 'NO'
                }));
            }
            
            // Lese Daten
            const rawRows = await (isRemote
                ? window.api.serverQuery(state.serverConnectionString, `SELECT * FROM ${esc(state.currentTable)} LIMIT 10000`, [])
                : window.api.query(`SELECT * FROM ${esc(state.currentTable)}`, state.activeDbId));
            
            // Integration: Wenn Privacy Mode aktiv, auch den Export redigieren
            const rows = (state.magicEyeActive && state.magicMode === 'privacy')
                ? sanitizeArrayOfObjects(rawRows)
                : rawRows;

            const colDefs = cols.map(c =>
                `  ${esc(c.column_name)} ${c.column_type}${c.null === 'NO' ? ' NOT NULL' : ''}`
            ).join(',\n');

            let dump = `-- SQL-Dump: ${state.currentTable}\n-- ${new Date().toISOString()}\n\n`;
            dump += `CREATE TABLE IF NOT EXISTS ${esc(state.currentTable)} (\n${colDefs}\n);\n\n`;
            if (rows.length) {
                const colNames = cols.map(c => esc(c.column_name)).join(', ');
                const vals = rows.map(row =>
                    '(' + cols.map(c => {
                        const v = row[c.column_name];
                        if (v === null || v === undefined) return 'NULL';
                        if (typeof v === 'number') return String(v);
                        return `'${String(v).replace(/'/g, "''")}'`;
                    }).join(', ') + ')'
                ).join(',\n');
                dump += `INSERT INTO ${esc(state.currentTable)} (${colNames}) VALUES\n${vals};\n`;
            }
            dlBlob(dump, 'text/plain;charset=utf-8', state.currentTable + '.sql');
        } catch (e) { setStatus('Export Fehler: ' + e, 'error'); }
    });
}
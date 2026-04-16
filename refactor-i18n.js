#!/usr/bin/env node

/**
 * Auto i18n Refactorer für Kynto
 * Konvertiert automatisch hardcodierte UI-Strings zu i18n-Keys
 * 
 * USAGE: node refactor-i18n.js <file_path> [--preview]
 */

const fs = require('fs');
const path = require('path');

// Mapping von hardcodierten Strings zu i18n-Keys (basierend auf er Analyse)
const STRING_MAPPING = {
  // instant-api-panel.js
  'Instant API': 'instant_api.title',
  'Schließen': 'modals.close',
  'Status': 'api.rest_api',
  'Inaktiv': 'instant_api.stop_button',
  'API nicht gestartet': 'instant_api.starting',
  'Netzwerk Port': 'instant_api.port',
  'Mit App-Start aktivieren': 'settings.general.sidebar_on_startup',
  'Steuerung': 'executor.run_button',
  '▶ Starten': 'instant_api.start_button',
  '⏹ Stoppen': 'instant_api.stop_button',
  'API im Browser öffnen': 'header.open_storage_tooltip',
  'Verbindungs-Info': 'instant_api.title',
  'Endpoints': 'api.rest_api',
  'API nicht aktiv': 'instant_api.starting',
  
  // io.js
  'CSV konnte nicht geparst werden': 'io.csv_parse_error',
  'CSV ist leer': 'io.csv_empty',
  'Keine Spalten gefunden': 'io.csv_no_columns',
  'Tabelle erstellt': 'io.table_created',
  'Importiere': 'io.importing',
  'Datensätze importiert': 'io.import_success',
  'Import fehlgeschlagen': 'io.import_failed',
  'CSV exportieren': 'io.export_csv',
  'JSON exportieren': 'io.export_json',
  'SQL Dump exportieren': 'io.export_sql',
  
  // executor.js
  '▶ Ausführen': 'executor.run_button',
  '⏹ Abbrechen': 'executor.cancel_button',
  'Abgebrochen': 'results.status.aborted',
  'Query abgebrochen': 'executor.query_aborted'
};

/**
 * Konvertiert einen String zu einem JavaScript-i18n-Aufruf
 */
function stringToI18n(str, mappingTable = STRING_MAPPING) {
  const key = mappingTable[str.trim()];
  if (!key) {
    return null; // Kein Mapping gefunden
  }
  return `window.i18n?.t('${key}')`;
}

/**
 * Refaktoriert eine Datei (PREVIEW MODE - no changes)
 */
function previewRefactoring(filePath, mappingTable = STRING_MAPPING) {
  if (!fs.existsSync(filePath)) {
    console.error(`❌ Datei nicht gefunden: ${filePath}`);
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  let changeCount = 0;
  const changes = [];

  for (const [original, key] of Object.entries(mappingTable)) {
    // Zähle Vorkommen
    const regex = new RegExp(original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    const matches = content.match(regex);
    
    if (matches) {
      changeCount += matches.length;
      changes.push({
        original,
        key,
        count: matches.length
      });
    }
  }

  return {
    file: filePath,
    changeCount,
    changes
  };
}

/**
 * Refaktoriert eine Datei (ACTUAL REFACTORING)
 */
function refactorFile(filePath, mappingTable = STRING_MAPPING, dryRun = TRUE) {
  if (!fs.existsSync(filePath)) {
    console.error(`❌ Datei nicht gefunden: ${filePath}`);
    return false;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;
  let changeCount = 0;

  for (const [original, key] of Object.entries(mappingTable)) {
    const regex = new RegExp(
      `['"]${original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`,
      'g'
    );
    
    const replacement = `window.i18n?.t('${key}')`;
    const matches = content.match(regex);
    
    if (matches) {
      content = content.replace(regex, replacement);
      changeCount += matches.length;
      console.log(`  ✓ "${original}" → ${replacement} (${matches.length}x)`);
    }
  }

  if (!dryRun && content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`\n✅ ${changeCount} Änderungen in ${filePath} gespeichert`);
  } else if (dryRun) {
    console.log(`\n📋 PREVIEW: ${changeCount} potenzielle Änderungen`);
  }

  return changeCount > 0;
}

/**
 * Refaktoriert alle kritischen Dateien
 */
function refactorCriticalFiles(dryRun = true) {
  const criticalFiles = [
    'renderer/modules/instant-api-panel.js',
    'renderer/modules/io.js',
    'renderer/modules/executor.js'
  ];

  console.log(dryRun ? '📋 PREVIEW MODE\n' : '🔄 REFACTORING\n');

  const results = criticalFiles.map(file => {
    const fullPath = path.join(__dirname, file);
    console.log(`\n📄 ${file}:`);
    return refactorFile(fullPath, STRING_MAPPING, dryRun);
  });

  const successCount = results.filter(r => r).length;
  console.log(`\n${'='.repeat(50)}`);
  console.log(`✅ ${successCount}/${criticalFiles.length} Dateien erfolgreich refaktoriert`);
}

// CLI
const args = process.argv.slice(2);
const preview = args.includes('--preview');
const file = args[0];

if (file) {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`📄 Refactoring: ${file}`);
  console.log(`${'='.repeat(50)}\n`);
  
  if (preview) {
    const result = previewRefactoring(file);
    console.log(`\n📊 PREVIEW:`);
    console.log(`  • Potenzielle Änderungen: ${result.changeCount}`);
    if (result.changes.length > 0) {
      result.changes.forEach(c => {
        console.log(`    - "${c.original}" (${c.count}x)`);
      });
    }
  } else {
    refactorFile(file, STRING_MAPPING, false);
  }
} else {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║         i18n Auto-Refactorer für Kynto                   ║
║  Konvertiert hardcodierte Strings zu i18n-Keys            ║
╚════════════════════════════════════════════════════════════╝

USAGE:
  node refactor-i18n.js <file_path>         - Refaktoriert Datei
  node refactor-i18n.js <file_path> --preview - Zeigt Änderungen vor

BEISPIELE:
  node refactor-i18n.js renderer/modules/instant-api-panel.js --preview
  node refactor-i18n.js renderer/modules/instant-api-panel.js

NOTES:
  • Ersetzt nur bekannte Strings aus hardcodeder Liste
  • Dynamische Strings müssen manuell refaktoriert werden
  • Nutze window.i18n?.t('key') für JavaScript
  • Nutze data-i18n="key" für HTML-Attribute
  `);
}

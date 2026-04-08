#!/usr/bin/env node

/* ══════════════════════════════════════════════════════════════════════
   TEST SCRIPT - Instant API Validierung
   
   Führe diese Datei aus mit:
   node instant-api-test.js
   ══════════════════════════════════════════════════════════════════════ */

const fs = require('fs');
const path = require('path');
const os = require('os');

// Farben für Terminal-Output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
};

function log(color, ...msg) {
    console.log(color + msg.join(' ') + colors.reset);
}

function checkmark() { return colors.green + '✓' + colors.reset; }
function cross() { return colors.red + '✗' + colors.reset; }
function info() { return colors.blue + 'ℹ' + colors.reset; }

// ═══════════════════════════════════════════════════════════════════════
// TEST 1: PostgREST Binaries vorhanden?
// ═══════════════════════════════════════════════════════════════════════

function testPostgRESTBinaries() {
    console.log(`\n${colors.cyan}[TEST 1] PostgREST Binaries prüfen${colors.reset}`);
    console.log('─'.repeat(50));

    const resourceDir = path.join(__dirname, 'src/resources');
    const platform = os.platform();
    
    let hasWin = false;
    let hasMacArm = false;
    let hasLinux = false;

    // Windows
    const winExe = path.join(resourceDir, 'win/postgrest.exe');
    if (fs.existsSync(winExe)) {
        hasWin = true;
        log(colors.green, checkmark(), 'Windows: postgrest.exe gefunden');
        const stats = fs.statSync(winExe);
        log(colors.cyan, '  ', `Größe: ${stats.size} bytes`);
    } else {
        log(colors.red, cross(), 'Windows: postgrest.exe NICHT gefunden');
    }

    // macOS ARM
    const macArm = path.join(resourceDir, 'mac-arm/postgrest');
    if (fs.existsSync(macArm)) {
        hasMacArm = true;
        log(colors.green, checkmark(), 'macOS ARM: postgrest gefunden');
        const stats = fs.statSync(macArm);
        log(colors.cyan, '  ', `Größe: ${stats.size} bytes`);
    } else {
        log(colors.red, cross(), 'macOS ARM: postgrest NICHT gefunden');
    }

    // Linux
    const linuxFile = path.join(resourceDir, 'linux/postgrest-v14.7-linux-static-x86-64.tar.xz');
    const linuxBinary = path.join(resourceDir, 'linux/postgrest');
    if (fs.existsSync(linuxFile)) {
        hasLinux = true;
        log(colors.green, checkmark(), 'Linux: postgrest-v14.7-linux-static-x86-64.tar.xz gefunden');
        const stats = fs.statSync(linuxFile);
        log(colors.cyan, '  ', `Größe: ${stats.size} bytes`);
    } else if (fs.existsSync(linuxBinary)) {
        hasLinux = true;
        log(colors.green, checkmark(), 'Linux: postgrest (extrahiert) gefunden');
    } else {
        log(colors.red, cross(), 'Linux: postgrest-*.tar.xz NICHT gefunden');
    }

    const allPresent = hasWin && hasMacArm && hasLinux;
    console.log(`\nErgebnis: ${allPresent ? checkmark() : cross()} ${allPresent ? 'BESTANDEN' : 'FEHLGESCHLAGEN'}`);
    
    return allPresent;
}

// ═══════════════════════════════════════════════════════════════════════
// TEST 2: Node-Module vorhanden?
// ═══════════════════════════════════════════════════════════════════════

function testNodeModules() {
    console.log(`\n${colors.cyan}[TEST 2] Node-Module prüfen${colors.reset}`);
    console.log('─'.repeat(50));

    const modules = ['pg', 'child_process', 'es'];
    let allOk = true;

    for (const mod of modules) {
        try {
            if (mod === 'es') continue; // Built-in
            require.resolve(mod);
            log(colors.green, checkmark(), `Module "${mod}" installiert`);
        } catch (err) {
            log(colors.red, cross(), `Module "${mod}" NOT installiert`);
            allOk = false;
        }
    }

    if (!allOk) {
        log(colors.yellow, info(), 'Zum Installieren: npm install');
    }

    console.log(`\nErgebnis: ${allOk ? checkmark() : cross()} ${allOk ? 'BESTANDEN' : 'FEHLGESCHLAGEN'}`);
    return allOk;
}

// ═══════════════════════════════════════════════════════════════════════
// TEST 3: Manager-Dateien existieren?
// ═══════════════════════════════════════════════════════════════════════

function testManagerFiles() {
    console.log(`\n${colors.cyan}[TEST 3] Manager-Dateien prüfen${colors.reset}`);
    console.log('─'.repeat(50));

    const files = [
        { path: 'src/main/postgrest-manager.js', desc: 'PostgREST Manager' },
        { path: 'src/main/progresssql-manager.js', desc: 'ProgressSQL Manager' },
        { path: 'instant-api-integration-example.js', desc: 'Integration-Beispiele' },
        { path: 'INSTANT-API-SETUP.md', desc: 'Setup-Dokumentation' },
    ];

    let allOk = true;

    for (const file of files) {
        const fullPath = path.join(__dirname, file.path);
        if (fs.existsSync(fullPath)) {
            log(colors.green, checkmark(), `${file.desc}: ${file.path}`);
            const stats = fs.statSync(fullPath);
            const lines = fs.readFileSync(fullPath, 'utf8').split('\n').length;
            log(colors.cyan, '  ', `${stats.size} bytes, ${lines} Zeilen`);
        } else {
            log(colors.red, cross(), `${file.desc}: ${file.path} NICHT GEFUNDEN`);
            allOk = false;
        }
    }

    console.log(`\nErgebnis: ${allOk ? checkmark() : cross()} ${allOk ? 'BESTANDEN' : 'FEHLGESCHLAGEN'}`);
    return allOk;
}

// ═══════════════════════════════════════════════════════════════════════
// TEST 4: Manager-Funktionen prüfen?
// ═══════════════════════════════════════════════════════════════════════

function testManagerFunctions() {
    console.log(`\n${colors.cyan}[TEST 4] Manager-Funktionen prüfen${colors.reset}`);
    console.log('─'.repeat(50));

    try {
        const progressqlMgr = require('./src/main/progresssql-manager');
        const postgrestMgr = require('./src/main/postgrest-manager');

        const progressqlFuncs = [
            'openConnection',
            'closeConnection',
            'query',
            'describe',
            'listTables',
            'transaction',
            'startInstantAPI',
            'stopInstantAPI',
            'getInstantAPIStatus',
            'getApiEndpoints',
            'getApiDocumentation',
        ];

        const postgrestFuncs = [
            'startPostgREST',
            'stopPostgREST',
            'getApiStatus',
            'getApiOpenAPI',
            'startInstantAPI',
            'detectPlatformAndBinary',
        ];

        let allOk = true;

        log(colors.blue, 'progresssql-manager.js:');
        for (const func of progressqlFuncs) {
            if (typeof progressqlMgr[func] === 'function') {
                log(colors.green, checkmark(), `  ${func}()`);
            } else {
                log(colors.red, cross(), `  ${func}() - NICHT GEFUNDEN`);
                allOk = false;
            }
        }

        log(colors.blue, '\npostgrest-manager.js:');
        for (const func of postgrestFuncs) {
            if (typeof postgrestMgr[func] === 'function') {
                log(colors.green, checkmark(), `  ${func}()`);
            } else {
                log(colors.red, cross(), `  ${func}() - NICHT GEFUNDEN`);
                allOk = false;
            }
        }

        console.log(`\nErgebnis: ${allOk ? checkmark() : cross()} ${allOk ? 'BESTANDEN' : 'FEHLGESCHLAGEN'}`);
        return allOk;
    } catch (err) {
        log(colors.red, cross(), `Fehler beim Laden der Manager: ${err.message}`);
        return false;
    }
}

// ═══════════════════════════════════════════════════════════════════════
// TEST 5: Plattformerkennung
// ═══════════════════════════════════════════════════════════════════════

function testPlatformDetection() {
    console.log(`\n${colors.cyan}[TEST 5] Plattformerkennung${colors.reset}`);
    console.log('─'.repeat(50));

    try {
        const postgrestMgr = require('./src/main/postgrest-manager');
        const platformInfo = postgrestMgr.detectPlatformAndBinary();

        log(colors.green, checkmark(), `Erkannte Plattform: ${platformInfo.platform}`);
        log(colors.green, checkmark(), `Binary-Pfad: ${platformInfo.binaryPath}`);
        
        if (platformInfo.needsExtraction) {
            log(colors.yellow, info(), `Linux-Binary muss extrahiert werden`);
        } else {
            log(colors.green, checkmark(), `Keine Extraktion nötig`);
        }

        console.log(`\nErgebnis: ${checkmark()} BESTANDEN`);
        return true;
    } catch (err) {
        log(colors.red, cross(), `Fehler: ${err.message}`);
        return false;
    }
}

// ═══════════════════════════════════════════════════════════════════════
// HAUPT-TEST-SUITE
// ═══════════════════════════════════════════════════════════════════════

async function runAllTests() {
    console.clear();
    console.log(colors.cyan + '╔════════════════════════════════════════════╗');
    console.log('║     INSTANT API - INSTALLATION TEST        ║');
    console.log('╚════════════════════════════════════════════╝' + colors.reset);

    const results = [];

    // Führe alle Tests durch
    results.push({ name: 'PostgREST Binaries', passed: testPostgRESTBinaries() });
    results.push({ name: 'Node-Module', passed: testNodeModules() });
    results.push({ name: 'Manager-Dateien', passed: testManagerFiles() });
    results.push({ name: 'Manager-Funktionen', passed: testManagerFunctions() });
    results.push({ name: 'Plattformerkennung', passed: testPlatformDetection() });

    // Summary
    console.log(`\n${colors.cyan}╔════════════════════════════════════════════╗`);
    console.log('║              TEST ZUSAMMENFASSUNG          ║');
    console.log('╚════════════════════════════════════════════╝' + colors.reset);

    const passedCount = results.filter(r => r.passed).length;
    const totalCount = results.length;

    for (const result of results) {
        const status = result.passed ? checkmark() : cross();
        const color = result.passed ? colors.green : colors.red;
        log(color, status, result.name.padEnd(30), result.passed ? 'BESTANDEN' : 'FEHLGESCHLAGEN');
    }

    console.log(`\nGesamt: ${passedCount}/${totalCount} Tests bestanden`);

    if (passedCount === totalCount) {
        console.log(`\n${colors.green}╔════════════════════════════════════════════╗`);
        console.log('║  ✨ ALLES KONFIGURIERT - BEREIT ZUM STARTEN  ║');
        console.log('╚════════════════════════════════════════════╝' + colors.reset);
        console.log(`\n${colors.cyan}Nächste Schritte:${colors.reset}`);
        console.log('1. Datenbankverbindung in main.js konfigurieren');
        console.log('2. INSTANT-API-QUICK-START.md befolgen');
        console.log('3. Electron-App starten');
        console.log('4. REST-API unter http://127.0.0.1:3001 erreichbar');
    } else {
        console.log(`\n${colors.red}⚠ Nachfolgende Tests fehlgeschlagen - siehe oben${colors.reset}`);
        process.exit(1);
    }
}

// Start
runAllTests().catch(err => {
    console.error('Kritischer Fehler:', err);
    process.exit(1);
});

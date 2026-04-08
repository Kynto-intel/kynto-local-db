/* ══════════════════════════════════════════════════════════════════════
   postgrest-manager.js  —  PostgREST Instant API Manager
   
   Verwaltet einen PostgREST-Server für automatische REST-APIs
   auf Basis der PostgreSQL-Datenbank.
   ══════════════════════════════════════════════════════════════════════ */

const os = require('os');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { execSync } = require('child_process');

const POSTGREST_PORT = 3001;

// Globale PostgREST-Prozess-Instance
let postgrestProcess = null;
let postgrestApi = null;

/**
 * Erkenne das Betriebssystem und liefere den Pfad zur PostgREST-Binary
 * @returns {{platform: string, binaryPath: string, needsExtraction: boolean}}
 */
function detectPlatformAndBinary() {
    const platform = os.platform();
    const resourcesDir = path.join(__dirname, '../resources');

    let binaryPath;
    let needsExtraction = false;

    if (platform === 'win32') {
        binaryPath = path.join(resourcesDir, 'win/postgrest.exe');
    } else if (platform === 'darwin') {
        // macOS - ARM (M1+) oder Intel
        const arch = os.arch();
        binaryPath = path.join(resourcesDir, 'mac-arm/postgrest');
    } else if (platform === 'linux') {
        // Linux - Archiv muss entpackt werden
        const archivePath = path.join(resourcesDir, 'linux/postgrest-v14.7-linux-static-x86-64.tar.xz');
        binaryPath = path.join(resourcesDir, 'linux/postgrest');
        needsExtraction = !fs.existsSync(binaryPath) && fs.existsSync(archivePath);
    }

    return {
        platform,
        binaryPath,
        needsExtraction,
        resourcesDir,
    };
}

/**
 * Extrahiere PostgREST-Binary für Linux
 */
function extractLinuxBinary(resourcesDir) {
    const archivePath = path.join(resourcesDir, 'linux/postgrest-v14.7-linux-static-x86-64.tar.xz');
    const extractDir = path.join(resourcesDir, 'linux');

    console.log('[PostgREST] Extrahiere Linux-Binary...');

    try {
        // Nutze 'tar' command (sollte auf Linux vorhanden sein)
        execSync(`tar -xJ -f "${archivePath}" -C "${extractDir}"`, {
            stdio: 'inherit',
        });

        // Mache Binary executable
        const binaryPath = path.join(extractDir, 'postgrest');
        fs.chmodSync(binaryPath, 0o755);

        console.log('[PostgREST] Linux-Binary erfolgreich extrahiert');
        return true;
    } catch (err) {
        console.error('[PostgREST] Fehler beim Extrahieren:', err.message);
        return false;
    }
}

/**
 * Erstelle PostgREST-Konfigurationsdatei
 */
function createConfigFile(connectionString, apiPort = POSTGREST_PORT) {
    const configDir = path.join(process.cwd(), '.postgrest');

    if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
    }

    const configPath = path.join(configDir, 'postgrest.conf');

    // PostgREST Configuration
    const config = [
        `# PostgREST Configuration`,
        `db-uri = "${connectionString}"`,
        `db-schema = "public"`,
        `db-anon-role = "postgres"`,
        `server-host = "127.0.0.1"`,
        `server-port = ${apiPort}`,
        `max-rows = 1000`,
    ].join('\n');

    fs.writeFileSync(configPath, config, 'utf8');
    console.log(`[PostgREST] Konfigurationsdatei erstellt: ${configPath}`);

    return configPath;
}

/**
 * Prüfe Post-gREST-Verfügbarkeit
 */
async function checkApiAvailable(port = POSTGREST_PORT, maxRetries = 10) {
    return new Promise((resolve) => {
        let attempts = 0;

        const tryConnect = async () => {
            try {
                const response = await fetch(`http://127.0.0.1:${port}/`);
                if (response.ok) {
                    console.log(`[PostgREST] API verfügbar auf http://127.0.0.1:${port}`);
                    resolve(true);
                }
            } catch (err) {
                attempts++;
                if (attempts < maxRetries) {
                    setTimeout(tryConnect, 500);
                } else {
                    console.warn(`[PostgREST] API nicht erreichbar nach ${maxRetries} Versuchen`);
                    resolve(false);
                }
            }
        };

        tryConnect();
    });
}

/**
 * Starte PostgREST-Server
 * @param {string} connectionString - PostgreSQL-Verbindungsstring
 * @param {number} port - Port für API (Standard: 3001)
 * @returns {Promise<Object>} { success, port, url, message }
 */
async function startPostgREST(connectionString, port = POSTGREST_PORT) {
    try {
        // Wenn bereits laufen, nutze vorhandene Instance
        if (postgrestProcess) {
            console.log('[PostgREST] Server läuft bereits');
            return {
                success: true,
                port,
                url: `http://127.0.0.1:${port}`,
                pid: postgrestProcess.pid,
                message: 'PostgREST-Server läuft bereits',
            };
        }

        // Plattform erkennen
        const { platform, binaryPath, needsExtraction, resourcesDir } = detectPlatformAndBinary();

        console.log(`[PostgREST] Plattform: ${platform}`);
        console.log(`[PostgREST] Binary-Pfad: ${binaryPath}`);

        // Extrahiere Linux-Binary falls nötig
        if (needsExtraction) {
            const extracted = extractLinuxBinary(resourcesDir);
            if (!extracted) {
                throw new Error('Konnte PostgREST-Binary für Linux nicht extrahieren');
            }
        }

        // Prüfe ob Binary existiert
        if (!fs.existsSync(binaryPath)) {
            throw new Error(`PostgREST-Binary nicht gefunden: ${binaryPath}`);
        }

        // Erstelle Konfigurationsdatei
        const configPath = createConfigFile(connectionString, port);

        // Starte PostgREST-Prozess (mit -f Flag für Config-Datei)
        console.log('[PostgREST] Starte Server...');
        postgrestProcess = spawn(binaryPath, ['-f', configPath], {
            stdio: ['ignore', 'pipe', 'pipe'],
            detached: false,
        });

        // Speichere PID sofort, BEVOR Events registriert werden
        const pid = postgrestProcess.pid;
        console.log(`[PostgREST] Prozess gestartet mit PID: ${pid}`);

        postgrestProcess.stdout.on('data', (data) => {
            console.log(`[PostgREST] ${data.toString().trim()}`);
        });

        postgrestProcess.stderr.on('data', (data) => {
            console.log(`[PostgREST] STDERR: ${data.toString().trim()}`);
        });

        postgrestProcess.on('error', (err) => {
            console.error('[PostgREST] Prozessfehler:', err.message);
            postgrestProcess = null;
        });

        postgrestProcess.on('exit', (code) => {
            console.log(`[PostgREST] Prozess beendet (Code: ${code})`);
            postgrestProcess = null;
        });

        // Warte bis API verfügbar ist
        const available = await checkApiAvailable(port);

        if (!available) {
            console.warn('[PostgREST] API reagiert nicht, aber Prozess läuft');
        }

        postgrestApi = {
            port,
            url: `http://127.0.0.1:${port}`,
            configPath,
            platform,
            pid,
        };

        return {
            success: true,
            ...postgrestApi,
            message: 'PostgREST-Server erfolgreich gestartet',
        };
    } catch (err) {
        console.error('[PostgREST] Fehler beim Starten:', err.message);
        return {
            success: false,
            error: err.message,
        };
    }
}

/**
 * Stoppe PostgREST-Server
 */
async function stopPostgREST() {
    return new Promise((resolve) => {
        if (!postgrestProcess) {
            console.log('[PostgREST] Kein aktiver Prozess');
            resolve({ success: true });
            return;
        }

        postgrestProcess.on('exit', () => {
            postgrestProcess = null;
            postgrestApi = null;
            console.log('[PostgREST] Server gestoppt');
            resolve({ success: true });
        });

        postgrestProcess.kill('SIGTERM');

        // Force-Kill nach 5 Sekunden
        setTimeout(() => {
            if (postgrestProcess) {
                postgrestProcess.kill('SIGKILL');
            }
        }, 5000);
    });
}

/**
 * Erhalte Status der PostgREST-API
 */
async function getApiStatus() {
    if (!postgrestApi) {
        return {
            running: false,
            message: 'PostgREST-API läuft nicht',
        };
    }

    try {
        const response = await fetch(`${postgrestApi.url}/`);
        return {
            running: response.ok,
            ...postgrestApi,
            message: 'PostgREST-API läuft',
        };
    } catch (err) {
        return {
            running: false,
            ...postgrestApi,
            error: err.message,
        };
    }
}

/**
 * Exportiere API-Specifications (OpenAPI/Swagger)
 */
async function getApiOpenAPI() {
    if (!postgrestApi) {
        return null;
    }

    try {
        const response = await fetch(`${postgrestApi.url}/`);
        const data = await response.text();
        return data;
    } catch (err) {
        console.error('[PostgREST] Fehler beim Abrufen der API-Specs:', err.message);
        return null;
    }
}

/**
 * Starte Instant API nach Datenbankverbindung
 */
async function startInstantAPI(connectionString) {
    console.log('[Instant API] Initialisiere...');
    
    const result = await startPostgREST(connectionString);
    
    if (result.success) {
        console.log(`[Instant API] ✓ API verfügbar unter: ${result.url}`);
        console.log(`[Instant API] ✓ REST-Endpoints automatisch für alle Tabellen erstellt`);
        console.log(`[Instant API] ✓ Dokumentation unter: ${result.url}`);
    }
    
    return result;
}

module.exports = {
    startPostgREST,
    stopPostgREST,
    getApiStatus,
    getApiOpenAPI,
    startInstantAPI,
    detectPlatformAndBinary,
    POSTGREST_PORT,
};

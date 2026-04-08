/* ══════════════════════════════════════════════════════════════════════
   instant-api-integration-example.js
   
   BEISPIEL: Wie man die Instant API in der Kynto-App verwendet
   ══════════════════════════════════════════════════════════════════════ */

const progressqlManager = require('./progresssql-manager');

/**
 * BEISPIEL 1: Einfacher Start der Instant API
 */
async function example1_BasicStart() {
    console.log('\n📡 BEISPIEL 1: Basis-Start\n');

    const connectionString = 'postgresql://user:password@localhost:5432/kynto';

    try {
        // 1. Verbinde zur Datenbank
        await progressqlManager.openConnection(connectionString);
        console.log('✓ Datenbankverbindung hergestellt');

        // 2. Starte Instant API
        const apiResult = await progressqlManager.startInstantAPI(connectionString);

        if (apiResult.success) {
            console.log(`✓ Instant API läuft unter: ${apiResult.url}`);
            console.log(`✓ Automatische Endpoints für alle Tabellen verfügbar`);
        }
    } catch (err) {
        console.error('✗ Fehler:', err.message);
    }
}

/**
 * BEISPIEL 2: Endpoints abrufen und anzeigen
 */
async function example2_ListEndpoints() {
    console.log('\n📡 BEISPIEL 2: Verfügbare REST-Endpoints\n');

    const connectionString = 'postgresql://user:password@localhost:5432/kynto';

    try {
        await progressqlManager.openConnection(connectionString);

        // Erhalte alle verfügbaren Endpoints
        const endpoints = await progressqlManager.getApiEndpoints(connectionString);

        console.log('Verfügbare REST-Endpoints:');
        endpoints.slice(0, 10).forEach(ep => {
            console.log(`  ${ep.method.padEnd(6)} ${ep.path.padEnd(40)} - ${ep.description}`);
        });
        console.log(`  ... und ${endpoints.length - 10} weitere Endpoints`);
    } catch (err) {
        console.error('✗ Fehler:', err.message);
    }
}

/**
 * BEISPIEL 3: API-Dokumentation abrufen
 */
async function example3_GetDocumentation() {
    console.log('\n📡 BEISPIEL 3: API-Dokumentation abrufen\n');

    const connectionString = 'postgresql://user:password@localhost:5432/kynto';

    try {
        await progressqlManager.openConnection(connectionString);
        await progressqlManager.startInstantAPI(connectionString);

        // Erhalte API-Dokumentation
        const docs = await progressqlManager.getApiDocumentation(connectionString);

        console.log('API-Info:');
        console.log(`  Title: ${docs.info.title}`);
        console.log(`  Version: ${docs.info.version}`);
        console.log(`  Base URL: ${docs.servers[0].url}`);
        console.log(`  OpenAPI-Doku: ${docs.documentation}`);
    } catch (err) {
        console.error('✗ Fehler:', err.message);
    }
}

/**
 * BEISPIEL 4: API-Status prüfen
 */
async function example4_CheckStatus() {
    console.log('\n📡 BEISPIEL 4: API-Status prüfen\n');

    const connectionString = 'postgresql://user:password@localhost:5432/kynto';

    try {
        await progressqlManager.openConnection(connectionString);

        // Prüfe Status
        let status = await progressqlManager.getInstantAPIStatus(connectionString);
        console.log('Status (vor Start):', status);

        // Starte API
        await progressqlManager.startInstantAPI(connectionString);

        // Prüfe Status erneut
        status = await progressqlManager.getInstantAPIStatus(connectionString);
        console.log('Status (nach Start):', status);
    } catch (err) {
        console.error('✗ Fehler:', err.message);
    }
}

/**
 * BEISPIEL 5: API mit benutzerdefinierten Port
 */
async function example5_CustomPort() {
    console.log('\n📡 BEISPIEL 5: Eigener Port für API\n');

    const connectionString = 'postgresql://user:password@localhost:5432/kynto';
    const customPort = 8080;

    try {
        await progressqlManager.openConnection(connectionString);

        // Starte API auf Port 8080
        const result = await progressqlManager.startInstantAPI(connectionString, customPort);

        if (result.success) {
            console.log(`✓ API läuft auf: ${result.url}`);
        }
    } catch (err) {
        console.error('✗ Fehler:', err.message);
    }
}

/**
 * BEISPIEL 6: Integration in Electron-App
 */
async function example6_ElectronIntegration() {
    console.log('\n📡 BEISPIEL 6: Integration in Electron-App\n');

    // Diese Funktion würde in main.js oder preload.js aufgerufen:

    const connectionString = 'postgresql://localhost:5432/kynto';

    // Bei App-Start
    async function initializeApp() {
        try {
            // 1. Verbinde zur Datenbank
            const dbInfo = await progressqlManager.openConnection(connectionString);
            console.log(`✓ Datenbank verbunden: ${dbInfo.version}`);

            // 2. Starte Instant API automatisch
            const apiInfo = await progressqlManager.startInstantAPI(connectionString);
            
            if (apiInfo.success) {
                // 3. Speichere API-Info für Frontend
                global.kyntoApi = {
                    baseUrl: apiInfo.url,
                    port: apiInfo.port,
                    pid: apiInfo.pid,
                };

                // 4. Sende API-Info zum Renderer
                mainWindow.webContents.send('instant-api-ready', global.kyntoApi);
            }
        } catch (err) {
            console.error('App-Init fehlgeschlagen:', err.message);
        }
    }

    // Bei App-Shutdown
    async function cleanupApp() {
        try {
            await progressqlManager.stopInstantAPI(connectionString);
            await progressqlManager.closeConnection(connectionString);
            console.log('✓ Ressourcen freigegeben');
        } catch (err) {
            console.error('Cleanup-Fehler:', err.message);
        }
    }

    // Beispielaufruf
    await initializeApp();
    // ... App läuft ...
    // await cleanupApp();
}

/**
 * BEISPIEL 7: REST API-Aufrufe vom Renderer-Prozess
 */
async function example7_FrontendUsage() {
    // Dies würde im Renderer-Prozess (z.B. in modules/app.js) laufen:

    const API_BASE = 'http://127.0.0.1:3001';

    // Alle Datensätze abrufen
    async function getAllUsers() {
        const response = await fetch(`${API_BASE}/users`);
        return await response.json();
    }

    // Mit Filtern
    async function getFilteredUsers(emailDomain) {
        const response = await fetch(`${API_BASE}/users?email=like.%${emailDomain}`);
        return await response.json();
    }

    // Neue Zeile einfügen
    async function createUser(userData) {
        const response = await fetch(`${API_BASE}/users`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData),
        });
        return await response.json();
    }

    // Zeile aktualisieren
    async function updateUser(userId, updates) {
        const response = await fetch(`${API_BASE}/users?id=eq.${userId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates),
        });
        return await response.json();
    }

    // Zeile löschen
    async function deleteUser(userId) {
        const response = await fetch(`${API_BASE}/users?id=eq.${userId}`, {
            method: 'DELETE',
        });
        return response.ok;
    }

    // Stored Procedure aufrufen
    async function callRPC(functionName, params) {
        const response = await fetch(`${API_BASE}/rpc/${functionName}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params),
        });
        return await response.json();
    }

    console.log('Frontend-Funktionen bereit für REST-API-Aufrufe');
}

// Exports für Tests
module.exports = {
    example1_BasicStart,
    example2_ListEndpoints,
    example3_GetDocumentation,
    example4_CheckStatus,
    example5_CustomPort,
    example6_ElectronIntegration,
    example7_FrontendUsage,
};

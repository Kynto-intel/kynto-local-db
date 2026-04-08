/**
 * Kynto Intel - Standardeinstellungen
 * 
 * WICHTIG: Jeder Key der hier definiert ist, wird beim Settings-Load/Save
 * in main.js durchgelassen. Keys die hier fehlen werden herausgefiltert!
 */
module.exports = {
    ui: {
        sidebar: false,
        builder: false,
        fav: false,
        hist: false,
        virtualScrolling: false
    },
    theme: 'dark',
    editor: {
        fontSize: 14,
        lineNumbers: true,
        autocomplete: true,
        tabSize: 4
    },
    database: {
        autoLimit: 500,
        autoCheckpoint: true,
        // Aktive Datenbank: 'pglite' (Standard) oder 'postgresql'
        activeType: 'pglite',
        // PostgreSQL Connection String (nur wenn activeType === 'postgresql')
        postgresqlConnectionString: ''
    },
    ai: {
        enabled: false,
        provider: 'ollama',
        apiKey: '',
        model: 'llama3'
    }
};
/**
 * Kynto Intel - Standardeinstellungen
 *
 * WICHTIG: Jeder Key der hier definiert ist, wird beim Settings-Load/Save
 * in main.js durchgelassen. Keys die hier fehlen werden herausgefiltert!
 */
module.exports = {
    ui: {
        sidebar:        false,
        builder:        false,
        fav:            false,
        hist:           false,
        virtualScrolling: false
    },
    theme: 'dark',
    editor: {
        fontSize:     14,
        lineNumbers:  true,
        autocomplete: true,
        tabSize:      4
    },
    database: {
        autoLimit:    500,
        autoCheckpoint: true,
        // Aktive Datenbank: 'pglite' (Standard) oder 'postgresql'
        activeType:   'pglite',
        // PostgreSQL Connection String (nur wenn activeType === 'postgresql')
        postgresqlConnectionString: ''
    },
    ai: {
        enabled:  false,
        provider: 'ollama',
        apiKey:   '',
        model:    'llama3'
    },

    // ── Sovereign API-Bridge ────────────────────────────────────────────────
    // API Keys werden VERSCHLÜSSELT in der SQLite-DB gespeichert (database.js).
    // Dieses Objekt speichert nur Präferenzen, KEINE echten Schlüssel!
    apis: {
        // Globale Cache-Einstellung: true = Responses lokal archivieren
        globalCacheEnabled: true,

        // Standard-TTL in Stunden (falls pro API nichts gesetzt)
        defaultTtlHours: 24,

        // Retention pro API-Kategorie (Stunden; 0 = permanent)
        retention: {
            weather:     1,
            search:      12,
            maps:        72,
            finance:     0.25,
            news:        0,       // 0 = permanent archivieren
            translation: 168,
            calendar:    1,
            mail:        6,
            ai:          0,       // KI-Antworten nicht cachen
            custom:      24
        },

        // Auto-Archiv: historische Zeitreihen aufbauen
        autoArchive: {
            weather: true,
            finance: true,
            news:    true
        },

        // Zuletzt verwendete Provider
        defaultProviders: {
            weather:     'openweathermap',
            search:      'bing-search',
            maps:        'openstreetmap-nominatim'
        }
    }
};
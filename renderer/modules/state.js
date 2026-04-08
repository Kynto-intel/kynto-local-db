/* ── modules/state.js ─────────────────────────────────────────────────
   Zentraler State. Alle Module teilen dasselbe Objekt.
   ──────────────────────────────────────────────────────────────────── */

export const DUCK_TYPES = [
    'INTEGER','BIGINT','HUGEINT','DOUBLE','FLOAT','DECIMAL(18,2)',
    'VARCHAR','TEXT','BOOLEAN','DATE','TIMESTAMP','TIME','INTERVAL',
    'JSON','BLOB','UUID','LIST','MAP'
];

export const state = {
    // ── Aktiver Datenbank-Modus ────────────────────────────────────────
    // 'pglite' (Standard) | 'remote' (PostgreSQL Server) | 'duckdb_import' (Datenimport)
    dbMode: 'pglite',

    // ── Säule A: PGlite (Hauptdatenbank) ───────────────────────────────
    activeDbId: null,  // PGlite DB ID
    pgId:       null,  // Alias für activeDbId (Rückwärtskompatibilität)

    // ── Säule B: PostgreSQL Server (Remote) ────────────────────────────
    progressServerConnection: null,
    serverConnectionString:   null,  // z.B. postgresql://user:pass@localhost:5432/db

    // ── Säule C: DuckDB (nur für Datenimport) ──────────────────────────
    duckDbPath: null,  // Pfad zu .ddb Datei für Import
    importSourceDbId: null,

    // ── Tabellen-State ─────────────────────────────────────────────────
    knownTables:  [],
    knownColumns: {},
    columnMetadata: [], // Speichert die echten DB-Metadaten (Name, Typ, etc.)
    currentTable:   null,
    currentCols:    [],
    currentTableType: null,
    currentSchema:  null,
    currentSort:    { col: null, dir: 'ASC' },
    currentFilters: {},
    lastData:       [],
    currentLimit:   100, // Standard-Limit für Tabellenansicht
    currentPage:    1,   // Aktuelle Seite
    totalRows:      0,   // Gesamtzahl der Zeilen in der Tabelle
    totalPages:     1,   // Gesamtzahl der Seiten
    selectedRows:   new Set(),
    tableColors:    {}, // Mapping: tableName -> hexColor
    tableOrder:     {}, // Mapping: dbId -> [tableName, ...]
    tableBottomOrder: {}, // Mapping: dbId -> [tableName, ...] (für die Blacklist/Separierten)
    lastQueryDuration: 0,

    // ── SQL-Tabs ───────────────────────────────────────────────────────
    sqlTabs:   [],
    activeTab: null,

    // ── Persistierte Listen ────────────────────────────────────────────
    history:   [],
    favorites: [],

    // ── UI ─────────────────────────────────────────────────────────────
    isDark:         true,
    editor:         null,
    chartInst:      null,
    editorSettings: null,
    aiSettings:     null,
    magicEyeActive: false,
    magicMode:      'type',

    // ── Realtime ───────────────────────────────────────────────────────
    realtimeActive: false,  // Button-Status für Echtzeit-Synchronisierung
};
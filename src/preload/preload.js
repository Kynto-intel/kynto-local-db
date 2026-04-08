const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    // ── Debugging ──────────────────────────────────────────────────────
    log: (msg) => ipcRenderer.send('app:log', msg),

    // ── PGlite SQL (STANDARD) ──────────────────────────────────────────
    query:         (sql, dbId) => ipcRenderer.invoke('sql:query', { sql, dbId }),
    pgQuery:       (sql, pgId, params) => ipcRenderer.invoke('pg:query',       { sql, pgId, params }),
    pgTransaction: (pgId, statements)  => ipcRenderer.invoke('pg:transaction',  { pgId, statements }),

    // ── PGlite DB Management ───────────────────────────────────────────
    pgListDBs:  ()    => ipcRenderer.invoke('pg:list'),
    pgOpenDB:   ()    => ipcRenderer.invoke('pg:open'),
    pgCreateDB: ()    => ipcRenderer.invoke('pg:create'),
    pgCloseDB:  (id)  => ipcRenderer.invoke('pg:close',  id),

    // ── PGlite Schema ──────────────────────────────────────────────────
    pgTables:   (pgId)              => ipcRenderer.invoke('pg:tables',   pgId),
    pgDescribe: (pgId, tableName)   => ipcRenderer.invoke('pg:describe', { pgId, tableName }),
    pgColumns:  (pgId)              => ipcRenderer.invoke('pg:columns',  pgId),
    pgSize:     (pgId)              => ipcRenderer.invoke('pg:size',     pgId),

    // ── File Dialogs & IO ──────────────────────────────────────────────
    openFile:     (opts) => ipcRenderer.invoke('dialog:open',         opts),
    saveFile:     (opts) => ipcRenderer.invoke('dialog:save',         opts),
    selectFolder: ()     => ipcRenderer.invoke('dialog:select-folder'),
    writeFile:    (opts) => ipcRenderer.invoke('file:write',          opts),
    readFile:     (p)    => ipcRenderer.invoke('file:read',           p),
    writeBinary:  (opts) => ipcRenderer.invoke('file:write-binary',   opts),
    readBinary:   (p)    => ipcRenderer.invoke('file:read-binary',    p),
    exists:       (p)    => ipcRenderer.invoke('file:exists',         p),
    mkdir:        (p)    => ipcRenderer.invoke('file:mkdir',          p),
    readdir:      (p)    => ipcRenderer.invoke('file:readdir',        p),
    unlink:       (p)    => ipcRenderer.invoke('file:unlink',         p),
    getFileSize:  (p)    => ipcRenderer.invoke('file:size',           p),

    // ── CSV Import ─────────────────────────────────────────────────────
    csvImportFile: (filePath) => ipcRenderer.invoke('csv:import-file', { filePath }),

    // ── History & Favorites ────────────────────────────────────────────
    loadHistory:   ()  => ipcRenderer.invoke('history:load'),
    saveHistory:   (d) => ipcRenderer.invoke('history:save',   d),
    loadFavorites: ()  => ipcRenderer.invoke('favorites:load'),
    saveFavorites: (d) => ipcRenderer.invoke('favorites:save', d),

    // ── Settings ───────────────────────────────────────────────────────
    loadSettings: ()  => ipcRenderer.invoke('settings:load'),
    saveSettings: (d) => ipcRenderer.invoke('settings:save', d),

    // ── API Keys ───────────────────────────────────────────────────────
    loadApiKeys:  ()     => ipcRenderer.invoke('api-keys:load'),
    addApiKey:    (data) => ipcRenderer.invoke('api-keys:add', data),
    deleteApiKey: (idx)  => ipcRenderer.invoke('api-keys:delete', idx),

    // ── KI Assistent ───────────────────────────────────────────────────
    aiGenerate: (p) => ipcRenderer.invoke('ai:generate', p),

    // ── ProgressSQL Server ─────────────────────────────────────────────
    serverConnect:     (cs)              => ipcRenderer.invoke('progresssql:connect',     cs),
    serverDisconnect:  (cs)              => ipcRenderer.invoke('progresssql:disconnect',  cs),
    serverQuery:       (cs, sql, p)      => ipcRenderer.invoke('progresssql:query',       { connectionString: cs, sql, params: p }),
    serverTables:      (cs)              => ipcRenderer.invoke('progresssql:tables',      cs),
    serverDescribe:    (cs, tableName)   => ipcRenderer.invoke('progresssql:describe',    { connectionString: cs, tableName }),
    serverTransaction: (cs, statements)  => ipcRenderer.invoke('progresssql:transaction', { connectionString: cs, statements }),

    // ── Database Engine (NEUE ZENTRALE SCHICHT) ────────────────────────
    dbQuery:           (sql, params, dbType) => ipcRenderer.invoke('db:query',         { sql, params, dbType }),
    dbMultiQuery:      (sql, dbType)          => ipcRenderer.invoke('db:multi-query',   { sql, dbType }),
    dbTransaction:     (statements, dbType)   => ipcRenderer.invoke('db:transaction',   { statements, dbType }),
    dbTables:          (dbType)               => ipcRenderer.invoke('db:tables',        { dbType }),
    dbDescribe:        (tableName, dbType)    => ipcRenderer.invoke('db:describe',      { tableName, dbType }),
    dbColumns:         (dbType)               => ipcRenderer.invoke('db:columns',       { dbType }),
    dbSize:            (dbType)               => ipcRenderer.invoke('db:size',          { dbType }),
    dbStatus:          ()                     => ipcRenderer.invoke('db:status'),
    dbRegisterRemote:  (connectionString)     => ipcRenderer.invoke('db:register-remote', connectionString),

    // ── Sync Engine ────────────────────────────────────────────────────
    // Signaturen:
    //   syncPGliteToServer(pgId, cs, tables)  → pgId zuerst
    //   syncServerToLocal(cs, pgId, tables)   → connectionString zuerst
    syncPGliteToServer: (pgId, cs, tables) => ipcRenderer.invoke('sync:pglite-to-server', { pgId, connectionString: cs, tables }),
    syncServerToLocal:  (cs, pgId, tables) => ipcRenderer.invoke('sync:server-to-local',  { connectionString: cs, pgId, tables }),

    // FIX: onSyncProgress ist die einzige Sync-Progress-Quelle.
    // Der doppelte CustomEvent-Dispatch am Ende der Datei wurde entfernt,
    // da er zu doppelten Updates und Race-Conditions führte.
    onSyncProgress:  (cb) => ipcRenderer.on('sync:progress', (_, data) => cb(data)),
    offSyncProgress: ()   => ipcRenderer.removeAllListeners('sync:progress'),

    // ── Storage Manager ────────────────────────────────────────────────
    openStorageManager: () => ipcRenderer.send('open-storage-manager'),
    closeStorageManager: () => ipcRenderer.send('close-storage-manager'),

    // ── Instant API (PostgREST) ────────────────────────────────────────
    instantApiStart:     (connectionString, port) => ipcRenderer.invoke('instant-api:start',      { connectionString, port }),
    instantApiStop:      (connectionString)       => ipcRenderer.invoke('instant-api:stop',       { connectionString }),
    instantApiStatus:    (connectionString)       => ipcRenderer.invoke('instant-api:status',     { connectionString }),
    instantApiEndpoints: (connectionString)       => ipcRenderer.invoke('instant-api:endpoints',  { connectionString }),
    instantApiDocs:      (connectionString)       => ipcRenderer.invoke('instant-api:docs',       { connectionString }),
    instantApiOpenBrowser: (url)                  => ipcRenderer.invoke('instant-api:open-browser', { url }),

    // ── RLS Policies ────────────────────────────────────────────────────
    policyLoad:                    (schema, table) => ipcRenderer.invoke('policy:load', schema, table),
    policyCreate:                  (data) => ipcRenderer.invoke('policy:create', data),
    policyUpdate:                  (data, original) => ipcRenderer.invoke('policy:update', data, original),
    policyDelete:                  (name, schema, table) => ipcRenderer.invoke('policy:delete', name, schema, table),
    policyEnableRLS:               (schema, table) => ipcRenderer.invoke('policy:enable-rls', schema, table),
    policyDisableRLS:              (schema, table) => ipcRenderer.invoke('policy:disable-rls', schema, table),
    policyGetTablesWithRLSStatus:  () => ipcRenderer.invoke('policy:get-tables'),
    policyGetTemplates:            () => ipcRenderer.invoke('policy:get-templates'),
    policyGetTemplate:             (id) => ipcRenderer.invoke('policy:get-template', id),
    policyGenerateFromTemplate:    (id, schema, table, values) => ipcRenderer.invoke('policy:generate-from-template', id, schema, table, values),

    // ── README Editor API (Integriert in Haupt-API) ─────────────────────
    /** Speichert den gesamten Editor-Zustand nach DATA_DIR/editor-data.json */
    editorSaveData: (data) => ipcRenderer.invoke('editor:saveData', data),

    /** Lädt editor-data.json. Gibt null zurück wenn noch keine Datei existiert. */
    editorLoadData: () => ipcRenderer.invoke('editor:loadData'),

    /** Schreibt HTML direkt in eine verknüpfte Datei (Update ohne Dialog). */
    editorWriteHtmlFile: (filePath, content) => ipcRenderer.invoke('editor:writeHtmlFile', filePath, content),

    /** Öffnet einen Datei-Dialog zum Auswählen einer bestehenden HTML-Datei. */
    editorOpenHtmlFile: () => ipcRenderer.invoke('editor:openHtmlFile'),

    /** Öffnet einen Speichern-Dialog für eine neue HTML-Datei. */
    editorSaveHtmlFile: (content) => ipcRenderer.invoke('editor:saveHtmlFile', content),
});

// Exponiere das electronAPI-Objekt für Storage-Manager-Events, wie vom Renderer erwartet
contextBridge.exposeInMainWorld('electronAPI', {
    // removeAllListeners VOR .on() — verhindert gestapelte Listener bei
    // mehrfachem Öffnen/Schließen (ipcRenderer.on akkumuliert sonst).
    onShowStorageManager: (callback) => {
        ipcRenderer.removeAllListeners('show-storage-manager');
        ipcRenderer.on('show-storage-manager', () => callback());
    },
    onHideStorageManager: (callback) => {
        ipcRenderer.removeAllListeners('hide-storage-manager');
        ipcRenderer.on('hide-storage-manager', () => callback());
    },
    removeStorageManagerListeners: () => {
        ipcRenderer.removeAllListeners('show-storage-manager');
        ipcRenderer.removeAllListeners('hide-storage-manager');
    }
});

// ENTFERNT: Der doppelte ipcRenderer.on('sync:progress') Block wurde hier
// absichtlich entfernt. Er erzeugte einen zweiten CustomEvent 'sync-progress'
// parallel zu window.api.onSyncProgress — das führte zu doppelten Render-
// Aufrufen und in manchen Fällen zu falschen State-Updates.
//
// sync-center-progress.js nutzt ausschließlich window.api.onSyncProgress().
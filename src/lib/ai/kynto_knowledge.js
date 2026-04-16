/**
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │ kynto_knowledge.js  v2.0                                                    │
 * │ Hochkomplexes KI-Langzeitgedächtnis für Kynto                               │
 * │                                                                              │
 * │ SCHEMA-ÜBERSICHT                                                             │
 * │  ┌──────────────────────┐    ┌──────────────────────┐                       │
 * │  │  kynto_knowledge     │    │  kynto_chat_history  │                       │
 * │  │  (Wissensbasis)      │    │  (Konversationen)    │                       │
 * │  └──────────────────────┘    └──────────────────────┘                       │
 * │           │                            │                                     │
 * │  ┌──────────────────────┐    ┌──────────────────────┐                       │
 * │  │  kynto_knowledge_    │    │  kynto_sessions      │                       │
 * │  │  tags  (Verschlag-   │    │  (Session-Metadaten) │                       │
 * │  │  wortung M:N)        │    └──────────────────────┘                       │
 * │  └──────────────────────┘                                                   │
 * │  ┌──────────────────────┐    ┌──────────────────────┐                       │
 * │  │  kynto_knowledge_    │    │  kynto_knowledge_    │                       │
 * │  │  relations (Wissen   │    │  audit (Änderungs-   │                       │
 * │  │  verknüpft Wissen)   │    │  historie / Audit)   │                       │
 * │  └──────────────────────┘    └──────────────────────┘                       │
 * │                                                                              │
 * │ VERANTWORTLICHKEITEN                                                         │
 * │  1.  Alle Tabellen erstellen (vollständiges Schema)                          │
 * │  2.  Existenz prüfen (robust, Boolean-safe)                                  │
 * │  3.  Wissen für System-Prompt abrufen                                        │
 * │  4.  Wissen speichern / aktualisieren (Upsert mit Audit-Trail)               │
 * │  5.  Chat-Nachrichten speichern                                              │
 * │  6.  Chat-Verlauf abrufen                                                    │
 * │  7.  Sessions verwalten                                                      │
 * │  8.  Wissen suchen & filtern                                                 │
 * │  9.  Wissen verknüpfen (Relations)                                           │
 * │  10. Tabellen DROP                                                           │
 * └─────────────────────────────────────────────────────────────────────────────┘
 */

// ─────────────────────────────────────────────────────────────────────────────
// Tabellennamen — zentral definiert, damit alle Module konsistent bleiben
// ─────────────────────────────────────────────────────────────────────────────

export const KY_TABLE_NAME        = 'kynto_knowledge';
export const KY_CHAT_TABLE        = 'kynto_chat_history';
export const KY_SESSIONS_TABLE    = 'kynto_sessions';
export const KY_TAGS_TABLE        = 'kynto_knowledge_tags';
export const KY_RELATIONS_TABLE   = 'kynto_knowledge_relations';
export const KY_AUDIT_TABLE       = 'kynto_knowledge_audit';

// ─────────────────────────────────────────────────────────────────────────────
// Bekannte Kategorien (erweiterbar)
// ─────────────────────────────────────────────────────────────────────────────

export const KY_CATEGORIES = {
  SYSTEM:      'system',        // interne Kynto-Metadaten
  USER:        'user',          // Nutzer-Vorlieben & Einstellungen
  SQL:         'sql',           // SQL-Regeln, Muster, Konventionen
  SCHEMA:      'schema',        // Tabellen-Strukturen, Spalten, Typen
  CONTEXT:     'context',       // fachlicher Kontext, Domäne
  WORKFLOW:    'workflow',       // Arbeitsabläufe, Prozesse
  ERROR:       'error',         // bekannte Fehler + Lösungen
  FACT:        'fact',          // allgemeine Fakten
  PREFERENCE:  'preference',    // explizit gesetzte Vorlieben
  INSTRUCTION: 'instruction',   // vom Nutzer gegebene Anweisungen
};

// ─────────────────────────────────────────────────────────────────────────────
// 1. Vollständiges Schema erstellen
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Erstellt das gesamte Kynto-Gedächtnis-Schema in einem einzigen Aufruf.
 * Alle Statements werden einzeln ausgeführt (PGlite-kompatibel).
 *
 * @param {{ query: (sql: string, params?: any[]) => Promise<any> }} db
 * @returns {Promise<{ success: boolean, error?: any }>}
 */
export async function createKyntoKnowledgeTable(db) {
  const statements = [

    // ── 1. Haupt-Wissensspeicher ───────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS "${KY_TABLE_NAME}" (
      "id"           SERIAL           PRIMARY KEY,

      -- Inhalt
      "category"     VARCHAR(50)      NOT NULL DEFAULT 'general'
                     CHECK (category IN (
                       'system','user','sql','schema','context',
                       'workflow','error','fact','preference','instruction','general'
                     )),
      "topic"        VARCHAR(255)     NOT NULL UNIQUE,
      "content"      TEXT             NOT NULL,
      "summary"      VARCHAR(500),                 -- Kurz-Zusammenfassung für Prompt
      "source"       VARCHAR(255),                 -- Woher stammt das Wissen? (user/ai/import)
      "language"     VARCHAR(10)      NOT NULL DEFAULT 'de',

      -- Verknüpfungen
      "ref_table"    VARCHAR(255),                 -- Referenz auf eine Kynto-Tabelle
      "ref_column"   VARCHAR(255),                 -- Referenz auf eine Spalte
      "ref_id"       INTEGER,                      -- Referenz auf eine Zeile

      -- Qualität & Relevanz
      "importance"   SMALLINT         NOT NULL DEFAULT 1
                     CHECK (importance BETWEEN 1 AND 5),
      "confidence"   SMALLINT         NOT NULL DEFAULT 5
                     CHECK (confidence BETWEEN 1 AND 10),  -- 1=unsicher, 10=absolut sicher
      "access_count" INTEGER          NOT NULL DEFAULT 0,  -- wie oft wurde es abgerufen
      "last_used_at" TIMESTAMP,                            -- letzter Abruf

      -- Gültigkeit
      "valid_from"   TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "valid_until"  TIMESTAMP,                            -- NULL = dauerhaft gültig
      "is_active"    BOOLEAN          NOT NULL DEFAULT TRUE,
      "is_verified"  BOOLEAN          NOT NULL DEFAULT FALSE,

      -- Meta
      "created_by"   VARCHAR(50)      NOT NULL DEFAULT 'system',
      "updated_by"   VARCHAR(50)      NOT NULL DEFAULT 'system',
      "version"      INTEGER          NOT NULL DEFAULT 1,
      "created_at"   TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at"   TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE INDEX IF NOT EXISTS "idx_ky_category"
      ON "${KY_TABLE_NAME}" ("category")`,
    `CREATE INDEX IF NOT EXISTS "idx_ky_importance"
      ON "${KY_TABLE_NAME}" ("importance" DESC)`,
    `CREATE INDEX IF NOT EXISTS "idx_ky_active"
      ON "${KY_TABLE_NAME}" ("is_active") WHERE is_active = TRUE`,
    `CREATE INDEX IF NOT EXISTS "idx_ky_access"
      ON "${KY_TABLE_NAME}" ("access_count" DESC)`,
    `CREATE INDEX IF NOT EXISTS "idx_ky_ref_table"
      ON "${KY_TABLE_NAME}" ("ref_table") WHERE ref_table IS NOT NULL`,

    // Initialer Identitäts-Eintrag
    `INSERT INTO "${KY_TABLE_NAME}"
      ("category","topic","content","summary","importance","confidence","created_by","updated_by","is_verified")
    VALUES (
      'system',
      'kynto_identity',
      'Ich bin Kynto, ein KI-Assistent für Datenbankoperationen. Mein Langzeitgedächtnis ist aktiv (v2.0). Ich lerne kontinuierlich SQL-Regeln, Tabellenstrukturen, Nutzervorlieben und Arbeitsabläufe.',
      'Kynto KI-Gedächtnis v2.0 aktiv',
      5, 10, 'system', 'system', TRUE
    )
    ON CONFLICT ("topic") DO NOTHING`,

    // ── 2. Sessions ───────────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS "${KY_SESSIONS_TABLE}" (
      "id"            SERIAL          PRIMARY KEY,
      "session_id"    VARCHAR(64)     NOT NULL UNIQUE,
      "session_name"  VARCHAR(255),
      "user_agent"    TEXT,
      "db_mode"       VARCHAR(20),                -- local / remote / pglite
      "active_table"  VARCHAR(255),               -- aktive Tabelle beim Start
      "message_count" INTEGER         NOT NULL DEFAULT 0,
      "token_count"   INTEGER         NOT NULL DEFAULT 0,  -- geschätzte Tokens
      "started_at"    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "last_active_at" TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "ended_at"      TIMESTAMP,
      "metadata"      TEXT            -- JSON-Blob für beliebige Extra-Daten
    )`,

    `CREATE INDEX IF NOT EXISTS "idx_kyses_session"
      ON "${KY_SESSIONS_TABLE}" ("session_id")`,
    `CREATE INDEX IF NOT EXISTS "idx_kyses_started"
      ON "${KY_SESSIONS_TABLE}" ("started_at" DESC)`,

    // ── 3. Chat-Verlauf ───────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS "${KY_CHAT_TABLE}" (
      "id"            SERIAL          PRIMARY KEY,
      "session_id"    VARCHAR(64)     NOT NULL,
      "role"          VARCHAR(20)     NOT NULL
                      CHECK (role IN ('user','assistant','system','tool')),
      "content"       TEXT            NOT NULL,
      "content_type"  VARCHAR(20)     NOT NULL DEFAULT 'text'
                      CHECK (content_type IN ('text','sql','json','error','markdown')),

      -- Verknüpfung mit Wissen
      "knowledge_id"  INTEGER,        -- welcher kynto_knowledge-Eintrag wurde dadurch erstellt?

      -- Qualität
      "token_count"   INTEGER         NOT NULL DEFAULT 0,
      "latency_ms"    INTEGER,                    -- Antwortzeit der KI in ms
      "model"         VARCHAR(100),               -- welches Modell hat geantwortet
      "is_edited"     BOOLEAN         NOT NULL DEFAULT FALSE,
      "is_deleted"    BOOLEAN         NOT NULL DEFAULT FALSE,

      -- Zeitstempel
      "created_at"    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "edited_at"     TIMESTAMP
    )`,

    `CREATE INDEX IF NOT EXISTS "idx_kyc_session"
      ON "${KY_CHAT_TABLE}" ("session_id", "created_at" DESC)`,
    `CREATE INDEX IF NOT EXISTS "idx_kyc_role"
      ON "${KY_CHAT_TABLE}" ("role")`,
    `CREATE INDEX IF NOT EXISTS "idx_kyc_knowledge"
      ON "${KY_CHAT_TABLE}" ("knowledge_id") WHERE knowledge_id IS NOT NULL`,

    // ── 4. Tags (M:N zu kynto_knowledge) ─────────────────────────────────
    `CREATE TABLE IF NOT EXISTS "${KY_TAGS_TABLE}" (
      "id"            SERIAL          PRIMARY KEY,
      "knowledge_id"  INTEGER         NOT NULL,
      "tag"           VARCHAR(100)    NOT NULL,
      "created_at"    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE ("knowledge_id", "tag")
    )`,

    `CREATE INDEX IF NOT EXISTS "idx_kyt_knowledge"
      ON "${KY_TAGS_TABLE}" ("knowledge_id")`,
    `CREATE INDEX IF NOT EXISTS "idx_kyt_tag"
      ON "${KY_TAGS_TABLE}" ("tag")`,

    // ── 5. Wissen-Relationen (Wissen verknüpft Wissen) ───────────────────
    `CREATE TABLE IF NOT EXISTS "${KY_RELATIONS_TABLE}" (
      "id"              SERIAL         PRIMARY KEY,
      "source_id"       INTEGER        NOT NULL,
      "target_id"       INTEGER        NOT NULL,
      "relation_type"   VARCHAR(50)    NOT NULL DEFAULT 'related'
                        CHECK (relation_type IN (
                          'related','contradicts','extends','replaces',
                          'requires','example_of','derived_from'
                        )),
      "strength"        SMALLINT       NOT NULL DEFAULT 3
                        CHECK (strength BETWEEN 1 AND 5),
      "note"            TEXT,
      "created_at"      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE ("source_id","target_id","relation_type")
    )`,

    `CREATE INDEX IF NOT EXISTS "idx_kyr_source"
      ON "${KY_RELATIONS_TABLE}" ("source_id")`,
    `CREATE INDEX IF NOT EXISTS "idx_kyr_target"
      ON "${KY_RELATIONS_TABLE}" ("target_id")`,

    // ── 6. Audit-Log (jede Änderung wird protokolliert) ──────────────────
    `CREATE TABLE IF NOT EXISTS "${KY_AUDIT_TABLE}" (
      "id"              SERIAL         PRIMARY KEY,
      "knowledge_id"    INTEGER        NOT NULL,
      "action"          VARCHAR(20)    NOT NULL
                        CHECK (action IN ('INSERT','UPDATE','DELETE','ACCESS')),
      "old_content"     TEXT,
      "new_content"     TEXT,
      "old_importance"  SMALLINT,
      "new_importance"  SMALLINT,
      "changed_by"      VARCHAR(50)    NOT NULL DEFAULT 'system',
      "session_id"      VARCHAR(64),
      "change_note"     TEXT,
      "created_at"      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE INDEX IF NOT EXISTS "idx_kya_knowledge"
      ON "${KY_AUDIT_TABLE}" ("knowledge_id")`,
    `CREATE INDEX IF NOT EXISTS "idx_kya_action"
      ON "${KY_AUDIT_TABLE}" ("action")`,
    `CREATE INDEX IF NOT EXISTS "idx_kya_created"
      ON "${KY_AUDIT_TABLE}" ("created_at" DESC)`,
  ];

  try {
    for (const sql of statements) {
      await db.query(sql);
    }
    console.log(`✅ [kynto_knowledge v2] Alle ${statements.length} Statements erfolgreich ausgeführt.`);
    return { success: true };
  } catch (error) {
    console.error('[kynto_knowledge v2] Fehler beim Erstellen des Schemas:', error);
    return { success: false, error };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1b. Schema komplett löschen
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Löscht alle Kynto-Gedächtnis-Tabellen vollständig.
 * ACHTUNG: Alle gespeicherten Daten gehen unwiderruflich verloren!
 *
 * @param {{ query: (sql: string) => Promise<any> }} db
 */
export async function dropKyntoKnowledgeTables(db) {
  // Reihenfolge wichtig: abhängige Tabellen zuerst
  const tables = [
    KY_AUDIT_TABLE,
    KY_RELATIONS_TABLE,
    KY_TAGS_TABLE,
    KY_CHAT_TABLE,
    KY_SESSIONS_TABLE,
    KY_TABLE_NAME,
  ];
  try {
    for (const t of tables) {
      await db.query(`DROP TABLE IF EXISTS "${t}"`);
    }
    console.log(`🗑️ [kynto_knowledge v2] Alle Tabellen gelöscht.`);
    return { success: true };
  } catch (error) {
    console.error('[kynto_knowledge v2] Fehler beim Löschen:', error);
    return { success: false, error };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Existenz prüfen (Boolean-safe — Fix für PGlite/String-Returns)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Gibt true zurück wenn die Haupt-Wissenstabelle existiert.
 * Behandelt sowohl boolean TRUE als auch den String "true" korrekt.
 *
 * @param {{ query: (sql: string) => Promise<any> }} db
 * @returns {Promise<boolean>}
 */
export async function checkKnowledgeActive(db) {
  try {
    const result = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE  table_schema = 'public'
          AND  table_name   = '${KY_TABLE_NAME}'
      ) AS "exists"
    `);

    if (!result || result.length === 0) return false;

    // PGlite gibt manchmal einen String statt boolean zurück → robuster Check
    const val = result[0]?.exists ?? result[0]?.['exists'];
    return val === true || val === 'true' || val === 't' || val === 1;
  } catch (error) {
    console.error('[kynto_knowledge v2] checkKnowledgeActive Fehler:', error);
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Wissen für System-Prompt abrufen (mit access_count Update)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Liefert das gespeicherte Langzeit-Wissen als formatierten Textblock
 * für den System-Prompt. Aktualisiert access_count + last_used_at.
 *
 * @param {{ query: (sql: string, params?: any[]) => Promise<any> }} db
 * @param {{ limit?: number, categories?: string[], minImportance?: number }} [opts]
 * @returns {Promise<string>}
 */
export async function getKnowledgeForPrompt(db, {
  limit        = 50,
  categories   = null,
  minImportance = 1,
} = {}) {
  try {
    let where = `WHERE is_active = TRUE AND importance >= ${parseInt(minImportance, 10)}`;

    if (categories && categories.length > 0) {
      const cats = categories.map(c => `'${c.replace(/'/g, "''")}'`).join(',');
      where += ` AND category IN (${cats})`;
    }

    const rows = await db.query(`
      SELECT "id", "topic", "content", "summary", "category",
             "ref_table", "ref_column", "importance", "confidence",
             "valid_until", "language"
      FROM   "${KY_TABLE_NAME}"
      ${where}
        AND  (valid_until IS NULL OR valid_until > CURRENT_TIMESTAMP)
      ORDER  BY "importance" DESC, "access_count" DESC, "updated_at" DESC
      LIMIT  ${parseInt(limit, 10)}
    `);

    if (!rows || rows.length === 0) return '';

    // access_count + last_used_at für abgerufene Einträge aktualisieren
    const ids = rows.map(r => r.id).filter(Boolean);
    if (ids.length > 0) {
      await db.query(`
        UPDATE "${KY_TABLE_NAME}"
        SET    "access_count" = "access_count" + 1,
               "last_used_at" = CURRENT_TIMESTAMP
        WHERE  "id" IN (${ids.join(',')})
      `).catch(e => console.warn('[kynto_knowledge v2] access_count Update fehlgeschlagen:', e));
    }

    // Formatierter Block für den System-Prompt
    let text = '\n══ KYNTO LANGZEITGEDÄCHTNIS ══\n';

    const grouped = {};
    for (const row of rows) {
      if (!grouped[row.category]) grouped[row.category] = [];
      grouped[row.category].push(row);
    }

    for (const [cat, entries] of Object.entries(grouped)) {
      text += `\n▸ ${cat.toUpperCase()}\n`;
      for (const row of entries) {
        const ref  = row.ref_table ? ` [→${row.ref_table}${row.ref_column ? '.' + row.ref_column : ''}]` : '';
        const conf = row.confidence < 7 ? ` (Konfidenz: ${row.confidence}/10)` : '';
        // summary wenn vorhanden, sonst content (max 300 Zeichen)
        const display = (row.summary || row.content || '').slice(0, 300);
        text += `  • ${row.topic}${ref}${conf}: ${display}\n`;
      }
    }

    text += '══════════════════════════════\n';
    return text;

  } catch (error) {
    console.error('[kynto_knowledge v2] getKnowledgeForPrompt Fehler:', error);
    return '';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Wissen speichern (Upsert mit Audit-Trail + optionale Tags)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Speichert oder aktualisiert einen Wissenseintrag inkl. Audit-Log.
 *
 * @param {{ query: (sql: string, params: any[]) => Promise<any> }} db
 * @param {object} opts
 * @param {string}   opts.topic
 * @param {string}   opts.content
 * @param {string}   [opts.category='general']
 * @param {string}   [opts.summary]
 * @param {string}   [opts.source='ai']
 * @param {string}   [opts.refTable]
 * @param {string}   [opts.refColumn]
 * @param {number}   [opts.refId]
 * @param {number}   [opts.importance=2]
 * @param {number}   [opts.confidence=7]
 * @param {string}   [opts.language='de']
 * @param {string[]} [opts.tags]
 * @param {string}   [opts.sessionId]
 * @param {string}   [opts.updatedBy='ai']
 * @param {string}   [opts.validUntil]       ISO-Date-String oder null
 * @returns {Promise<{ success: boolean, id?: number }>}
 */
export async function saveKnowledge(db, {
  topic,
  content,
  category    = 'general',
  summary     = null,
  source      = 'ai',
  refTable    = null,
  refColumn   = null,
  refId       = null,
  importance  = 2,
  confidence  = 7,
  language    = 'de',
  tags        = [],
  sessionId   = null,
  updatedBy   = 'ai',
  validUntil  = null,
} = {}) {
  if (!topic || !content) {
    console.error('[kynto_knowledge v2] saveKnowledge: topic und content sind Pflichtfelder.');
    return { success: false };
  }

  try {
    // Alten Eintrag für Audit laden
    let oldRow = null;
    try {
      const existing = await db.query(
        `SELECT "id","content","importance" FROM "${KY_TABLE_NAME}" WHERE "topic" = $1`,
        [topic]
      );
      if (existing && existing.length > 0) oldRow = existing[0];
    } catch { /* noch nicht vorhanden */ }

    // Upsert
    const upsertSQL = `
      INSERT INTO "${KY_TABLE_NAME}"
        ("topic","content","category","summary","source","ref_table","ref_column",
         "ref_id","importance","confidence","language","valid_until",
         "updated_by","updated_at","version")
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,
              ${validUntil ? `'${validUntil}'` : 'NULL'},
              $12, CURRENT_TIMESTAMP, 1)
      ON CONFLICT ("topic") DO UPDATE SET
        "content"    = EXCLUDED."content",
        "category"   = EXCLUDED."category",
        "summary"    = EXCLUDED."summary",
        "source"     = EXCLUDED."source",
        "ref_table"  = EXCLUDED."ref_table",
        "ref_column" = EXCLUDED."ref_column",
        "ref_id"     = EXCLUDED."ref_id",
        "importance" = EXCLUDED."importance",
        "confidence" = EXCLUDED."confidence",
        "language"   = EXCLUDED."language",
        "valid_until"= EXCLUDED."valid_until",
        "updated_by" = EXCLUDED."updated_by",
        "updated_at" = CURRENT_TIMESTAMP,
        "version"    = "${KY_TABLE_NAME}"."version" + 1
      RETURNING "id"
    `;

    const result = await db.query(upsertSQL, [
      topic, content, category, summary, source,
      refTable, refColumn, refId,
      importance, confidence, language, updatedBy,
    ]);

    const knowledgeId = result?.[0]?.id;

    // Audit-Eintrag
    if (knowledgeId) {
      const action = oldRow ? 'UPDATE' : 'INSERT';
      await db.query(
        `INSERT INTO "${KY_AUDIT_TABLE}"
          ("knowledge_id","action","old_content","new_content",
           "old_importance","new_importance","changed_by","session_id")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          knowledgeId, action,
          oldRow?.content  ?? null, content,
          oldRow?.importance ?? null, importance,
          updatedBy, sessionId,
        ]
      ).catch(e => console.warn('[kynto_knowledge v2] Audit-Eintrag fehlgeschlagen:', e));

      // Tags speichern
      if (tags && tags.length > 0) {
        for (const tag of tags) {
          await db.query(
            `INSERT INTO "${KY_TAGS_TABLE}" ("knowledge_id","tag")
             VALUES ($1,$2)
             ON CONFLICT ("knowledge_id","tag") DO NOTHING`,
            [knowledgeId, tag.toLowerCase().trim()]
          ).catch(() => {});
        }
      }
    }

    return { success: true, id: knowledgeId };
  } catch (error) {
    console.error('[kynto_knowledge v2] saveKnowledge Fehler:', error);
    return { success: false, error };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Chat-Nachricht speichern (mit Session-Update)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Speichert eine Chat-Nachricht und aktualisiert die zugehörige Session.
 *
 * @param {{ query: (sql: string, params: any[]) => Promise<any> }} db
 * @param {object} opts
 * @param {'user'|'assistant'|'system'|'tool'} opts.role
 * @param {string}  opts.content
 * @param {string}  opts.sessionId
 * @param {string}  [opts.contentType='text']
 * @param {number}  [opts.knowledgeId]
 * @param {number}  [opts.tokenCount=0]
 * @param {number}  [opts.latencyMs]
 * @param {string}  [opts.model]
 * @returns {Promise<boolean>}
 */
export async function saveChatMessage(db, role, content, sessionId = null, {
  contentType = 'text',
  knowledgeId = null,
  tokenCount  = 0,
  latencyMs   = null,
  model       = null,
} = {}) {
  if (!content || !role) return false;

  try {
    await db.query(
      `INSERT INTO "${KY_CHAT_TABLE}"
        ("session_id","role","content","content_type","knowledge_id",
         "token_count","latency_ms","model")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [sessionId, role, content, contentType, knowledgeId,
       tokenCount, latencyMs, model]
    );

    // Session-Statistik aktualisieren (oder Session anlegen)
    if (sessionId) {
      await db.query(
        `INSERT INTO "${KY_SESSIONS_TABLE}" ("session_id","message_count","token_count","last_active_at")
         VALUES ($1, 1, $2, CURRENT_TIMESTAMP)
         ON CONFLICT ("session_id") DO UPDATE SET
           "message_count"  = "${KY_SESSIONS_TABLE}"."message_count" + 1,
           "token_count"    = "${KY_SESSIONS_TABLE}"."token_count" + $2,
           "last_active_at" = CURRENT_TIMESTAMP`,
        [sessionId, tokenCount]
      ).catch(e => console.warn('[kynto_knowledge v2] Session-Update fehlgeschlagen:', e));
    }

    return true;
  } catch (error) {
    console.error('[kynto_knowledge v2] saveChatMessage Fehler:', error);
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Chat-Verlauf abrufen
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Liefert die letzten N Chat-Nachrichten einer Session in chronologischer
 * Reihenfolge (älteste zuerst) — direkt als Messages-Array für die KI-API.
 *
 * @param {{ query: (sql: string, params?: any[]) => Promise<any> }} db
 * @param {{ limit?: number, sessionId?: string, includeDeleted?: boolean }} [opts]
 * @returns {Promise<Array<{role: string, content: string}>>}
 */
export async function getRecentChat(db, {
  limit          = 30,
  sessionId      = null,
  includeDeleted = false,
} = {}) {
  try {
    const params = [];
    let where = `WHERE is_deleted = FALSE`;

    if (!includeDeleted) where += ` AND is_deleted = FALSE`;
    if (sessionId) {
      params.push(sessionId);
      where += ` AND session_id = $${params.length}`;
    }

    const rows = await db.query(
      `SELECT "role", "content", "content_type", "created_at"
       FROM   "${KY_CHAT_TABLE}"
       ${where}
       ORDER  BY "created_at" DESC
       LIMIT  ${parseInt(limit, 10)}`,
      params
    );

    if (!rows || rows.length === 0) return [];

    // Umkehren: älteste Nachricht zuerst (für Multi-Turn-Kontext)
    return rows.reverse().map(r => ({
      role:    r.role,
      content: r.content,
    }));
  } catch (error) {
    console.error('[kynto_knowledge v2] getRecentChat Fehler:', error);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. Session verwalten
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Erstellt eine neue Session oder gibt die vorhandene zurück.
 *
 * @param {{ query: (sql: string, params: any[]) => Promise<any> }} db
 * @param {string} sessionId
 * @param {{ dbMode?: string, activeTable?: string, userAgent?: string, metadata?: object }} [meta]
 * @returns {Promise<boolean>}
 */
export async function ensureSession(db, sessionId, meta = {}) {
  if (!sessionId) return false;
  try {
    await db.query(
      `INSERT INTO "${KY_SESSIONS_TABLE}"
        ("session_id","db_mode","active_table","user_agent","metadata")
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT ("session_id") DO UPDATE SET
         "last_active_at" = CURRENT_TIMESTAMP`,
      [
        sessionId,
        meta.dbMode      ?? null,
        meta.activeTable ?? null,
        meta.userAgent   ?? null,
        meta.metadata    ? JSON.stringify(meta.metadata) : null,
      ]
    );
    return true;
  } catch (error) {
    console.error('[kynto_knowledge v2] ensureSession Fehler:', error);
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. Wissen suchen & filtern
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Durchsucht das Wissen nach einem Suchbegriff (ILIKE auf topic + content).
 *
 * @param {{ query: (sql: string, params: any[]) => Promise<any> }} db
 * @param {string} searchTerm
 * @param {{ limit?: number, category?: string }} [opts]
 * @returns {Promise<Array>}
 */
export async function searchKnowledge(db, searchTerm, { limit = 20, category = null } = {}) {
  if (!searchTerm) return [];
  try {
    const params = [`%${searchTerm}%`, `%${searchTerm}%`];
    let catFilter = '';
    if (category) {
      params.push(category);
      catFilter = `AND category = $${params.length}`;
    }

    const rows = await db.query(
      `SELECT "id","topic","content","summary","category","importance","confidence"
       FROM   "${KY_TABLE_NAME}"
       WHERE  is_active = TRUE
         AND  (topic ILIKE $1 OR content ILIKE $2)
         ${catFilter}
       ORDER  BY "importance" DESC, "confidence" DESC
       LIMIT  ${parseInt(limit, 10)}`,
      params
    );
    return rows || [];
  } catch (error) {
    console.error('[kynto_knowledge v2] searchKnowledge Fehler:', error);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. Wissen verknüpfen
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Erstellt eine Relation zwischen zwei Wissens-Einträgen.
 *
 * @param {{ query: (sql: string, params: any[]) => Promise<any> }} db
 * @param {number} sourceId
 * @param {number} targetId
 * @param {string} [relationType='related']
 * @param {number} [strength=3]
 * @param {string} [note]
 * @returns {Promise<boolean>}
 */
export async function linkKnowledge(db, sourceId, targetId, relationType = 'related', strength = 3, note = null) {
  try {
    await db.query(
      `INSERT INTO "${KY_RELATIONS_TABLE}"
        ("source_id","target_id","relation_type","strength","note")
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT ("source_id","target_id","relation_type") DO UPDATE SET
         "strength" = $4, "note" = $5`,
      [sourceId, targetId, relationType, strength, note]
    );
    return true;
  } catch (error) {
    console.error('[kynto_knowledge v2] linkKnowledge Fehler:', error);
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 10. Statistiken abrufen (für Settings-Tab)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Gibt eine Zusammenfassung des aktuellen Gedächtnis-Status zurück.
 *
 * @param {{ query: (sql: string) => Promise<any> }} db
 * @returns {Promise<object>}
 */
export async function getKnowledgeStats(db) {
  try {
    const [knowledgeRows, chatRows, sessionRows] = await Promise.all([
      db.query(`SELECT COUNT(*) AS "total",
                       SUM(CASE WHEN is_active THEN 1 ELSE 0 END) AS "active",
                       AVG(importance)::NUMERIC(3,1) AS "avg_importance"
                FROM "${KY_TABLE_NAME}"`),
      db.query(`SELECT COUNT(*) AS "total" FROM "${KY_CHAT_TABLE}" WHERE is_deleted = FALSE`),
      db.query(`SELECT COUNT(*) AS "total" FROM "${KY_SESSIONS_TABLE}"`),
    ]);

    return {
      knowledge: {
        total:          parseInt(knowledgeRows?.[0]?.total ?? 0),
        active:         parseInt(knowledgeRows?.[0]?.active ?? 0),
        avgImportance:  parseFloat(knowledgeRows?.[0]?.avg_importance ?? 0),
      },
      chat: {
        total: parseInt(chatRows?.[0]?.total ?? 0),
      },
      sessions: {
        total: parseInt(sessionRows?.[0]?.total ?? 0),
      },
    };
  } catch (error) {
    console.error('[kynto_knowledge v2] getKnowledgeStats Fehler:', error);
    return { knowledge: {}, chat: {}, sessions: {} };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 11. Einen einzelnen Eintrag deaktivieren (Soft-Delete)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Deaktiviert einen Eintrag (is_active = FALSE) ohne ihn zu löschen.
 *
 * @param {{ query: (sql: string, params: any[]) => Promise<any> }} db
 * @param {number|string} idOrTopic  — ID (number) oder topic (string)
 * @returns {Promise<boolean>}
 */
export async function deactivateKnowledge(db, idOrTopic) {
  try {
    const isId = typeof idOrTopic === 'number';
    await db.query(
      `UPDATE "${KY_TABLE_NAME}"
       SET    "is_active"  = FALSE,
              "updated_at" = CURRENT_TIMESTAMP
       WHERE  ${isId ? '"id" = $1' : '"topic" = $1'}`,
      [idOrTopic]
    );
    return true;
  } catch (error) {
    console.error('[kynto_knowledge v2] deactivateKnowledge Fehler:', error);
    return false;
  }
}
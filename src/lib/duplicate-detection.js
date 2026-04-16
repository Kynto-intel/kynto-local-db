import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();

// ─── Konfiguration ────────────────────────────────────────────────────────────
const CONFIG = {
  // Trigram-Score ab dem ein Name als "ähnlich" gilt (0–1)
  SIMILARITY_THRESHOLD: 0.4,
  // Maximale Levenshtein-Distanz für Namen (skaliert mit Namenslänge)
  MAX_LEVENSHTEIN_RATIO: 0.35, // 35 % der Zeichenlänge des kürzeren Namens
  // Absolutes Maximum, auch bei sehr langen Namen
  MAX_LEVENSHTEIN_ABS: 6,
};

// ─── Setup ────────────────────────────────────────────────────────────────────

/**
 * Initialisiert die Datenbank mit Erweiterungen, Tabellen und Indizes.
 * Idempotent – kann mehrfach aufgerufen werden.
 */
export async function setupDatabase() {
  try {
    await db.exec(`
      CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;
      CREATE EXTENSION IF NOT EXISTS pg_trgm;
    `);

    await db.exec(`
      CREATE TABLE IF NOT EXISTS customers (
        id         SERIAL PRIMARY KEY,
        name       TEXT        NOT NULL CHECK (LENGTH(TRIM(name))  > 0),
        email      TEXT        NOT NULL CHECK (LENGTH(TRIM(email)) > 0),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await db.exec(`
      -- Garantiert case-insensitive Einmaligkeit der E-Mail
      CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_email_ci
        ON customers (LOWER(TRIM(email)));

      -- GIN-Trigram-Index für blitzschnelle Ähnlichkeitssuche auf Namen
      CREATE INDEX IF NOT EXISTS idx_customers_name_trgm
        ON customers USING GIN (LOWER(name) gin_trgm_ops);
    `);

    console.log('✅ Datenbank erfolgreich initialisiert.');
  } catch (error) {
    console.error('❌ Setup-Fehler:', error);
    throw error; // Fehler nach oben weitergeben, Setup ist kritisch
  }
}

// ─── Duplikatprüfung ─────────────────────────────────────────────────────────

/**
 * Normalisiert einen String für konsistente Vergleiche:
 * Whitespace trimmen + auf Kleinschreibung bringen.
 * @param {string} value
 * @returns {string}
 */
function normalize(value) {
  return value.trim().toLowerCase();
}

/**
 * Validiert die Pflichtfelder und gibt strukturierte Fehler zurück.
 * @param {string} name
 * @param {string} email
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateInput(name, email) {
  const errors = [];
  if (!name || name.trim().length === 0) errors.push('Name darf nicht leer sein.');
  if (!email || email.trim().length === 0) errors.push('E-Mail darf nicht leer sein.');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    errors.push(`Ungültige E-Mail-Adresse: "${email}".`);
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Berechnet die dynamische Levenshtein-Obergrenze anhand der Namenslänge.
 * Kurze Namen bekommen weniger Toleranz als lange.
 * @param {string} name
 * @returns {number}
 */
function levenshteinLimit(name) {
  const base = Math.floor(normalize(name).length * CONFIG.MAX_LEVENSHTEIN_RATIO);
  return Math.min(base, CONFIG.MAX_LEVENSHTEIN_ABS);
}

/**
 * Prüft die Datenbank auf mögliche Duplikate.
 *
 * Strategie (zweistufig):
 *  1. Index-Scan auf LOWER(email) → exakter Treffer ohne Scan der ganzen Tabelle
 *  2. GIN-Trigram-Index auf LOWER(name) via %-Operator → sublinearer Ähnlichkeits-Scan
 *
 * @param {string} name  – Eingehender Name
 * @param {string} email – Eingehende E-Mail
 * @returns {Promise<{ exactEmail: object[], similarName: object[] }>}
 */
export async function checkDuplicates(name, email) {
  const { valid, errors } = validateInput(name, email);
  if (!valid) throw new Error(`Ungültige Eingabe: ${errors.join(' ')}`);

  const normName  = normalize(name);
  const normEmail = normalize(email);

  // Similarity-Schwelle für diese Session setzen
  // (PGlite: SET ist session-lokal → muss vor jedem Query-Block wiederholt werden)
  await db.exec(`SET pg_trgm.similarity_threshold = ${CONFIG.SIMILARITY_THRESHOLD};`);

  const query = `
    SELECT
      id,
      name,
      email,
      levenshtein(LOWER(name), $1)                   AS lev_distance,
      similarity(LOWER(name), $1)                    AS sim_score,
      (LOWER(TRIM(email)) = $2)                      AS exact_email
    FROM customers
    WHERE
      LOWER(TRIM(email)) = $2          -- 1. Exakter E-Mail-Treffer via Unique-Index
      OR LOWER(name) % $1              -- 2. Ähnlicher Name via GIN-Trigram-Index
    ORDER BY
      exact_email DESC,
      sim_score    DESC;
  `;

  const { rows } = await db.query(query, [normName, normEmail]);

  const maxDist = levenshteinLimit(name);

  // Ergebnisse in zwei semantisch getrennte Gruppen aufteilen
  const exactEmail   = rows.filter(r => r.exact_email);
  const similarName  = rows.filter(r => !r.exact_email && r.lev_distance <= maxDist);

  return { exactEmail, similarName };
}

// ─── Workflow ─────────────────────────────────────────────────────────────────

/**
 * Legt einen neuen Kunden an, falls kein Duplikat vorliegt.
 * Bei Duplikaten wird eine strukturierte Warnung zurückgegeben –
 * der Aufrufer (z.B. Electron IPC) entscheidet, was damit passiert.
 *
 * @param {string} name
 * @param {string} email
 * @returns {Promise<{
 *   status:     'saved' | 'duplicate_warning' | 'error',
 *   message:    string,
 *   duplicates: { exactEmail: object[], similarName: object[] } | null,
 *   newRecord:  { id: number, name: string, email: string } | null,
 *   errors:     string[] | null,
 * }>}
 */
export async function handleNewUser(name, email) {
  console.log(`\n🔍 Prüfe: "${name}" <${email}>`);

  // ── Eingabevalidierung ──────────────────────────────────────────────────
  const validation = validateInput(name, email);
  if (!validation.valid) {
    console.warn('⛔ Validierungsfehler:', validation.errors.join(', '));
    return { status: 'error', message: 'Ungültige Eingabe.', duplicates: null, newRecord: null, errors: validation.errors };
  }

  // ── Duplikatprüfung ─────────────────────────────────────────────────────
  let duplicates;
  try {
    duplicates = await checkDuplicates(name, email);
  } catch (error) {
    console.error('❌ Fehler bei Duplikatprüfung:', error);
    return { status: 'error', message: error.message, duplicates: null, newRecord: null, errors: [error.message] };
  }

  const hasDuplicates = duplicates.exactEmail.length > 0 || duplicates.similarName.length > 0;

  if (hasDuplicates) {
    // ── Warnung ausgeben, NICHT speichern ───────────────────────────────
    console.warn('⚠️  Mögliche Duplikate gefunden:');

    duplicates.exactEmail.forEach(r => {
      console.warn(`   🔴 EXAKT (E-Mail): ID ${r.id} – "${r.name}" <${r.email}>`);
    });

    duplicates.similarName.forEach(r => {
      const pct = (r.sim_score * 100).toFixed(0);
      console.warn(`   🟡 ÄHNLICH (Name): ID ${r.id} – "${r.name}" | Abstand: ${r.lev_distance} | Score: ${pct}%`);
    });

    // Hier Electron IPC-Call z.B.:
    // mainWindow.webContents.send('show-merge-dialog', duplicates);

    return {
      status:     'duplicate_warning',
      message:    `${duplicates.exactEmail.length} exakte und ${duplicates.similarName.length} ähnliche Treffer gefunden.`,
      duplicates,
      newRecord:  null,
      errors:     null,
    };
  }

  // ── Sauber: Datensatz speichern ─────────────────────────────────────────
  try {
    const insert = await db.query(
      `INSERT INTO customers (name, email)
       VALUES ($1, $2)
       RETURNING id, name, email, created_at`,
      [name.trim(), email.trim()],
    );

    const newRecord = insert.rows[0];
    console.log(`✅ Gespeichert: ID ${newRecord.id} – "${newRecord.name}" <${newRecord.email}>`);

    return {
      status:     'saved',
      message:    'Datensatz erfolgreich gespeichert.',
      duplicates: null,
      newRecord,
      errors:     null,
    };
  } catch (error) {
    // Letzter Fallback: UNIQUE-Verletzung durch Race Condition
    if (error.message?.includes('unique') || error.message?.includes('duplicate')) {
      console.warn('⚠️  Race-Condition: E-Mail wurde parallel eingetragen.');
      return {
        status:    'duplicate_warning',
        message:   'E-Mail wurde kurz zuvor von einem anderen Prozess gespeichert.',
        duplicates: { exactEmail: [], similarName: [] },
        newRecord: null,
        errors:    null,
      };
    }
    console.error('❌ Insert-Fehler:', error);
    return { status: 'error', message: error.message, duplicates: null, newRecord: null, errors: [error.message] };
  }
}

// ─── Beispiel-Aufruf ──────────────────────────────────────────────────────────
/*
await setupDatabase();

// Testdaten-Seed (einmalig)
await db.query(
  "INSERT INTO customers (name, email) VALUES ($1, $2) ON CONFLICT DO NOTHING",
  ['Max Mustermann', 'max@test.de']
);

const cases = [
  ['Max Mustermann', 'max.m@test.de'], // → 🟡 ähnlicher Name
  ['Max Mustermann', 'max@test.de'],   // → 🔴 exakte E-Mail
  ['Erika Musterfrau', 'erika@test.de'], // → ✅ neu
  ['', 'bad'],                           // → ⛔ Validierungsfehler
];

for (const [name, email] of cases) {
  const result = await handleNewUser(name, email);
  console.log('Status:', result.status, '|', result.message);
}
*/
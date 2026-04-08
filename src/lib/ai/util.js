/**
 * Kynto AI Utilities - basierend auf Supabase Patterns
 * Handlepainter SQL-Escaping, Identfier-Normalisierung
 */

/**
 * LLMs emittieren manchmal MySQL-style `\'` escapes in SQL.
 * PostgreSQL/DuckDB behandeln Backslash nicht als Escape-Zeichen.
 * Ersetze `\'` → `''` um es sicher zu machen.
 * Dollar-quoted strings (z.B. `$$...$$`) werden ignoriert.
 */
export function fixSqlBackslashEscapes(sql) {
  return sql.replace(/\$([^$]*)\$[\s\S]*?\$\1\$|\\'/g, (match, dollarTag) =>
    dollarTag !== undefined ? match : "''"
  );
}

/**
 * 🛡️ Normalisiere SQL Identifiers - Setze Anführungszeichen um:
 * - Identifiers mit Großbuchstaben
 * - Identifiers mit Sonderzeichen (Leerzeichen, Klammern, etc.)
 * - Tabellennamen aus CSV-Import
 * 
 * @param {string} sql - Der zu normalisierende SQL-Code
 * @returns {string} SQL mit korrekten Anführungszeichen
 */
export function normalizeSQLIdentifiers(sql) {
  if (!sql) return '';

  let normalized = sql;

  // Pattern 1: SELECT-Spalten
  // SELECT abc, DEF, xyz → SELECT "abc", "DEF", "xyz"
  normalized = normalized.replace(
    /SELECT\s+([\w\s,().$\-"]+?)(?=FROM|WHERE|GROUP|ORDER|HAVING|LIMIT|;|$)/gi,
    (match) => {
      const columns = match.replace(/SELECT/i, '').trim();
      const quoted = columns
        .split(',')
        .map((col) => {
          col = col.trim();
          // Nur quoten wenn nicht schon gequotet und enthält Großbuchstaben oder Sonderzeichen
          if (!col.startsWith('"') && !col.endsWith('"') && /[A-Z()$\-\s]/.test(col)) {
            return `"${col}"`;
          }
          return col;
        })
        .join(', ');
      return `SELECT ${quoted}`;
    }
  );

  // Pattern 2: FROM-Tabellennamen
  // FROM allvallhalla_csv → FROM "allvallhalla_csv"
  normalized = normalized.replace(/FROM\s+(\w+)/gi, (match, table) => {
    if (!/^".*"$/.test(table) && /[A-Z$\-]/.test(table)) {
      return `FROM "${table}"`;
    }
    return match;
  });

  // Pattern 3: JOIN-Tabellennamen
  normalized = normalized.replace(
    /JOIN\s+(\w+)\s+/gi,
    (match, table) => {
      if (!/^".*"$/.test(table) && /[A-Z$\-]/.test(table)) {
        return `JOIN "${table}" `;
      }
      return match;
    }
  );

  // Pattern 4: WHERE-Spalten (einfache Heuristik)
  // WHERE "Spalte" = value → erkenne "Spalte" bereits gequotet
  // WHERE Spalte = value → WHERE "Spalte" = value
  normalized = normalized.replace(
    /WHERE\s+([A-Z]\w+)\s*(=|<|>|IN|LIKE)/gi,
    (match, col, op) => {
      if (!/^".*"$/.test(col)) {
        return `WHERE "${col}" ${op}`;
      }
      return match;
    }
  );

  // Cleanup: Fixe doppelte Anführungszeichen (z.B. ""table"")
  normalized = normalized.replace(/""/g, '"');

  return normalized;
}

/**
 * 🧹 Extrahiere SQL-Code aus KI-Antwort (mit oder ohne Markdown)
 * @param {string} responseText - Die KI-Antwort
 * @returns {string} Den reinen SQL-Code
 */
export function extractSQLFromResponse(responseText) {
  if (!responseText) return '';

  // Versuche SQL-Block zu finden (```sql ... ```)
  const sqlMatch = responseText.match(/```(?:sql)?\n?([\s\S]*?)```/);
  if (sqlMatch) {
    return sqlMatch[1].trim();
  }

  // Fallback: Wenn der ganze Text schon SQL ist
  const lines = responseText.trim().split('\n');
  const sqlKeywords = ['SELECT', 'WITH', 'CREATE', 'UPDATE', 'DELETE', 'INSERT', 'DESCRIBE', 'SHOW'];

  for (const line of lines) {
    if (sqlKeywords.some((kw) => line.trim().toUpperCase().startsWith(kw))) {
      const sqlStart = responseText.indexOf(line);
      return responseText.substring(sqlStart).trim();
    }
  }

  return responseText.trim();
}

/**
 * ✨ Säubere und normalisiere SQL-Code
 * @param {string} sql - Der zu säubernde SQL-Code
 * @returns {string} Der bereinigte SQL-Code
 */
export function cleanupSQL(sql) {
  if (!sql) return '';

  // 1. Fixe Backslash-Escapes (MySQL-Style)
  let cleaned = fixSqlBackslashEscapes(sql);

  // 2. Normalisiere Identifiers
  cleaned = normalizeSQLIdentifiers(cleaned);

  // 3. Entferne extra Whitespace
  cleaned = cleaned
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join('\n');

  return cleaned;
}

/**
 * 🔍 Erkenne ob ein String SQL ist
 * @param {string} text - Der zu prüfende Text
 * @returns {boolean} True wenn es SQL ist
 */
export function isSQLCode(text) {
  if (!text) return false;
  const sqlKeywords = ['SELECT', 'WITH', 'CREATE', 'UPDATE', 'DELETE', 'INSERT', 'DESCRIBE', 'SHOW'];
  return sqlKeywords.some((kw) =>
    text.trim().toUpperCase().startsWith(kw)
  );
}

/**
 * Leichtgewichtiger SQL-Parser zur Erkennung von Tabellen-Ereignissen.
 */

// Lokale Definition der Event-Typen (ersetzt die externen Konstanten)
const TABLE_EVENT_ACTIONS = {
  TableCreated: 'TABLE_CREATED',
  TableDataAdded: 'TABLE_DATA_ADDED',
  TableRLSEnabled: 'TABLE_RLS_ENABLED'
};

export class SQLEventParser {
  // Definition der RegEx-Muster zur Erkennung von SQL-Aktionen
  static DETECTORS = [
    {
      type: TABLE_EVENT_ACTIONS.TableCreated,
      patterns: [
        /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?<schema>(?:"[^"]+"|[\w]+)\.)?(?<table>[\w"`]+)/i,
        /CREATE\s+TEMP(?:ORARY)?\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?<schema>(?:"[^"]+"|[\w]+)\.)?(?<table>[\w"`]+)/i,
        /CREATE\s+UNLOGGED\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?<schema>(?:"[^"]+"|[\w]+)\.)?(?<table>[\w"`]+)/i,
        /SELECT\s+.*?\s+INTO\s+(?<schema>(?:"[^"]+"|[\w]+)\.)?(?<table>[\w"`]+)/is,
        /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?<schema>(?:"[^"]+"|[\w]+)\.)?(?<table>[\w"`]+)\s+AS\s+SELECT/i,
      ],
    },
    {
      type: TABLE_EVENT_ACTIONS.TableDataAdded,
      patterns: [
        /INSERT\s+INTO\s+(?<schema>(?:"[^"]+"|[\w]+)\.)?(?<table>[\w"`]+)/i,
        /COPY\s+(?<schema>(?:"[^"]+"|[\w]+)\.)?(?<table>[\w"`]+)\s+FROM/i,
      ],
    },
    {
      type: TABLE_EVENT_ACTIONS.TableRLSEnabled,
      patterns: [
        /ALTER\s+TABLE\s+(?<schema>(?:"[^"]+"|[\w]+)\.)?(?<table>[\w"`]+).*?ENABLE\s+ROW\s+LEVEL\s+SECURITY/i,
        /ALTER\s+TABLE\s+(?<schema>(?:"[^"]+"|[\w]+)\.)?(?<table>[\w"`]+).*?ENABLE\s+RLS/i,
      ],
    },
  ];

  // Bereinigt Anführungszeichen und Punkte von Tabellennamen
  cleanIdentifier(identifier) {
    return identifier?.replace(/["`']/g, '').replace(/\.$/, '');
  }

  // Prüft ein einzelnes Statement gegen alle Detektoren
  match(sql) {
    for (const { type, patterns } of SQLEventParser.DETECTORS) {
      for (const pattern of patterns) {
        const match = sql.match(pattern);
        if (match?.groups) {
          return {
            type,
            schema: this.cleanIdentifier(match.groups.schema),
            tableName: this.cleanIdentifier(match.groups.table || match.groups.object),
          };
        }
      }
    }
    return null;
  }

  // Teilt SQL-Strings in einzelne Befehle auf (beachtet Strings und Dollar-Quotes)
  splitStatements(sql) {
    const tokens =
      sql.match(
        /'([^']|'')*'|"([^"]|"")*"|\$[a-zA-Z0-9_]*\$[\s\S]*?\$[a-zA-Z0-9_]*\$|;|[^'"$;]+/g
      ) || [];

    const statements = [];
    let current = '';

    for (const token of tokens) {
      if (token === ';') {
        if (current.trim()) statements.push(current.trim());
        current = '';
      } else {
        current += token;
      }
    }

    if (current.trim()) {
      statements.push(current.trim());
    }

    return statements;
  }

  // Entfernt doppelte Erkennungen
  deduplicate(events) {
    const seen = new Set();
    return events.filter((e) => {
      const key = `${e.type}:${e.schema || ''}:${e.tableName || ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  // Entfernt SQL-Kommentare vor der Analyse
  removeComments(sql) {
    return sql
      .replace(/--.*?$/gm, '') // Zeilenkommentare
      .replace(/\/\*[\s\S]*?\*\//g, ''); // Blockkommentare
  }

  // Die Hauptfunktion: Gibt alle erkannten Ereignisse zurück
  getTableEvents(sql) {
    if (!sql) return [];
    const statements = this.splitStatements(this.removeComments(sql));
    const results = [];

    for (const stmt of statements) {
      const event = this.match(stmt);
      if (event) results.push(event);
    }

    return this.deduplicate(results);
  }
}

export const sqlEventParser = new SQLEventParser();
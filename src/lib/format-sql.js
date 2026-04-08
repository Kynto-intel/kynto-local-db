import { format } from 'https://cdn.jsdelivr.net/npm/sql-formatter@15.4.4/+esm';

/**
 * Hilfsfunktion zum Formatieren von SQL. 
 * Nutzt die 'sql-formatter' Library mit festen Einstellungen für Kynto.
 */
export const formatSql = (sql) => {
  if (!sql) return '' // Falls das SQL leer ist, gib einen leeren String zurück
  
  try {
    return format(sql, {
      language: 'postgresql',
      keywordCase: 'lower', // Keywords wie SELECT, CREATE werden klein geschrieben
    })
  } catch (error) {
    // Falls das SQL einen Fehler hat, geben wir es einfach unformatiert zurück
    return sql
  }
}
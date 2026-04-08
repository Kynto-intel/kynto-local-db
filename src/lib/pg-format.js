/**
 * Hilfsfunktionen zum sicheren Formatieren von Werten für PostgreSQL.
 * Basierend auf node-pg-format.
 */

import { isNonNullable } from './isNonNullable.js';

function formatDate(date) {
  return date.replace('T', ' ').replace('Z', '+00');
}

function arrayToList(useSpace, array, formatter) {
  let sql = useSpace ? ' (' : '(';
  for (let i = 0; i < array.length; i++) {
    sql += (i === 0 ? '' : ', ') + formatter(array[i]);
  }
  return sql + ')';
}

/**
 * Formatiert einen SQL-String mit Platzhaltern.
 * %I - Identifikatoren (Tabellen/Spaltennamen)
 * %L - Literale (Werte, maskiert)
 * %s - Rohe Strings (unmaskiert!)
 */
export function format(sql, ...args) {
  let i = 0;
  return sql.replace(/%([sLI%])/g, (match, type) => {
    if (type === '%') return '%';
    const val = args[i++];
    if (type === 'I') return quoteIdent(val);
    if (type === 'L') return quoteLiteral(val);
    if (type === 's') return val;
    return match;
  });
}

/**
 * Maskiert SQL-Identifikatoren (Tabellen- oder Spaltennamen).
 */
export function quoteIdent(value) {
  if (!isNonNullable(value)) {
    throw new Error('SQL identifier cannot be null or undefined');
  }

  if (Array.isArray(value)) {
    return value.map(quoteIdent).join(', ');
  }

  const ident = value.toString();
  // Identifier in Doppel-Anführungszeichen setzen und vorhandene " verdoppeln
  return '"' + ident.replace(/"/g, '""') + '"';
}

/**
 * Setzt Werte in korrekte SQL-Anführungszeichen und maskiert Sonderzeichen.
 * Schützt vor SQL-Injection und formatiert JS-Objekte zu JSONB.
 */
export function quoteLiteral(value) {
  let literal = null;
  let explicitCast = null;

  if (!isNonNullable(value)) {
    return 'NULL';
  } else if (value === false) {
    return "'f'";
  } else if (value === true) {
    return "'t'";
  } else if (value instanceof Date) {
    return "'" + formatDate(value.toISOString()) + "'";
  } else if (typeof Buffer !== 'undefined' && value instanceof Buffer) {
    return "E'\\\\x" + value.toString('hex') + "'";
  } else if (Array.isArray(value)) {
    let temp = [];
    for (let i = 0; i < value.length; i++) {
      if (Array.isArray(value[i])) {
        temp.push(arrayToList(i !== 0, value[i], quoteLiteral));
      } else {
        temp.push(quoteLiteral(value[i]));
      }
    }
    return temp.toString();
  } else if (typeof value === 'object') {
    explicitCast = 'jsonb';
    literal = JSON.stringify(value);
  } else {
    literal = value.toString();
  }

  let hasBackslash = false;
  let quoted = "'";

  for (let i = 0; i < literal.length; i++) {
    let c = literal[i];
    if (c === "'") {
      quoted += "''"; // Hochkommas verdoppeln (Postgres Standard)
    } else if (c === '\\') {
      quoted += "\\\\"; // Backslash maskieren
      hasBackslash = true;
    } else {
      quoted += c;
    }
  }

  quoted += "'";

  if (hasBackslash) {
    quoted = 'E' + quoted; // Extended String Literal für Backslashes
  }

  if (explicitCast) {
    quoted += '::' + explicitCast;
  }

  return quoted;
}
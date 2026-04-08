/**
 */

/**
 * Entfernt einzeilige -- Kommentare und mehrzeilige /* * / Kommentare aus dem SQL.
 * Dies ist wichtig für die Analyse von Keywords, um False-Positives in Kommentaren zu vermeiden.
 */
export function removeComments(sql) {
    if (!sql) return '';
    return sql.replace(/--.*$|\/\*[\s\S]*?\*\//gm, '');
}

/**
 * Prüft, ob eine Abfrage potenziell gefährlich ist (z.B. DELETE ohne WHERE)
 */
export function checkDestructiveQuery(sql) {
    // Wir entfernen Kommentare vor der Prüfung, damit Keywords in Kommentaren 
    // die Logik nicht verfälschen.
    const cleaned = removeComments(sql).toLowerCase().trim();
    
    const isDeleteWithoutWhere = /\bdelete\b/i.test(cleaned) && !/\bwhere\b/i.test(cleaned);
    const isUpdateWithoutWhere = /\bupdate\b/i.test(cleaned) && !/\bwhere\b/i.test(cleaned);
    const isDrop = /\bdrop\b/i.test(cleaned) || /\btruncate\b/i.test(cleaned);
    const isAlterConn = /\balter\s+database\b/i.test(cleaned) && /allow_connections\s*=\s*false/i.test(cleaned);

    let reason = '';
    if (isDeleteWithoutWhere) reason = 'DELETE ohne WHERE-Klausel';
    else if (isUpdateWithoutWhere) reason = 'UPDATE ohne WHERE-Klausel';
    else if (isDrop) reason = 'DROP oder TRUNCATE Operation';
    else if (isAlterConn) reason = 'Datenbank-Verbindungen werden gesperrt';

    return {
        isDestructive: isDeleteWithoutWhere || isUpdateWithoutWhere || isDrop || isAlterConn,
        hasDestructiveOperations: isDeleteWithoutWhere || isDrop,
        hasUpdateWithoutWhere: isUpdateWithoutWhere,
        hasAlterDatabasePreventConnection: isAlterConn,
        reason
    };
}

/**
 * Prüft detailliert, ob ein automatisches LIMIT an die Query angehängt werden sollte.
 * Verhindert Syntaxfehler bei multiplen Queries, Kommentaren oder alternativen LIMIT-Klauseln.
 */
export function checkIfAppendLimitRequired(sql) {
    if (!sql) return false;

    // Wir analysieren die Logik auf der Basis von SQL ohne Kommentare
    const sqlWithoutComments = removeComments(sql);
    const trimmed = sqlWithoutComments.trim();
    if (!trimmed) return false;

    const lower = trimmed.toLowerCase();

    // 1. Nur für SELECT-Statements sinnvoll
    if (!lower.startsWith('select')) return false;

    // 2. Keine Limits bei multiplen Queries
    const statements = trimmed.split(';').filter((s) => s.trim().length > 0);
    if (statements.length > 1) return false;

    // 3. Keine Limits bei Kommentaren
    // Wenn das Original-SQL am Ende einen Kommentar hat, würde ein angehängtes LIMIT auskommentiert.
    if (sql.trim().endsWith('*/') || sql.trim().split('\n').pop().includes('--')) return false;

    // 4. Prüfung auf vorhandene Begrenzungen
    // Wir prüfen auf das Keyword 'LIMIT' gefolgt von einer Zahl (auch mit Zeilenumbrüchen dazwischen).
    // Dies stellt sicher, dass wir nur eingreifen, wenn KEIN explizites numerisches Limit gesetzt ist.
    const hasLimit = /\blimit\s+\d+/i.test(lower);
    const hasFetch = /\bfetch\s+(?:first|next)\b/i.test(lower);
    const hasTop = /\btop\b/i.test(lower);

    return !hasLimit && !hasFetch && !hasTop;
}

/**
 * Fügt ein LIMIT hinzu, unter Berücksichtigung der Sicherheitsprüfungen.
 */
export function suffixWithLimit(sql, limit = 500) {
    if (!checkIfAppendLimitRequired(sql)) return sql;

    const baseSql = sql.trim().replace(/;+$/, '');
    return `${baseSql} LIMIT ${limit};`;
}

// Importiert die zentrale formatSql-Implementation von src/lib/format-sql.js
import { formatSql } from '../../../src/lib/format-sql.js';

/**
 * Erstellt ein standardisiertes Snippet-Objekt (Skeleton).
 * Portiert von createSqlSnippetSkeletonV2 aus der TS-Welt.
 * 
 * @param {Object} params
 * @param {string} params.name - Anzeigename des Snippets
 * @param {string} params.sql - Der SQL-Code
 * @param {string|number} [params.ownerId] - ID des Erstellers
 * @param {string} [params.folderId] - Optionale Ordner-ID
 * @param {string} [params.idOverride] - Falls eine spezifische ID erzwungen werden soll
 */
export function createSqlSnippetSkeleton({
    name,
    sql,
    ownerId = 'local',
    projectId = 'default',
    folderId = null,
    idOverride = null
}) {
    const id = idOverride || crypto.randomUUID();
    const now = new Date().toISOString();

    return {
        id,
        name: name || 'Unbenanntes Snippet',
        owner_id: ownerId,
        project_id: projectId,
        folder_id: folderId,
        favorite: false,
        inserted_at: now,
        updated_at: now,
        // Die Trennung von Metadaten und Content erlaubt einfachere 
        // Updates der SQL-Logik ohne die Root-Attribute zu gefährden.
        content: {
            content_id: id,
            sql: sql || '',
            schema_version: '1'
        },
        // Hilfsflag für die UI (z.B. um einen "Speichern"-Indikator anzuzeigen)
        isNotSavedInDatabaseYet: true,
    };
}
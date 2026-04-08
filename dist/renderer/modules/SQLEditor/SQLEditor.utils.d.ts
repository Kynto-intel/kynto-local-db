/**
 */
/**
 * Entfernt einzeilige -- Kommentare und mehrzeilige /* * / Kommentare aus dem SQL.
 * Dies ist wichtig für die Analyse von Keywords, um False-Positives in Kommentaren zu vermeiden.
 */
export function removeComments(sql: any): any;
/**
 * Prüft, ob eine Abfrage potenziell gefährlich ist (z.B. DELETE ohne WHERE)
 */
export function checkDestructiveQuery(sql: any): {
    isDestructive: boolean;
    hasDestructiveOperations: boolean;
    hasUpdateWithoutWhere: boolean;
    hasAlterDatabasePreventConnection: boolean;
    reason: string;
};
/**
 * Prüft detailliert, ob ein automatisches LIMIT an die Query angehängt werden sollte.
 * Verhindert Syntaxfehler bei multiplen Queries, Kommentaren oder alternativen LIMIT-Klauseln.
 */
export function checkIfAppendLimitRequired(sql: any): boolean;
/**
 * Fügt ein LIMIT hinzu, unter Berücksichtigung der Sicherheitsprüfungen.
 */
export function suffixWithLimit(sql: any, limit?: number): any;
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
export function createSqlSnippetSkeleton({ name, sql, ownerId, projectId, folderId, idOverride }: {
    name: string;
    sql: string;
    ownerId?: string | number;
    folderId?: string;
    idOverride?: string;
}): {
    id: string;
    name: string;
    owner_id: string | number;
    project_id: any;
    folder_id: string;
    favorite: boolean;
    inserted_at: string;
    updated_at: string;
    content: {
        content_id: string;
        sql: string;
        schema_version: string;
    };
    isNotSavedInDatabaseYet: boolean;
};

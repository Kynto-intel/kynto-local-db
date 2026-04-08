/* ── Storage/_storageUtils.js ─────────────────────────────────────────────
   Interne Hilfsfunktionen – werden von allen Bucket-Modulen verwendet.
   ────────────────────────────────────────────────────────────────────────── */

/**
 * Bereinigt einen Dateinamen für sichere Verwendung als Storage-Pfad.
 * Ersetzt Leerzeichen und Sonderzeichen, behält Endung.
 * @param {string} fileName
 * @returns {string}
 */
export function sanitizeFileName(fileName) {
    return fileName
        .normalize('NFD')                        // Umlaute dekompinieren (ä → a + ̈)
        .replace(/[\u0300-\u036f]/g, '')         // Akzente entfernen
        .replace(/[^a-zA-Z0-9._-]/g, '_')        // Alle unsicheren Zeichen → _
        .replace(/_+/g, '_')                     // Mehrfache _ → ein _
        .toLowerCase();
}

/**
 * Gibt einen timestamp-basierten Pfad zurück.
 * @param {string} prefix  - z.B. 'grid', 'assets', 'user_123'
 * @param {string} fileName - Originalname (wird sanitized)
 * @returns {string}
 */
export function buildPath(prefix, fileName) {
    const safe = sanitizeFileName(fileName);
    return `${prefix}/${Date.now()}_${safe}`;
}

/**
 * Prüft eine Datei auf erlaubten MIME-Type und maximale Größe.
 * Wirft einen Error wenn die Validierung fehlschlägt.
 *
 * @param {File} file
 * @param {{ allowedTypes?: string[], maxSizeMB?: number }} options
 */
export function validateFile(file, { allowedTypes = [], maxSizeMB = 50 } = {}) {
    if (maxSizeMB && file.size > maxSizeMB * 1024 * 1024) {
        throw new Error(
            `Datei zu groß: ${(file.size / 1024 / 1024).toFixed(1)} MB (Max: ${maxSizeMB} MB)`
        );
    }

    if (allowedTypes.length > 0 && !allowedTypes.includes(file.type)) {
        throw new Error(
            `Nicht erlaubter Dateityp: "${file.type}". Erlaubt: ${allowedTypes.join(', ')}`
        );
    }
}

/**
 * Schreibt einen Eintrag in die kynto_storage_registry.
 * @param {object} client   - Supabase-Client
 * @param {object} payload
 * @param {string} payload.full_url
 * @param {string} payload.mime_type
 * @param {number} payload.file_size
 * @param {string} payload.bucket
 * @param {string} payload.storage_path
 * @param {string} [payload.uploaded_by]  - optional: userId
 */
export async function registerFile(client, payload) {
    const { error } = await client.from('kynto_storage_registry').insert([payload]);
    if (error) {
        // Registry-Fehler sind nicht kritisch genug um den Upload abzubrechen –
        // wir loggen und fahren fort.
        console.warn('[KyntoStorage] Registry-Eintrag fehlgeschlagen:', error.message);
    }
}
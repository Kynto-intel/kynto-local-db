/* ── Storage/PrivateBucket.js ─────────────────────────────────────────────
   Privater Bucket für user-spezifische Dateien.
   Zugriff nur über zeitlich begrenzte Signed URLs.
   ────────────────────────────────────────────────────────────────────────── */

import { supabase as Kynto } from '../../lib/supabaseClient';
import { buildPath, validateFile, registerFile } from './_storageUtils';

/** Gültigkeitsdauer der Signed URL in Sekunden (Standard: 1 Stunde) */
const SIGNED_URL_EXPIRY_SECONDS = 60 * 60;

export const PrivateBucket = {
    id: 'private-uploads',

    /** Erlaubte MIME-Types – breiter als Public, da user-kontrolliert */
    allowedTypes: [
        'image/jpeg', 'image/png', 'image/webp', 'image/gif',
        'application/pdf',
        'text/plain', 'text/csv',
        'application/json',
    ],

    maxSizeMB: 50,

    /**
     * Lädt eine Datei unter dem User-Namespace hoch.
     * Gibt eine zeitlich begrenzte Signed URL zurück.
     *
     * @param {File}   file
     * @param {string} userId
     * @param {number} [expiresIn]  - Ablauf in Sekunden (Standard: 1 Stunde)
     * @returns {Promise<{ signedUrl: string, storagePath: string }>}
     */
    async upload(file, userId, expiresIn = SIGNED_URL_EXPIRY_SECONDS) {
        if (!userId) throw new Error('[PrivateBucket] userId ist erforderlich.');

        validateFile(file, {
            allowedTypes: this.allowedTypes,
            maxSizeMB:    this.maxSizeMB,
        });

        const path = buildPath(`user_${userId}`, file.name);

        const { error: uploadError } = await Kynto.storage
            .from(this.id)
            .upload(path, file);

        if (uploadError) throw new Error(`[PrivateBucket] Upload fehlgeschlagen: ${uploadError.message}`);

        const signedUrl = await this.getSignedUrl(path, expiresIn);

        await registerFile(Kynto, {
            full_url:     signedUrl,
            mime_type:    file.type,
            file_size:    file.size,
            bucket:       this.id,
            storage_path: path,
            uploaded_by:  userId,
        });

        return { signedUrl, storagePath: path };
    },

    /**
     * Erzeugt eine neue Signed URL für einen bestehenden Pfad.
     * @param {string} storagePath
     * @param {number} [expiresIn]
     * @returns {Promise<string>} signedUrl
     */
    async getSignedUrl(storagePath, expiresIn = SIGNED_URL_EXPIRY_SECONDS) {
        const { data, error } = await Kynto.storage
            .from(this.id)
            .createSignedUrl(storagePath, expiresIn);

        if (error) throw new Error(`[PrivateBucket] Signed URL fehlgeschlagen: ${error.message}`);
        return data.signedUrl;
    },

    /**
     * Löscht eine Datei und deren Registry-Eintrag.
     * @param {string} storagePath
     */
    async delete(storagePath) {
        const { error } = await Kynto.storage.from(this.id).remove([storagePath]);
        if (error) throw new Error(`[PrivateBucket] Löschen fehlgeschlagen: ${error.message}`);

        await Kynto.from('kynto_storage_registry')
            .delete()
            .eq('storage_path', storagePath);
    },
};
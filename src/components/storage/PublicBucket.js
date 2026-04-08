/* ── Storage/PublicBucket.js ──────────────────────────────────────────────
   Öffentlicher Bucket für Grid-Medien (Bilder, Dokumente, etc.)
   Dateien sind ohne Authentifizierung über eine öffentliche URL erreichbar.
   ────────────────────────────────────────────────────────────────────────── */

import { supabase as Kynto } from '../../lib/supabaseClient';
import { buildPath, validateFile, registerFile } from './_storageUtils';

export const PublicBucket = {
    id: 'public-media',

    /** Erlaubte MIME-Types für diesen Bucket (anpassen nach Bedarf) */
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'],

    /** Max. Dateigröße in MB */
    maxSizeMB: 20,

    /**
     * Lädt eine Datei hoch und gibt die öffentliche URL zurück.
     * @param {File} file
     * @returns {Promise<string>} publicUrl
     */
    async upload(file) {
        validateFile(file, {
            allowedTypes: this.allowedTypes,
            maxSizeMB:    this.maxSizeMB,
        });

        const path = buildPath('grid', file.name);

        const { error: uploadError } = await Kynto.storage
            .from(this.id)
            .upload(path, file);

        if (uploadError) throw new Error(`[PublicBucket] Upload fehlgeschlagen: ${uploadError.message}`);

        const { data: { publicUrl } } = Kynto.storage.from(this.id).getPublicUrl(path);

        await registerFile(Kynto, {
            full_url:     publicUrl,
            mime_type:    file.type,
            file_size:    file.size,
            bucket:       this.id,
            storage_path: path,
        });

        return publicUrl;
    },

    /**
     * Löscht eine Datei anhand ihres Storage-Pfads.
     * @param {string} storagePath  - z.B. "grid/1234567890_bild.png"
     */
    async delete(storagePath) {
        const { error } = await Kynto.storage.from(this.id).remove([storagePath]);
        if (error) throw new Error(`[PublicBucket] Löschen fehlgeschlagen: ${error.message}`);

        // Registry-Eintrag entfernen
        await Kynto.from('kynto_storage_registry')
            .delete()
            .eq('storage_path', storagePath);
    },

    /**
     * Gibt die öffentliche URL einer bereits hochgeladenen Datei zurück.
     * @param {string} storagePath
     * @returns {string}
     */
    getUrl(storagePath) {
        const { data: { publicUrl } } = Kynto.storage.from(this.id).getPublicUrl(storagePath);
        return publicUrl;
    },
};
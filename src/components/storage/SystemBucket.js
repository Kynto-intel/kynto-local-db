/* ── Storage/SystemBucket.js ──────────────────────────────────────────────
   System-Bucket für interne Assets (Icons, Logos, UI-Ressourcen).
   Nutzt upsert – gleiche Dateinamen überschreiben den Vorgänger bewusst.
   ────────────────────────────────────────────────────────────────────────── */

import { supabase as Kynto } from '../../lib/supabaseClient';
import { sanitizeFileName, validateFile, registerFile } from './_storageUtils';

export const SystemBucket = {
    id: 'system-assets',

    /** Nur Bild-Typen erlaubt – System-Assets sind typischerweise Icons/Logos */
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml', 'image/x-icon'],

    maxSizeMB: 5,

    /**
     * Lädt ein System-Asset hoch (überschreibt bestehende Datei mit gleichem Namen).
     * KEIN Timestamp im Pfad – System-Assets haben stabile, versionierte Namen.
     *
     * @param {File} file
     * @returns {Promise<string>} publicUrl
     */
    async upload(file) {
        validateFile(file, {
            allowedTypes: this.allowedTypes,
            maxSizeMB:    this.maxSizeMB,
        });

        // System-Assets: stabiler Pfad (kein Timestamp) → upsert überschreibt
        const path = `assets/${sanitizeFileName(file.name)}`;

        const { error: uploadError } = await Kynto.storage
            .from(this.id)
            .upload(path, file, { upsert: true });

        if (uploadError) throw new Error(`[SystemBucket] Upload fehlgeschlagen: ${uploadError.message}`);

        const { data: { publicUrl } } = Kynto.storage.from(this.id).getPublicUrl(path);

        // Registry: vorhandenen Eintrag aktualisieren oder neu anlegen
        await Kynto
            .from('kynto_storage_registry')
            .upsert(
                {
                    storage_path: path,
                    full_url:     publicUrl,
                    mime_type:    file.type,
                    file_size:    file.size,
                    bucket:       this.id,
                },
                { onConflict: 'storage_path' }   // Spalte muss UNIQUE sein
            );

        return publicUrl;
    },

    /**
     * Löscht ein System-Asset.
     * @param {string} storagePath  - z.B. "assets/logo.png"
     */
    async delete(storagePath) {
        const { error } = await Kynto.storage.from(this.id).remove([storagePath]);
        if (error) throw new Error(`[SystemBucket] Löschen fehlgeschlagen: ${error.message}`);

        await Kynto.from('kynto_storage_registry')
            .delete()
            .eq('storage_path', storagePath);
    },

    /**
     * Gibt die öffentliche URL eines System-Assets zurück.
     * @param {string} fileName  - z.B. "logo.png"
     * @returns {string}
     */
    getUrl(fileName) {
        const path = `assets/${sanitizeFileName(fileName)}`;
        const { data: { publicUrl } } = Kynto.storage.from(this.id).getPublicUrl(path);
        return publicUrl;
    },
};
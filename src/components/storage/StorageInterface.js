/* ── Storage/StorageInterface.js ──────────────────────────────────────────
   Kynto OS — Zentrales Storage Interface
   Einheitlicher Zugriffspunkt für alle Bucket-Typen.
   ────────────────────────────────────────────────────────────────────────── */

import { PublicBucket }  from './PublicBucket';
import { PrivateBucket } from './PrivateBucket';
import { SystemBucket }  from './SystemBucket';

/** Mapping von Bucket-ID → Bucket-Objekt */
const BUCKET_MAP = {
    [PublicBucket.id]:  PublicBucket,
    [PrivateBucket.id]: PrivateBucket,
    [SystemBucket.id]:  SystemBucket,
};

export const KyntoStorage = {
    public:  PublicBucket,
    private: PrivateBucket,
    system:  SystemBucket,

    /**
     * Gibt den Bucket anhand seiner ID zurück.
     * Wirft einen Fehler bei unbekannten Namen – kein stiller Fallback.
     *
     * @param {string} bucketId  - z.B. 'public-media'
     * @returns {object} Bucket
     */
    getBucket(bucketId) {
        const bucket = BUCKET_MAP[bucketId];
        if (!bucket) {
            throw new Error(
                `[KyntoStorage] Unbekannter Bucket: "${bucketId}". ` +
                `Verfügbar: ${Object.keys(BUCKET_MAP).join(', ')}`
            );
        }
        return bucket;
    },

    /**
     * Komfort-Methode: Lädt in den richtigen Bucket hoch basierend auf Kontext.
     *
     * @param {'public'|'private'|'system'} type
     * @param {File}   file
     * @param {string} [userId]  - Nur bei type='private' erforderlich
     */
    async upload(type, file, userId) {
        switch (type) {
            case 'public':  return this.public.upload(file);
            case 'private': return this.private.upload(file, userId);
            case 'system':  return this.system.upload(file);
            default:
                throw new Error(`[KyntoStorage] Unbekannter Upload-Typ: "${type}"`);
        }
    },
};

/*
 * ── Datenbankschema (Referenz) ────────────────────────────────────────────
 *
 * Für die kynto_storage_registry Tabelle wird folgendes Schema empfohlen:
 *
 * CREATE TABLE kynto_storage_registry (
 *     id           uuid         DEFAULT gen_random_uuid() PRIMARY KEY,
 *     storage_path text         NOT NULL UNIQUE,   -- für upsert in SystemBucket
 *     full_url     text         NOT NULL,
 *     mime_type    text,
 *     file_size    bigint,
 *     bucket       text         NOT NULL,
 *     uploaded_by  uuid         REFERENCES auth.users(id),
 *     created_at   timestamptz  DEFAULT now()
 * );
 *
 * RLS empfohlen:
 *   - SELECT: authenticated users dürfen eigene Einträge sehen
 *   - INSERT/DELETE: nur service_role oder eigene uploaded_by
 * ─────────────────────────────────────────────────────────────────────────
 */
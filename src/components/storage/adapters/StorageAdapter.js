/* ── storage/adapters/StorageAdapter.js ───────────────────────────────────
   Gemeinsames Interface für alle Storage-Adapter.
   Jeder Adapter MUSS diese Methoden implementieren.

   Verfügbare Adapter:
     - OPFSAdapter   → Browser, komplett lokal (Origin Private File System)
     - NodeAdapter   → Electron / Desktop, echtes Dateisystem
     - HTTPAdapter   → Eigener Server / MinIO / S3-kompatibel
   ────────────────────────────────────────────────────────────────────────── */

/**
 * @typedef {Object} UploadResult
 * @property {string} path        - Relativer Pfad im Bucket, z.B. "avatars/user_1/foto.jpg"
 * @property {string} url         - Zugreifbare URL oder OPFS-Referenz
 * @property {string} bucket      - Bucket-Name
 * @property {string} mime_type   - MIME-Type der Datei
 * @property {number} file_size   - Dateigröße in Bytes
 */

/**
 * @typedef {Object} BucketInfo
 * @property {string}  name       - Bucket-Name
 * @property {boolean} public     - Öffentlich zugänglich?
 * @property {number}  file_count - Anzahl Dateien
 * @property {number}  total_size - Gesamtgröße in Bytes
 */

/**
 * @typedef {Object} FileEntry
 * @property {string} name        - Dateiname
 * @property {string} path        - Vollständiger Pfad
 * @property {string} bucket      - Bucket-Name
 * @property {string} mime_type
 * @property {number} file_size
 * @property {string} created_at  - ISO-Timestamp
 * @property {string} url         - Zugreifbare URL
 */

export class StorageAdapter {
    get type() { return 'base'; }

    /** @param {string} bucketName @param {{ public?: boolean }} options */
    async createBucket(bucketName, options = {}) { throw new Error('Not implemented'); }

    /** @param {string} bucketName */
    async deleteBucket(bucketName) { throw new Error('Not implemented'); }

    /** @returns {Promise<BucketInfo[]>} */
    async listBuckets() { throw new Error('Not implemented'); }

    /**
     * @param {string} bucket
     * @param {File|Blob} file
     * @param {string} path      - Relativer Pfad im Bucket
     * @param {{ upsert?: boolean }} options
     * @returns {Promise<UploadResult>}
     */
    async upload(bucket, file, path, options = {}) { throw new Error('Not implemented'); }

    /**
     * @param {string} bucket
     * @param {string} path
     * @returns {Promise<Blob>}
     */
    async download(bucket, path) { throw new Error('Not implemented'); }

    /** @param {string} bucket @param {string} path */
    async delete(bucket, path) { throw new Error('Not implemented'); }

    /**
     * @param {string} bucket
     * @param {string} [prefix]   - Ordner-Filter
     * @returns {Promise<FileEntry[]>}
     */
    async listFiles(bucket, prefix = '') { throw new Error('Not implemented'); }

    /**
     * Gibt eine URL zurück die direkt im Browser angezeigt werden kann.
     * @param {string} bucket @param {string} path
     * @returns {Promise<string>}
     */
    async getDisplayUrl(bucket, path) { throw new Error('Not implemented'); }
}
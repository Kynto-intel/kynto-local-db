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
    get type(): string;
    /** @param {string} bucketName @param {{ public?: boolean }} options */
    createBucket(bucketName: string, options?: {
        public?: boolean;
    }): Promise<void>;
    /** @param {string} bucketName */
    deleteBucket(bucketName: string): Promise<void>;
    /** @returns {Promise<BucketInfo[]>} */
    listBuckets(): Promise<BucketInfo[]>;
    /**
     * @param {string} bucket
     * @param {File|Blob} file
     * @param {string} path      - Relativer Pfad im Bucket
     * @param {{ upsert?: boolean }} options
     * @returns {Promise<UploadResult>}
     */
    upload(bucket: string, file: File | Blob, path: string, options?: {
        upsert?: boolean;
    }): Promise<UploadResult>;
    /**
     * @param {string} bucket
     * @param {string} path
     * @returns {Promise<Blob>}
     */
    download(bucket: string, path: string): Promise<Blob>;
    /** @param {string} bucket @param {string} path */
    delete(bucket: string, path: string): Promise<void>;
    /**
     * @param {string} bucket
     * @param {string} [prefix]   - Ordner-Filter
     * @returns {Promise<FileEntry[]>}
     */
    listFiles(bucket: string, prefix?: string): Promise<FileEntry[]>;
    /**
     * Gibt eine URL zurück die direkt im Browser angezeigt werden kann.
     * @param {string} bucket @param {string} path
     * @returns {Promise<string>}
     */
    getDisplayUrl(bucket: string, path: string): Promise<string>;
}
export type UploadResult = {
    /**
     * - Relativer Pfad im Bucket, z.B. "avatars/user_1/foto.jpg"
     */
    path: string;
    /**
     * - Zugreifbare URL oder OPFS-Referenz
     */
    url: string;
    /**
     * - Bucket-Name
     */
    bucket: string;
    /**
     * - MIME-Type der Datei
     */
    mime_type: string;
    /**
     * - Dateigröße in Bytes
     */
    file_size: number;
};
export type BucketInfo = {
    /**
     * - Bucket-Name
     */
    name: string;
    /**
     * - Öffentlich zugänglich?
     */
    public: boolean;
    /**
     * - Anzahl Dateien
     */
    file_count: number;
    /**
     * - Gesamtgröße in Bytes
     */
    total_size: number;
};
export type FileEntry = {
    /**
     * - Dateiname
     */
    name: string;
    /**
     * - Vollständiger Pfad
     */
    path: string;
    /**
     * - Bucket-Name
     */
    bucket: string;
    mime_type: string;
    file_size: number;
    /**
     * - ISO-Timestamp
     */
    created_at: string;
    /**
     * - Zugreifbare URL
     */
    url: string;
};

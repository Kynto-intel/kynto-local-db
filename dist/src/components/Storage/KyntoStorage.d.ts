export const STORAGE_SCHEMA_SQL: "\nCREATE TABLE IF NOT EXISTS kynto_storage_buckets (\n    id          TEXT    PRIMARY KEY,           -- Bucket-Name = ID\n    public      BOOLEAN NOT NULL DEFAULT false,\n    adapter     TEXT    NOT NULL DEFAULT 'opfs', -- 'opfs' | 'node' | 'http'\n    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP\n);\n\nCREATE TABLE IF NOT EXISTS kynto_storage_objects (\n    id           TEXT    PRIMARY KEY,\n    bucket_id    TEXT    NOT NULL REFERENCES kynto_storage_buckets(id) ON DELETE CASCADE,\n    storage_path TEXT    NOT NULL,             -- Relativer Pfad im Bucket\n    mime_type    TEXT,\n    file_size    INTEGER,\n    uploaded_by  TEXT,                         -- Optional: User-ID\n    url          TEXT,                         -- Gespeicherte URL/Referenz\n    created_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,\n    UNIQUE(bucket_id, storage_path)\n);\n";
export const KyntoStorage: KyntoStorageManager;
declare class KyntoStorageManager {
    _adapter: OPFSAdapter | NodeAdapter | HTTPAdapter;
    _pgQuery: Function;
    _pgId: string;
    _ready: boolean;
    /**
     * @param {object} options
     * @param {'opfs'|'node'|'http'} options.adapter
     * @param {Function} options.pgQuery          - window.api.pgQuery(sql, pgId)
     * @param {string}   options.pgId             - Aktive PGlite-Instanz-ID
     * @param {string}   [options.nodeBasePath]   - Für NodeAdapter
     * @param {string}   [options.httpBaseUrl]    - Für HTTPAdapter
     * @param {string}   [options.httpApiKey]     - Für HTTPAdapter
     */
    init({ adapter, pgQuery, pgId, nodeBasePath, httpBaseUrl, httpApiKey }: {
        adapter: "opfs" | "node" | "http";
        pgQuery: Function;
        pgId: string;
        nodeBasePath?: string;
        httpBaseUrl?: string;
        httpApiKey?: string;
    }): Promise<void>;
    _assertReady(): void;
    createBucket(name: any, options?: {}): Promise<{
        name: any;
        public: any;
    }>;
    deleteBucket(name: any): Promise<void>;
    listBuckets(): Promise<any>;
    /**
     * Lädt eine Datei hoch und registriert sie in PGlite.
     * @param {string}   bucket
     * @param {File|Blob} file
     * @param {string}   filePath    - Relativer Pfad im Bucket, z.B. "user_1/foto.jpg"
     * @param {string}   [uploadedBy]
     * @returns {Promise<{url: string, path: string, bucket: string}>}
     */
    upload(bucket: string, file: File | Blob, filePath: string, uploadedBy?: string): Promise<{
        url: string;
        path: string;
        bucket: string;
    }>;
    download(bucket: any, filePath: any): Promise<Blob>;
    delete(bucket: any, filePath: any): Promise<void>;
    listFiles(bucket: any, prefix?: string): Promise<any>;
    /**
     * Gibt eine URL zurück die direkt als img.src oder href verwendet werden kann.
     * @param {string} bucket
     * @param {string} filePath
     * @returns {Promise<string>}
     */
    getDisplayUrl(bucket: string, filePath: string): Promise<string>;
    /**
     * Parst eine gespeicherte URL und gibt Bucket + Pfad zurück.
     * Hilfreich wenn eine PGlite-Zelle eine Storage-URL enthält.
     * @param {string} url
     * @returns {{ bucket: string, path: string }|null}
     */
    parseStorageUrl(url: string): {
        bucket: string;
        path: string;
    } | null;
    /**
     * Prüft ob ein Wert eine Storage-Referenz ist.
     * @param {*} val
     */
    isStorageRef(val: any): boolean;
    /**
     * Generiert eine UUID (intern)
     * @private
     */
    private _generateSimpleId;
    get adapterType(): string;
}
import { OPFSAdapter } from './adapters/OPFSAdapter.js';
import { NodeAdapter } from './adapters/NodeAdapter.js';
import { HTTPAdapter } from './adapters/HTTPAdapter.js';
export {};

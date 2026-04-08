export const STORAGE_SCHEMA_SQL: "\nCREATE TABLE IF NOT EXISTS kynto_storage_buckets (\n    id          TEXT    PRIMARY KEY,\n    public      BOOLEAN NOT NULL DEFAULT false,\n    adapter     TEXT    NOT NULL DEFAULT 'opfs',\n    created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))\n);\n\nCREATE TABLE IF NOT EXISTS kynto_storage_objects (\n    id           TEXT    PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),\n    bucket_id    TEXT    NOT NULL REFERENCES kynto_storage_buckets(id) ON DELETE CASCADE,\n    storage_path TEXT    NOT NULL,\n    mime_type    TEXT,\n    file_size    INTEGER,\n    uploaded_by  TEXT,\n    url          TEXT,\n    created_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),\n    UNIQUE(bucket_id, storage_path)\n);\n";
export const KyntoStorage: KyntoStorageManager;
declare class KyntoStorageManager {
    _adapter: any;
    _pgQuery: any;
    _pgId: any;
    _ready: boolean;
    init({ adapter, pgQuery, pgId, nodeBasePath, httpBaseUrl, httpApiKey }: {
        adapter?: string;
        pgQuery: any;
        pgId: any;
        nodeBasePath: any;
        httpBaseUrl: any;
        httpApiKey: any;
    }): Promise<void>;
    _assertReady(): void;
    createBucket(name: any, options?: {}): Promise<{
        name: any;
        public: any;
    }>;
    deleteBucket(name: any): Promise<void>;
    listBuckets(): Promise<any>;
    upload(bucket: any, file: any, filePath: any, uploadedBy: any): Promise<any>;
    download(bucket: any, filePath: any): Promise<any>;
    delete(bucket: any, filePath: any): Promise<void>;
    listFiles(bucket: any, prefix?: string): Promise<any>;
    getDisplayUrl(bucket: any, filePath: any): Promise<any>;
    parseStorageUrl(url: any): {
        bucket: any;
        path: any;
    };
    isStorageRef(val: any): boolean;
    get adapterType(): any;
}
export {};

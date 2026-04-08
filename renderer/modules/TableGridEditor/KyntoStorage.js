/* ── storage/KyntoStorage.js ──────────────────────────────────────────────
   Kynto OS — Zentrales Storage-System
   ────────────────────────────────────────────────────────────────────────── */

import { OPFSAdapter } from './adapters/OPFSAdapter.js';
import { NodeAdapter } from './adapters/NodeAdapter.js';
import { HTTPAdapter } from './adapters/HTTPAdapter.js';

// ── SQL-Schema ─────────────────────────────────────────────────────────────
export const STORAGE_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS kynto_storage_buckets (
    id          TEXT    PRIMARY KEY,
    public      BOOLEAN NOT NULL DEFAULT false,
    adapter     TEXT    NOT NULL DEFAULT 'opfs',
    created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

CREATE TABLE IF NOT EXISTS kynto_storage_objects (
    id           TEXT    PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    bucket_id    TEXT    NOT NULL REFERENCES kynto_storage_buckets(id) ON DELETE CASCADE,
    storage_path TEXT    NOT NULL,
    mime_type    TEXT,
    file_size    INTEGER,
    uploaded_by  TEXT,
    url          TEXT,
    created_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
    UNIQUE(bucket_id, storage_path)
);
`;

class KyntoStorageManager {
    constructor() {
        this._adapter  = null;
        this._pgQuery  = null;
        this._pgId     = null;
        this._ready    = false;
    }

    async init({ adapter = 'opfs', pgQuery, pgId, nodeBasePath, httpBaseUrl, httpApiKey }) {
        this._pgQuery = pgQuery;
        this._pgId    = pgId;

        switch (adapter) {
            case 'opfs':
                if (!('storage' in navigator && 'getDirectory' in navigator.storage)) {
                    throw new Error('[KyntoStorage] OPFS wird von diesem Browser nicht unterstützt.');
                }
                this._adapter = new OPFSAdapter();
                break;
            case 'node':
                if (!nodeBasePath) throw new Error('[KyntoStorage] nodeBasePath erforderlich für Node-Adapter.');
                this._adapter = new NodeAdapter({ basePath: nodeBasePath });
                break;
            case 'http':
                if (!httpBaseUrl) throw new Error('[KyntoStorage] httpBaseUrl erforderlich für HTTP-Adapter.');
                this._adapter = new HTTPAdapter({ baseUrl: httpBaseUrl, apiKey: httpApiKey });
                break;
            default:
                throw new Error(`[KyntoStorage] Unbekannter Adapter: "${adapter}"`);
        }

        if (pgQuery && pgId) {
            await pgQuery(STORAGE_SCHEMA_SQL, pgId);
        }

        this._ready = true;
        console.info(`[KyntoStorage] Initialisiert mit Adapter: ${adapter}`);
    }

    _assertReady() {
        if (!this._ready) throw new Error('[KyntoStorage] Nicht initialisiert. Erst KyntoStorage.init() aufrufen.');
    }

    async createBucket(name, options = {}) {
        this._assertReady();
        await this._adapter.createBucket(name, options);

        if (this._pgQuery) {
            await this._pgQuery(`
                INSERT INTO kynto_storage_buckets (id, public, adapter)
                VALUES ('${_esc(name)}', ${options.public ? 1 : 0}, '${this._adapter.type}')
                ON CONFLICT(id) DO NOTHING
            `, this._pgId);
        }
        return { name, public: options.public ?? false };
    }

    async deleteBucket(name) {
        this._assertReady();
        await this._adapter.deleteBucket(name);
        if (this._pgQuery) {
            await this._pgQuery(
                `DELETE FROM kynto_storage_buckets WHERE id = '${_esc(name)}'`,
                this._pgId
            );
        }
    }

    async listBuckets() {
        this._assertReady();
        return this._adapter.listBuckets();
    }

    async upload(bucket, file, filePath, uploadedBy) {
        this._assertReady();
        const result = await this._adapter.upload(bucket, file, filePath);

        if (this._pgQuery) {
            await this._pgQuery(`
                INSERT INTO kynto_storage_objects
                    (bucket_id, storage_path, mime_type, file_size, uploaded_by, url)
                VALUES (
                    '${_esc(bucket)}',
                    '${_esc(filePath)}',
                    '${_esc(result.mime_type || '')}',
                    ${result.file_size || 0},
                    ${uploadedBy ? `'${_esc(uploadedBy)}'` : 'NULL'},
                    '${_esc(result.url)}'
                )
                ON CONFLICT(bucket_id, storage_path) DO UPDATE SET
                    mime_type   = excluded.mime_type,
                    file_size   = excluded.file_size,
                    url         = excluded.url
            `, this._pgId);
        }
        return result;
    }

    async download(bucket, filePath) {
        this._assertReady();
        return this._adapter.download(bucket, filePath);
    }

    async delete(bucket, filePath) {
        this._assertReady();
        await this._adapter.delete(bucket, filePath);
        if (this._pgQuery) {
            await this._pgQuery(`
                DELETE FROM kynto_storage_objects
                WHERE bucket_id = '${_esc(bucket)}' AND storage_path = '${_esc(filePath)}'
            `, this._pgId);
        }
    }

    async listFiles(bucket, prefix = '') {
        this._assertReady();
        return this._adapter.listFiles(bucket, prefix);
    }

    async getDisplayUrl(bucket, filePath) {
        this._assertReady();
        return this._adapter.getDisplayUrl(bucket, filePath);
    }

    parseStorageUrl(url) {
        const opfs = url?.match(/^opfs:\/\/([^/]+)\/(.+)$/);
        if (opfs) return { bucket: opfs[1], path: opfs[2] };

        const kynto = url?.match(/^kynto-storage:\/\/([^/]+)\/(.+)$/);
        if (kynto) return { bucket: kynto[1], path: kynto[2] };

        return null;
    }

    isStorageRef(val) {
        if (typeof val !== 'string') return false;
        return val.startsWith('opfs://') ||
               val.startsWith('kynto-storage://') ||
               /\.(jpg|jpeg|png|webp|gif|svg|mp4|webm|pdf)$/i.test(val);
    }

    get adapterType() { return this._adapter?.type ?? null; }
}

export const KyntoStorage = new KyntoStorageManager();

function _esc(str) {
    return String(str ?? '').replace(/'/g, "''");
}
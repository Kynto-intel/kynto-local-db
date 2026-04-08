/* ── storage/KyntoStorage.js ──────────────────────────────────────────────
   Kynto OS — Zentrales Storage-System
   
   Trennung:
     PGlite  → Metadaten (Pfad, MIME, Größe, Bucket)
     Adapter → Echte Binärdaten (Bild, Video, PDF, ...)

   Nutzung:
     import { KyntoStorage } from '../../src/components/Storage/KyntoStorage.js';

     // 1. Einmalig beim App-Start initialisieren
     await KyntoStorage.init({
         adapter: 'opfs',          // 'opfs' | 'node' | 'http'
         pgQuery: window.api.pgQuery,
         pgId:    state.pgId,
         // Für 'node': nodeBasePath: '/Users/max/KyntoDB/mein-projekt/storage'
         // Für 'http': httpBaseUrl: 'http://localhost:9000'
     });

     // 2. Bucket erstellen
     await KyntoStorage.createBucket('avatare', { public: true });

     // 3. Datei hochladen
     const result = await KyntoStorage.upload('avatare', file, 'user_1/foto.jpg');
     // result.url → wird in PGlite-Spalte gespeichert

     // 4. Datei anzeigen
     const displayUrl = await KyntoStorage.getDisplayUrl('avatare', 'user_1/foto.jpg');
     img.src = displayUrl;
   ────────────────────────────────────────────────────────────────────────── */

import { OPFSAdapter } from './adapters/OPFSAdapter.js';
import { NodeAdapter } from './adapters/NodeAdapter.js';
import { HTTPAdapter } from './adapters/HTTPAdapter.js';

// ── SQL-Schema (einmalig ausführen) ────────────────────────────────────────
export const STORAGE_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS kynto_storage_buckets (
    id          TEXT    PRIMARY KEY,           -- Bucket-Name = ID
    public      BOOLEAN NOT NULL DEFAULT false,
    adapter     TEXT    NOT NULL DEFAULT 'opfs', -- 'opfs' | 'node' | 'http'
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS kynto_storage_objects (
    id           TEXT    PRIMARY KEY,
    bucket_id    TEXT    NOT NULL REFERENCES kynto_storage_buckets(id) ON DELETE CASCADE,
    storage_path TEXT    NOT NULL,             -- Relativer Pfad im Bucket
    mime_type    TEXT,
    file_size    INTEGER,
    uploaded_by  TEXT,                         -- Optional: User-ID
    url          TEXT,                         -- Gespeicherte URL/Referenz
    created_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(bucket_id, storage_path)
);
`;

// ── Hauptklasse ────────────────────────────────────────────────────────────

class KyntoStorageManager {
    constructor() {
        this._adapter  = null;
        this._pgQuery  = null;
        this._pgId     = null;
        this._ready    = false;
    }

    /**
     * @param {object} options
     * @param {'opfs'|'node'|'http'} options.adapter
     * @param {Function} options.pgQuery          - window.api.pgQuery(sql, pgId)
     * @param {string}   options.pgId             - Aktive PGlite-Instanz-ID
     * @param {string}   [options.nodeBasePath]   - Für NodeAdapter
     * @param {string}   [options.httpBaseUrl]    - Für HTTPAdapter
     * @param {string}   [options.httpApiKey]     - Für HTTPAdapter
     */
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
                // Initialisiere den Node-Adapter (erstellt Basis-Pfad wenn nötig)
                await this._adapter.initialize();
                break;
            case 'http':
                if (!httpBaseUrl) throw new Error('[KyntoStorage] httpBaseUrl erforderlich für HTTP-Adapter.');
                this._adapter = new HTTPAdapter({ baseUrl: httpBaseUrl, apiKey: httpApiKey });
                break;
            default:
                throw new Error(`[KyntoStorage] Unbekannter Adapter: "${adapter}"`);
        }

        // DB-Schema sicherstellen (nur wenn pgQuery verfügbar)
        if (pgQuery && pgId) {
            try {
                await pgQuery(STORAGE_SCHEMA_SQL, pgId);
                console.log('[KyntoStorage] DB-Schema initialisiert');
                
                // CLEANUP: Entferne alle Buckets mit leeren oder NULL IDs
                try {
                    const cleanupResult = await pgQuery(
                        `DELETE FROM kynto_storage_buckets WHERE id IS NULL OR id = ''`,
                        pgId
                    );
                    console.log('[KyntoStorage] ✓ Cleanup: Ungültige Buckets gelöscht');
                } catch (err) {
                    console.warn('[KyntoStorage] Cleanup-Fehler (ignoriert):', err.message);
                }
                
            } catch (err) {
                console.warn('[KyntoStorage] DB-Schema-Fehler (funktioniert trotzdem ohne DB):', err.message);
            }
        } else {
            console.log('[KyntoStorage] Keine pgQuery/pgId → verwende in-memory-Speicher');
        }

        this._ready = true;
        console.info(`[KyntoStorage] Initialisiert mit Adapter: ${adapter}`);
    }

    _assertReady() {
        if (!this._ready) throw new Error('[KyntoStorage] Nicht initialisiert. Erst KyntoStorage.init() aufrufen.');
    }

    // ── Bucket-API ─────────────────────────────────────────────────────────

    async createBucket(name, options = {}) {
        this._assertReady();
        await this._adapter.createBucket(name, options);

        if (this._pgQuery) {
            await this._pgQuery(`
                INSERT INTO kynto_storage_buckets (id, public, adapter)
                VALUES ('${_esc(name)}', ${options.public ? 'true' : 'false'}, '${this._adapter.type}')
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
        
        // Single Source of Truth: Lese aus Datenbank wenn verfügbar
        if (this._pgQuery && this._pgId) {
            try {
                const adapterType = this._adapter.type || 'opfs';
                console.log('[KyntoStorage] listBuckets mit adapter:', adapterType);
                const result = await this._pgQuery(
                    `SELECT id as name, public, adapter, created_at FROM kynto_storage_buckets 
                     WHERE adapter = '${_esc(adapterType)}'
                     ORDER BY created_at DESC`,
                    this._pgId
                );
                console.log('[KyntoStorage] Buckets aus DB geladen (Adapter: ' + this._adapter.type + '):', result?.length || 0);
                return Array.isArray(result) ? result : [];
            } catch (err) {
                console.warn('[KyntoStorage] Fehler beim Lesen aus DB (Tabelle existiert möglicherweise noch nicht):', err.message);
                // Bei Fehler (z.B. Tabelle existiert nicht): rückgabe leeres Array
                return [];
            }
        }
        
        // Fallback: Nutze Adapter (z.B. OPFS)
        return this._adapter.listBuckets();
    }

    // ── Datei-API ──────────────────────────────────────────────────────────

    /**
     * Lädt eine Datei hoch und registriert sie in PGlite.
     * @param {string}   bucket
     * @param {File|Blob} file
     * @param {string}   filePath    - Relativer Pfad im Bucket, z.B. "user_1/foto.jpg"
     * @param {string}   [uploadedBy]
     * @returns {Promise<{url: string, path: string, bucket: string}>}
     */
    async upload(bucket, file, filePath, uploadedBy) {
        this._assertReady();

        const result = await this._adapter.upload(bucket, file, filePath);
        
        // Generiere eine UUID für diesen Datensatz
        const id = crypto.randomUUID?.() || this._generateSimpleId();

        if (this._pgQuery) {
            await this._pgQuery(`
                INSERT INTO kynto_storage_objects
                    (id, bucket_id, storage_path, mime_type, file_size, uploaded_by, url)
                VALUES (
                    '${_esc(id)}',
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
        
        // Lese Dateien aus der Datenbank (Single Source of Truth)
        if (this._pgQuery && this._pgId) {
            try {
                const where = prefix 
                    ? `WHERE bucket_id = '${_esc(bucket)}' AND storage_path LIKE '${_esc(prefix)}%'`
                    : `WHERE bucket_id = '${_esc(bucket)}'`;
                
                const result = await this._pgQuery(
                    `SELECT 
                        id,
                        bucket_id as bucket,
                        storage_path as path,
                        mime_type,
                        file_size,
                        created_at,
                        url
                    FROM kynto_storage_objects
                    ${where}
                    ORDER BY created_at DESC`,
                    this._pgId
                );
                
                // Transform die Daten in die erwartete Struktur
                if (Array.isArray(result)) {
                    return result.map(row => ({
                        name: row.path?.split('/').pop() || 'file',
                        ...row
                    }));
                }
                return [];
            } catch (err) {
                console.warn('[KyntoStorage] Fehler beim Lesen von Dateien aus DB:', err.message);
                return [];
            }
        }
        
        // Fallback: Nutze Adapter
        return this._adapter.listFiles(bucket, prefix);
    }

    /**
     * Gibt eine URL zurück die direkt als img.src oder href verwendet werden kann.
     * @param {string} bucket
     * @param {string} filePath
     * @returns {Promise<string>}
     */
    async getDisplayUrl(bucket, filePath) {
        this._assertReady();
        return this._adapter.getDisplayUrl(bucket, filePath);
    }

    /**
     * Parst eine gespeicherte URL und gibt Bucket + Pfad zurück.
     * Hilfreich wenn eine PGlite-Zelle eine Storage-URL enthält.
     * @param {string} url
     * @returns {{ bucket: string, path: string }|null}
     */
    parseStorageUrl(url) {
        // opfs://bucket/path/to/file
        const opfs = url?.match(/^opfs:\/\/([^/]+)\/(.+)$/);
        if (opfs) return { bucket: opfs[1], path: opfs[2] };

        // kynto-storage://bucket/path/to/file (Electron)
        const kynto = url?.match(/^kynto-storage:\/\/([^/]+)\/(.+)$/);
        if (kynto) return { bucket: kynto[1], path: kynto[2] };

        return null;
    }

    /**
     * Prüft ob ein Wert eine Storage-Referenz ist.
     * @param {*} val
     */
    isStorageRef(val) {
        if (typeof val !== 'string') return false;
        return val.startsWith('opfs://') ||
               val.startsWith('kynto-storage://') ||
               /\.(jpg|jpeg|png|webp|gif|svg|mp4|webm|pdf)$/i.test(val);
    }

    /**
     * Generiert eine UUID (intern)
     * @private
     */
    _generateSimpleId() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    get adapterType() { return this._adapter?.type ?? null; }
}

// ── Singleton-Export ───────────────────────────────────────────────────────
export const KyntoStorage = new KyntoStorageManager();

// ── Intern: SQL-Escape ─────────────────────────────────────────────────────
function _esc(str) {
    return String(str ?? '').replace(/'/g, "''");
}
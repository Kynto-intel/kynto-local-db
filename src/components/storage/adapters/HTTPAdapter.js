/* ── storage/adapters/HTTPAdapter.js ──────────────────────────────────────
   Remote Storage via HTTP-Endpunkt.
   Kompatibel mit: eigenem Express-Server, MinIO, Garage, S3-kompatiblen APIs.

   Der Nutzer gibt die Server-URL selbst an:
     new HTTPAdapter({ baseUrl: 'http://localhost:9000/kynto-storage' })
   ────────────────────────────────────────────────────────────────────────── */

import { StorageAdapter } from './StorageAdapter.js';

export class HTTPAdapter extends StorageAdapter {
    /**
     * @param {object} options
     * @param {string}  options.baseUrl   - Basis-URL des Storage-Servers
     * @param {string}  [options.apiKey]  - Optional: API-Key für Auth
     * @param {number}  [options.timeout] - Request-Timeout in ms (Standard: 30s)
     */
    constructor({ baseUrl, apiKey, timeout = 30_000 }) {
        super();
        if (!baseUrl) throw new Error('[HTTPAdapter] baseUrl ist erforderlich.');
        this._base    = baseUrl.replace(/\/$/, '');
        this._apiKey  = apiKey;
        this._timeout = timeout;
    }

    get type() { return 'http'; }

    _headers(extra = {}) {
        const h = { ...extra };
        if (this._apiKey) h['X-Kynto-Storage-Key'] = this._apiKey;
        return h;
    }

    async _fetch(path, options = {}) {
        const ctrl    = new AbortController();
        const timer   = setTimeout(() => ctrl.abort(), this._timeout);
        try {
            const res = await fetch(`${this._base}${path}`, {
                ...options,
                signal:  ctrl.signal,
                headers: this._headers(options.headers),
            });
            if (!res.ok) {
                const text = await res.text().catch(() => '');
                throw new Error(`[HTTPAdapter] ${res.status} ${res.statusText}: ${text}`);
            }
            return res;
        } finally {
            clearTimeout(timer);
        }
    }

    // ── Bucket-Operationen ─────────────────────────────────────────────────

    async createBucket(bucketName, options = {}) {
        await this._fetch(`/buckets`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ name: bucketName, public: options.public ?? false }),
        });
        return { name: bucketName, public: options.public ?? false };
    }

    async deleteBucket(bucketName) {
        await this._fetch(`/buckets/${bucketName}`, { method: 'DELETE' });
    }

    async listBuckets() {
        const res  = await this._fetch('/buckets');
        return res.json();
    }

    // ── Datei-Operationen ──────────────────────────────────────────────────

    async upload(bucket, file, filePath, options = {}) {
        const form = new FormData();
        form.append('file', file, filePath.split('/').pop());
        form.append('path', filePath);
        if (options.upsert) form.append('upsert', 'true');

        const res  = await this._fetch(`/buckets/${bucket}/upload`, {
            method: 'POST',
            body:   form,
        });
        return res.json();   // Server antwortet mit UploadResult
    }

    async download(bucket, filePath) {
        const res = await this._fetch(`/buckets/${bucket}/files/${encodeURIComponent(filePath)}`);
        return res.blob();
    }

    async delete(bucket, filePath) {
        await this._fetch(`/buckets/${bucket}/files/${encodeURIComponent(filePath)}`, {
            method: 'DELETE',
        });
    }

    async listFiles(bucket, prefix = '') {
        const qs  = prefix ? `?prefix=${encodeURIComponent(prefix)}` : '';
        const res = await this._fetch(`/buckets/${bucket}/files${qs}`);
        return res.json();
    }

    /**
     * Für HTTP: direkte öffentliche URL.
     * Bei privaten Buckets sollte der Server hier Signed URLs zurückgeben.
     */
    async getDisplayUrl(bucket, filePath) {
        return `${this._base}/buckets/${bucket}/files/${encodeURIComponent(filePath)}`;
    }
}
/* ── storage/adapters/OPFSAdapter.js ──────────────────────────────────────
   Browser-lokaler Storage via Origin Private File System (OPFS).
   Läuft vollständig im Browser, kein Server nötig.
   Kompatibel mit PGlite (das selbst auch OPFS nutzt).

   Browser-Support: Chrome 102+, Firefox 111+, Safari 15.2+
   ────────────────────────────────────────────────────────────────────────── */

import { StorageAdapter } from './StorageAdapter.js';

const ROOT_DIR = 'kynto-storage'; // OPFS-Root-Verzeichnis

export class OPFSAdapter extends StorageAdapter {
    get type() { return 'opfs'; }

    /** @returns {Promise<FileSystemDirectoryHandle>} */
    async _root() {
        const root = await navigator.storage.getDirectory();
        return root.getDirectoryHandle(ROOT_DIR, { create: true });
    }

    async _bucketDir(bucketName, create = true) {
        const root = await this._root();
        return root.getDirectoryHandle(bucketName, { create });
    }

    async _metaFile(bucketName) {
        const dir = await this._bucketDir(bucketName);
        return dir.getFileHandle('.kynto-meta.json', { create: true });
    }

    async _readMeta(bucketName) {
        try {
            const fh = await this._metaFile(bucketName);
            const f  = await fh.getFile();
            const text = await f.text();
            return text ? JSON.parse(text) : { public: false, created_at: new Date().toISOString() };
        } catch { return { public: false, created_at: new Date().toISOString() }; }
    }

    async _writeMeta(bucketName, meta) {
        const fh = await this._metaFile(bucketName);
        const writable = await fh.createWritable();
        const json = JSON.stringify(meta);
        const encoder = new TextEncoder();
        await writable.write(encoder.encode(json));
        await writable.close();
    }

    // ── Bucket-Operationen ─────────────────────────────────────────────────

    async createBucket(bucketName, options = {}) {
        _validateBucketName(bucketName);
        await this._bucketDir(bucketName, true);
        await this._writeMeta(bucketName, {
            public:     options.public ?? false,
            created_at: new Date().toISOString(),
        });
        return { name: bucketName, public: options.public ?? false };
    }

    async deleteBucket(bucketName) {
        const root = await this._root();
        await root.removeEntry(bucketName, { recursive: true });
    }

    async listBuckets() {
        const root = await this._root();
        const buckets = [];
        for await (const [name, handle] of root.entries()) {
            if (handle.kind !== 'directory') continue;
            const meta = await this._readMeta(name);
            const stats = await this._bucketStats(name);
            buckets.push({ name, public: meta.public, ...stats });
        }
        return buckets;
    }

    async _bucketStats(bucketName) {
        let file_count = 0;
        let total_size = 0;
        try {
            const dir = await this._bucketDir(bucketName, false);
            for await (const [name, handle] of _walkDir(dir)) {
                if (name.startsWith('.')) continue;
                const f = await handle.getFile();
                file_count++;
                total_size += f.size;
            }
        } catch { /* leer */ }
        return { file_count, total_size };
    }

    // ── Datei-Operationen ──────────────────────────────────────────────────

    async upload(bucket, file, path, options = {}) {
        const dir     = await this._bucketDir(bucket);
        const parts   = path.split('/');
        const fileName = parts.pop();

        // Unterordner anlegen
        let current = dir;
        for (const part of parts) {
            if (part) current = await current.getDirectoryHandle(part, { create: true });
        }

        const fh = await current.getFileHandle(fileName, { create: true });
        const writable = await fh.createWritable();
        await writable.write(file);
        await writable.close();

        return {
            path,
            bucket,
            url:       `opfs://${bucket}/${path}`,
            mime_type: file.type || _guessMime(fileName),
            file_size: file.size,
        };
    }

    async download(bucket, path) {
        const fh = await this._resolveFile(bucket, path);
        return fh.getFile();
    }

    async delete(bucket, path) {
        const parts    = path.split('/');
        const fileName = parts.pop();
        let dir = await this._bucketDir(bucket, false);
        for (const part of parts) {
            if (part) dir = await dir.getDirectoryHandle(part);
        }
        await dir.removeEntry(fileName);
    }

    async listFiles(bucket, prefix = '') {
        const dir   = await this._bucketDir(bucket, false);
        const files = [];
        for await (const [name, handle] of _walkDir(dir, prefix)) {
            if (name.startsWith('.')) continue;
            const f = await handle.getFile();
            files.push({
                name:       name,
                path:       `${prefix ? prefix + '/' : ''}${name}`,
                bucket,
                mime_type:  f.type || _guessMime(name),
                file_size:  f.size,
                created_at: new Date(f.lastModified).toISOString(),
                url:        `opfs://${bucket}/${prefix ? prefix + '/' : ''}${name}`,
            });
        }
        return files;
    }

    /**
     * Für OPFS: Erstellt eine Object-URL aus dem Blob.
     * Diese URL gilt nur für die aktuelle Session.
     */
    async getDisplayUrl(bucket, path) {
        const blob = await this.download(bucket, path);
        return URL.createObjectURL(blob);
    }

    async _resolveFile(bucket, path) {
        const parts    = path.split('/');
        const fileName = parts.pop();
        let dir = await this._bucketDir(bucket, false);
        for (const part of parts) {
            if (part) dir = await dir.getDirectoryHandle(part);
        }
        return dir.getFileHandle(fileName);
    }
}

// ── Hilfsfunktionen ────────────────────────────────────────────────────────

async function* _walkDir(dir, prefix = '') {
    for await (const [name, handle] of dir.entries()) {
        if (handle.kind === 'file') {
            yield [name, handle];
        } else if (handle.kind === 'directory') {
            yield* _walkDir(handle, prefix ? `${prefix}/${name}` : name);
        }
    }
}

function _validateBucketName(name) {
    if (!/^[a-z0-9][a-z0-9\-]{1,62}[a-z0-9]$/.test(name)) {
        throw new Error(`Ungültiger Bucket-Name: "${name}". Nur Kleinbuchstaben, Zahlen und Bindestriche erlaubt.`);
    }
}

const MIME_MAP = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
    webp: 'image/webp', gif: 'image/gif', svg: 'image/svg+xml',
    mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime',
    mp3: 'audio/mpeg', wav: 'audio/wav',
    pdf: 'application/pdf',
    json: 'application/json',
    txt: 'text/plain', csv: 'text/csv', md: 'text/markdown',
};
function _guessMime(name) {
    const ext = name.split('.').pop()?.toLowerCase();
    return MIME_MAP[ext] || 'application/octet-stream';
}
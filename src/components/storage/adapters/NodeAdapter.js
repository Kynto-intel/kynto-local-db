/* ── storage/adapters/NodeAdapter.js ─────────────────────────────────────
   Adapter für das lokale Dateisystem via Electron IPC Bridge.
   Nutzt window.api oder window.parent.api (falls in iframe).
   ────────────────────────────────────────────────────────────────────────── */

export class NodeAdapter {
    constructor({ basePath }) {
        if (!basePath) throw new Error('[NodeAdapter] basePath ist erforderlich.');
        this.basePath = basePath;
        this.type = 'node';
        
        // Hole die API aus window.api oder window.parent.api (iframe)
        this._api = window.api || window.parent?.api;
        if (!this._api) {
            throw new Error('[NodeAdapter] window.api nicht verfügbar. Möglicherweise in iframe ohne Preload-Zugriff.');
        }
    }

    /**
     * Initialisiert den Adapter und erstellt den Basis-Pfad wenn nötig
     */
    async initialize() {
        try {
            // Stelle sicher, dass der Basis-Pfad existiert
            await this._api.mkdir(this.basePath);
            console.log('[NodeAdapter] Basis-Pfad initialisiert:', this.basePath);
        } catch (err) {
            console.error('[NodeAdapter] Fehler beim Erstellen des Basis-Pfads:', err);
            throw new Error(`[NodeAdapter] Kann Pfad nicht erstellen: ${this.basePath}`);
        }
    }

    async createBucket(name) {
        const path = `${this.basePath}/${name}`;
        try {
            await this._api.mkdir(path);
            console.log('[NodeAdapter] Bucket erstellt:', path);
        } catch (err) {
            throw new Error(`[NodeAdapter] Kann Bucket nicht erstellen: ${err.message}`);
        }
    }

    async deleteBucket(name) {
        const path = `${this.basePath}/${name}`;
        try {
            // Rekursiv löschen - momentan nur unlink für einfache Struktur
            await this._api.unlink(path);
            console.log('[NodeAdapter] Bucket gelöscht:', path);
        } catch (err) {
            throw new Error(`[NodeAdapter] Kann Bucket nicht löschen: ${err.message}`);
        }
    }

    async listBuckets() {
        try {
            const exists = await this._api.exists(this.basePath);
            if (!exists) {
                console.log('[NodeAdapter] Basis-Pfad existiert nicht:', this.basePath);
                return [];
            }
            
            const entries = await this._api.readdir(this.basePath);
            console.log('[NodeAdapter] Einträge im Pfad:', entries);
            
            // Filtere nur echte Verzeichnisse (Buckets)
            // Ausnahme: ignoriere Dateien und versteckte Dateien
            const buckets = entries.filter(e => {
                // Ignoriere Dateien (enthalten .)
                if (e.includes('.')) return false;
                // Nur Verzeichnisse
                return true;
            });
            
            console.log('[NodeAdapter] Gefilterte Buckets:', buckets);
            return buckets;
        } catch (err) {
            console.error('[NodeAdapter] Fehler beim Auflisten von Buckets:', err);
            return [];
        }
    }

    async upload(bucket, file, filePath) {
        const fullPath = `${this.basePath}/${bucket}/${filePath}`;
        const dir = fullPath.substring(0, fullPath.lastIndexOf('/'));
        
        try {
            // Sicherstellen, dass das Zielverzeichnis existiert
            await this._api.mkdir(dir);
            
            // Datei in ArrayBuffer umwandeln für den IPC-Transfer
            const buffer = await file.arrayBuffer();
            
            // Über die Bridge speichern
            await this._api.writeBinary({ 
                path: fullPath, 
                buffer: new Uint8Array(buffer) 
            });

            console.log('[NodeAdapter] Datei hochgeladen:', fullPath);

            return {
                url: `kynto-storage://${bucket}/${filePath}`,
                path: filePath,
                bucket: bucket,
                file_size: file.size,
                mime_type: file.type
            };
        } catch (err) {
            throw new Error(`[NodeAdapter] Upload fehlgeschlagen: ${err.message}`);
        }
    }

    async download(bucket, filePath) {
        const fullPath = `${this.basePath}/${bucket}/${filePath}`;
        const data = await this._api.readBinary(fullPath);
        return new Blob([data]);
    }

    async delete(bucket, filePath) {
        const fullPath = `${this.basePath}/${bucket}/${filePath}`;
        await this._api.unlink(fullPath);
    }

    async listFiles(bucket, prefix = '') {
        try {
            console.log('[NodeAdapter] listFiles aufgerufen für bucket:', bucket, 'prefix:', prefix);
            // HINWEIS: NodeAdapter verlässt sich auf die Datenbank für Datei-Metadaten
            // listFiles wird hauptsächlich von der Datenbankabfrage aufgerufen, nicht vom Dateisystem
            // Hier nur ein einfacher Fallback
            const basePath = `${this.basePath}/${bucket}`;
            const exists = await this._api.exists(basePath);
            if (!exists) return [];
            
            // Rückgabe: leeres Array - Datei-Liste kommt aus der Datenbank
            // Das ist sicherer, da wir nicht wissen, ob ein Verzeichniseintrag eine Datei oder ein Ordner ist
            console.log('[NodeAdapter] listFiles: Keine direkte Dateiaufzählung - nutze Datenbank');
            return [];
        } catch (err) {
            console.error('[NodeAdapter] Fehler beim Auflisten von Dateien:', err);
            return [];
        }
    }

    async getDisplayUrl(bucket, filePath) {
        try {
            console.log('[NodeAdapter] getDisplayUrl - bucket:', bucket, 'filePath:', filePath);
            const fullPath = `${this.basePath}/${bucket}/${filePath}`;
            console.log('[NodeAdapter] getDisplayUrl - fullPath:', fullPath);
            
            // Überprüfe ob die Datei existiert bevor sie gelesen wird
            const exists = await this._api.exists(fullPath);
            if (!exists) {
                throw new Error(`Datei nicht gefunden: ${fullPath}`);
            }
            
            const data = await this._api.readBinary(fullPath);
            if (!data) throw new Error('Datei konnte nicht gelesen werden');
            
            const blob = new Blob([data]);
            const url = URL.createObjectURL(blob);
            console.log('[NodeAdapter] getDisplayUrl - URL erstellt:', url);
            return url;
        } catch (err) {
            console.error('[NodeAdapter] Fehler bei getDisplayUrl:', err);
            throw new Error(`[NodeAdapter] Vorschau fehlgeschlagen: ${err.message}`);
        }
    }
}

// ── Hilfsfunktion ──────────────────────────────────────────────────────────
function _guessMimeFromName(fileName) {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    const mimes = {
        jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
        gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml',
        mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime',
        pdf: 'application/pdf',
    };
    return mimes[ext] || 'application/octet-stream';
}
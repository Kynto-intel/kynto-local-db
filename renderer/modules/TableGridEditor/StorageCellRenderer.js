/* ── TableGridEditor/StorageCellRenderer.js ──────────────────────────────
   Erweiterung für TableGridEditor:
   Erkennt Storage-Referenzen in Zellen und zeigt Vorschauen an.

   ANBINDUNG in TableGridEditor.js:
   
   1. Import oben hinzufügen:
      import { StorageCellRenderer } from './StorageCellRenderer.js';
   
   2. In _renderDataGrid(), dort wo td.innerHTML gesetzt wird,
      ERSETZE:
          td.innerHTML = DataFormatter.formatWithContext(val, colType);
      MIT:
          td.innerHTML = await StorageCellRenderer.render(val, colType);
   
   3. In TableGridEditor.open() nach der Initialisierung:
          StorageCellRenderer.init(KyntoStorage); 
   ────────────────────────────────────────────────────────────────────────── */

/**
 * Erkennt und rendert Storage-Referenzen in Tabellen-Zellen.
 * Kompatibel mit dem bestehenden DataFormatter-System.
 */
export const StorageCellRenderer = {
    _storage: null,

    /**
     * Einmalig aufrufen mit der KyntoStorage-Instanz.
     * @param {import('../../../src/components/Storage/KyntoStorage.js').KyntoStorageManager} storageInstance
     */
    init(storageInstance) {
        this._storage = storageInstance;
    },

    /**
     * Rendert einen Zellwert – erkennt Storage-Refs und gibt Vorschau-HTML zurück.
     * Fällt auf DataFormatter zurück wenn kein Storage-Ref erkannt.
     *
     * @param {*}      val      - Zellwert aus PGlite
     * @param {string} colType  - Spalten-Typ ('text', 'varchar', ...)
     * @returns {Promise<string>} HTML-String
     */
    async render(val, colType) {
        if (!this._storage || !this._storage.isStorageRef(val)) {
            return null; // Signal: DataFormatter verwenden
        }

        const ref = this._storage.parseStorageUrl(val);

        if (ref) {
            return this._renderKnownRef(ref, val);
        }

        // Direkte Datei-Referenz (z.B. HTTP-URL mit Bild-Endung)
        if (typeof val === 'string' && /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(val)) {
            return this._renderImageUrl(val);
        }

        return null;
    },

    _renderKnownRef(ref, originalUrl) {
        const ext  = ref.path.split('.').pop()?.toLowerCase();
        const isImg = /^(jpg|jpeg|png|webp|gif|svg)$/.test(ext);
        const isVid = /^(mp4|webm|mov)$/.test(ext);
        const isPDF = ext === 'pdf';

        if (isImg) {
            return `
                <div class="storage-cell storage-cell--image"
                     data-bucket="${escAttr(ref.bucket)}"
                     data-path="${escAttr(ref.path)}"
                     data-url="${escAttr(originalUrl)}">
                    <div class="storage-cell__thumb-placeholder">🖼</div>
                </div>
            `;
        }
        if (isVid) {
            return `
                <div class="storage-cell storage-cell--video"
                     data-bucket="${escAttr(ref.bucket)}"
                     data-path="${escAttr(ref.path)}">
                    <span class="storage-cell__icon">🎬</span>
                    <span class="storage-cell__name">${escH(ref.path.split('/').pop())}</span>
                </div>
            `;
        }
        if (isPDF) {
            return `
                <div class="storage-cell storage-cell--pdf"
                     data-bucket="${escAttr(ref.bucket)}"
                     data-path="${escAttr(ref.path)}">
                    <span class="storage-cell__icon">📄</span>
                    <span class="storage-cell__name">${escH(ref.path.split('/').pop())}</span>
                </div>
            `;
        }

        return `
            <div class="storage-cell storage-cell--file"
                 data-bucket="${escAttr(ref.bucket)}"
                 data-path="${escAttr(ref.path)}">
                <span class="storage-cell__icon">📁</span>
                <span class="storage-cell__name">${escH(ref.path.split('/').pop())}</span>
            </div>
        `;
    },

    _renderImageUrl(url) {
        return `
            <div class="storage-cell storage-cell--image-direct">
                <img src="${escAttr(url)}"
                     style="height:28px;width:auto;max-width:120px;border-radius:3px;object-fit:cover;"
                     loading="lazy"
                     onerror="this.parentElement.innerHTML='🖼 <small>Fehler</small>'">
            </div>
        `;
    },

    /**
     * Lazy-lädt Bilder in Storage-Cells.
     * Muss aufgerufen werden nachdem die Tabelle gerendert wurde.
     * @param {HTMLElement} container - Das table-view Element
     */
    async hydrateImages(container) {
        if (!this._storage) return;

        const cells = container.querySelectorAll('.storage-cell--image[data-bucket]');
        for (const cell of cells) {
            const { bucket, path } = cell.dataset;
            if (!bucket || !path) continue;

            try {
                const url = await this._storage.getDisplayUrl(bucket, path);
                cell.innerHTML = `
                    <img src="${escAttr(url)}"
                         style="height:28px;width:auto;max-width:120px;border-radius:3px;object-fit:cover;cursor:pointer;"
                         loading="lazy"
                         data-preview-url="${escAttr(url)}"
                         title="${escAttr(path)}">
                `;
                // Klick für Vollbild-Vorschau
                cell.querySelector('img')?.addEventListener('click', (e) => {
                    e.stopPropagation();
                    _openPreviewOverlay(url, path);
                });
            } catch {
                cell.innerHTML = '<span style="opacity:.4;font-size:11px;">🖼 —</span>';
            }
        }

        // Click-Handler für Video/PDF-Cells
        container.querySelectorAll('.storage-cell--video, .storage-cell--pdf, .storage-cell--file').forEach(cell => {
            cell.style.cursor = 'pointer';
            cell.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (!this._storage) return;
                try {
                    const url = await this._storage.getDisplayUrl(cell.dataset.bucket, cell.dataset.path);
                    _openPreviewOverlay(url, cell.dataset.path);
                } catch (err) {
                    console.error('[StorageCellRenderer]', err);
                }
            });
        });
    },
};

// ── Vorschau-Overlay ───────────────────────────────────────────────────────

function _openPreviewOverlay(url, filePath) {
    const old = document.getElementById('storage-preview-overlay');
    if (old) old.remove();

    const ext  = filePath.split('.').pop()?.toLowerCase();
    const isImg = /^(jpg|jpeg|png|webp|gif|svg)$/.test(ext);
    const isVid = /^(mp4|webm|mov)$/.test(ext);
    const isPDF = ext === 'pdf';

    let content;
    if (isImg) {
        content = `<img src="${escAttr(url)}"
            style="max-width:90vw;max-height:85vh;border-radius:8px;object-fit:contain;display:block;">`;
    } else if (isVid) {
        content = `<video src="${escAttr(url)}" controls
            style="max-width:90vw;max-height:85vh;border-radius:8px;display:block;"></video>`;
    } else if (isPDF) {
        content = `<embed src="${escAttr(url)}" type="application/pdf"
            style="width:80vw;height:85vh;border-radius:8px;display:block;">`;
    } else {
        content = `<div style="background:#1f1f23;padding:32px;border-radius:8px;text-align:center;color:#e8e8ee;">
            <div style="font-size:48px;margin-bottom:12px;">📄</div>
            <div style="font-size:13px;">${escH(filePath)}</div>
            <a href="${escAttr(url)}" download style="color:#c29a40;font-size:12px;margin-top:12px;display:block;">↓ Herunterladen</a>
        </div>`;
    }

    const overlay = document.createElement('div');
    overlay.id = 'storage-preview-overlay';
    overlay.style.cssText = `
        position:fixed;inset:0;background:rgba(0,0,0,0.88);
        display:flex;align-items:center;justify-content:center;
        z-index:9999;cursor:pointer;padding:20px;
    `;
    overlay.innerHTML = `<div onclick="event.stopPropagation()" style="position:relative;">${content}</div>`;
    overlay.addEventListener('click', () => overlay.remove());
    document.body.appendChild(overlay);
}

// ── CSS: Styles für Storage-Cells ──────────────────────────────────────────
// Diese Styles einmalig in dein globales CSS einfügen

export const STORAGE_CELL_CSS = `
.storage-cell {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    max-width: 150px;
    cursor: default;
}
.storage-cell__icon { font-size: 14px; flex-shrink: 0; }
.storage-cell__name {
    font-size: 11px;
    opacity: .7;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.storage-cell--image .storage-cell__thumb-placeholder {
    font-size: 16px;
    opacity: .4;
}
`;

// ── Intern ─────────────────────────────────────────────────────────────────

function escH(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}
function escAttr(str) {
    return escH(str).replace(/"/g, '&quot;');
}
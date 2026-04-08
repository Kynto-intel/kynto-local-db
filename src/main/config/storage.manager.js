/* ── src/main/config/storage.manager.js ──────────────────────────────────
   JS-Backend für storage_manager.html
   
   Verbindet die HTML-UI mit KyntoStorage.
   Wird per <script src="..."> in storage_manager.html geladen.
   
   Kommuniziert mit dem Eltern-Fenster via postMessage wenn nötig.
   ────────────────────────────────────────────────────────────────────────── */

// Relativer Import – passe Pfad je nach Projektstruktur an
import { KyntoStorage } from '../../components/storage/KyntoStorage.js';

// ── Initialisierung ────────────────────────────────────────────────────────

let _initialized = false;

async function init() {
    if (_initialized) {
        console.log('[StorageManager] Bereits initialisiert, skip');
        return;
    }
    
    // ═══ WICHTIG: Laden der Config aus localStorage ═══
    let cfg = _loadConfig();
    console.log('[StorageManager] Config beim Reload geladen:', cfg);
    
    console.log('[StorageManager] Starten Initialisierung...');
    try {
        if (!cfg) {
            _showConfigRequired();
            return;
        }

        // Validierung: Falls Adapter 'node' aber kein nodeBasePath vorhanden → OPFS als Fallback
        if (cfg.adapter === 'node' && !cfg.nodeBasePath) {
            console.warn('[StorageManager] node-Adapter ohne nodeBasePath → verwende OPFS');
            cfg.adapter = 'opfs';
        }

        // Validierung: Falls Adapter 'http' aber keine httpBaseUrl vorhanden → OPFS als Fallback
        if (cfg.adapter === 'http' && !cfg.httpBaseUrl) {
            console.warn('[StorageManager] http-Adapter ohne httpBaseUrl → verwende OPFS');
            cfg.adapter = 'opfs';
        }

        console.log('[StorageManager] Initialisiere KyntoStorage mit Adapter:', cfg.adapter, 'und Pfad:', cfg.nodeBasePath);
        const pgQuery = window.parent?.api?.pgQuery ?? window.api?.pgQuery;
        // WICHTIG: pgId MUSS vom parent-frame kommen, nicht 'kynto' hardcoded!
        const pgId = window.parent?.state?.pgId ?? null;
        console.log('[StorageManager] pgQuery verfügbar:', !!pgQuery, 'pgId:', pgId);
        
        // Wenn pgId null ist, versuche die DB-Initialiserung zu ignorieren
        // (das ist OK - die App lädt trotzdem mit gepufferten Daten)
        const pgQuerySafe = (pgId && pgQuery) ? pgQuery : null;
        
        await KyntoStorage.init({
            adapter:      cfg.adapter || 'opfs',
            pgQuery:      pgQuerySafe,
            pgId:         pgId,
            nodeBasePath: cfg.nodeBasePath,
            httpBaseUrl:  cfg.httpBaseUrl,
            httpApiKey:   cfg.httpApiKey,
        });
        
        console.log('[StorageManager] ✓ KyntoStorage initialisiert');

        // Markiere als initialisiert BEVOR wir _renderBuckets aufrufen
        _initialized = true;
        
        console.log('[StorageManager] Starte _renderBuckets...');
        await _renderBuckets();
        console.log('[StorageManager] ✓ Initialisierung abgeschlossen');
    } catch (err) {
        _showError(`Initialisierungsfehler: ${err.message}`);
        console.error('[StorageManager] Fehler bei init:', err);
    }
}

function _loadConfig() {
    // Versuche aus window.KYNTO_STORAGE_CONFIG (vom Eltern-Frame gesetzt)
    if (window.KYNTO_STORAGE_CONFIG) return window.KYNTO_STORAGE_CONFIG;
    // Oder aus localStorage
    const raw = localStorage.getItem('kynto_storage_config');
    if (raw) try { return JSON.parse(raw); } catch { /* ignore */ }
    // Standard: OPFS
    return { adapter: 'opfs' };
}

// ── Bucket-Rendering ───────────────────────────────────────────────────────

async function _renderBuckets() {
    console.log('[StorageManager] _renderBuckets aufgerufen');
    
    // Debug: Zeige aktuelle Config
    const cfg = _loadConfig();
    console.log('[StorageManager] Aktuelle Config:', cfg);
    console.log('[StorageManager] Aktueller Adapter:', KyntoStorage._adapter?.type);
    
    const container = document.getElementById('tab-buckets');
    if (!container) {
        console.error('[StorageManager] Container #tab-buckets nicht gefunden!');
        return;
    }

    container.innerHTML = '<div style="color:var(--muted);font-size:12px;padding:8px 0;">Lade...</div>';

    try {
        const buckets = await KyntoStorage.listBuckets();
        console.log('[StorageManager] Gefundene Buckets:', buckets);
        console.log('[StorageManager] Bucket-Count:', buckets?.length);

        // Info-Banner: Zeige den aktuellen Pfad/Adapter
        let infoBanner = '';
        if (cfg.adapter === 'node' && cfg.nodeBasePath) {
            infoBanner = `
                <div style="background:rgba(76,175,125,0.1);border:1px solid rgba(76,175,125,0.3);border-radius:6px;padding:10px;margin-bottom:14px;font-size:11px;color:var(--text);">
                    <div style="font-weight:600;margin-bottom:4px;">📁 Node-Adapter aktiv</div>
                    <div style="color:var(--muted);font-family:monospace;word-break:break-all;">${escH(cfg.nodeBasePath)}</div>
                </div>
            `;
        } else if (cfg.adapter === 'opfs') {
            infoBanner = `
                <div style="background:rgba(100,150,200,0.1);border:1px solid rgba(100,150,200,0.3);border-radius:6px;padding:10px;margin-bottom:14px;font-size:11px;color:var(--text);">
                    <div style="font-weight:600;margin-bottom:4px;">🔒 OPFS-Adapter (Browser-Speicher)</div>
                    <div style="color:var(--muted);">Container werden im Browser-Speicher gespeichert</div>
                </div>
            `;
        }

        if (buckets.length === 0) {
            console.log('[StorageManager] Keine Buckets, zeige empty-placeholder');
            container.innerHTML = infoBanner + _emptyBucketsHTML();
            _bindCreateBucket(container.querySelector('.btn-gold'));
            return;
        }

        container.innerHTML = infoBanner + `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
                <div class="section-title" style="margin:0;">Container (${buckets.length})</div>
                <button class="btn-gold" id="btn-new-bucket" style="padding:6px 14px;font-size:11px;">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                        <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                    </svg>
                    Neu
                </button>
            </div>
            <div id="bucket-list">
                ${buckets.map(_bucketCardHTML).join('')}
            </div>
        `;

        _bindCreateBucket(container.querySelector('#btn-new-bucket'));
        _bindBucketActions(container);

    } catch (err) {
        console.error('[StorageManager] Fehler in _renderBuckets:', err);
        container.innerHTML = `<div style="color:var(--error);font-size:12px;">${escH(err.message)}</div>`;
    }
}

function _bucketCardHTML(bucket) {
    const sizeStr  = _formatBytes(bucket.total_size || 0);
    const countStr = `${bucket.file_count || 0} Datei${(bucket.file_count || 0) !== 1 ? 'en' : ''}`;
    const pubBadge = bucket.public
        ? `<span style="background:rgba(76,175,125,0.15);color:var(--success);font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px;letter-spacing:.05em;">ÖFFENTLICH</span>`
        : `<span style="background:var(--surface3);color:var(--muted);font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px;letter-spacing:.05em;">PRIVAT</span>`;

    return `
        <div class="card" data-bucket="${escAttr(bucket.name)}" style="cursor:pointer;">
            <div style="display:flex;align-items:flex-start;gap:12px;">
                <div style="background:var(--surface);padding:9px;border-radius:6px;border:1px solid var(--border);flex-shrink:0;">
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="1.8">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                    </svg>
                </div>
                <div style="flex:1;min-width:0;">
                    <div style="display:flex;align-items:center;gap:8px;margin-bottom:5px;">
                        <div style="font-weight:600;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                            ${escH(bucket.name)}
                        </div>
                        ${pubBadge}
                    </div>
                    <div class="description">${countStr} · ${sizeStr}</div>
                </div>
                <div style="display:flex;gap:6px;flex-shrink:0;">
                    <button class="btn-outline btn-open-bucket" data-bucket="${escAttr(bucket.name)}"
                        style="padding:4px 10px;font-size:11px;">Öffnen</button>
                    <button class="btn-outline btn-delete-bucket" data-bucket="${escAttr(bucket.name)}"
                        style="padding:4px 10px;font-size:11px;color:var(--error);border-color:rgba(224,85,85,0.3);">Löschen</button>
                </div>
            </div>
        </div>
    `;
}

function _emptyBucketsHTML() {
    return `
        <div class="empty-placeholder">
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" style="opacity:0.2;">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>
            <h3>Container erstellen</h3>
            <p>Speichern Sie Bilder, Videos, Dokumente und alle anderen Dateitypen.</p>
            <button class="btn-gold">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                Neuer Container
            </button>
        </div>
    `;
}

// ── File-Browser ───────────────────────────────────────────────────────────

async function _openBucket(bucketName) {
    const container = document.getElementById('tab-buckets');
    container.innerHTML = `<div style="color:var(--muted);font-size:12px;">Lade Dateien...</div>`;

    try {
        const files = await KyntoStorage.listFiles(bucketName);

        container.innerHTML = `
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;">
                <button id="btn-back-buckets" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:12px;padding:0;display:flex;align-items:center;gap:4px;">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                        <polyline points="15 18 9 12 15 6"/>
                    </svg>
                    Zurück
                </button>
                <span style="color:var(--border-med);">/</span>
                <span class="section-title" style="margin:0;">${escH(bucketName)}</span>
                <div style="flex:1"></div>
                <label class="btn-gold" style="padding:6px 14px;font-size:11px;cursor:pointer;">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                        <polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/>
                        <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
                    </svg>
                    Upload
                    <input type="file" multiple style="display:none;" id="file-upload-input" data-bucket="${escAttr(bucketName)}">
                </label>
            </div>
            ${files.length === 0
                ? `<div class="empty-placeholder" style="padding:32px 16px;">
                       <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" style="opacity:.2;">
                           <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                           <polyline points="14 2 14 8 20 8"/>
                       </svg>
                       <h3 style="font-size:13px;">Keine Dateien</h3>
                       <p>Lade Dateien in diesen Container hoch.</p>
                   </div>`
                : `<div id="file-grid">${files.map(_fileCardHTML).join('')}</div>`
            }
        `;

        document.getElementById('btn-back-buckets')?.addEventListener('click', _renderBuckets);
        document.getElementById('file-upload-input')?.addEventListener('change', _handleUpload);
        _bindFileActions(container, bucketName);

    } catch (err) {
        container.innerHTML = `<div style="color:var(--error);font-size:12px;">${escH(err.message)}</div>`;
    }
}

function _fileCardHTML(file) {
    const isImage = /^image\//.test(file.mime_type);
    const isVideo = /^video\//.test(file.mime_type);
    const isPDF   = file.mime_type === 'application/pdf';
    const icon    = isImage ? '🖼' : isVideo ? '🎬' : isPDF ? '📄' : '📁';

    return `
        <div class="card" style="padding:12px;margin-bottom:8px;">
            <div style="display:flex;align-items:center;gap:10px;">
                <div style="font-size:20px;flex-shrink:0;">${icon}</div>
                <div style="flex:1;min-width:0;">
                    <div style="font-weight:600;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"
                         title="${escAttr(file.path)}">${escH(file.name)}</div>
                    <div class="description">${_formatBytes(file.file_size)} · ${file.mime_type}</div>
                </div>
                <div style="display:flex;gap:6px;flex-shrink:0;">
                    <button class="btn-outline btn-preview-file"
                        data-bucket="${escAttr(file.bucket)}" data-path="${escAttr(file.path)}"
                        style="padding:3px 8px;font-size:11px;">Vorschau</button>
                    <button class="btn-outline btn-delete-file"
                        data-bucket="${escAttr(file.bucket)}" data-path="${escAttr(file.path)}"
                        style="padding:3px 8px;font-size:11px;color:var(--error);border-color:rgba(224,85,85,0.3);">✕</button>
                </div>
            </div>
        </div>
    `;
}

// ── Event-Handler ──────────────────────────────────────────────────────────

function _bindCreateBucket(btn) {
    if (!btn) {
        console.warn('[StorageManager] Kein Button gefunden für _bindCreateBucket');
        return;
    }
    console.log('[StorageManager] Button gebunden:', btn);
    btn.addEventListener('click', async (e) => {
        e.preventDefault();
        console.log('[StorageManager] Button geklickt');
        
        // Erstelle ein echtes Modal statt prompt()
        const dialog = document.createElement('div');
        dialog.style.cssText = `
            position: fixed; inset: 0; background: rgba(0,0,0,0.6); 
            display: flex; align-items: center; justify-content: center; 
            z-index: 10000; font-family: inherit;
        `;
        
        dialog.innerHTML = `
            <div style="background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 24px; max-width: 400px; width: 90%;">
                <h3 style="margin: 0 0 12px; color: var(--text); font-size: 16px;">Neuer Container</h3>
                <p style="margin: 0 0 16px; color: var(--muted); font-size: 12px;">Bucket-Name (Kleinbuchstaben, Zahlen, Bindestriche)<br>z.B. "meine-bilder"</p>
                <input type="text" id="bucket-name-input" placeholder="z.B. meine-bilder" 
                    style="width: 100%; padding: 8px 12px; background: var(--surface2); border: 1px solid var(--border); 
                    border-radius: 5px; color: var(--text); font-size: 12px; box-sizing: border-box; margin-bottom: 12px;">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 16px;">
                    <input type="checkbox" id="bucket-public-check" style="cursor: pointer;">
                    <label for="bucket-public-check" style="font-size: 12px; color: var(--text); cursor: pointer;">Öffentlich zugänglich (keine Authentifizierung)</label>
                </div>
                <div style="display: flex; gap: 8px;">
                    <button id="btn-cancel" style="flex: 1; padding: 8px; background: var(--surface2); border: 1px solid var(--border); border-radius: 5px; color: var(--text); cursor: pointer; font-size: 12px;">Abbrechen</button>
                    <button id="btn-create" style="flex: 1; padding: 8px; background: linear-gradient(135deg, var(--accent), var(--accent-hi)); border: none; border-radius: 5px; color: #18181b; cursor: pointer; font-size: 12px; font-weight: 700;">Erstellen</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(dialog);
        
        const input = document.getElementById('bucket-name-input');
        const checkbox = document.getElementById('bucket-public-check');
        const btnCancel = document.getElementById('btn-cancel');
        const btnCreate = document.getElementById('btn-create');
        
        input.focus();
        
        const cleanup = () => dialog.remove();
        
        btnCancel.addEventListener('click', cleanup);
        dialog.addEventListener('click', (e) => {
            if (e.target === dialog) cleanup();
        });
        
        btnCreate.addEventListener('click', async () => {
            const name = input.value.trim();
            if (!name) {
                alert('Bitte einen Namen eingeben');
                return;
            }
            cleanup();
            
            const isPublic = checkbox.checked;
            console.log('[StorageManager] Erstelle Bucket:', name, '- Public:', isPublic);
            try {
                const result = await KyntoStorage.createBucket(name.toLowerCase(), { public: isPublic });
                console.log('[StorageManager] Bucket erstellt:', result);
                _showToast(`Container "${name}" erstellt`, 'success');
                await _renderBuckets();
            } catch (err) {
                console.error('[StorageManager] Fehler beim Erstellen:', err);
                alert(`Fehler: ${err.message}`);
            }
        });
        
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') btnCreate.click();
            if (e.key === 'Escape') cleanup();
        });
    });
}

function _bindBucketActions(container) {
    container.querySelectorAll('.btn-open-bucket').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const bucketName = btn.dataset.bucket;
            console.log('[StorageManager] Öffne Bucket:', bucketName, 'type:', typeof bucketName, 'length:', bucketName?.length);
            _openBucket(bucketName);
        });
    });

    container.querySelectorAll('.btn-delete-bucket').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const name = btn.dataset.bucket;
            console.log('[StorageManager] Lösche Bucket:', name, 'type:', typeof name, 'isEmpty:', !name?.trim());
            
            if (!name || !name.trim()) {
                console.warn('[StorageManager] Container-Name ist LEER! Kann nicht löschen:', name);
                alert('⚠ Container-Name ist ungültig (leer). Datenbank-Eintrag wird ignoriert.');
                return;
            }
            
            if (!confirm(`Bucket "${name}" wirklich löschen?\nAlle Dateien darin werden unwiderruflich entfernt.`)) return;
            try {
                await KyntoStorage.deleteBucket(name);
                await _renderBuckets();
            } catch (err) {
                console.error('[StorageManager] Delete-Fehler:', err);
                alert(`Fehler: ${err.message}`);
            }
        });
    });

    // Ganzer Bucket-Card klickbar
    container.querySelectorAll('.card[data-bucket]').forEach(card => {
        card.addEventListener('click', () => _openBucket(card.dataset.bucket));
    });
}

function _bindFileActions(container, bucketName) {
    container.querySelectorAll('.btn-preview-file').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            _previewFile(btn.dataset.bucket, btn.dataset.path);
        });
    });

    container.querySelectorAll('.btn-delete-file').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (!confirm(`Datei "${btn.dataset.path}" löschen?`)) return;
            try {
                await KyntoStorage.delete(btn.dataset.bucket, btn.dataset.path);
                await _openBucket(bucketName);
            } catch (err) {
                alert(`Fehler: ${err.message}`);
            }
        });
    });
}

async function _handleUpload(e) {
    const input  = e.target;
    const bucket = input.dataset.bucket;
    const files  = Array.from(input.files);
    if (!files.length) return;

    _showToast(`Lade ${files.length} Datei${files.length > 1 ? 'en' : ''} hoch...`, 'info');

    let errors = 0;
    for (const file of files) {
        try {
            const safeName = file.name.normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-zA-Z0-9._-]/g, '_');
            await KyntoStorage.upload(bucket, file, safeName);
        } catch (err) {
            console.error('[StorageManager] Upload-Fehler:', err);
            errors++;
        }
    }

    if (errors === 0) {
        _showToast(`${files.length} Datei${files.length > 1 ? 'en' : ''} erfolgreich hochgeladen.`, 'success');
    } else {
        _showToast(`${errors} von ${files.length} Uploads fehlgeschlagen.`, 'error');
    }

    await _openBucket(bucket);
}

async function _previewFile(bucket, filePath) {
    try {
        const url  = await KyntoStorage.getDisplayUrl(bucket, filePath);
        const ext  = filePath.split('.').pop()?.toLowerCase();
        const mime = _extToMime(ext);

        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position:fixed;inset:0;background:rgba(0,0,0,0.85);
            display:flex;align-items:center;justify-content:center;
            z-index:9999;cursor:pointer;padding:20px;
        `;
        overlay.onclick = () => {
            if (mime.startsWith('image/')) URL.revokeObjectURL(url);
            overlay.remove();
        };

        let inner;
        if (mime.startsWith('image/')) {
            inner = `<img src="${escAttr(url)}" style="max-width:90vw;max-height:85vh;border-radius:8px;object-fit:contain;">`;
        } else if (mime.startsWith('video/')) {
            inner = `<video src="${escAttr(url)}" controls style="max-width:90vw;max-height:85vh;border-radius:8px;"></video>`;
        } else if (mime === 'application/pdf') {
            inner = `<embed src="${escAttr(url)}" type="application/pdf" style="width:80vw;height:85vh;border-radius:8px;">`;
        } else {
            inner = `<div style="background:var(--surface2);padding:32px;border-radius:8px;color:var(--text);text-align:center;">
                <div style="font-size:48px;margin-bottom:12px;">📄</div>
                <div>${escH(filePath)}</div>
                <a href="${escAttr(url)}" download style="color:var(--accent);font-size:12px;margin-top:8px;display:block;">Herunterladen</a>
            </div>`;
        }

        overlay.innerHTML = `<div onclick="event.stopPropagation()">${inner}</div>`;
        document.body.appendChild(overlay);

    } catch (err) {
        alert(`Vorschau fehlgeschlagen: ${err.message}`);
    }
}

// ── Einstellungen-Tab ──────────────────────────────────────────────────────

function _initSettingsTab() {
    const cfg = _loadConfig();
    console.log('[StorageManager] Einstellungen geladen:', cfg);

    const adapterSelect = document.getElementById('settings-adapter');
    const nodePathInput = document.getElementById('settings-node-path');
    const httpUrlInput = document.getElementById('settings-http-url');
    const httpKeyInput = document.getElementById('settings-http-key');

    // 1. Setze die Adapter-Auswahl
    if (adapterSelect) {
        const currentAdapter = cfg?.adapter || 'opfs';
        adapterSelect.value = currentAdapter;
        console.log('[StorageManager] Adapter gesetzt auf:', currentAdapter);
    }

    // 2. Fülle die Eingabefelder mit den aktuellen Werten AUS DER CONFIG
    if (nodePathInput) {
        const savedNodePath = cfg?.nodeBasePath || '';
        nodePathInput.value = savedNodePath;
        console.log('[StorageManager] Node-Pfad-Input gefüllt:', savedNodePath);
    }

    if (httpUrlInput) {
        const savedHttpUrl = cfg?.httpBaseUrl || '';
        httpUrlInput.value = savedHttpUrl;
        console.log('[StorageManager] HTTP-URL-Input gefüllt:', savedHttpUrl);
    }

    if (httpKeyInput) {
        const savedHttpKey = cfg?.httpApiKey || '';
        httpKeyInput.value = savedHttpKey;
        console.log('[StorageManager] HTTP-Key-Input gefüllt');
    }

    // 3. Zeige/verstecke die Adapter-Felder NACH dem Füllen
    if (adapterSelect) {
        _toggleAdapterFields(adapterSelect.value);
        
        // 4. Listener hinzufügen für Adapter-Wechsel
        adapterSelect.addEventListener('change', (e) => {
            console.log('[StorageManager] Adapter gewechselt zu:', e.target.value);
            _toggleAdapterFields(e.target.value);
        });
    }

    // 5. Save-Button Handler
    document.getElementById('btn-save-settings')?.addEventListener('click', async () => {
        const newAdapter = adapterSelect?.value || 'opfs';
        const newCfg = { adapter: newAdapter };

        // Validierung: Wenn Node gewählt aber kein Pfad → nicht speichern
        if (newAdapter === 'node' && !nodePathInput?.value?.trim()) {
            alert('⚠ Bitte geben Sie einen Basis-Pfad für den Node-Adapter ein');
            return;
        }

        // Node-Adapter Pfad
        const nodePath = nodePathInput?.value?.trim();
        if (nodePath) {
            newCfg.nodeBasePath = nodePath;
            console.log('[StorageManager] Node-Pfad gespeichert:', nodePath);
        }

        // HTTP-Adapter URLs
        const baseUrl = httpUrlInput?.value?.trim();
        if (baseUrl) {
            newCfg.httpBaseUrl = baseUrl;
            console.log('[StorageManager] HTTP-URL gespeichert:', baseUrl);
        }

        const apiKey = httpKeyInput?.value?.trim();
        if (apiKey) {
            newCfg.httpApiKey = apiKey;
            console.log('[StorageManager] HTTP-Key gespeichert');
        }

        console.log('[StorageManager] ✓ Speichere neue Config:', newCfg);
        localStorage.setItem('kynto_storage_config', JSON.stringify(newCfg));
        _showToast('✓ Einstellungen gespeichert. Seite wird neu geladen...', 'success');
        
        // Nach 1 Sekunde neu laden damit die neuen Einstellungen greifen
        console.log('[StorageManager] Starte Seite-Reload in 1 Sekunde...');
        setTimeout(() => {
            console.log('[StorageManager] → Seite wird neu geladen');
            location.reload();
        }, 1000);
    });
}

function _toggleAdapterFields(adapter) {
    console.log('[StorageManager] Toggle adapter fields für:', adapter);
    const fieldsNode = document.getElementById('fields-node');
    const fieldsHttp = document.getElementById('fields-http');
    
    if (fieldsNode) {
        fieldsNode.classList.toggle('active', adapter === 'node');
        console.log('[StorageManager] fields-node active:', adapter === 'node');
    }
    if (fieldsHttp) {
        fieldsHttp.classList.toggle('active', adapter === 'http');
        console.log('[StorageManager] fields-http active:', adapter === 'http');
    }
}

// ── Toast-Benachrichtigungen ───────────────────────────────────────────────

function _showToast(msg, type = 'info') {
    let el = document.getElementById('storage-toast');
    if (!el) {
        el = document.createElement('div');
        el.id = 'storage-toast';
        el.style.cssText = `
            position:fixed;bottom:16px;left:50%;transform:translateX(-50%);
            padding:8px 18px;border-radius:6px;font-size:12px;font-weight:600;
            z-index:9998;transition:opacity .3s;pointer-events:none;
            background:var(--surface3);border:1px solid var(--border-med);color:var(--text);
        `;
        document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.opacity = '1';
    el.style.borderColor = type === 'success' ? 'var(--success)'
                         : type === 'error'   ? 'var(--error)'
                         : 'var(--border-med)';
    clearTimeout(el._timer);
    el._timer = setTimeout(() => { el.style.opacity = '0'; }, 3000);
}

function _showError(msg) {
    const container = document.getElementById('tab-buckets');
    if (container) container.innerHTML = `
        <div class="empty-placeholder" style="border-color:rgba(224,85,85,0.3);">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--error)" stroke-width="1.5" style="opacity:.7;">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <h3 style="color:var(--error);">Fehler</h3>
            <p>${escH(msg)}</p>
        </div>
    `;
}

function _showConfigRequired() {
    // OPFS ist Standard – einfach initialisieren
    localStorage.setItem('kynto_storage_config', JSON.stringify({ adapter: 'opfs' }));
    init();
}

// ── Hilfsfunktionen ────────────────────────────────────────────────────────

function _formatBytes(bytes) {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    let i = 0;
    let val = bytes;
    while (val >= 1024 && i < units.length - 1) { val /= 1024; i++; }
    return `${val.toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

function escH(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
function escAttr(str) { return escH(str); }

const MIME_MAP = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
    webp: 'image/webp', gif: 'image/gif', svg: 'image/svg+xml',
    mp4: 'video/mp4', webm: 'video/webm',
    pdf: 'application/pdf',
    txt: 'text/plain', csv: 'text/csv',
};
function _extToMime(ext) { return MIME_MAP[ext] || 'application/octet-stream'; }

// ── DOM-Ready ──────────────────────────────────────────────────────────────

function checkDOMReady() {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            init();
            _initSettingsTab();
        }, { once: true });
    } else {
        // DOM ist bereits geladen, starten sofort
        init();
        _initSettingsTab();
    }
}

checkDOMReady();
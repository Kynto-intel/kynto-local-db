document.addEventListener('DOMContentLoaded', async () => {

    // ── Electron IPC ─────────────────────────────────────────────────────────
    // window.electronAPI wird vom preload.js bereitgestellt via contextBridge
    // Erwartet folgende Methoden:
    //   electronAPI.saveData(data)       → speichert editor-data.json
    //   electronAPI.loadData()           → lädt editor-data.json → { markdown, images, logs, linkedHtmlPath }
    //   electronAPI.writeHtmlFile(path, content) → schreibt HTML in verknüpfte Datei
    //   electronAPI.openHtmlFile()       → öffnet Datei-Dialog, gibt { path, content } zurück
    const api = window.electronAPI;

    // ── DOM Refs ──────────────────────────────────────────────────────────────
    const sidebar       = document.getElementById('readme-sidebar');
    const input         = document.getElementById('markdown-input');
    const output        = document.getElementById('render-target');
    const overlay       = document.getElementById('overlay');
    const imageInput    = document.getElementById('image-input');
    const btnAddImage   = document.getElementById('btn-add-image');
    const charCounter   = document.getElementById('char-counter');
    const imageGallery  = document.getElementById('image-gallery');
    const saveStatus    = document.getElementById('save-status');
    const writeToolbar  = document.getElementById('write-toolbar');
    const logToolbar    = document.getElementById('log-toolbar');
    const logList       = document.getElementById('log-list');
    const logDropzone   = document.getElementById('log-dropzone');
    const logSearch     = document.getElementById('log-search');
    const btnImportLog  = document.getElementById('btn-import-log');
    const logFileInput  = document.getElementById('log-file-input');
    const btnLinkHtml   = document.getElementById('btn-link-html');
    const htmlLinkInput = document.getElementById('html-link-input');

    // ── State ─────────────────────────────────────────────────────────────────
    const imageStore = {};       // { imgId: { name, src, size } }
    let   logs       = [];       // Array von Log-Einträgen
    let   activeFilter = 'all';
    let   linkedHtmlPath = null; // Pfad zur verknüpften HTML-Datei
    let   saveTimer  = null;
    let   isDirty    = false;

    // ── Sidebar öffnen ────────────────────────────────────────────────────────
    sidebar.classList.add('open');
    overlay.style.display = 'block';

    // ── Daten laden ───────────────────────────────────────────────────────────
    await loadFromDisk();

    // ── Daten laden von Disk ──────────────────────────────────────────────────
    async function loadFromDisk() {
        try {
            const data = await api.loadData();
            if (!data) {
                setDefaultContent();
                return;
            }

            // Markdown
            if (data.markdown !== undefined) {
                input.value = data.markdown;
            } else {
                setDefaultContent();
            }

            // Bilder
            if (data.images) {
                for (const [imgId, img] of Object.entries(data.images)) {
                    imageStore[imgId] = img;
                    addImageToGallery(imgId, img.name, img.src, img.size);
                }
            }

            // Logs
            if (data.logs && Array.isArray(data.logs)) {
                logs = data.logs;
                renderLogs();
            }

            // Verknüpfte HTML-Datei
            if (data.linkedHtmlPath) {
                linkedHtmlPath = data.linkedHtmlPath;
                updateLinkBtn();
            }

            setSaveStatus('saved');
        } catch (e) {
            console.warn('Laden fehlgeschlagen:', e);
            setDefaultContent();
        }
        updateCounter();
    }

    function setDefaultContent() {
        if (!input.value) {
            input.value = `# Projekttitel\n\nSchreibe hier deine Dokumentation...\n\n## Beschreibung\n\nFüge Bilder mit dem Button oben ein — sie werden als kompakter Platzhalter eingebettet.`;
        }
    }

    // ── Speichern auf Disk ────────────────────────────────────────────────────
    function scheduleSave() {
        isDirty = true;
        setSaveStatus('pending');
        clearTimeout(saveTimer);
        saveTimer = setTimeout(() => saveToDisk(), 800);
    }

    async function saveToDisk() {
        try {
            setSaveStatus('saving');
            await api.saveData({
                markdown:       input.value,
                images:         imageStore,
                logs:           logs,
                linkedHtmlPath: linkedHtmlPath,
                savedAt:        new Date().toISOString()
            });
            isDirty = false;
            setSaveStatus('saved');
        } catch (e) {
            setSaveStatus('error');
            console.error('Speichern fehlgeschlagen:', e);
        }
    }

    function setSaveStatus(state) {
        saveStatus.className = 'save-status';
        if (state === 'saved')   { saveStatus.textContent = '💾 Gespeichert';   saveStatus.classList.add('save-saved');   }
        if (state === 'pending') { saveStatus.textContent = '●  Ungespeichert'; saveStatus.classList.add('save-pending'); }
        if (state === 'saving')  { saveStatus.textContent = '⟳  Speichern…';   saveStatus.classList.add('save-saving');  }
        if (state === 'error')   { saveStatus.textContent = '✕  Fehler!';       saveStatus.classList.add('save-error');   }
    }

    // ── Textarea: Änderungen tracken ──────────────────────────────────────────
    input.addEventListener('input', () => {
        updateCounter();
        scheduleSave();
    });

    // ── Zeichenzähler ─────────────────────────────────────────────────────────
    function updateCounter() {
        const len = input.value.length;
        charCounter.textContent = len > 0 ? `${len.toLocaleString('de')} Zeichen` : '';
    }

    // ── Bild einfügen ─────────────────────────────────────────────────────────
    btnAddImage.onclick = () => imageInput.click();

    imageInput.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const MAX_MB = 5;
        if (file.size > MAX_MB * 1024 * 1024) { showToast(`⚠️ Bild zu groß (max ${MAX_MB} MB)`, 'warn'); return; }
        const reader = new FileReader();
        reader.onload = (ev) => {
            const base64 = ev.target.result;
            const imgId  = 'img_' + Math.random().toString(36).slice(2, 9);
            const sizeKB = Math.round(file.size / 1024);
            imageStore[imgId] = { name: file.name, src: base64, size: sizeKB };
            insertAtCursor(input, `![${file.name}][${imgId}]`);
            addImageToGallery(imgId, file.name, base64, sizeKB);
            showToast(`✅ "${file.name}" eingefügt (${sizeKB} KB)`);
            scheduleSave();
        };
        reader.readAsDataURL(file);
        imageInput.value = '';
    };

    // ── Bildergalerie ─────────────────────────────────────────────────────────
    function addImageToGallery(imgId, name, src, sizeKB) {
        imageGallery.style.display = 'flex';
        document.getElementById('gallery-section').style.display = 'block';
        const item = document.createElement('div');
        item.className = 'gallery-item';
        item.dataset.id = imgId;
        item.innerHTML = `
            <img src="${src}" alt="${name}" title="${name} (${sizeKB} KB)">
            <span class="gallery-label" title="${name}">${name}</span>
            <button class="gallery-remove" title="Bild entfernen">×</button>
        `;
        item.querySelector('img').onclick = () => insertAtCursor(input, `![${name}][${imgId}]`);
        item.querySelector('.gallery-remove').onclick = () => removeImage(imgId, item);
        imageGallery.appendChild(item);
    }

    function removeImage(imgId, itemEl) {
        delete imageStore[imgId];
        itemEl.remove();
        if (imageGallery.children.length === 0) {
            imageGallery.style.display = 'none';
            document.getElementById('gallery-section').style.display = 'none';
        }
        input.value = input.value.replace(new RegExp(`!\\[[^\\]]*\\]\\[${imgId}\\]`, 'g'), '[Bild entfernt]');
        scheduleSave();
    }

    // ── Markdown rendern ──────────────────────────────────────────────────────
    function renderMarkdown() {
        let md = input.value;
        const refs = Object.entries(imageStore).map(([id, { src }]) => `[${id}]: ${src}`).join('\n');
        if (refs) md += '\n\n' + refs;
        output.innerHTML = DOMPurify.sanitize(marked.parse(md));
    }

    // ── Tabs ──────────────────────────────────────────────────────────────────
    document.getElementById('tab-write').onclick   = (e) => switchTab('pane-write', e.target);
    document.getElementById('tab-preview').onclick = (e) => { renderMarkdown(); switchTab('pane-preview', e.target); };
    document.getElementById('tab-logs').onclick    = (e) => switchTab('pane-logs', e.target);

    function switchTab(paneId, btn) {
        document.querySelectorAll('.pane').forEach(p => p.classList.remove('active'));
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.getElementById(paneId).classList.add('active');
        btn.classList.add('active');

        const isLogs  = paneId === 'pane-logs';
        const isWrite = paneId === 'pane-write';
        writeToolbar.style.display = isWrite ? '' : 'none';
        logToolbar.style.display   = isLogs  ? '' : 'none';
    }

    // ══════════════════════════════════════════════════════════════════════════
    // ── LOGS TAB ──────────────────────────────────────────────────────────────
    // ══════════════════════════════════════════════════════════════════════════

    // Klassifiziert eine Zeile als ok / error / warn / info
    function classifyLine(line) {
        const l = line.toLowerCase();
        if (/error|fehler|fail|exception|critical|fatal|✕|❌/.test(l))  return 'error';
        if (/warn|warning|achtung|⚠/.test(l))                           return 'warn';
        if (/info|debug|trace|ℹ/.test(l))                               return 'info';
        if (/ok|success|erfolgreich|done|completed|✓|✅|started|running/.test(l)) return 'ok';
        return 'info';
    }

    // Parsed einen rohen Log-Text in einzelne Einträge
    function parseLogText(text, sourceName) {
        const lines = text.split('\n').filter(l => l.trim().length > 0);
        const now   = new Date().toISOString();
        return lines.map((line, i) => ({
            id:       `log_${Date.now()}_${i}`,
            source:   sourceName || 'Manuell',
            line:     line.trim(),
            type:     classifyLine(line),
            addedAt:  now
        }));
    }

    // Rendert die Log-Liste (mit Filter + Suche)
    function renderLogs() {
        const query = (logSearch?.value || '').toLowerCase();

        const filtered = logs.filter(entry => {
            const matchType   = activeFilter === 'all' || entry.type === activeFilter;
            const matchSearch = !query || entry.line.toLowerCase().includes(query) || entry.source.toLowerCase().includes(query);
            return matchType && matchSearch;
        });

        logList.innerHTML = '';

        if (filtered.length === 0) {
            logList.innerHTML = `<div class="log-empty-msg">${logs.length === 0 ? '📭 Noch keine Logs. Datei importieren oder in den Editor ziehen.' : '🔍 Keine Logs für diesen Filter.'}</div>`;
            return;
        }

        // Dropzone ausblenden wenn Logs da sind
        logDropzone.classList.add('log-dropzone-small');

        filtered.forEach(entry => {
            const row = document.createElement('div');
            row.className = `log-entry log-${entry.type}`;
            row.draggable = true;
            row.dataset.id = entry.id;

            const badge = { ok: '✅', error: '❌', warn: '⚠️', info: 'ℹ️' }[entry.type] || 'ℹ️';
            const time  = entry.addedAt ? new Date(entry.addedAt).toLocaleTimeString('de') : '';

            row.innerHTML = `
                <span class="log-badge">${badge}</span>
                <span class="log-line">${escapeHtml(entry.line)}</span>
                <span class="log-meta">${escapeHtml(entry.source)} ${time}</span>
                <button class="log-insert-btn" title="In Editor einfügen">⤵</button>
            `;

            // Klick auf ⤵ Button: in Textarea einfügen
            row.querySelector('.log-insert-btn').onclick = (e) => {
                e.stopPropagation();
                insertLogIntoEditor(entry);
            };

            // Drag-Start: Daten als Text übertragen
            row.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', formatLogForEditor(entry));
                e.dataTransfer.effectAllowed = 'copy';
                row.classList.add('log-dragging');
            });
            row.addEventListener('dragend', () => row.classList.remove('log-dragging'));

            logList.appendChild(row);
        });
    }

    // Formatiert einen Log-Eintrag für den Editor
    function formatLogForEditor(entry) {
        const icon = { ok: '✅', error: '❌', warn: '⚠️', info: 'ℹ️' }[entry.type] || 'ℹ️';
        const time = entry.addedAt ? new Date(entry.addedAt).toLocaleString('de') : '';
        return `> ${icon} **[${entry.source}]** ${entry.line}  \n> *${time}*\n`;
    }

    function insertLogIntoEditor(entry) {
        // Zum Write-Tab wechseln
        document.getElementById('tab-write').click();
        insertAtCursor(input, formatLogForEditor(entry));
        showToast('📋 Log in Editor eingefügt');
        scheduleSave();
    }

    // ── Drag & Drop von Logs IN den Textarea ──────────────────────────────────
    input.addEventListener('dragover', e => {
        e.preventDefault();
        const types = [...e.dataTransfer.types];
        if (types.includes('text/plain')) {
            input.classList.add('drag-over');
            e.dataTransfer.dropEffect = 'copy';
        }
    });
    input.addEventListener('dragleave', () => input.classList.remove('drag-over'));
    input.addEventListener('drop', e => {
        e.preventDefault();
        input.classList.remove('drag-over');

        // Bild-Drop
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
            imageInput.files = e.dataTransfer.files;
            imageInput.dispatchEvent(new Event('change'));
            return;
        }

        // Text-Drop (vom Log-Eintrag)
        const text = e.dataTransfer.getData('text/plain');
        if (text) {
            // Cursor-Position durch Drop-Koordinate bestimmen
            const dropPos = getDropCursorPos(input, e.clientX, e.clientY);
            const before  = input.value.substring(0, dropPos);
            const after   = input.value.substring(dropPos);
            input.value   = before + text + after;
            input.focus();
            input.setSelectionRange(dropPos + text.length, dropPos + text.length);
            updateCounter();
            scheduleSave();
        }
    });

    // Schätzt Cursor-Position anhand Drop-Koordinaten (einfache Heuristik)
    function getDropCursorPos(textarea, x, y) {
        try {
            // Moderner Weg über caretPositionFromPoint
            const doc = textarea.ownerDocument;
            if (doc.caretPositionFromPoint) {
                const pos = doc.caretPositionFromPoint(x, y);
                return pos ? pos.offset : textarea.value.length;
            }
            if (doc.caretRangeFromPoint) {
                const range = doc.caretRangeFromPoint(x, y);
                return range ? range.startOffset : textarea.value.length;
            }
        } catch (_) {}
        return textarea.value.length;
    }

    // ── Log-Dropzone (Datei-Drop) ─────────────────────────────────────────────
    logDropzone.addEventListener('dragover', e => {
        e.preventDefault();
        logDropzone.classList.add('drop-active');
    });
    logDropzone.addEventListener('dragleave', () => logDropzone.classList.remove('drop-active'));
    logDropzone.addEventListener('drop', e => {
        e.preventDefault();
        logDropzone.classList.remove('drop-active');
        const file = e.dataTransfer.files[0];
        if (file) importLogFile(file);
    });

    // ── Log-Datei importieren ─────────────────────────────────────────────────
    btnImportLog.onclick = () => logFileInput.click();
    logFileInput.onchange = (e) => {
        const file = e.target.files[0];
        if (file) importLogFile(file);
        logFileInput.value = '';
    };

    function importLogFile(file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
            const text     = ev.target.result;
            const newLogs  = parseLogText(text, file.name);
            logs = [...logs, ...newLogs];
            renderLogs();
            scheduleSave();
            showToast(`✅ ${newLogs.length} Log-Einträge aus "${file.name}" importiert`);
        };
        reader.readAsText(file, 'utf-8');
    }

    // ── Filter Buttons ────────────────────────────────────────────────────────
    document.querySelectorAll('.log-filter-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.log-filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeFilter = btn.dataset.filter;
            renderLogs();
        };
    });

    logSearch.addEventListener('input', () => renderLogs());

    // ══════════════════════════════════════════════════════════════════════════
    // ── HTML VERKNÜPFEN & EXPORTIEREN ─────────────────────────────────────────
    // ══════════════════════════════════════════════════════════════════════════

    function buildHtmlContent() {
        let md = input.value;
        const refs = Object.entries(imageStore).map(([id, { src }]) => `[${id}]: ${src}`).join('\n');
        if (refs) md += '\n\n' + refs;
        const htmlContent = marked.parse(md);

        return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<title>Datenbank Dokumentation</title>
<style>
  :root { --bg:#18181b; --surf:#1f1f23; --border:#3a3a42; --text:#e8e8ee; --accent:#c29a40; --r:7px; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background:var(--bg); color:var(--text); font-family:'Segoe UI',sans-serif; padding:40px 20px; display:flex; justify-content:center; }
  .wrap { max-width:860px; width:100%; background:var(--surf); padding:50px; border-radius:var(--r); border:1px solid var(--border); }
  h1 { color:var(--accent); border-bottom:2px solid var(--border); padding-bottom:10px; margin-bottom:20px; }
  h2,h3 { color:var(--accent); margin:24px 0 10px; }
  p { line-height:1.7; margin:10px 0; }
  img { max-width:100%; border-radius:var(--r); border:1px solid var(--border); margin:16px 0; display:block; }
  pre { background:#000; padding:20px; border-radius:var(--r); border:1px solid var(--border); overflow-x:auto; margin:16px 0; }
  code { color:var(--accent); font-family:monospace; }
  table { border-collapse:collapse; width:100%; margin:16px 0; }
  th,td { border:1px solid var(--border); padding:8px 12px; }
  th { background:var(--bg); color:var(--accent); }
  a { color:#5b9cf6; }
  hr { border:none; border-top:1px solid var(--border); margin:24px 0; }
</style>
</head>
<body><div class="wrap">${htmlContent}</div></body>
</html>`;
    }

    // Verknüpfen: bestehende Datei wählen (Electron Dialog)
    btnLinkHtml.onclick = async () => {
        try {
            const result = await api.openHtmlFile();
            if (!result) return;
            linkedHtmlPath = result.path;
            updateLinkBtn();
            // Sofort aktualisieren
            await writeLinkedHtml();
            scheduleSave();
            showToast(`🔗 Verknüpft mit: ${result.path.split(/[\\/]/).pop()}`);
        } catch (e) {
            showToast('❌ Verknüpfung fehlgeschlagen', 'error');
            console.error(e);
        }
    };

    // HTML exportieren / aktualisieren
    document.getElementById('btn-export-html').onclick = async () => {
        if (linkedHtmlPath) {
            // Verknüpfte Datei aktualisieren
            await writeLinkedHtml();
        } else {
            // Fallback: klassischer Download (falls kein Electron-Dialog)
            try {
                const result = await api.saveHtmlFile(buildHtmlContent());
                if (result) {
                    linkedHtmlPath = result.path;
                    updateLinkBtn();
                    scheduleSave();
                    showToast(`💾 HTML gespeichert: ${result.path.split(/[\\/]/).pop()}`);
                }
            } catch (e) {
                // Kein saveHtmlFile im API? → Blob-Download
                fallbackDownload();
            }
        }
    };

    async function writeLinkedHtml() {
        if (!linkedHtmlPath) return;
        try {
            await api.writeHtmlFile(linkedHtmlPath, buildHtmlContent());
            showToast(`✅ HTML aktualisiert: ${linkedHtmlPath.split(/[\\/]/).pop()}`);
        } catch (e) {
            showToast('❌ HTML schreiben fehlgeschlagen', 'error');
            console.error(e);
        }
    }

    function fallbackDownload() {
        const blob = new Blob([buildHtmlContent()], { type: 'text/html' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'Datenbank_Dokumentation.html';
        a.click();
        URL.revokeObjectURL(a.href);
        showToast('💾 HTML heruntergeladen');
    }

    function updateLinkBtn() {
        const btn = document.getElementById('btn-link-html');
        if (linkedHtmlPath) {
            const name = linkedHtmlPath.split(/[\\/]/).pop();
            btn.textContent = `🔗 ${name}`;
            btn.title = `Verknüpft mit: ${linkedHtmlPath}`;
            btn.classList.add('btn-linked');
        } else {
            btn.textContent = '🔗 HTML verknüpfen';
            btn.classList.remove('btn-linked');
        }
    }

    // ── MD kopieren ───────────────────────────────────────────────────────────
    document.getElementById('btn-copy-md').onclick = () => {
        navigator.clipboard.writeText(input.value)
            .then(() => showToast('📋 Markdown kopiert!'))
            .catch(() => showToast('❌ Kopieren fehlgeschlagen', 'error'));
    };

    // ── Toolbar: Formatierungsbuttons ─────────────────────────────────────────
    document.querySelectorAll('[data-fmt]').forEach(btn => {
        btn.onclick = () => applyFormat(btn.dataset.fmt);
    });

    const FMT = {
        bold:   { before: '**',            after: '**',       placeholder: 'Fetttext' },
        italic: { before: '_',             after: '_',        placeholder: 'Kursiv' },
        code:   { before: '`',             after: '`',        placeholder: 'code' },
        h2:     { before: '## ',           after: '',         placeholder: 'Überschrift' },
        h3:     { before: '### ',          after: '',         placeholder: 'Unterüberschrift' },
        link:   { before: '[',             after: '](url)',   placeholder: 'Linktext' },
        ul:     { before: '- ',            after: '',         placeholder: 'Listenpunkt' },
        ol:     { before: '1. ',           after: '',         placeholder: 'Listenpunkt' },
        hr:     { before: '\n---\n',       after: '',         placeholder: '' },
        table:  { before: '| Spalte 1 | Spalte 2 |\n|----------|----------|\n| Wert 1   | Wert 2   |', after: '', placeholder: '' },
        cb:     { before: '```\n',         after: '\n```',    placeholder: 'Code hier' },
    };

    function applyFormat(type) {
        const f = FMT[type];
        if (!f) return;
        const start = input.selectionStart;
        const end   = input.selectionEnd;
        const sel   = input.value.substring(start, end) || f.placeholder;
        input.value = input.value.substring(0, start) + f.before + sel + f.after + input.value.substring(end);
        input.focus();
        input.setSelectionRange(start + f.before.length + sel.length, start + f.before.length + sel.length);
        updateCounter();
        scheduleSave();
    }

    // ── Schließen ─────────────────────────────────────────────────────────────
    document.getElementById('close-readme').onclick = closeSidebar;
    overlay.onclick = closeSidebar;

    async function closeSidebar() {
        if (isDirty) await saveToDisk();
        sidebar.classList.remove('open');
        overlay.style.display = 'none';
    }

    // ── Keyboard Shortcuts ────────────────────────────────────────────────────
    input.addEventListener('keydown', e => {
        if (e.ctrlKey || e.metaKey) {
            if (e.key === 'b') { e.preventDefault(); applyFormat('bold'); }
            if (e.key === 'i') { e.preventDefault(); applyFormat('italic'); }
            if (e.key === 'k') { e.preventDefault(); applyFormat('link'); }
        }
        if (e.key === 'Tab') { e.preventDefault(); insertAtCursor(input, '  '); }
    });

    // ── Drag & Drop Bilder auf Textarea ───────────────────────────────────────
    // (Bereits oben im Drop-Handler integriert – Bild-Zweig)

    // ── Hilfsfunktionen ───────────────────────────────────────────────────────
    function insertAtCursor(el, text) {
        const start = el.selectionStart;
        const end   = el.selectionEnd;
        el.value = el.value.substring(0, start) + text + el.value.substring(end);
        el.focus();
        el.setSelectionRange(start + text.length, start + text.length);
        updateCounter();
    }

    function escapeHtml(str) {
        return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    function showToast(msg, type = 'success') {
        const t = document.createElement('div');
        t.className = `toast toast-${type}`;
        t.textContent = msg;
        document.body.appendChild(t);
        requestAnimationFrame(() => t.classList.add('show'));
        setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 2800);
    }

    // ── Fenster schließen: noch speichern ─────────────────────────────────────
    window.addEventListener('beforeunload', () => {
        if (isDirty) saveToDisk();
    });
});
import { state } from '../../renderer/modules/state.js';

/**
 * Magic Search — Vollständig neu
 *
 * Verbesserungen gegenüber der alten Version:
 *  1. Tabs filtern Ergebnisse nach Tabelle
 *  2. Detail-Vorschau zeigt alle Spalten des angeklickten Datensatzes
 *  3. Verbindungscard zeigt automatisch zusammengehörige Zeilen aus anderen Tabellen
 *  4. Ergebnis-Untertitel zeigt sinnvollen Kontext statt roher IDs
 *  5. Avatare mit Typ-Emoji je nach Tabellenname
 *  6. Tastaturnavigation (↑ ↓ Enter)
 */
export async function initMagicSearch(db) {

    // ─── CSS ───────────────────────────────────────────────────────────────
    const style = document.createElement('style');
    style.textContent = `
        .ms-overlay {
            position: fixed; inset: 0;
            background: rgba(0,0,0,0.45);
            display: none; justify-content: center;
            padding-top: 64px; z-index: 10000;
            font-family: sans-serif;
            backdrop-filter: blur(2px);
        }
        .ms-overlay.active { display: flex; }

        .ms-box {
            width: 580px; max-height: 80vh;
            background: #1c1c1e;
            border: 1px solid #333;
            border-radius: 14px;
            overflow: hidden;
            box-shadow: 0 32px 64px rgba(0,0,0,0.7);
            display: flex; flex-direction: column;
        }

        /* Header */
        .ms-header {
            display: flex; align-items: center; gap: 12px;
            padding: 14px 20px;
            border-bottom: 1px solid #2a2a2a;
            flex-shrink: 0;
        }
        .ms-icon { color: #ffb800; font-size: 16px; flex-shrink: 0; }
        #ms-input {
            flex: 1; background: transparent; border: none;
            color: #f0f0f0; font-size: 15px; outline: none;
        }
        #ms-input::placeholder { color: #555; }
        .ms-kbd {
            font-size: 11px; color: #555;
            border: 1px solid #333; border-radius: 5px;
            padding: 2px 6px; font-family: monospace;
        }

        /* Tabs */
        .ms-tabs {
            display: flex; gap: 2px;
            padding: 8px 16px 0;
            border-bottom: 1px solid #222;
            overflow-x: auto; flex-shrink: 0;
        }
        .ms-tab {
            padding: 5px 12px; font-size: 12px; cursor: pointer;
            border-radius: 6px 6px 0 0; color: #666;
            border-bottom: 2px solid transparent;
            white-space: nowrap; transition: color 0.15s;
        }
        .ms-tab.active { color: #f0f0f0; border-bottom-color: #ffb800; font-weight: 500; }
        .ms-tab:hover:not(.active) { background: #222; color: #aaa; }

        /* Results */
        .ms-results { flex: 1; overflow-y: auto; padding: 8px 0; }

        .ms-section-title {
            font-size: 10px; font-weight: 600; text-transform: uppercase;
            letter-spacing: 0.07em; color: #555;
            padding: 8px 20px 3px;
        }

        /* Individual result */
        .ms-item {
            display: flex; align-items: center; gap: 12px;
            padding: 9px 20px; cursor: pointer; transition: background 0.1s;
        }
        .ms-item:hover, .ms-item.selected { background: rgba(255,184,0,0.07); }
        .ms-item.selected { border-left: 2px solid #ffb800; padding-left: 18px; }

        .ms-avatar {
            width: 34px; height: 34px; border-radius: 8px;
            display: flex; align-items: center; justify-content: center;
            font-size: 15px; flex-shrink: 0; background: #252525;
        }

        .ms-item-body { flex: 1; min-width: 0; }
        .ms-item-title {
            font-size: 14px; font-weight: 500; color: #eee;
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .ms-item-title mark {
            background: rgba(255,184,0,0.25); color: #ffb800;
            border-radius: 2px; padding: 0 1px;
        }
        .ms-item-sub {
            font-size: 12px; color: #666; margin-top: 1px;
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .ms-item-sub mark { background: transparent; color: #ffb800; }

        .ms-badge {
            font-size: 9px; font-weight: 700; text-transform: uppercase;
            letter-spacing: 0.05em; padding: 3px 7px; border-radius: 5px;
            background: #2a2a2a; color: #ffb800;
            border: 1px solid #333; flex-shrink: 0;
        }

        /* Connections card */
        .ms-conn-card {
            margin: 4px 16px 8px;
            background: #222; border: 1px solid #2e2e2e;
            border-radius: 9px; padding: 10px 14px;
            display: flex; align-items: flex-start; gap: 10px;
        }
        .ms-conn-icon { color: #ffb800; font-size: 14px; margin-top: 1px; flex-shrink: 0; }
        .ms-conn-body { flex: 1; }
        .ms-conn-label { font-size: 10px; color: #555; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 6px; }
        .ms-conn-nodes { display: flex; flex-wrap: wrap; gap: 5px; }
        .ms-conn-chip {
            background: #2a2a2a; border: 1px solid #333;
            border-radius: 6px; padding: 3px 9px;
            font-size: 11px; color: #ccc; cursor: pointer;
            transition: background 0.1s;
        }
        .ms-conn-chip:hover { background: #333; color: #fff; }
        .ms-conn-chip mark { background: transparent; color: #ffb800; }

        /* Detail preview panel */
        .ms-preview {
            border-top: 1px solid #222;
            padding: 14px 20px;
            flex-shrink: 0;
            background: #181818;
        }
        .ms-preview-title {
            font-size: 10px; font-weight: 600; text-transform: uppercase;
            letter-spacing: 0.07em; color: #555; margin-bottom: 10px;
        }
        .ms-preview-grid {
            display: grid; grid-template-columns: 130px 1fr;
            gap: 5px 12px; font-size: 12px;
        }
        .ms-pk { color: #555; }
        .ms-pv { color: #ddd; font-weight: 500; word-break: break-all; }
        .ms-pv a { color: #ffb800; text-decoration: none; }
        .ms-pill {
            display: inline-block; background: rgba(34,197,94,0.15);
            color: #4ade80; border-radius: 20px;
            padding: 1px 8px; font-size: 11px;
        }

        /* Footer */
        .ms-footer {
            display: flex; align-items: center; gap: 16px;
            padding: 9px 20px;
            border-top: 1px solid #222;
            font-size: 11px; color: #555; flex-shrink: 0;
        }
        .ms-footer-hint { display: flex; align-items: center; gap: 4px; }

        /* State messages */
        .ms-empty {
            padding: 48px; text-align: center; color: #555;
            font-size: 14px;
        }
        .ms-loading { padding: 48px; text-align: center; color: #555; font-size: 14px; }

        .ms-divider { height: 1px; background: #222; margin: 6px 0; }
    `;
    document.head.appendChild(style);

    // ─── HTML ──────────────────────────────────────────────────────────────
    const overlay = document.createElement('div');
    overlay.className = 'ms-overlay';
    overlay.innerHTML = `
        <div class="ms-box" id="ms-box">
            <div class="ms-header">
                <span class="ms-icon">⚡</span>
                <input type="text" id="ms-input" placeholder="Alles durchsuchen — Namen, Domains, Inhalte..." autocomplete="off">
                <span class="ms-kbd">ESC</span>
            </div>
            <div class="ms-tabs" id="ms-tabs"></div>
            <div class="ms-results" id="ms-results">
                <div class="ms-empty">Tippe, um in allen Tabellen zu suchen</div>
            </div>
            <div class="ms-preview" id="ms-preview" style="display:none"></div>
            <div class="ms-footer" id="ms-footer" style="display:none">
                <span class="ms-footer-hint"><span class="ms-kbd">↑↓</span> navigieren</span>
                <span class="ms-footer-hint"><span class="ms-kbd">↵</span> öffnen</span>
                <span id="ms-count" style="margin-left:auto;"></span>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    const input    = overlay.querySelector('#ms-input');
    const results  = overlay.querySelector('#ms-results');
    const preview  = overlay.querySelector('#ms-preview');
    const footer   = overlay.querySelector('#ms-footer');
    const countEl  = overlay.querySelector('#ms-count');
    const tabsEl   = overlay.querySelector('#ms-tabs');
    const box      = overlay.querySelector('#ms-box');

    // ─── State ─────────────────────────────────────────────────────────────
    let cachedTables = [];
    let allMatches = [];       // [{...row, _src: tableName}, ...]
    let selectedIdx = -1;
    let activeTab = 'alle';

    // ─── Table cache ───────────────────────────────────────────────────────
    async function updateTableCache() {
        try {
            const dbType = state.dbMode === 'remote' ? 'remote' : 'local';
            const sql = "SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public'";
            const res = await db.dbQuery(sql, null, dbType);
            if (Array.isArray(res)) {
                cachedTables = res.map(r => r.tablename || r.table_name || r.name).filter(Boolean);
            }
        } catch (err) {
            console.error('[MagicSearch] Tabellen laden fehlgeschlagen:', err);
        }
    }

    // ─── Open / Close ──────────────────────────────────────────────────────
    function openSearch() {
        overlay.classList.add('active');
        updateTableCache();
        input.focus();
        input.select();
    }

    function closeSearch() {
        overlay.classList.remove('active');
        input.value = '';
        allMatches = [];
        selectedIdx = -1;
        activeTab = 'alle';
        results.innerHTML = '<div class="ms-empty">Tippe, um in allen Tabellen zu suchen</div>';
        preview.style.display = 'none';
        footer.style.display = 'none';
        tabsEl.innerHTML = '';
    }

    // ─── Keyboard ──────────────────────────────────────────────────────────
    document.addEventListener('keydown', (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
            e.preventDefault();
            openSearch();
            return;
        }
        if (e.key === 'Escape' && overlay.classList.contains('active')) {
            closeSearch();
            return;
        }
        if (overlay.classList.contains('active')) {
            if (e.key === 'ArrowDown') { e.preventDefault(); moveSelection(1); }
            if (e.key === 'ArrowUp')   { e.preventDefault(); moveSelection(-1); }
            if (e.key === 'Enter')     { e.preventDefault(); activateSelected(); }
            return;
        }
        // Global typing opens search
        const isInput = ['INPUT','TEXTAREA'].includes(document.activeElement.tagName)
            || document.activeElement.isContentEditable;
        if (!isInput && !e.ctrlKey && !e.metaKey && !e.altKey && e.key.length === 1) {
            openSearch();
        }
    });

    overlay.addEventListener('click', (e) => {
        if (!box.contains(e.target)) closeSearch();
    });

    // ─── Keyboard navigation helpers ───────────────────────────────────────
    function getVisibleItems() {
        return [...results.querySelectorAll('.ms-item')];
    }

    function moveSelection(dir) {
        const items = getVisibleItems();
        if (!items.length) return;
        selectedIdx = Math.max(0, Math.min(items.length - 1, selectedIdx + dir));
        items.forEach((el, i) => el.classList.toggle('selected', i === selectedIdx));
        items[selectedIdx].scrollIntoView({ block: 'nearest' });
        // also update preview
        const row = allMatches.find(r => r.id == items[selectedIdx]?.dataset?.id && r._src === items[selectedIdx]?.dataset?.src);
        if (row) showPreview(row);
    }

    function activateSelected() {
        const items = getVisibleItems();
        if (selectedIdx >= 0 && items[selectedIdx]) {
            const src = items[selectedIdx].dataset.src;
            if (src && typeof window.openTableInEditor === 'function') {
                closeSearch();
                window.openTableInEditor(src);
            }
        }
    }

    // ─── Debounce ──────────────────────────────────────────────────────────
    function debounce(fn, ms) {
        let t;
        return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
    }

    // ─── Search ────────────────────────────────────────────────────────────
    const handleSearch = async (e) => {
        const term = e.target.value.trim();
        if (term.length === 0) {
            results.innerHTML = '<div class="ms-empty">Tippe, um in allen Tabellen zu suchen</div>';
            preview.style.display = 'none';
            footer.style.display = 'none';
            tabsEl.innerHTML = '';
            allMatches = [];
            return;
        }

        results.innerHTML = '<div class="ms-loading">Sucht in allen Tabellen ⏳</div>';
        preview.style.display = 'none';
        tabsEl.innerHTML = '';

        try {
            const dbType = state.dbMode === 'remote' ? 'remote' : 'local';

            const searchPromises = cachedTables.map(table => {
                const safeTable = table.replace(/"/g, '""');
                const safeSrc   = table.replace(/'/g, "''");
                const query = `
                    SELECT *, '${safeSrc}' as _src
                    FROM "${safeTable}" t
                    WHERE t::text ILIKE $1
                    LIMIT 5
                `;
                return db.dbQuery(query, [`%${term}%`], dbType).catch(() => []);
            });

            const resultArrays = await Promise.all(searchPromises);
            allMatches = resultArrays.flatMap(res => Array.isArray(res) ? res : []);

            renderTabs(allMatches, term);
            renderResults(allMatches, term, 'alle');
            selectedIdx = -1;

        } catch (err) {
            const safe = String(err.message || err).replace(/[&<>"']/g,
                m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[m]));
            results.innerHTML = `<div class="ms-empty" style="color:#e74c3c;">Fehler: ${safe}</div>`;
        }
    };

    input.addEventListener('input', debounce(handleSearch, 220));

    // ─── Tabs ──────────────────────────────────────────────────────────────
    function renderTabs(matches, term) {
        const tableNames = [...new Set(matches.map(r => r._src))];
        const total = matches.length;

        const tabs = [{ id: 'alle', label: `Alle (${total})` }];
        tableNames.forEach(t => {
            const count = matches.filter(r => r._src === t).length;
            tabs.push({ id: t, label: `${t} (${count})` });
        });

        tabsEl.innerHTML = tabs.map(t =>
            `<div class="ms-tab ${t.id === 'alle' ? 'active' : ''}"
                  data-tab="${t.id}">${t.label}</div>`
        ).join('');

        tabsEl.querySelectorAll('.ms-tab').forEach(el => {
            el.addEventListener('click', () => {
                tabsEl.querySelectorAll('.ms-tab').forEach(t => t.classList.remove('active'));
                el.classList.add('active');
                activeTab = el.dataset.tab;
                renderResults(allMatches, term, activeTab);
            });
        });
    }

    // ─── Render results ────────────────────────────────────────────────────
    function renderResults(matches, term, tab) {
        const filtered = tab === 'alle' ? matches : matches.filter(r => r._src === tab);

        if (filtered.length === 0) {
            results.innerHTML = '<div class="ms-empty">Nichts gefunden.</div>';
            footer.style.display = 'none';
            preview.style.display = 'none';
            return;
        }

        // Group by table
        const groups = {};
        filtered.forEach(row => {
            if (!groups[row._src]) groups[row._src] = [];
            groups[row._src].push(row);
        });

        let html = '';

        // Find top match: first item overall
        const topMatch = filtered[0];
        const connections = getRelatedRows(topMatch, filtered);

        if (tab === 'alle') {
            html += '<div class="ms-section-title">Top-Treffer</div>';
            html += renderItem(topMatch, term);
            if (connections.length) {
                html += renderConnectionCard(topMatch, connections, term);
            }
            html += '<div class="ms-divider"></div>';
        }

        Object.entries(groups).forEach(([tableName, rows]) => {
            const rowsToShow = (tab === 'alle' && tableName === topMatch._src)
                ? rows.slice(1)   // top match already shown
                : rows;
            if (rowsToShow.length === 0) return;

            if (tab === 'alle') {
                html += `<div class="ms-section-title">${tableName}</div>`;
            }
            rowsToShow.forEach(row => { html += renderItem(row, term); });
            html += '<div class="ms-divider"></div>';
        });

        results.innerHTML = html;

        // Count
        countEl.textContent = `${filtered.length} Treffer in ${Object.keys(groups).length} Tabellen`;
        footer.style.display = 'flex';

        // Click handlers
        results.querySelectorAll('.ms-item').forEach(el => {
            el.addEventListener('click', () => {
                const id  = el.dataset.id;
                const src = el.dataset.src;
                const row = allMatches.find(r => String(r.id) === String(id) && r._src === src);
                if (!row) return;

                results.querySelectorAll('.ms-item').forEach(i => i.classList.remove('selected'));
                el.classList.add('selected');
                showPreview(row);
            });
            el.addEventListener('dblclick', () => {
                const src = el.dataset.src;
                if (src && typeof window.openTableInEditor === 'function') {
                    closeSearch();
                    window.openTableInEditor(src);
                }
            });
        });

        // Auto-select & preview first item
        const firstItem = results.querySelector('.ms-item');
        if (firstItem) {
            firstItem.classList.add('selected');
            selectedIdx = 0;
            showPreview(topMatch);
        }
    }

    // ─── Single item HTML ──────────────────────────────────────────────────
    function renderItem(row, term) {
        const title    = getDisplayTitle(row);
        const subtitle = getSubtitle(row);
        const avatar   = getAvatar(row._src);
        const safeId   = esc(String(row.id ?? ''));
        const safeSrc  = esc(row._src);

        return `
            <div class="ms-item" data-id="${safeId}" data-src="${safeSrc}">
                <div class="ms-avatar">${avatar}</div>
                <div class="ms-item-body">
                    <div class="ms-item-title">${highlight(esc(title), term)}</div>
                    <div class="ms-item-sub">${highlight(esc(subtitle), term)}</div>
                </div>
                <span class="ms-badge">${safeSrc}</span>
            </div>
        `;
    }

    // ─── Connection card HTML ──────────────────────────────────────────────
    function renderConnectionCard(topRow, related, term) {
        const chips = related.map(r => {
            const t = getDisplayTitle(r);
            return `<span class="ms-conn-chip" data-src="${esc(r._src)}">${getAvatar(r._src)} ${highlight(esc(t), term)} <small style="color:#555">${esc(r._src)}</small></span>`;
        }).join('');

        return `
            <div class="ms-conn-card">
                <span class="ms-conn-icon">🔗</span>
                <div class="ms-conn-body">
                    <div class="ms-conn-label">Zusammengehörige Datensätze</div>
                    <div class="ms-conn-nodes">${chips}</div>
                </div>
            </div>
        `;
    }

    // ─── Detail preview ────────────────────────────────────────────────────
    function showPreview(row) {
        const displayCols = Object.entries(row)
            .filter(([k]) => k !== '_src')
            .slice(0, 12);  // max 12 Felder zeigen

        const rows = displayCols.map(([k, v]) => {
            let valHtml = esc(String(v ?? '—'));

            // Detect URLs / domains
            if (typeof v === 'string' && /^https?:\/\//.test(v)) {
                valHtml = `<a href="${esc(v)}" target="_blank">${esc(v)}</a>`;
            }
            // Detect status fields
            if (k === 'vote_typ' || k === 'status' || k === 'type') {
                valHtml = `<span class="ms-pill">${esc(String(v))}</span>`;
            }
            // Detect FK columns → make clickable
            if (k.endsWith('_id') && v !== null && v !== undefined) {
                const refTable = k.replace(/_id$/, '');
                valHtml = `<a href="#" onclick="(function(){if(typeof window.openTableInEditor==='function')window.openTableInEditor('${esc(refTable)}');return false;})()">#${esc(String(v))} → ${esc(refTable)} öffnen</a>`;
            }

            return `<span class="ms-pk">${esc(k)}</span><span class="ms-pv">${valHtml}</span>`;
        }).join('');

        preview.innerHTML = `
            <div class="ms-preview-title">Vorschau · ${esc(row._src)}</div>
            <div class="ms-preview-grid">${rows}</div>
        `;
        preview.style.display = 'block';
    }

    // ─── Helpers ───────────────────────────────────────────────────────────

    /** Returns all rows that share a common FK value with topRow */
    function getRelatedRows(topRow, allRows) {
        const related = [];
        const seen = new Set();
        const topSrc = topRow._src;

        // Common FK patterns to check
        const idFields = Object.keys(topRow).filter(k => k === 'id' || k.endsWith('_id'));

        allRows.forEach(row => {
            if (row._src === topSrc) return; // same table → skip
            const key = `${row._src}::${row.id}`;
            if (seen.has(key)) return;

            const isRelated = idFields.some(field => {
                const val = topRow[field];
                if (val === null || val === undefined) return false;
                return Object.values(row).some(v => String(v) === String(val));
            });

            if (isRelated) {
                seen.add(key);
                related.push(row);
            }
        });

        return related.slice(0, 8);
    }

    /** Find a human-readable title for any row */
    function getDisplayTitle(row) {
        const titleFields = [
            'name','titel','title','email','username','user_name',
            'domain','url','bezeichnung','label','vorname','nachname',
            'full_name','firma','company','betreff','subject'
        ];
        for (const f of titleFields) {
            if (row[f] !== undefined && row[f] !== null && String(row[f]).trim() !== '') {
                return String(row[f]);
            }
        }
        if (row.id !== undefined) return `${row._src} #${row.id}`;
        return `Eintrag in ${row._src}`;
    }

    /** Build a one-line subtitle with the most useful columns */
    function getSubtitle(row) {
        const skip = new Set(['id','_src','created_at','updated_at','password','token','hash']);
        const parts = [];

        // Prefer FK columns with readable table hint
        Object.entries(row).forEach(([k, v]) => {
            if (skip.has(k) || v === null || v === undefined || String(v).trim() === '') return;
            if (parts.length >= 4) return;

            const label = k.replace(/_/g,' ');
            if (k.endsWith('_id')) {
                const refTable = k.replace(/_id$/, '');
                parts.push(`${refTable}: #${v}`);
            } else {
                parts.push(`${label}: ${String(v).substring(0, 40)}`);
            }
        });

        // Add timestamp if exists
        if (row.created_at) parts.push(formatDate(row.created_at));
        if (row.erstellt_am) parts.push(formatDate(row.erstellt_am));

        return parts.join(' · ') || row._src;
    }

    /** Simple date formatter */
    function formatDate(val) {
        try {
            return new Date(val).toLocaleDateString('de-DE', {
                day:'2-digit', month:'2-digit', year:'numeric',
                hour:'2-digit', minute:'2-digit'
            });
        } catch { return String(val); }
    }

    /** Pick an avatar emoji based on table name */
    function getAvatar(tableName) {
        const t = (tableName || '').toLowerCase();
        if (t.includes('user') || t.includes('nutzer') || t.includes('person') || t.includes('kunde')) return '👤';
        if (t.includes('domain') || t.includes('url') || t.includes('site'))  return '🌐';
        if (t.includes('order') || t.includes('bestell') || t.includes('kauf')) return '📦';
        if (t.includes('image') || t.includes('bild') || t.includes('foto') || t.includes('upload')) return '🖼️';
        if (t.includes('keyword') || t.includes('tag'))   return '🔑';
        if (t.includes('protokoll') || t.includes('log')) return '📋';
        if (t.includes('impression') || t.includes('view') || t.includes('click')) return '📊';
        if (t.includes('vote'))   return '🗳️';
        if (t.includes('email') || t.includes('mail') || t.includes('nachricht')) return '✉️';
        if (t.includes('product') || t.includes('produkt') || t.includes('artikel')) return '🛍️';
        if (t.includes('payment') || t.includes('rechnung') || t.includes('zahlun')) return '💳';
        return '📄';
    }

    /** Highlight matching text with <mark> */
    function highlight(text, term) {
        if (!term) return text;
        const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return text.replace(new RegExp(`(${escaped})`, 'gi'), '<mark>$1</mark>');
    }

    /** HTML-escape a string */
    function esc(str) {
        return String(str).replace(/[&<>"']/g, m =>
            ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[m]));
    }

    // ─── Global API ────────────────────────────────────────────────────────
    window.showMagicSearch = openSearch;
}
/**
 * Kynto Intel - Dashboard Component
 * v3 – Responsive, Dual-Storage, Bloat-Analyse, echte Quick-Actions
 */
import { escH, setStatus, esc } from './utils.js';
import { state } from './state.js';

// ── Hilfsfunktionen ────────────────────────────────────────────────────────

function formatBytes(bytes) {
    const n = Number(bytes);
    if (!n || n <= 0 || isNaN(n)) return { formatted: '0 Bytes', raw: '0 KB' };
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = n < k * k ? 1 : Math.floor(Math.log(n) / Math.log(k));
    const val = n / Math.pow(k, i);
    return {
        formatted: val.toLocaleString('de-DE', { minimumFractionDigits: i === 1 ? 0 : 2, maximumFractionDigits: 2 }) + ' ' + sizes[i],
        raw: (n / 1024).toLocaleString('de-DE', { maximumFractionDigits: 0 }) + ' KB',
    };
}

function timeSince(ms) {
    if (!ms) return '';
    const sec = Math.floor((Date.now() - ms) / 1000);
    if (sec < 60)   return `${sec}s`;
    if (sec < 3600) return `${Math.floor(sec / 60)}m`;
    return `${Math.floor(sec / 3600)}h`;
}

/**
 * Baut einen sicheren SQL-Bezeichner aus einem vollqualifizierten Namen.
 * "postgres_server.public.luma_synonyme" → "postgres_server"."public"."luma_synonyme"
 */
function qualifyTableRef(fullName) {
    return fullName.split('.').map(p => `"${p.replace(/"/g, '""')}"`).join('.');
}

let _onTableClick = () => {};
export function setDashboardTableCallback(fn) { _onTableClick = fn; }

// ── CSS ────────────────────────────────────────────────────────────────────

function _injectStyles() {
    if (document.getElementById('kd-v3-styles')) return;
    const s = document.createElement('style');
    s.id = 'kd-v3-styles';
    s.textContent = `
    /* ── Wrapper ─────────────────────────────────────────── */
    .kd {
        padding: 24px 28px;
        color: var(--text);
        font-family: system-ui, -apple-system, sans-serif;
        animation: kd-in .4s cubic-bezier(.16,1,.3,1);
        overflow-y: auto; height: 100%; box-sizing: border-box;
    }
    @keyframes kd-in { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }

    /* ── Header ──────────────────────────────────────────── */
    .kd-h1 {
        font-size: clamp(1.8rem, 4vw, 3rem); font-weight: 900;
        letter-spacing: -1.5px; margin: 0 0 12px;
        background: linear-gradient(135deg, var(--text) 40%, var(--accent) 100%);
        -webkit-background-clip: text; -webkit-text-fill-color: transparent;
        line-height: 1.1;
    }
    .kd-badge-row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-bottom: 24px; }
    .kd-badge {
        display: inline-flex; align-items: center; gap: 7px;
        background: var(--surface2); padding: 6px 14px; border-radius: 20px;
        border: 1px solid rgba(255,255,255,0.06); font-size: 12px; color: var(--muted);
    }
    .kd-badge code { color: var(--accent); font-weight: 700; font-family: monospace; }
    .kd-live {
        display: inline-flex; align-items: center; gap: 6px;
        background: rgba(34,197,94,.12); padding: 6px 12px; border-radius: 20px;
        border: 1px solid rgba(34,197,94,.3); font-size: 11px; color: #4ade80; font-weight: 700;
    }
    .kd-dot { width:7px; height:7px; border-radius:50%; background:#4ade80; box-shadow:0 0 6px #4ade80; animation:kd-pulse 1.8s ease-in-out infinite; }
    @keyframes kd-pulse { 0%,100%{opacity:1} 50%{opacity:.3} }

    /* ── Responsive Grid ─────────────────────────────────── */
    .kd-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 14px; margin-bottom: 14px;
    }
    .kd-grid-2 {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        gap: 14px; margin-bottom: 14px;
    }

    /* ── Karten ──────────────────────────────────────────── */
    .kd-card {
        background: var(--surface1);
        border: 1px solid rgba(255,255,255,0.045);
        padding: 20px 22px; border-radius: 18px;
        display: flex; flex-direction: column; align-items: flex-start;
        transition: transform .25s cubic-bezier(.16,1,.3,1), box-shadow .25s ease, border-color .25s;
        box-shadow: 0 4px 16px rgba(0,0,0,.1); position: relative; overflow: hidden;
        min-width: 0;
    }
    .kd-card::before {
        content:''; position:absolute; inset:0;
        background: radial-gradient(circle at top right, var(--accent), transparent 70%);
        opacity:0; transition:opacity .3s; pointer-events:none;
    }
    .kd-card:hover { transform:translateY(-3px); box-shadow:0 10px 28px rgba(0,0,0,.2); border-color:rgba(255,255,255,.1); }
    .kd-card:hover::before { opacity:.04; }
    .kd-card.clickable { cursor:pointer; }
    .kd-card.span2 { grid-column: span 2; }

    .kd-icon {
        width:44px; height:44px; background:var(--surface2); border-radius:13px;
        display:flex; align-items:center; justify-content:center; font-size:1.4rem;
        margin-bottom:14px; border:1px solid rgba(255,255,255,0.04); flex-shrink:0;
    }
    .kd-val { font-size:2.2rem; font-weight:800; color:var(--text); margin-bottom:4px; line-height:1; letter-spacing:-1px; }
    .kd-val.acc  { color:var(--accent); }
    .kd-val.grn  { color:#4ade80; }
    .kd-val.red  { color:#f87171; }
    .kd-val.yel  { color:#fbbf24; }
    .kd-val.sm   { font-size:1.6rem; letter-spacing:-.5px; }
    .kd-lbl { color:var(--muted); text-transform:uppercase; font-size:.7rem; font-weight:700; letter-spacing:1.5px; }
    .kd-sub { font-size:11px; color:var(--muted); margin-top:5px; opacity:.75; }

    /* ── Progress Bar ────────────────────────────────────── */
    .kd-track { width:100%; height:5px; background:var(--surface2); border-radius:3px; margin:12px 0 6px; overflow:hidden; }
    .kd-fill  { height:100%; border-radius:3px; transition:width 1.1s cubic-bezier(.16,1,.3,1); background:var(--accent); }
    .kd-fill.red { background:#f87171; }
    .kd-fill.grn { background:#4ade80; }

    /* ── Storage Panel (große Karte) ────────────────────── */
    .kd-storage-row { display:flex; gap:10px; margin-top:10px; flex-wrap:wrap; }
    .kd-storage-chip {
        flex:1; min-width:120px;
        background:var(--surface2); border-radius:12px; padding:12px 14px;
        border:1px solid rgba(255,255,255,.05); display:flex; flex-direction:column; gap:4px;
    }
    .kd-storage-chip .label { font-size:10px; color:var(--muted); text-transform:uppercase; letter-spacing:1px; font-weight:700; }
    .kd-storage-chip .value { font-size:1.3rem; font-weight:800; color:var(--text); letter-spacing:-.5px; }
    .kd-storage-chip .value.acc { color:var(--accent); }
    .kd-storage-chip .value.red { color:#f87171; }

    /* ── Bloat Tabelle ───────────────────────────────────── */
    .kd-bloat-list { display:flex; flex-direction:column; gap:5px; margin-top:10px; width:100%; }
    .kd-bloat-row {
        display:flex; align-items:center; gap:8px; padding:7px 10px;
        background:var(--surface2); border-radius:9px; font-size:11px;
    }
    .kd-bloat-name { flex:1; font-family:monospace; font-weight:600; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .kd-bloat-dead { color:#f87171; font-weight:700; flex-shrink:0; }
    .kd-bloat-pct  { font-size:10px; color:var(--muted); flex-shrink:0; }
    .kd-bloat-bar  { width:50px; height:4px; background:rgba(255,255,255,.07); border-radius:2px; overflow:hidden; flex-shrink:0; }
    .kd-bloat-bar-fill { height:100%; background:#f87171; border-radius:2px; }

    /* ── Chart Panel ─────────────────────────────────────── */
    .kd-chart-card {
        background:var(--surface1); border:1px solid rgba(255,255,255,.045);
        padding:24px 26px; border-radius:18px; box-shadow:0 4px 16px rgba(0,0,0,.1);
        margin-bottom:14px; min-width:0;
    }
    .kd-chart-head { display:flex; justify-content:space-between; align-items:center; margin-bottom:18px; flex-wrap:wrap; gap:8px; }
    .kd-chart-title { font-size:1rem; font-weight:700; margin:0; }
    .kd-chip { font-size:10px; color:var(--muted); font-weight:700; text-transform:uppercase; letter-spacing:1px; background:var(--surface2); padding:4px 9px; border-radius:8px; }
    #kd-chart-wrap { position:relative; width:100%; }

    /* ── Activity Feed ───────────────────────────────────── */
    .kd-feed { display:flex; flex-direction:column; gap:6px; margin-top:8px; width:100%; }
    .kd-feed-row {
        display:flex; align-items:center; gap:8px; padding:7px 10px;
        background:var(--surface2); border-radius:9px; font-size:11px; cursor:pointer;
        transition:background .15s; min-width:0;
    }
    .kd-feed-row:hover { background:rgba(255,255,255,.07); }
    .kd-op { font-size:9px; font-weight:700; padding:2px 5px; border-radius:5px; text-transform:uppercase; letter-spacing:.5px; flex-shrink:0; }
    .kd-op.select { background:rgba(96,165,250,.2); color:#60a5fa; }
    .kd-op.insert { background:rgba(74,222,128,.2); color:#4ade80; }
    .kd-op.update { background:rgba(251,191,36,.2); color:#fbbf24; }
    .kd-op.delete { background:rgba(248,113,113,.2); color:#f87171; }
    .kd-op.other  { background:rgba(255,255,255,.07); color:var(--muted); }
    .kd-feed-sql { flex:1; font-family:monospace; color:var(--text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; min-width:0; }
    .kd-feed-time { font-size:10px; color:var(--muted); flex-shrink:0; }

    /* ── Quick Actions ───────────────────────────────────── */
    .kd-qa { display:grid; grid-template-columns:repeat(auto-fill, minmax(130px, 1fr)); gap:8px; margin-top:10px; }
    .kd-qa-btn {
        padding:9px 11px; border-radius:11px; font-size:11px; font-weight:700;
        border:1px solid rgba(255,255,255,.07); background:var(--surface2);
        color:var(--text); cursor:pointer; transition:all .2s;
        display:flex; align-items:center; gap:6px; justify-content:flex-start;
        text-align:left;
    }
    .kd-qa-btn:hover { background:rgba(255,255,255,.09); border-color:var(--accent); color:var(--accent); }
    .kd-qa-btn:disabled { opacity:.35; cursor:not-allowed; }
    .kd-qa-btn.danger:hover { border-color:#f87171; color:#f87171; }

    /* ── Top Tables Quicklist ────────────────────────────── */
    .kd-tlist { display:flex; flex-direction:column; gap:5px; margin-top:10px; width:100%; }
    .kd-trow {
        display:flex; align-items:center; justify-content:space-between;
        padding:7px 10px; border-radius:9px; background:var(--surface2);
        font-size:11px; cursor:pointer; transition:background .15s; min-width:0;
    }
    .kd-trow:hover { background:rgba(255,255,255,.07); }
    .kd-trow-name { font-weight:700; font-family:monospace; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; min-width:0; flex:1; margin-right:8px; }
    .kd-trow-size { color:var(--muted); font-size:10px; flex-shrink:0; }

    /* ── Opt Button ──────────────────────────────────────── */
    .kd-opt {
        margin-top:12px; padding:8px 0; font-size:11px; width:100%;
        border:1px solid var(--accent); color:var(--accent); border-radius:10px;
        cursor:pointer; background:transparent; transition:all .2s; font-weight:700;
    }
    .kd-opt:hover:not(:disabled) { background:var(--accent); color:#000; }
    .kd-opt:disabled { opacity:.35; cursor:not-allowed; border-color:var(--muted); color:var(--muted); }
    .kd-opt.danger { border-color:#f87171; color:#f87171; }
    .kd-opt.danger:hover:not(:disabled) { background:#f87171; color:#000; }
    `;
    document.head.appendChild(s);
}

// ── Hauptkomponente ────────────────────────────────────────────────────────

export const KyntoDashboard = {
    render: async function(container, showAll = false) {
        if (showAll) {
            return this.renderAllDatabases(container);
        }
        // DuckDB removed - now only PGlite (local) and ProgressSQL (remote)
        const isPg     = state.dbMode === 'pglite' || !state.remoteConnectionString;
        const isRemote = state.dbMode === 'remote' && state.remoteConnectionString;

        const dbPath  = isRemote ? state.remoteConnectionString : state.pgId;
        const realPath = isPg ? state.pgId : null;

        let dbName = 'Keine Datenbank';
        if (isRemote) dbName = (state.remoteConnectionString || '').split('@')[1]?.split('/')[0] || 'Remote DB';
        else if (dbPath) dbName = String(dbPath).split(/[/\\]/).pop() || 'Unbekannt';

        // Universelle Query-Funktion - nutze neue database-engine API
        const query = async (sql) => {
            const dbType = isRemote ? 'remote' : 'local';
            return window.api.dbQuery(sql, null, dbType);
        };

        _injectStyles();

        // ── 1. Live-Ping messen ──────────────────────────────────────────
        let pingMs = '–';
        if (dbPath) {
            try {
                const t0 = performance.now();
                await query('SELECT 1');
                pingMs = (performance.now() - t0).toFixed(1);
            } catch (_) {}
        }

        // ── 2. PGlite oder ProgressSQL DB-Größe ──────────────────────────
        let dbBytes = 0;
        let dbName_res  = '';
        
        // PGlite Dateigröße (aus filesystem)
        if (isPg && state.pgId) {
            try {
                dbBytes = await window.api.getFileSize(state.pgId).catch(() => 0);
            } catch (_) {}
        }
        
        // PostgreSQL DB-Größe (lokal oder remote)
        if (isRemote || isPg) {
            try {
                const r = await query('SELECT current_database() AS name, pg_database_size(current_database()) AS size');
                const pgSize = parseInt(r?.[0]?.size || 0);
                dbBytes = Math.max(dbBytes, pgSize);
                dbName_res  = r?.[0]?.name || '';
            } catch (_) {}
        }

        // ── 3. Speicherverteilung: TOP-Tabellen ──────────────────────────
        let topTables = [];

        // Pfad A: Postgres (Remote oder PGlite) → echte Bytegrößen
        if (isPg || isRemote) {
            try {
                topTables = await query(`
                    SELECT relname AS table_name,
                           pg_total_relation_size(c.oid)   AS size_bytes,
                           pg_relation_size(c.oid)         AS data_bytes,
                           pg_indexes_size(c.oid)          AS idx_bytes
                    FROM pg_class c
                    JOIN pg_namespace n ON n.oid = c.relnamespace
                    WHERE n.nspname NOT IN ('information_schema','pg_catalog','pg_toast')
                      AND c.relkind = 'r'
                    ORDER BY size_bytes DESC LIMIT 8
                `);
            } catch (e) { console.warn('[Dashboard] PG topTables:', e.message); }
        }

        const chartIsBytes = (isPg || isRemote) && !topTables[0]?.is_rows;

        // ── 5. Bloat / Datenmüll (PostgreSQL) ───────────────────────────
        let bloatTables  = [];
        let totalDeadTup = 0;
        if (isPg || isRemote) {
            try {
                bloatTables = await query(`
                    SELECT schemaname || '.' || relname AS table_name,
                           n_dead_tup                    AS dead_rows,
                           n_live_tup                    AS live_rows,
                           CASE WHEN (n_live_tup + n_dead_tup) > 0
                                THEN ROUND(100.0 * n_dead_tup / (n_live_tup + n_dead_tup), 1)
                                ELSE 0 END                AS bloat_pct,
                           pg_size_pretty(pg_total_relation_size(relid)) AS size_pretty,
                           last_autovacuum,
                           last_vacuum
                    FROM pg_stat_user_tables
                    WHERE n_dead_tup > 0
                    ORDER BY n_dead_tup DESC LIMIT 8
                `);
                totalDeadTup = bloatTables.reduce((s, r) => s + Number(r.dead_rows || 0), 0);
            } catch (_) {}
        }

        // ── 6. PG: Aktive Verbindungen ───────────────────────────────────
        let activeConn = null, maxConn = null;
        if (isPg || isRemote) {
            try {
                const r = await query(`
                    SELECT count(*) AS active,
                           (SELECT setting::int FROM pg_settings WHERE name='max_connections') AS max
                    FROM pg_stat_activity WHERE state='active'
                `);
                activeConn = r?.[0]?.active;
                maxConn    = r?.[0]?.max;
            } catch (_) {}
        }

        // ── 7. DB-Version ────────────────────────────────────────────────
        let dbVersion = '';
        try {
            const r = await query('SELECT version() AS v');
            dbVersion = (r?.[0]?.v || '').split(' ').slice(0, 2).join(' ');
        } catch (_) {}

        // ── 8. History ───────────────────────────────────────────────────
        const recentHistory = (state.history || []).slice(-8).reverse();
        const lastDuration  = parseFloat(state.lastQueryDuration);
        const durationText  = lastDuration > 0 ? `${lastDuration.toFixed(1)}ms` : `${pingMs}ms`;

        // ── HTML rendern ──────────────────────────────────────────────────
        const dbFmt = formatBytes(dbBytes);
        const totalBytes = dbBytes;
        const totalFmt = formatBytes(totalBytes);

        container.innerHTML = `
        <div class="kd">

        <!-- ── Header ───────────────────────────────────────────── -->
        <h1 class="kd-h1">Kynto Intel</h1>
        <div class="kd-badge-row">
            <div class="kd-badge">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--accent)"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>
                Aktive DB: <code>${escH(dbName)}</code>
            </div>
            ${dbPath ? `<div class="kd-live"><div class="kd-dot"></div>Verbunden</div>` : ''}
            ${dbVersion ? `<div class="kd-badge" style="font-family:monospace;font-size:11px">${escH(dbVersion.substring(0,45))}</div>` : ''}
        </div>

        <!-- ── Reihe 1: Kern-Stats ──────────────────────────────── -->
        <div class="kd-grid">
            <div class="kd-card">
                <div class="kd-icon" id="kd-tables-icon"><img src="../image/Vorlage.png?t=${Date.now()}" style="width:26px;height:26px;object-fit:contain"></div>
                <div class="kd-val">${state.knownTables?.filter(t=>t&&t!=='undefined').length || 0}</div>
                <div class="kd-lbl">Tabellen</div>
            </div>
            <div class="kd-card">
                <div class="kd-icon">⚡</div>
                <div class="kd-val acc">${durationText}</div>
                <div class="kd-lbl">Ping / Latenz</div>
                <div class="kd-sub">${isRemote?'Remote PG':isPg?'PGlite':'DuckDB'} · live</div>
            </div>
            <div class="kd-card">
                <div class="kd-icon">📜</div>
                <div class="kd-val">${state.history?.length || 0}</div>
                <div class="kd-lbl">SQL-Verlauf</div>
            </div>
            <div class="kd-card">
                <div class="kd-icon">⭐</div>
                <div class="kd-val">${state.favorites?.length || 0}</div>
                <div class="kd-lbl">Favoriten</div>
            </div>
            ${activeConn !== null ? `
            <div class="kd-card">
                <div class="kd-icon">🔌</div>
                <div class="kd-val ${Number(activeConn) / Number(maxConn) > 0.8 ? 'red' : 'grn'}">${activeConn}</div>
                <div class="kd-lbl">Verbindungen</div>
                ${maxConn ? `
                <div class="kd-track"><div class="kd-fill ${Number(activeConn)/Number(maxConn)>.8?'red':'grn'}" style="width:${Math.min(100,(Number(activeConn)/Number(maxConn)*100)).toFixed(1)}%"></div></div>
                <div class="kd-sub">Max: ${maxConn}</div>` : ''}
            </div>` : ''}
        </div>

        <!-- ── Dateigröße Dual-Panel ──────────────────────────── -->
        <div class="kd-chart-card">
            <div class="kd-chart-head">
                <h4 class="kd-chart-title">💾 Dateigröße & Speicher</h4>
                <span class="kd-chip">Gesamt: ${totalFmt.formatted}</span>
            </div>
            <div class="kd-storage-row">
                ${dbBytes > 0 ? `
                <div class="kd-storage-chip">
                    <div class="label">📊 Datenbankgröße</div>
                    <div class="value">${dbFmt.formatted}</div>
                    <div style="font-size:10px;color:var(--muted);margin-top:4px">${dbFmt.raw}</div>
                </div>` : ''}
                ${totalDeadTup > 0 ? `
                <div class="kd-storage-chip">
                    <div class="label">☠️ Tote Tupel</div>
                    <div class="value red">${totalDeadTup.toLocaleString('de-DE')}</div>
                    <div style="font-size:10px;color:var(--muted);margin-top:4px">${bloatTables.length} Tabellen betroffen</div>
                </div>` : ''}
            </div> <!-- .kd-storage-row -->
            ${(isPg || isRemote) ? `
            <button class="kd-opt" id="kd-vacuum-pg" style="margin-top:8px">🧹 PostgreSQL VACUUM ANALYZE</button>` : ''}
        </div>

        <!-- ── Bloat-Tabellen (nur PG) ────────────────────────── -->
        ${bloatTables.length > 0 ? `
        <div class="kd-chart-card">
            <div class="kd-chart-head">
                <h4 class="kd-chart-title">☠️ Datenmüll-Analyse (PostgreSQL)</h4>
                <span class="kd-chip">${totalDeadTup.toLocaleString('de-DE')} tote Tupel</span>
            </div>
            <div class="kd-bloat-list">
                ${bloatTables.map(r => {
                    const pct = Number(r.bloat_pct);
                    return `
                    <div class="kd-bloat-row" title="Letztes VACUUM: ${r.last_vacuum||r.last_autovacuum||'nie'}">
                        <div class="kd-bloat-name">${escH(r.table_name)}</div>
                        <div class="kd-bloat-bar"><div class="kd-bloat-bar-fill" style="width:${Math.min(100,pct)}%"></div></div>
                        <div class="kd-bloat-dead">${Number(r.dead_rows).toLocaleString('de-DE')}</div>
                        <div class="kd-bloat-pct">${pct.toFixed(1)}% Müll</div>
                        <div class="kd-bloat-pct">${r.size_pretty}</div>
                    </div>`;
                }).join('')}
            </div>
            <button class="kd-opt danger" id="kd-vacuum-bloat" style="margin-top:12px">🗑️ Alle bereinigen (VACUUM ANALYZE)</button>
        </div>` : ''}

        <!-- ── Speicherverteilung Chart ───────────────────────── -->
        <div class="kd-chart-card">
            <div class="kd-chart-head">
                <h4 class="kd-chart-title">📊 Speicherverteilung</h4>
                <span class="kd-chip">${chartIsBytes ? 'Bytegröße' : 'Zeilenanzahl'}</span>
            </div>
            <div id="kd-chart-wrap" style="height:${Math.max(180, topTables.length * 36 + 40)}px">
                ${topTables.length > 0
                    ? '<canvas id="kd-chart"></canvas>'
                    : `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:var(--muted);opacity:.5;gap:8px;font-size:13px">
                           <div style="font-size:1.8rem">📊</div>
                           <div>Keine Tabellen-Daten</div>
                       </div>`}
            </div>
        </div>

        <!-- ── Bottom Row: History + Actions ─────────────────── -->
        <div class="kd-grid-2">

            <!-- Letzte Abfragen -->
            <div class="kd-chart-card" style="margin-bottom:0">
                <div class="kd-chart-head">
                    <h4 class="kd-chart-title">🕐 Letzte Abfragen</h4>
                    <span class="kd-chip">${recentHistory.length}</span>
                </div>
                ${recentHistory.length > 0 ? `
                <div class="kd-feed">
                    ${recentHistory.map(h => {
                        const sql    = (h.sql||h||'').trim();
                        const opRaw  = sql.split(/\s+/)[0].toUpperCase();
                        const cls    = ['SELECT','INSERT','UPDATE','DELETE'].includes(opRaw) ? opRaw.toLowerCase() : 'other';
                        const ago    = timeSince(h.timestamp||h.ts);
                        return `
                        <div class="kd-feed-row" data-sql="${escH(sql)}" title="${escH(sql)}">
                            <span class="kd-op ${cls}">${opRaw}</span>
                            <span class="kd-feed-sql">${escH(sql.substring(0,90))}</span>
                            ${ago ? `<span class="kd-feed-time">${ago}</span>` : ''}
                        </div>`;
                    }).join('')}
                </div>` : `<div style="color:var(--muted);font-size:12px;opacity:.5;padding:12px 0">Noch keine Abfragen ausgeführt.</div>`}
            </div>

            <!-- Quick Actions -->
            <div class="kd-chart-card" style="margin-bottom:0">
                <div class="kd-chart-head">
                    <h4 class="kd-chart-title">⚡ Aktionen</h4>
                </div>
                <div class="kd-qa">
                    <button class="kd-qa-btn" id="kd-a-sql">✍️ SQL Editor</button>
                    <button class="kd-qa-btn" id="kd-a-schema">🔧 Schema</button>
                    <button class="kd-qa-btn" id="kd-a-refresh">🔄 Neu laden</button>
                    ${!isRemote ? `<button class="kd-qa-btn" id="kd-a-vacuum2">🧹 VACUUM</button>` : ''}
                    ${(isPg||isRemote) ? `<button class="kd-qa-btn" id="kd-a-analyze">📐 ANALYZE</button>` : ''}
                    <button class="kd-qa-btn" id="kd-a-export-sql">📥 SQL exportieren</button>
                    <button class="kd-qa-btn danger" id="kd-a-clear-hist">🗑️ Verlauf leeren</button>
                    ${state.knownTables?.filter(t=>t&&t!=='undefined').length > 0 ? `<button class="kd-qa-btn" id="kd-a-first">📋 Erste Tabelle</button>` : ''}
                </div>

                <!-- Top Tabellen Schnellzugriff -->
                ${topTables.length > 0 ? `
                <div style="margin-top:16px;font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:1.2px;font-weight:700;margin-bottom:8px">Top Tabellen</div>
                <div class="kd-tlist">
                    ${topTables.slice(0,5).map(t => `
                    <div class="kd-trow" data-table="${escH(t.display_name||t.table_name)}" data-short="${escH(t.table_name)}">
                        <div class="kd-trow-name" title="${escH(t.display_name||t.table_name)}">${escH(t.table_name)}</div>
                        <div class="kd-trow-size">${
                            chartIsBytes
                                ? formatBytes(Number(t.size_bytes)).formatted
                                : Number(t.size_bytes).toLocaleString('de-DE') + ' Zeilen'
                        }</div>
                    </div>`).join('')}
                </div>` : ''}
            </div>
        </div>

        </div><!-- .kd -->
        `;

        // ── Event-Listener ─────────────────────────────────────────────────

        // VACUUM PG (nur für PGlite/ProgressSQL, kein DuckDB mehr)
        const vacPg = container.querySelector('#kd-vacuum-pg');
        if (vacPg) vacPg.addEventListener('click', async () => {
            vacPg.disabled = true; vacPg.textContent = '⏳ PG VACUUM…';
            setStatus('PostgreSQL VACUUM ANALYZE…', 'info');
            try {
                await query('VACUUM ANALYZE');
                setStatus('PostgreSQL optimiert!', 'success');
            } catch (e) { setStatus('VACUUM fehlgeschlagen: ' + e.message, 'error'); }
            KyntoDashboard.render(container);
        });

        // VACUUM Bloat
        const vacBloat = container.querySelector('#kd-vacuum-bloat');
        if (vacBloat) vacBloat.addEventListener('click', async () => {
            vacBloat.disabled = true; vacBloat.textContent = '⏳ Bereinige…';
            setStatus('VACUUM FULL ANALYZE für alle Tabellen (kann dauern)…', 'info');
            try {
                for (const t of bloatTables) {
                    // VACUUM FULL entfernt tote Tupel wirklich und gibt Speicher frei (nicht nur markiert)
                    await query(`VACUUM FULL ANALYZE ${qualifyTableRef(t.table_name)}`).catch(()=>{});
                }
                // Global ANALYZE für pg_stat_user_tables aktualisieren
                await query('ANALYZE').catch(()=>{});
                setStatus(`${bloatTables.length} Tabellen vollständig bereinigt!`, 'success');
                // WICHTIG: Längere Verzögerung damit PostgreSQL Statistiken vollständig aktualisiert
                setTimeout(() => {
                    KyntoDashboard.render(container);
                }, 3000);
            } catch (e) { setStatus('Fehler: ' + e.message, 'error'); }
        });

        // Quick Actions
        container.querySelector('#kd-a-sql')?.addEventListener('click', () => {
            const area = document.querySelector('.editor-area');
            if (area) area.classList.add('sql-visible');
            if (state.editor) setTimeout(() => state.editor.layout(), 50);
        });
        container.querySelector('#kd-a-schema')?.addEventListener('click', () => {
            if (typeof window.showView === 'function') window.showView('schema');
        });
        container.querySelector('#kd-a-refresh')?.addEventListener('click', () => {
            KyntoDashboard.render(container);
        });
        container.querySelector('#kd-a-vacuum2')?.addEventListener('click', () => vacPg?.click());
        container.querySelector('#kd-a-analyze')?.addEventListener('click', async () => {
            setStatus('ANALYZE läuft…', 'info');
            try { await query('ANALYZE'); setStatus('ANALYZE abgeschlossen.', 'success'); } catch (e) { setStatus('Fehler: ' + e.message, 'error'); }
        });
        container.querySelector('#kd-a-export-sql')?.addEventListener('click', () => {
            const hist = (state.history || []).map(h => (h.sql||h||'').trim()).filter(Boolean).join(';\n\n');
            if (!hist) { setStatus('Kein Verlauf zum Exportieren.', 'error'); return; }
            const url = URL.createObjectURL(new Blob([hist], { type: 'text/sql' }));
            Object.assign(document.createElement('a'), { href: url, download: 'kynto-history.sql' }).click();
            URL.revokeObjectURL(url);
            setStatus('SQL-Verlauf exportiert.', 'success');
        });
        container.querySelector('#kd-a-clear-hist')?.addEventListener('click', () => {
            if (!confirm('SQL-Verlauf wirklich leeren?')) return;
            state.history = [];
            setStatus('Verlauf geleert.', 'info');
            KyntoDashboard.render(container);
        });
        container.querySelector('#kd-a-first')?.addEventListener('click', () => {
            const first = state.knownTables?.find(t => t && t !== 'undefined');
            if (first && typeof window.openTableInEditor === 'function') {
                const parts = first.split('.');
                const tbl   = parts.pop();
                const sch   = parts.pop() || 'public';
                window.openTableInEditor(tbl, sch);
            }
        });

        // History → SQL-Editor (Event-Delegation, kein forEach)
        const handleFeedRowClick = (e) => {
            const row = e.target.closest('.kd-feed-row');
            if (!row) return;
            
            const sql = row.dataset.sql;
            if (!sql) return;
            if (state.editor) state.editor.setValue(sql);
            const area = document.querySelector('.editor-area');
            if (area) area.classList.add('sql-visible');
            if (state.editor) setTimeout(() => state.editor.layout(), 50);
            setStatus('SQL in Editor geladen.', 'info');
        };

        container.removeEventListener('click', container.__feedRowClickHandler);
        container.__feedRowClickHandler = handleFeedRowClick;
        container.addEventListener('click', handleFeedRowClick);

        // Top-Tabellen klicken (Event-Delegation, kein forEach)
        const handleTopTableRowClick = (e) => {
            const row = e.target.closest('.kd-trow');
            if (!row) return;
            
            const full  = row.dataset.table;
            const short = row.dataset.short;
            if (typeof window.openTableInEditor === 'function') {
                const parts = (full||short).split('.');
                const tbl   = parts.pop();
                const sch   = parts.pop() || 'public';
                window.openTableInEditor(tbl, sch);
            } else {
                _onTableClick(short || full);
            }
        };

        container.removeEventListener('click', container.__topTableRowClickHandler);
        container.__topTableRowClickHandler = handleTopTableRowClick;
        container.addEventListener('click', handleTopTableRowClick);

        // ── Chart ─────────────────────────────────────────────────────────
        if (topTables.length > 0 && typeof Chart !== 'undefined') {
            const canvas = container.querySelector('#kd-chart');
            if (canvas) {
                const accent  = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#c29a40';
                const labels  = topTables.map(t => t.table_name);
                const data    = topTables.map(t => Number(t.size_bytes || 0));
                const colors  = data.map((_, i) => accent + Math.round((0.9 - i * 0.08) * 255).toString(16).padStart(2,'0'));

                new Chart(canvas.getContext('2d'), {
                    type: 'bar',
                    data: {
                        labels,
                        datasets: [{ label: chartIsBytes ? 'Speicher' : 'Zeilen', data, backgroundColor: colors, borderColor: accent, borderWidth: 1.5, borderRadius: 6, borderSkipped: false, hoverBackgroundColor: accent }]
                    },
                    options: {
                        indexAxis: 'y', responsive: true, maintainAspectRatio: false,
                        scales: {
                            x: {
                                grid: { color: 'rgba(255,255,255,0.03)' },
                                ticks: {
                                    color: '#777', font: { size: 11 },
                                    callback: v => chartIsBytes ? formatBytes(v).formatted : v.toLocaleString('de-DE')
                                }
                            },
                            y: { grid: { display: false }, ticks: { color: '#ddd', font: { weight: '600', size: 11 } } }
                        },
                        plugins: {
                            legend: { display: false },
                            tooltip: {
                                backgroundColor: 'rgba(0,0,0,.88)', padding: 12, cornerRadius: 10, displayColors: false,
                                titleFont: { size: 12, weight: '700' }, bodyFont: { size: 11 },
                                callbacks: { label: c => chartIsBytes ? ' ' + formatBytes(c.parsed.x).formatted : ' ' + c.parsed.x.toLocaleString('de-DE') + ' Zeilen' }
                            }
                        },
                        animation: { duration: 800, easing: 'easeOutQuart' }
                    }
                });
            }
        }
    },

    /**
     * Master-Dashboard: Zeigt Statistiken über ALLE verfügbaren Datenbanken
     */
    renderAllDatabases: async function(container) {
        _injectStyles();
        
        // Sammle alle Datenbanken (PGlite + Remote)
        const pgliteDbs = await window.api?.pgListDBs?.().catch(() => []) || [];
        const remoteDb = state.remoteConnectionString ? [{ id: state.remoteConnectionString, type: 'remote' }] : [];
        const allDbs = [...pgliteDbs.map(db => ({ ...db, type: 'pglite' })), ...remoteDb];

        let totalSize = 0;
        let totalTables = 0;
        let totalRows = 0;
        const dbStats = [];

        // Sammel Statistiken für jede Datenbank
        for (const db of allDbs) {
            try {
                const dbType = db.type === 'remote' ? 'remote' : 'local';
                const dbName = db.type === 'remote' 
                    ? (db.id.split('@')[1]?.split('/')[0] || 'Remote DB')
                    : (String(db.id || db.path).split(/[/\\]/).pop() || 'Unknown');

                // Größe (für PGlite Datei + für alle DBs SQL-Size abfragen)
                let dbSize = 0;
                
                // 1. Für PGlite: Dateigrößen
                if (db.type === 'pglite') {
                    try {
                        const fileSize = await window.api.getFileSize(db.id || db.path).catch(() => 0);
                        if (fileSize && fileSize > 0) dbSize = fileSize;
                    } catch (_) {}
                }

                // 2. Für alle DBs: pg_database_size abfragen (wichtig für Remote!)
                try {
                    const sizeRes = await window.api.dbQuery(
                        `SELECT pg_database_size(current_database()) AS dbsize`,
                        null, dbType
                    ).catch(() => []);
                    
                    if (sizeRes && sizeRes[0] && sizeRes[0].dbsize) {
                        const pgSize = parseInt(sizeRes[0].dbsize);
                        if (pgSize > 0) dbSize = Math.max(dbSize, pgSize);
                    }
                } catch (_) {}

                // Tabelleninfo und Zeilenanzahl
                let tableCount = 0;
                let rowCount = 0;
                try {
                    const tableRes = await window.api.dbQuery(
                        `SELECT (SELECT count(*) FROM information_schema.tables WHERE table_schema='public') AS tcount,
                                (SELECT sum(n_live_tup) FROM pg_stat_user_tables) AS rcount`,
                        null, dbType
                    ).catch(() => []);
                    
                    if (tableRes && tableRes[0]) {
                        tableCount = parseInt(tableRes[0].tcount || 0);
                        rowCount = parseInt(tableRes[0].rcount || 0);
                    }
                } catch (_) {}

                // Ping
                let ping = '–';
                try {
                    const t0 = performance.now();
                    await window.api.dbQuery('SELECT 1', null, dbType).catch(() => {});
                    ping = (performance.now() - t0).toFixed(1) + 'ms';
                } catch (_) {}

                dbStats.push({ dbName, dbSize, tableCount, rowCount, ping, db, dbType });
                totalSize += dbSize;
                totalTables += tableCount;
                totalRows += rowCount;
                
                console.log(`[Dashboard] DB: ${dbName}, Size: ${dbSize} bytes, Tables: ${tableCount}, Rows: ${rowCount}`);
            } catch (e) {
                console.error('[renderAllDatabases] Error for DB:', db, e);
            }
        }

        const { formatted: sizeFmt } = formatBytes(totalSize);

        // HTML generieren
        const html = `
        <div class="kd">
            <h1 class="kd-h1">🏠 Kynto Intel</h1>
            <div class="kd-badge-row">
                <div class="kd-badge"><strong>${allDbs.length}</strong> Datenbank${allDbs.length !== 1 ? 'en' : ''}</div>
                <div class="kd-badge">💾 <code>${sizeFmt}</code></div>
                <div class="kd-badge">📊 <code>${totalTables}</code> Tabellen</div>
                <div class="kd-badge">📋 <code>${totalRows.toLocaleString('de-DE')}</code> Zeilen</div>
                <div class="kd-live">
                    <div class="kd-dot"></div>
                    <span>Live</span>
                </div>
            </div>

            <h2 style="font-size:16px; font-weight:700; color:var(--text); margin:28px 0 14px; text-transform:uppercase; letter-spacing:0.8px; color:var(--muted);">
                Datenbanken
            </h2>

            <div style="
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
                gap: 14px;
            ">
                ${dbStats.map((s, i) => `
                <div style="
                    background: var(--surface1);
                    border: 1px solid rgba(255,255,255,0.045);
                    border-radius: 12px;
                    padding: 16px;
                    transition: transform .2s, border-color .2s;
                    cursor: pointer;
                " data-db-index="${i}" class="db-stat-card">
                    <div style="font-weight:700; color:var(--accent); margin-bottom:12px; font-size:14px;">
                        ${escH(s.dbName)}
                    </div>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; font-size:12px; color:var(--muted);">
                        <div><span style="color:var(--text); font-weight:600;">${s.tableCount}</span> Tabellen</div>
                        <div><span style="color:var(--text); font-weight:600;">${s.rowCount.toLocaleString('de-DE')}</span> Zeilen</div>
                        <div style="grid-column:1/-1;"><span style="color:var(--text); font-weight:600;">${formatBytes(s.dbSize).formatted}</span> Größe • ${s.ping} Ping</div>
                    </div>
                </div>
                `).join('')}
            </div>

            <div style="margin-top:28px; padding:14px 16px; background:var(--surface2); border-radius:12px; border:1px solid var(--border); color:var(--muted); font-size:12px; line-height:1.6;">
                <strong style="color:var(--accent);">Tipp:</strong> Klicke auf eine Datenbank um die komplette Übersicht zu sehen.
            </div>
        </div>
        `;

        container.innerHTML = html;

        // Event-Delegation für DB-Karten
        const handleDbCardClick = (e) => {
            const card = e.target.closest('.db-stat-card');
            if (!card) return;
            
            const dbIdx = parseInt(card.dataset.dbIndex);
            const stat = dbStats[dbIdx];
            if (!stat) return;

            // Setze aktive DB und zeige einzelnes Dashboard
            if (stat.db.type === 'remote') {
                state.dbMode = 'remote';
            } else {
                state.dbMode = 'pglite';
                state.pgId = stat.db.id || stat.db.path;
            }
            
            // Zeige einzelnes Dashboard für diese DB
            this.render(container, false);
        };

        container.removeEventListener('click', container.__dbStatsClickHandler);
        container.__dbStatsClickHandler = handleDbCardClick.bind(this);
        container.addEventListener('click', container.__dbStatsClickHandler);
    }
};
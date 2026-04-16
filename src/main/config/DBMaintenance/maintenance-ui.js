/**
 * ═══════════════════════════════════════════════════════════════
 *  DBMaintenance/maintenance-ui.js  (Renderer-Modul)
 *
 *  Einbinden in settings.js (Renderer):
 *    import { initMaintenanceTab } from
 *      '../../src/main/config/DBMaintenance/maintenance-ui.js';
 *    // in initSettings() aufrufen:
 *    initMaintenanceTab();
 * ═══════════════════════════════════════════════════════════════
 */

// ── Presets (gespiegelt vom Engine, kein IPC nötig für die Liste) ─
const PRESETS = [
    { key: 'last_hour',  label: '⏱ Letzte Stunde',         unit: 'hours', value: 1   },
    { key: 'last_2h',    label: '⏱ Letzte 2 Stunden',       unit: 'hours', value: 2   },
    { key: 'last_6h',    label: '⏱ Letzte 6 Stunden',       unit: 'hours', value: 6   },
    { key: 'last_12h',   label: '⏱ Letzte 12 Stunden',      unit: 'hours', value: 12  },
    { key: 'last_24h',   label: '⏱ Letzte 24 Stunden',      unit: 'hours', value: 24  },
    { key: 'older_7d',   label: '📅 Älter als 7 Tage',       unit: 'days',  value: 7,  mode: 'older' },
    { key: 'older_14d',  label: '📅 Älter als 14 Tage',      unit: 'days',  value: 14, mode: 'older' },
    { key: 'older_30d',  label: '📅 Älter als 30 Tage',      unit: 'days',  value: 30, mode: 'older' },
    { key: 'older_90d',  label: '📅 Älter als 90 Tage',      unit: 'days',  value: 90, mode: 'older' },
    { key: 'wipe_all',   label: '💥 Alles löschen',           unit: null,    value: 0   },
    { key: 'custom',     label: '✏️ Benutzerdefiniert…',      unit: null,    value: null },
];

// ── IPC ───────────────────────────────────────────────────────────
const ipc = (ch, ...a) => window.api[ch.replace(':', '_')]?.(...a)
    ?? window.electron?.ipcRenderer?.invoke(ch, ...a);

// ── Styles ────────────────────────────────────────────────────────
function injectStyles() {
    if (document.getElementById('kynto-maint-styles')) return;
    const s = document.createElement('style');
    s.id = 'kynto-maint-styles';
    s.textContent = `
/* ── Root ── */
.maint-root { display:flex; flex-direction:column; gap:14px; font-size:13px; color:var(--text,#e2e2e2); }

/* ── Stats Bar ── */
.maint-stats { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; }
.maint-stat  { background:var(--bg2,#27272a); border-radius:8px; padding:10px 14px; display:flex; flex-direction:column; gap:3px; }
.maint-stat-val  { font-size:20px; font-weight:700; }
.maint-stat-lbl  { font-size:10px; color:var(--muted,#71717a); text-transform:uppercase; letter-spacing:.5px; }
.maint-stat.warn .maint-stat-val { color:#f59e0b; }
.maint-stat.ok   .maint-stat-val { color:#22c55e; }

/* ── Sections ── */
.maint-section { background:var(--bg2,#27272a); border-radius:8px; padding:14px 16px; }
.maint-section-title { font-size:11px; color:var(--muted,#71717a); text-transform:uppercase; letter-spacing:.6px; margin-bottom:10px; }

/* ── Table checkboxes ── */
.maint-table-grid { display:grid; grid-template-columns:1fr 1fr; gap:6px; }
.maint-table-item { display:flex; align-items:center; gap:8px; padding:7px 10px; border-radius:6px; background:var(--bg,#18181b); cursor:pointer; }
.maint-table-item input { cursor:pointer; accent-color:var(--accent,#3b82f6); }
.maint-table-item-info { display:flex; flex-direction:column; gap:1px; }
.maint-table-name  { font-size:12px; font-weight:500; }
.maint-table-desc  { font-size:10px; color:var(--muted,#71717a); }
.maint-table-count { font-size:10px; color:var(--accent,#3b82f6); margin-left:auto; font-weight:600; }

/* ── Preset & Custom ── */
.maint-preset-row { display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
.maint-preset-btn { padding:5px 12px; border-radius:6px; font-size:12px; cursor:pointer;
    background:var(--bg,#18181b); border:1px solid var(--border,#3f3f46);
    color:var(--text,#e2e2e2); transition:all .15s; }
.maint-preset-btn:hover  { border-color:var(--accent,#3b82f6); color:var(--accent,#3b82f6); }
.maint-preset-btn.active { background:var(--accent,#3b82f6)22; border-color:var(--accent,#3b82f6); color:var(--accent,#3b82f6); }
.maint-preset-btn.danger { border-color:#dc2626; color:#f87171; }
.maint-preset-btn.danger.active { background:#dc262622; }

.maint-custom-row { display:flex; gap:8px; align-items:center; margin-top:8px; }
.maint-custom-row input[type=number] {
    width:72px; padding:6px 8px; background:var(--bg,#18181b);
    border:1px solid var(--border,#3f3f46); border-radius:6px;
    color:var(--text,#e2e2e2); font-size:12px; outline:none; text-align:center;
}
.maint-custom-row select {
    padding:6px 10px; background:var(--bg,#18181b);
    border:1px solid var(--border,#3f3f46); border-radius:6px;
    color:var(--text,#e2e2e2); font-size:12px; outline:none;
}
.maint-unit { font-size:12px; color:var(--muted,#71717a); }

/* ── Preview Box ── */
.maint-preview { padding:10px 12px; background:var(--bg,#18181b); border-radius:6px; font-size:12px; }
.maint-preview-row { display:flex; justify-content:space-between; padding:2px 0; }
.maint-preview-del  { color:#f87171; font-weight:600; }
.maint-preview-zero { color:var(--muted,#71717a); }
.maint-preview-total { border-top:1px solid var(--border,#3f3f46); margin-top:6px; padding-top:6px; font-weight:700; }

/* ── Action Buttons ── */
.maint-action-row { display:flex; gap:8px; align-items:center; margin-top:6px; }
.maint-btn-preview { padding:7px 16px; background:transparent; border:1px solid var(--border,#3f3f46); border-radius:6px; color:var(--muted,#71717a); font-size:12px; cursor:pointer; }
.maint-btn-preview:hover { border-color:var(--text,#e2e2e2); color:var(--text,#e2e2e2); }
.maint-btn-run    { padding:7px 20px; background:#dc262622; color:#f87171; border:1px solid #dc262633; border-radius:6px; font-size:12px; cursor:pointer; font-weight:600; }
.maint-btn-run:hover:not(:disabled) { background:#dc262633; }
.maint-btn-run:disabled { opacity:.4; cursor:not-allowed; }
.maint-result { padding:8px 12px; border-radius:6px; font-size:12px; display:none; }
.maint-result.success { background:#16a34a22; color:#22c55e; display:block; }
.maint-result.error   { background:#dc262622; color:#f87171; display:block; }

/* ── Scheduler ── */
.maint-sched-row { display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
.maint-sched-toggle { display:flex; align-items:center; gap:8px; cursor:pointer; font-size:12px; }
.maint-sched-toggle input { cursor:pointer; accent-color:var(--accent,#3b82f6); }
.maint-sched-interval { display:flex; align-items:center; gap:6px; }
.maint-sched-interval input {
    width:60px; padding:5px 8px; background:var(--bg,#18181b);
    border:1px solid var(--border,#3f3f46); border-radius:6px;
    color:var(--text,#e2e2e2); font-size:12px; text-align:center; outline:none;
}
.maint-sched-status { font-size:11px; color:var(--muted,#71717a); padding:4px 8px; background:var(--bg,#18181b); border-radius:4px; }
.maint-sched-status.active { color:#22c55e; }
.maint-btn-save { padding:6px 14px; background:var(--accent,#3b82f6); color:#fff; border:none; border-radius:6px; font-size:12px; cursor:pointer; }
.maint-btn-save:hover { opacity:.85; }
`;
    document.head.appendChild(s);
}

// ── HTML ──────────────────────────────────────────────────────────
function buildHTML() {
    return `
<div class="maint-root">

  <!-- Statistiken -->
  <div class="maint-stats" id="maintStats">
    <div class="maint-stat"><span class="maint-stat-val" id="maintStatCache">–</span><span class="maint-stat-lbl">Cache-Einträge</span></div>
    <div class="maint-stat"><span class="maint-stat-val" id="maintStatLogs">–</span><span class="maint-stat-lbl">Log-Einträge</span></div>
    <div class="maint-stat"><span class="maint-stat-val" id="maintStatArchive">–</span><span class="maint-stat-lbl">Archiv-Einträge</span></div>
    <div class="maint-stat"><span class="maint-stat-val" id="maintStatSize">–</span><span class="maint-stat-lbl">DB-Größe</span></div>
  </div>

  <!-- Tabellen auswählen -->
  <div class="maint-section">
    <div class="maint-section-title">Tabellen</div>
    <div class="maint-table-grid" id="maintTableGrid">
      <label class="maint-table-item">
        <input type="checkbox" value="api_cache" checked />
        <div class="maint-table-item-info">
          <span class="maint-table-name">API Cache</span>
          <span class="maint-table-desc">Gecachte API-Antworten</span>
        </div>
        <span class="maint-table-count" id="maintCnt_api_cache">–</span>
      </label>
      <label class="maint-table-item">
        <input type="checkbox" value="request_logs" checked />
        <div class="maint-table-item-info">
          <span class="maint-table-name">Request-Logs</span>
          <span class="maint-table-desc">API-Anfrage-Protokoll</span>
        </div>
        <span class="maint-table-count" id="maintCnt_request_logs">–</span>
      </label>
      <label class="maint-table-item">
        <input type="checkbox" value="data_archive" />
        <div class="maint-table-item-info">
          <span class="maint-table-name">Daten-Archiv</span>
          <span class="maint-table-desc">Historische Zeitreihen</span>
        </div>
        <span class="maint-table-count" id="maintCnt_data_archive">–</span>
      </label>
    </div>
  </div>

  <!-- Zeitraum / Preset -->
  <div class="maint-section">
    <div class="maint-section-title">Zeitraum</div>
    <div class="maint-preset-row" id="maintPresetRow">
      ${PRESETS.map(p => `
        <button class="maint-preset-btn ${p.key === 'wipe_all' ? 'danger' : ''} ${p.key === 'older_30d' ? 'active' : ''}"
          data-preset="${p.key}">${p.label}</button>
      `).join('')}
    </div>

    <!-- Benutzerdefinierter Zeitraum -->
    <div class="maint-custom-row" id="maintCustomRow" style="display:none">
      <select id="maintCustomMode">
        <option value="older">Älter als</option>
        <option value="last">Letzte</option>
      </select>
      <input type="number" id="maintCustomVal" value="7" min="1" max="9999" />
      <select id="maintCustomUnit">
        <option value="hours">Stunden</option>
        <option value="days" selected>Tage</option>
      </select>
      <span class="maint-unit">löschen</span>
    </div>
  </div>

  <!-- Vorschau -->
  <div class="maint-section">
    <div class="maint-section-title">Vorschau</div>
    <div class="maint-preview" id="maintPreview">
      <div style="color:var(--muted,#71717a);font-size:12px">
        Klicke "Vorschau" um zu sehen wie viele Einträge gelöscht werden.
      </div>
    </div>
    <div class="maint-action-row">
      <button class="maint-btn-preview" id="maintBtnPreview">🔍 Vorschau berechnen</button>
      <button class="maint-btn-run" id="maintBtnRun" disabled>🗑 Jetzt löschen</button>
    </div>
    <div class="maint-result" id="maintResult"></div>
  </div>

  <!-- Automatischer Scheduler -->
  <div class="maint-section">
    <div class="maint-section-title">Automatischer Cleanup</div>
    <div class="maint-sched-row">
      <label class="maint-sched-toggle">
        <input type="checkbox" id="maintSchedEnabled" checked />
        <span>Automatisch ausführen</span>
      </label>
      <div class="maint-sched-interval">
        <span class="maint-unit">alle</span>
        <input type="number" id="maintSchedInterval" value="24" min="1" max="720" />
        <span class="maint-unit">Stunden</span>
      </div>
      <select id="maintSchedRule">
        ${PRESETS.filter(p => p.key !== 'custom').map(p =>
            `<option value="${p.key}" ${p.key === 'older_30d' ? 'selected' : ''}>${p.label}</option>`
        ).join('')}
      </select>
      <button class="maint-btn-save" id="maintSchedSave">Speichern</button>
      <span class="maint-sched-status" id="maintSchedStatus">–</span>
    </div>
  </div>

</div>`;
}

// ── State ─────────────────────────────────────────────────────────
let _selectedPreset = 'older_30d';
let _customRule     = null;
let _previewDone    = false;

// ── Aktiven Preset ermitteln ──────────────────────────────────────
function getActiveRule() {
    if (_selectedPreset === 'custom' && _customRule) return _customRule;
    const p = PRESETS.find(x => x.key === _selectedPreset);
    if (!p) return { unit: null, value: 0 };
    return { unit: p.unit, value: p.value, mode: p.mode };
}

function getSelectedTables() {
    return [...document.querySelectorAll('#maintTableGrid input[type=checkbox]:checked')]
        .map(el => el.value);
}

// ── Stats laden ───────────────────────────────────────────────────
async function loadStats() {
    try {
        const res = await ipc('maintenance:stats');
        const s   = res?.result;
        if (!s?.available) return;

        const fmt = n => n >= 1000 ? (n/1000).toFixed(1)+'k' : String(n);
        const fmtBytes = b => b > 1048576 ? (b/1048576).toFixed(1)+' MB' : (b/1024).toFixed(0)+' KB';

        const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

        set('maintStatCache',   fmt(s.tables?.api_cache?.count    ?? 0));
        set('maintStatLogs',    fmt(s.tables?.request_logs?.count ?? 0));
        set('maintStatArchive', fmt(s.tables?.data_archive?.count ?? 0));
        set('maintStatSize',    fmtBytes(s.dbSize ?? 0));

        // Tabellen-Badges
        ['api_cache','request_logs','data_archive'].forEach(t => {
            const el = document.getElementById(`maintCnt_${t}`);
            if (el) el.textContent = fmt(s.tables?.[t]?.count ?? 0);
        });
    } catch (e) { console.warn('[Maint] Stats Fehler:', e.message); }
}

// ── Vorschau berechnen ────────────────────────────────────────────
async function runPreview() {
    const previewEl = document.getElementById('maintPreview');
    const runBtn    = document.getElementById('maintBtnRun');
    if (!previewEl) return;

    previewEl.innerHTML = '<div style="color:var(--muted,#71717a)">Berechne…</div>';
    _previewDone = false;
    if (runBtn) runBtn.disabled = true;

    try {
        const res = await ipc('maintenance:preview', {
            tables: getSelectedTables(),
            rule:   getActiveRule(),
        });
        const data = res?.result;
        if (!data?.available) {
            previewEl.innerHTML = '<div style="color:#f87171">Datenbank nicht verfügbar.</div>';
            return;
        }

        const total = data.preview.reduce((s, r) => s + (r.wouldDelete || 0), 0);
        previewEl.innerHTML = `
            ${data.preview.map(r => `
                <div class="maint-preview-row">
                    <span>${r.label}</span>
                    <span class="${r.wouldDelete > 0 ? 'maint-preview-del' : 'maint-preview-zero'}">
                        ${r.wouldDelete > 0 ? `−${r.wouldDelete.toLocaleString('de-DE')}` : '0 Einträge'}
                    </span>
                </div>
            `).join('')}
            <div class="maint-preview-row maint-preview-total">
                <span>Gesamt</span>
                <span class="${total > 0 ? 'maint-preview-del' : 'maint-preview-zero'}">
                    ${total > 0 ? `−${total.toLocaleString('de-DE')} Einträge` : 'Nichts zu löschen'}
                </span>
            </div>
        `;

        _previewDone = true;
        if (runBtn) runBtn.disabled = total === 0;

    } catch (e) {
        previewEl.innerHTML = `<div style="color:#f87171">Fehler: ${e.message}</div>`;
    }
}

// ── Cleanup ausführen ─────────────────────────────────────────────
async function runCleanup() {
    const resultEl = document.getElementById('maintResult');
    const runBtn   = document.getElementById('maintBtnRun');

    const rule    = getActiveRule();
    const tables  = getSelectedTables();
    const label   = PRESETS.find(p => p.key === _selectedPreset)?.label || 'Benutzerdefiniert';

    // Sicherheits-Bestätigung bei "Alles löschen"
    if (_selectedPreset === 'wipe_all') {
        if (!confirm(`⚠️ Wirklich ALLE Einträge in den gewählten Tabellen löschen?\n\nDas kann nicht rückgängig gemacht werden!`))
            return;
    }

    if (runBtn) runBtn.disabled = true;
    if (resultEl) { resultEl.className = 'maint-result'; resultEl.textContent = 'Löscht…'; resultEl.style.display = 'block'; }

    try {
        const res  = await ipc('maintenance:run', { tables, rule, vacuum: true });
        const data = res?.result;

        if (!data?.success) throw new Error(data?.error || 'Unbekannter Fehler');

        const msg = `✓ ${data.totalDeleted.toLocaleString('de-DE')} Einträge gelöscht (${label}) in ${data.duration}ms`;
        if (resultEl) { resultEl.className = 'maint-result success'; resultEl.textContent = msg; }

        // Stats neu laden
        await loadStats();
        _previewDone = false;
        document.getElementById('maintPreview').innerHTML =
            '<div style="color:var(--muted,#71717a)">Cleanup abgeschlossen. Klicke "Vorschau" für neue Analyse.</div>';

    } catch (e) {
        if (resultEl) { resultEl.className = 'maint-result error'; resultEl.textContent = '✗ Fehler: ' + e.message; }
        if (runBtn) runBtn.disabled = false;
    }
}

// ── Scheduler speichern ───────────────────────────────────────────
async function saveScheduler() {
    const enabled  = document.getElementById('maintSchedEnabled')?.checked ?? true;
    const interval = parseInt(document.getElementById('maintSchedInterval')?.value) || 24;
    const rule     = document.getElementById('maintSchedRule')?.value || 'older_30d';

    try {
        const res = await ipc('maintenance:schedulerUpdate', { enabled, intervalHours: interval, rule });
        const statusEl = document.getElementById('maintSchedStatus');
        if (statusEl) {
            statusEl.textContent = enabled ? `✓ Aktiv — alle ${interval}h` : '⏸ Deaktiviert';
            statusEl.className   = `maint-sched-status ${enabled ? 'active' : ''}`;
        }
        toast('Scheduler gespeichert', 'success');
    } catch (e) { toast('Fehler: ' + e.message, 'error'); }
}

// ── Events verdrahten ─────────────────────────────────────────────
function bindEvents() {
    // Preset-Buttons
    document.getElementById('maintPresetRow')?.addEventListener('click', e => {
        const btn = e.target.closest('.maint-preset-btn');
        if (!btn) return;
        _selectedPreset = btn.dataset.preset;

        document.querySelectorAll('.maint-preset-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Custom-Row anzeigen/verstecken
        const customRow = document.getElementById('maintCustomRow');
        if (customRow) customRow.style.display = _selectedPreset === 'custom' ? 'flex' : 'none';

        // Vorschau zurücksetzen
        _previewDone = false;
        const runBtn = document.getElementById('maintBtnRun');
        if (runBtn) runBtn.disabled = true;
    });

    // Custom-Eingaben
    const updateCustom = () => {
        if (_selectedPreset !== 'custom') return;
        const mode  = document.getElementById('maintCustomMode')?.value || 'older';
        const value = parseInt(document.getElementById('maintCustomVal')?.value) || 7;
        const unit  = document.getElementById('maintCustomUnit')?.value || 'days';
        _customRule = { unit, value, mode };
        _previewDone = false;
        const runBtn = document.getElementById('maintBtnRun');
        if (runBtn) runBtn.disabled = true;
    };
    document.getElementById('maintCustomMode')?.addEventListener('change', updateCustom);
    document.getElementById('maintCustomVal')?.addEventListener('input', updateCustom);
    document.getElementById('maintCustomUnit')?.addEventListener('change', updateCustom);

    // Aktionen
    document.getElementById('maintBtnPreview')?.addEventListener('click', runPreview);
    document.getElementById('maintBtnRun')?.addEventListener('click', runCleanup);
    document.getElementById('maintSchedSave')?.addEventListener('click', saveScheduler);
}

// ── Toast ─────────────────────────────────────────────────────────
function toast(msg, type = 'info') {
    if (typeof window.showToast === 'function') { window.showToast(msg, type); return; }
    const t = document.createElement('div');
    t.style.cssText = `position:fixed;bottom:24px;right:24px;padding:10px 18px;border-radius:8px;
        font-size:13px;z-index:9999;color:#fff;box-shadow:0 4px 16px #0006;
        background:${type === 'error' ? '#dc2626' : '#22c55e'}`;
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2800);
}

// ── Haupt-Init ────────────────────────────────────────────────────
export function initMaintenanceTab() {
    // Wir suchen den Tab-Button, der jetzt fest im HTML ist
    const btn = document.querySelector('.nav-item[data-target="pane-maintenance"]');
    if (!btn) return;

    // Listener binden (die Standard-Navigation übernimmt settings.js)
    // Wir fügen nur die Logik zum Laden der Stats hinzu
    btn.addEventListener('click', () => {
        loadStats();
    });

    // Einmalig die Button-Events (Preview, Run, etc.) binden
    bindEvents();
    
    // Scheduler Status beim Start abrufen
    ipc('maintenance:schedulerStatus').then(res => {
        const s = res?.result;
        const statusEl = document.getElementById('maintSchedStatus');
        if (statusEl && s) {
            statusEl.textContent = s.enabled ? `Aktiv` : 'Inaktiv';
            statusEl.classList.toggle('active', s.enabled);
        }
    });
}

/**
 * Preload-Bindings — in preload.js hinzufügen:
 *
 *   maintenance_stats:           () => ipcRenderer.invoke('maintenance:stats'),
 *   maintenance_preview:         (o) => ipcRenderer.invoke('maintenance:preview', o),
 *   maintenance_run:             (o) => ipcRenderer.invoke('maintenance:run', o),
 *   maintenance_schedulerStatus: () => ipcRenderer.invoke('maintenance:schedulerStatus'),
 *   maintenance_schedulerUpdate: (c) => ipcRenderer.invoke('maintenance:schedulerUpdate', c),
 */
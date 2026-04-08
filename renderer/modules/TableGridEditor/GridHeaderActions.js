/* ── TableGridEditor/GridHeaderActions.js ──────────────────────────────────
   Header-Aktionsleiste für den Table-Grid-Editor.
   Enthält: RLS-Toggle, Spalte hinzufügen, Zeile hinzufügen, Refresh,
            Sicherheits-Warnungen für Views und Foreign Tables.
   ────────────────────────────────────────────────────────────────────────── */

import { state }    from '../state.js';
import { esc, escH, setStatus } from '../utils.js';
import { refreshTableList }     from '../sidebar.js';
import {
    getEntityLintDetails,
    isTableLike, isView, isMaterializedView, isForeignTable, isViewLike,
} from './TableEntity.utils.js';
import { openAutofixSecurityModal } from './ViewEntityAutofixSecurityModal.js';

// ── CSS (einmalig injizieren) ──────────────────────────────────────────────
(function injectStyles() {
    if (document.getElementById('kynto-header-actions-styles')) return;
    const style = document.createElement('style');
    style.id    = 'kynto-header-actions-styles';
    style.textContent = `
        .kynto-header-actions {
            display: flex; align-items: center; gap: 6px;
            padding: 4px 10px;
            border-bottom: 1px solid var(--border, #333);
            background: var(--surface1, #1e1e2e);
            flex-wrap: wrap;
            min-height: 38px;
        }
        .kynto-header-actions .kynto-ha-spacer { flex: 1; }

        /* Basis-Button */
        .kha-btn {
            display: inline-flex; align-items: center; gap: 5px;
            padding: 4px 12px; border-radius: 5px; font-size: 12px;
            cursor: pointer; border: 1px solid var(--border, #333);
            background: var(--surface2, #313244); color: var(--fg, #cdd6f4);
            transition: background .15s, opacity .15s;
            white-space: nowrap;
        }
        .kha-btn:hover   { background: var(--surface3, #45475a); }
        .kha-btn:disabled { opacity: .45; cursor: not-allowed; }

        /* Varianten */
        .kha-btn-primary  { background: var(--accent, #cba6f7); color: #1e1e2e; border-color: var(--accent, #cba6f7); font-weight: 600; }
        .kha-btn-primary:hover  { opacity: .85; background: var(--accent, #cba6f7); }
        .kha-btn-warning  { background: rgba(234,179,8,.18); color: #fbbf24; border-color: rgba(234,179,8,.5); }
        .kha-btn-warning:hover  { background: rgba(234,179,8,.28); }
        .kha-btn-danger   { background: rgba(220,38,38,.15); color: #f87171; border-color: rgba(220,38,38,.4); }
        .kha-btn-danger:hover   { background: rgba(220,38,38,.25); }
        .kha-btn-success  { background: rgba(34,197,94,.15); color: #4ade80; border-color: rgba(34,197,94,.4); }
        .kha-btn-success:hover  { background: rgba(34,197,94,.25); }

        /* Popover */
        .kha-popover {
            position: absolute; z-index: 500;
            background: var(--surface1, #1e1e2e);
            border: 1px solid var(--border, #333);
            border-radius: 8px; padding: 16px;
            min-width: 360px; max-width: 400px;
            box-shadow: 0 16px 48px rgba(0,0,0,.5);
            animation: kyntoFadeIn .12s ease;
            top: calc(100% + 4px); right: 0;
        }
        .kha-popover h4 { margin: 0 0 10px; font-size: 13px; color: var(--fg, #cdd6f4); }
        .kha-popover p  { font-size: 12px; color: var(--muted, #888); margin: 0 0 8px; line-height: 1.6; }
        .kha-popover-actions { display: flex; gap: 8px; margin-top: 12px; }

        .kha-rls-badge {
            display: inline-flex; align-items: center; gap: 4px;
            padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600;
        }
        .kha-rls-on  { background: rgba(34,197,94,.15); color: #4ade80; }
        .kha-rls-off { background: rgba(220,38,38,.15); color: #f87171; }
    `;
    document.head.appendChild(style);
})();

// ── Öffentliche Klasse ─────────────────────────────────────────────────────

export class GridHeaderActions {
    /**
     * @param {object} opts
     * @param {object}      opts.entity       – Entity-Objekt
     * @param {string}      opts.dbId         – aktive DB-ID
     * @param {HTMLElement} opts.container    – Ziel-Element
     * @param {boolean}     [opts.editable]   – ob Bearbeitungen erlaubt sind
     * @param {object[]}    [opts.lints]      – Lint-Ergebnisse
     * @param {function}    [opts.onAddRow]   – Callback: neue Zeile
     * @param {function}    [opts.onAddCol]   – Callback: neue Spalte
     * @param {function}    [opts.onRefresh]  – Callback: Tabelle neu laden
     * @param {function}    [opts.onInsertSql]– Callback: INSERT SQL öffnen
     */
    constructor(opts) {
        this.entity     = opts.entity;
        this.dbId       = opts.dbId;
        this.container  = opts.container;
        this.editable   = opts.editable ?? true;
        this.lints      = opts.lints ?? [];
        this.onAddRow   = opts.onAddRow   ?? null;
        this.onAddCol   = opts.onAddCol   ?? null;
        this.onRefresh  = opts.onRefresh  ?? null;
        this.onInsertSql = opts.onInsertSql ?? null;

        this._openPopover = null; // aktuell offenes Popover
    }

    /** Rendert die Header-Aktionsleiste in den Container. */
    render() {
        const { entity, editable, lints, dbId } = this;

        const isTable  = isTableLike(entity);
        const isV      = isView(entity);
        const isMV     = isMaterializedView(entity);
        const isFT     = isForeignTable(entity);
        const isVLike  = isViewLike(entity);

        // Lint-Checks
        const { hasLint: tableRlsLint } = getEntityLintDetails(
            entity.name, 'rls_disabled_in_public', ['ERROR'], lints, entity.schema
        );
        const { hasLint: viewSecLint, matchingLint: viewLint } = getEntityLintDetails(
            entity.name, 'security_definer_view', ['ERROR', 'WARN'], lints, entity.schema
        );
        const { hasLint: mvLint } = getEntityLintDetails(
            entity.name, 'materialized_view_in_api', ['ERROR', 'WARN'], lints, entity.schema
        );

        // RLS-Status aus Entity
        const rlsEnabled = isTable && entity.rls_enabled;

        // HTML aufbauen
        const bar = document.createElement('div');
        bar.className = 'kynto-header-actions';

        // ── Linke Seite ────────────────────────────────────────────────────
        // View-Switcher: Navigation zwischen Daten-Grid und Schema
        const viewSwitcher = document.createElement('div');
        viewSwitcher.style.cssText = 'display:flex; gap:2px; margin-right:10px; padding-right:10px; border-right:1px solid var(--border);';
        
        // Verbindet die Buttons direkt mit der switchView-Logik des Orchestrators
        viewSwitcher.appendChild(this._makeBtn('📋 Daten', '', () => window.TableGridEditor.switchView('data')));
        if (isTable) {
            viewSwitcher.appendChild(this._makeBtn('🔧 Schema', '', () => window.TableGridEditor.switchView('schema')));
        }
        viewSwitcher.appendChild(this._makeBtn('📄 Definition', '', () => window.TableGridEditor.switchView('definition')));
        bar.appendChild(viewSwitcher);

        // RLS-Badge (nur für Tabellen)
        if (isTable) {
            const badge = document.createElement('span');
            badge.className = `kha-rls-badge ${rlsEnabled ? 'kha-rls-on' : 'kha-rls-off'}`;
            badge.title     = rlsEnabled ? 'Row Level Security ist aktiv' : 'Row Level Security ist deaktiviert';
            badge.innerHTML = rlsEnabled ? '🔒 RLS aktiv' : '🔓 RLS aus';
            bar.appendChild(badge);

            if (editable) {
                const btnRls = this._makeBtn(
                    rlsEnabled ? 'RLS deaktivieren' : 'RLS aktivieren',
                    rlsEnabled ? 'kha-btn-danger' : 'kha-btn-success',
                    () => this._handleToggleRls(entity, rlsEnabled, dbId)
                );
                bar.appendChild(btnRls);
            }
        }

        // Spacer
        const spacer = document.createElement('div');
        spacer.className = 'kynto-ha-spacer';
        bar.appendChild(spacer);

        // ── Rechte Seite ───────────────────────────────────────────────────

        // Sicherheitswarnung View
        if ((isV || isMV) && viewSecLint) {
            const warnWrap = document.createElement('div');
            warnWrap.style.position = 'relative';
            const btnWarn = this._makeBtn('🔓 Security Definer View', 'kha-btn-warning', () =>
                this._togglePopover(warnWrap, this._buildViewSecPopover(entity, dbId, viewLint))
            );
            warnWrap.appendChild(btnWarn);
            bar.appendChild(warnWrap);
        }

        // Sicherheitswarnung Materialized View in API
        if (isMV && mvLint) {
            const warnWrap = document.createElement('div');
            warnWrap.style.position = 'relative';
            const btnWarn = this._makeBtn('🔓 Materialized View in API', 'kha-btn-warning', () =>
                this._togglePopover(warnWrap, this._buildMvPopover())
            );
            warnWrap.appendChild(btnWarn);
            bar.appendChild(warnWrap);
        }

        // Warnung Foreign Table
        if (isFT && entity.schema === 'public') {
            const warnWrap = document.createElement('div');
            warnWrap.style.position = 'relative';
            const btnWarn = this._makeBtn('🔓 Ungeschützter API-Zugriff', 'kha-btn-warning', () =>
                this._togglePopover(warnWrap, this._buildForeignTablePopover())
            );
            warnWrap.appendChild(btnWarn);
            bar.appendChild(warnWrap);
        }

        // RLS-Lint-Hinweis (roter Badge)
        if (isTable && tableRlsLint) {
            const btnLint = this._makeBtn('⚠️ RLS deaktiviert (public)', 'kha-btn-warning', () =>
                setStatus('Tabelle im public-Schema ohne RLS ist ein Sicherheitsrisiko!', 'warn')
            );
            bar.appendChild(btnLint);
        }

        // SQL-Insert öffnen
        if (editable && isTable) {
            bar.appendChild(this._makeBtn('SQL INSERT', '', () => this.onInsertSql?.()));
        }

        // Refresh
        const btnRefresh = this._makeBtn('🔄', '', () => {
            btnRefresh.disabled = true;
            btnRefresh.textContent = '⏳';
            Promise.resolve(this.onRefresh?.()).finally(() => {
                btnRefresh.disabled    = false;
                btnRefresh.textContent = '🔄';
            });
        });
        btnRefresh.title = 'Tabelle neu laden';
        bar.appendChild(btnRefresh);

        // Container füllen
        this.container.innerHTML = '';
        this.container.appendChild(bar);

        // Popover schließen bei Klick außerhalb
        document.addEventListener('click', (e) => {
            if (this._openPopover && !this._openPopover.contains(e.target) && !bar.contains(e.target)) {
                this._closePopover();
            }
        }, { capture: true });
    }

    // ── Private Hilfsmethoden ──────────────────────────────────────────────

    _makeBtn(label, extraClass, onClick) {
        const btn = document.createElement('button');
        btn.className = `kha-btn ${extraClass}`;
        btn.innerHTML = escH(label);
        btn.addEventListener('click', (e) => { e.stopPropagation(); onClick(); });
        return btn;
    }

    _togglePopover(anchor, popoverEl) {
        if (this._openPopover) {
            this._closePopover();
            if (this._openPopover === popoverEl) return;
        }
        anchor.appendChild(popoverEl);
        this._openPopover = popoverEl;
    }

    _closePopover() {
        this._openPopover?.remove();
        this._openPopover = null;
    }

    // ── Popover-Inhalte ────────────────────────────────────────────────────

    _buildViewSecPopover(entity, dbId, lint) {
        const pop = document.createElement('div');
        pop.className = 'kha-popover';
        pop.innerHTML = `
            <h4>🔓 View absichern</h4>
            <p>Diese View ist mit der Eigenschaft <strong>Security Definer</strong> definiert.
               Sie wird mit den Berechtigungen des View-Erstellers (Postgres) ausgeführt –
               nicht mit denen des abfragenden Benutzers.</p>
            <p>Da die View im <strong>public</strong>-Schema liegt, ist sie über die API erreichbar.</p>
            <div class="kha-popover-actions">
                <button class="kha-btn kha-btn-primary" id="pop-autofix">🔧 Automatisch beheben</button>
                <button class="kha-btn" id="pop-close">Schließen</button>
            </div>
        `;
        pop.querySelector('#pop-autofix').addEventListener('click', () => {
            this._closePopover();
            openAutofixSecurityModal({
                entity,
                dbId,
                onSuccess: () => this.onRefresh?.(),
            });
        });
        pop.querySelector('#pop-close').addEventListener('click', () => this._closePopover());
        return pop;
    }

    _buildMvPopover() {
        const pop = document.createElement('div');
        pop.className = 'kha-popover';
        pop.innerHTML = `
            <h4>🔓 Materialized View in API</h4>
            <p>Diese Materialized View ist über das <strong>public</strong>-Schema in der API erreichbar.
               Prüfe, ob das beabsichtigt ist.</p>
            <div class="kha-popover-actions">
                <button class="kha-btn" id="pop-close">Schließen</button>
            </div>
        `;
        pop.querySelector('#pop-close').addEventListener('click', () => this._closePopover());
        return pop;
    }

    _buildForeignTablePopover() {
        const pop = document.createElement('div');
        pop.className = 'kha-popover';
        pop.innerHTML = `
            <h4>🔓 Foreign Table absichern</h4>
            <p>Foreign Tables erzwingen kein RLS. Das kann uneingeschränkte Datenzugriffe erlauben.</p>
            <p>Verschiebe die Tabelle in ein privates Schema oder deaktiviere den PostgREST-Zugriff.</p>
            <div class="kha-popover-actions">
                <button class="kha-btn" id="pop-close">Schließen</button>
            </div>
        `;
        pop.querySelector('#pop-close').addEventListener('click', () => this._closePopover());
        return pop;
    }

    // ── RLS-Toggle ─────────────────────────────────────────────────────────

    async _handleToggleRls(entity, currentlyEnabled, dbId) {
        const action = currentlyEnabled ? 'DISABLE' : 'ENABLE';
        const label  = currentlyEnabled ? 'deaktiviert' : 'aktiviert';

        if (!confirm(`Row Level Security für "${entity.name}" ${label === 'aktiviert' ? 'aktivieren' : 'deaktivieren'}?`)) return;

        try {
            await window.api.query(
                `ALTER TABLE ${esc(entity.schema)}.${esc(entity.name)} ${action} ROW LEVEL SECURITY`,
                dbId
            );
            setStatus(`RLS für "${entity.name}" ${label}.`, 'success');
            // Entity-State aktualisieren und Header neu rendern
            entity.rls_enabled = !currentlyEnabled;
            this.render();
        } catch (err) {
            setStatus(`Fehler beim RLS-Toggle: ${err.message}`, 'error');
        }
    }
}

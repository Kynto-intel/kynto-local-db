/**
 * Kynto Intel - Enhanced Visualizer
 * 
 * Erweiterte Datentyp-Färbung + Statistische Analysen
 * - Bessere Typ-Erkennung (UUID, IP, Hex, Phone, ISBN, etc.)
 * - Column Statistics (NULL %, Unique Rate, Type Consistency)
 * - Data Quality Score
 * - Interaktive Tooltips & Filter
 */

import { state } from './state.js';
import { setupRefreshButton } from './action-buttons/refresh.js';

let _refreshTable = () => {};
export function setVisualizerRefresh(fn) { _refreshTable = fn; }

/**
 * 🔍 Regex Patterns für erweiterte Datentyp-Erkennung
 */
const DataTypePatterns = {
    UUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    EMAIL: /^\S+@\S+\.\S+$/,
    URL: /^https?:\/\//,
    IP_V4: /^(\d{1,3}\.){3}\d{1,3}$/,
    IP_V6: /^([\da-f]{0,4}:){2,7}[\da-f]{0,4}$/i,
    HEX_COLOR: /^#[0-9a-f]{6}([0-9a-f]{2})?$/i,
    RGB_COLOR: /^rgb\(/,
    JSON_OBJ: /^{.*}$/s,
    JSON_ARR: /^\[.*\]$/s,
    PHONE: /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/,
    ISO_DATE: /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2})?/,
    TIME: /^\d{2}:\d{2}:\d{2}/,
    ISBN: /^(?:ISBN(?:-1[03])?:? )?(?=[0-9X]{10}$|(?=(?:[0-9]+[- ]){3})[- 0-9X]{13}$|97[89][0-9]{10}$|(?=(?:[0-9]+[- ]){4})[- 0-9]{17}$)(?:97[89][- ]?)?[0-9]{1,5}[- ]?[0-9]+[- ]?[0-9]+[- ]?[0-9X]$/i,
    MARKDOWN: /^#+\s|^\*\*|^- /m,
    CURRENCY: /^[\$€£¥₹]?\s?[\d,\.]+\s?[\$€£¥₹]?$/,
    PERCENTAGE: /^\d+(\.\d+)?%?$/,
    BOOLEAN_TEXT: /^(true|false|yes|no|on|off|1|0)$/i,
};

/**
 * ✅ Verbesserte Datentyp-Erkennung
 */
function identifyDataType(val) {
    if (val === null || val === undefined) return 'null';
    if (typeof val === 'number' || typeof val === 'bigint') return 'number';
    if (typeof val === 'boolean') return 'boolean';
    if (typeof val !== 'string') return 'object';

    const str = String(val).trim();
    if (!str) return 'empty';

    // Prüfe Patterns in Prioritätsreihenfolge (wichtigste zuerst)
    if (DataTypePatterns.UUID.test(str)) return 'uuid';
    if (DataTypePatterns.URL.test(str)) return 'url';
    if (DataTypePatterns.EMAIL.test(str)) return 'email';
    if (DataTypePatterns.IP_V4.test(str)) return 'ip4';
    if (DataTypePatterns.IP_V6.test(str)) return 'ip6';
    if (DataTypePatterns.HEX_COLOR.test(str)) return 'hex_color';
    if (DataTypePatterns.RGB_COLOR.test(str)) return 'rgb_color';
    if (DataTypePatterns.PHONE.test(str)) return 'phone';
    if (DataTypePatterns.ISO_DATE.test(str)) return 'iso_date';
    if (DataTypePatterns.TIME.test(str)) return 'time';
    if (DataTypePatterns.ISBN.test(str)) return 'isbn';
    if (DataTypePatterns.JSON_ARR.test(str)) return 'json_array';
    if (DataTypePatterns.JSON_OBJ.test(str)) return 'json_object';
    if (DataTypePatterns.CURRENCY.test(str)) return 'currency';
    if (DataTypePatterns.MARKDOWN.test(str)) return 'markdown';
    if (DataTypePatterns.BOOLEAN_TEXT.test(str)) return 'boolean_text';
    
    return 'string';
}

/**
 * 🎨 Get visuellen Stil für jeden Datentyp (nur FARBEN, keine Icons)
 */
function getTypeStyle(type) {
    const styles = {
        null: { className: 'vis-null', color: '#4c566a' },
        empty: { className: 'vis-empty', color: '#7a7a8c' },
        number: { className: 'vis-number', color: '#4fc3f7' },
        boolean: { className: 'vis-boolean', color: '#ebcb8b' },
        uuid: { className: 'vis-uuid', color: '#88c0d0' },
        url: { className: 'vis-url', color: '#4fc3f7' },
        email: { className: 'vis-email', color: '#88c0d0' },
        ip4: { className: 'vis-ip', color: '#81c784' },
        ip6: { className: 'vis-ip', color: '#81c784' },
        hex_color: { className: 'vis-color', color: '#a3be8c' },
        rgb_color: { className: 'vis-color', color: '#a3be8c' },
        phone: { className: 'vis-phone', color: '#b48ead' },
        iso_date: { className: 'vis-date', color: '#b48ead' },
        time: { className: 'vis-time', color: '#b48ead' },
        isbn: { className: 'vis-isbn', color: '#a3be8c' },
        json_object: { className: 'vis-json', color: '#d4bfff' },
        json_array: { className: 'vis-json', color: '#d4bfff' },
        currency: { className: 'vis-currency', color: '#a3be8c' },
        markdown: { className: 'vis-markdown', color: '#d4bfff' },
        boolean_text: { className: 'vis-boolean', color: '#ebcb8b' },
        string: { className: 'vis-string', color: '#a3be8c' },
        object: { className: 'vis-object', color: '#d4bfff' },
    };
    return styles[type] || styles.string;
}

/**
 * 📊 Detaillierte Column-Level Statistiken
 */
export function analyzeColumn(columnName) {
    if (!state.lastData || state.lastData.length === 0) return null;

    const values = state.lastData.map(row => row[columnName]);
    const stats = {
        name: columnName,
        totalRows: values.length,
        nullCount: values.filter(v => v === null || v === undefined).length,
        emptyCount: values.filter(v => String(v).trim() === '').length,
        uniqueCount: new Set(values.map(v => String(v))).size,
        types: {},
        minLength: Infinity,
        maxLength: 0,
        avgLength: 0,
        numericStats: { min: Infinity, max: -Infinity, avg: 0, count: 0 }
    };

    let totalLength = 0;
    let numericSum = 0;

    // Zähle Datentypen und Längen
    values.forEach(val => {
        if (val !== null && val !== undefined) {
            const type = identifyDataType(val);
            stats.types[type] = (stats.types[type] || 0) + 1;
            
            const strVal = String(val);
            const len = strVal.length;
            totalLength += len;
            stats.minLength = Math.min(stats.minLength, len);
            stats.maxLength = Math.max(stats.maxLength, len);
            
            // Numerische Statistiken
            const num = Number(val);
            if (!isNaN(num)) {
                stats.numericStats.min = Math.min(stats.numericStats.min, num);
                stats.numericStats.max = Math.max(stats.numericStats.max, num);
                numericSum += num;
                stats.numericStats.count++;
            }
        }
    });

    stats.nullPercent = ((stats.nullCount / stats.totalRows) * 100).toFixed(1);
    stats.uniquePercent = ((stats.uniqueCount / stats.totalRows) * 100).toFixed(1);
    stats.emptyPercent = ((stats.emptyCount / stats.totalRows) * 100).toFixed(1);
    stats.avgLength = Math.round(totalLength / stats.totalRows);
    
    if (stats.numericStats.count > 0) {
        stats.numericStats.avg = (numericSum / stats.numericStats.count).toFixed(2);
    }

    // 🎯 Data Quality Score
    const hasMultipleTypes = Object.keys(stats.types).length > 2;
    const hasHighNull = stats.nullPercent > 30;
    const consistency = !hasMultipleTypes ? 1.0 : 0.7;
    const completeness = 1.0 - (stats.nullPercent / 100);

    stats.qualityScore = Math.round(((consistency + completeness) / 2) * 100);
    stats.qualityLevel = stats.qualityScore > 80 ? 'excellent' : 
                         stats.qualityScore > 60 ? 'good' : 
                         stats.qualityScore > 40 ? 'fair' : 'poor';

    return stats;
}

/**
 * ✅ Main Visualizer API
 */
export const KyntoVisualizer = {
    modes: { TYPE: 'type', HEATMAP: 'heatmap', VALIDATION: 'validation' },

    getCellProps: function(val, mode, min, max) {
        // 🐛 Wenn kein Mode, keine Styles zurückgeben
        if (!mode) {
            return {};
        }

        // Validierungsmodus: Zeige NULL/leere Werte
        if (mode === 'validation') {
            if (val === null || val === undefined || String(val).trim() === '') {
                return { 
                    className: 'vis-validation-error',
                    text: val === null ? 'NULL' : 'EMPTY',
                    style: 'background: rgba(243, 139, 168, 0.2); color: #f38ba8;'
                };
            }
            return { className: 'vis-validation-ok' };
        }

        // Heatmap-Modus: Numerische Werte als Farbintensität
        if (mode === 'heatmap') {
            const num = Number(val);
            if (isNaN(num) || min === undefined || max === undefined || min === max) {
                return { className: 'vis-heatmap-neutral' };
            }
            const ratio = (num - min) / (max - min);
            const opacity = 0.1 + (ratio * 0.7);
            return { 
                style: `background-color: rgba(255, 215, 0, ${opacity});`,
                className: 'vis-heatmap'
            };
        }

        // Type-Highlighting Modus (Default)
        const type = identifyDataType(val);
        const typeInfo = getTypeStyle(type);
        
        return {
            className: typeInfo.className,
            title: `Typ: ${type}\nStrg+Click: Kopieren`,
            icon: typeInfo.icon,
            color: typeInfo.color
        };
    },

    identifyDataType,
    analyzeColumn,
    getTypeStyle
};

/**
 * 🔄 Synchronisiere Button-Status
 */
export function syncVisualizerButton() {
    const btnMain = document.getElementById('btn-magic-eye');
    if (!btnMain) {
        console.log('[visualizer] Button not found for sync');
        return;
    }
    
    // Stelle sicher, dass der aktuelle State korrekt mit der CSS-Klasse synchronisiert ist
    const wasBefore = btnMain.classList.contains('active');
    
    // Entferne zuerst die Klasse, dann füge sie nur hinzu, wenn state true ist
    btnMain.classList.remove('active');
    if (state.magicEyeActive) {
        btnMain.classList.add('active');
    }
    
    const isNow = btnMain.classList.contains('active');
    
    console.log('[visualizer] Button synced: magicEyeActive=', state.magicEyeActive, 
                 '| was active:', wasBefore, '| is now active:', isNow, 
                 '| changed:', wasBefore !== isNow);
}

/**
 * 🎯 Initialisiere Visualizer UI
 */
export function initVisualizer() {
    // CSS einfügen
    const style = document.createElement('style');
    style.textContent = `
        /* Base Visualizer Styles */
        .vis-null, .vis-empty { color: #4c566a !important; font-style: italic; opacity: 0.6; }
        .vis-number { color: #4fc3f7 !important; text-align: right; font-family: monospace; font-weight: 500; }
        .vis-boolean { color: #ebcb8b !important; text-transform: uppercase; letter-spacing: 1px; font-weight: 600; }
        .vis-uuid { color: #88c0d0 !important; font-family: monospace; font-size: 11px; }
        .vis-url { color: #4fc3f7 !important; text-decoration: underline; cursor: pointer; }
        .vis-email { color: #88c0d0 !important; cursor: pointer; }
        .vis-ip { color: #81c784 !important; font-family: monospace; }
        .vis-color { color: #a3be8c !important; font-weight: bold; }
        .vis-phone { color: #b48ead !important; }
        .vis-date, .vis-time { color: #b48ead !important; }
        .vis-isbn { color: #a3be8c !important; font-family: monospace; font-size: 11px; }
        .vis-json { color: #d4bfff !important; font-family: monospace; font-size: 10px; }
        .vis-currency { color: #a3be8c !important; font-weight: bold; }
        .vis-markdown { color: #d4bfff !important; }
        .vis-string { color: #a3be8c !important; }
        .vis-object { color: #d4bfff !important; }
        
        .vis-validation-error { background: rgba(243, 139, 168, 0.2) !important; color: #f38ba8 !important; font-weight: 600; }
        .vis-validation-ok { opacity: 0.8; }
        .vis-heatmap { color: #fff !important; font-weight: 500; }
        .vis-heatmap-neutral { opacity: 0.5; }

        /* UI Container */
        .magic-eye-container { display: inline-flex; gap: 2px; align-items: center; }
    `;
    document.head.appendChild(style);

    // Prüfe ob Container bereits existiert
    const existingContainer = document.querySelector('.magic-eye-container');
    if (existingContainer) {
        syncVisualizerButton();
        return;
    }

    // Erstelle neuen Container
    const container = document.createElement('div');
    container.className = 'magic-eye-container';
    container.innerHTML = `
        <button class="status-badge" id="btn-magic-eye" title="Typ-Highlighting umschalten">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
            <span id="magic-eye-label">Typ-Highlighting</span>
        </button>
        <button class="status-badge" id="btn-col-stats" title="Spaltenstatistiken anzeigen">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
        </button>
        <div id="column-stats-panel" style="display:none; position:fixed; width:550px; background:var(--surface2); border:1px solid var(--border); border-radius:8px; padding:14px; z-index:1001; max-height:600px; overflow-y:auto; box-shadow: 0 10px 40px rgba(0,0,0,0.3);">
            <h4 style="margin:0 0 12px 0; font-size:13px; color:var(--accent); font-weight:600; display:flex; align-items:center; gap:6px;">Column Statistics</h4>
            <div id="stats-content" style="font-size:11px;"></div>
        </div>
    `;

    // Integration in die Action-Bar (neben RLS, Indexberater etc.)
    const injectIntoActionBar = () => {
        const actionBar = document.getElementById('action-bar-container');
        if (actionBar && !actionBar.contains(container)) {
            actionBar.appendChild(container);
        }
    };

    // Da die Action-Bar oft geleert wird (z.B. durch initActionBar), 
    // stellen wir sicher, dass die Magic-Eye Buttons immer wieder einziehen.
    const observer = new MutationObserver(() => injectIntoActionBar());
    const actionBarTarget = document.getElementById('action-bar-container');
    if (actionBarTarget) observer.observe(actionBarTarget, { childList: true });
    
    injectIntoActionBar();

    // ═══════════════════════════════════════════════════════════════════════
    // Refresh-Button NACH den Magic-Eye Buttons
    // ═══════════════════════════════════════════════════════════════════════
    const refreshBtnContainer = document.createElement('div');
    refreshBtnContainer.id = 'refresh-btn-container';
    refreshBtnContainer.style.display = 'inline-flex';
    
    const refreshBtn = document.createElement('button');
    refreshBtn.className = 'btn';
    refreshBtn.id = 'btn-refresh';
    refreshBtnContainer.appendChild(refreshBtn);
    
    const injectRefreshButton = () => {
        const actionBar = document.getElementById('action-bar-container');
        if (actionBar && !actionBar.querySelector('#refresh-btn-container')) {
            actionBar.appendChild(refreshBtnContainer);
            setupRefreshButton(refreshBtn);
        }
    };
    
    // Beobachte auch hier die Action-Bar Veränderungen
    const observer2 = new MutationObserver(() => injectRefreshButton());
    if (actionBarTarget) observer2.observe(actionBarTarget, { childList: true });
    
    injectRefreshButton();

    // Event Listener
    const btnMain = container.querySelector('#btn-magic-eye');
    if (btnMain && state.magicEyeActive) {
        btnMain.classList.add('active');
    }
    const btnStats = container.querySelector('#btn-col-stats');
    const statsPanel = container.querySelector('#column-stats-panel');

    btnMain.addEventListener('click', () => {
        state.magicEyeActive = !state.magicEyeActive;
        if (state.magicEyeActive) {
            btnMain.classList.add('active');
        } else {
            btnMain.classList.remove('active');
        }
        console.log('[visualizer] Button clicked: magicEyeActive toggled to', state.magicEyeActive);
        _refreshTable();
    });

    btnStats.addEventListener('click', (e) => {
        e.stopPropagation();
        statsPanel.style.display = statsPanel.style.display === 'none' ? 'block' : 'none';
        const rect = btnStats.getBoundingClientRect();
        statsPanel.style.top = (rect.bottom + 4) + 'px';
        statsPanel.style.right = (window.innerWidth - rect.right) + 'px';
        if (statsPanel.style.display === 'block' && state.currentCols && state.currentCols.length > 0) {
            updateColumnStats(state.currentCols, container);
        }
    });

    document.addEventListener('click', () => {
        statsPanel.style.display = 'none';
    });

    console.log('[visualizer] ✅ Initialisation complete');
}

/**
 * 📊 Update Column Statistics Panel
 */
function updateColumnStats(columns, container) {
    const statsContent = container.querySelector('#stats-content');
    const stats = columns.map(col => analyzeColumn(col)).filter(Boolean);

    if (stats.length === 0) {
        statsContent.innerHTML = '<div style="color:#888;">Keine Spalten zu analysieren...</div>';
        return;
    }

    const qualityColor = (score) => score > 80 ? '#81c784' : score > 60 ? '#ffa726' : '#ef5350';

    statsContent.innerHTML = stats.map(s => `
        <div style="background: rgba(255,255,255,0.03); padding: 10px; border-radius: 6px; margin-bottom: 8px; border-left: 4px solid ${qualityColor(s.qualityScore)}; backdrop-filter: blur(2px);">
            <div style="font-weight:bold; color:var(--text); display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <span style="font-size:12px;">${escH(s.name)}</span>
                <span style="background:${qualityColor(s.qualityScore)}22; padding:3px 8px; border-radius:4px; font-size:11px; color:${qualityColor(s.qualityScore)}; font-weight:600; border:1px solid ${qualityColor(s.qualityScore)}44;">${s.qualityScore}%</span>
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:8px; font-size:11px;">
                <div style="background:rgba(255,255,255,0.02); padding:6px; border-radius:4px;">
                    <div style="color:var(--muted); text-transform:uppercase; letter-spacing:0.5px; font-size:9px; margin-bottom:2px;">Rows</div>
                    <div style="color:var(--accent); font-weight:600; font-size:12px;">${s.totalRows}</div>
                </div>
                <div style="background:rgba(255,255,255,0.02); padding:6px; border-radius:4px;">
                    <div style="color:var(--muted); text-transform:uppercase; letter-spacing:0.5px; font-size:9px; margin-bottom:2px;">Nulls</div>
                    <div style="color:var(--text); font-weight:600; font-size:12px;">${s.nullPercent}%</div>
                </div>
                <div style="background:rgba(255,255,255,0.02); padding:6px; border-radius:4px;">
                    <div style="color:var(--muted); text-transform:uppercase; letter-spacing:0.5px; font-size:9px; margin-bottom:2px;">Unique</div>
                    <div style="color:var(--text); font-weight:600; font-size:12px;">${s.uniquePercent}%</div>
                </div>
                <div style="background:rgba(255,255,255,0.02); padding:6px; border-radius:4px;">
                    <div style="color:var(--muted); text-transform:uppercase; letter-spacing:0.5px; font-size:9px; margin-bottom:2px;">Types</div>
                    <div style="color:var(--text); font-weight:600; font-size:12px;">${Object.keys(s.types).length}</div>
                </div>
            </div>
            <div style="padding-top:6px; border-top:1px solid rgba(255,255,255,0.1);">
                <div style="font-size:10px; color:var(--muted); margin-bottom:4px; text-transform:uppercase; letter-spacing:0.5px;">🎨 Type Distribution:</div>
                <div style="display:flex; flex-wrap:wrap; gap:4px;">
                    ${Object.entries(s.types).map(([t, c]) => `<span style="background:var(--accent)15; padding:3px 6px; border-radius:3px; font-size:10px; color:var(--accent); border:1px solid var(--accent)30;">${t}: <b>${c}</b></span>`).join('')}
                </div>
            </div>
        </div>
    `).join('');
}

/**
 * HTML Escape Helper
 */
function escH(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
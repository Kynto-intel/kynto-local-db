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
    if (!btnMain) return;
    btnMain.classList.toggle('active', state.magicEyeActive);
    console.log('[visualizer] Button synced, magicEyeActive:', state.magicEyeActive);
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
        .magic-eye-container { display: inline-flex; gap: 4px; margin-left: 8px; align-items: center; }
        .dropdown-menu { 
            position: absolute; top: 100%; right: 0; background: var(--surface2); 
            border: 1px solid var(--border); border-radius: 4px; z-index: 1000;
            display: none; min-width: 180px; box-shadow: 0 8px 16px rgba(0,0,0,0.4); padding: 4px 0;
        }
        .dropdown-menu.show { display: block; animation: slideDown 0.15s ease-out; }
        @keyframes slideDown { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
        .dropdown-menu div { padding: 8px 12px; cursor: pointer; font-size: 11px; color: var(--text); transition: all 0.1s; }
        .dropdown-menu div:hover { background: var(--accent); color: #18181b; transform: translateX(2px); }
        #btn-magic-eye.active { background: var(--accent); color: #18181b; box-shadow: 0 0 10px rgba(194, 154, 64, 0.3); }
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
        <button class="btn" id="btn-magic-eye" title="Typ-Highlighting umschalten">
            👁️ <span id="magic-eye-label">Typ-Highlighting</span>
        </button>
        <button class="btn" id="btn-col-stats" title="Column Statistiken anzeigen" style="padding:0 8px;">
            📊
        </button>
        <button class="btn" id="btn-magic-cfg" style="padding:0 6px; border-left: 1px solid rgba(255,255,255,0.1);">▾</button>
        <div id="magic-menu" class="dropdown-menu">
            <div data-mode="type">🎨 Typ-Highlighting</div>
            <div data-mode="heatmap">🔥 Heatmap (Zahlen)</div>
            <div data-mode="validation">🚫 Validierung (Qualität)</div>
            <div style="border-top:1px solid var(--border); margin:4px 0;"></div>
            <div id="toggle-analysis" style="background:rgba(255,255,255,0.05); padding:8px 12px; cursor: pointer; font-size:11px;">📈 Analysen **ON**</div>
        </div>
        <div id="column-stats-panel" style="display:none; position:fixed; max-width:400px; background:var(--surface2); border:1px solid var(--border); border-radius:8px; padding:12px; z-index:1001; max-height:500px; overflow-y:auto;">
            <h4 style="margin:0 0 8px 0; font-size:12px; color:var(--accent);">📊 Column Statistics</h4>
            <div id="stats-content" style="font-size:11px;"></div>
        </div>
    `;

    const exportBtns = document.getElementById('export-btns');
    if (exportBtns) {
        exportBtns.style.display = 'flex';
        exportBtns.appendChild(container);
    }

    // Event Listener
    const btnMain = container.querySelector('#btn-magic-eye');
    const btnStats = container.querySelector('#btn-col-stats');
    const btnCfg = container.querySelector('#btn-magic-cfg');
    const menu = container.querySelector('#magic-menu');
    const statsPanel = container.querySelector('#column-stats-panel');
    const label = container.querySelector('#magic-eye-label');

    btnMain.addEventListener('click', () => {
        state.magicEyeActive = !state.magicEyeActive;
        btnMain.classList.toggle('active', state.magicEyeActive);
        _refreshTable();
    });

    btnStats.addEventListener('click', (e) => {
        e.stopPropagation();
        statsPanel.style.display = statsPanel.style.display === 'none' ? 'block' : 'none';
        const rect = btnStats.getBoundingClientRect();
        statsPanel.style.top = (rect.bottom + 4) + 'px';
        statsPanel.style.right = (window.innerWidth - rect.right) + 'px';
        
        if (statsPanel.style.display === 'block' && state.currentCols) {
            updateColumnStats(state.currentCols, container);
        }
    });

    btnCfg.addEventListener('click', (e) => {
        e.stopPropagation();
        menu.classList.toggle('show');
    });

    menu.querySelectorAll('div').forEach(div => {
        if (div.dataset.mode) {
            div.addEventListener('click', () => {
                state.magicMode = div.dataset.mode;
                label.textContent = div.textContent.trim();
                menu.classList.remove('show');
                if (state.magicEyeActive) _refreshTable();
            });
        }
        if (div.id === 'toggle-analysis') {
            div.addEventListener('click', () => {
                state.visualizerAnalysis = !state.visualizerAnalysis;
                div.textContent = `📈 Analysen ${state.visualizerAnalysis ? '**ON**' : '**OFF**'}`;
            });
        }
    });

    document.addEventListener('click', () => {
        menu.classList.remove('show');
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

    const qualityColor = (score) => score > 80 ? '#a3be8c' : score > 60 ? '#ebcb8b' : '#bf616a';

    statsContent.innerHTML = stats.map(s => `
        <div style="background: var(--surface1); padding: 8px; border-radius: 4px; margin-bottom: 6px; border-left: 3px solid ${qualityColor(s.qualityScore)};">
            <div style="font-weight:bold; color:var(--accent); display:flex; justify-content:space-between;">
                <span>${escH(s.name)}</span>
                <span style="background:${qualityColor(s.qualityScore)}33; padding:2px 6px; border-radius:3px; font-size:10px;">${s.qualityScore}%</span>
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; margin-top:6px; font-size:10px;">
                <div><span style="color:#888; text-transform:uppercase; letter-spacing:0.5px; font-size:9px;">Rows</span><div style="color:var(--accent); font-weight:600;">${s.totalRows}</div></div>
                <div><span style="color:#888; text-transform:uppercase; letter-spacing:0.5px; font-size:9px;">Nulls</span><div style="color:var(--accent); font-weight:600;">${s.nullPercent}%</div></div>
                <div><span style="color:#888; text-transform:uppercase; letter-spacing:0.5px; font-size:9px;">Unique</span><div style="color:var(--accent); font-weight:600;">${s.uniquePercent}%</div></div>
                <div><span style="color:#888; text-transform:uppercase; letter-spacing:0.5px; font-size:9px;">Types</span><div style="color:var(--accent); font-weight:600;">${Object.keys(s.types).length}</div></div>
            </div>
            <div style="margin-top:6px; padding-top:6px; border-top:1px solid rgba(255,255,255,0.1);">
                <div style="font-size:9px; color:#888; margin-bottom:3px;">🎯 Type Distribution:</div>
                <div style="display:flex; flex-wrap:wrap; gap:3px;">
                    ${Object.entries(s.types).map(([t, c]) => `<span style="background:rgba(255,255,255,0.08); padding:2px 4px; border-radius:2px; font-size:9px;">${t}:${c}</span>`).join('')}
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
/* ── modules/views/chart/ChartManager.js ────────────────────────────────────────
   Chart-View Management mit Chart.js Integration
   ────────────────────────────────────────────────────────────────────────── */

import { state } from '../../state.js';

export function renderChartView() {
    console.log('[renderChartView] state.lastData:', state.lastData);
    const cv = document.getElementById('result-chart-view');
    if (!cv) {
        console.error('[renderChartView] result-chart-view element not found');
        return;
    }
    
    if (!state.lastData || !state.lastData.length) {
        console.log('[renderChartView] No data available, showing empty state');
        cv.innerHTML = '<div class="empty-state"><div class="icon">📈</div><div>Zuerst eine Abfrage ausführen.</div></div>';
        return;
    }
    
    console.log('[renderChartView] Creating chart controls with data:', state.lastData.length, 'rows');
    const cols    = state.currentCols.length ? state.currentCols : Object.keys(state.lastData[0]);
    const numCols = cols.filter(c => state.lastData.some(r => !isNaN(Number(r[c]))));
    const defY    = numCols[0] || cols[1] || cols[0];

    cv.innerHTML = `
        <div class="chart-controls">
            <span style="font-size:11px;color:var(--muted)">Typ:</span>
            <select id="c-type">
                <option value="bar">Balken</option>
                <option value="line">Linie</option>
                <option value="pie">Torte</option>
                <option value="scatter">Streuung</option>
            </select>
            <span style="font-size:11px;color:var(--muted)">X:</span>
            <select id="c-x">${cols.map(c => `<option value="${c}">${c}</option>`).join('')}</select>
            <span style="font-size:11px;color:var(--muted)">Y:</span>
            <select id="c-y">${cols.map(c => `<option value="${c}"${c === defY ? ' selected' : ''}>${c}</option>`).join('')}</select>
            <button class="btn-primary" id="c-render" style="padding:5px 14px">📈 Rendern</button>
        </div>
        <div class="chart-canvas-wrap"><canvas id="kynto-chart"></canvas></div>`;

    const renderBtn = document.getElementById('c-render');
    if (renderBtn) {
        renderBtn.addEventListener('click', buildChart);
    }
    
    console.log('[renderChartView] Chart initialized, calling buildChart');
    buildChart();
}

export function buildChart() {
    const typeEl = document.getElementById('c-type');
    const xEl    = document.getElementById('c-x');
    const yEl    = document.getElementById('c-y');
    const canvas = document.getElementById('kynto-chart');
    if (!typeEl || !xEl || !yEl || !canvas || typeof Chart === 'undefined') return;

    if (state.chartInst) { state.chartInst.destroy(); state.chartInst = null; }

    const type    = typeEl.value;
    const xCol    = xEl.value;
    const yCol    = yEl.value;
    const accent  = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#c29a40';
    const textClr = state.isDark ? '#e8e8ee' : '#18181b';
    const gridClr = state.isDark ? '#3a3a42' : '#d4d4d8';

    const labels = state.lastData.map(r => String(r[xCol] ?? ''));
    const vals   = state.lastData.map(r => Number(r[yCol]) || 0);

    state.chartInst = new Chart(canvas, {
        type: type === 'scatter' ? 'scatter' : type,
        data: {
            labels: type !== 'scatter' ? labels : undefined,
            datasets: [{
                label: yCol,
                data: type === 'scatter'
                    ? state.lastData.map(r => ({ x: Number(r[xCol]) || 0, y: Number(r[yCol]) || 0 }))
                    : vals,
                backgroundColor: accent + '99',
                borderColor:     accent,
                borderWidth:     2,
                fill:            false,
                pointRadius:     type === 'scatter' ? 5 : 3
            }]
        },
        options: {
            responsive:          true,
            maintainAspectRatio: false,
            plugins: { legend: { labels: { color: textClr } } },
            scales: type !== 'pie' ? {
                x: { ticks: { color: textClr }, grid: { color: gridClr } },
                y: { ticks: { color: textClr }, grid: { color: gridClr } }
            } : undefined
        }
    });
}

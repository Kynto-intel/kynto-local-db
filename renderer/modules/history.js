/* ── modules/history.js ───────────────────────────────────────────────
   SQL-Verlauf und Favoriten — beide ähnlich aufgebaut und daher hier
   zusammengefasst.
   ──────────────────────────────────────────────────────────────────── */

import { state }              from './state.js';
import { uid, escH, setStatus, setEditorVal } from './utils.js';

// ── Verlauf ────────────────────────────────────────────────────────────

export async function loadHistory() {
    state.history = await window.api.loadHistory().catch(() => []);
    renderHistory();
}

export async function saveHistory() {
    await window.api.saveHistory(state.history).catch(() => {});
}

export function addToHistory(sql) {
    if (!sql.trim() || state.history[0] === sql.trim()) return;
    state.history.unshift(sql.trim());
    if (state.history.length > 50) state.history.length = 50;
    saveHistory();
    renderHistory();
}

export function renderHistory() {
    const el = document.getElementById('sql-history');
    el.innerHTML = state.history.length
        ? state.history.map((s, i) => `
            <div class="hist-item" data-i="${i}" title="${escH(s)}">
                <code>${escH(s)}</code>
            </div>`).join('')
        : '<div class="empty-list">Kein Verlauf.</div>';

    el.querySelectorAll('.hist-item').forEach(item =>
        item.addEventListener('click', () => {
            // Optimierung 1: Visuelles Feedback beim Laden
            item.classList.remove('item-load-flash');
            void item.offsetWidth; // Trigger reflow für Animation-Restart
            item.classList.add('item-load-flash');

            setEditorVal(state, state.history[+item.dataset.i]);
            setStatus('Befehl aus Verlauf geladen.');
        }));
}

export function initHistoryControls() {
    document.getElementById('btn-clear-history').addEventListener('click', async () => {
        if (!confirm('Verlauf löschen?')) return;
        state.history = [];
        await saveHistory();
        renderHistory();
    });
}

// ── Favoriten ──────────────────────────────────────────────────────────

export async function loadFavorites() {
    state.favorites = await window.api.loadFavorites().catch(() => []);
    renderFavorites();
}

export async function saveFavorites() {
    await window.api.saveFavorites(state.favorites).catch(() => {});
}

export function renderFavorites() {
    const el    = document.getElementById('fav-list');
    const badge = document.getElementById('fav-count');
    badge.textContent = state.favorites.length;

    el.innerHTML = state.favorites.length
        ? state.favorites.map((f, i) => `
            <div class="fav-item">
                <span class="fav-name" data-i="${i}" title="${escH(f.sql)}">⭐ ${escH(f.name)}</span>
                <span class="fav-del"  data-i="${i}" title="Löschen">🗑️</span>
            </div>`).join('')
        : '<div class="empty-list">Noch keine Favoriten.</div>';

    el.querySelectorAll('.fav-name').forEach(item =>
        item.addEventListener('click', () => {
            // Optimierung 1: Feedback auf das Container-Element anwenden
            const parent = item.closest('.fav-item');
            if (parent) {
                parent.classList.remove('item-load-flash');
                void parent.offsetWidth;
                parent.classList.add('item-load-flash');
            }

            setEditorVal(state, state.favorites[+item.dataset.i].sql);
            setStatus(`Favorit "${state.favorites[+item.dataset.i].name}" geladen.`);
        }));
    el.querySelectorAll('.fav-del').forEach(item =>
        item.addEventListener('click', async () => {
            state.favorites.splice(+item.dataset.i, 1);
            await saveFavorites();
            renderFavorites();
        }));
}

export function initFavoriteControls() {
    const modal    = document.getElementById('fav-modal');
    const nameInp  = document.getElementById('fav-name-input');

    document.getElementById('btn-save-fav').addEventListener('click', () => {
        nameInp.value = '';
        modal.classList.add('open');
        setTimeout(() => nameInp.focus(), 50);
    });
    document.getElementById('fav-cancel').addEventListener('click', () =>
        modal.classList.remove('open'));

    const confirm = async () => {
        const name = nameInp.value.trim();
        if (!name) return;
        const { getEditorVal: gev } = await import('./utils.js');
        state.favorites.push({ id: uid(), name, sql: gev(state).trim() });
        await saveFavorites();
        renderFavorites();
        modal.classList.remove('open');
        setStatus(`Favorit "${name}" gespeichert.`, 'success');
    };
    document.getElementById('fav-confirm').addEventListener('click', confirm);
    nameInp.addEventListener('keydown', e => {
        if (e.key === 'Enter')  confirm();
        if (e.key === 'Escape') modal.classList.remove('open');
    });
}
/* ── renderer/modules/sidebar/search.js ────────────────────────────────
   Sidebar Search: Filtert Tabellen und Datenbanken in der Seitenleiste.
   ──────────────────────────────────────────────────────────────────── */

/**
 * Initialisiert die Suchleiste in der Sidebar.
 */
export function initSidebarSearch() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;

    // 1. Container für die Suche finden oder erstellen
    let searchWrap = document.getElementById('sidebar-search-wrap');
    if (!searchWrap) {
        searchWrap = document.createElement('div');
        searchWrap.id = 'sidebar-search-wrap';
        searchWrap.className = 'sb-search-container';
        
        // Styles direkt injizieren für Unabhängigkeit
        if (!document.getElementById('sidebar-search-styles')) {
            const style = document.createElement('style');
            style.id = 'sidebar-search-styles';
            style.textContent = `
                .sb-search-container {
                    padding: 8px 12px;
                    background: var(--surface);
                    border-bottom: 1px solid rgba(255,255,255,0.06);
                }
                .sb-search-input-wrap {
                    position: relative;
                    display: flex;
                    align-items: center;
                }
                #sidebar-search-input {
                    width: 100%;
                    background: var(--surface2, #27272c);
                    border: 1px solid rgba(255,255,255,0.08);
                    border-radius: 6px;
                    padding: 6px 10px 6px 30px;
                    color: var(--text);
                    font-size: 11px;
                    outline: none;
                    transition: border-color 0.2s, box-shadow 0.2s;
                }
                #sidebar-search-input:focus {
                    border-color: var(--accent, #c29a40);
                    box-shadow: 0 0 0 2px rgba(194, 154, 100, 0.1);
                }
                .sb-search-icon {
                    position: absolute;
                    left: 10px;
                    color: var(--muted);
                    pointer-events: none;
                    opacity: 0.7;
                }
                #sidebar-search-clear {
                    position: absolute;
                    right: 8px;
                    background: none;
                    border: none;
                    color: var(--muted);
                    cursor: pointer;
                    display: none;
                    font-size: 14px;
                    padding: 2px;
                    line-height: 1;
                }
                #sidebar-search-clear:hover {
                    color: var(--text);
                }
            `;
            document.head.appendChild(style);
        }

        searchWrap.innerHTML = `
            <div class="sb-search-input-wrap">
                <svg class="sb-search-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
                <input type="text" id="sidebar-search-input" placeholder="Suchen...">
                <button id="sidebar-search-clear" title="Suche löschen">✕</button>
            </div>
        `;

        // Die Suche über der Tabellenliste einfügen
        const tableList = document.getElementById('table-list');
        if (tableList) {
            tableList.parentNode.insertBefore(searchWrap, tableList);
        } else {
            sidebar.prepend(searchWrap);
        }
    }

    const input = document.getElementById('sidebar-search-input');
    const clearBtn = document.getElementById('sidebar-search-clear');

    const performFiltering = () => {
        const query = input.value.toLowerCase().trim();
        clearBtn.style.display = query ? 'block' : 'none';

        document.querySelectorAll('.table-item, .db-item').forEach(item => {
            const nameEl = item.querySelector('.table-name, .db-name');
            const name = nameEl?.dataset.name || nameEl?.textContent || item.textContent;
            item.style.display = name.toLowerCase().includes(query) ? 'flex' : 'none';
        });
    };

    input.addEventListener('input', performFiltering);
    clearBtn.addEventListener('click', () => { input.value = ''; performFiltering(); input.focus(); });

    const observer = new MutationObserver(() => { if (input.value.trim()) performFiltering(); });
    const list = document.getElementById('table-list') || document.getElementById('db-list');
    if (list) observer.observe(list, { childList: true });
}
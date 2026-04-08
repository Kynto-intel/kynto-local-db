/* ── tabs/handlers.js ──────────────────────────────────────────────────
   Event Handler für Tabelle Drag & Drop in Tab-Bar
   ──────────────────────────────────────────────────────────────────── */

export function setupTabBarDragDrop(tabBar) {
    if (!tabBar) return;

    // Styles für Drag-Over
    if (!document.getElementById('tabs-drag-styles')) {
        const style = document.createElement('style');
        style.id = 'tabs-drag-styles';
        style.textContent = `
            #sql-tabs-bar.drag-over {
                background: var(--accent-lo);
                outline: 2px dashed var(--accent);
                outline-offset: -4px;
            }
        `;
        document.head.appendChild(style);
    }

    // Drag Over - Tabellen aus Sidebar
    tabBar.addEventListener('dragover', (e) => {
        if (e.dataTransfer.types.includes('application/kynto-table')) {
            e.preventDefault();
            tabBar.classList.add('drag-over');
        }
    });

    // Drag Leave
    tabBar.addEventListener('dragleave', () => {
        tabBar.classList.remove('drag-over');
    });

    // Drop - Neue Tab mit Tabellennamen
    tabBar.addEventListener('drop', (e) => {
        tabBar.classList.remove('drag-over');
        const tableName = e.dataTransfer.getData('application/kynto-table');
        if (tableName) {
            e.preventDefault();
            if (window.onTableDropInTabs) {
                window.onTableDropInTabs(tableName);
            }
        }
    });
}

export function setupTabEventHandlers(tabBar) {
    setupTabBarDragDrop(tabBar);
}

export function setOnTableDropCallback(callback) {
    window.onTableDropInTabs = callback;
}

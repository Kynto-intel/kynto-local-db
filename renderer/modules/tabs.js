/* ── modules/tabs.js ────────────────────────────────────────────────
   Public API Wrapper für das modulare Tab System
   Re-exports aus ./tabs/index.js
   ──────────────────────────────────────────────────────────────────── */

export {
    newTab,
    renderTabs,
    activateTab,
    closeTab,
    setTabActivateCallback,
    initTabsDragAndDrop,
    updateTabTitle,
    getActiveTab,
    getTabs,
    tabManager,
    tabRenderer
} from './tabs/index.js';
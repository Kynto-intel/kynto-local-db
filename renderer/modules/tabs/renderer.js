/* ── tabs/renderer.js ──────────────────────────────────────────────────
   Native DOM Rendering + Drag & Drop (kein electron-tabs)
   ──────────────────────────────────────────────────────────────────── */

import { tabManager } from './manager.js';
import { setupTabEventHandlers } from './handlers.js';

let tabBar = null;
let draggedTab = null;

export const tabRenderer = {
    init() {
        tabBar = document.getElementById('sql-tabs-bar');
        if (!tabBar) return;
        
        // Setup Drag & Drop für Tabellen nur EINMAL
        setupTabEventHandlers(tabBar);
        
        // Tab Event Delegation (registriert nur EINMAL)
        tabBar.addEventListener('click', (e) => {
            const tab = e.target.closest('.sql-tab');
            const closeBtn = e.target.closest('.tab-close');
            const newBtn = e.target.closest('#btn-new-tab');
            
            if (closeBtn) {
                e.stopPropagation();
                const id = closeBtn.dataset.tabId;
                tabManager.closeTab(id);
                this.render();
            } else if (tab && !closeBtn) {
                const id = tab.dataset.tabId;
                tabManager.activateTab(id);
                this.render();
            } else if (newBtn) {
                tabManager.createTab();
                this.render();
            }
        });

        // Tab Drag & Drop Delegation
        tabBar.addEventListener('dragstart', (e) => {
            const tab = e.target.closest('.sql-tab');
            if (tab) {
                draggedTab = tab;
                e.dataTransfer.effectAllowed = 'move';
                tab.classList.add('dragging');
            }
        });

        tabBar.addEventListener('dragend', (e) => {
            const tab = e.target.closest('.sql-tab');
            if (tab) {
                tab.classList.remove('dragging');
                draggedTab = null;
            }
        });

        tabBar.addEventListener('dragover', (e) => {
            const tab = e.target.closest('.sql-tab');
            if (tab && draggedTab && draggedTab !== tab) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                
                const draggedIdx = parseInt(draggedTab.dataset.tabIndex);
                const targetIdx = parseInt(tab.dataset.tabIndex);
                
                if (draggedIdx < targetIdx) {
                    tab.parentNode.insertBefore(draggedTab, tab.nextSibling);
                } else {
                    tab.parentNode.insertBefore(draggedTab, tab);
                }
            }
        });

        tabBar.addEventListener('drop', (e) => {
            const tab = e.target.closest('.sql-tab');
            if (tab && draggedTab && draggedTab !== tab) {
                e.preventDefault();
                e.stopPropagation();
                
                const fromIdx = parseInt(draggedTab.dataset.tabIndex);
                const toIdx = parseInt(tab.dataset.tabIndex);
                
                if (fromIdx !== toIdx) {
                    tabManager.reorderTabs(fromIdx, toIdx);
                    this.render();
                }
            }
        });
        
        this.render();
    },

    render() {
        if (!tabBar) return;

        const tabs = tabManager.getTabs();
        const activeId = tabManager.activeTabId;

        // Tabs rendern
        let html = '';
        tabs.forEach((tab, idx) => {
            const isActive = tab.id === activeId;
            html += `
                <div class="sql-tab ${isActive ? 'active' : ''}" 
                     data-tab-id="${tab.id}" 
                     data-tab-index="${idx}"
                     draggable="true"
                     title="${tab.title}">
                    <span class="tab-title">${this.escapeHtml(tab.title)}</span>
                    <button class="tab-close" data-tab-id="${tab.id}">×</button>
                </div>
            `;
        });

        // New Tab Button
        html += '<button id="btn-new-tab" class="btn-new-tab" title="Neuer Tab">+</button>';

        tabBar.innerHTML = html;

        // New Tab Button Handler
        const newTabBtn = document.getElementById('btn-new-tab');
        if (newTabBtn) {
            newTabBtn.addEventListener('click', () => {
                tabManager.createTab();
                this.render();
            });
        }
    },

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    updateTabTitle(id, newTitle) {
        const tab = tabManager.getTab(id);
        if (tab) {
            tab.title = newTitle;
            this.render();
        }
    },

    switchTab(id) {
        tabManager.activateTab(id);
        this.render();
    }
};

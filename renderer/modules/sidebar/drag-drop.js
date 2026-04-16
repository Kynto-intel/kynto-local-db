/* ── sidebar/drag-drop.js ──────────────────────────────────────────
   Drag & Drop Funktionalität für die Tabellenliste
   ──────────────────────────────────────────────────────────────── */

import { saveTableOrder } from './persistence.js';

/**
 * Initialisiert Drag & Drop Funktionalität für die Tabellenliste
 */
export function initTableDragAndDrop(container) {
    let draggedItem = null;

    // Hilfsfunktion: Findet das Element, vor dem eingefügt werden soll
    const getDragAfterElement = (y) => {
        const draggableElements = [...container.querySelectorAll('.table-item:not(.dragging)')];
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - (box.top + box.height / 2);
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    };

    container.addEventListener('dragover', (e) => {
        e.preventDefault();
        const afterElement = getDragAfterElement(e.clientY);
        if (draggedItem) {
            if (!afterElement) {
                // Wir sind im leeren Raum unter der Liste
                const lastItem = container.querySelector('.table-item:not(.dragging):last-of-type');
                const lastRect = lastItem ? lastItem.getBoundingClientRect() : null;

                // Wenn wir deutlich (mehr als 30px) unter der letzten Tabelle sind -> Bottom Zone
                if (lastRect && e.clientY > lastRect.bottom + 30) {
                    draggedItem.classList.add('is-bottom');
                } else if (!lastRect) {
                    draggedItem.classList.add('is-bottom');
                }
                container.appendChild(draggedItem);
            } else {
                // Wir schieben zwischen Tabellen
                if (afterElement.classList.contains('is-bottom')) draggedItem.classList.add('is-bottom');
                else draggedItem.classList.remove('is-bottom');
                container.insertBefore(draggedItem, afterElement);
            }
        }
    });

    container.querySelectorAll('.table-item').forEach(item => {
        item.addEventListener('dragstart', (e) => {
            const name = item.dataset.name;
            e.dataTransfer.setData('application/kynto-table', name);
            draggedItem = item;
            setTimeout(() => item.classList.add('dragging'), 0);
            e.dataTransfer.effectAllowed = 'copyMove';
        });

        item.addEventListener('dragend', () => {
            draggedItem.classList.remove('dragging');
            draggedItem = null;
            container.querySelectorAll('.table-item').forEach(el => el.classList.remove('drag-over'));
            saveTableOrder();
        });
    });
}

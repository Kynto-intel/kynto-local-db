/* ── src/main/config/policies.js ──────────────────────────────────────
   Logik für das Sicherheitsrichtlinien-Dashboard (RLS).
   Steuert Dropdowns, Suche und einfache Button-Aktionen.
   ──────────────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
    // --- State Management ---
    let currentSchema = 'public';
    const schemaMenu = document.getElementById('schemaMenu');
    const mainSearchInput = document.querySelector('.main-search');
    const innerSearchInput = document.querySelector('.search-container-inner input');
    const schemaItems = document.querySelectorAll('.schema-item');
    const clearSearchBtn = document.querySelector('.search-clear-right');

    // --- Dropdown Logik ---
    const schemaTrigger = document.querySelector('[data-action="toggle-schema"]') || document.querySelector('.schema-trigger');
    
    window.toggleDropdown = () => {
        const isOpen = schemaMenu.style.display === 'block';
        schemaMenu.style.display = isOpen ? 'none' : 'block';
        if (!isOpen) innerSearchInput.focus();
    };
    
    // Event-Listener für Schema-Trigger (CSP-konform, kein inline onclick)
    if (schemaTrigger) {
        schemaTrigger.addEventListener('click', window.toggleDropdown);
    }

    // Schließen bei Klick außerhalb
    window.addEventListener('click', (e) => {
        if (!e.target.closest('.dropdown-container')) {
            schemaMenu.style.display = 'none';
        }
    });

    // --- Schema Auswahl ---
    schemaItems.forEach(item => {
        item.addEventListener('click', () => {
            // UI Update: Aktive Klasse verschieben
            schemaItems.forEach(i => {
                i.classList.remove('active');
                const check = i.querySelector('.check-icon');
                if (check) check.remove();
            });

            item.classList.add('active');
            item.innerHTML += ' <span class="check-icon">✓</span>';
            
            // Logik Update
            currentSchema = item.textContent.replace('✓', '').trim();
            schemaTrigger.textContent = currentSchema;
            schemaMenu.style.display = 'none';
            
            console.log(`Schema gewechselt zu: ${currentSchema}`);
            // Hier könntest du eine API-Funktion aufrufen: fetchTables(currentSchema);
        });
    });

    // --- Suche innerhalb des Dropdowns (Schemas filtern) ---
    innerSearchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        schemaItems.forEach(item => {
            const text = item.textContent.toLowerCase();
            item.style.display = text.includes(term) ? 'flex' : 'none';
        });
    });

    // --- Hauptsuche (Tabellen filtern) ---
    mainSearchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const tableCards = document.querySelectorAll('.card');
        
        tableCards.forEach(card => {
            const tableName = card.querySelector('.table-info').textContent.toLowerCase();
            card.style.display = tableName.includes(term) ? 'block' : 'none';
        });

        // X-Button anzeigen/verstecken
        clearSearchBtn.style.display = term.length > 0 ? 'flex' : 'none';
    });

    // Suche löschen
    clearSearchBtn.addEventListener('click', () => {
        mainSearchInput.value = '';
        mainSearchInput.dispatchEvent(new Event('input'));
        mainSearchInput.focus();
    });

    // --- Button Aktionen ---
    document.querySelector('.btn-primary').addEventListener('click', () => {
        alert('Öffne Policy-Editor für Tabelle: ' + document.querySelector('.table-info').textContent.trim());
    });

    document.querySelector('.btn-danger').addEventListener('click', () => {
        const confirmDisable = confirm('Möchten Sie RLS wirklich deaktivieren? Dies könnte Ihre Daten öffentlich machen.');
        if (confirmDisable) {
            console.log('RLS wird deaktiviert...');
        }
    });
});
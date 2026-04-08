/* ── action-buttons/README.md ────────────────────────────────────────
   Action-Buttons Modul - Modulare Button-Handler für Action-Bar
   ──────────────────────────────────────────────────────────────────── */

# Action-Buttons Modul

Dieses Modul enthält die komplette Logik für alle Action-Bar Buttons, aufgeteilt in separate, wartbare Dateien.

## Struktur

```
action-buttons/
├── index.js                           # Koordinator - orchestriert all Button Handler
├── sql-definition.js                  # Button: SQL-Definition Toggle
├── rls-toggle.js                      # Button: RLS (Row Level Security) Toggle
├── view-security.js                   # Button: View Security Warning / Security Invoker
├── index-advisor.js                   # Button: Index Advisor / Indexberater
├── add-row.js                         # Button: Add Row (Zeile hinzufügen)
├── add-column.js                      # Button: Add Column (Spalte hinzufügen)
├── realtime-toggle.js                 # Button: Realtime Sync Toggle
├── refresh.js                         # Button: Refresh / Aktualisieren
├── data-check.js                      # Button: Data Check (Datentyp-Validierung)
└── dialogs/                           # Subfolder für Modal-Dialoge
    ├── add-column-dialog.js           # Modal für Spalten-Hinzufügen (Electron-kompatibel)
    └── analysis-modal.js              # [placeholder für später]
```

## Button-Handler Pattern

Jeder Button-Handler folgt diesem Pattern:

```javascript
// file: button-name.js
import { state } from '../state.js';
import { setStatus } from '../utils.js';

export function setupButtonNameButton(btn, isProtected) {
    // Styling und Icon
    btn.innerHTML = `emoji Text`;
    btn.style.color = '#ffffff';
    
    // Event Listener
    btn.addEventListener('click', () => {
        // Logik hier
    });
}
```

### Parameter

- `btn` - Die Button-Element DOM node
- `isProtected` - Boolean ob das Schema geschützt ist (optional)

## Integration in action-bar.js

Die ursprüngliche `action-bar.js` ist jetzt ein einfacher Proxy:

```javascript
// renderers/modules/action-bar.js
export { initActionBar, default } from './action-buttons/index.js';
```

Der Koordinator `action-buttons/index.js` importiert alle Handler und ruft sie auf:

```javascript
import { setupSqlDefinitionButton } from './sql-definition.js';
import { setupRlsToggleButton } from './rls-toggle.js';
// ... alle 9 Button-Handler

export function initActionBar() {
    // ... Button-Definitionen
    const buttons = [
        { id: 'btn-tge-def', handler: setupSqlDefinitionButton },
        // ... weitere Buttons
    ];
    
    buttons.forEach(b => {
        const btn = createButton(b.id);
        b.handler(btn, isProtected); // Handler aufrufen
        container.appendChild(btn);
    });
}
```

## Hinzufügen eines neuen Buttons

1. **Neue Handler-Datei erstellen:** `button-name.js`
   ```javascript
   export function setupButtonNameButton(btn, isProtected) {
       // Implementation
   }
   ```

2. **In `index.js` importieren:**
   ```javascript
   import { setupButtonNameButton } from './button-name.js';
   ```

3. **In Button-Array eintragen:**
   ```javascript
   const buttons = [
       // ...
       { id: 'btn-new', text: 'Text', visible: true, handler: setupButtonNameButton },
   ];
   ```

## Button-Liste

| Button ID | Datei | Funktion |
|-----------|-------|----------|
| btn-tge-def | sql-definition.js | Wechsel zwischen SQL-Definition und Daten-View |
| btn-rls-toggle | rls-toggle.js | Toggle Row Level Security |
| btn-view-security | view-security.js | Sicherheits-Status für Views anzeigen |
| btn-idx-guide | index-advisor.js | Index-Advisor / Query-Optimierung |
| btn-add-row | add-row.js | Neue Zeile zur Tabelle hinzufügen |
| btn-add-col | add-column.js | Neue Spalte zur Tabelle hinzufügen (Modal Dialog) |
| btn-realtime | realtime-toggle.js | Echtzeit-Synchronisierung Toggle |
| btn-refresh | refresh.js | Abfrage aktualisieren (mit Spinner Animation) |
| btn-data-check | data-check.js | Daten auf Typ-Fehler prüfen und markieren |

## Debugging

Die Handler verwenden `console.log()` für Debugging:

1. **Öffne Developer Tools:** `F12`
2. **Gehe zum Tab „Console"**
3. **Klicke auf verschiedene Buttons**
4. **Logs zeigen detaillierte Ausgaben:**
   - `✅` = Erfolgreich
   - `🚫` = Invalid state
   - `❌` = Error
   - `ℹ️` = Info
   - `📝`, `🔄`, `🔍` = Action-spezifisch

## Dialog-Komponenten

### Add Column Dialog (`dialogs/add-column-dialog.js`)

Modal-Dialog für Spalten-Hinzufügen (Electron-kompatibel, kein prompt()):

```javascript
import { showAddColumnDialog } from './dialogs/add-column-dialog.js';

showAddColumnDialog(tableName, schema, (colName, colType) => {
    console.log(`Neue Spalte: ${colName} (${colType})`);
    // DB Operation hier
});
```

## Zukünftige Verbesserungen

- [ ] Analysis-Modal für detaillierte Query-Pläne
- [ ] Index-Empfehlungs-Anwendung
- [ ] RLS-Policy Editor Modal
- [ ] Realtime-Sync Status-Anzeige
- [ ] Erweiterte Datentyp-Validierung

## Abhängigkeiten

- `state.js` - Zentrale Zustand-Management
- `utils.js` - Utility-Funktionen (setStatus, esc, etc.)
- `executor.js` - SQL-Ausführung
- `TableGridEditor/index.js` - Grid-Renderer
- `DataFormatter.js` - Datenformat-Utilities
- `Query/index-advisor.utils.js` - Index-Advisor Utils

---

**Letztes Update:** 1. April 2026  
**Zweck:** Modulare, wartbare Button-Handler-Logik

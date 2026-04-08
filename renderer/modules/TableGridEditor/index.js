/* ── TableGridEditor/index.js ──────────────────────────────────────────────
   Zentraler Einstiegspunkt für das TableGridEditor-Modul.
   Importiere alles was du brauchst aus diesem einen File.

   Verwendung in anderen Modulen:
     import { TableGridEditor } from './TableGridEditor/index.js';
     import { formatTableRowsToSQL } from './TableGridEditor/index.js';
     import { confirmDeleteTable } from './TableGridEditor/index.js';
   ────────────────────────────────────────────────────────────────────────── */

// Haupt-Orchestrator
export { TableGridEditor }    from './TableGridEditor.js';

// Utility-Funktionen
export {
    formatTableRowsToSQL,
    getEntityLintDetails,
    isTableLike,
    isView,
    isMaterializedView,
    isForeignTable,
    isViewLike,
    ENTITY_TYPE,
} from './TableEntity.utils.js';

// Bestätigungs-Dialoge (kann auch direkt verwendet werden)
export {
    confirmDeleteColumn,
    confirmDeleteTable,
    confirmDeleteRows,
} from './DeleteConfirmationDialogs.js';

// Header-Aktionsleiste
export { GridHeaderActions }  from './GridHeaderActions.js';

// SQL-Definitions-Ansicht
export { TableDefinition }    from './TableDefinition.js';

// View-Security-Autofix-Modal
export { openAutofixSecurityModal } from './ViewEntityAutofixSecurityModal.js';

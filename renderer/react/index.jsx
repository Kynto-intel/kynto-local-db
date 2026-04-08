// ── Global Dialog Manager ──────────────────────────────────────────────
// Nutze die globalen Komponenten die durch Webpack gebündelt werden
// (SpreadsheetImport & ForeignRowSelector werden als window.SpreadsheetImport & window.ForeignRowSelector exportiert)

window.DialogManager = {
  // Root einmal erstellen (singleton pattern)
  _root: null,
  _getRoot() {
    if (!this._root) {
      const container = document.getElementById('dialog-container');
      if (!container) {
        console.error('[DialogManager] ❌ #dialog-container nicht gefunden!');
        return null;
      }
      try {
        this._root = ReactDOM.createRoot(container);
        console.log('[DialogManager] ✓ ReactDOM.createRoot erstellt (singleton)');
      } catch (e) {
        console.error('[DialogManager] ❌ Fehler beim createRoot:', e);
        return null;
      }
    }
    return this._root;
  },

  // ── Spreadsheet Import State ──────────────────────────────────────────
  _spreadsheetImportVisible: false,
  _spreadsheetImportTable: null,
  _spreadsheetImportCallback: null,

  spreadsheetImportOpen(tableName = null, callback = () => {}) {
    this._spreadsheetImportVisible = true;
    this._spreadsheetImportTable = tableName;
    this._spreadsheetImportCallback = callback;
    console.log('[DialogManager] 📂 SpreadsheetImport öffnet für:', tableName);
    this._render();
  },

  spreadsheetImportClose() {
    this._spreadsheetImportVisible = false;
    console.log('[DialogManager] ✕ SpreadsheetImport geschlossen');
    this._render();
  },

  // ── Foreign Row Selector State ────────────────────────────────────────
  _foreignRowSelectorVisible: false,
  _foreignRowSelectorForeignKey: null,
  _foreignRowSelectorCallback: null,

  foreignRowSelectorOpen(foreignKey, callback = () => {}) {
    this._foreignRowSelectorVisible = true;
    this._foreignRowSelectorForeignKey = foreignKey;
    this._foreignRowSelectorCallback = callback;
    console.log('[DialogManager] 🔗 ForeignRowSelector öffnet für:', foreignKey.table);
    this._render();
  },

  foreignRowSelectorClose() {
    this._foreignRowSelectorVisible = false;
    console.log('[DialogManager] ✕ ForeignRowSelector geschlossen');
    this._render();
  },

  // ── Render Internal ───────────────────────────────────────────────────
  _render() {
    const root = this._getRoot();
    if (!root) {
      console.error('[DialogManager] ❌ Kein root verfügbar zum rendern');
      return;
    }

    try {
      // Komponenten sind global via window.SpreadsheetImport & window.ForeignRowSelector verfügbar
      // WICHTIG: Webpack exportiert mit library:"name" den default export im Objekt!
      let SpreadsheetImportComp = window.SpreadsheetImport;
      let ForeignRowSelectorComp = window.ForeignRowSelector;
      
      // Fallback für Webpack UMD: wenn es ein Module-Objekt ist, hole das default export
      if (SpreadsheetImportComp && SpreadsheetImportComp.__esModule) {
        SpreadsheetImportComp = SpreadsheetImportComp.default || SpreadsheetImportComp;
      }
      if (ForeignRowSelectorComp && ForeignRowSelectorComp.__esModule) {
        ForeignRowSelectorComp = ForeignRowSelectorComp.default || ForeignRowSelectorComp;
      }
      
      // Debug: Log die Komponenten-Type
      console.log('[DialogManager] SpreadsheetImportComp type:', typeof SpreadsheetImportComp, 'is function?', typeof SpreadsheetImportComp === 'function');
      
      if (!SpreadsheetImportComp) {
        console.error('[DialogManager] ❌ window.SpreadsheetImport nicht verfügbar!');
      }
      if (!ForeignRowSelectorComp) {
        console.error('[DialogManager] ❌ window.ForeignRowSelector nicht verfügbar!');
      }

      root.render(
        React.createElement(
          React.Fragment,
          null,
          this._spreadsheetImportVisible && SpreadsheetImportComp &&
            React.createElement(SpreadsheetImportComp, {
              visible: true,
              selectedTable: this._spreadsheetImportTable,
              onImport: () => {
                this._spreadsheetImportCallback?.();
                this.spreadsheetImportClose();
              },
              onClose: () => this.spreadsheetImportClose()
            }),
          this._foreignRowSelectorVisible && ForeignRowSelectorComp &&
            React.createElement(ForeignRowSelectorComp, {
              visible: true,
              foreignKey: this._foreignRowSelectorForeignKey,
              onSelect: (value) => {
                this._foreignRowSelectorCallback?.(value);
                this.foreignRowSelectorClose();
              },
              onClose: () => this.foreignRowSelectorClose()
            })
        )
      );
      console.log('[DialogManager] ✓ Render erfolgreich');
    } catch (e) {
      console.error('[DialogManager] ❌ Render Error:', e);
    }
  }
};

// ── Globale Aliases ───────────────────────────────────────────────────
window.ImportDialogManager = window.DialogManager;
window.showSpreadsheetImport = (tableName, cb) => window.DialogManager.spreadsheetImportOpen(tableName, cb);
window.showForeignRowSelector = (fk, cb) => window.DialogManager.foreignRowSelectorOpen(fk, cb);

// ── KEIN export - window.DialogManager wird direkt als global Object verwendet! ───
console.log('[DialogManager] ✓ SpreadsheetImport & ForeignRowSelector initialisiert');


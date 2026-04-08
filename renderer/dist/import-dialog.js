/******/ (() => { // webpackBootstrap
/*!**********************************!*\
  !*** ./renderer/react/index.jsx ***!
  \**********************************/
function _typeof(o) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, _typeof(o); }
// ── Global Dialog Manager ──────────────────────────────────────────────
// Nutze die globalen Komponenten die durch Webpack gebündelt werden
// (SpreadsheetImport & ForeignRowSelector werden als window.SpreadsheetImport & window.ForeignRowSelector exportiert)

window.DialogManager = {
  // Root einmal erstellen (singleton pattern)
  _root: null,
  _getRoot: function _getRoot() {
    if (!this._root) {
      var container = document.getElementById('dialog-container');
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
  spreadsheetImportOpen: function spreadsheetImportOpen() {
    var tableName = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : null;
    var callback = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : function () {};
    this._spreadsheetImportVisible = true;
    this._spreadsheetImportTable = tableName;
    this._spreadsheetImportCallback = callback;
    console.log('[DialogManager] 📂 SpreadsheetImport öffnet für:', tableName);
    this._render();
  },
  spreadsheetImportClose: function spreadsheetImportClose() {
    this._spreadsheetImportVisible = false;
    console.log('[DialogManager] ✕ SpreadsheetImport geschlossen');
    this._render();
  },
  // ── Foreign Row Selector State ────────────────────────────────────────
  _foreignRowSelectorVisible: false,
  _foreignRowSelectorForeignKey: null,
  _foreignRowSelectorCallback: null,
  foreignRowSelectorOpen: function foreignRowSelectorOpen(foreignKey) {
    var callback = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : function () {};
    this._foreignRowSelectorVisible = true;
    this._foreignRowSelectorForeignKey = foreignKey;
    this._foreignRowSelectorCallback = callback;
    console.log('[DialogManager] 🔗 ForeignRowSelector öffnet für:', foreignKey.table);
    this._render();
  },
  foreignRowSelectorClose: function foreignRowSelectorClose() {
    this._foreignRowSelectorVisible = false;
    console.log('[DialogManager] ✕ ForeignRowSelector geschlossen');
    this._render();
  },
  // ── Render Internal ───────────────────────────────────────────────────
  _render: function _render() {
    var _this = this;
    var root = this._getRoot();
    if (!root) {
      console.error('[DialogManager] ❌ Kein root verfügbar zum rendern');
      return;
    }
    try {
      // Komponenten sind global via window.SpreadsheetImport & window.ForeignRowSelector verfügbar
      // WICHTIG: Webpack exportiert mit library:"name" den default export im Objekt!
      var SpreadsheetImportComp = window.SpreadsheetImport;
      var ForeignRowSelectorComp = window.ForeignRowSelector;

      // Fallback für Webpack UMD: wenn es ein Module-Objekt ist, hole das default export
      if (SpreadsheetImportComp && SpreadsheetImportComp.__esModule) {
        SpreadsheetImportComp = SpreadsheetImportComp["default"] || SpreadsheetImportComp;
      }
      if (ForeignRowSelectorComp && ForeignRowSelectorComp.__esModule) {
        ForeignRowSelectorComp = ForeignRowSelectorComp["default"] || ForeignRowSelectorComp;
      }

      // Debug: Log die Komponenten-Type
      console.log('[DialogManager] SpreadsheetImportComp type:', _typeof(SpreadsheetImportComp), 'is function?', typeof SpreadsheetImportComp === 'function');
      if (!SpreadsheetImportComp) {
        console.error('[DialogManager] ❌ window.SpreadsheetImport nicht verfügbar!');
      }
      if (!ForeignRowSelectorComp) {
        console.error('[DialogManager] ❌ window.ForeignRowSelector nicht verfügbar!');
      }
      root.render(React.createElement(React.Fragment, null, this._spreadsheetImportVisible && SpreadsheetImportComp && React.createElement(SpreadsheetImportComp, {
        visible: true,
        selectedTable: this._spreadsheetImportTable,
        onImport: function onImport() {
          var _this$_spreadsheetImp;
          (_this$_spreadsheetImp = _this._spreadsheetImportCallback) === null || _this$_spreadsheetImp === void 0 || _this$_spreadsheetImp.call(_this);
          _this.spreadsheetImportClose();
        },
        onClose: function onClose() {
          return _this.spreadsheetImportClose();
        }
      }), this._foreignRowSelectorVisible && ForeignRowSelectorComp && React.createElement(ForeignRowSelectorComp, {
        visible: true,
        foreignKey: this._foreignRowSelectorForeignKey,
        onSelect: function onSelect(value) {
          var _this$_foreignRowSele;
          (_this$_foreignRowSele = _this._foreignRowSelectorCallback) === null || _this$_foreignRowSele === void 0 || _this$_foreignRowSele.call(_this, value);
          _this.foreignRowSelectorClose();
        },
        onClose: function onClose() {
          return _this.foreignRowSelectorClose();
        }
      })));
      console.log('[DialogManager] ✓ Render erfolgreich');
    } catch (e) {
      console.error('[DialogManager] ❌ Render Error:', e);
    }
  }
};

// ── Globale Aliases ───────────────────────────────────────────────────
window.ImportDialogManager = window.DialogManager;
window.showSpreadsheetImport = function (tableName, cb) {
  return window.DialogManager.spreadsheetImportOpen(tableName, cb);
};
window.showForeignRowSelector = function (fk, cb) {
  return window.DialogManager.foreignRowSelectorOpen(fk, cb);
};

// ── KEIN export - window.DialogManager wird direkt als global Object verwendet! ───
console.log('[DialogManager] ✓ SpreadsheetImport & ForeignRowSelector initialisiert');
/******/ })()
;
//# sourceMappingURL=import-dialog.js.map
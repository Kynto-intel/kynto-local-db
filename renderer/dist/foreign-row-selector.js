/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	// The require scope
/******/ 	var __webpack_require__ = {};
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
/*!***********************************************!*\
  !*** ./renderer/react/ForeignRowSelector.jsx ***!
  \***********************************************/
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
function _regenerator() { /*! regenerator-runtime -- Copyright (c) 2014-present, Facebook, Inc. -- license (MIT): https://github.com/babel/babel/blob/main/packages/babel-helpers/LICENSE */ var e, t, r = "function" == typeof Symbol ? Symbol : {}, n = r.iterator || "@@iterator", o = r.toStringTag || "@@toStringTag"; function i(r, n, o, i) { var c = n && n.prototype instanceof Generator ? n : Generator, u = Object.create(c.prototype); return _regeneratorDefine2(u, "_invoke", function (r, n, o) { var i, c, u, f = 0, p = o || [], y = !1, G = { p: 0, n: 0, v: e, a: d, f: d.bind(e, 4), d: function d(t, r) { return i = t, c = 0, u = e, G.n = r, a; } }; function d(r, n) { for (c = r, u = n, t = 0; !y && f && !o && t < p.length; t++) { var o, i = p[t], d = G.p, l = i[2]; r > 3 ? (o = l === n) && (u = i[(c = i[4]) ? 5 : (c = 3, 3)], i[4] = i[5] = e) : i[0] <= d && ((o = r < 2 && d < i[1]) ? (c = 0, G.v = n, G.n = i[1]) : d < l && (o = r < 3 || i[0] > n || n > l) && (i[4] = r, i[5] = n, G.n = l, c = 0)); } if (o || r > 1) return a; throw y = !0, n; } return function (o, p, l) { if (f > 1) throw TypeError("Generator is already running"); for (y && 1 === p && d(p, l), c = p, u = l; (t = c < 2 ? e : u) || !y;) { i || (c ? c < 3 ? (c > 1 && (G.n = -1), d(c, u)) : G.n = u : G.v = u); try { if (f = 2, i) { if (c || (o = "next"), t = i[o]) { if (!(t = t.call(i, u))) throw TypeError("iterator result is not an object"); if (!t.done) return t; u = t.value, c < 2 && (c = 0); } else 1 === c && (t = i["return"]) && t.call(i), c < 2 && (u = TypeError("The iterator does not provide a '" + o + "' method"), c = 1); i = e; } else if ((t = (y = G.n < 0) ? u : r.call(n, G)) !== a) break; } catch (t) { i = e, c = 1, u = t; } finally { f = 1; } } return { value: t, done: y }; }; }(r, o, i), !0), u; } var a = {}; function Generator() {} function GeneratorFunction() {} function GeneratorFunctionPrototype() {} t = Object.getPrototypeOf; var c = [][n] ? t(t([][n]())) : (_regeneratorDefine2(t = {}, n, function () { return this; }), t), u = GeneratorFunctionPrototype.prototype = Generator.prototype = Object.create(c); function f(e) { return Object.setPrototypeOf ? Object.setPrototypeOf(e, GeneratorFunctionPrototype) : (e.__proto__ = GeneratorFunctionPrototype, _regeneratorDefine2(e, o, "GeneratorFunction")), e.prototype = Object.create(u), e; } return GeneratorFunction.prototype = GeneratorFunctionPrototype, _regeneratorDefine2(u, "constructor", GeneratorFunctionPrototype), _regeneratorDefine2(GeneratorFunctionPrototype, "constructor", GeneratorFunction), GeneratorFunction.displayName = "GeneratorFunction", _regeneratorDefine2(GeneratorFunctionPrototype, o, "GeneratorFunction"), _regeneratorDefine2(u), _regeneratorDefine2(u, o, "Generator"), _regeneratorDefine2(u, n, function () { return this; }), _regeneratorDefine2(u, "toString", function () { return "[object Generator]"; }), (_regenerator = function _regenerator() { return { w: i, m: f }; })(); }
function _regeneratorDefine2(e, r, n, t) { var i = Object.defineProperty; try { i({}, "", {}); } catch (e) { i = 0; } _regeneratorDefine2 = function _regeneratorDefine(e, r, n, t) { function o(r, n) { _regeneratorDefine2(e, r, function (e) { return this._invoke(r, n, e); }); } r ? i ? i(e, r, { value: n, enumerable: !t, configurable: !t, writable: !t }) : e[r] = n : (o("next", 0), o("throw", 1), o("return", 2)); }, _regeneratorDefine2(e, r, n, t); }
function asyncGeneratorStep(n, t, e, r, o, a, c) { try { var i = n[a](c), u = i.value; } catch (n) { return void e(n); } i.done ? t(u) : Promise.resolve(u).then(r, o); }
function _asyncToGenerator(n) { return function () { var t = this, e = arguments; return new Promise(function (r, o) { var a = n.apply(t, e); function _next(n) { asyncGeneratorStep(a, r, o, _next, _throw, "next", n); } function _throw(n) { asyncGeneratorStep(a, r, o, _next, _throw, "throw", n); } _next(void 0); }); }; }
function _slicedToArray(r, e) { return _arrayWithHoles(r) || _iterableToArrayLimit(r, e) || _unsupportedIterableToArray(r, e) || _nonIterableRest(); }
function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function _unsupportedIterableToArray(r, a) { if (r) { if ("string" == typeof r) return _arrayLikeToArray(r, a); var t = {}.toString.call(r).slice(8, -1); return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? _arrayLikeToArray(r, a) : void 0; } }
function _arrayLikeToArray(r, a) { (null == a || a > r.length) && (a = r.length); for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e]; return n; }
function _iterableToArrayLimit(r, l) { var t = null == r ? null : "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (null != t) { var e, n, i, u, a = [], f = !0, o = !1; try { if (i = (t = t.call(r)).next, 0 === l) { if (Object(t) !== t) return; f = !1; } else for (; !(f = (e = i.call(t)).done) && (a.push(e.value), a.length !== l); f = !0); } catch (r) { o = !0, n = r; } finally { try { if (!f && null != t["return"] && (u = t["return"](), Object(u) !== u)) return; } finally { if (o) throw n; } } return a; } }
function _arrayWithHoles(r) { if (Array.isArray(r)) return r; }
/**
 * ForeignRowSelector - Vereinfachte React-Komponente für die Auswahl von Foreign Key Rows
 * Mit Pagination, Suche und Filterung
 */

var ForeignRowSelector = function ForeignRowSelector(_ref) {
  var _fkColumns$, _fkColumns$2;
  var _ref$visible = _ref.visible,
    visible = _ref$visible === void 0 ? false : _ref$visible,
    _ref$foreignKey = _ref.foreignKey,
    foreignKey = _ref$foreignKey === void 0 ? null : _ref$foreignKey,
    _ref$tableName = _ref.tableName,
    tableName = _ref$tableName === void 0 ? null : _ref$tableName,
    _ref$columnName = _ref.columnName,
    columnName = _ref$columnName === void 0 ? null : _ref$columnName,
    _ref$selectedValue = _ref.selectedValue,
    selectedValue = _ref$selectedValue === void 0 ? null : _ref$selectedValue,
    _ref$onSelect = _ref.onSelect,
    onSelect = _ref$onSelect === void 0 ? function () {} : _ref$onSelect,
    _ref$onClose = _ref.onClose,
    onClose = _ref$onClose === void 0 ? function () {} : _ref$onClose;
  var _React$useState = React.useState([]),
    _React$useState2 = _slicedToArray(_React$useState, 2),
    rows = _React$useState2[0],
    setRows = _React$useState2[1];
  var _React$useState3 = React.useState(''),
    _React$useState4 = _slicedToArray(_React$useState3, 2),
    filterText = _React$useState4[0],
    setFilterText = _React$useState4[1];
  var _React$useState5 = React.useState(1),
    _React$useState6 = _slicedToArray(_React$useState5, 2),
    page = _React$useState6[0],
    setPage = _React$useState6[1];
  var _React$useState7 = React.useState(10),
    _React$useState8 = _slicedToArray(_React$useState7, 1),
    pageSize = _React$useState8[0];
  var _React$useState9 = React.useState(false),
    _React$useState0 = _slicedToArray(_React$useState9, 2),
    loading = _React$useState0[0],
    setLoading = _React$useState0[1];
  var _React$useState1 = React.useState(null),
    _React$useState10 = _slicedToArray(_React$useState1, 2),
    displayColumn = _React$useState10[0],
    setDisplayColumn = _React$useState10[1];
  if (!visible || !foreignKey) return null;
  var fkTableName = foreignKey.table,
    fkColumns = foreignKey.columns;

  // ═══════════════════════════════════════════════════════════════════════════
  // Load Foreign Key Rows
  // ═══════════════════════════════════════════════════════════════════════════
  React.useEffect(function () {
    if (!visible || !fkTableName) return;
    setLoading(true);
    _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee() {
      var _window$app, state, isRemote, sql, result, keys, displayCol, _t, _t2;
      return _regenerator().w(function (_context) {
        while (1) switch (_context.p = _context.n) {
          case 0:
            _context.p = 0;
            // Query foreign key table
            state = ((_window$app = window.app) === null || _window$app === void 0 ? void 0 : _window$app.state) || {
              activeDbId: null,
              dbMode: 'pglite',
              serverConnectionString: null
            };
            isRemote = state.dbMode === 'remote' && state.serverConnectionString;
            sql = "SELECT * FROM \"".concat(fkTableName, "\" LIMIT 1000");
            if (!isRemote) {
              _context.n = 2;
              break;
            }
            _context.n = 1;
            return window.api.serverQuery(state.serverConnectionString, sql, []);
          case 1:
            _t = _context.v;
            _context.n = 4;
            break;
          case 2:
            _context.n = 3;
            return window.api.query(sql, state.activeDbId);
          case 3:
            _t = _context.v;
          case 4:
            result = _t;
            setRows(result || []);

            // Detect display column (first non-ID column)
            if (result && result.length > 0) {
              keys = Object.keys(result[0]);
              displayCol = keys.find(function (k) {
                return !k.includes('id');
              }) || keys[0];
              setDisplayColumn(displayCol);
            }
            _context.n = 6;
            break;
          case 5:
            _context.p = 5;
            _t2 = _context.v;
            console.error('[ForeignRowSelector] Load error:', _t2);
            alert('Fehler beim Laden der Foreign Key Daten: ' + _t2.message);
          case 6:
            _context.p = 6;
            setLoading(false);
            return _context.f(6);
          case 7:
            return _context.a(2);
        }
      }, _callee, null, [[0, 5, 6, 7]]);
    }))();
  }, [visible, fkTableName]);

  // ═══════════════════════════════════════════════════════════════════════════
  // Filter & Paginate
  // ═══════════════════════════════════════════════════════════════════════════
  var getFilteredRows = function getFilteredRows() {
    if (!filterText.trim()) return rows;
    return rows.filter(function (row) {
      var text = Object.values(row).map(function (v) {
        return String(v || '').toLowerCase();
      }).join(' ');
      return text.includes(filterText.toLowerCase());
    });
  };
  var filteredRows = getFilteredRows();
  var paginatedRows = filteredRows.slice((page - 1) * pageSize, page * pageSize);
  var totalPages = Math.ceil(filteredRows.length / pageSize);
  var fkTargetColumn = (fkColumns === null || fkColumns === void 0 || (_fkColumns$ = fkColumns[0]) === null || _fkColumns$ === void 0 ? void 0 : _fkColumns$.target) || 'id';
  var displayColumnName = displayColumn || (fkColumns === null || fkColumns === void 0 || (_fkColumns$2 = fkColumns[0]) === null || _fkColumns$2 === void 0 ? void 0 : _fkColumns$2.target) || (rows.length > 0 ? Object.keys(rows[0])[0] : 'id');

  // ═══════════════════════════════════════════════════════════════════════════
  // Render: Table
  // ═══════════════════════════════════════════════════════════════════════════
  var renderTable = function renderTable() {
    if (loading) {
      return /*#__PURE__*/React.createElement("div", {
        style: {
          textAlign: 'center',
          padding: '40px'
        }
      }, "\u23F3 Lade Daten...");
    }
    if (rows.length === 0) {
      return /*#__PURE__*/React.createElement("div", {
        style: {
          textAlign: 'center',
          padding: '40px',
          color: '#666'
        }
      }, "Keine Daten verf\xFCgbar");
    }
    if (paginatedRows.length === 0) {
      return /*#__PURE__*/React.createElement("div", {
        style: {
          textAlign: 'center',
          padding: '40px',
          color: '#666'
        }
      }, "Keine Ergebnisse f\xFCr \"", filterText, "\"");
    }
    var columns = displayColumn ? [displayColumnName, fkTargetColumn].filter(function (c, i, a) {
      return a.indexOf(c) === i;
    }) : [fkTargetColumn];
    return /*#__PURE__*/React.createElement("div", {
      style: {
        overflowX: 'auto'
      }
    }, /*#__PURE__*/React.createElement("table", {
      style: {
        width: '100%',
        fontSize: '13px',
        borderCollapse: 'collapse'
      }
    }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", {
      style: {
        backgroundColor: '#f0f0f0',
        borderBottom: '2px solid #ddd'
      }
    }, /*#__PURE__*/React.createElement("th", {
      style: {
        padding: '8px',
        textAlign: 'left',
        fontWeight: 'bold',
        width: '30px'
      }
    }, "\u2713"), columns.map(function (col) {
      return /*#__PURE__*/React.createElement("th", {
        key: col,
        style: {
          padding: '8px',
          textAlign: 'left',
          fontWeight: 'bold',
          maxWidth: '200px'
        }
      }, col);
    }))), /*#__PURE__*/React.createElement("tbody", null, paginatedRows.map(function (row, idx) {
      var rowKey = row[fkTargetColumn];
      var isSelected = selectedValue === rowKey;
      return /*#__PURE__*/React.createElement("tr", {
        key: idx,
        onClick: function onClick() {
          return onSelect(rowKey);
        },
        style: {
          backgroundColor: isSelected ? '#e6f2ff' : idx % 2 === 0 ? '#fafafa' : 'white',
          borderBottom: '1px solid #eee',
          cursor: 'pointer',
          transition: 'background-color 0.2s'
        },
        onMouseEnter: function onMouseEnter(e) {
          if (!isSelected) e.currentTarget.style.backgroundColor = '#f0f0f0';
        },
        onMouseLeave: function onMouseLeave(e) {
          if (!isSelected) e.currentTarget.style.backgroundColor = idx % 2 === 0 ? '#fafafa' : 'white';
        }
      }, /*#__PURE__*/React.createElement("td", {
        style: {
          padding: '8px',
          textAlign: 'center',
          fontSize: '14px'
        }
      }, isSelected ? '✓' : ''), columns.map(function (col) {
        return /*#__PURE__*/React.createElement("td", {
          key: col,
          style: {
            padding: '8px',
            maxWidth: '200px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }
        }, row[col] || '-');
      }));
    }))));
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // Render: Pagination
  // ═══════════════════════════════════════════════════════════════════════════
  var renderPagination = function renderPagination() {
    if (totalPages <= 1) return null;
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '8px',
        padding: '12px',
        borderTop: '1px solid #eee',
        fontSize: '12px'
      }
    }, /*#__PURE__*/React.createElement("button", {
      onClick: function onClick() {
        return setPage(Math.max(1, page - 1));
      },
      disabled: page === 1,
      style: {
        padding: '4px 8px',
        border: '1px solid #ccc',
        backgroundColor: page === 1 ? '#f0f0f0' : 'white',
        cursor: page === 1 ? 'not-allowed' : 'pointer',
        borderRadius: '3px',
        fontSize: '11px'
      }
    }, "\u2190 Zur\xFCck"), /*#__PURE__*/React.createElement("span", {
      style: {
        padding: '0 8px',
        fontWeight: 'bold'
      }
    }, page, " / ", totalPages), /*#__PURE__*/React.createElement("button", {
      onClick: function onClick() {
        return setPage(Math.min(totalPages, page + 1));
      },
      disabled: page === totalPages,
      style: {
        padding: '4px 8px',
        border: '1px solid #ccc',
        backgroundColor: page === totalPages ? '#f0f0f0' : 'white',
        cursor: page === totalPages ? 'not-allowed' : 'pointer',
        borderRadius: '3px',
        fontSize: '11px'
      }
    }, "Weiter \u2192"));
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // Main Render
  // ═══════════════════════════════════════════════════════════════════════════
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2000
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: '600px',
      maxHeight: '80vh',
      backgroundColor: 'white',
      borderRadius: '8px',
      boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '16px',
      borderBottom: '1px solid #eee',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      margin: 0,
      fontSize: '16px'
    }
  }, "\uD83D\uDD17 W\xE4hlen Sie einen Datensatz aus \"", fkTableName, "\""), /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    style: {
      background: 'none',
      border: 'none',
      fontSize: '24px',
      cursor: 'pointer',
      color: '#999'
    }
  }, "\u2715")), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '12px 16px',
      borderBottom: '1px solid #eee'
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "text",
    placeholder: "\uD83D\uDD0D Suchen...",
    value: filterText,
    onChange: function onChange(e) {
      setFilterText(e.target.value);
      setPage(1);
    },
    style: {
      width: '100%',
      padding: '8px 12px',
      border: '1px solid #ccc',
      borderRadius: '4px',
      fontSize: '13px',
      boxSizing: 'border-box'
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      padding: '12px 16px'
    }
  }, renderTable()), !loading && rows.length > pageSize && renderPagination(), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '12px 16px',
      borderTop: '1px solid #eee',
      textAlign: 'right'
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    style: {
      padding: '8px 16px',
      backgroundColor: '#f0f0f0',
      border: '1px solid #ccc',
      borderRadius: '4px',
      cursor: 'pointer',
      fontSize: '13px'
    }
  }, "Schlie\xDFen"))));
};

// Export für global usage
window.ForeignRowSelector = ForeignRowSelector;

// Export für Webpack
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ForeignRowSelector);
window.ForeignRowSelector = __webpack_exports__;
/******/ })()
;
//# sourceMappingURL=foreign-row-selector.js.map
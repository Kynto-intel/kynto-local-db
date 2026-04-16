/**
 * i18n-helpers.js - Hilfsfunktionen für Internationalisierung in Kynto
 * Vereinfacht die Verwendung von Übersetzungen in JavaScript
 */

// Sichere Zugriff auf i18n mit Fallback
const i18n = window.i18n || {
  t: (key, opts = {}) => {
    console.warn(`[i18n] window.i18n nicht verfügbar für Key: ${key}`);
    return key;
  },
  getLanguage: () => localStorage.getItem('language') || 'en'
};

/**
 * Ersetzt HTML-Inhalte mit übersetzten Strings
 * @param {HTMLElement} element - Das Element
 * @param {string} key - Der i18n-Schlüssel (z.B. "instant_api.start_button")
 * @param {string} property - Die Eigenschaft ('textContent', 'innerHTML', 'placeholder', 'title', 'value')
 */
function setI18nText(element, key, property = 'textContent') {
  if (!element) return;
  const text = i18n.t(key);
  element[property] = text;
}

/**
 * Setzt mehrere HTML-Elemente mit Übersetzungen auf einmal
 * @param {Object} mappings - { elementId: { key: "...", property: "..." }, ... }
 */
function setI18nMultiple(mappings) {
  for (const [id, config] of Object.entries(mappings)) {
    const el = document.getElementById(id);
    if (el) setI18nText(el, config.key, config.property || 'textContent');
  }
}

/**
 * Aktualisiert alle dynamischen i18n-Elemente
 * Wird nur nach Sprachenwechsel aufgerufen (nicht beim Laden!)
 */
function updateI18nElements() {
  // ⏸️ updateDOM() nur aufrufen wenn Übersetzungen definiert sind
  // Dies sollte nur nach Sprachenwechsel passieren, nicht beim Laden
  if (window.i18n?.translations && Object.keys(window.i18n.translations).length > 0) {
    if (window.i18n?.updateDOM) {
      window.i18n.updateDOM();
    }
  }

  // Aktualisiere spezifische Module wenn sie eigene Update-Funktionen haben
  if (window.InstantAPIPanel?.updateLabels) window.InstantAPIPanel.updateLabels();
  if (window.sidebarModule?.updateLabels) window.sidebarModule.updateLabels();
}

/**
 * Wrapper für Status-Meldungen mit i18n
 * @param {string} key - Der i18n-Schlüssel
 * @param {Object} options - Parameter für Placeholder-Ersetzung
 * @returns {string} Übersetzter Text
 */
function getStatusMessage(key, options = {}) {
  return i18n.t(key, options);
}

/**
 * Wrapper für Fehlermeldungen mit i18n
 */
function getErrorMessage(key, options = {}) {
  return i18n.t(key, options);
}

/**
 * Wrapper für Button-Texte mit i18n
 */
function getButtonLabel(key) {
  return i18n.t(key);
}

/**
 * Wrapper für Tooltips mit i18n
 */
function getTooltip(key) {
  return i18n.t(key);
}

/**
 * Aktualisiert Elementin direkt nach Sprachenwechsel
 * @param {string} id - Element-ID
 * @param {string} key - i18n-Key
 * @param {string} property - HTML-Eigenschaft
 */
function updateElementI18n(id, key, property = 'textContent') {
  const el = document.getElementById(id);
  if (el) setI18nText(el, key, property);
}

/**
 * Format für dynamische Status-Meldungen
 */
function formatStatusWithI18n(statusKey, count, entity) {
  const template = i18n.t(statusKey);
  return template
    .replace('{{count}}', count)
    .replace('{{entity}}', entity);
}

// Höre auf Sprachenwechsel
if (window.i18n) {
  window.addEventListener('language:changed', () => {
    console.log('[i18n-helpers] Sprache gewechselt, aktualisiere UI...');
    updateI18nElements();
  });
}

// Exportiere für Module
export {
  i18n,
  setI18nText,
  setI18nMultiple,
  updateI18nElements,
  getStatusMessage,
  getErrorMessage,
  getButtonLabel,
  getTooltip,
  updateElementI18n,
  formatStatusWithI18n
};

// Auch global verfügbar machen
if (window) {
  window.i18nHelpers = {
    setI18nText,
    setI18nMultiple,
    updateI18nElements,
    getStatusMessage,
    getErrorMessage,
    getButtonLabel,
    getTooltip,
    updateElementI18n,
    formatStatusWithI18n
  };
}

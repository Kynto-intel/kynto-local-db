// Frontend i18n Module - für den Renderer Process
(function(window) {
  'use strict';

  let currentLanguage = 'en';
  let translations = {};

  /**
   * Initializes i18n with translations object
   */
  function initI18n(lang = 'en', translationsObj = {}) {
    currentLanguage = lang;
    translations = translationsObj;
    document.documentElement.lang = lang;
    console.log(`[i18n Frontend] Sprache: ${lang}`);
  }

  /**
   * Translates a key
   */
  function t(key, options = {}) {
    const keys = key.split('.');
    let value = translations;

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        console.warn(`[i18n] Schlüssel nicht gefunden: ${key}`);
        return key;
      }
    }

    if (typeof value !== 'string') {
      return key;
    }

    let result = value;
    for (const [optKey, optValue] of Object.entries(options)) {
      result = result.replace(new RegExp(`{{${optKey}}}`, 'g'), optValue);
    }

    return result;
  }

  /**
   * Sets the current language
   */
  function setLanguage(lang) {
    currentLanguage = lang;
    document.documentElement.lang = lang;
    // Trigger custom event for language change
    window.dispatchEvent(new CustomEvent('languageChanged', { detail: { language: lang } }));
  }

  /**
   * Gets the current language
   */
  function getLanguage() {
    return currentLanguage;
  }

  /**
   * Loads translations from JSON files
   */
  async function loadTranslations(lang = 'en') {
    try {
      const response = await fetch(`./locales/${lang}.json`);
      if (response.ok) {
        const data = await response.json();
        initI18n(lang, data);
        return data;
      } else {
        console.error(`[i18n] Fehler beim Laden: ${lang}.json (HTTP ${response.status})`);
        return null;
      }
    } catch (err) {
      console.error(`[i18n] Fehler beim Laden der Übersetzungen:`, err);
      return null;
    }
  }

  /**
   * Updates all elements with data-i18n attributes
   */
  function updateDOM() {
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      const attr = el.getAttribute('data-i18n-attr') || 'textContent';
      const translation = t(key);
      el[attr] = translation;
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      const key = el.getAttribute('data-i18n-placeholder');
      el.placeholder = t(key);
    });

    document.querySelectorAll('[data-i18n-title]').forEach((el) => {
      const key = el.getAttribute('data-i18n-title');
      el.title = t(key);
    });
  }

  // Export to window
  window.i18n = {
    initI18n,
    t,
    setLanguage,
    getLanguage,
    loadTranslations,
    updateDOM
  };

})(window);

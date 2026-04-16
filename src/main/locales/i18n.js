// i18n.js - Internationalisierung für Kynto
const path = require('path');
const fs = require('fs');

let currentLanguage = 'en';
let translations = {};

/**
 * Initialisiert das i18n-System
 * @param {string} lang - Sprache (de, en)
 * @param {string} localesDir - Verzeichnis mit den Übersetzungsdateien
 */
function initI18n(lang = 'en', localesDir = null) {
  currentLanguage = lang;
  
  if (!localesDir) {
    localesDir = path.join(__dirname, '..', 'locales');
  }
  
  try {
    const translationFile = path.join(localesDir, `${lang}.json`);
    if (fs.existsSync(translationFile)) {
      translations = JSON.parse(fs.readFileSync(translationFile, 'utf8'));
      console.log(`[i18n] Sprache ${lang} geladen`);
    } else {
      console.warn(`[i18n] Fehler: ${translationFile} nicht gefunden - nutze Fallback`);
      translations = {};
    }
  } catch (err) {
    console.error(`[i18n] Fehler beim Laden der Übersetzungen:`, err);
    translations = {};
  }
}

/**
 * Übersetzt einen Schlüssel
 * @param {string} key - z.B. "modals.close" oder "sidebar.databases"
 * @param {object} options - Ersetzungsoptionen für {{placeholders}}
 * @returns {string} Übersetzter Text oder Schlüssel als Fallback
 */
function t(key, options = {}) {
  const keys = key.split('.');
  let value = translations;
  
  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k];
    } else {
      return key; // Fallback auf Schlüssel wenn nicht gefunden
    }
  }
  
  if (typeof value !== 'string') {
    return key;
  }
  
  // Ersetze {{placeholders}} durch Werte aus options
  let result = value;
  for (const [optKey, optValue] of Object.entries(options)) {
    result = result.replace(new RegExp(`{{${optKey}}}`, 'g'), optValue);
  }
  
  return result;
}

/**
 * Setzt die aktuelle Sprache
 * @param {string} lang - Sprache (de, en)
 */
function setLanguage(lang) {
  initI18n(lang);
}

/**
 * Gibt die aktuelle Sprache zurück
 */
function getLanguage() {
  return currentLanguage;
}

/**
 * Gibt alle Übersetzungen zurück
 */
function getTranslations() {
  return translations;
}

module.exports = {
  initI18n,
  t,
  setLanguage,
  getLanguage,
  getTranslations
};

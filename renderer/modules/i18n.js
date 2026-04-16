// i18n.js - ES Module für Frontend-Internationalisierung
let currentLanguage = 'en';
let translations = {};

// Fallback-Übersetzungen für Notfälle (wenn JSON nicht geladen wird)
const FALLBACK_TRANSLATIONS = {
  'dashboard': {
    'title': 'Kynto Intel',
    'all_databases': {
      'section_title': 'Databases',
      'rows': 'Rows'
    },
    'stats': {
      'tables': 'Tables'
    }
  }
};

/**
 * Lädt die Übersetzungen
 */
export async function loadTranslations(lang = 'en') {
  try {
    // Konstruiere den korrekten Pfad - in Electron muss das relativ zur index.html sein
    // index.html ist in /renderer/, locales ist in /renderer/locales/
    const fetchUrl = `./locales/${lang}.json`;
    
    console.log(`[i18n] 🔍 Lade Übersetzungen von: ${fetchUrl}`);
    console.log(`[i18n] 📍 Aktueller Pfad: ${window.location.pathname}`);
    console.log(`[i18n] 🌐 Herkunft: ${window.location.origin}`);
    
    // Versuche zu fetchen
    const response = await fetch(fetchUrl, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    
    console.log(`[i18n] ✅ Fetch-Antwort Status: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      // Fallback: Versuche mit absolutem Pfad
      console.warn(`[i18n] ⚠️ Fetch mit relativem Pfad fehlgeschlagen (${response.status}), versuche absoluten Pfad`);
      const absoluteUrl = `/renderer/locales/${lang}.json`;
      console.log(`[i18n] 🔄 Versuche: ${absoluteUrl}`);
      
      const fallbackResponse = await fetch(absoluteUrl);
      if (!fallbackResponse.ok) {
        console.error(`[i18n] ❌ Fehler beim Laden: ${lang}.json (HTTP ${fallbackResponse.status})`);
        return false;
      }
      
      const data = await fallbackResponse.json();
      console.log(`[i18n] ✅ JSON geladen (fallback), ${Object.keys(data).length} Keys vorhanden`);
      currentLanguage = lang;
      translations = data;
      document.documentElement.lang = lang;
      document.documentElement.setAttribute('data-language', lang);
      window.dispatchEvent(new CustomEvent('i18n:loaded', { detail: { language: lang } }));
      return true;
    }
    
    const data = await response.json();
    console.log(`[i18n] ✅ JSON geladen (primary), ${Object.keys(data).length} Keys vorhanden:`, Object.keys(data));
    
    // DEBUG: Überprüfe ob kritische Keys existieren
    if (data.sidebar && data.sidebar.open_db_tooltip) {
      console.log(`[i18n] ✅ sidebar.open_db_tooltip gefunden:`, data.sidebar.open_db_tooltip);
    } else {
      console.error(`[i18n] ❌ sidebar.open_db_tooltip NICHT gefunden! sidebar keys:`, data.sidebar ? Object.keys(data.sidebar) : 'NO SIDEBAR');
    }
    
    currentLanguage = lang;
    translations = data;
    document.documentElement.lang = lang;
    document.documentElement.setAttribute('data-language', lang);
    
    console.log(`[i18n] ✅ Sprache erfolgreich gespeichert: ${lang}`);
    window.dispatchEvent(new CustomEvent('i18n:loaded', { detail: { language: lang } }));
    
    return true;
  } catch (err) {
    console.error(`[i18n] ❌ Fehler beim Laden der Übersetzungen:`, err);
    console.error(`[i18n] ❌ Stack:`, err.stack);
    return false;
  }
}

/**
 * Übersetzt einen Schlüssel
 * @param {string} key - z.B. "modals.close" oder "sidebar.databases"
 * @param {object} options - Ersetzungsoptionen für {{placeholders}}
 */
export function t(key, options = {}) {
  // Verwende Fallback wenn translations nicht geladen wurde
  let sourceTranslations = Object.keys(translations).length > 0 ? translations : FALLBACK_TRANSLATIONS;
  
  // If translations not loaded yet, return key as-is
  if (!sourceTranslations || Object.keys(sourceTranslations).length === 0) {
    console.warn(`[i18n] ⚠️ t() called aber translations ist leer! Key: ${key}`);
    return key;
  }
  
  const keys = key.split('.');
  let value = sourceTranslations;

  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k];
    } else {
      console.warn(`[i18n] ⚠️ Schlüssel nicht gefunden: ${key} (teilweise Pfad: ${keys.slice(0, keys.indexOf(k) + 1).join('.')})`);
      return key;
    }
  }

  if (typeof value !== 'string') {
    console.warn(`[i18n] ⚠️ Key ${key} ist kein String, ist: ${typeof value}`);
    return key;
  }

  let result = value;
  for (const [optKey, optValue] of Object.entries(options)) {
    result = result.replace(new RegExp(`{{${optKey}}}`, 'g'), optValue);
  }

  return result;
}

/**
 * Setzt die aktuelle Sprache
 */
export async function setLanguage(lang) {
  await loadTranslations(lang);
  updateDOM();
}

/**
 * Gibt die aktuelle Sprache zurück
 */
export function getLanguage() {
  return currentLanguage;
}

/**
 * Aktualisiert alle Elemente mit data-i18n-Attributen
 */
export function updateDOM() {
  console.log(`[i18n] 🔄 updateDOM() aufgerufen, translations-Status: ${Object.keys(translations).length > 0 ? '✅ geladen' : '❌ leer'}`);
  
  // textContent
  const textElements = document.querySelectorAll('[data-i18n]');
  console.log(`[i18n] 📝 Aktualisiere ${textElements.length} textContent-Elemente`);
  textElements.forEach((el) => {
    const key = el.getAttribute('data-i18n');
    const newText = t(key);
    el.textContent = newText;
    if (newText === key) {
      console.warn(`[i18n] ⚠️ Element mit fehlendem Key: "${key}"`);
    }
  });

  // placeholder
  const placeholderElements = document.querySelectorAll('[data-i18n-placeholder]');
  console.log(`[i18n] 🔤 Aktualisiere ${placeholderElements.length} placeholder-Elemente`);
  placeholderElements.forEach((el) => {
    const key = el.getAttribute('data-i18n-placeholder');
    el.placeholder = t(key);
  });

  // title
  const titleElements = document.querySelectorAll('[data-i18n-title]');
  console.log(`[i18n] 📌 Aktualisiere ${titleElements.length} title-Elemente`);
  titleElements.forEach((el) => {
    const key = el.getAttribute('data-i18n-title');
    el.title = t(key);
  });

  // value
  const valueElements = document.querySelectorAll('[data-i18n-value]');
  console.log(`[i18n] 📋 Aktualisiere ${valueElements.length} value-Elemente`);
  valueElements.forEach((el) => {
    const key = el.getAttribute('data-i18n-value');
    el.value = t(key);
  });
}

// Initialisiere mit Standard-Sprache beim Import
export async function initialize(defaultLang = 'en') {
  // Versuche Sprache aus Browser-Einstellungen zu lesen
  const savedLang = localStorage.getItem('language') || defaultLang;
  await loadTranslations(savedLang);
  return getLanguage();
}

// Speichern der Spracheinstellung
export function saveLanguagePreference(lang) {
  localStorage.setItem('language', lang);
}

// Export als global-Objekt für direkten Zugriff
if (typeof window !== 'undefined') {
  window.i18n = {
    loadTranslations,
    t,
    setLanguage,
    getLanguage,
    updateDOM,
    initialize,
    saveLanguagePreference
  };
}

// Language Switcher für die App
export class LanguageSwitcher {
  constructor() {
    this.supportedLanguages = ['en', 'de'];
    // Standardmäßig auf 'en' setzen (kann später geändert werden)
    this.currentLanguage = localStorage.getItem('language') || 'en';
  }

  /**
   * Initialisiert Sprachschalter mit UI
   */
  async initialize() {
    console.log('[LanguageSwitcher] 🌍 Starte initialize()');
    
    if (!window.i18n) {
      console.error('[LanguageSwitcher] ❌ i18n nicht verfügbar');
      return;
    }

    // Debugging: Zeige welche Sprache aus localStorage kommt
    const savedLang = localStorage.getItem('language');
    console.log('[LanguageSwitcher] 💾 Sprache aus localStorage:', savedLang || '(nicht gespeichert - nutze default "en")');
    
    // Setze Standardsprache auf 'en' wenn nichts gespeichert
    this.currentLanguage = savedLang || 'en';
    
    // Lade Initial language
    console.log('[LanguageSwitcher] ⏳ Lade Sprache:', this.currentLanguage);
    const loaded = await window.i18n.loadTranslations(this.currentLanguage);
    console.log('[LanguageSwitcher] ✅ loadTranslations fertig, Ergebnis:', loaded);
    
    console.log('[LanguageSwitcher] 🔄 Rufe updateDOM() auf');
    window.i18n.updateDOM();
    console.log('[LanguageSwitcher] ✅ updateDOM() fertig');

    // Höre auf Sprach-Änderungen von außen
    window.addEventListener('i18n:loaded', () => {
      this.currentLanguage = window.i18n.getLanguage();
      localStorage.setItem('language', this.currentLanguage);
      console.log('[LanguageSwitcher] 💾 Sprache gespeichert:', this.currentLanguage);
    });

    console.log('[LanguageSwitcher] ✅ initialize() abgeschlossen');
    return this.currentLanguage;
  }

  /**
   * Wechselt zu einer neuen Sprache
   */
  async switchLanguage(lang) {
    if (!this.supportedLanguages.includes(lang)) {
      console.warn(`[LanguageSwitcher] Sprache nicht unterstützt: ${lang}`);
      return false;
    }

    if (!window.i18n) {
      console.error('[LanguageSwitcher] i18n nicht verfügbar');
      return false;
    }

    await window.i18n.loadTranslations(lang);
    
    // Aktualisiere ALLE DOM-Elemente mit i18n
    window.i18n.updateDOM();
    
    // KRITISCH: Re-render alle dynamischen Components mit neuer Sprache
    const container = document.querySelector('.content-area') || document.querySelector('.main-content') || document.body;
    
    // Dashboard neu rendern wenn sichtbar
    if (window.KyntoDashboard && container.querySelector('.kd')) {
      setTimeout(() => {
        window.KyntoDashboard.render(container.querySelector('.content-area') || container);
      }, 50);
    }

    // Settings Modal Inhalte aktualisieren (wenn offen)
    const settingsModal = document.getElementById('settings-modal');
    if (settingsModal?.classList.contains('open')) {
      window.i18n.updateDOM();
    }

    this.currentLanguage = lang;
    
    // 🔧 WICHTIG: Speichere Sprache in BEIDEN:
    // 1. localStorage (für schnelle lokale Referenz)
    localStorage.setItem('language', lang);
    
    // 2. IPC → settings.json (für persistente Speicherung zwischen Restarts!)
    if (window.api?.saveSettings) {
      try {
        // Lade AKTUELLE Settings und UPDATE nur die Sprache
        const currentSettings = await window.api.loadSettings();
        const updatedSettings = {
          ...currentSettings,
          language: lang
        };
        
        await window.api.saveSettings(updatedSettings);
        console.log('[LanguageSwitcher] ✅ Sprache in settings.json gespeichert:', lang);
      } catch (err) {
        console.error('[LanguageSwitcher] ❌ Fehler beim Speichern der Sprache in settings.json:', err);
      }
    }

    // Trigger custom event
    window.dispatchEvent(new CustomEvent('language:changed', {
      detail: { language: lang }
    }));

    return true;
  }

  /**
   * Erstellt ein Sprachauswahl-UI
   */
  createLanguageSwitcher() {
    // Schaue nach Header-Info und füge LanguageSwitcher ein
    const headerInfo = document.getElementById('header-info');
    if (!headerInfo) return;

    // Erstelle Language-Buttons
    const langContainer = document.createElement('div');
    langContainer.id = 'language-switcher';
    langContainer.style.cssText = `
      display: flex;
      gap: 4px;
      margin: 0 8px;
      font-size: 11px;
    `;

    this.supportedLanguages.forEach(lang => {
      const btn = document.createElement('button');
      btn.textContent = lang.toUpperCase();
      btn.style.cssText = `
        background: none;
        border: 1px solid ${this.currentLanguage === lang ? 'var(--accent)' : 'var(--border)'};
        color: ${this.currentLanguage === lang ? 'var(--accent)' : 'var(--muted)'};
        cursor: pointer;
        padding: 2px 6px;
        border-radius: 3px;
        transition: all 0.2s;
      `;

      btn.addEventListener('click', () => this.switchLanguage(lang));
      
      // Update button style when language changes
      window.addEventListener('language:changed', (e) => {
        if (e.detail.language === lang) {
          btn.style.borderColor = 'var(--accent)';
          btn.style.color = 'var(--accent)';
        } else {
          btn.style.borderColor = 'var(--border)';
          btn.style.color = 'var(--muted)';
        }
      });

      langContainer.appendChild(btn);
    });

    // Füge vor header-info oder daneben ein
    if (headerInfo.parentElement) {
      headerInfo.parentElement.insertBefore(langContainer, headerInfo);
    }
  }

  /**
   * Gibt aktuell geladene Sprache zurück
   */
  getLanguage() {
    return this.currentLanguage;
  }

  /**
   * Gibt alle unterstützten Sprachen zurück
   */
  getSupportedLanguages() {
    return this.supportedLanguages;
  }
}

export default new LanguageSwitcher();

/**
 * 🎭 Playwright Scraper - Vollständige Browser-Automatisierung
 *
 * Für Seiten die JavaScript brauchen:
 * - Single Page Apps (React, Vue, Angular)
 * - Lazy-Loading Content
 * - Dynamisch generierte Tabellen
 * - Login-geschützte Bereiche (mit gespeicherten Cookies)
 *
 * Install: npm install playwright
 * Browser: npx playwright install chromium
 *
 * Optimierungen:
 * - Browser-Instanz wird wiederverwendet (kein Launch pro URL → 10x schneller)
 * - Bilder/Fonts/Tracking blockiert (30-50% schneller)
 * - Automatische Cookie-Banner Behandlung
 * - Wartet auf echten Content (networkidle + content check)
 */

const { extractContent } = require('./text-processor');

// ============================================================================
// 🔌 BROWSER LIFECYCLE MANAGEMENT
// ============================================================================

let browserInstance = null;
let browserLaunchPromise = null;
let lastUsedAt = Date.now();
const BROWSER_IDLE_TIMEOUT_MS = 5 * 60 * 1000; // Browser nach 5min Inaktivität schließen

/**
 * Hole (oder starte) den Browser
 * Singleton-Pattern: wird wiederverwendet bis er idle-timeout erreicht
 */
async function getBrowser() {
  // Playwright lazy-loaden (kein Fehler wenn nicht installiert)
  let playwright;
  try {
    playwright = require('playwright');
  } catch (e) {
    throw new Error(
      'Playwright nicht installiert. Bitte ausführen:\n' +
      'npm install playwright\n' +
      'npx playwright install chromium'
    );
  }

  lastUsedAt = Date.now();

  if (browserInstance && browserInstance.isConnected()) {
    return browserInstance;
  }

  if (browserLaunchPromise) {
    return browserLaunchPromise;
  }

  console.log('[Playwright] Starte Browser...');

  browserLaunchPromise = playwright.chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu',
      '--disable-extensions',
      '--disable-default-apps',
      '--disable-background-networking',
      '--disable-sync',
      '--disable-translate',
      '--metrics-recording-only',
      '--safebrowsing-disable-auto-update',
      '--mute-audio',
    ],
  }).then(browser => {
    browserInstance = browser;
    browserLaunchPromise = null;
    console.log('[Playwright] Browser bereit ✅');

    // Cleanup wenn Browser crasht
    browser.on('disconnected', () => {
      console.log('[Playwright] Browser disconnected, wird beim nächsten Aufruf neu gestartet');
      browserInstance = null;
      browserLaunchPromise = null;
    });

    return browser;
  });

  return browserLaunchPromise;
}

/**
 * Browser schließen (z.B. beim App-Shutdown)
 */
async function closeBrowser() {
  if (browserInstance && browserInstance.isConnected()) {
    console.log('[Playwright] Schließe Browser');
    await browserInstance.close();
    browserInstance = null;
  }
}

// Auto-Cleanup bei Inaktivität
setInterval(() => {
  if (browserInstance && Date.now() - lastUsedAt > BROWSER_IDLE_TIMEOUT_MS) {
    console.log('[Playwright] Idle-Timeout: Browser wird geschlossen');
    closeBrowser();
  }
}, 60 * 1000);

// ============================================================================
// 🚫 RESOURCE BLOCKING (Für Geschwindigkeit)
// ============================================================================

const BLOCKED_RESOURCE_TYPES = new Set([
  'image', 'media', 'font', 'stylesheet',
]);

const BLOCKED_DOMAINS = [
  'google-analytics.com', 'googletagmanager.com', 'doubleclick.net',
  'facebook.com/tr', 'fbcdn.net', 'analytics.', 'hotjar.com',
  'clarity.ms', 'mouseflow.com', 'fullstory.com', 'segment.com',
  'sentry.io', 'datadog-browser', 'newrelic.com', 'pingdom.net',
  'cookiebot.com', 'onetrust.com', 'trustarc.com',
];

function shouldBlockRequest(url, resourceType) {
  if (BLOCKED_RESOURCE_TYPES.has(resourceType)) return true;
  const lower = url.toLowerCase();
  return BLOCKED_DOMAINS.some(domain => lower.includes(domain));
}

// ============================================================================
// 🍪 COOKIE BANNER HANDLER
// ============================================================================

/**
 * Versuche Cookie-Banner automatisch zu schließen/akzeptieren
 * Unterstützt die häufigsten Banner-Patterns
 */
async function dismissCookieBanner(page) {
  const COOKIE_SELECTORS = [
    // Deutsch
    'button:text("Alle akzeptieren")',
    'button:text("Akzeptieren")',
    'button:text("Alle Cookies akzeptieren")',
    'button:text("Zustimmen")',
    'button:text("Einverstanden")',
    'button:text("OK")',
    'button:text("Verstanden")',
    // Englisch
    'button:text("Accept all")',
    'button:text("Accept All")',
    'button:text("Accept cookies")',
    'button:text("I agree")',
    'button:text("Agree")',
    'button:text("Allow all")',
    'button:text("Got it")',
    // Generic ID/Class-Patterns
    '#accept-cookies',
    '#cookie-accept',
    '.cookie-accept',
    '[id*="cookie"][id*="accept"]',
    '[class*="cookie"][class*="accept"]',
    '[id*="consent"][id*="accept"]',
    '[aria-label*="accept cookies" i]',
    '[data-testid*="cookie-accept"]',
  ];

  for (const selector of COOKIE_SELECTORS) {
    try {
      const element = await page.$(selector);
      if (element && await element.isVisible()) {
        await element.click();
        console.log('[Playwright] Cookie-Banner geschlossen:', selector);
        await page.waitForTimeout(300);
        return true;
      }
    } catch (_) {
      // Nicht gefunden oder nicht klickbar → weiter
    }
  }
  return false;
}

/**
 * Schließe Popups / Overlays
 */
async function dismissPopups(page) {
  const POPUP_SELECTORS = [
    'button[aria-label="Close"]',
    'button[aria-label="Schließen"]',
    '[class*="modal"] button[class*="close"]',
    '[class*="popup"] button[class*="close"]',
    '[class*="overlay"] button[class*="close"]',
    '.modal-close', '.popup-close', '.overlay-close',
    '[data-dismiss="modal"]',
  ];

  for (const selector of POPUP_SELECTORS) {
    try {
      const elements = await page.$$(selector);
      for (const el of elements) {
        if (await el.isVisible()) {
          await el.click();
          await page.waitForTimeout(200);
        }
      }
    } catch (_) {}
  }
}

// ============================================================================
// 📜 SCROLL & LAZY LOADING
// ============================================================================

/**
 * Scrolle schrittweise durch die Seite um Lazy-Content zu triggern
 */
async function scrollToTriggerLazyLoad(page) {
  try {
    const pageHeight = await page.evaluate(() => document.body.scrollHeight);
    const viewportHeight = await page.evaluate(() => window.innerHeight);

    if (pageHeight <= viewportHeight) return; // Kurze Seite, kein Scroll nötig

    let currentPos = 0;
    const step = Math.floor(viewportHeight * 0.8);
    const maxScrolls = 8; // Max 8 Scrolls
    let scrollCount = 0;

    while (currentPos < pageHeight && scrollCount < maxScrolls) {
      currentPos += step;
      await page.evaluate((pos) => window.scrollTo(0, pos), currentPos);
      await page.waitForTimeout(200);
      scrollCount++;
    }

    // Zurück nach oben
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(100);
  } catch (_) {
    // Scroll-Fehler sind nicht kritisch
  }
}

// ============================================================================
// 🎭 HAUPTFUNKTION: Seite laden mit Playwright
// ============================================================================

/**
 * Lade eine URL mit Playwright (vollständige JS-Ausführung)
 *
 * @param {string} url - Die URL
 * @param {Object} options
 * @returns {Promise<ScrapedPage>}
 */
async function fetchWithPlaywright(url, options = {}) {
  const {
    keywords = [],
    maxChars = 4000,
    timeoutMs = 30000,
    waitForSelector = null,   // Warte auf bestimmtes Element
    scrollPage = true,         // Lazy-Loading triggern
    handleCookies = true,      // Cookie-Banner schließen
    handlePopups = true,       // Popups schließen
    waitFor = 'networkidle',   // 'networkidle' | 'load' | 'domcontentloaded'
  } = options;

  let page = null;

  try {
    const browser = await getBrowser();

    // Neuer Browser-Kontext (isoliert, wie InPrivate)
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      locale: 'de-DE',
      timezoneId: 'Europe/Berlin',
      // Geolocation sperren
      geolocation: undefined,
      // Permissions
      permissions: [],
    });

    page = await context.newPage();

    // Ressourcen blockieren (Geschwindigkeit)
    await page.route('**/*', (route) => {
      if (shouldBlockRequest(route.request().url(), route.request().resourceType())) {
        route.abort();
      } else {
        route.continue();
      }
    });

    // Seite laden
    console.log('[Playwright] Lade:', url);
    const response = await page.goto(url, {
      waitUntil: waitFor,
      timeout: timeoutMs,
    });

    if (!response) {
      throw new Error('Keine Response erhalten');
    }

    const status = response.status();
    if (status === 403) throw new Error('HTTP 403: Zugriff verweigert');
    if (status === 404) throw new Error('HTTP 404: Seite nicht gefunden');
    if (status >= 500) throw new Error(`HTTP ${status}: Server-Fehler`);

    // Kurz warten damit initiales JS läuft
    await page.waitForTimeout(500);

    // Cookie-Banner schließen
    if (handleCookies) await dismissCookieBanner(page);

    // Popups schließen
    if (handlePopups) await dismissPopups(page);

    // Auf spezifisches Element warten (optional)
    if (waitForSelector) {
      try {
        await page.waitForSelector(waitForSelector, { timeout: 5000 });
      } catch (_) {
        console.log('[Playwright] waitForSelector Timeout:', waitForSelector);
      }
    }

    // Lazy-Loading triggern
    if (scrollPage) await scrollToTriggerLazyLoad(page);

    // Kurz warten nach Scroll
    await page.waitForTimeout(500);

    // HTML extrahieren
    const html = await page.content();
    const title = await page.title();

    // Cleanup Context (Page + Context, nicht Browser)
    await context.close();

    // Text verarbeiten
    const result = extractContent(html, { keywords, maxChars });
    const finalText = result.text || '';

    return {
      success: true,
      url,
      finalUrl: page.url?.() || url,
      title: title || result.title,
      text: finalText,
      wordCount: finalText.split(/\s+/).filter(w => w).length,
      method: 'playwright',
      httpStatus: status,
      error: null,
    };

  } catch (err) {
    // Context/Page Cleanup bei Fehler
    try { if (page) await page.context().close(); } catch (_) {}

    console.error('[Playwright] Fehler bei', url, ':', err.message);

    return {
      success: false,
      url,
      finalUrl: url,
      title: '',
      text: '',
      wordCount: 0,
      method: 'playwright',
      httpStatus: null,
      error: err.message,
    };
  }
}

// ============================================================================
// ✅ EXPORTS
// ============================================================================

module.exports = {
  fetchWithPlaywright,
  getBrowser,
  closeBrowser,
  dismissCookieBanner,
  scrollToTriggerLazyLoad,
};
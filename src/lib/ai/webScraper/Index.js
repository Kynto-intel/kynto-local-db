/**
 * 🌐 Kynto Web Scraper - Smart Router
 * Pfad: src/lib/ai/web Scraper/index.js
 *
 * Entscheidet automatisch welche Strategie optimal ist:
 * 1. Versucht zuerst schnellen HTTP-Scraper
 * 2. Wenn Seite JS braucht (zu wenig Content / JS-Signale) → Playwright
 * 3. Playwright-Fehler → Fallback mit Fehlermeldung
 *
 * Auch: DuckDuckGo-Suche mit optionalem Seiten-Lesen
 *
 * Verwendung in web-tools.js:
 *   const scraper = require('./web Scraper/index');
 *   const result = await scraper.scrapeUrl(url, { keywords: ['CEO'] });
 */

const { fetchWithRetry, requiresJavaScript } = require('./http-scraper');
const { fetchWithPlaywright, closeBrowser } = require('./playwright-scraper');
const { limitWords } = require('./text-processor');
const https = require('https');
const http = require('http');

// ============================================================================
// ⚙️ KONFIGURATION
// ============================================================================

const DEFAULT_OPTIONS = {
  keywords: [],          // Keywords für Smart Context
  maxChars: 4000,        // Max. Zeichen im Output
  maxWords: 1000,        // Max. Wörter im Output
  timeoutMs: 20000,      // Timeout pro Request
  forcePlaywright: false, // Playwright immer erzwingen
  forceHttp: false,      // Nur HTTP, kein Playwright Fallback
  scrollPage: true,      // Lazy-Loading beim Playwright triggern
  handleCookies: true,   // Cookie-Banner automatisch schließen
};

// Domains die bekannt JS-only sind → direkt Playwright
const PLAYWRIGHT_REQUIRED_DOMAINS = [
  'linkedin.com',
  'instagram.com',
  'twitter.com',
  'x.com',
  'facebook.com',
  'glassdoor.com',
  'xing.com',
  'indeed.com',
  'airbnb.com',
  'booking.com',
];

function domainRequiresPlaywright(url) {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return PLAYWRIGHT_REQUIRED_DOMAINS.some(d => hostname.includes(d));
  } catch (_) {
    return false;
  }
}

// ============================================================================
// 🎯 HAUPT-SCRAPER
// ============================================================================

/**
 * Lade eine URL mit der optimalen Strategie
 *
 * @param {string} url
 * @param {Object} options
 * @returns {Promise<ScrapeResult>}
 */
async function scrapeUrl(url, options = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  if (!url || !url.startsWith('http')) {
    return { success: false, url, error: 'Ungültige URL (muss mit http/https beginnen)', text: '', title: '' };
  }

  const usePlaywrightFirst = opts.forcePlaywright || domainRequiresPlaywright(url);

  // ── Strategie 1: HTTP First ───────────────────────────────────────────────
  if (!usePlaywrightFirst && !opts.forceHttp === false) {
    console.log('[Scraper] Strategie: HTTP zuerst für', url);
    const httpResult = await fetchWithRetry(url, {
      keywords: opts.keywords,
      maxChars: opts.maxChars,
      timeoutMs: opts.timeoutMs,
    });

    if (httpResult.success && !httpResult.needsPlaywright) {
      console.log(`[Scraper] HTTP erfolgreich: ${httpResult.wordCount} Wörter`);
      return {
        ...httpResult,
        text: limitWords(httpResult.text, opts.maxWords),
      };
    }

    if (httpResult.needsPlaywright) {
      console.log('[Scraper] HTTP: JS-only Seite erkannt → wechsle zu Playwright');
    } else if (!httpResult.success) {
      console.log('[Scraper] HTTP fehlgeschlagen:', httpResult.error);
    }
  }

  // ── Strategie 2: Playwright ───────────────────────────────────────────────
  if (!opts.forceHttp) {
    console.log('[Scraper] Strategie: Playwright für', url);
    const playwrightResult = await fetchWithPlaywright(url, {
      keywords: opts.keywords,
      maxChars: opts.maxChars,
      timeoutMs: opts.timeoutMs + 15000, // Mehr Zeit für Browser
      scrollPage: opts.scrollPage,
      handleCookies: opts.handleCookies,
    });

    if (playwrightResult.success) {
      console.log(`[Scraper] Playwright erfolgreich: ${playwrightResult.wordCount} Wörter`);
      return {
        ...playwrightResult,
        text: limitWords(playwrightResult.text, opts.maxWords),
      };
    }

    console.log('[Scraper] Playwright fehlgeschlagen:', playwrightResult.error);

    // Wenn HTTP auch fehlschlug → gib Playwright-Fehler zurück
    return playwrightResult;
  }

  // Nur HTTP, kein Playwright
  return await fetchWithRetry(url, {
    keywords: opts.keywords,
    maxChars: opts.maxChars,
    timeoutMs: opts.timeoutMs,
  });
}

// ============================================================================
// 🔍 WEB-SUCHE (DuckDuckGo)
// ============================================================================

/**
 * Suche mit DuckDuckGo HTML-Interface
 * Kein API-Key nötig, kostenlos
 */
async function searchDuckDuckGo(query, maxResults = 5) {
  const encodedQuery = encodeURIComponent(query);
  const searchUrl = `https://html.duckduckgo.com/html/?q=${encodedQuery}`;

  try {
    const result = await fetchWithRetry(searchUrl, { timeoutMs: 10000 }, 1);

    if (!result.success) {
      return { results: [], query, error: result.error };
    }

    // Extrahiere URLs aus dem DuckDuckGo-HTML
    // DuckDuckGo HTML-Results enthalten Links mit uddg= Parameter
    const rawHtml = result.text;

    // Methode 1: uddg= Parameter (direkte Ergebnis-URLs)
    const uddgMatches = [...rawHtml.matchAll(/uddg=([^&"'\s]+)/g)];
    let urls = uddgMatches
      .map(m => {
        try { return decodeURIComponent(m[1]); } catch (_) { return null; }
      })
      .filter(u => u && u.startsWith('http') && !u.includes('duckduckgo.com'));

    // Methode 2: Falls keine uddg-URLs → direkte HTTPS-URLs
    if (urls.length === 0) {
      const directUrls = [...rawHtml.matchAll(/https?:\/\/(?!duckduckgo\.com|duck\.co)[^\s"'<>]+/g)];
      urls = directUrls.map(m => m[0]).filter(u => !u.includes('duckduckgo'));
    }

    // Deduplizieren und auf maxResults begrenzen
    const uniqueUrls = [...new Set(urls)].slice(0, maxResults);

    return { results: uniqueUrls, query, error: null };
  } catch (err) {
    return { results: [], query, error: err.message };
  }
}

/**
 * Suche + erste Seite direkt lesen
 */
async function searchAndRead(query, options = {}) {
  const { maxResults = 3, ...scrapeOptions } = options;

  console.log('[Scraper] Search+Read:', query);

  const searchResult = await searchDuckDuckGo(query, maxResults);

  if (searchResult.error || searchResult.results.length === 0) {
    return {
      success: false,
      query,
      error: searchResult.error || 'Keine Suchergebnisse',
      text: '', title: '', url: '',
    };
  }

  console.log(`[Scraper] Suche ergab ${searchResult.results.length} URLs:`, searchResult.results);

  // Versuche URLs der Reihe nach bis eine klappt
  for (const url of searchResult.results) {
    const pageResult = await scrapeUrl(url, scrapeOptions);
    if (pageResult.success && pageResult.wordCount > 50) {
      return {
        ...pageResult,
        query,
        sourceUrl: url,
        allFoundUrls: searchResult.results,
      };
    }
    console.log(`[Scraper] ${url} zu wenig Content (${pageResult.wordCount} Wörter), nächste URL...`);
  }

  // Alle URLs fehlgeschlagen
  return {
    success: false,
    query,
    error: 'Alle gefundenen URLs konnten nicht gelesen werden',
    text: '', title: '',
    allFoundUrls: searchResult.results,
  };
}

// ============================================================================
// 🔧 HILFSFUNKTIONEN
// ============================================================================

/**
 * Prüfe ob Playwright verfügbar ist
 */
function isPlaywrightAvailable() {
  try {
    require.resolve('playwright');
    return true;
  } catch (_) {
    return false;
  }
}

/**
 * Gibt Scraper-Status zurück (für Settings/Debug)
 */
function getScraperStatus() {
  return {
    playwrightAvailable: isPlaywrightAvailable(),
    playwrightRequiredDomains: PLAYWRIGHT_REQUIRED_DOMAINS,
  };
}

// ============================================================================
// ✅ EXPORTS
// ============================================================================

module.exports = {
  // Haupt-Funktionen
  scrapeUrl,
  searchDuckDuckGo,
  searchAndRead,

  // Utilities
  isPlaywrightAvailable,
  getScraperStatus,
  closeBrowser, // Für sauberes App-Shutdown

  // Direkt-Zugriff auf Strategien
  scrapeWithHttp: (url, opts) => fetchWithRetry(url, opts),
  scrapeWithPlaywright: (url, opts) => fetchWithPlaywright(url, opts),
};
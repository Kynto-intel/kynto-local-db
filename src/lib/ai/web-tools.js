/**
 * 🌐 Kynto Web Tools - Backend Web Agent
 * Pfad: src/lib/ai/web-tools.js  ← bleibt hier!
 *
 * Diese Datei ist das öffentliche API für den AI-Handler.
 * Die eigentliche Scraping-Logik ist jetzt in:
 *   → src/lib/ai/web Scraper/index.js          (Smart Router)
 *   → src/lib/ai/web Scraper/playwright-scraper.js  (Browser)
 *   → src/lib/ai/web Scraper/http-scraper.js   (HTTP Fallback)
 *   → src/lib/ai/web Scraper/text-processor.js (Text-Verarbeitung)
 */

// Importiere den neuen, besseren Scraper
// Pfad mit Leerzeichen: require() unterstützt das problemlos
const scraper = require('./webScraper/index');

// ============================================================================
// 🛠️ WEB TOOLS FÜR AI-HANDLER
// ============================================================================

/**
 * Tool: Webseite lesen
 * Versucht HTTP zuerst, fällt auf Playwright zurück wenn nötig
 */
async function toolFetchWebpage(params) {
  const { url, keywords = [], maxWords = 1000, forcePlaywright = false } = params;
  if (!url) return { error: 'URL ist erforderlich' };

  console.log('[WebTool] fetch_webpage:', url, keywords.length ? `keywords: ${keywords.join(', ')}` : '');

  const result = await scraper.scrapeUrl(url, {
    keywords,
    maxWords,
    forcePlaywright,
    handleCookies: true,
    scrollPage: true,
  });

  if (!result.success) {
    return {
      error: result.error,
      url,
      hint: result.error?.includes('Playwright') ? 'Playwright installieren: npm install playwright && npx playwright install chromium' : undefined,
    };
  }

  return {
    success: true,
    url: result.finalUrl || url,
    title: result.title,
    content: result.text,
    wordCount: result.wordCount,
    method: result.method, // 'http' oder 'playwright'
    note: keywords.length > 0 ? `Smart Context: Gefiltert nach "${keywords.join(', ')}"` : 'Volltext',
  };
}

/**
 * Tool: Web-Suche (gibt URL-Liste zurück)
 */
async function toolSearchWeb(params) {
  const { query, maxResults = 5 } = params;
  if (!query) return { error: 'Suchanfrage ist erforderlich' };

  console.log('[WebTool] search_web:', query);

  const result = await scraper.searchDuckDuckGo(query, maxResults);

  return {
    success: !result.error,
    query,
    urls: result.results,
    count: result.results.length,
    error: result.error || null,
    hint: result.results.length === 0 ? 'Versuche eine andere Suchanfrage' : undefined,
  };
}

/**
 * Tool: Web-Suche + erste Seite direkt lesen
 * Ideal für "Finde Infos über Firma X"
 */
async function toolSearchAndRead(params) {
  const { query, keywords = [], maxWords = 800 } = params;
  if (!query) return { error: 'Suchanfrage ist erforderlich' };

  console.log('[WebTool] search_and_read:', query);

  const result = await scraper.searchAndRead(query, {
    keywords,
    maxWords,
    handleCookies: true,
  });

  if (!result.success) {
    return {
      error: result.error || 'Suche fehlgeschlagen',
      query,
      searchedUrls: result.allFoundUrls || [],
    };
  }

  return {
    success: true,
    query,
    source: result.sourceUrl || result.url,
    title: result.title,
    content: result.text,
    wordCount: result.wordCount,
    method: result.method,
    otherUrls: (result.allFoundUrls || []).slice(1), // Weitere gefundene URLs
  };
}

// ============================================================================
// 🔍 UTILITY: URL-Validierung
// ============================================================================

/**
 * Prüfe ob eine URL fetchbar ist (vor dem eigentlichen Laden)
 */
async function toolCheckUrl(params) {
  const { url } = params;
  if (!url) return { error: 'URL erforderlich' };

  try {
    const parsed = new URL(url);
    return {
      valid: true,
      url,
      protocol: parsed.protocol,
      hostname: parsed.hostname,
      playwrightRecommended: scraper.isPlaywrightAvailable() &&
        ['linkedin.com', 'twitter.com', 'x.com', 'instagram.com'].some(d => parsed.hostname.includes(d)),
    };
  } catch (_) {
    return { valid: false, error: 'Keine gültige URL' };
  }
}

/**
 * Status des Scrapers zurückgeben
 */
async function toolScraperStatus(params) {
  return scraper.getScraperStatus();
}

// ============================================================================
// 🔧 LEGACY COMPATIBILITY
// (Die alten Funktionen aus web-tools.js bleiben für Kompatibilität)
// ============================================================================

/**
 * @deprecated Nutze toolFetchWebpage stattdessen
 */
async function fetchUrl(url, options = {}) {
  const result = await scraper.scrapeUrl(url, {
    keywords: options.keywords || [],
    maxWords: options.maxWords || 1500,
    timeoutMs: options.timeoutMs || 15000,
  });
  return {
    text: result.text || '',
    title: result.title || '',
    url,
    error: result.error || null,
  };
}

/**
 * @deprecated Nutze toolSearchWeb stattdessen
 */
async function searchWeb(query, maxResults = 5) {
  return scraper.searchDuckDuckGo(query, maxResults);
}

// ============================================================================
// ✅ EXPORTS
// ============================================================================

module.exports = {
  // Neue Tool-Funktionen für AI-Handler
  toolFetchWebpage,
  toolSearchWeb,
  toolSearchAndRead,
  toolCheckUrl,
  toolScraperStatus,

  // Legacy (backwards compatibility)
  fetchUrl,
  searchWeb,

  // Direkter Zugriff auf Scraper (für Tests)
  scraper,
};
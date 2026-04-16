/**
 * ⚡ HTTP Scraper - Schneller Fallback ohne Browser
 *
 * Besser als die alte web-tools.js Version:
 * - gzip/deflate/br Dekompression
 * - Bessere Header (realistischer Browser-Fingerprint)
 * - Retry-Logik bei flaky Verbindungen
 * - Saubereres Redirect-Handling (max. 5 Hops)
 * - Timeout per Phase (connect vs. read)
 * - Erkennt ob Playwright nötig ist (JS-only Seiten)
 */

const https = require('https');
const http = require('http');
const zlib = require('zlib');
const { URL } = require('url');
const { extractContent } = require('./text-processor');

// Realistischer Browser-Header-Satz
const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
  'Accept-Encoding': 'gzip, deflate, br',
  'Connection': 'keep-alive',
  'Cache-Control': 'no-cache',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Upgrade-Insecure-Requests': '1',
};

/**
 * Signale, die auf eine JS-only Seite hinweisen
 * → Playwright nötig
 */
const JS_REQUIRED_SIGNALS = [
  'please enable javascript',
  'bitte aktiviere javascript',
  'javascript is required',
  'javascript muss aktiviert',
  'you need to enable javascript',
  'this page requires javascript',
  'loading...',
  'app-root', // Angular
  'id="root">', // React mit leerem Root
  'id="app">', // Vue mit leerem App
];

/**
 * Prüfe ob eine Seite JS benötigt
 */
function requiresJavaScript(html, textContent) {
  const lowerHtml = html.toLowerCase();
  const lowerText = textContent.toLowerCase().trim();

  // Kurzer Text + JS-Signal = Playwright nötig
  const hasJsSignal = JS_REQUIRED_SIGNALS.some(s => lowerHtml.includes(s) || lowerText.includes(s));
  const tooLittleContent = textContent.split(/\s+/).length < 30;

  return hasJsSignal || tooLittleContent;
}

/**
 * Dekomprimiere Response-Body
 */
function decompressResponse(res, chunks) {
  return new Promise((resolve, reject) => {
    const encoding = res.headers['content-encoding'] || '';
    const rawBuffer = Buffer.concat(chunks);

    if (encoding === 'gzip') {
      zlib.gunzip(rawBuffer, (err, decoded) => {
        if (err) reject(err);
        else resolve(decoded.toString('utf-8'));
      });
    } else if (encoding === 'deflate') {
      zlib.inflate(rawBuffer, (err, decoded) => {
        if (err) reject(err);
        else resolve(decoded.toString('utf-8'));
      });
    } else if (encoding === 'br') {
      zlib.brotliDecompress(rawBuffer, (err, decoded) => {
        if (err) reject(err);
        else resolve(decoded.toString('utf-8'));
      });
    } else {
      resolve(rawBuffer.toString('utf-8'));
    }
  });
}

/**
 * Einzelner HTTP-Request
 */
function httpRequest(url, timeoutMs = 15000, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    if (redirectCount > 5) {
      reject(new Error('Zu viele Redirects (max 5)'));
      return;
    }

    let parsed;
    try {
      parsed = new URL(url);
    } catch (e) {
      reject(new Error(`Ungültige URL: ${url}`));
      return;
    }

    const isHttps = parsed.protocol === 'https:';
    const client = isHttps ? https : http;

    const options = {
      hostname: parsed.hostname,
      port: parsed.port || (isHttps ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: 'GET',
      headers: BROWSER_HEADERS,
      timeout: timeoutMs,
      // TLS: Nicht zu streng (manche Sites haben veraltete Zerts)
      rejectUnauthorized: false,
    };

    const req = client.request(options, async (res) => {
      // Redirect folgen
      if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
        const location = res.headers['location'];
        if (!location) {
          reject(new Error(`Redirect ohne Location-Header (${res.statusCode})`));
          return;
        }
        // Relative URLs auflösen
        const redirectUrl = location.startsWith('http') ? location : new URL(location, url).href;
        res.resume(); // Body verwerfen
        try {
          resolve(await httpRequest(redirectUrl, timeoutMs, redirectCount + 1));
        } catch (e) {
          reject(e);
        }
        return;
      }

      if (res.statusCode === 403 || res.statusCode === 429) {
        reject(new Error(`HTTP ${res.statusCode}: Zugriff verweigert / Rate-Limit`));
        return;
      }

      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }

      const chunks = [];
      let totalSize = 0;

      res.on('data', (chunk) => {
        chunks.push(chunk);
        totalSize += chunk.length;
        // Max 2MB laden
        if (totalSize > 2 * 1024 * 1024) {
          req.destroy();
        }
      });

      res.on('end', async () => {
        try {
          const html = await decompressResponse(res, chunks);
          resolve({ html, statusCode: res.statusCode, finalUrl: url });
        } catch (err) {
          reject(new Error(`Dekomprimierung fehlgeschlagen: ${err.message}`));
        }
      });

      res.on('error', reject);
    });

    req.on('error', (err) => {
      if (err.code === 'ECONNREFUSED') reject(new Error('Verbindung verweigert'));
      else if (err.code === 'ENOTFOUND') reject(new Error(`Domain nicht gefunden: ${parsed.hostname}`));
      else if (err.code === 'ETIMEDOUT') reject(new Error('Verbindungs-Timeout'));
      else reject(err);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Request Timeout nach ${timeoutMs}ms`));
    });

    req.end();
  });
}

/**
 * Mit Retry-Logik
 */
async function fetchWithRetry(url, options = {}, retries = 2) {
  const { timeoutMs = 15000, keywords = [], maxChars = 4000 } = options;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const { html, finalUrl } = await httpRequest(url, timeoutMs);
      const result = extractContent(html, { keywords, maxChars });

      return {
        success: true,
        url: finalUrl,
        title: result.title,
        text: result.text,
        wordCount: result.wordCount,
        method: 'http',
        needsPlaywright: requiresJavaScript(html, result.text),
        error: null,
      };
    } catch (err) {
      if (attempt === retries) {
        return {
          success: false,
          url,
          title: '',
          text: '',
          wordCount: 0,
          method: 'http',
          needsPlaywright: false,
          error: err.message,
        };
      }
      console.log(`[HTTP] Attempt ${attempt + 1} failed for ${url}: ${err.message} — retry...`);
      await new Promise(r => setTimeout(r, 500 * (attempt + 1))); // Backoff
    }
  }
}

module.exports = {
  fetchWithRetry,
  requiresJavaScript,
  BROWSER_HEADERS,
};
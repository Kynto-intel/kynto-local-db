/**
 * 📝 Text Processor - Intelligente Text-Extraktion
 *
 * Algorithmen:
 * 1. Readability-Score: Findet den "Haupt-Content" einer Seite
 * 2. Boilerplate-Entfernung: Nav, Header, Footer, Werbung weg
 * 3. Smart Context: Nur relevante Sätze rund um Keywords
 * 4. Sentence Scoring: Bewertet Sätze nach Informationsdichte
 */

// ============================================================================
// 🧹 BOILERPLATE REMOVAL
// ============================================================================

/**
 * Entferne häufige Boilerplate-Texte
 * (Cookie-Banner, Tracking-Hinweise, Nav-Texte etc.)
 */
const BOILERPLATE_PATTERNS = [
  /cookie[s]?\s*(richtlinie|einstellung|banner|zustimm)/gi,
  /datenschutz(richtlinie|erkl[äa]rung)?/gi,
  /impressum/gi,
  /newsletter (abonnieren|anmelden)/gi,
  /alle\s+rechte\s+vorbehalten/gi,
  /©\s*\d{4}/g,
  /loading\.\.\./gi,
  /javascript (ist|must be) (deaktiviert|disabled|required|enabled)/gi,
  /please enable javascript/gi,
  /bitte aktivier/gi,
  /skip to (main )?content/gi,
  /zum hauptinhalt/gi,
  /breadcrumb/gi,
  /share (on|via|this)/gi,
  /teilen auf/gi,
  /\d+\s*(minuten?|min)\s*lese?zeit/gi,
  /weiterlesen\.{0,3}$/gim,
  /mehr lesen\.{0,3}$/gim,
];

/**
 * Bereinige rohen Text von Boilerplate
 */
function removeBoilerplate(text) {
  let cleaned = text;
  for (const pattern of BOILERPLATE_PATTERNS) {
    cleaned = cleaned.replace(pattern, ' ');
  }
  return cleaned;
}

// ============================================================================
// 🎯 READABILITY SCORING (vereinfachter Readability-Algorithmus)
// ============================================================================

/**
 * Bewerte einen Textblock nach "Inhaltswert"
 * Hoher Score = wahrscheinlich Hauptcontent
 * Niedriger Score = wahrscheinlich Navigation/Boilerplate
 *
 * Basiert auf vereinfachtem Readability-Algorithmus (wie Mozilla Readability)
 */
function scoreTextBlock(text) {
  if (!text || text.trim().length < 20) return 0;

  let score = 0;
  const trimmed = text.trim();

  // Länge: Längere Blöcke sind wahrscheinlich Content
  const wordCount = trimmed.split(/\s+/).length;
  if (wordCount > 25) score += 25;
  if (wordCount > 50) score += 25;
  if (wordCount > 100) score += 25;

  // Satzzeichen: Echter Content hat Satzzeichen
  const punctCount = (trimmed.match(/[.!?,;:]/g) || []).length;
  score += Math.min(punctCount * 3, 30);

  // Komma-Dichte (Aufzählungen = guter Content)
  const commaRate = (trimmed.match(/,/g) || []).length / wordCount;
  if (commaRate > 0.05) score += 10;

  // Zu kurze "Wörter" = Navigation (viele 1-2 Zeichen Tokens)
  const shortWords = trimmed.split(/\s+/).filter(w => w.length <= 2).length;
  const shortWordRate = shortWords / wordCount;
  if (shortWordRate > 0.4) score -= 20; // Zu viele kurze Wörter = Navigation

  // Zahlen: Fakten/Content hat oft Zahlen
  const numberCount = (trimmed.match(/\d+/g) || []).length;
  if (numberCount > 0 && numberCount < wordCount * 0.3) score += 5;

  // Links-Dichte: Zu viele Links = Navigation
  const linkCount = (trimmed.match(/https?:\/\//g) || []).length;
  if (linkCount > 3) score -= 15;

  // Großbuchstaben-Häufung = Überschriften/Navigation
  const allCapsWords = trimmed.split(/\s+/).filter(w => w.length > 3 && w === w.toUpperCase()).length;
  if (allCapsWords > wordCount * 0.3) score -= 10;

  return score;
}

// ============================================================================
// 🔍 KEYWORD-BASIERTE EXTRAKTION (Smart Context)
// ============================================================================

/**
 * Extrahiere Sätze die Keywords enthalten (+/- Kontext-Sätze)
 *
 * @param {string} text - Bereinigter Text
 * @param {string[]} keywords - Suchbegriffe
 * @param {number} contextSentences - Sätze davor/danach einschließen
 * @param {number} maxChars - Maximale Zeichenanzahl der Ausgabe
 */
function extractByKeywords(text, keywords, contextSentences = 2, maxChars = 3000) {
  if (!keywords || keywords.length === 0) return text.substring(0, maxChars);

  // Text in Sätze aufteilen
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 15);

  if (sentences.length === 0) return text.substring(0, maxChars);

  const relevantIndices = new Set();
  const keywordsLower = keywords.map(k => k.toLowerCase().trim());

  sentences.forEach((sentence, idx) => {
    const lower = sentence.toLowerCase();
    const hasKeyword = keywordsLower.some(kw => lower.includes(kw));

    if (hasKeyword) {
      // Kontext-Sätze drumherum
      for (let i = Math.max(0, idx - contextSentences); i <= Math.min(sentences.length - 1, idx + contextSentences); i++) {
        relevantIndices.add(i);
      }
    }
  });

  if (relevantIndices.size === 0) {
    // Keine Keywords gefunden → Top-Sätze nach Score
    return getTopSentences(sentences, 10, maxChars);
  }

  const result = [...relevantIndices]
    .sort((a, b) => a - b)
    .map(i => sentences[i])
    .join(' ');

  return result.substring(0, maxChars);
}

/**
 * Hole die informativsten Sätze (wenn keine Keywords)
 */
function getTopSentences(sentences, count = 10, maxChars = 3000) {
  const scored = sentences.map((s, i) => ({
    text: s,
    score: scoreTextBlock(s),
    idx: i,
  }));

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, count)
    .sort((a, b) => a.idx - b.idx)
    .map(s => s.text)
    .join(' ')
    .substring(0, maxChars);
}

// ============================================================================
// 🧹 HTML → CLEAN TEXT
// ============================================================================

/**
 * Wandle HTML in sauberen Text um
 * Deutlich aggressiver als die Basis-Version in web-tools.js
 */
function htmlToCleanText(html) {
  if (!html) return '';

  let text = html
    // Entferne komplette unerwünschte Blöcke
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
    .replace(/<svg[\s\S]*?<\/svg>/gi, '')
    .replace(/<canvas[\s\S]*?<\/canvas>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' [NAV] ')
    .replace(/<header[\s\S]*?<\/header>/gi, ' [HEADER] ')
    .replace(/<footer[\s\S]*?<\/footer>/gi, ' [FOOTER] ')
    .replace(/<aside[\s\S]*?<\/aside>/gi, ' [ASIDE] ')
    // Block-Elemente → Zeilenumbruch
    .replace(/<\/(p|div|h[1-6]|li|tr|td|th|article|section|blockquote)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<hr\s*\/?>/gi, '\n---\n')
    // Inline-Formatierung erhalten (Semantik)
    .replace(/<strong>|<b>/gi, '')
    .replace(/<\/strong>|<\/b>/gi, '')
    .replace(/<em>|<i>/gi, '')
    .replace(/<\/em>|<\/i>/gi, '')
    // Alle übrigen Tags
    .replace(/<[^>]+>/g, ' ')
    // HTML Entities
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/&#\d+;/g, ' ')
    // Entferne Boilerplate-Sektionen
    .replace(/\[NAV\][\s\S]*?(?=\n\n|\[HEADER\]|\[FOOTER\]|\[ASIDE\]|$)/g, '\n')
    .replace(/\[HEADER\][\s\S]{0,500}?(?=\n\n|$)/g, '\n')
    .replace(/\[FOOTER\][\s\S]*/g, '')
    .replace(/\[ASIDE\][\s\S]*?(?=\n\n|$)/g, '\n')
    // URLs entfernen (unlesbar im Fließtext)
    .replace(/https?:\/\/[^\s<>"']+/g, '')
    // Whitespace normalisieren
    .replace(/[ \t]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return removeBoilerplate(text);
}

// ============================================================================
// 📊 CONTENT EXTRACTOR (Haupt-Funktion)
// ============================================================================

/**
 * Hauptfunktion: Extrahiere den relevantesten Text aus einer Seite
 *
 * @param {string} html - Roher HTML-Code
 * @param {Object} options
 * @param {string[]} options.keywords - Schlüsselwörter für Smart Context
 * @param {number} options.maxChars - Max. Zeichenanzahl (default: 4000)
 * @param {boolean} options.scoreBlocks - Nutze Block-Scoring (langsamer aber besser)
 * @returns {{ text: string, title: string, wordCount: number }}
 */
function extractContent(html, options = {}) {
  const { keywords = [], maxChars = 4000, scoreBlocks = true } = options;

  if (!html) return { text: '', title: '', wordCount: 0 };

  // Titel extrahieren
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim().replace(/\s+/g, ' ') : '';

  // Versuche <main>, <article>, [role="main"] zuerst (semantisch wichtig)
  let primaryContent = '';

  const contentSelectors = [
    /<main[\s\S]*?<\/main>/gi,
    /<article[\s\S]*?<\/article>/gi,
    /<div[^>]+(?:id|class)="[^"]*(?:content|main|article|post|body)[^"]*"[\s\S]*?<\/div>/gi,
    /<div[^>]+role="main"[\s\S]*?<\/div>/gi,
  ];

  for (const selector of contentSelectors) {
    const matches = html.match(selector);
    if (matches) {
      const combinedText = matches.map(m => htmlToCleanText(m)).join('\n\n');
      if (combinedText.length > 200) {
        primaryContent = combinedText;
        break;
      }
    }
  }

  // Fallback: Gesamten Body nehmen
  if (!primaryContent || primaryContent.length < 100) {
    primaryContent = htmlToCleanText(html);
  }

  // Block-Scoring (optional, für bessere Qualität)
  let finalText;
  if (scoreBlocks && primaryContent.length > 1000) {
    const paragraphs = primaryContent.split(/\n\n+/).filter(p => p.trim().length > 30);
    const scored = paragraphs
      .map(p => ({ text: p.trim(), score: scoreTextBlock(p) }))
      .filter(p => p.score > 0)
      .sort((a, b) => b.score - a.score);

    if (scored.length > 0) {
      // Nehme die besten Blöcke bis maxChars erreicht
      let combined = '';
      for (const block of scored) {
        if (combined.length + block.text.length > maxChars * 2) break;
        combined += block.text + '\n\n';
      }
      primaryContent = combined.trim();
    }
  }

  // Keywords-basierte Extraktion
  if (keywords.length > 0) {
    finalText = extractByKeywords(primaryContent, keywords, 2, maxChars);
  } else {
    finalText = primaryContent.substring(0, maxChars);
  }

  return {
    text: finalText.trim(),
    title,
    wordCount: finalText.split(/\s+/).length,
  };
}

/**
 * Limitiere Text auf maximale Wortanzahl
 */
function limitWords(text, maxWords = 1500) {
  const words = text.split(/\s+/);
  if (words.length <= maxWords) return text;
  return words.slice(0, maxWords).join(' ') + '\n\n[Text wurde gekürzt — original war länger]';
}

// ============================================================================
// ✅ EXPORTS
// ============================================================================

module.exports = {
  extractContent,
  htmlToCleanText,
  extractByKeywords,
  getTopSentences,
  scoreTextBlock,
  removeBoilerplate,
  limitWords,
};
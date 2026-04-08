/**
 * Kynto OS — Advanced Data-Morphing Engine v2.0
 *
 * Das „Gehirn" der UI: Analysiert PostgreSQL-Rohdaten vollautomatisch
 * und entscheidet, welches Layout (Standard-Grid, Rich-List, Gallery)
 * für den Nutzer am sinnvollsten ist.
 *
 * Kernaufgaben:
 *  1. Struktur-Analyse    — Header-Check auf Medien-Spalten
 *  2. Inhalts-Validierung — Data-Sampling (max. 20 Zeilen)
 *  3. Layout-Morphing     — Entscheidungsbaum für 4 Modi
 *  4. Performance-Schutz  — Lazy-Load-Flags & Renderer-Guards
 */

// ─── Konstanten ──────────────────────────────────────────────────────────────

/** Maximale Stichprobengröße zum Schutz vor großen Datensätzen */
const SAMPLE_SIZE = 20;

/** Schwellwerte für den Entscheidungsbaum */
const THRESHOLDS = {
  GALLERY:   0.80,   // ≥ 80 % Bild-Dichte → Gallery
  RICH_LIST: 0.20,   // ≥ 20 % Bild-Dichte → Rich-List
  // < 20 % → Standard-Grid
};

/** Spaltennamen-Schlüsselwörter für Medien-Erkennung (lowercase) */
const MEDIA_KEYWORDS = [
  'bild', 'bild_url', 'bild_link',
  'media', 'media_url',
  'image', 'image_url', 'img',
  'foto', 'foto_url',
  'photo', 'photo_url',
  'thumbnail', 'thumb',
  'avatar', 'cover',
  'url',         // Generisch – niedrige Priorität, siehe unten
];

/** Niedrig-Priorität Keywords (url allein ist kein sicherer Indikator) */
const LOW_PRIORITY_KEYWORDS = ['url'];

/** Regex-Pattern für gültige Bild-URLs */
const IMAGE_URL_PATTERN = /\.(jpe?g|png|webp|avif|gif|svg)(\?.*)?$/i;

/** Domains, die als Bild-Quellen gelten */
const IMAGE_DOMAINS = [
  'images.unsplash.com',
  'cdn.',
  'media.',
  'img.',
  'static.',
  'assets.',
  'storage.googleapis.com',
  'amazonaws.com',
  's3.',
];

// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────

/**
 * Prüft, ob ein String eine gültige Bild-URL ist.
 * @param {string} val
 * @returns {boolean}
 */
function isImageUrl(val) {
  if (typeof val !== 'string' || val.length < 5) return false;
  if (IMAGE_URL_PATTERN.test(val)) return true;
  return IMAGE_DOMAINS.some(domain => val.includes(domain));
}

/**
 * Klassifiziert eine Spalte nach ihrer Medien-Relevanz.
 * @param {string} colName
 * @returns {'high' | 'low' | 'none'}
 */
function classifyColumn(colName) {
  const name = colName.toLowerCase().trim();
  const isHighPriority = MEDIA_KEYWORDS
    .filter(k => !LOW_PRIORITY_KEYWORDS.includes(k))
    .some(k => name.includes(k));
  if (isHighPriority) return 'high';
  const isLowPriority = LOW_PRIORITY_KEYWORDS.some(k => name.includes(k));
  return isLowPriority ? 'low' : 'none';
}

/**
 * Gibt alle Medien-Spalten zurück, gewichtet nach Priorität.
 * @param {string[]} columns
 * @returns {{ col: string; priority: 'high' | 'low' }[]}
 */
function detectMediaColumns(columns) {
  return columns.reduce((acc, col) => {
    const priority = classifyColumn(col);
    if (priority !== 'none') acc.push({ col, priority });
    return acc;
  }, []);
}

/**
 * Berechnet Bild-Dichte für die Stichprobe.
 * @param {Record<string, unknown>[]} sample
 * @param {{ col: string; priority: 'high' | 'low' }[]} mediaColumns
 * @returns {{ count: number; density: number; weightedDensity: number }}
 */
function computeImageDensity(sample, mediaColumns) {
  if (sample.length === 0 || mediaColumns.length === 0) {
    return { count: 0, density: 0, weightedDensity: 0 };
  }

  let rawCount    = 0;
  let weightedSum = 0;
  const WEIGHT    = { high: 1.0, low: 0.5 };

  for (const row of sample) {
    for (const { col, priority } of mediaColumns) {
      const val = row[col];
      if (isImageUrl(val)) {
        rawCount++;
        weightedSum += WEIGHT[priority];
      }
    }
  }

  const total          = sample.length * mediaColumns.length;
  const totalWeighted  = sample.length *
    mediaColumns.reduce((s, { priority }) => s + WEIGHT[priority], 0);

  return {
    count:           rawCount,
    density:         rawCount / total,
    weightedDensity: totalWeighted > 0 ? weightedSum / totalWeighted : 0,
  };
}

/**
 * Erkennt, ob ein Datensatz hauptsächlich numerisch ist (z. B. Crawler-Daten).
 * @param {string[]} columns
 * @param {Record<string, unknown>[]} sample
 * @returns {boolean}
 */
function isNumericHeavy(columns, sample) {
  if (sample.length === 0) return false;
  let numericCells = 0;
  let totalCells   = 0;
  for (const row of sample) {
    for (const col of columns) {
      totalCells++;
      if (typeof row[col] === 'number' || !isNaN(Number(row[col]))) {
        numericCells++;
      }
    }
  }
  return numericCells / totalCells > 0.6;
}

// ─── Haupt-Engine ─────────────────────────────────────────────────────────────

export const DataMorphingEngine = {

  /**
   * Analysiert Spalten + Zeilen und gibt eine Layout-Entscheidung zurück.
   *
   * @param {string[]} columns        — Alle Spaltennamen der Tabelle
   * @param {Record<string, unknown>[]} rows — Zeilen aus PostgreSQL
   * @returns {LayoutDecision}
   *
   * @typedef {Object} LayoutDecision
   * @property {'GALLERY' | 'RICH_LIST' | 'STANDARD_GRID' | 'NUMERIC_GRID'} mode
   * @property {boolean} useVisualRenderer  — Soll der VisualCellRenderer aktiv sein?
   * @property {boolean} lazyLoadImages     — Lazy-Loading aktivieren?
   * @property {string}  reason             — Menschenlesbare Begründung
   * @property {string[]} mediaColumns      — Erkannte Medien-Spalten
   * @property {object}  meta               — Diagnostik-Daten (für Debugging)
   */
  determineLayout(columns, rows) {

    // ── 0. Eingabe-Guard ──────────────────────────────────────────────────
    if (!Array.isArray(columns) || columns.length === 0) {
      return this._decision('STANDARD_GRID', false, false,
        'No columns provided', [], { sampleSize: 0 });
    }

    // ── 1. Struktur-Analyse: Medien-Spalten erkennen ─────────────────────
    const detectedMediaColumns = detectMediaColumns(columns);
    const mediaColNames        = detectedMediaColumns.map(d => d.col);
    const hasHighPriorityCol   = detectedMediaColumns.some(d => d.priority === 'high');

    // ── 2. Inhalts-Validierung: Stichprobe ziehen ─────────────────────────
    const sample    = rows.slice(0, SAMPLE_SIZE);
    const { count, density, weightedDensity } = computeImageDensity(
      sample,
      detectedMediaColumns,
    );

    const meta = {
      sampleSize:      sample.length,
      totalRows:       rows.length,
      mediaColumns:    mediaColNames,
      imageCount:      count,
      imageDensity:    +density.toFixed(3),
      weightedDensity: +weightedDensity.toFixed(3),
    };

    // ── 3. Entscheidungsbaum (Layout-Morphing) ────────────────────────────

    // FALL A: Hohe gewichtete Bild-Dichte → Gallery
    if (weightedDensity >= THRESHOLDS.GALLERY && hasHighPriorityCol) {
      return this._decision(
        'GALLERY', true, true,
        `High media density (${(weightedDensity * 100).toFixed(0)}%) – Gallery activated`,
        mediaColNames, meta,
      );
    }

    // FALL B: Mittlere Bild-Dichte oder tatsächliche Bilder gefunden → Rich-List
    if (count > 0 && (weightedDensity >= THRESHOLDS.RICH_LIST || hasHighPriorityCol)) {
      return this._decision(
        'RICH_LIST', true, true,
        `Mixed data with media (${count} images found in sample)`,
        mediaColNames, meta,
      );
    }

    // FALL C: Header deutet auf Medien hin, aber Sample enthielt keine Bilder
    // → Rich-List vorbereiten, aber kein Lazy-Load erzwingen
    if (mediaColNames.length > 0 && hasHighPriorityCol) {
      return this._decision(
        'RICH_LIST', true, false,
        'Media column detected but no images in sample – prepared for Rich-List',
        mediaColNames, meta,
      );
    }

    // FALL D: Hauptsächlich numerische Daten → Numeric-Grid (kein Renderer)
    if (isNumericHeavy(columns, sample)) {
      return this._decision(
        'NUMERIC_GRID', false, false,
        'Numeric-heavy dataset – optimised grid without visual renderer',
        [], meta,
      );
    }

    // FALL E: Nur Text / keine Medien → Standard-Grid
    return this._decision(
      'STANDARD_GRID', false, false,
      'Pure text/mixed data – Standard Grid',
      [], meta,
    );
  },

  // ─── Private Builder ───────────────────────────────────────────────────────

  /**
   * @private
   * Erstellt ein einheitliches LayoutDecision-Objekt.
   */
  _decision(mode, useVisualRenderer, lazyLoadImages, reason, mediaColumns, meta) {
    return {
      mode,
      useVisualRenderer,
      lazyLoadImages,
      reason,
      mediaColumns,
      meta,
    };
  },

  // ─── Utility: Nur Spalten-Scan (ohne Zeilen) ──────────────────────────────

  /**
   * Schnell-Check: Gibt zurück, ob eine Tabelle potenziell Medien hat.
   * Nützlich, bevor die eigentlichen Rows geladen werden.
   *
   * @param {string[]} columns
   * @returns {{ hasMedia: boolean; columns: string[] }}
   */
  preflightCheck(columns) {
    const detected = detectMediaColumns(columns);
    return {
      hasMedia: detected.some(d => d.priority === 'high'),
      columns:  detected.map(d => d.col),
    };
  },
};

// Globaler Zugriff
window.DataMorphingEngine = DataMorphingEngine;

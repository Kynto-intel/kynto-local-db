/**
 * Entfernt den Hash-Teil einer URL.
 * @param {string} url 
 * @returns {string}
 */
export function sanitizeUrlHashParams(url) {
  return url.split('#')[0];
}

/**
 * Ein robuster Sanitizer für Arrays von Objekten.
 * - Redigiert Geheimnisse basierend auf Key-Namen (password, token, apiKey, etc.)
 * - Redigiert Geheimnisse basierend auf Mustern (IPv4/IPv6, AWS Keys, Bearer/JWT, generische lange Tokens)
 * - Rekursiv bis zu einer maxDepth, danach wird ein Hinweis eingesetzt
 * - Erkennt und behandelt zirkuläre Referenzen
 *
 * @param {any[]} inputArr - Das zu bereinigende Array (Nicht-Objekte werden so wie sie sind kopiert).
 * @param {Object} [opts] - Optionen
 * @param {number} [opts.maxDepth=3] - Maximale Tiefe der Rekursion (0 == nur oberste Ebene).
 * @param {string} [opts.redaction="[REDACTED]"] - Ersatztext für sensible Werte.
 * @param {string} [opts.truncationNotice="[REDACTED: max depth reached]"] - Hinweis bei Erreichen des Tiefenlimits.
 * @param {string[]} [opts.sensitiveKeys] - Zusätzliche sensible Key-Namen (Case-Insensitive).
 * @returns {any[]} Ein tiefenbereinigter Klon des Input-Arrays.
 */
export function sanitizeArrayOfObjects(inputArr, opts = {}) {
  const {
    maxDepth = 3,
    redaction = '[REDACTED]',
    truncationNotice = '[REDACTED: max depth reached]',
    sensitiveKeys = [],
  } = opts;

  // Häufige sensible Key-Namen (Case-Insensitive). Erweiterbar über opts.sensitiveKeys.
  const sensitiveKeySet = new Set(
    [
      'password', 'passwd', 'pwd', 'pass', 'secret', 'token',
      'id_token', 'access_token', 'refresh_token', 'apikey',
      'api_key', 'api-key', 'apiKey', 'key', 'privatekey',
      'private_key', 'client_secret', 'clientSecret', 'auth',
      'authorization', 'ssh_key', 'sshKey', 'bearer', 'session',
      'cookie', 'csrf', 'xsrf', 'ip', 'ip_address', 'ipAddress',
      'aws_access_key_id', 'aws_secret_access_key', 'gcp_service_account_key',
      ...sensitiveKeys,
    ].map((k) => k.toLowerCase())
  );

  // Wert-Muster, die oft auf PII oder Secrets hindeuten
  const patterns = [
    // IPv4
    { re: /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g, reason: 'ip' },
    // IPv6 (vereinfacht aber effektiv)
    { re: /\b(?:[A-Fa-f0-9]{1,4}:){2,7}[A-Fa-f0-9]{1,4}\b/g, reason: 'ip6' },
    // AWS Access Key ID
    { re: /\b(AKI|ASI)A[0-9A-Z]{16}\b/g, reason: 'aws_access_key_id' },
    // AWS Secret Access Key
    { re: /\b[0-9A-Za-z/+]{40}\b/g, reason: 'aws_secret_access_key_like' },
    // Bearer Tokens
    { re: /\bBearer\s+[A-Za-z0-9\-._~+/]+=*\b/g, reason: 'bearer' },
    // JWT
    { re: /\b[A-Za-z0-9-_]+?\.[A-Za-z0-9-_]+?\.[A-Za-z0-9-_]+?\b/g, reason: 'jwt_like' },
    // Generische lange Tokens
    { re: /\b[A-Za-z0-9_\-]{24,64}\b/g, reason: 'long_token' },
  ];

  const seen = new WeakMap();

  /** Hilfsfunktion: Ist es ein klassisches Plain-Object? */
  function isPlainObject(v) {
    if (v === null || typeof v !== 'object') return false;
    const proto = Object.getPrototypeOf(v);
    return proto === Object.prototype || proto === null;
  }

  /** Redigiert definierte Muster innerhalb eines Strings */
  function redactString(str) {
    let out = str;
    for (const { re } of patterns) {
      out = out.replace(re, redaction);
    }
    return out;
  }

  /** Prüft, ob ein Key aufgrund seines Namens redigiert werden sollte */
  function shouldRedactByKey(key) {
    return sensitiveKeySet.has(String(key).toLowerCase());
  }

  /** Die rekursive Kern-Logik */
  function sanitizeValue(value, depth) {
    if (
      value == null ||
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      typeof value === 'bigint'
    ) {
      return value;
    }

    if (typeof value === 'string') {
      return redactString(value);
    }

    if (typeof value === 'function') {
      return '[Function]';
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    if (value instanceof RegExp) {
      return value.toString();
    }

    // TypedArrays und Buffer-Views
    if (ArrayBuffer.isView(value) && !(value instanceof DataView)) {
      return `[TypedArray byteLength=${value.byteLength}]`;
    }
    if (value instanceof ArrayBuffer) {
      return `[ArrayBuffer byteLength=${value.byteLength}]`;
    }

    // Tiefenlimit greift
    if (depth >= maxDepth) {
      return truncationNotice;
    }

    if (typeof value === 'object') {
      // Zirkuläre Referenz abfangen
      if (seen.has(value)) {
        return '[Circular]';
      }

      // Array-Behandlung
      if (Array.isArray(value)) {
        const outArr = [];
        seen.set(value, outArr);
        for (let i = 0; i < value.length; i++) {
          outArr[i] = sanitizeValue(value[i], depth + 1);
        }
        return outArr;
      }

      // Objekt-Behandlung
      if (isPlainObject(value)) {
        const outObj = {};
        seen.set(value, outObj);
        for (const [k, v] of Object.entries(value)) {
          if (shouldRedactByKey(k)) {
            outObj[k] = redaction;
          } else {
            outObj[k] = sanitizeValue(v, depth + 1);
          }
        }
        return outObj;
      }

      // Map-Behandlung
      if (value instanceof Map) {
        const out = [];
        seen.set(value, out);
        for (const [k, v] of value.entries()) {
          const redactedKey = shouldRedactByKey(k) ? redaction : sanitizeValue(k, depth + 1);
          const redactedVal = shouldRedactByKey(k) ? redaction : sanitizeValue(v, depth + 1);
          out.push([redactedKey, redactedVal]);
        }
        return out;
      }

      // Set-Behandlung
      if (value instanceof Set) {
        const out = [];
        seen.set(value, out);
        for (const v of value.values()) {
          out.push(sanitizeValue(v, depth + 1));
        }
        return out;
      }

      if (value instanceof URL) return value.toString();
      
      if (value instanceof Error) {
        const o = {
          name: value.name,
          message: redactString(value.message),
          stack: truncationNotice,
        };
        seen.set(value, o);
        return o;
      }

      try {
        return redactString(String(value));
      } catch {
        return redactString(Object.prototype.toString.call(value));
      }
    }

    return redactString(String(value));
  }

  return inputArr.map((item) => sanitizeValue(item, 0));
}
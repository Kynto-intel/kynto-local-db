// modules/DataFormatter.js
// ============================================================
// Orchestriert alle Validator-Module aus ./validators/
//
// Validierungslogik anpassen? → Die jeweilige Datei öffnen:
//   IBAN          → validators/isIBAN.js        (Länder, Whitelist)
//   Kreditkarte   → validators/isCreditCard.js  (Netzwerke, Luhn-Pflicht)
//   Telefon       → validators/isMobilePhone.js (Locales, Fallback)
//   E-Mail        → validators/isEmail.js       (TLD, Domains, UTF-8)
//   URL           → validators/isURL.js         (Protokolle, Domains)
//   Datum         → validators/isDate.js        (Jahresbereich, Schaltjahr)
//   UUID          → validators/isUUID.js        (v1–v8, nil, max)
//   EAN           → validators/isEAN.js         (EAN-8/13/14)
//   IP-Adresse    → validators/isIP.js          (IPv4, IPv6 vollständig)
//   ISO 4217      → validators/isISO4217.js     (Währungscodes)
//   JWT           → validators/isJWT.js         (JSON Web Token)
//   ISO 8601      → validators/isISO8601.js     (Datetime mit Zeit+Zeitzone)
//   Regex-Match   → validators/matches.js       (Flexibel für Custom-Patterns)
//
// FIXES gegenüber v1:
//   [F1] IPv4-Check VOR Integer-Check → 999.999.999.999 = ipv4_invalid, nicht integer
//   [F2] Englische Floats mit Punkt (12.5, 3.14) werden erkannt
//   [F3] 0.0.0.0 wird korrekt als ipv4 erkannt (nicht als integer gefangen)
//   [F4] IBAN sanitizeIBAN() entfernt Punkte/Kommas → "DE 89 123.456,78" valid
//   [F5] Datum-Renderer: 2-stellige Jahre werden vollständig aufgelöst angezeigt
//        → "31.12.99" → "31.12.1999" (kein abgeschnittener Ellipsis-Anzeigefehler)
//   [F6] detect() für date_de ruft isDateDE() auf um ungültige Daten früh zu
//        fangen (32.13.2026 → sofort date_de_invalid statt date_de)
//   [F7] isEmail: requireTLD=false → admin@localhost ist gültig
//   [F8] float_en-Erkennung: Deutsches Tausendermuster wird nun korrekt ausgeschlossen
//        → "4.131" / "1.234" → integer (war fälschlich float_en)
//        → "3.14" / "12.5" → float_en (korrekt, unverändert)
//   [F10] Smart Column Detection erweitert:
//        Prozent: % / (%) / STEUERSATZ / RABATT / RATE / PERCENT / TAX / MWST / STEUER
//        → "19" in "STEUERSATZ (%)" → "19 %"   (war: "19" ohne Symbol)
//        Währung: EUR / € / BETRAG / PREIS / KOSTEN / NETTO / BRUTTO / AMOUNT / PRICE
//        → "80"   in "NETTO-BETRAG (EUR)" → "80,00 €"  (war: "80" ohne Symbol)
//        → "23"   in "PREIS"              → "23,00 €"  (war: "23" ohne Symbol)
//        Beide Renderer nutzen jetzt direkte toLocaleString-Formatierung statt
//        Weiterdelegierung an _renderCell, damit reine Integer korrekt behandelt werden.
//   [F9] isIdColumn-Heuristik: Dezimalwerte in _id-Spalten werden korrekt gerendert
//        → WEB_ID=4.131 → float_en-Renderer (war: id-Renderer → falsch "4131")
//        → ID=15.143   → id-Renderer → "15143" (unverändert korrekt)
//        → CLUSTER_ID=UUID → uuid-Renderer (unverändert korrekt)
// ============================================================

import { ibanStructureValid, ibanMod97, sanitizeIBAN, formatIBAN }       from './validators/isIBAN.js';
import { detectCCNetwork, luhnCheck, formatCreditCard }                  from './validators/isCreditCard.js';
import { isMobilePhone, formatPhone }                                    from './validators/isMobilePhone.js';
import { isEmailValid, formatEmail }                                     from './validators/isEmail.js';
import { isURLValid, formatURL }                                         from './validators/isURL.js';
import { isDateDE, isDateISO, toDE, toISO, formatDateDE, formatDateISO }       from './validators/isDate.js';
import { isUUID, detectUUIDVersion, formatUUID }                         from './validators/isUUID.js';
import { isEAN, formatEAN }                                              from './validators/isEAN.js';
import { isIPv4, isIPv6, formatIPv4, formatIPv6 }                        from './validators/isIP.js';
import { isISO4217Valid }                                                from './validators/isISO4217.js';
import { isJWT, formatJWT }                                              from './validators/isJWT.js';
import { isDatetime, formatDatetime }                                    from './validators/isISO8601.js';
import matches                                                           from './validators/matches.js';
import { isCurrency, formatCurrency }                                    from './validators/isCurrency.js';
import { isPercent, formatPercent }                                      from './validators/isPercent.js';
import { isBoolean, formatBoolean }                                      from './validators/isBoolean.js';
import { isColorHex, formatColorHex }                                    from './validators/isColorHex.js';
import { isMACAddress, formatMACAddress }                                from './validators/isMACAddress.js';
import { isCoordinates, formatCoordinates }                              from './validators/isCoordinates.js';
import { isFloat, formatFloat }                                          from './validators/isFloat.js';
import { isInteger, formatInteger }                                      from './validators/isInteger.js';

// ============================================================
export const DataFormatter = {

    // =========================================================================
    // DETECT
    // =========================================================================
    detect(value) {
        if (value === null || value === undefined) return 'empty';
        const s = value.toString().trim();
        if (s === '' || s.toLowerCase() === 'null') return 'empty';

        // ── 1. BOOLEAN ───────────────────────────────────────────────────────
        if (/^(true|false|yes|no|ja|nein)$/i.test(s)) return 'boolean';

        // ── 2. Visuelle Sonderzeichen ────────────────────────────────────────
        if (/^#([A-Fa-f0-9]{3}){1,2}$/.test(s)) return 'color_hex';
        if (/^@[a-zA-Z0-9_]{1,15}$/.test(s))    return 'social_handle';

        // ── 2.5 ISO Datetime (mit Zeit) - ORT 1 ───────────────────────────────
        // MOVE: VOR JWT damit "2022-01-01T13:00:00" nicht als JWT erkannt wird
        if (/^\d{4}-\d{2}-\d{2}T/.test(s) && isDatetime(s)) return 'datetime_iso';

        // ── 2.5b Verbose JS Date (Tue Mar 24 2026...) ────────────────────────
        if (/^[A-Z][a-z]{2} [A-Z][a-z]{2} \d{1,2} \d{4} \d{2}:\d{2}:\d{2} GMT/.test(s)) {
            const d = new Date(s);
            if (!isNaN(d.getTime())) return 'datetime_iso';
        }

        // ── 2.6 ISO-Datum YYYY-MM-DD - ORT 1 ───────────────────────────────────
        // VOR JWT damit "2022-01-01" nicht als JWT erkannt wird  
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return 'date_iso';

        // ── 2.7 Deutsches Datum DD.MM.YYYY - ORT 1 ─────────────────────────────────
        // VOR JWT damit "21.06.2022" nicht als JWT erkannt wird
        // Vereinfachte Regex: Ziffer(n) - Trennzeichen - Ziffer(n) - Trennzeichen - Ziffer(n-4)
        if (/^\d{1,2}[.\s\u2026\xA0-]+\d{1,2}[.\s\u2026\xA0-]+\d{2,4}/.test(s)) {
            const result = isDateDE(s);
            return result.valid ? 'date_de' : 'date_de_invalid';
        }

        // ── 3. JWT (vor URL, da Punkte enthalten) ────────────────────────────
        if (/^[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+$/.test(s) && isJWT(s).valid)
            return 'jwt';

        // ── 4. IBAN ──────────────────────────────────────────────────────────
        // [F4] sanitizeIBAN entfernt jetzt auch Punkte/Kommas
        if (ibanStructureValid(s)) return 'iban';
        // Partielle IBAN-Erkennung: 2 Buchstaben + 2 Ziffern + wenige Zeichen
        const ibanClean = sanitizeIBAN(s);
        if (/^[A-Z]{2}\d{2}[A-Z0-9]{1,10}$/.test(ibanClean) && ibanClean.length < 15)
            return 'iban_invalid';

        // ── 5. UUID ──────────────────────────────────────────────────────────
        // Entferne das Label beim Erkennen, falls es bereits existiert (z.B. durch UI-Refresh)
        const uuidClean = s.replace(/\s+/g, '').replace(/\(v[a-z0-9]+\)$/i, '');
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuidClean))
            return 'uuid';
        if (/^[0-9a-f]{8,}(?:-[0-9a-f]{4,})+$/i.test(uuidClean))
            return 'uuid_invalid';

        // ── 6. KREDITKARTE mit Separatoren ───────────────────────────────────
        const ccDigits = s.replace(/[ -]/g, '');
        if (s !== ccDigits && /^\d{13,19}$/.test(ccDigits)) {
            const groups = s.split(/[ -]/);
            if (groups.every(g => /^\d+$/.test(g)) &&
                Math.min(...groups.map(g => g.length)) >= 3 &&
                groups.length >= 3) return 'credit_card';
        }

        // ── 7. IPv6 (vor IPv4, da komplexer) ─────────────────────────────────
        if (isIPv6(s)) return 'ipv6';

        // ── 8. MAC-Adresse ───────────────────────────────────────────────────
        if (/^([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$/.test(s)) return 'mac_address';

        // ── 9. IPv4 — [F1] VOR Integer-Check! ────────────────────────────────
        // Muss VOR dem Integer-Check stehen, da "999.999.999.999" sonst
        // als integer (mit Tausenderpunkten) erkannt wird.
        if (isIPv4(s)) return 'ipv4';
        // Sieht aus wie IPv4 aber ungültig (falsche Oktette oder zu viele Segmente)
        if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(s) || /^\d{1,3}(?:\.\d{1,3}){4}$/.test(s))
            return 'ipv4_invalid';

        // ── 10. Uhrzeit ───────────────────────────────────────────────────────
        if (/^([01]\d|2[0-3]):([0-5]\d)(:([0-5]\d))?$/.test(s)) return 'time';

        // ── 11. Koordinaten ───────────────────────────────────────────────────
        if (/^-?\d{1,3}\.\d+,\s?-?\d{1,3}\.\d+$/.test(s)) return 'coordinates';

        // ── 12. URL ───────────────────────────────────────────────────────────
        if (isURLValid(s)) return 'url';

        // ── 13. E-Mail ────────────────────────────────────────────────────────
        if (isEmailValid(s)) return 'email';
        // Grob falsche E-Mail (hat @, aber Doppelpunkt in Domain)
        if (/^[^\s@]+@[^\s@]*\.\.[^\s@]*$/.test(s)) return 'email_invalid';

        // ════════════════════════════════════════════════════════════════════════════
        // Hier NICHT nochmal Währung → bereits oben in Punkt 2.7 geprüft!
        // ════════════════════════════════════════════════════════════════════════════

        // ── 14. ISO 4217 Währungscode (nur 3 Buchstaben, z.B. "EUR", "USD")

        // ── 19. Float (DE-Format mit Komma: 1.234,56 oder 3,14) ──────────────
        if (/^-?(?:\d{1,3}(?:\.\d{3})*|\d+),\d+$/.test(s)) return 'float';

        // ── 20. Float (EN-Format mit Punkt: 3.14, 12.5) — [F2] ───────────────
        // Nur erkennen wenn KEIN Tausender-Muster (nicht: 1.234 → das ist integer DE)
        // Muster: optionales Vorzeichen, mind. 1 Ziffer, Punkt, mind. 1 Ziffer
        // AUSSCHLUSS: wenn es wie eine IPv4 aussieht (bereits oben gefangen)
        // [F8] FIX: Explizit deutsches Tausendermuster ausschließen (war vorher nicht implementiert).
        //      "1.234" → integer (1234), "4.131" → integer (4131), "3.14" → float_en, "12.5" → float_en
        if (/^-?\d+\.\d+$/.test(s) && !s.includes(',') && !/^-?\d{1,3}(?:\.\d{3})+$/.test(s)) return 'float_en';

        // ── 21. Integer (DE-Format mit Tausenderpunkten: 1.000.000) ──────────
        if (/^-?\d{1,3}(?:\.\d{3})+$/.test(s)) return 'integer';
        // Integer ohne Separatoren
        // Erhöht von 12 auf 20 Ziffern, um 64-bit IDs (BigInt) zu unterstützen
        if (/^-?\d{1,20}$/.test(s)) return 'integer';

        // ── 21.5 PROZENTSATZ (NACH reinen Integern) ──────────────────────────
        if (isPercent(s)) return 'percent';

        // ── 21.7 EURO/WÄHRUNG (NACH Integern/Floats) ─────────────────────────
        // "2" wird jetzt zuerst als integer erkannt, "2,00 €" bleibt currency.
        if (isCurrency(s)) return 'currency';

        // ── 22. KREDITKARTE ohne Separatoren ──────────────────────────────────
        if (/^\d{13,19}$/.test(s) && detectCCNetwork(s) && luhnCheck(s))
            return 'credit_card';

        // ── 23. EAN Barcode (8/13/14 Stellen mit gültiger Prüfziffer) ─────────
        // Achtung: 13-stellige EANs würden oben als integer erkannt (> 12 Stellen)
        // → daher hier explizit nochmal prüfen
        if (/^\d{8}$|^\d{13}$|^\d{14}$/.test(s) && isEAN(s).valid) return 'ean';

        // ── 24. PLZ ───────────────────────────────────────────────────────────
        if (/^\d{5}$/.test(s)) return 'zip_code_de';

        // ── 25. TELEFON ───────────────────────────────────────────────────────
        if (isMobilePhone(s).valid) return 'phone';

        // ── 26. BIC ───────────────────────────────────────────────────────────
        if (/^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(s)) return 'bic';



        return 'text';
    },

    // =========================================================================
    // TYPE-KOMPATIBILITÄTS-TABELLE
    // =========================================================================
    typeCompatibility: {
        'uuid':           ['uuid'],
        'email':          ['email'],
        'url':            ['url'],
        'phone':          ['phone'],
        'iban':           ['iban'],
        'bic':            ['bic'],
        'social_handle':  ['social_handle'],
        'currency':       ['currency'],
        'currency_code':  ['currency_code'],
        'percent':        ['percent', 'integer', 'float'],
        'date_de':        ['date_de'],
        'date_iso':       ['date_iso'],
        'datetime_iso':   ['datetime_iso'],
        'ipv4':           ['ipv4'],
        'ipv6':           ['ipv6'],
        'color_hex':      ['color_hex'],
        'coordinates':    ['coordinates'],
        'boolean':        ['boolean'],
        'integer':        ['integer', 'zip_code_de', 'percent'],
        'float':          ['float', 'float_en', 'integer', 'percent'],
        'float_en':       ['float_en', 'float', 'integer', 'percent'],
        'mac_address':    ['mac_address'],
        'credit_card':    ['credit_card'],
        'zip_code_de':    ['zip_code_de', 'integer'],
        'ean':            ['ean'],
        'jwt':            ['jwt'],
        'text':           null,
        // ── DB-Typen (werden von DuckDB / externen Quellen geliefert) ─────────
        'numeric':        ['float', 'float_en', 'integer', 'zip_code_de', 'percent'],
        'decimal':        ['float', 'float_en', 'integer', 'percent'],
        'double':         ['float', 'float_en', 'integer', 'percent'],
        'real':           ['float', 'float_en', 'integer', 'percent'],
        'bigint':         ['integer', 'zip_code_de', 'percent'],
        'int':            ['integer', 'zip_code_de', 'percent'],
        'int4':           ['integer', 'zip_code_de', 'percent'],
        'int8':           ['integer', 'zip_code_de', 'percent'],
        'smallint':       ['integer', 'zip_code_de', 'percent'],
        'tinyint':        ['integer', 'zip_code_de', 'percent'],
        'hugeint':        ['integer', 'zip_code_de', 'percent'],
        'ubigint':        ['integer', 'zip_code_de', 'percent'],
        'varchar':        null,
        'string':         null,
        'char':           null,
        'blob':           null,
        'date':           ['date_iso', 'date_de'],
        'timestamp':      ['datetime_iso'],
        'timestamptz':    ['datetime_iso'],
        'time':           ['time'],
        'boolean':        ['boolean'],
    },

    // =========================================================================
    // FORMAT (ohne Kontext)
    // =========================================================================
    format(value) {
        return this._renderCell(value, this.detect(value));
    },

    // =========================================================================
    // FORMAT MIT SPALTEN-KONTEXT
    // =========================================================================

    // Normalisiert externe DB-Typbezeichner auf interne Typen.
    // Ermöglicht z.B. DuckDB "NUMERIC" → 'numeric', "VARCHAR" → 'text'.
    _normalizeExpectedType(rawType) {
        if (!rawType) return 'text';
        const t = rawType.toLowerCase().trim();
        // Direkte Weitergabe wenn bereits ein bekannter interner Typ
        if (this.typeCompatibility.hasOwnProperty(t)) return t;
        // Aliase für gängige DB-Schreibweisen
        const aliases = {
            'number':           'numeric',
            'num':              'numeric',
            'dbl':              'double',
            'float4':           'float',
            'float8':           'double',
            'int2':             'smallint',
            'int4':             'int',
            'int64':            'bigint',
            'uint64':           'ubigint',
            'integer':          'integer',
            'long':             'bigint',
            'short':            'smallint',
            'str':              'text',
            'character varying':'varchar',
            'nvarchar':         'varchar',
            'nchar':            'char',
            'text':             'text',
            'timestamp with time zone': 'timestamptz',
            'timestamp without time zone': 'timestamp',
            'bool':             'boolean',
        };
        return aliases[t] ?? 'text';
    },

    formatWithContext(value, expectedType) {
        const normType = this._normalizeExpectedType(expectedType);

        const isEmpty = (
            value === null || value === undefined || value === '' ||
            (typeof value === 'string' &&
             (value.trim() === '' || value.trim().toLowerCase() === 'null'))
        );
        if (isEmpty) return `<span class="text-gray-400"><i>Leer</i></span>`;

        const s = value.toString().trim();
        
        // ✅ FIX: Zuerst prüfen ob es ein erkannter Datums-Wert ist
        // Selbst wenn dominantType='text', Datums-Werte sollten formatiert werden
        const detected = this.detect(value);
        if (['datetime_iso', 'date_iso', 'date_de'].includes(detected)) {
            // Es ist ein Datum - nutze den auto-erkannten Typ, nicht den dominantType
            return this._renderCell(value, detected);
        }
        
        // ── Smart Column Detection: Wenn Spaltenname auf Währung/Preis hinweist ──
        // Erkennt: EUR, €, (EUR), (€), BETRAG, PREIS, KOSTEN, UMSATZ, NETTO, BRUTTO, AMOUNT, PRICE
        // z.B. "80" in Spalte "NETTO-BETRAG (EUR)" → "80,00 €"
        // z.B. "23" in Spalte "PREIS" → "23,00 €"
        if (typeof expectedType === 'string' && /EUR|€|\(EUR\)|\(€\)|BETRAG|PREIS|KOSTEN|UMSATZ|NETTO|BRUTTO|AMOUNT|PRICE|REVENUE|COST/i.test(expectedType)) {
            // Reinen Integer oder Float als Währungswert formatieren
            if (/^-?\d+(?:[.,]\d{1,2})?$/.test(s) || isCurrency(s)) {
                // Integer/Dezimal normalisieren und als Währung rendern
                const normalized = s.replace(',', '.');
                const num = parseFloat(normalized);
                if (!isNaN(num)) {
                    const formatted = num.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                    return `<span style="color:#86efac;font-variant-numeric:tabular-nums;">${formatted}&nbsp;€</span>`;
                }
            }
            // Bereits formatierter Währungswert
            if (isCurrency(s)) {
                return this._renderCell(s, 'currency');
            }
        }

        // ── Smart Column Detection: Wenn Spaltenname auf Prozentsatz hinweist ──
        // Erkennt: %, (%), PROZENT, STEUERSATZ, RABATT, RATE, PERCENT, TAX, MwSt
        // z.B. "19" in Spalte "STEUERSATZ (%)" → "19 %"
        // z.B. "7"  in Spalte "RABATT"         → "7 %"
        if (typeof expectedType === 'string' && /%|\(%\)|PROZENT|STEUERSATZ|RABATT|RATE|PERCENT|TAX|MWST|STEUER/i.test(expectedType)) {
            if (/^-?\d+(?:[.,]\d{1,2})?$/.test(s) || isPercent(s)) {
                const normalized = s.replace(',', '.');
                const num = parseFloat(normalized);
                if (!isNaN(num)) {
                    const formatted = Number.isInteger(num)
                        ? `${num}`
                        : num.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 2 });
                    return `<span style="color:#93c5fd;font-variant-numeric:tabular-nums;">${formatted}&nbsp;%</span>`;
                }
            }
            // Bereits formatierter Prozentwert
            if (isPercent(s)) {
                return this._renderCell(s, 'percent');
            }
        }

        // ── Smart Column Detection: ID-Spalten (ID, user_id, projekt_nr, UUID, etc.) ──
        // Wir nutzen Wortgrenzen (\b), damit "ID", "id", "User_ID" etc. sicher erkannt werden,
        // selbst wenn der Name in Klammern steht oder Sonderzeichen enthält.
        const ctx = typeof expectedType === 'string' ? expectedType.toLowerCase() : '';
        const isIdColumn = /\b(id|uuid|guid|pk|fk|uid|oid)\b/i.test(ctx) || 
                           /(_id|_nr|_key|_pk|_fk)$/i.test(ctx) ||
                           /^(pk_|fk_|id_)/i.test(ctx);

        if (isIdColumn || detected === 'uuid') {
            // Falls es eine UUID ist, nutzen wir den speziellen UUID-Renderer (wegen der Versions-Labels)
            if (detected === 'uuid') return this._renderCell(value, 'uuid');

            // [F9] FIX: Dezimalwerte in _id-Spalten korrekt rendern.
            // Spalten wie WEB_ID enden auf _id, enthalten aber Dezimalzahlen (z.B. 4.131, 1.874).
            // Nach Fix F8 werden solche Werte als 'integer' (dt. Tausender) erkannt.
            // Heuristik: Wenn der Ganzzahlteil einstellig ist (1-9) UND genau 3 Nachkommastellen
            // vorliegen, ist es mit hoher Wahrscheinlichkeit eine Dezimalzahl und KEIN formatierter
            // Integer (1.874 != 1874). Fuer multi-stellige Integer-Teile (15.143 -> 15143) bleibt
            // das ID-Rendering aktiv.
            if (detected === 'integer' && /^-?\d\.\d{3}$/.test(s)) {
                return this._renderCell(s, 'float_en');
            }
            // float_en: falls doch noch ein echter EN-Float in einer ID-Spalte landet
            if (detected === 'float_en') {
                return this._renderCell(s, 'float_en');
            }

            // Fuer alles andere in einer ID-Spalte (Zahlen "15143", Custom-IDs "REF-123"):
            // Wir erzwingen den 'id' Typ. Das verhindert Tausenderpunkte (15.144) 
            // und sorgt fuer ein technisches Monospace-Design.
            return this._renderCell(s, 'id');
        }

        // ✅ FIX: Nutze den aktuell erkannten Typ statt erneut zu detect() (Performance)
        // const detectedType = this.detect(value); <- wird nicht nötig, 'detected' ist bereits gesetzt

        if (normType === 'text' || normType === 'varchar' || normType === 'char' ||
            normType === 'string' || normType === 'blob') {
            return this._renderCell(value, detected);
        }

        const compat = this.typeCompatibility[normType];
        if (!compat || !compat.includes(detected) || detected.endsWith('_invalid')) {
            return this._renderInvalid(s, normType);
        }
        return this._renderCell(value, detected);
    },

    // =========================================================================
    // RENDERER
    // =========================================================================
    _renderCell(value, type) {
        if (type === 'empty') return `<span class="text-gray-400"><i>Leer</i></span>`;
        const s = value.toString().trim().replace(/\s{2,}/g, ' ');

        switch (type) {

            // ── Identifikatoren (IDs, Primärschlüssel etc.) ──────────────────
            case 'id': {
                // IDs bereinigen: Alle Punkte, Kommas und Leerzeichen entfernen.
                const cleanId = s.replace(/[\.\s,]/g, '');
                // Schöneres Design: Als technischer Badge in Monospace
                return `<span style="font-family:var(--font-mono);font-size:0.85em;color:var(--accent);background:rgba(194, 154, 64, 0.12);padding:1px 5px;border-radius:4px;font-weight:600;border:1px solid rgba(194, 154, 64, 0.2);display:inline-block;white-space:nowrap;">${cleanId}</span>`;
            }

            // ── Kommunikation ─────────────────────────────────────────────────
            case 'email': {
                const formatted = formatEmail(s);
                return formatted ? `<a href="mailto:${formatted}" style="color:#60a5fa;">${formatted}</a>` : this._renderInvalid(s, 'email');
            }
            case 'url': {
                const formatted = formatURL(s);
                return formatted ? `<a href="${formatted}" target="_blank" style="color:#60a5fa;">${s}</a>` : this._renderInvalid(s, 'url');
            }
            case 'phone': {
                const formatted = formatPhone(s);
                return formatted ? `<a href="tel:${formatted}" style="color:#60a5fa;">${s}</a>` : this._renderInvalid(s, 'phone');
            }
            case 'social_handle':
                return `<span style="color:#a78bfa;">${s}</span>`;

            // ── Farbe ──────────────────────────────────────────────────────────
            case 'color_hex': {
                const formatted = formatColorHex(s);
                if (!formatted) return this._renderInvalid(s, 'color_hex');
                const hex = formatted.replace('🎨 ', '');
                return `<span style="display:inline-flex;align-items:center;gap:6px;">
                    <span style="display:inline-block;width:14px;height:14px;border-radius:3px;background:${hex};border:1px solid #444;"></span>
                    ${hex}</span>`;
            }

            // ── IBAN ───────────────────────────────────────────────────────────
            case 'iban': {
                const formatted = formatIBAN(s);
                return formatted || this._renderInvalid(s, 'iban');
            }
            case 'iban_invalid':
                return this._renderInvalid(s, 'iban');

            // ── Kreditkarte ────────────────────────────────────────────────────
            case 'credit_card': {
                const formatted = formatCreditCard(s);
                return formatted || this._renderInvalid(s, 'credit_card');
            }

            // ── Währung ────────────────────────────────────────────────────────
            case 'currency': {
                // Validator + Formatter macht ALLES selbst
                const formatted = formatCurrency(s);
                return formatted || this._renderInvalid(s, 'currency');
            }
            case 'currency_code':
                return `<span title="ISO 4217 Währungscode" style="font-family:monospace;font-weight:600;">${s.toUpperCase()}</span>`;

            // ── Datum & Zeit ───────────────────────────────────────────────────
            // [F5] Datum wird immer vollständig mit 4-stelliger Jahreszahl angezeigt
            case 'date_de': {
                // Validator + Formatter macht ALLES selbst
                const formatted = formatDateDE(s);
                return formatted || this._renderInvalid(s, 'date_de');
            }
            case 'date_de_invalid':
                return this._renderInvalid(s, 'date_de');

            case 'date_iso': {
                // Validator + Formatter macht ALLES selbst
                const formatted = formatDateISO(s);
                return formatted || this._renderInvalid(s, 'date_iso');
            }

            case 'datetime_iso': {
                try {
                    const d = new Date(s);
                    if (isNaN(d.getTime())) return this._renderInvalid(s, 'datetime_iso');
                    const date = toDE(d.getUTCDate(), d.getUTCMonth() + 1, d.getUTCFullYear());
                    const time = `${String(d.getUTCHours()).padStart(2,'0')}:${String(d.getUTCMinutes()).padStart(2,'0')}`;
                    return `${date} ${time}`;
                } catch {
                    return this._renderInvalid(s, 'datetime_iso');
                }
            }

            case 'time':
                return s;

            // ── Prozentsatz ────────────────────────────────────────────────────
            // Zeige als Prozentsatz mit %-Symbol
            case 'percent': {
                // Validator + Formatter macht ALLES selbst
                const formatted = formatPercent(s);
                return formatted || this._renderInvalid(s, 'percent');
            }

            // ── Boolean ───────────────────────────────────────────────────────
            case 'boolean':
                if (/^(true|yes|ja|1)$/i.test(s))  return '✅ Ja';
                if (/^(false|no|nein|0)$/i.test(s)) return '❌ Nein';
                return this._renderInvalid(s, 'boolean');

            // ── UUID ──────────────────────────────────────────────────────────
            // ── UUID ──────────────────────────────────────────────────────────
            case 'uuid': {
                const version = detectUUIDVersion(s);
                const cleanUuid = s.toLowerCase().replace(/\s*\(v[a-z0-9]+\)$/i, '');
                if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanUuid)) {
                    return this._renderInvalid(s, 'uuid');
                }
                const label = version ? `<small style="opacity:0.5;margin-left:4px;font-weight:normal;">(v${version})</small>` : '';
                return `<span style="font-family:var(--font-mono);font-size:0.9em;color:var(--text);">${cleanUuid}${label}</span>`;
            }
            case 'uuid_invalid':
                return this._renderInvalid(s, 'uuid');

            // ── EAN ───────────────────────────────────────────────────────────
            case 'ean': {
                const formatted = formatEAN(s);
                return formatted ? `<span style="font-family:monospace;">${formatted}</span>` : this._renderInvalid(s, 'ean');
            }

            // ── JWT ───────────────────────────────────────────────────────────
            case 'jwt': {
                const formatted = formatJWT(s);
                return formatted ? `<span style="font-family:monospace;font-size:.8em;" title="${s}">${formatted}</span>` : this._renderInvalid(s, 'jwt');
            }

            // ── Netzwerk ──────────────────────────────────────────────────────
            case 'ipv4': {
                const formatted = formatIPv4(s);
                return formatted || this._renderInvalid(s, 'ipv4');
            }
            case 'ipv4_invalid':
                return this._renderInvalid(s, 'ipv4');
            case 'ipv6': {
                const formatted = formatIPv6(s);
                return formatted ? `<span style="font-family:monospace;font-size:.9em;">${formatted}</span>` : this._renderInvalid(s, 'ipv6');
            }
            case 'mac_address': {
                const formatted = formatMACAddress(s);
                return formatted || this._renderInvalid(s, 'mac_address');
            }

            // ── Koordinaten ───────────────────────────────────────────────────
            case 'coordinates': {
                const formatted = formatCoordinates(s);
                return formatted || this._renderInvalid(s, 'coordinates');
            }

            // ── Zahlen ────────────────────────────────────────────────────────
            case 'float_en': {
                const formatted = formatFloat(s, 'en-US');
                return formatted || this._renderInvalid(s, 'float');
            }
            case 'float': {
                const formatted = formatFloat(s, 'de-DE');
                return formatted || this._renderInvalid(s, 'float');
            }
            case 'integer': {
                const formatted = formatInteger(s, 'de-DE');
                return formatted || this._renderInvalid(s, 'integer');
            }

            // ── Boolean ────────────────────────────────────────────────────────
            case 'boolean': {
                const formatted = formatBoolean(s);
                return formatted || this._renderInvalid(s, 'boolean');
            }

            // ── Datetime ───────────────────────────────────────────────────────
            case 'datetime_iso': {
                const formatted = formatDatetime(s);
                return formatted || this._renderInvalid(s, 'datetime_iso');
            }

            case 'text':
            default:
                return s;
        }
    },

    // =========================================================================
    // FEHLER-RENDERER
    // =========================================================================
    _renderInvalid(raw, expectedType) {
        return `<span title="Ungültiger Wert – erwartet: ${expectedType || 'unbekannt'}" style="color:#f87171;display:inline-flex;align-items:center;gap:4px;cursor:default;">⚠️ <span style="text-decoration:underline dotted #f87171;">${raw}</span></span>`;
    },

    // =========================================================================
    // SPALTEN-PROFILING
    // =========================================================================
    profileColumn(columnName, values) {
        const totalRows = values.length;
        if (totalRows === 0) return { columnName, dominantType: 'empty', stats: {} };

        const typeCounts = {};
        values.forEach(v => {
            const t = this.detect(v);
            typeCounts[t] = (typeCounts[t] || 0) + 1;
        });

        // Ungültige Typen werden auf ihren Basistyp gemappt für die Profiling-Statistik
        const toBase = t => ({
            ipv4_invalid:     'ipv4',
            uuid_invalid:     'uuid',
            email_invalid:    'email',
            iban_invalid:     'iban',
            currency_invalid: 'currency',
            date_de_invalid:  'date_de',
            float_en:         'float',
        }[t] || t);

        const baseCounts = {};
        Object.entries(typeCounts).forEach(([t, n]) => {
            const b = toBase(t);
            baseCounts[b] = (baseCounts[b] || 0) + n;
        });

        let dominantType = 'text', maxCount = 0;
        Object.entries(baseCounts).forEach(([type, count]) => {
            if (type !== 'empty' && count > maxCount) { maxCount = count; dominantType = type; }
        });

        const stats = Object.entries(typeCounts)
            .map(([type, count]) => ({ type, count, percentage: +((count / totalRows) * 100).toFixed(1) }))
            .sort((a, b) => b.count - a.count);

        const invalidCount = values.filter(v => {
            const t = this.detect(v);
            if (t === 'empty') return false;
            const compat = this.typeCompatibility[dominantType];
            if (!compat) return false;
            return !compat.includes(t);
        }).length;

        return {
            columnName, dominantType, totalRows,
            emptyCount:   typeCounts['empty'] || 0,
            invalidCount,
            fillRate: (((totalRows - (typeCounts['empty'] || 0)) / totalRows) * 100).toFixed(1),
            stats,
        };
    },

    // =========================================================================
    // STANDARDIZE (Lokale Formate → ISO)
    // =========================================================================
    standardize(value, type) {
        if (!value) return null;
        let s = value.toString().trim();

        // 🔥 ABSOLUTER FIX: Entfernt UI-Labels wie " (v4)", " (vnil)" etc. IMMER zuerst.
        // Das schützt davor, dass formatierte UUIDs jemals in die Datenbank gelangen,
        // selbst wenn der 'type' Parameter nicht exakt 'uuid' ist (z.B. bei 'text').
        s = s.replace(/\s*\(v[a-z0-9]+\)$/i, '');

        if (type === 'uuid' || type === 'id') {
            return s.toLowerCase();
        }
        if (type === 'date_de') {
            const result = isDateDE(s);
            if (result.valid) return toISO(result.day, result.month, result.year);
            return null;
        }
        if (type === 'datetime_iso') {
            try {
                const d = new Date(s);
                if (!isNaN(d.getTime())) return d.toISOString();
            } catch { /* */ }
            return null;
        }
        if (type === 'iban') return sanitizeIBAN(s);
        if (type === 'currency_code') return s.trim().toUpperCase();
        return value;
    },

    // =========================================================================
    // DUCKDB SCHEMA
    // =========================================================================
    getDuckDbType(type) {
        return ({
            integer:       'BIGINT',
            float:         'DOUBLE',
            float_en:      'DOUBLE',
            boolean:       'BOOLEAN',
            date_iso:      'DATE',
            date_de:       'DATE',
            datetime_iso:  'TIMESTAMPTZ',
            time:          'TIME',
            uuid:          'UUID',
            email:         'VARCHAR',
            iban:          'VARCHAR',
            phone:         'VARCHAR',
            credit_card:   'VARCHAR',
            ean:           'VARCHAR',
            jwt:           'VARCHAR',
            currency_code: 'VARCHAR',
            url:           'VARCHAR',
            bic:           'VARCHAR',
            mac_address:   'VARCHAR',
            ipv4:          'VARCHAR',
            ipv6:          'VARCHAR',
            color_hex:     'VARCHAR',
            coordinates:   'VARCHAR',
            social_handle: 'VARCHAR',
            currency:      'VARCHAR',
            zip_code_de:   'VARCHAR',
            text:          'VARCHAR',
            empty:         'VARCHAR',
        })[type] || 'VARCHAR';
    },

    generateDuckDbSchema(tableName, profiledColumns) {
        if (!profiledColumns?.length) return '';
        const defs = profiledColumns.map(col => {
            const name = col.columnName.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
            return `    ${name} ${this.getDuckDbType(col.dominantType)}`;
        });
        return `CREATE TABLE ${tableName} (\n${defs.join(',\n')}\n);`;
    },
};
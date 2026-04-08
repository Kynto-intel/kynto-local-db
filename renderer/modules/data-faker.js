// ── data-faker.js ──────────────────────────────────────────────────────────────
// Strategie: TYP-FIRST → NAME-SECOND
//
// Für jeden Spaltenwert wird zuerst der SQL-Datentyp ausgewertet. Das bedeutet:
//   - inet       → immer eine IP-Adresse, egal ob die Spalte "ip_adresse",
//                  "client_ip", "server_addr" oder irgendwas heißt
//   - time       → immer HH:MM:SS
//   - date       → immer YYYY-MM-DD
//   - uuid       → immer eine UUID
//   ...und so weiter.
//
// Der Spaltenname verfeinert das Ergebnis nur noch INNERHALB eines Typs:
//   - integer + name enthält "jahr"  → Jahreszahl
//   - text    + name enthält "email" → E-Mail-Adresse
//
// Das JSON ist INLINE eingebettet. Kein fetch(), kein import assert.
// Das verhindert ERR_FILE_NOT_FOUND in Electron und jede Browser-CSP-Blockade.
// ──────────────────────────────────────────────────────────────────────────────

import { fakerDE as faker } from 'https://esm.sh/@faker-js/faker';

// ── Inline-Daten ──────────────────────────────────────────────────────────────
const D = {
  person: {
    vornamen_maennlich: ["Max","Lukas","Felix","Moritz","Jakob","Tom","Noah","Elias","Jonas","Leon","Luca","Tim","Finn","Ben","Julian","David","Simon","Nico","Tobias","Patrick","Stefan","Markus","Andreas","Christian","Michael","Thomas","Daniel","Alexander","Florian","Sebastian","Jan","Philipp","Oliver","Kevin","Fabian","Dominik"],
    vornamen_weiblich:  ["Julia","Sophie","Emma","Marie","Lena","Laura","Anna","Sarah","Lisa","Hannah","Lea","Mia","Clara","Nina","Katharina","Jana","Alina","Vanessa","Sandra","Sabine","Nicole","Stefanie","Melanie","Jessica","Christina","Claudia","Petra","Monika","Franziska","Johanna","Theresa","Maria","Elena","Nele","Lara","Amelie"],
    nachnamen:          ["Müller","Schmidt","Schneider","Fischer","Weber","Meyer","Wagner","Becker","Schulz","Hoffmann","Koch","Bauer","Richter","Klein","Wolf","Schröder","Neumann","Schwarz","Zimmermann","Braun","Krüger","Hofmann","Hartmann","Lange","Schmitt","Werner","Schmitz","Krause","Meier","Lehmann","Huber","Mayer","Herrmann","Kaiser","Fuchs","Lang","Stein","Roth","Frank","Berger","Keller","Böhm","Haas","Vogt"],
    titel:              ["Dr.","Prof. Dr.","Dipl.-Ing.","M.Sc.","B.A.","M.A.","Dr. med.","Prof."],
    benutzernamen_suffix: ["42","99","123","2024","007","de","01","pro","xyz","_dev","_net"],
  },
  kontakt: {
    email_domains:         ["gmail.com","outlook.de","web.de","gmx.net","gmx.de","yahoo.de","t-online.de","freenet.de","posteo.de","protonmail.com","icloud.com","kynto.io","testmail.de","mailbox.org"],
    strassen:              ["Hauptstraße","Schulstraße","Gartenstraße","Bahnhofstraße","Birkenweg","Amselweg","Kirchplatz","Goethestraße","Ringstraße","Bergstraße","Waldstraße","Rosenweg","Lindenstraße","Friedrichstraße","Bismarckstraße","Mozartstraße","Schillerstraße","Beethovenstraße","Lessingstraße","Am Markt","Kirchgasse","Mühlweg","Fasanenstraße","Dorfstraße","Wiesenweg","Tannenstraße","Buchenallee"],
    staedte:               ["Berlin","Hamburg","München","Köln","Frankfurt am Main","Stuttgart","Düsseldorf","Leipzig","Dortmund","Essen","Bremen","Dresden","Hannover","Nürnberg","Duisburg","Bochum","Wuppertal","Bonn","Bielefeld","Münster","Karlsruhe","Mannheim","Augsburg","Wiesbaden","Gelsenkirchen","Mönchengladbach","Braunschweig","Chemnitz","Kiel","Aachen","Halle","Magdeburg","Freiburg","Krefeld","Lübeck","Oberhausen","Erfurt","Rostock","Mainz","Kassel"],
    bundeslaender:         ["Baden-Württemberg","Bayern","Berlin","Brandenburg","Bremen","Hamburg","Hessen","Mecklenburg-Vorpommern","Niedersachsen","Nordrhein-Westfalen","Rheinland-Pfalz","Saarland","Sachsen","Sachsen-Anhalt","Schleswig-Holstein","Thüringen"],
    postleitzahlen_prefix: ["1","2","3","4","5","6","7","8","9"],
    telefon_vorwahlen:     ["030","040","089","0221","069","0711","0211","0341","0231","0201","0421","0351","0511","0911","0234","0202","0228","0521","0251"],
  },
  business: {
    firmen_prefix: ["Alpha","Beta","Delta","Omega","Nova","Prime","Next","Smart","Digital","Green","Blue","Gold","Tech","Net","Web","Cloud","Cyber","Kynto","Velo","Aero","Infra","Data","Open","Fast","Global","Euro"],
    firmen_suffix: ["GmbH","AG","UG","GmbH & Co. KG","e.K.","KG","OHG","GbR","Solutions","Systems","Technologies","Media","Digital","Group","Services","Consulting","Engineering","Software","Networks"],
    abteilungen:   ["IT","Marketing","HR","Sales","Finance","Support","R&D","Logistics","Vertrieb","Einkauf","Buchhaltung","Recht","Compliance","Sicherheit","Produktion","Qualitätssicherung","Projektmanagement","Strategie","Kundenservice","Öffentlichkeitsarbeit","Business Development"],
    positionen:    ["Manager","Senior Developer","Junior Developer","Designer","CEO","CTO","CFO","Consultant","Analyst","Team Lead","Scrum Master","Product Owner","DevOps Engineer","Data Scientist","UX Designer","Marketing Manager","Vertriebsleiter","Projektleiter","Systemadministrator","Datenbankadministrator","Sachbearbeiter","Buchhalter","Jurist","Praktikant","Werkstudent","Abteilungsleiter"],
    branchen:      ["Software","E-Commerce","Finanzen","Gesundheit","Bildung","Medien","Logistik","Immobilien","Energie","Automotive","Tourismus","Gastronomie","Handel","Industrie","Beratung","Telekommunikation","Versicherung"],
    preise:        [9.99,14.99,19.99,24.99,29.99,39.99,49.99,59.99,79.99,99.99,119.99,149.99,199.99,249.99,299.99,399.99,499.99,699.99,999.99],
  },
  system: {
    status_allgemein:  ["active","inactive","pending","archived","deleted","blocked","draft","published","paused","expired"],
    status_moderation: ["offen","in_bearbeitung","erledigt","abgelehnt","eskaliert","geloescht","freigegeben"],
    status_zahlung:    ["pending","paid","failed","refunded","cancelled","processing","disputed"],
    status_versand:    ["pending","processing","shipped","delivered","returned","lost"],
    prioritaet:        ["low","medium","high","critical","blocker"],
    rollen:            ["superadmin","admin","moderator","editor","author","viewer","guest","banned"],
    sprachen:          ["de","en","fr","es","it","nl","pl","pt","ru","zh"],
    waehrungen:        ["EUR","USD","GBP","CHF","JPY","CAD"],
    file_ext:          ["jpg","jpeg","png","gif","webp","svg","pdf","docx","xlsx","pptx","txt","csv","json","xml","zip","mp4","mp3"],
    mime_types:        ["image/jpeg","image/png","image/gif","image/webp","image/svg+xml","application/pdf","application/msword","text/plain","text/csv","application/json","application/xml","application/zip","video/mp4","audio/mpeg"],
    log_level:         ["DEBUG","INFO","WARNING","ERROR","CRITICAL"],
    umgebungen:        ["development","staging","production","testing","local"],
  },
  web: {
    farben_hex:    ["#FF6B6B","#4ECDC4","#45B7D1","#96CEB4","#FFEAA7","#DDA0DD","#98D8C8","#F7DC6F","#BB8FCE","#85C1E9","#82E0AA","#F0B27A","#AED6F1","#A9DFBF","#FF0000","#00FF00","#0000FF","#1ABC9C","#2ECC71","#3498DB","#9B59B6","#F39C12","#E74C3C"],
    user_agents:   ["Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36","Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15","Mozilla/5.0 (X11; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/115.0","Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1"],
    http_status:   [200,201,204,301,302,400,401,403,404,409,422,429,500,502,503],
    http_methoden: ["GET","POST","PUT","PATCH","DELETE"],
    protokolle:    ["https","http"],
    url_pfade:     ["/","/home","/about","/contact","/blog","/news","/products","/services","/api/v1/users","/api/v1/posts","/api/v2/data","/dashboard","/profile","/settings","/login","/register","/search","/faq","/impressum","/datenschutz"],
  },
  inhalt: {
    kategorien:    ["Politik","Wirtschaft","Sport","Technologie","Wissenschaft","Kultur","Unterhaltung","Reisen","Gesundheit","Bildung","Umwelt","Lifestyle","Automobil","Finanzen","Immobilien","Gastronomie","Mode","Gaming"],
    tags:          ["wichtig","dringend","neu","aktuell","beliebt","empfohlen","trending","featured","premium","kostenlos","beta","alpha","stable","deprecated","archived","pinned","verified","sponsored","breaking","exklusiv"],
    kommentare:    ["Sehr hilfreicher Beitrag, danke!","Interessante Perspektive, aber ich sehe das anders.","Wann wird das Problem behoben?","Super erklärt, genau was ich gesucht habe.","Gibt es dazu weitere Informationen?","Das funktioniert bei mir leider nicht.","Vielen Dank für die schnelle Hilfe!","Bitte mehr solche Inhalte!","Toller Artikel, weiter so!","Hat mir sehr geholfen, danke!"],
    grund_meldung: ["Spam","Beleidigung","Falsche Informationen","Urheberrechtsverletzung","Unangemessener Inhalt","Werbung","Betrug","Hassrede","Off-Topic","Doppelter Beitrag","Veraltete Informationen","Technischer Fehler"],
    verstoss_typ:  ["spam","abuse","hate_speech","misinformation","copyright","fraud","harassment","off_topic","duplicate","inappropriate"],
  },
  geo: {
    zeitzone: ["Europe/Berlin","Europe/Vienna","Europe/Zurich","Europe/London","America/New_York","America/Los_Angeles","Asia/Tokyo","Asia/Shanghai"],
  },
};

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────

function pick(arr) {
  if (!Array.isArray(arr) || !arr.length) return '';
  return arr[Math.floor(Math.random() * arr.length)];
}

// Sicherer Zugriff auf D
function g(path) {
  const parts = path.split('.');
  let cur = D;
  for (const p of parts) { cur = cur?.[p]; if (cur == null) return []; }
  return Array.isArray(cur) ? cur : [];
}

// ── Datumsformat-Helfer ───────────────────────────────────────────────────────

/** YYYY-MM-DD */
function randomDate() {
  return faker.date.recent({ days: 365 }).toISOString().split('T')[0];
}

/** HH:MM:SS – kein Datum, kein Z */
function randomTime() {
  const h = String(faker.number.int({ min: 0, max: 23 })).padStart(2, '0');
  const m = String(faker.number.int({ min: 0, max: 59 })).padStart(2, '0');
  const s = String(faker.number.int({ min: 0, max: 59 })).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

/** YYYY-MM-DD HH:MM:SS – kein Z, kein T */
function randomTimestamp() {
  return faker.date.recent({ days: 30 }).toISOString().replace('T', ' ').replace(/\.\d+Z$/, '');
}

/** ISO 8601 mit Z (für timestamptz) */
function randomTimestampTZ() {
  return faker.date.recent({ days: 30 }).toISOString();
}

/** z.B. '3 days 04:15:00' */
function randomInterval() {
  const days = faker.number.int({ min: 0, max: 30 });
  const h = String(faker.number.int({ min: 0, max: 23 })).padStart(2, '0');
  const m = String(faker.number.int({ min: 0, max: 59 })).padStart(2, '0');
  const s = String(faker.number.int({ min: 0, max: 59 })).padStart(2, '0');
  return `${days} days ${h}:${m}:${s}`;
}

/** Gültige IPv4-Adresse */
function randomIPv4() {
  return [
    faker.number.int({ min: 1,   max: 254 }),
    faker.number.int({ min: 0,   max: 254 }),
    faker.number.int({ min: 0,   max: 254 }),
    faker.number.int({ min: 1,   max: 254 }),
  ].join('.');
}

/** Gültige IPv6-Adresse */
function randomIPv6() {
  return Array.from({ length: 8 }, () =>
    faker.number.int({ min: 0, max: 65535 }).toString(16).padStart(4, '0')
  ).join(':');
}

/** MAC-Adresse (EUI-48) */
function randomMacAddress() {
  return Array.from({ length: 6 }, () =>
    faker.number.int({ min: 0, max: 255 }).toString(16).padStart(2, '0')
  ).join(':');
}

/** CIDR-Notation, z.B. 192.168.1.0/24 */
function randomCidr() {
  return `${randomIPv4()}/${faker.number.int({ min: 8, max: 32 })}`;
}

// ── Personen-Helfer ───────────────────────────────────────────────────────────

function randomVorname() {
  return pick([...g('person.vornamen_maennlich'), ...g('person.vornamen_weiblich')]);
}
function randomNachname() { return pick(g('person.nachnamen')); }

function randomEmail() {
  const umlaute = { ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' };
  const clean = s => s.toLowerCase().replace(/[äöüß]/g, c => umlaute[c] || c);
  return `${clean(randomVorname())}.${clean(randomNachname())}@${pick(g('kontakt.email_domains'))}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// KERN-GENERATOR  –  TYP-FIRST, dann NAME-Verfeinerung
// ─────────────────────────────────────────────────────────────────────────────
function generateValue(colName, dataType) {
  const n = colName.toLowerCase();
  const t = (dataType || '').toLowerCase().trim();

  // ══════════════════════════════════════════════════════════════════════════
  // BLOCK 1: Eindeutige SQL-Typen → immer korrekter Wert, Name egal
  // ══════════════════════════════════════════════════════════════════════════

  // Boolean
  if (t === 'boolean' || t === 'bool') return faker.datatype.boolean();

  // Ganzzahl-Typen
  if (/^(smallint|int2|integer|int4|int|bigint|int8|smallserial|serial|bigserial)$/.test(t)) {
    if (n.includes('year')    || n.includes('jahr'))                    return faker.date.past().getFullYear();
    if (n.includes('percent') || n.includes('rate') || n.includes('score')) return faker.number.int({ min: 0, max: 100 });
    if (n.includes('count')   || n.includes('anzahl'))                  return faker.number.int({ min: 0, max: 200 });
    if (n.includes('stufe')   || n.includes('level'))                   return faker.number.int({ min: 1, max: 10 });
    if (n.includes('price')   || n.includes('preis') || n.includes('betrag'))
      return Math.round(pick(g('business.preise')) || faker.number.int({ min: 1, max: 999 }));
    return faker.number.int({ min: 1, max: 10000 });
  }

  // Dezimalzahlen
  if (/^(numeric|decimal|real|float4|float8|double precision|money)/.test(t) || t.startsWith('numeric(') || t.startsWith('decimal(')) {
    if (n.includes('lat'))                                               return parseFloat(faker.location.latitude());
    if (n.includes('lng') || n.includes('lon'))                         return parseFloat(faker.location.longitude());
    if (n.includes('price') || n.includes('preis') || n.includes('betrag'))
      return pick(g('business.preise')) || parseFloat(faker.commerce.price());
    if (n.includes('percent') || n.includes('rate') || n.includes('score'))
      return faker.number.float({ min: 0, max: 100, fractionDigits: 2 });
    return faker.number.float({ min: 1, max: 1000, fractionDigits: 2 });
  }

  // UUID
  if (t === 'uuid') return faker.string.uuid();

  // ── Datum/Zeit – Reihenfolge ist wichtig (spezifischster Typ zuerst) ───
  if (t === 'timestamptz' || t === 'timestamp with time zone')    return randomTimestampTZ();
  if (t === 'timestamp'   || t === 'timestamp without time zone') return randomTimestamp();
  if (t === 'date')                                               return randomDate();
  if (t === 'timetz'      || t === 'time with time zone')         return randomTime();
  if (t === 'time'        || t === 'time without time zone')      return randomTime();
  if (t === 'interval')                                           return randomInterval();

  // ── PostgreSQL Netzwerk-Typen ───────────────────────────────────────────
  // Wichtig: Diese greifen IMMER, unabhängig vom Spaltennamen!
  // "ip_adresse" mit Typ inet → IPv4, nicht Straßenname.
  if (t === 'inet')     return faker.datatype.boolean() ? randomIPv4() : randomIPv6(); // inet erlaubt beides
  if (t === 'cidr')     return randomCidr();
  if (t === 'macaddr')  return randomMacAddress();
  if (t === 'macaddr8') return Array.from({ length: 8 }, () => faker.number.int({min:0,max:255}).toString(16).padStart(2,'0')).join(':');

  // ── JSON / JSONB ────────────────────────────────────────────────────────
  if (t === 'json' || t === 'jsonb') {
    if (n.includes('settings') || n.includes('config') || n.includes('einstellungen'))
      return { theme: pick(['dark', 'light']), language: pick(g('system.sprachen')), notifications: faker.datatype.boolean() };
    if (n.includes('address') || n.includes('adresse'))
      return { street: `${pick(g('kontakt.strassen'))} ${faker.number.int({min:1,max:150})}`, city: pick(g('kontakt.staedte')), zip: `${pick(g('kontakt.postleitzahlen_prefix'))}${faker.number.int({min:1000,max:9999})}` };
    if (n.includes('meta'))
      return { key: faker.lorem.word(), value: faker.lorem.word(), ts: Date.now() };
    return { id: faker.number.int({ min: 1, max: 1000 }), value: faker.lorem.word() };
  }

  // ── Geometrie-Typen ─────────────────────────────────────────────────────
  if (t === 'point')   return `(${faker.number.float({min:-90,max:90,fractionDigits:4})},${faker.number.float({min:-180,max:180,fractionDigits:4})})`;
  if (t === 'box')     return `((0,0),(${faker.number.int({min:1,max:100})},${faker.number.int({min:1,max:100})}))`;
  if (t === 'circle')  return `<(${faker.number.float({min:0,max:50,fractionDigits:2})},${faker.number.float({min:0,max:50,fractionDigits:2})}),${faker.number.float({min:1,max:10,fractionDigits:2})}>`;

  // ── Sonstige PG-Typen ───────────────────────────────────────────────────
  if (t === 'bytea')    return '\\x' + faker.string.hexadecimal({ length: 16, prefix: '' }).toLowerCase();
  if (t === 'xml')      return `<root><value>${faker.lorem.word()}</value></root>`;
  if (t === 'tsvector') return faker.lorem.words(4).split(' ').join(' & ');
  if (t === 'tsquery')  return faker.lorem.word();

  // ══════════════════════════════════════════════════════════════════════════
  // BLOCK 2: String-Typen – hier greifen NAME-basierte Heuristiken
  // ══════════════════════════════════════════════════════════════════════════

  // Alle Text-/Char-Varianten
  const isString = t === 'text'
    || t.startsWith('character varying') || t.startsWith('varchar')
    || t.startsWith('char(') || t === 'character' || t === 'bpchar' || t === 'name';

  if (isString) {
    // Personen
    if (n.includes('vorname')    || n === 'first_name' || n.includes('firstname')) return randomVorname();
    if (n.includes('nachname')   || n === 'last_name'  || n.includes('lastname'))  return randomNachname();
    if (n === 'name' || n.includes('full_name') || n.includes('fullname') || n.includes('vollname'))
      return `${randomVorname()} ${randomNachname()}`;
    if (n.includes('username')   || n.includes('login') || n.includes('benutzername') || n.includes('nutzername')) {
      const suffix = pick(g('person.benutzernamen_suffix'));
      return `${randomVorname().toLowerCase()}${suffix}`.replace(/\s/g, '');
    }
    if (n.includes('email') || n.includes('e_mail') || (n.includes('mail') && !n.includes('mailbox')))
      return randomEmail();
    if (n.includes('password') || n.includes('passwort') || n.includes('pwd'))
      return faker.internet.password({ length: 20, memorable: false });
    if (n.includes('titel') && !n.includes('artikel') && !n.includes('title')) return pick(g('person.titel'));

    // Netzwerk/Web (bei text-Typ, Typ-Block oben hat Vorrang)
    if (n.includes('ip_adresse') || n === 'ip' || n.includes('ip_addr') || n.includes('ipaddr')) return randomIPv4();
    if (n.includes('ipv6'))  return randomIPv6();
    if (n.includes('mac_addr') || n.includes('macaddr') || n.includes('mac_address')) return randomMacAddress();
    if (n.includes('url')  || n === 'website') return faker.internet.url();
    if (n.includes('domain'))                  return faker.internet.domainName();
    if (n.includes('slug'))                    return faker.lorem.slug(3);
    if (n.includes('token') || n.includes('api_key') || n.includes('apikey')) return faker.string.alphanumeric(32);
    if (n.includes('hash')  || n.includes('fingerprint') || n.includes('checksum')) return faker.string.alphanumeric(40);
    if (n.includes('user_agent') || n.includes('useragent')) return pick(g('web.user_agents'));
    if (n.includes('uuid')  || n.includes('guid'))           return faker.string.uuid();
    if (n === 'sku' || n === 'code' || n.includes('kennung') || n.includes('artikel_nr'))
      return faker.string.alphanumeric(8).toUpperCase();
    if (n.includes('farbe') || n === 'color' || n === 'colour') return pick(g('web.farben_hex'));
    if (n.includes('mime'))                    return pick(g('system.mime_types'));
    if (n.includes('file_ext') || n.includes('extension')) return pick(g('system.file_ext'));
    if (n.includes('http_status') || n.includes('status_code')) return String(pick(g('web.http_status')));
    if (n.includes('protokoll') || n === 'protocol') return pick(g('web.protokolle'));
    if (n.includes('methode') || n === 'method')     return pick(g('web.http_methoden'));
    if (n.includes('pfad') || n === 'path')          return pick(g('web.url_pfade'));

    // Kontakt & Ort
    if (n.includes('phone') || n.includes('telefon') || n.includes('handy') || n === 'mobile')
      return `${pick(g('kontakt.telefon_vorwahlen'))} ${faker.number.int({min:100000,max:9999999})}`;
    if (n.includes('city')     || n.includes('stadt') || n === 'ort') return pick(g('kontakt.staedte'));
    if (n.includes('street')   || n.includes('straße') || n.includes('strasse') || n === 'adresse')
      return `${pick(g('kontakt.strassen'))} ${faker.number.int({min:1,max:150})}`;
    if (n.includes('bundesland') || n === 'state' || n === 'region') return pick(g('kontakt.bundeslaender'));
    if (n.includes('country')  || n === 'land')             return 'Deutschland';
    if (n.includes('plz')      || n.includes('zip') || n.includes('postleitzahl'))
      return `${pick(g('kontakt.postleitzahlen_prefix'))}${faker.number.int({min:1000,max:9999})}`;
    if (n.includes('timezone') || n.includes('zeitzone'))   return pick(g('geo.zeitzone'));

    // Business
    if (n.includes('firma') || n.includes('company') || n.includes('organisation') || n.includes('organization'))
      return `${pick(g('business.firmen_prefix'))} ${pick(g('business.firmen_suffix'))}`;
    if (n.includes('abteilung') || n.includes('department')) return pick(g('business.abteilungen'));
    if (n.includes('position')  || n === 'job' || n.includes('berufs')) return pick(g('business.positionen'));
    if (n.includes('branche')   || n.includes('industry'))  return pick(g('business.branchen'));

    // Rollen & Status
    if (n.includes('role')  || n.includes('rolle'))          return pick(g('system.rollen'));
    if (n.includes('prioritaet') || n.includes('priority'))  return pick(g('system.prioritaet'));
    if (n.includes('sprache') || n.includes('language') || n === 'locale') return pick(g('system.sprachen'));
    if (n.includes('waehrung') || n === 'currency')          return pick(g('system.waehrungen'));
    if (n.includes('status_zahlung') || n.includes('payment_status')) return pick(g('system.status_zahlung'));
    if (n.includes('status_versand') || n.includes('shipping_status')) return pick(g('system.status_versand'));
    if (n.includes('status'))                                 return pick(g('system.status_allgemein'));
    if (n.includes('umgebung') || n === 'environment' || n === 'env') return pick(g('system.umgebungen'));
    if (n.includes('log_level'))                              return pick(g('system.log_level'));

    // Inhalt
    if (n.includes('verstoss_typ') || n.includes('violation')) return pick(g('inhalt.verstoss_typ'));
    if (n.includes('kategorie')  || n === 'category')        return pick(g('inhalt.kategorien'));
    if (n.includes('tag') && !n.includes('timestamp') && !n.includes('erstellt')) return pick(g('inhalt.tags'));
    if (n.includes('grund')      || n.includes('reason'))    return pick(g('inhalt.grund_meldung'));
    if (n.includes('kommentar')  || n.includes('comment'))   return pick(g('inhalt.kommentare'));
    if (n.includes('empfehlung') || n.includes('recommendation')) return pick(g('inhalt.kommentare'));

    // Titel / Beschreibungen
    if (n.includes('titel') || n === 'title' || n.includes('subject') || n.includes('betreff') || n.includes('headline'))
      return faker.lorem.sentence({ min: 2, max: 6 });
    if (n.includes('beschreibung') || n === 'description' || n === 'inhalt' || n === 'content' || n === 'body' || n.includes('_text'))
      return faker.lorem.paragraph();
    if (n.includes('zusammenfassung') || n === 'summary' || n === 'abstract')
      return faker.lorem.sentences(2);

    // Generischer String-Fallback
    return faker.lorem.words(3);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // BLOCK 3: Unbekannter Typ – Warnung + sicherer Fallback
  // ══════════════════════════════════════════════════════════════════════════
  console.warn(`[data-faker] Unbekannter Typ "${dataType}" für Spalte "${colName}" → lorem.word()`);
  return faker.lorem.word();
}

// ── ARRAY-Generator ───────────────────────────────────────────────────────────
function generateArrayValue(colName, elemType) {
  const et = (elemType || 'text').toLowerCase().trim();

  const twoVals = (fn, cast) => `ARRAY['${fn()}','${fn()}']::${cast}[]`;
  const twoNums = (fn, cast) => `ARRAY[${fn()},${fn()}]::${cast}[]`;

  if (/^(smallint|int2|integer|int4|int|bigint|int8|serial)$/.test(et))
    return twoNums(() => faker.number.int({ min: 1, max: 1000 }), 'integer');
  if (/^(numeric|decimal|real|float4|float8|double precision)/.test(et))
    return twoNums(() => faker.number.float({ min: 0, max: 100, fractionDigits: 2 }), 'numeric');
  if (et === 'boolean' || et === 'bool')
    return `ARRAY[${faker.datatype.boolean()},${faker.datatype.boolean()}]::boolean[]`;
  if (et === 'uuid')
    return twoVals(() => faker.string.uuid(), 'uuid');
  if (et === 'timestamptz' || et === 'timestamp with time zone')
    return twoVals(randomTimestampTZ, 'timestamptz');
  if (et === 'timestamp' || et === 'timestamp without time zone')
    return twoVals(randomTimestamp, 'timestamp');
  if (et === 'date')    return twoVals(randomDate,    'date');
  if (et === 'time' || et === 'timetz') return twoVals(randomTime, 'time');
  if (et === 'inet')    return twoVals(randomIPv4,    'inet');
  if (et === 'cidr')    return twoVals(randomCidr,    'cidr');
  if (et === 'macaddr') return twoVals(randomMacAddress, 'macaddr');

  return twoVals(() => faker.lorem.word(), 'text');
}

// ── SQL-Formatierung ──────────────────────────────────────────────────────────
function toSQL(val, colType, colName, maxLen) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'object' && val !== null && val.$raw !== undefined) return val.$raw;
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  if (typeof val === 'number')  return String(val);

  const t = (colType || '').toLowerCase().trim();

  // JSON
  if (t === 'json' || t === 'jsonb') {
    const json = typeof val === 'object' ? JSON.stringify(val) : String(val);
    return `'${json.replace(/'/g, "''")}'::jsonb`;
  }

  // Typen mit explizitem Cast
  const explicitCasts = {
    'uuid':                         'uuid',
    'inet':                         'inet',
    'cidr':                         'cidr',
    'macaddr':                      'macaddr',
    'macaddr8':                     'macaddr8',
    'timestamptz':                  'timestamptz',
    'timestamp with time zone':     'timestamptz',
    'timestamp':                    'timestamp',
    'timestamp without time zone':  'timestamp',
    'date':                         'date',
    'timetz':                       'timetz',
    'time with time zone':          'timetz',
    'time':                         'time',
    'time without time zone':       'time',
    'point':                        'point',
    'box':                          'box',
    'circle':                       'circle',
    'bytea':                        'bytea',
  };

  if (explicitCasts[t]) {
    return `'${String(val).replace(/'/g, "''")}'::${explicitCasts[t]}`;
  }

  // INTERVAL braucht das Keyword
  if (t === 'interval') return `INTERVAL '${String(val).replace(/'/g, "''")}'`;

  // Strings mit optionaler Längenkürzung
  let s = typeof val === 'object' ? JSON.stringify(val) : String(val);
  if (maxLen > 0 && s.length > maxLen) s = s.substring(0, maxLen);
  return `'${s.replace(/'/g, "''")}'`;
}

// ── VARCHAR-Länge ermitteln ───────────────────────────────────────────────────
function getMaxLen(colName, charMaxLen) {
  if (charMaxLen > 0) return charMaxLen;
  const n = colName.toLowerCase();
  if (n.includes('url')  || n.includes('domain') || n.includes('website')) return 2000;
  if (n.includes('email') || n.includes('mail'))   return 255;
  if (n.includes('hash')  || n.includes('password') || n.includes('passwort')) return 255;
  if (n.includes('user_agent') || n.includes('useragent')) return 512;
  return 0;
}

// ── Haupt-Export ──────────────────────────────────────────────────────────────
export async function generateBulkInsertSQL(tableName, columns, rowCount = 20) {
  const rows = [];

  for (let i = 0; i < rowCount; i++) {
    const vals = columns.map(col => {
      try {
        // Prio 1: Echte FK-Werte aus der DB
        if (col.fkValues?.length > 0) {
          const v = col.fkValues[Math.floor(Math.random() * col.fkValues.length)];
          return toSQL(v, col.type, col.name, 0);
        }
        // Prio 2: Check-Constraint-Werte
        if (col.validValues?.length > 0) {
          const v = col.validValues[Math.floor(Math.random() * col.validValues.length)];
          return toSQL(v, col.type, col.name, 0);
        }
        // Prio 3: Array-Typ
        if (col.arrayElemType) {
          return generateArrayValue(col.name, col.arrayElemType);
        }
        // Prio 4: Normaler Wert
        const v = generateValue(col.name, col.type);
        const maxLen = getMaxLen(col.name, col.charMaxLen || 0);
        return toSQL(v, col.type, col.name, maxLen);
      } catch (e) {
        console.error(`[data-faker] FEHLER Spalte "${col.name}" (Typ: ${col.type}):`, e.message);
        return 'NULL';
      }
    });
    rows.push(`(${vals.join(', ')})`);
  }

  const colNames = columns.map(c => `"${c.name}"`).join(', ');
  const sql = `INSERT INTO "${tableName}" (${colNames})\nVALUES\n${rows.join(',\n')}\n`;
  console.log('[data-faker] ✅ SQL generiert:', rowCount, 'Zeilen | Preview:', sql.substring(0, 400));
  return sql;
}

/** Einzelzellen-Generator für den CellEditor */
export async function generateFakeCellValue(colName, dataType) {
  return generateValue(colName, dataType);
}
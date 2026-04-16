// ── data-faker.js ──────────────────────────────────────────────────────────────
// Strategie: TYP-FIRST → NAME-SECOND
//
// faker DE übernimmt alles was er kann:
//   Namen, Städte, PLZ, Straßen, Bundesländer, Telefon, Email, Jobs...
//
// Eigene Listen NUR für was faker nicht kennt:
//   SKR03-Konten, Transaktionsarten, Kostenstellen, Belegnummer-Präfixe,
//   deutsche Rechtsformen, Zahlungsziele, deutsche Produkte,
//   System-Status, Rollen, Tags, deutsche Kommentare/Notizen...
// ──────────────────────────────────────────────────────────────────────────────

import { fakerDE, fakerEN } from 'https://esm.sh/@faker-js/faker@9';

const fDE = fakerDE;
const fEN = fakerEN;

// ── Spracherkennung ───────────────────────────────────────────────────────────
function fakerFor(colName) {
  const n = colName.toLowerCase();
  const enPatterns = [
    'first_name','last_name','full_name','username','company','department',
    'position','description','comment','summary','title','subject','category',
    'address','street','city','state','country','zip','phone','email',
    'password','token','role','status','priority','environment','language',
    'currency','product','industry','note','reason','content','body',
  ];
  if (enPatterns.some(p => n.includes(p))) return fEN;
  return fDE;
}

// ── Nur was faker DE wirklich NICHT kennt ─────────────────────────────────────
const D = {
  buchhaltung: {
    belegnummer_prefix: ['BELEG','RE','RG','GS','AB','BU','EZ','AZ','UW','KR','AR','ER','LF','ZA'],
    transaktionsarten:  ['Einzahlung','Auszahlung','Überweisung','Lastschrift','Gutschrift',
                         'Rückbuchung','Dauerauftrag','Kartenabbuchung','Sammelüberweisung',
                         'Kontogebühr','Zinsgutschrift','Bareinzahlung','Barauszahlung',
                         'Wertpapierverkauf','Wertpapierkauf','Dividende','Steuerrückzahlung',
                         'Gehaltszahlung','Mietzahlung','Versicherungsprämie','Lieferantenzahlung',
                         'Kundenzahlung','Steuervorauszahlung','Sozialversicherungsbeitrag'],
    buchungsarten:      ['Soll','Haben'],
    kostenstellen:      ['KST-100','KST-110','KST-120','KST-200','KST-210','KST-300',
                         'KST-400','KST-410','KST-500','KST-600','KST-700','KST-800','KST-900'],
    kostenarten:        ['Personalkosten','Materialkosten','Mietkosten','Reisekosten',
                         'Marketingkosten','IT-Kosten','Versicherungskosten','Fahrzeugkosten',
                         'Bürokosten','Fremdleistungen','Abschreibungen','Zinskosten'],
    zahlungsarten:      ['Überweisung','Lastschrift','Kreditkarte','Bar','PayPal','Rechnung','SEPA','Vorkasse','Nachnahme'],
    zahlungsziele:      ['sofort','7 Tage netto','14 Tage netto','30 Tage netto','14 Tage 2% Skonto','60 Tage netto'],
    steuerarten:        ['MwSt. 19%','MwSt. 7%','steuerfrei','innergemeinschaftlich'],
    konten_skr03:       ['1000 Kasse','1200 Bank','1400 Forderungen','1600 Verbindlichkeiten',
                         '4000 Umsatzerlöse','5000 Materialaufwand','6000 Personalaufwand',
                         '6300 Mietaufwand','6800 Werbeaufwand','7000 Zinsaufwand'],
  },
  business: {
    // faker.company.name() kennt keine deutschen Rechtsformen
    firmen_suffix: ['GmbH','AG','UG','GmbH & Co. KG','e.K.','KG','OHG','GbR',
                    'Solutions','Systems','Technologies','Group','Consulting',
                    'Engineering','Software','Networks','Ventures','Labs','Studio','Werk','Handel'],
    branchen:      ['Software','E-Commerce','Finanzen','Gesundheit','Bildung','Medien',
                    'Logistik','Immobilien','Energie','Automotive','Tourismus','Gastronomie',
                    'Handel','Industrie','Beratung','Telekommunikation','Versicherung',
                    'Pharma','Chemie','Maschinenbau','Bauwesen'],
    bank_namen:    ['Deutsche Bank','Commerzbank','Sparkasse','Volksbank','DKB',
                    'ING','Comdirect','N26','Postbank','HypoVereinsbank','Raiffeisenbank','Targobank'],
    // faker.commerce.productName() gibt immer englische Namen
    produkte:      ['Laptop','Smartphone','Tablet','Monitor','Tastatur','Maus','Drucker','Kamera',
                    'Kopfhörer','Lautsprecher','Router','Server','SSD','Festplatte','Webcam',
                    'Mikrofon','USB-Hub','Docking Station','Netzteil','Grafikkarte','Prozessor',
                    'Arbeitsspeicher','Externes Laufwerk','Bluetooth-Adapter','Bildschirmhalter',
                    'Schreibtisch','Bürostuhl','Aktenschrank','Whiteboard','Tischlampe',
                    'Notizbuch','Kugelschreiber','Kaffeemaschine','Wasserkocher',
                    'Rucksack','Powerbank','Ladekabel','Handyhülle'],
    preise:        [4.99,9.99,14.99,19.99,24.99,29.99,39.99,49.99,59.99,79.99,99.99,
                    119.99,149.99,199.99,249.99,299.99,399.99,499.99,699.99,999.99,
                    1299.99,1499.99,1999.99,2499.99,4999.99],
  },
  system: {
    status_allgemein:  ['active','inactive','pending','archived','deleted','blocked','draft','published','paused','expired'],
    status_moderation: ['offen','in_bearbeitung','erledigt','abgelehnt','eskaliert','geloescht','freigegeben'],
    status_zahlung:    ['pending','paid','failed','refunded','cancelled','processing','disputed'],
    status_versand:    ['pending','processing','shipped','delivered','returned','lost'],
    status_auftrag:    ['neu','bestätigt','in_bearbeitung','abgeschlossen','storniert','auf_hold','teilgeliefert'],
    status_ticket:     ['open','in_progress','waiting','resolved','closed','escalated','on_hold'],
    prioritaet:        ['low','medium','high','critical','blocker'],
    rollen:            ['superadmin','admin','moderator','editor','author','viewer','guest','banned'],
    sprachen:          ['de','en','fr','es','it','nl','pl','pt','ru','zh'],
    waehrungen:        ['EUR','USD','GBP','CHF','JPY','CAD'],
    file_ext:          ['jpg','jpeg','png','gif','webp','svg','pdf','docx','xlsx','pptx','txt','csv','json','xml','zip','mp4','mp3'],
    mime_types:        ['image/jpeg','image/png','image/gif','image/webp','application/pdf',
                        'application/msword','text/plain','text/csv','application/json','application/zip','video/mp4'],
    fehler_codes:      ['ERR_001','ERR_404','ERR_500','WARN_002','INFO_010','AUTH_FAIL','DB_TIMEOUT','RATE_LIMIT'],
    log_level:         ['DEBUG','INFO','WARNING','ERROR','CRITICAL'],
    umgebungen:        ['development','staging','production','testing','local'],
    api_versionen:     ['v1','v2','v3','v1.0','v2.1','v3.0-beta'],
  },
  web: {
    // faker hat keine fertigen User-Agent-Strings
    user_agents:  ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36',
                   'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.2 Safari/605.1.15',
                   'Mozilla/5.0 (X11; Linux x86_64; rv:123.0) Gecko/20100101 Firefox/123.0',
                   'Mozilla/5.0 (iPhone; CPU iPhone OS 17_3 like Mac OS X) AppleWebKit/605.1.15 Version/17.3 Mobile/15E148 Safari/604.1',
                   'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Edge/122.0.0.0 Safari/537.36'],
    http_status:  [200,201,204,301,302,400,401,403,404,409,422,429,500,502,503],
    http_methoden:['GET','POST','PUT','PATCH','DELETE'],
    protokolle:   ['https','http'],
    url_pfade:    ['/','/home','/about','/contact','/blog','/products','/services',
                   '/api/v1/users','/api/v2/data','/dashboard','/profile','/settings',
                   '/login','/register','/search','/impressum','/datenschutz'],
    api_versionen:['v1','v2','v3','v1.0','v2.1','v3.0-beta'],
  },
  inhalt: {
    // faker.lorem ist Latein → eigene deutsche Texte für Notizen/Kommentare
    notizen_de:    ['Bitte bis Ende der Woche erledigen.','Kunde wurde telefonisch informiert.',
                    'Rückruf vereinbart für nächste Woche.','Unterlagen wurden per Post verschickt.',
                    'Termin steht noch aus.','Intern zu klären.','Dringend: Antwort erforderlich.',
                    'Erledigt, Ablage erfolgt.','In Bearbeitung.','Warte auf Freigabe durch Vorgesetzten.'],
    kommentare_de: ['Sehr hilfreicher Beitrag, danke!','Interessante Perspektive, aber ich sehe das anders.',
                    'Wann wird das Problem behoben?','Super erklärt, genau was ich gesucht habe.',
                    'Gibt es dazu weitere Informationen?','Das funktioniert bei mir leider nicht.',
                    'Vielen Dank für die schnelle Hilfe!','Toller Artikel, weiter so!',
                    'Das sollte dringend überarbeitet werden.','Funktioniert einwandfrei, top Qualität!'],
    kategorien_de: ['Politik','Wirtschaft','Sport','Technologie','Wissenschaft','Kultur',
                    'Unterhaltung','Reisen','Gesundheit','Bildung','Umwelt','Lifestyle',
                    'Automobil','Finanzen','Immobilien','Gastronomie','Mode','Gaming'],
    tags:          ['wichtig','dringend','neu','aktuell','beliebt','empfohlen','trending',
                    'featured','premium','kostenlos','beta','alpha','stable','deprecated',
                    'archived','pinned','verified','sponsored','breaking','exklusiv'],
    grund_meldung: ['Spam','Beleidigung','Falsche Informationen','Urheberrechtsverletzung',
                    'Unangemessener Inhalt','Werbung','Betrug','Hassrede','Off-Topic',
                    'Doppelter Beitrag','Veraltete Informationen','Technischer Fehler'],
    verstoss_typ:  ['spam','abuse','hate_speech','misinformation','copyright','fraud',
                    'harassment','off_topic','duplicate','inappropriate'],
  },
  geo: {
    // faker kennt keine IANA-Zeitzonen
    zeitzone: ['Europe/Berlin','Europe/Vienna','Europe/Zurich','Europe/London',
               'America/New_York','America/Los_Angeles','Asia/Tokyo','Asia/Shanghai'],
    laender:  [
      {name:'Deutschland',code:'DE'},{name:'Österreich',code:'AT'},{name:'Schweiz',code:'CH'},
      {name:'Frankreich',code:'FR'},{name:'Niederlande',code:'NL'},{name:'Belgien',code:'BE'},
      {name:'Polen',code:'PL'},{name:'Italien',code:'IT'},{name:'Spanien',code:'ES'},{name:'USA',code:'US'},
    ],
  },
};

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────

function pick(arr) {
  if (!Array.isArray(arr) || !arr.length) return '';
  return arr[Math.floor(Math.random() * arr.length)];
}

function g(path) {
  const parts = path.split('.');
  let cur = D;
  for (const p of parts) { cur = cur?.[p]; if (cur == null) return []; }
  return Array.isArray(cur) ? cur : [];
}

function currentYear() { return new Date().getFullYear(); }

// ── Datum/Zeit ────────────────────────────────────────────────────────────────

function randomDate()        { return fDE.date.recent({days:365}).toISOString().split('T')[0]; }
function randomTimestampTZ() { return fDE.date.recent({days:30}).toISOString(); }
function randomTimestamp()   { return fDE.date.recent({days:30}).toISOString().replace('T',' ').replace(/\.\d+Z$/,''); }
function randomTime() {
  const p = n => String(n).padStart(2,'0');
  return `${p(fDE.number.int({min:0,max:23}))}:${p(fDE.number.int({min:0,max:59}))}:${p(fDE.number.int({min:0,max:59}))}`;
}
function randomInterval() {
  return `${fDE.number.int({min:0,max:30})} days ${randomTime()}`;
}

// ── Netzwerk ──────────────────────────────────────────────────────────────────

function randomIPv4()       { return [fDE.number.int({min:1,max:254}),fDE.number.int({min:0,max:254}),fDE.number.int({min:0,max:254}),fDE.number.int({min:1,max:254})].join('.'); }
function randomIPv6()       { return Array.from({length:8},()=>fDE.number.int({min:0,max:65535}).toString(16).padStart(4,'0')).join(':'); }
function randomMacAddress() { return Array.from({length:6},()=>fDE.number.int({min:0,max:255}).toString(16).padStart(2,'0')).join(':'); }
function randomCidr()       { return `${randomIPv4()}/${fDE.number.int({min:8,max:32})}`; }

// ── Personen – alles über faker DE ───────────────────────────────────────────

function randomVorname()  { return fDE.person.firstName(); }
function randomNachname() { return fDE.person.lastName(); }
function randomFullName() { return fDE.person.fullName(); }

function randomEmail() {
  const umlaute = {ä:'ae',ö:'oe',ü:'ue',ß:'ss'};
  const clean = s => s.toLowerCase().replace(/[äöüß]/g, c => umlaute[c]||c).replace(/\s/g,'.');
  const domains = ['gmail.com','outlook.de','web.de','gmx.net','gmx.de','yahoo.de',
                   't-online.de','freenet.de','posteo.de','protonmail.com','mailbox.org','arcor.de'];
  return `${clean(randomVorname())}.${clean(randomNachname())}@${pick(domains)}`;
}

// ── Buchhaltung ───────────────────────────────────────────────────────────────

function randomBelegnummer(prefix, nr) {
  const p   = prefix || pick(g('buchhaltung.belegnummer_prefix'));
  const num = nr != null ? nr : fDE.number.int({min:1,max:99999});
  return `${p}-${currentYear()}-${String(num).padStart(5,'0')}`;
}

function randomVerwendungszweck() {
  const nr    = randomBelegnummer();
  const datum = fDE.date.recent({days:365}).toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric'});
  return pick([
    `Rechnung Nr. ${nr} vom ${datum}`,
    `Bestellung ${nr}`,
    `Miete ${datum}`,
    `Gehalt ${datum}`,
    `Reparatur Auftrag ${nr}`,
    `Wartungsvertrag ${nr}`,
    `Projektkosten ${nr}`,
    `Anzahlung Auftrag ${nr}`,
    `Abschlusszahlung ${nr}`,
    `Nachlieferung ${nr}`,
  ]);
}

function randomIBAN() {
  const prüf = String(fDE.number.int({min:10,max:99}));
  const bban  = Array.from({length:18},()=>fDE.number.int({min:0,max:9})).join('');
  return `DE${prüf}${bban}`;
}

function randomBIC() {
  const alpha = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const c = () => alpha[fDE.number.int({min:0,max:25})];
  return `${c()}${c()}${c()}${c()}DE${c()}${c()}`;
}

// Firmenname: faker-Wort + deutsche Rechtsform
function randomFirma() {
  return `${fDE.company.name().split(' ')[0]} ${pick(g('business.firmen_suffix'))}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// KERN-GENERATOR – TYP-FIRST, dann NAME-Verfeinerung
// ─────────────────────────────────────────────────────────────────────────────
function generateValue(colName, dataType) {
  const n = colName.toLowerCase();
  const t = (dataType || '').toLowerCase().trim();
  const f = fakerFor(colName);
  const isEnCol = (f === fEN);

  // ══════════════════════════════════════════════════════════════════════════
  // BLOCK 1: Eindeutige SQL-Typen
  // ══════════════════════════════════════════════════════════════════════════

  if (t === 'boolean' || t === 'bool') return f.datatype.boolean();

  if (/^(smallint|int2|integer|int4|int|bigint|int8|smallserial|serial|bigserial)$/.test(t)) {
    if (n.includes('year')    || n.includes('jahr'))                          return f.date.past().getFullYear();
    if (n.includes('percent') || n.includes('rate') || n.includes('score'))   return f.number.int({min:0,max:100});
    if (n.includes('count')   || n.includes('anzahl') || n.includes('menge')) return f.number.int({min:0,max:200});
    if (n.includes('stufe')   || n.includes('level'))                         return f.number.int({min:1,max:10});
    if (n.includes('price')   || n.includes('preis') || n.includes('betrag')) return Math.round(pick(g('business.preise')) || f.number.int({min:1,max:999}));
    if (n.includes('monat')   || n.includes('month'))                         return f.number.int({min:1,max:12});
    if (n.includes('alter')   || n.includes('age'))                           return f.number.int({min:18,max:80});
    return f.number.int({min:1,max:10000});
  }

  if (/^(numeric|decimal|real|float4|float8|double precision|money)/.test(t)
      || t.startsWith('numeric(') || t.startsWith('decimal(')) {
    if (n.includes('lat'))                                                               return parseFloat(f.location.latitude());
    if (n.includes('lng') || n.includes('lon'))                                          return parseFloat(f.location.longitude());
    if (n.includes('price') || n.includes('preis') || n.includes('betrag') || n.includes('summe'))
      return pick(g('business.preise')) || parseFloat(f.commerce.price());
    if (n.includes('percent') || n.includes('rate') || n.includes('score'))              return f.number.float({min:0,max:100,fractionDigits:2});
    if (n.includes('mwst')    || n.includes('steuer') || n.includes('tax'))              return f.number.float({min:0,max:19,fractionDigits:2});
    return f.number.float({min:1,max:1000,fractionDigits:2});
  }

  if (t === 'uuid') return f.string.uuid();

  if (t === 'timestamptz' || t === 'timestamp with time zone')    return randomTimestampTZ();
  if (t === 'timestamp'   || t === 'timestamp without time zone') return randomTimestamp();
  if (t === 'date')                                               return randomDate();
  if (t === 'timetz'      || t === 'time with time zone')         return randomTime();
  if (t === 'time'        || t === 'time without time zone')      return randomTime();
  if (t === 'interval')                                           return randomInterval();

  if (t === 'inet')     return f.datatype.boolean() ? randomIPv4() : randomIPv6();
  if (t === 'cidr')     return randomCidr();
  if (t === 'macaddr')  return randomMacAddress();
  if (t === 'macaddr8') return Array.from({length:8},()=>f.number.int({min:0,max:255}).toString(16).padStart(2,'0')).join(':');

  if (t === 'json' || t === 'jsonb') {
    if (n.includes('settings') || n.includes('config') || n.includes('einstellungen'))
      return {theme:pick(['dark','light']),language:pick(g('system.sprachen')),notifications:f.datatype.boolean()};
    if (n.includes('address') || n.includes('adresse'))
      return {street:fDE.location.streetAddress(),city:fDE.location.city(),zip:fDE.location.zipCode()};
    if (n.includes('meta'))
      return {key:f.lorem.word(),value:f.lorem.word(),ts:Date.now()};
    if (n.includes('payload') || n.includes('data') || n.includes('daten'))
      return {id:f.number.int({min:1,max:1000}),status:pick(g('system.status_allgemein')),value:f.lorem.word()};
    return {id:f.number.int({min:1,max:1000}),value:f.lorem.word()};
  }

  if (t === 'point')    return `(${f.number.float({min:-90,max:90,fractionDigits:4})},${f.number.float({min:-180,max:180,fractionDigits:4})})`;
  if (t === 'box')      return `((0,0),(${f.number.int({min:1,max:100})},${f.number.int({min:1,max:100})}))`;
  if (t === 'circle')   return `<(${f.number.float({min:0,max:50,fractionDigits:2})},${f.number.float({min:0,max:50,fractionDigits:2})}),${f.number.float({min:1,max:10,fractionDigits:2})}>`;
  if (t === 'bytea')    return '\\x' + f.string.hexadecimal({length:16,prefix:''}).toLowerCase();
  if (t === 'xml')      return `<root><value>${f.lorem.word()}</value></root>`;
  if (t === 'tsvector') return f.lorem.words(4).split(' ').join(' & ');
  if (t === 'tsquery')  return f.lorem.word();

  // ══════════════════════════════════════════════════════════════════════════
  // BLOCK 2: String-Typen – NAME-basierte Heuristiken
  // ══════════════════════════════════════════════════════════════════════════

  const isString = t === 'text'
    || t.startsWith('character varying') || t.startsWith('varchar')
    || t.startsWith('char(') || t === 'character' || t === 'bpchar' || t === 'name';

  if (isString) {

    // ── Personen ───────────────────────────────────────────────────────────
    if (n.includes('vorname') || n.includes('first_name') || n.includes('firstname') || n.includes('given_name'))
      return randomVorname();

    if (n.includes('nachname') || n.includes('last_name') || n.includes('lastname') || n.includes('surname') || n.includes('familienname'))
      return randomNachname();

    // Vollständiger Name: alle _name Varianten die eine Person meinen
    if (
      n === 'name' ||
      n.includes('full_name') || n.includes('fullname') || n.includes('vollname') ||
      n.includes('nutzer_name') || n.includes('nutzername') ||
      n.includes('kunden_name') || n.includes('kundenname') ||
      n.includes('user_name') ||
      n.includes('personen_name') || n.includes('personenname') ||
      n.includes('kontakt_name') || n.includes('kontaktname') ||
      n.includes('empfaenger') || n.includes('empfänger') ||
      n.includes('auftraggeber') || n.includes('lieferant_name') ||
      n.includes('mitarbeiter_name') || n.includes('benutzer_name') ||
      n.includes('inhaber') || n.includes('besitzer') ||
      (n.includes('_name') && !n.includes('file') && !n.includes('table') &&
       !n.includes('column') && !n.includes('host') && !n.includes('domain') &&
       !n.includes('product') && !n.includes('produkt') && !n.includes('brand') &&
       !n.includes('company') && !n.includes('firma') && !n.includes('tag'))
    )
      return randomFullName();

    if (n.includes('anrede'))
      return pick(['Herr','Frau']);
    if (n.includes('titel') && !n.includes('artikel') && !n.includes('title'))
      return pick(['Dr.','Prof. Dr.','Dipl.-Ing.','M.Sc.','B.A.','M.A.','Dr. med.','Prof.','MBA']);

    // username/login NACH den _name-Checks
    if (n === 'username' || n === 'login' || n === 'nutzername' ||
        n.includes('benutzername') || n === 'user_login' || n === 'loginname')
      return fDE.internet.username();

    if (n.includes('email') || n.includes('e_mail') || (n.includes('mail') && !n.includes('mailbox')))
      return randomEmail();
    if (n.includes('password') || n.includes('passwort') || n.includes('pwd'))
      return f.internet.password({length:20,memorable:false});

    // ── Buchhaltung ────────────────────────────────────────────────────────
    if (n.includes('belegnummer') || n.includes('beleg_nr') || n.includes('rechnungsnummer') ||
        n.includes('rechnung_nr') || n.includes('dokument_nr') || n.includes('vorgangsnummer'))
      return randomBelegnummer();
    if (n.includes('transaktion') || n === 'transaction' || n.includes('transaktionsart') || n.includes('buchungstext'))
      return pick(g('buchhaltung.transaktionsarten'));
    if (n.includes('verwendungszweck') || n.includes('zahlungsgrund'))  return randomVerwendungszweck();
    if (n.includes('buchungsart')      || n === 'soll_haben')           return pick(g('buchhaltung.buchungsarten'));
    if (n.includes('kostenstelle')     || n.includes('cost_center'))    return pick(g('buchhaltung.kostenstellen'));
    if (n.includes('kostenart')        || n.includes('cost_type'))      return pick(g('buchhaltung.kostenarten'));
    if (n.includes('zahlungsart')      || n.includes('payment_method')) return pick(g('buchhaltung.zahlungsarten'));
    if (n.includes('zahlungsziel')     || n.includes('payment_term'))   return pick(g('buchhaltung.zahlungsziele'));
    if (n.includes('steuerart')        || n.includes('tax_type'))       return pick(g('buchhaltung.steuerarten'));
    if (n.includes('konto_nr')         || n.includes('kontonummer'))    return pick(g('buchhaltung.konten_skr03'));
    if (n.includes('iban'))                                             return randomIBAN();
    if (n.includes('bic')              || n.includes('swift'))          return randomBIC();
    if (n.includes('bank_name')        || n.includes('bankname') || n.includes('kreditinstitut'))
      return pick(g('business.bank_namen'));

    // ── Business ───────────────────────────────────────────────────────────
    if (n.includes('firma') || n.includes('company') || n.includes('organisation') || n.includes('organization'))
      return randomFirma();
    if (n.includes('abteilung') || n.includes('department'))
      return fDE.commerce.department();                      // ← faker DE
    if (n.includes('position') || n === 'job' || n.includes('berufs') || n.includes('jobtitel'))
      return fDE.person.jobTitle();                          // ← faker DE
    if (n.includes('branche')  || n.includes('industry'))
      return pick(g('business.branchen'));
    if (n.includes('produkt')  || n === 'item' || n.includes('artikel') || n === 'product_name' || n === 'item_name')
      return pick(g('business.produkte'));                   // ← eigene Liste (faker gibt Englisch)
    if (n.includes('preis')    || n === 'price')
      return String(pick(g('business.preise')));

    // ── Netzwerk / Web ─────────────────────────────────────────────────────
    if (n.includes('ip_adresse') || n === 'ip' || n.includes('ip_addr'))    return randomIPv4();
    if (n.includes('ipv6'))                                                  return randomIPv6();
    if (n.includes('mac_addr')   || n.includes('mac_address'))               return randomMacAddress();
    if (n.includes('url')        || n === 'website')                         return f.internet.url();
    if (n.includes('domain'))                                                return f.internet.domainName();
    if (n.includes('slug'))                                                  return f.lorem.slug(3);
    if (n.includes('token')      || n.includes('api_key') || n.includes('apikey')) return f.string.alphanumeric(32);
    if (n.includes('hash')       || n.includes('fingerprint'))               return f.string.alphanumeric(40);
    if (n.includes('user_agent') || n.includes('useragent'))                 return pick(g('web.user_agents'));
    if (n.includes('uuid')       || n.includes('guid'))                      return f.string.uuid();
    if (n === 'sku' || n === 'code' || n.includes('kennung') || n.includes('artikel_nr'))
      return f.string.alphanumeric(8).toUpperCase();
    if (n.includes('farbe')      || n === 'color' || n === 'colour')         return fDE.color.rgb(); // ← faker DE
    if (n.includes('mime'))                                                  return pick(g('system.mime_types'));
    if (n.includes('file_ext')   || n.includes('extension'))                 return pick(g('system.file_ext'));
    if (n.includes('http_status') || n.includes('status_code'))              return String(pick(g('web.http_status')));
    if (n.includes('protokoll')  || n === 'protocol')                        return pick(g('web.protokolle'));
    if (n.includes('methode')    || n === 'method')                          return pick(g('web.http_methoden'));
    if (n.includes('pfad')       || n === 'path')                            return pick(g('web.url_pfade'));
    if (n.includes('api_version') || n.includes('api_ver'))                  return pick(g('web.api_versionen'));

    // ── Kontakt & Ort – jetzt alles über faker DE ─────────────────────────
    if (n.includes('phone') || n.includes('telefon') || n.includes('tel_nr') || n.includes('tel_nummer'))
      return fDE.phone.number();                             // ← faker DE
    if (n.includes('handy') || n.includes('mobil') || n === 'mobile')
      return fDE.phone.number();                             // ← faker DE
    if (n.includes('city')   || n.includes('stadt') || n === 'ort')
      return fDE.location.city();                            // ← faker DE
    if (n.includes('street') || n.includes('straße') || n.includes('strasse') || n === 'adresse')
      return fDE.location.streetAddress();                   // ← faker DE z.B. "Hauptstraße 42"
    if (n.includes('bundesland') || n === 'state' || n === 'region')
      return fDE.location.state();                           // ← faker DE
    if (n.includes('country') || n === 'land')
      return isEnCol ? 'Germany' : 'Deutschland';
    if (n.includes('plz') || n.includes('zip') || n.includes('postleitzahl'))
      return fDE.location.zipCode();                         // ← faker DE
    if (n.includes('timezone') || n.includes('zeitzone'))
      return pick(g('geo.zeitzone'));

    // ── Rollen & Status ────────────────────────────────────────────────────
    if (n.includes('role')           || n.includes('rolle'))            return pick(g('system.rollen'));
    if (n.includes('prioritaet')     || n.includes('priority'))         return pick(g('system.prioritaet'));
    if (n.includes('sprache')        || n.includes('language') || n === 'locale') return pick(g('system.sprachen'));
    if (n.includes('waehrung')       || n === 'currency')               return pick(g('system.waehrungen'));
    if (n.includes('status_zahlung') || n.includes('payment_status'))   return pick(g('system.status_zahlung'));
    if (n.includes('status_versand') || n.includes('shipping_status'))  return pick(g('system.status_versand'));
    if (n.includes('status_auftrag') || n.includes('order_status'))     return pick(g('system.status_auftrag'));
    if (n.includes('status_ticket')  || n.includes('ticket_status'))    return pick(g('system.status_ticket'));
    if (n.includes('status'))                                           return pick(g('system.status_allgemein'));
    if (n.includes('umgebung')       || n === 'environment' || n === 'env') return pick(g('system.umgebungen'));
    if (n.includes('log_level'))                                        return pick(g('system.log_level'));
    if (n.includes('fehler_code')    || n.includes('error_code'))       return pick(g('system.fehler_codes'));

    // ── Inhalt ─────────────────────────────────────────────────────────────
    if (n.includes('verstoss_typ')   || n.includes('violation'))        return pick(g('inhalt.verstoss_typ'));
    if (n.includes('kategorie')      || n === 'category')
      return isEnCol ? fEN.commerce.department() : pick(g('inhalt.kategorien_de'));
    if (n.includes('tag') && !n.includes('timestamp') && !n.includes('erstellt'))
      return pick(g('inhalt.tags'));
    if (n.includes('grund')          || n.includes('reason'))
      return pick(g('inhalt.grund_meldung'));
    if (n.includes('kommentar')      || n.includes('comment') || n.includes('anmerkung'))
      return isEnCol ? fEN.lorem.sentence() : pick(g('inhalt.kommentare_de'));
    if (n.includes('notiz')          || n.includes('note') || n.includes('memo'))
      return isEnCol ? fEN.lorem.sentence() : pick(g('inhalt.notizen_de'));

    // ── Biografie ──────────────────────────────────────────────────────────
    if (n.includes('biografie') || n.includes('biographie') || n === 'bio' || n === 'about') {
      const job  = fDE.person.jobTitle();
      const city = fDE.location.city();
      const yrs  = fDE.number.int({min:2,max:20});
      return pick([
        `${job} mit ${yrs} Jahren Erfahrung aus ${city}.`,
        `Freiberuflicher ${job} aus ${city}. Leidenschaft für neue Technologien.`,
        `${yrs} Jahre als ${job} tätig. Wohnhaft in ${city}.`,
        `Erfahrener ${job} aus ${city} mit Fokus auf nachhaltige Lösungen.`,
        `${job} aus ${city}. ${yrs} Jahre Berufserfahrung in der Branche.`,
      ]);
    }

    // ── Titel / Beschreibungen ─────────────────────────────────────────────
    if (n.includes('titel') || n === 'title' || n.includes('subject') || n.includes('betreff') || n.includes('headline'))
      return f.lorem.sentence({min:2,max:6});
    if (n.includes('beschreibung') || n === 'description' || n === 'inhalt' || n === 'content' || n === 'body' || n.includes('_text'))
      return f.lorem.paragraph();
    if (n.includes('zusammenfassung') || n === 'summary' || n === 'abstract')
      return f.lorem.sentences(2);

    // ── Generischer Fallback ───────────────────────────────────────────────
    return f.lorem.sentence(4);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // BLOCK 3: Unbekannter Typ → Warnung + Fallback
  // ══════════════════════════════════════════════════════════════════════════
  console.warn(`[data-faker] Unbekannter Typ "${dataType}" für Spalte "${colName}" → lorem.word()`);
  return f.lorem.word();
}

// ── ARRAY-Generator ───────────────────────────────────────────────────────────
function generateArrayValue(colName, elemType) {
  const et = (elemType || 'text').toLowerCase().trim();
  const twoVals = (fn, cast) => `ARRAY['${fn()}','${fn()}']::${cast}[]`;
  const twoNums = (fn, cast) => `ARRAY[${fn()},${fn()}]::${cast}[]`;

  if (/^(smallint|int2|integer|int4|int|bigint|int8|serial)$/.test(et))
    return twoNums(() => fDE.number.int({min:1,max:1000}), 'integer');
  if (/^(numeric|decimal|real|float4|float8|double precision)/.test(et))
    return twoNums(() => fDE.number.float({min:0,max:100,fractionDigits:2}), 'numeric');
  if (et === 'boolean' || et === 'bool')
    return `ARRAY[${fDE.datatype.boolean()},${fDE.datatype.boolean()}]::boolean[]`;
  if (et === 'uuid')        return twoVals(() => fDE.string.uuid(), 'uuid');
  if (et === 'timestamptz') return twoVals(randomTimestampTZ, 'timestamptz');
  if (et === 'timestamp')   return twoVals(randomTimestamp, 'timestamp');
  if (et === 'date')        return twoVals(randomDate, 'date');
  if (et === 'time' || et === 'timetz') return twoVals(randomTime, 'time');
  if (et === 'inet')        return twoVals(randomIPv4, 'inet');
  if (et === 'cidr')        return twoVals(randomCidr, 'cidr');
  if (et === 'macaddr')     return twoVals(randomMacAddress, 'macaddr');
  return twoVals(() => fDE.lorem.word(), 'text');
}

// ── SQL-Formatierung ──────────────────────────────────────────────────────────
function toSQL(val, colType, colName, maxLen) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'object' && val !== null && val.$raw !== undefined) return val.$raw;
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  if (typeof val === 'number')  return String(val);

  const t = (colType || '').toLowerCase().trim();

  if (t === 'json' || t === 'jsonb') {
    const json = typeof val === 'object' ? JSON.stringify(val) : String(val);
    return `'${json.replace(/'/g,"''")}'::jsonb`;
  }

  const explicitCasts = {
    'uuid':'uuid','inet':'inet','cidr':'cidr','macaddr':'macaddr','macaddr8':'macaddr8',
    'timestamptz':'timestamptz','timestamp with time zone':'timestamptz',
    'timestamp':'timestamp','timestamp without time zone':'timestamp',
    'date':'date','timetz':'timetz','time with time zone':'timetz',
    'time':'time','time without time zone':'time',
    'point':'point','box':'box','circle':'circle','bytea':'bytea',
  };
  if (explicitCasts[t]) return `'${String(val).replace(/'/g,"''")}'::${explicitCasts[t]}`;
  if (t === 'interval')  return `INTERVAL '${String(val).replace(/'/g,"''")}'`;

  let s = typeof val === 'object' ? JSON.stringify(val) : String(val);
  if (maxLen > 0 && s.length > maxLen) s = s.substring(0, maxLen);
  return `'${s.replace(/'/g,"''")}'`;
}

// ── VARCHAR-Länge ─────────────────────────────────────────────────────────────
function getMaxLen(colName, charMaxLen) {
  if (charMaxLen > 0) return charMaxLen;
  const n = colName.toLowerCase();
  if (n.includes('url')          || n.includes('domain'))       return 2000;
  if (n.includes('email')        || n.includes('mail'))         return 255;
  if (n.includes('hash')         || n.includes('password'))     return 255;
  if (n.includes('user_agent'))                                 return 512;
  if (n.includes('beschreibung') || n.includes('description'))  return 1000;
  if (n.includes('belegnummer')  || n.includes('transaktion'))  return 100;
  return 0;
}

// ── Haupt-Export ──────────────────────────────────────────────────────────────
export async function generateBulkInsertSQL(tableName, columns, rowCount = 20) {
  const rows = [];
  for (let i = 0; i < rowCount; i++) {
    const vals = columns.map(col => {
      try {
        if (col.fkValues?.length > 0) {
          const v = col.fkValues[Math.floor(Math.random() * col.fkValues.length)];
          return toSQL(v, col.type, col.name, 0);
        }
        if (col.validValues?.length > 0) {
          const v = col.validValues[Math.floor(Math.random() * col.validValues.length)];
          return toSQL(v, col.type, col.name, 0);
        }
        if (col.arrayElemType) return generateArrayValue(col.name, col.arrayElemType);
        const v = generateValue(col.name, col.type);
        return toSQL(v, col.type, col.name, getMaxLen(col.name, col.charMaxLen || 0));
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

export async function generateFakeCellValue(colName, dataType) {
  return generateValue(colName, dataType);
}
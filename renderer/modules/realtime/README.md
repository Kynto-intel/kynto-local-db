# 🔌 Kynto Realtime Connection – Auto-Reconnect System

## 📋 Überblick

Das neue **Realtime Connection System** bietet:

✅ **Auto-Reconnect** mit exponentieller Backoff-Strategie (1s, 2s, 4s, 8s, 16s, 30s...)  
✅ **Visueller Status-Indikator** – Der Nutzer sieht jederzeit ob Realtime aktiv ist  
✅ **Fehlerbehandlung** – Bei WLAN Problems oder Server-Restart funktioniert alles automatisch  
✅ **Robustheit** – Unendliche Reconnect-Versuche bis Verbindung wieder aktiv  

## 📁 Dateistruktur

```
renderer/modules/realtime/
├── realtime-connection.js       # Auto-Reconnect Manager
├── realtime-status.js           # UI Status-Indikator
├── realtime-status.css          # Styling für Status-UI
└── INTEGRATION_GUIDE.md         # Detaillierte Integration
```

## 🚀 Wie es funktioniert

### Szenario 1: Normaler Betrieb (WLAN aktiv, Server läuft)
```
Nutzer öffnet Tabelle
  ↓
RealtimeConnection.start() startet
  ↓
PostgreSQL LISTEN verbindet
  ↓
🟢 Status-UI zeigt: "Realtime Aktiv"
  ↓
Änderungen → automatisches Reload
```

### Szenario 2: WLAN geht weg
```
Verbindung aktiv (🟢)
  ↓
WLAN Fehler tritt auf
  ↓
RealtimeConnection fängt Fehler
  ↓
🟡 Status-UI zeigt: "Verbindung wird hergestellt..." (mit Spinner)
  ↓
Auto-Retry in 1s
  ↓
Immer noch kein WLAN → Retry in 2s
  ↓
Immer noch kein WLAN → Retry in 4s
  ↓
...
```

### Szenario 3: WLAN kommt zurück
```
Reconnect-Versuch bei aktiver Verbindung erfolgreich
  ↓
Backoff setzt auf 1s zurück
  ↓
🟢 Status-UI zeigt wieder: "Realtime Aktiv"
  ↓
Alles funktioniert wie vorher
```

### Szenario 4: Server wird neu gestartet
```
Realtime verbunden (🟢)
  ↓
Server-Shutdown: LISTEN bricht ab
  ↓
🟡 Status-UI zeigt Reconnect-Versuch
  ↓
Auto-Retry in 1s
  ↓
Server antwortet wieder
  ↓
🟢 Status-UI zeigt: "Realtime Aktiv"
  ↓
Nutzer muss NICHTS machen!
```

## 👁️ Status-Indikator

Die Status-UI erscheint automatisch und zeigt:

```
🟢 Realtime Aktiv           → Connected und Live-Daten synchronisieren
🟡 Verbindung wird hergestellt... (mit Spinner) → Gerade Reconnect-Versuch
🔴 Realtime Fehler          → Fehler beim Verbinden, Neuversuch läuft
⚫ Realtime Offline          → Nicht verbunden, manuelles Retry möglich
```

**Features:**
- Hover zeigt **Tooltip** mit More Details
- Bei Fehler: **Error Message** anzeigen
- Click auf roten/grauen Punkt: **Manuelles Reconnect** erzwingen

## 🔧 Integration in useKyntoRealtime

Die Integration ist bereits implementiert! Vorher/Nachher:

### ❌ Vorher (Kein Auto-Reconnect)
```javascript
import { KyntoEvents } from '../../src/lib/kynto-events.js';

await KyntoEvents.startListen(connStr);
// Problem: Wenn Fehler → Kein Reconnect, Game Over
```

### ✅ Nachher (Mit Auto-Reconnect)
```javascript
import { RealtimeConnection } from './realtime/realtime-connection.js';

await RealtimeConnection.start(connStr);
// Jetzt mit Auto-Reconnect, Exponential Backoff, Status-UI!
```

## 💻 Developer API

### Starten mit Auto-Reconnect
```javascript
import { RealtimeConnection } from './realtime/realtime-connection.js';

// Einfaches Start
await RealtimeConnection.start('postgres://...');

// Mit Max-Attempts (Default = Infinity = unendlich)
await RealtimeConnection.start('postgres://...', 10);  // Max 10 Versuche

// Listen auf Status Changes
RealtimeConnection.onConnectionChanged((event) => {
  const { state, attempts, error } = event.detail;
  
  if (state === 'connected') {
    console.log('✅ Verbunden!');
  } else if (state === 'error') {
    console.error(`❌ Fehler: ${error}`);
  } else if (state === 'connecting') {
    console.log(`🟡 Versuch #${attempts}...`);
  }
});
```

### Status Abfragen
```javascript
// Aktueller Status
RealtimeConnection.getState();        // 'connected' | 'connecting' | 'error' | 'disconnected'

// Ist verbunden?
RealtimeConnection.isConnected();     // true/false

// Ist gerade am Verbinden?
RealtimeConnection.isConnecting();    // true/false

// Reconnect-Versuche
RealtimeConnection.getReconnectAttempts();  // Zahl

// Letzter Fehler
RealtimeConnection.getLastError();    // String oder null
```

### Manuuelle Kontrolle
```javascript
// Sofort Reconnect (z.B. nach Server-Restart)
await RealtimeConnection.forceReconnect();

// Stoppen (z.B. bei Tab-Wechsel)
await RealtimeConnection.stop();
```

## 🔄 Backoff-Timing

Exponential Backoff mit jitter für robuste Reconnection:

```
Verbindungs-Versuch 1: Sofort
Verbindungs-Versuch 2: 1s Wartezeit
Verbindungs-Versuch 3: 2s Wartezeit
Verbindungs-Versuch 4: 4s Wartezeit
Verbindungs-Versuch 5: 8s Wartezeit
Verbindungs-Versuch 6: 16s Wartezeit
Verbindungs-Versuch 7+: 30s Wartezeit (Max)

Bei erfolgreichem Connect → Backoff setzt auf 1s zurück
```

**Warum Backoff?**
- Verhindert Server-Überlastung durch zu viele Reconnects
- Gibt Zeit für temporäre Fehler (WLAN, Netzwerk)
- Nutzer sieht nicht ein "flackerndes" Status-UI

## 🎯 Events

Alle Status-Änderungen als Browser-Event:

```javascript
window.addEventListener('realtime:connection-changed', (event) => {
  const {
    state,           // 'disconnected' | 'connecting' | 'connected' | 'error'
    previousState,   // vorheriger State
    attempts,        // Anzahl Reconnect-Versuche
    error,           // Fehler-Meldung (falls error)
    timestamp        // Event-Zeit in ms
  } = event.detail;
});
```

## 🛠️ Debugging (F12 → Konsole)

```javascript
// Status abfragen
window.RealtimeConnection.getState()
window.RealtimeConnection.isConnected()

// Logs anschauen (in Console)
// [RealtimeConnection] Zeigt alle State Changes und Reconnect-Versuche

// Manuell Reconnect
await window.RealtimeConnection.forceReconnect()

// Stoppen
await window.RealtimeConnection.stop()
```

## 🐛 Troubleshooting

### "Realtime zeigt immer 🔴 Fehler"
→ Connection String falsch? DB Down? Logs checken (F12):
```
[RealtimeConnection] ❌ Versuch fehlgeschlagen: ...
```

### "Status bleibt auf 🟡 Connecting"
→ Server nicht erreichbar? Check netzwerk. Fallback auf Polling funktioniert trotzdem.

### "Status wechselt ständig 🟢→🟡→🟢"
→ Instabile Verbindung. Backoff hilft. Wenn persistiert: Netzwerk-Issue

## 📊 Performance

- **Speicher:** Minimal (nur State + Timer)
- **CPU:** Nur bei Status-Änderung aktiv
- **Netzwerk:** Exponential Backoff verhindert Spam
- **DOM:** 1 kleiner Indikator (< 1ms render)

## ✨ Besonderheiten

✅ **Keine Breaking Changes** – KyntoEvents funktioniert weiterhin wie gewohnt  
✅ **Automatisches Fallback** – Wenn LISTEN nicht verfügbar → Smart Polling  
✅ **Browser-Events** – Andere Module können abonnieren  
✅ **i18n Ready** – Status texte werden übersetzt (siehe realtime-status.js)  
✅ **Light/Dark Theme** – CSS Variablen unterstützen beide Modi  

## 📞 Support

Fragen zur Integration? Siehe `INTEGRATION_GUIDE.md` für detaillierte Beispiele.

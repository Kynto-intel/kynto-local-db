/* ── modules/action-bar.js ───────────────────────────────────────────
   REFAKTORIERT: Action-Bar Proxy-Modul
   
   Dieses Modul delegiert alle Button-Handler an das action-buttons/ Paket.
   Die komplette Button-Logik ist jetzt modular in separaten Dateien organisiert.
   ──────────────────────────────────────────────────────────────────── */

// Alle Button-Logik liegt jetzt in action-buttons/index.js
export { initActionBar, default } from './action-buttons/index.js';

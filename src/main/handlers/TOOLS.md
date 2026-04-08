# 🤖 Kynto AI Tool-Calling System

## 📋 Übersicht

Die KI in Kynto hat **echten Zugriff auf deine Datenbank** über spezielle Tools!

**Zugriffsmethode:** Alle Daten auf einmal (batch) - nicht zeilenweise
- ✅ Effizienter (weniger Requests)
- ✅ Besser für Patterns (KI sieht ganzen Datensatz)
- ✅ Schneller Kontext (KI versteht gesamte Situation)

---

## 🛠️ Verfügbare Tools

### 📖 **READ TOOLS** (Daten lesen)

#### 1. **execute_query** - Beliebige SQL-Abfragen
```
execute_query: SELECT * FROM "allvallhalla_csv" WHERE Status = 'ok'
```
✅ Nutze für: Komplexe Abfragen, Joins, Filters
❌ Nicht für: Tausende Zeilen auf einmal

#### 2. **get_table_stats** - Aggregierte Statistiken
```
get_table_stats: table=allvallhalla_csv, column=Eingänge (EUR)
```
**Liefert:** MAX, MIN, AVG, COUNT
✅ Nutze für: Schnelle Übersichten, Performance-Statistiken

#### 3. **get_table_sample** - Beispieldaten
```
get_table_sample: table=allvallhalla_csv, limit=50
```
✅ Nutze für: Schema verstehen, Datenqualität prüfen

---

### ✏️ **WRITE TOOLS** (Daten ändern) - ⚠️ NUR MIT BESTÄTIGUNG

> **REGEL:** Die KI fragt IMMER vorher um Bestätigung, bevor sie Daten ändert!

#### 4. **update_rows** - Zeilen aktualisieren
```
update_rows: table=allvallhalla_csv, set="Status"='bereinigt', where="Status" IS NULL
```
⚠️ **MUSS WHERE haben** (niemals ungebremste Updates!)

**Beispiele:**
- Fehlerhafte Werte korrigieren
- Status-Felder aktualisieren
- Duplikate bereinigen

#### 5. **insert_rows** - Neue Zeilen hinzufügen
```
insert_rows: table=allvallhalla_csv, columns=Datum|Status|Betrag, values=2025-04-08|ok|100
```

**Beispiele:**
- Neue Einträge hinzufügen
- Bulk-Import durchführen
- Test-Daten einfügen

#### 6. **delete_rows** - Zeilen löschen
```
delete_rows: table=allvallhalla_csv, where=Status='invalid'
```
⚠️ **MUSS WHERE haben** (niemals ungebremste Deletes!)

**Beispiele:**
- Doppelte Einträge entfernen
- Fehlerhafte Daten löschen
- Alte Test-Daten aufräumen

---

## 💬 Beispiel-Workflows

### Workflow 1: Daten analysieren (READ)
```
Nutzer: "Was ist der Durchschnittswert in EUR?"

KI denkt:
1. Nutzer fragt nach Daten
2. Nutzer sagt "durchschnittlich" → Statistiken brauchen
3. Nutzer sagt "EUR" → Spalte "Eingänge (EUR)"
4. Tool-Call:

get_table_stats: table=allvallhalla_csv, column=Eingänge (EUR)

KI bekommt: Max=1500, Min=100, Avg=750, Count=10

KI antwortet:
"Der Durchschnittswert liegt bei **750 EUR**. 
Das ist ein gutes Zeichen - die Einnahmen schwanken zwischen 100 und 1500 EUR."
```

### Workflow 2: Daten bereinigen (WRITE)

```
Nutzer: "Setz alle NULL-Status auf 'ungeklärt'"

KI Schritt 1: PREVIEW zeigen!
execute_query: SELECT * FROM "allvallhalla_csv" WHERE "Status" IS NULL LIMIT 10

[Frontend zeigt 5 Zeilen die betroffen sind]

KI warnt:
"⚠️ Das würde 47 Zeilen ändern! Hier sind die betroffenen Einträge:
[Tabelle mit Preview]

Soll ich diese Zeilen mit Status='ungeklärt' aktualisieren?"

Nutzer: "Ja, mach das"

KI Schritt 2: UPDATE ausführen!
update_rows: table=allvallhalla_csv, set="Status"='ungeklärt', where="Status" IS NULL

KI antwortet:
"✅ Fertig! 47 Zeilen wurden aktualisiert."
```

### Workflow 3: Fehlerhafte Daten löschen (WRITE)

```
Nutzer: "Lösch alle Zeilen mit Status='Fehler'"

KI Schritt 1: PREVIEW
execute_query: SELECT COUNT(*) FROM "allvallhalla_csv" WHERE Status='Fehler'

[Bekommt: 12 Zeilen betroffen]

KI warnt:
"⚠️ Achtung! Das würde 12 Zeilen LÖSCHEN. Hier sind die betroffenen Einträge:
[Preview der 12 Zeilen]

Das ist eine **destruktive Operation** - danach sind die Daten weg!

Willst du wirklich 12 Zeilen löschen?"

Nutzer: "Ja, löschen"

KI Schritt 2: DELETE
delete_rows: table=allvallhalla_csv, where="Status"='Fehler'

KI antwortet:
"✅ 12 fehlerhafte Einträge wurden gelöscht."
```

---

## 🎯 Tool-Auswahllogik (Wann nutzt die KI welches Tool?)

| Frage des Nutzers | Tool | Warum? |
|---|---|---|
| "Wie viele Zeilen?" | `get_table_stats` | Nur COUNT nötig, effizient |
| "Höchster Wert?" | `get_table_stats` | Nur MAX nötig |
| "Zeig mir Top-10" | `execute_query` | Braucht komplexe Sortierung |
| "Welche Spalten?" | `get_table_sample` | Schema verstehen |
| "Setz alle Fehler auf OK" | `update_rows` | Write-Operation mit WHERE |
| "Füg 100 neue ein" | `insert_rows` | Bulk-Import |
| "Lösch Duplikate" | `delete_rows` | Cleanup mit sicherer WHERE |

---

## ⚠️ Sicherheit & Best Practices

### ✅ Die KI macht RICHTIG:
- ✅ Preview zeigen BEVOR Write-Operation
- ✅ IMMER WHERE-Klauseln bei UPDATE/DELETE
- ✅ Nutzer MUSS bestätigen (y/n)
- ✅ Bestätigungsnachricht nach Änderung

### ❌ Die KI macht FALSCH (würde blockiert):
- ❌ DELETE ohne WHERE (`delete_rows: table=x, where=1=1`)
- ❌ UPDATE ohne WHERE
- ❌ Zeilen ändern ohne Bestätigung
- ❌ Tausende Zeilen auf einmal laden (nutzt LIMIT)

---

## 🔧 Technische Details

### Backend-Implementierung
- **Datei:** `src/main/handlers/ai-handler.js`
- **6 Tools:** execute_query, get_table_stats, get_table_sample, update_rows, insert_rows, delete_rows
- **Tool-Calling Loop:** KI fragt Tool → Backend führt aus → Ergebnis zurück zu KI → Final Response

### Frontend-Integration
- **Datei:** `renderer/modules/ai.js`
- **Payload enthält:** systemPrompt + mögliche Tools + Kontext (currentTable, Schema)
- **Tool-Erkennung:** Parser erkennt `tool_name: params` in KI-Response

### Alles-auf-Einmal vs. Zeilenweise?
**Alles auf Einmal ist BESSER weil:**
1. **Pattern Recognition:** KI sieht ganzen Datensatz → bessere Analysen
2. **Effizienz:** 1 Query statt 1000 einzelne
3. **Kontext:** KI versteht Verteilung, Outliers, Trends
4. **Performance:** Schneller im Frontend + Backend

---

## 📝 Beispiel-Prompts zum Ausprobieren

```
"Analysiere die allvallhalla_csv Tabelle"
→ get_table_sample + get_table_stats

"Was sind die Top-5 Werte in EUR?"
→ execute_query: SELECT ... ORDER BY ... LIMIT 5

"Setz alle NULL-Werte auf 0"
→ Preview + update_rows (nach Bestätigung)

"Wie viele gültige Einträge haben wir?"
→ execute_query: SELECT COUNT(*) WHERE ...

"Löschen alle duplizierten Zeilen"
→ execute_query (zum Prüfen) + delete_rows (nach Bestätigung)
```

---

## 🚀 Zukünftige Erweiterungen

Möglich:
- ✅ Multi-Table Joins
- ✅ Transactions (mehrere Operationen zusammen)
- ✅ Batch-Updates mit Conditional Logic
- ✅ Export zu CSV/Excel
- ✅ Audit-Logs (was wurde wann von wem geändert)

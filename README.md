# Kynto – Local Database Platform

> **Your data. Your machine. No cloud. No bills. No bullshit.**

Kynto is a local-first database platform built by one developer who got tired of cloud dependency. It's not finished. It's not perfect. But it works — and it's growing every day.

![Kynto Demo](image/Animation.gif)

**[→ Quick Start](#quick-start)** • **[→ Features](#what-can-you-do)** • **[→ Roadmap](#roadmap)** • Status: **Beta (actively building)**

---

## Why I built this

Every time I started a new project I had the same problem: Firebase wants my data, Supabase wants a credit card, and everything lives on someone else's server.

So I built Kynto. It runs locally. Completely. Forever free.

| | Kynto | Supabase | Firebase |
|---|---|---|---|
| **Data lives where?** | Your machine | Their servers | Google's servers |
| **Speed** | ~0.7ms (local) | Network latency | Network latency |
| **Cost** | Free | Pay per use | Pay per use |
| **Needs internet?** | Nope | Yep | Yep |
| **Who owns your data?** | You | Technically you, but... | Google |

---

## What Can You Do?

These features are built and working. Not perfect — but real.

✨ **SQL Editor** — Write queries, see results instantly. No waiting for cloud.

📊 **Data Visualization** — Tables, type highlighting, entity relationships, schema overview.

⚡ **Realtime Engine** — Native PostgreSQL `LISTEN/NOTIFY` with automatic trigger installation. Changes push to the UI instantly — no polling.

🕷️ **AI Web Scraper** — Give it a URL, get clean structured data. Handles JavaScript-heavy sites and bot detection. Powered by Crawlee. Track progress in realtime.

📖 **AI Schema Docs** — Automatically generates descriptions and insights for your tables. Turns raw schemas into readable Markdown documentation.

🛡️ **Security & RLS** — Manage Row-Level Security policies directly in the UI. Built-in protection against destructive queries (`DELETE` without `WHERE`). Automatic redaction of secrets like API keys and passwords.

🌐 **Auto REST API** — Generate REST endpoints directly from your tables. Local server, zero config.

🤖 **AI Assistant** *(in progress)* — Ask it what you need, it writes SQL. Runs on local Ollama — your data never leaves your machine.

📥 **Import** — CSV, JSON, SQL dumps. Drag, drop, done.

**Engines supported:** PostgreSQL · DuckDB · PGlite

---

## Quick Start

```bash
git clone https://github.com/Kynto-intel/kynto-local-db
cd kynto-local-db
npm install
npm start
```

**Requirements:** Node.js 18+ · npm

That's it. No account. No setup wizard. No cloud.

---

## What's honest about the current state

I want to be upfront:

- ✅ Core features work and I use them daily
- ✅ PostgreSQL local + remote, DuckDB, PGlite all connected
- 🚧 AI SQL assistant is functional but not polished yet
- 🚧 Sync between local ↔ remote still needs work
- 🚧 Windows tested, Linux/Mac not fully tested yet
- ❌ No automated tests yet (working on it)

This is a real project, not a demo. But it's still early. Bugs exist. If you find one — open an issue, I'll actually fix it.

---

## Roadmap

- ✅ SQL editor with syntax highlighting
- ✅ Local data visualization
- ✅ REST API generation
- ✅ Realtime engine
- ✅ AI Web Scraper
- ✅ RLS policy manager
- ✅ AI schema documentation
- 🚧 AI SQL assistant (polishing)
- 🚧 Better local ↔ remote sync
- 🚧 Advanced charts
- 🚧 Cross-platform builds (Mac/Linux)
- 💡 Collaborative features (later)

---

## Contribute

This is my solo project. I built everything here — and I'd genuinely love help.

Found a bug? Have an idea? Want to add something? Open an issue or send a PR. No complicated processes. No bureaucracy. Just build.

---

## Tech Stack

`Electron` · `PostgreSQL` · `DuckDB` · `PGlite` · `PostgREST` · `Crawlee` · `Ollama`

---

<div align="center">

Built by one developer. Tired of cloud bills.

**[@KyntoIntel](https://twitter.com/KyntoIntel)**

</div>

# Piano slice — Second Brain (Assistente di Ambito)

> **Destinazione**: in app, l’utente (studio o cliente pagante) vede e interroga **i fatti del solo Ambito attivo** — NC, scadenze, gap — senza un secondo sistema Claude e senza mescolare i clienti. La chat esistente (`/ai-assistant`) diventa consumatore di quei fatti, non un cervello parallelo.
> **Spec / ADR**: [ADR-010](../adr/ADR-010-ai-agentic-architecture.md) (licenze, audit trail, HITL) · [SAL §K](../specs/MODULO_SAL_SCOPO_E_ROADMAP.md) (AI = consumatore del motore gap, isolamento `organization_id` + `company_id`) · Ambito unico (`CompanyScopeSelect`)
> **Brief attivo**: [`DEPUTYTASK2.md`](DEPUTYTASK2.md) — slice **SB-1** (APERTO). **Non** usare `DEPUTYTASK.md` (occupato da SAL S1a).
> **Mappa creata**: 16/08/2026 (Lead wayfinder A — Chart the map; nessuna implementazione in questa sessione)
> **Fonte intuizione**: masterclass AIOS (Fontanella) — adottare i *livelli* (contesto / dati / intelligence / automazioni / controllo) **dentro** il prodotto, non una cartella Claude parallela.

---

## Fuori scope

- Cartella / workspace Claude Code, SQLite locale, dashboard localhost, `/prime` che carica GUIDA intera
- Unificare il harness Cursor (ADR-015, `AGENTS.md`) col cervello in-app — restano due sistemi: **sviluppo** vs **prodotto**
- Nuova chiave licenza (`ai_brain`, ecc.) — MVP riusa `ai_chat` già in `moduleLicense.service.js`
- Meeting / WhatsApp / Fireflies / Slack (IntelOS del video)
- Chat che **scrive** NC, WPS, RDP, stato SAL o verbali senza conferma umana
- Vector store nuovo o secondo RAG — il knowledge indexer esistente resta; i fatti operativi arrivano da query SQL vive
- Pagina nuova tipo «iOS Control» — si estende `AiAssistantPage.jsx`
- Patrimonio studio come se fosse un’azienda cliente (resta albero STD, non entra nei conteggi cliente)
- Offline: la card fatti è online; in PWA restano i moduli già persistiti (NC, scadenze)

---

## Non ancora specificato

- Quando (e se) ingerire **verbali meeting** del cliente: consenso, retention, dove vivono i file — solo dopo SB-3 stabile
- Card fatti anche in **Home** («Cosa fare oggi») — utile, ma seconda superficie; non aprire prima di SB-2
- **Memoria persistente** di decisioni («il 12/08 abbiamo deciso X») oltre ai moduli già in DB (riesame, audit) — serve modello + HITL privacy
- Stile di casa per-studio (few-shot da verbali passati, SAL §K.4.2) — dopo che i fatti sono veri
- Quota token / caching del blocco fatti iniettato in chat (TTL? per-request?)
- Estendere i fatti a gap SAL / WPQR in scadenza — dopo i tre conteggi core (NC, qualifiche, documenti)

---

## Decisioni già prese (16/08/2026, committente + Lead)

- **In-app, non Claude**: l’AIOS è il prodotto venduto a studio e clienti paganti
- **N cervelli, non uno**: isolamento obbligatorio `organization_id` + `company_id` (Ambito). Vietato un ricordo unico «studio + tutti i clienti»
- **Studio su «Tutto lo studio»**: solo aggregati (conteggi / urgenze), mai testo o documenti di un cliente mescolati a un altro — slice **SB-4**, non SB-1
- **Prima i fatti, poi la chat**: niente riscrittura dell’assistente finché non esiste uno snapshot verificabile (zero LLM)
- **Cliente pagante vede i fatti della sua azienda** (Ambito bloccato, già in `aiCompanyScope.service.js`)
- **Controllo = pagina Assistente AI esistente** + Ambito in header; bottoni = proposte, umano conferma
- **Collare AI**: ADR-010 (`logAiInteraction`, `AiDisclaimer`, licenza). L’AI cita dati; non certifica conformità
- **Nessuna migrazione** per SB-1…SB-3: si leggono tabelle già in produzione

---

## Gap vs funzione attesa

| Aspetto | Oggi | Atteso | Slice |
|---------|------|--------|-------|
| Fatti operativi per Ambito | Chat RAG su chunk; le domande «quante NC aperte?» dipendono dall’indice, non dai conteggi live | Snapshot SQL vivo: NC aperte, qualifiche ≤30gg, documenti ≤30gg | **SB-1** |
| UI «il sistema ricorda questa azienda» | Chip contesto + suggerimenti testuali | Card KPI (pattern Qualifiche `.sq-stat`) sopra la chat, legate all’Ambito | **SB-1** |
| Chat usa gli stessi numeri | System prompt = profilo + chunk, senza i tre conteggi | Blocco fatti iniettato in `POST /ai/chat` (stesso service) | **SB-3** |
| «Tutto lo studio» | `companyId` null → RAG org-wide (rischio mescolanza) | Solo totali + elenco urgenze per azienda (nome + conteggio), zero testi cliente | **SB-4** |
| Automazioni da bottone | Chip suggerimento → l’utente digita | Pulsanti che aprono il modulo giusto (NC, Qualifiche, Scadenze) con filtro già applicato | **SB-5** |
| Meeting / second brain narrativo | Assente | Nebbia — non spezzare ora | — |

---

## Mappa slice

| Slice | Tema | Perimetro (file/layer) | Dipende da | Tipo |
|-------|------|------------------------|------------|------|
| **SB-1** | Snapshot fatti Ambito (API + card, zero LLM) | `ambitoFacts.service.js` + GET su `aiChat.routes.js` + card in `AiAssistantPage.jsx` + test L1 | — | AFK |
| **SB-2** | Ambito header = unico input | Card e GET seguono `CompanyScopeContext`; patrimonio / «Tutto lo studio» → stato vuoto chiaro («Seleziona un’azienda»), niente 403 al cliente | SB-1 | AFK |
| **SB-3** | Chat consuma lo snapshot | `aiChat.controller.js` chiama lo stesso service; blocco fatti nel system prompt; test: Mason non vede numeri Camellini | SB-1 | AFK |
| **SB-4** | Vista studio aggregata | Stesso GET con `companyId` null: totali + top aziende per urgenza (id, nome, conteggi). Vietato concatenare note/chunk di più clienti | SB-2 | AFK |
| **SB-5** | Pulsanti operativi (non chat) | Dalla card: vai a NC / Qualifiche / Scadenze con Ambito già impostato; `disabled` + `title` se manca azienda (azioni gated) | SB-2 | AFK |
| **SB-6** | Fatti SAL (opzionale) | Aggiungere gap aperti allo snapshot **riusando** `gapAnalysis.service` / `requirement_implementation_status`, non un secondo motore | SB-3, SAL stabile | AFK |

**Ordine**: SB-1 → SB-2 → SB-3 → SB-4 → SB-5. SB-6 dopo, se i tre conteggi reggono in produzione.

**Parallelo**: SB-1/2/3 toccano gli stessi file chat — **non** aprire due deputy. `DEPUTYTASK.md` resta SAL; questo epic usa **`DEPUTYTASK2.md`**.

**Rischio SB-1…SB-5**: Medio (endpoint additivo, no schema, no auth nuovo) — PR + Bugbot. Non Alto: non si tocca JWT / sync / migrazioni distruttive.

---

## SB-1 — Hello world (prima slice eseguibile)

Vedi brief [`DEPUTYTASK2.md`](DEPUTYTASK2.md).

Obiettivo demoable: con Ambito = un’azienda, in Assistente AI compaiono **tre numeri veri** (NC aperte, qualifiche in scadenza 30 giorni, documenti in scadenza 30 giorni), calcolati dal DB, senza chiamata LLM. Cliente di un’azienda non vede i numeri di un’altra.

---

## Allineamento ai 5 livelli AIOS (solo prodotto)

| Livello video | Artefatto ProgettoISO | Slice |
|---|---|---|
| Contesto | Ambito + `company_profile` + `aiCompanyScope` | già + SB-2 |
| Dati | Snapshot SQL (`ambitoFacts`) | SB-1, SB-4, SB-6 |
| Intelligence | Moduli esistenti (audit, riesame); meeting = nebbia | — |
| Automazioni | Pulsanti → moduli, HITL | SB-5 |
| Controllo | `AiAssistantPage` + licenza `ai_chat` | SB-1…SB-3 |

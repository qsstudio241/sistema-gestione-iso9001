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
- OAuth Gmail/Drive **nella prima ondata** (CTX-0…CTX-3): consenso + token = rischio Alto, dopo la rubrica e il web pubblico
- Auto-salvataggio del contesto da ricerca web/email senza conferma admin

---

## Non ancora specificato

- Quando (e se) ingerire **verbali meeting** del cliente: consenso, retention, dove vivono i file — solo dopo SB-3 stabile
- Card fatti anche in **Home** («Cosa fare oggi») — utile, ma seconda superficie; non aprire prima di SB-2
- **Memoria persistente** di decisioni («il 12/08 abbiamo deciso X») oltre ai moduli già in DB (riesame, audit) — serve modello + HITL privacy
- Stile di casa per-studio (few-shot da verbali passati, SAL §K.4.2) — dopo che i fatti sono veri
- Quota token / caching del blocco fatti iniettato in chat (TTL? per-request?)
- Estendere i fatti a gap SAL / WPQR in scadenza — dopo i tre conteggi core (NC, qualifiche, documenti)
- Quali connettori email/Drive (Google vs Microsoft 365) e **chi** può concedere l’accesso (solo admin studio vs anche admin azienda cliente)
- Retention e revoca token; cosa succede se in una casella studio ci sono mail di più clienti (anti-mescolanza)

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
- **Contesto scritto ≠ fatti live**: «Il mio Studio» e l’anagrafica aziende sono il Context OS; SB-1 è il Data OS. Entrambi servono; non fonderli in una chat sola
- **Wizard contesto (16/08, committente)**: assistente specializzato che *intervista* l’admin, propone da rete pubblica (e solo dopo, se concessi, email/Drive), **non scrive da solo**, e mostra sempre il **livello raggiunto vs rubrica** (best practice / golden rules versionate nel repo)
- **Due rubriche, due ambiti**: studio (`/settings/studio`, oggi `ai_context_notes`) ≠ azienda (`CompanyDetailPage` + `company_profile` ADR-018). Vietato usare la ricerca di un cliente per riempire lo studio e viceversa
- **Email/Drive**: opt-in esplicito, revocabile; assente = solo fonti pubbliche + domande. Non bloccano CTX-0…CTX-3

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
| Contesto studio | Textarea `ai_context_notes` (2000 car., admin) già in prompt AI; nessun punteggio né intervista | Wizard in **Il mio Studio**: domande + score vs rubrica studio | **CTX-1** |
| Contesto azienda | Anagrafica minima + profilo ADR-018 + registro P.IVA; `profile_completeness` grezzo | Stesso wizard sulla scheda azienda; rubrica = catalogo A/B già in spec | **CTX-2** |
| Rubrica / golden rules | Implicite in ADR-018 e hint UI | File versionato + scorer puro (zero LLM) | **CTX-0** |
| Ricerca web | Lookup registro (S6) su P.IVA; niente sito/news | Proposte citate (URL) + conferma admin | **CTX-3** |
| Email / Drive | Assente | Opt-in dopo CTX-3; HITL connettori | **CTX-4** (Alto) |

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
| **CTX-0** | Rubrica + score (zero LLM) | File `docs/reference/CONTESTO_RUBRICA_STUDIO_AZIENDA.md` (o JSON in `backend/src/data/`) + `contextCompleteness.service.js` puro: percentuale e buchi vs golden rules. Test L1 sulle soglie | — | AFK |
| **CTX-1** | Intervista studio | Tab/card in `StudioSettingsPage.jsx` (non pagina nuova): una domanda alla volta → bozza su `ai_context_notes` / campi org; **Salva** solo su conferma admin; score sempre visibile | CTX-0 | AFK |
| **CTX-2** | Intervista azienda | Stesso guscio su `CompanyDetailPage` / `CompanyProfilePanel`; scrive `company_profile` (HITL, come registro S6); isolamento `company_id` | CTX-0, CTX-1 (riuso UI) | AFK |
| **CTX-3** | Fonti pubbliche | Riuso `CompanyRegistrySearch` + lookup sito/ATECO; ogni proposta ha `source_url` + `source: web\|registry`; mai overwrite silenzioso | CTX-2 | AFK |
| **CTX-4** | Email / Drive (opt-in) | OAuth, secret in Dashboard, scope per tenant; se la casella è dello studio non indicizzare allegati di altri clienti. **Alto** — conferma committente prima del codice | CTX-3 + HITL connettore | HITL |

**Ordine fatti**: SB-1 → SB-2 → SB-3 → SB-4 → SB-5. SB-6 dopo, se i tre conteggi reggono in produzione.

**Ordine contesto** (pista parallela, file disgiunti da SB-1): CTX-0 → CTX-1 → CTX-2 → CTX-3. CTX-4 solo dopo decisione esplicita.

**Parallelo**: SB-1/2/3 toccano gli stessi file chat — **non** aprire due deputy lì. CTX-0 può stare su `DEPUTYTASK3.md` quando vorrai il parallelo (file ≠ `AiAssistantPage`). `DEPUTYTASK.md` resta SAL; i fatti usano **`DEPUTYTASK2.md`**.

**Altri moduli in corso (16/08 pomeriggio) — non pestare**

| In corso | File vietati a Second Brain |
|---|---|
| ISO 3834 (agente «completezza», ISO-3) | `projects.*`, `rdp.*`, `welding*`, `PLAN_3834*`, `DEPUTYTASK1.md`, livello 3834 in `CompanyDetailPage` |
| SAL S1a (`DEPUTYTASK.md` APERTO) | `documentTextExtractor*`, `ocrExtractor*`, `salAiSuggest*`, `DEPUTYTASK.md` |
| Rischi PR #436 (SWOT / 4.1–4.2) | `RisksPage*`, `risks.controller*`, cataloghi 4.1/4.2. `apiService.js` solo **righe additive** in fondo |

CTX-2 (scheda azienda) **non** partire finché l’agente 3834 è attivo (stesso file anagrafica). CTX-0 e SB-1 sono disgiunti da 3834.

**Rischio SB-1…SB-5**: Medio (endpoint additivo, no schema, no auth nuovo) — PR + Bugbot. Non Alto: non si tocca JWT / sync / migrazioni distruttive.

---

## SB-1 — Hello world (prima slice eseguibile)

Vedi brief [`DEPUTYTASK2.md`](DEPUTYTASK2.md).

Obiettivo demoable: con Ambito = un’azienda, in Assistente AI compaiono **tre numeri veri** (NC aperte, qualifiche in scadenza 30 giorni, documenti in scadenza 30 giorni), calcolati dal DB, senza chiamata LLM. Cliente di un’azienda non vede i numeri di un’altra.

---

## CTX-0 — Hello world della pista contesto (quando vorrai il parallelo)

Non aprire ora se SB-1 è in corso. File disgiunti: rubrica + scorer, niente chat.

Obiettivo demoable: dato lo studio (o un’azienda) così com’è oggi, l’admin vede **«Contesto 35% — mancano: settori serviti, norme offerte, stile risposte»** calcolato da regole fisse, senza AI. Le golden rules stanno in un file versionato (fonte unica), non nel prompt libero.

---

## Allineamento ai 5 livelli AIOS (solo prodotto)

| Livello video | Artefatto ProgettoISO | Slice |
|---|---|---|
| Contesto | Rubrica + wizard in Il mio Studio / anagrafica; oggi `ai_context_notes` + `company_profile` | **CTX-0…CTX-3** |
| Dati | Snapshot SQL (`ambitoFacts`) | SB-1, SB-4, SB-6 |
| Intelligence | Moduli esistenti (audit, riesame); meeting = nebbia | — |
| Automazioni | Pulsanti → moduli, HITL | SB-5 |
| Controllo | `AiAssistantPage` + licenza `ai_chat` | SB-1…SB-3 |

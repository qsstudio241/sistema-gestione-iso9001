# Quadro Second Brain — flusso Assistente AI

> **Tipo:** stato prodotto (non codice). **Data:** 17/09/2026 · `origin/main` @ `3980ff25`  
> **Fonti:** `PROJECT_CONTEXT.md` · roadmap § Stato · `PLAN_SECOND_BRAIN_SLICES.md` · ADR-010 · `aiChat.controller.js` · `ambitoFacts.service.js` · `AiAssistantPage.jsx` · `AmbitoFactsBar.jsx` · rubriche CTX  
> **Legenda:** CHIUSO = slice ✅ in piano/roadmap · APERTO = backlog pianificato · HITL = serve decisione/conferma umana · NEBBIA = citato ma non specificato (non aprire ora)

---

## Sintesi (10–15 righe)

Second Brain in ProgettoISO **non** è un vault file-based né un “cervello parallelo”: è il **consumo, in Assistente AI, dei fatti del solo Ambito attivo** (azienda o «Tutto lo studio»), più un **contesto scritto** Studio/Azienda mantenuto a mano con score %.

**CHIUSO e in produzione (roadmap «moduli maturi»):** SB-1…SB-4, SB-6 (fatti SQL + chat che li inietta + aggregati studio-safe + SAL su Ambito azienda); CTX-0…CTX-3 (rubriche, badge/wizard Studio e Azienda, enrichment registro con proposte citate). **SB-5** è **bozza CHIUSA sul nav HITL** (pulsanti Apri NC/Qualifiche/Scadenze/SAL dalla card) — **write autonoma verso moduli = vietata by design**.

**Manutenzione:** i **numeri** (NC aperte, qualifiche/documenti in scadenza 30gg, SAL) sono **automatici** (query SQL live, zero LLM). Il **testo di contesto** Studio (`ai_context_notes`, P.IVA, prefisso audit) e Azienda (nome/P.IVA/settore/indirizzo) è **HITL**: salvataggio solo su conferma admin; CTX-3 propone, non sovrascrive. **Mancante / bloccato:** CTX-4 Email/Drive (priorità #1 roadmap, **Alto + HITL**, nessun codice senza DoD).

**Efficacia:** buona per **robustezza multi-tenant** (isolamento `organization_id` + `company_id`, RAG `studioSafeOverview` senza mescolare chunk clienti) e per **allineare card e chat agli stessi conteggi**. **Non** è autoapprendimento ML: non “impara” da solo dalle chat; il loop preferenze `ai_feedback` in chat è **adiacente**, non manutenzione Second Brain. Limite principale: qualità risposte dipende da contesto HITL compilato + dati moduli; senza Ambito azienda i fatti SAL restano fuori.

---

## Cosa c’è oggi nel flusso Assistente

Flusso operativo (Ambito header = unico input, SB-2):

1. Utente sceglie Ambito in header (`CompanyScopeContext`).
2. `AiAssistantPage` mostra `AmbitoFactsBar` → `GET /ai/ambito-facts` (zero LLM).
3. Alla domanda, `POST /ai/chat` costruisce il system prompt così:
   - **sempre:** profilo Studio (`enrichSystemPromptWithOrganization` → nome, P.IVA, note `ai_context_notes`, prefisso audit);
   - **se azienda:** profilo anagrafica azienda + `loadAmbitoFacts(companyId)` + (se presente) Compliance Map approved;
   - **se «Tutto lo studio»:** solo aggregati + top urgenze (`companyId` null), **niente** profilo azienda misti; RAG con `studioSafeOverview: true`;
   - poi: focus audit/allegati, NormBroker clausola, feedback `rephrased` org, chunk knowledge.

| Slice | Stato | Cosa fa in app |
|-------|-------|----------------|
| SB-1 | CHIUSO | Snapshot NC / qualifiche 30gg / documenti 30gg + card |
| SB-2 | CHIUSO | Card/chat seguono Ambito header; niente chip Ambito locale |
| SB-3 | CHIUSO | Chat inietta lo stesso `ambitoFacts` della card |
| SB-4 | CHIUSO | Vista studio aggregata + RAG studio-safe |
| SB-5 | BOZZA CHIUSA (nav) | Pulsanti nav moduli da card; **no write autonoma** |
| SB-6 | CHIUSO | Conteggio/nav SAL su Ambito azienda |
| CTX-0…3 | CHIUSO | Score % + wizard Studio/Azienda + proposte registro |
| CTX-4 | APERTO · HITL Alto | Email/Drive — **non implementare** senza DoD |

ADR-010 resta il collare runtime AI (adapter, HITL sulle decisioni, audit trail, licenze). Second Brain **riusa** `ai_chat`; nessuna chiave `ai_brain`.

---

## Manutenzione Studio vs Azienda

Due binari distinti (decisione esplicita nel PLAN: **non fondere** contesto scritto e fatti live SQL; **non fondere** score AI con completeness legale ADR-018).

### Studio (organizzazione)

| Elemento | Meccanismo | Automatico / HITL / Mancante |
|----------|------------|------------------------------|
| Identità (nome, P.IVA) | Campi `organizations` | HITL (anagrafica / Il mio Studio) |
| Note operative AI (`ai_context_notes`, min 40 char) | Textarea Contesto Assistente + badge `studio-v1` | HITL — **no auto-save** |
| Prefisso audit | Setup studio | HITL |
| Score % incompleto/parziale/pronto | `scoreStudioContext` zero-LLM | Automatico (calcolo), contenuto HITL |
| Aggregati «Tutto lo studio» in Assistente | `loadStudioAggregates` | Automatico |
| Iniezione note in chat | `aiOrganizationContext.service` | Automatico **se** note salvate |
| Email/Drive → arricchimento | CTX-4 | Mancante · HITL Alto |

### Azienda (cliente / Ambito)

| Elemento | Meccanismo | Automatico / HITL / Mancante |
|----------|------------|------------------------------|
| Identità + indirizzo | Anagrafica `companies` + badge `company-v1` | HITL — salva solo su «Salva anagrafica» |
| Fatti NC/qual/scadenze/SAL | `ambitoFacts.service` | Automatico (SQL live) |
| Enrich «Cerca nel registro» | CTX-3 proposte citate (URL) | Semi-auto: propone · HITL conferma campo-per-campo |
| Profilo in chat (nome/P.IVA/settore/indirizzo) | `loadCompanyProfile` in `aiChat` | Automatico **se** campi presenti |
| JSON contesto strutturato oltre anagrafica | citato «fuori slice» CTX | Nebbia / non fatto |
| OAuth inbox/Drive | CTX-4 | Mancante · HITL Alto |

**Cosa non c’è:** job che riscrive il contesto da sole; auto-salvataggio; write AI su NC/WPS/SAL; memoria decisioni “oltre” i moduli DB; card fatti in Home (nebbia PLAN).

---

## Autoapprendimento e robustezza (punto di forza / limiti)

### Punti di forza

- **Stessa fonte di verità** card ↔ prompt (evita “la card dice 3, la chat inventa 7”).
- **Zero LLM sui fatti** → costi bassi, numeri verificabili, meno allucinazioni su conteggi.
- **Multi-tenant difensivo:** scope org + company; in vista studio niente chunk testo cliente misti (`studioSafeOverview`).
- **HITL esplicito** su contesto e su azioni (nav sì, write no) — allineato ADR-010 (“suggerimenti, decisione umana”).
- **Separazione livelli AIOS** (Contesto / Dati / Automazioni / Controllo) già mappata nel PLAN e in buona parte implementata.

### Limiti (onesti)

- **Non è autoapprendimento agenti:** non aggiorna un modello né un embedding “Second Brain” dalle conversazioni. Compilare/aggiornare contesto = lavoro Studio.
- Rubriche CTX **sottili** (pochi campi; azienda = anagrafica base). Nessuno stile few-shot per-studio (nebbia).
- Qualità chat resta dipendente da RAG/indicizzazione, Compliance Map, norme disponibili — Second Brain **non** sostituisce NormBroker/Libreria.
- Feedback `ai_feedback` (ultime 5 `rephrased`) è un micro-loop stile org — **adiacente**, non manutenzione Ambito.
- SB-5 non chiude un “agente operativo”: solo scorciatoie UI.
- Scalabilità: ogni chat ricalcola SQL + allunga il prompt; quota/caching blocco fatti = nebbia (non fatto).

**Verdetto operativo:** strategia **efficace per robustezza e isolamento**; **efficiente** sui costi fatti (zero LLM); **parziale** come “cervello che impara da solo”. Per aspettative cliente tipo “più lo usi, meglio risponde da solo” → oggi serve **manutenzione HITL del contesto** + dati moduli puliti; il salto successivo pianificato è CTX-4 (fonte privata), non un training automatico.

---

## Confronto best practice (brevi)

| Best practice agentica | In ProgettoISO oggi | Gap |
|------------------------|---------------------|-----|
| Fatti operativi fuori dal prompt lungo (Engram-like) | Sì: snapshot SQL + blocco compatto | Caching/quota ancora nebbia |
| Contesto tenant/versionato | Rubriche `studio-v1` / `company-v1` | JSON ricco / stile few-shot = no |
| Isolamento cross-tenant / cross-cliente | Forte su fatti + RAG studio-safe | CTX-4 alzerà il rischio OAuth |
| HITL su azioni irreversibili | Nav sì; write AI vietata | Corretto per ISO; non “full agent” |
| Memoria episodica chat → knowledge | Non in Second Brain | Voluto: chat non scrive moduli senza HITL |
| KB unificata prodotto | DB + Registri + Libreria + RAG | No Obsidian/wiki in-app (scelta esplicita) |

---

## Priorità consigliate

Allineate a roadmap § Priorità aperte ORA + PLAN § nebbia / fuori scope. Non inventare slice nuove oltre il piano.

| Priorità | Perché | Rischio | Dipendenza HITL? |
|----------|--------|---------|------------------|
| **1. Chiudere HITL CTX-4** (provider, scope, token, retention, conferma campo-per-campo) | Unica slice SB ancora APERTA; #1 in roadmap; arricchisce Studio/Azienda da fonti private | Alto (OAuth, segreti, cross-tenant) | **Sì — blocca codice** |
| **2. Disciplina operativa: score «pronto» Studio + aziende critiche** | Oggi il valore chat dipende da note/anagrafica compilate; codice wizard già CHIUSO | Basso (processo) | Sì (lavoro Studio, non engineering) |
| **3. Tenere SB-5 come nav-only** (non “agente che scrive”) | Robusto per ISO/audit trail; evita write autonome non richieste | Medio se si forzasse write AI | Eventuale HITL prodotto se si volesse write assistita |
| **4. Nebbia solo dopo CTX-4 stabile:** quota/cache fatti; few-shot stile studio; card Home; meeting | Utile ma non specificato — aprire troppo presto confonde | Medio–Alto (privacy meeting) | Sì su meeting/retention |
| **5. Non mescolare** Compliance Map / SAL gap / ingest learning dentro Second Brain | Confini già in PLAN e lezione GUIDA; riduce doppi cervelli | Basso se rispettati | No |

---

## Cosa NON è Second Brain (confini)

Da `PROJECT_CONTEXT.md` § Harness + PLAN «Fuori scope» + lezione GUIDA 06/09:

| Cosa | Ruolo | Relazione con Second Brain |
|------|-------|----------------------------|
| **Engram (principio)** | Fatti operativi fuori dal prompt lungo | **Già coperto** da `ambitoFacts` SQL — non serve un secondo store file |
| **KB / Libreria / Registro / RAG indexer** | Conoscenza documentale e normativa in **DB** | Complementare: Second Brain = fatti live Ambito, non il corpus norme |
| **Obsidian / LLM Wiki** | Metodo di lavoro umano o esterno | **Non** architettura in-app; vietato installare skill wiki sul repo |
| **Harness Cursor (ADR-015)** | Sviluppo (Lead/Deputy, brief, diet token) | Separato dal cervello **prodotto** (ADR-010) |
| **Compliance Map** | Grafo requisito↔fonte versionato + HITL | Modulo distinto; non fondere NC live nella mappa |
| **Ingest learning / `ai_feedback`** | Few-shot extract / preferenze stile chat | Adiacenti all’AI runtime, **non** manutenzione Second Brain Studio/Azienda |
| **Cartella Claude / SQLite locale / `/prime` GUIDA** | Fuori scope esplicito | Non obiettivo prodotto |

---

## Nebbia dichiarata (non aprire ora)

Dal PLAN § «Non ancora specificato»:

- Verbali meeting cliente (consenso/retention)
- Card fatti in Home
- Memoria decisioni oltre moduli DB
- Stile few-shot per-studio
- Quota/caching blocco fatti
- Estensione gap SAL/WPQR dentro i fatti
- Connettori email/Drive + retention (oltre il solo DoD CTX-4)

---

## Verifica fonti (checklist)

| Fonte | Usata |
|-------|-------|
| `git pull origin main` → `3980ff25` | sì |
| `PROJECT_CONTEXT.md` bussola Second Brain + Engram/KB | sì |
| Roadmap limit 45 + priorità CTX-4 | sì |
| `PLAN_SECOND_BRAIN_SLICES.md` stati SB/CTX | sì |
| ADR-010 (runtime, HITL, no vault) | sì |
| `aiChat.controller.js` / `ambitoFacts` / `AiAssistantPage` / `AmbitoFactsBar` | sì |
| Rubriche `aiContextRubrics` + Studio/Company wizards | sì |

# Audit prodotto + priorità AI — consolidato 26/08/2026

| Campo | Valore |
|-------|--------|
| **Data** | 2026-08-26 (recupero in repo 27/08/2026) |
| **Tipo** | Relazioni di sessione (non gap-analysis normativa formale) |
| **Origine** | Tre run Cloud Agent solo in chat — **non** erano file in Git |
| **Run chat** | [Chiusura sessione + gap review](https://cursor.com/agents/bc-618f1525-b0d4-5a91-bd10-afc7065ce177) · [Priorità gap affidabilità AI](https://cursor.com/agents/bc-dc5102b2-dfb0-5abe-b459-d237b59c6a26) · [Audit valutazione progetto](https://cursor.com/agents/bc-02586de9-1ea0-578b-acda-c1501babd7ce) |
| **Path stabile** | questo file |

> **Nota post-recupero (27/08):** su `main` è già mergiato il Quaderno 2 Linea Guida EN 1090 (`Quaderni/Quaderno_2_Linea_Guida_1090.{md,json}`, #593). Le sezioni sotto che lo citavano come «vuoto / da_richiedere» restano storiche del 26/08 sera.

---

## Ordine di priorità (sintesi operativa)

1. **HITL** sull’estratto [`docs/reference/ISO-14555-2025-range-validita-WPQR.md`](../reference/ISO-14555-2025-range-validita-WPQR.md) (azione umana: OK / correzioni).
2. Solo dopo OK HITL → brief **STUD-3-B** (range in codice + processi 4063 stud). **Non** aprire STUD-3-B senza OK esplicito.
3. **Parallelizzabile** (solo se servono citazioni Assistente / soglie MC): checklist tenant su persistenza locale; seed VPS batch norme **solo su richiesta**; estratti soglie 2560/17632/14174 prima di Rule Engine.

**Non fare ora:** seed VPS senza richiesta; STUD-3-B senza HITL; inventare soglie da MD non revisionati.

---

## 1 — Chiusura sessione + gap review vs inizio

### A — Sessione chiusa?

**Sì** — la sessione di **sviluppo codice** del 26/08 è chiusa.

- **Chiuso su `main`**: ciclo CND base (CND-1…9 + W, tenant bozze #588); STUD-1/2/3-A; ISO 14555 digitalizzata; batch norme `NORMA_00034`–`00042`; mock NDT eligibility (#586). Tutti i `DEPUTYTASK*` su `origin/main` erano **CHIUSI**; **zero PR aperte** a fine sessione.
- **Residuo**: HITL sull’estratto 14555 → poi STUD-3-B; seed VPS batch norme (solo su richiesta); UT verbale (serve modello Mason); CND-10 firma (parcheggio).
- Quindi: **codice sì chiuso**; i lavori HITL / seed / modello UT sono **fuori** da quella sessione.

### B — Gap vs inizio (confronto onesto)

**Prima** (gap STUD + backlog norme, pre-digitalizzazioni di quel giorno): ISO 14555 **assente**; norme CND/apporto/19011 in backlog come da richiedere; WPQR stud solo come gap funzionale; CND operatore ancora a metà ciclo.

**Ora è `digitalizzata` (MD+JSON in repo, non = conformità né seed DB):**

| Norma | File |
|---|---|
| ISO 14555:2025 | `NORMA_00033` + estratto range STUD-3-A |
| ISO 9712:2021 | `NORMA_00034` |
| ISO 2560 / 17632 / 14174 | `NORMA_00035`–`00037` |
| ISO 19011:2026 | `NORMA_00038` |
| ISO 3452-1 / 17638 / 23278 / 23277 | `NORMA_00039`–`00042` |

**Gap reale che resta:**

- Range 14555 **non in codice** (STUD-3-B dopo OK umano sull’estratto).
- Seed VPS del batch **non fatto**.
- Gap-analysis formale CND vs MD nuove (3452/17638/23277/23278) **non rifatta**.
- Quaderno 1090 — *storico 26/08: vuoto*; **aggiornato 27/08: digitalizzato** (#593).
- UT verbale: manca modello Mason; CND-10 firma resta parcheggiata.
- Soglie apporto 3.1 (2560/17632/14174) ancora da estrarre — non inventare.

**Attenzione:** digitalizzare ≠ conformità automatica ≠ seed nel database clienti.

### C — Refactoring DB / analisi pre-ingest

**Refactoring DB ora?** **No, non urgente.** Le migrazioni **158** (t1/t2) e **159** (STUD) sono additive e già in PROD. Un eventuale seed `norm_requirements` per le nuove NORMA è **additivo**, non un refactor dello schema.

**Report da rivedere** (stantii rispetto alle MD di oggi), in ordine — una slice / wayfinder alla volta:

1. `GAP_WPQR_STUD_…` — aggiornare dopo HITL 14555 (prima di STUD-3-B).
2. `NORME_MANCANTI_BACKLOG` — già aggiornato a `digitalizzata`; tenere d’occhio seed e gap OCR.
3. `MATERIAL-COMPLIANCE-NORME-SINTESI` — MD apporto presenti; mancano **estratti soglie**.
4. Gap CND vs 3452/17638/23277/23278 — **dopo** lettura MD (skill gap-analysis), non in questa chat.

**Prossime 2–3 slice consigliate:**

1. **HITL estratto 14555** → se OK, brief **STUD-3-B** (range + processi 4063 stud).
2. **Seed VPS** batch norme — solo se lo chiedi esplicitamente.
3. **Gap-analysis CND** vs le quattro norme PT/MT appena digitalizzate **oppure** bozza verbale **UT** (quando arriva il modello Word).

---

## 2 — Priorità gap per affidabilità AI

Verifica mirata: le risposte live dell’Assistente leggono il DB (`norm_requirements` via NormBroker), non i Markdown in Git; il batch `00033`–`00042` non è nemmeno nell’import seed.

### Come funzionano le fonti (in una riga)

- **Assistente / SAL / citazioni clausola**: testo da **DB VPS** (`norm_requirements`). Se manca → messaggio «norma assente», senza inventare il testo.
- **Gap analysis (skill/agenti)**: legge **Markdown** in `docs/Normative/` (+ Quaderni / estratti `docs/reference/`).
- **Range WPQR/patentini**: estratti in `docs/reference/` → regole JS (non il seed SGQ).

L’import seed oggi copre solo **9001 / 14001 / 45001 / 3834-1…-5**, non il batch appena digitalizzato.

### Priorità per affidabilità delle risposte (ordinate)

1. **HITL sull’estratto ISO 14555 (range WPQR stud)**  
   Senza revisione umana, il passo successivo (codice range) rischia di **inventare o sbagliare numeri** nelle risposte/calcoli su prigionieri. Il PDF digitalizzato in Git non basta: serve il via libera sull’estratto.

2. **Non seedare / non codificare soglie da 2560, 17632, 14174 finché non ci sono estratti revisionali**  
   I Markdown sono in repo, ma le soglie operative **non** sono ancora estratte. Qualsiasi Rule Engine o risposta “numerica” su apporto materiale senza estratto = rischio allucinazione.

3. **Se l’Assistente deve *citare* le nuove norme (9712, 19011, PT/MT…)**: pipeline **import → seed VPS → smoke citazioni**  
   Oggi quei testi sono in Git ma **non vivi** nelle risposte (non sono in `import-norms`, seed batch non fatto). Finché restano fuori dal DB, il chat onesto dice “assente”; il rischio è il modello che risponde “a memoria” sulle domande libere senza clausola.

4. **Rifare gap-analysis CND vs Markdown nuovi**  
   Migliora la **verità dei report** e le decisioni di prodotto; non alimenta da sola le citazioni live dell’Assistente.

5. **Può aspettare** (per affidabilità risposte): modello UT, feature CND-10/firma — non cambiano il testo normativo che l’AI cita oggi. (*Quaderno 1090: ora digitalizzato #593 — resta fuori dal seed Assistente finché non entra in DB.*)

### Distinzione chiara

| | Cosa |
|---|---|
| **(a) In Git ma non ancora «vivo» nelle risposte** | `NORMA_00033`–`00042` MD/JSON; estratto 14555; estratto storico 9712. Assistente/NormBroker **non** li leggono finché non entrano in seed/DB (e per molte non è previsto l’import SGQ a clausole). Gap-skill sì, se rilanciata. |
| **(b) Rischio ancora di inventare soglie** | Range **14555** se si scrive codice prima dell’HITL; soglie **2560 / 17632 / 14174** (e simili) senza estratto; domande libere su norme non in DB senza blocco «assente». |
| **(c) Può aspettare** | UT verbale, gap CND “completa”, seed del batch *prima* di decidere se devono davvero entrare in `norm_requirements`. |

### Un prossimo passo concreto

**HITL sull’estratto [`ISO-14555-2025-range-validita-WPQR.md`](../reference/ISO-14555-2025-range-validita-WPQR.md)** (OK / correzioni), poi solo dopo STUD-3-B.

**Perché:** è il punto in cui l’affidabilità delle risposte/calcoli su WPQR stud passa da “testo in archivio” a “numeri usati dal prodotto”. Il seed VPS del batch, da solo, **non** migliora le citazioni Assistente (quelle norme non sono nell’import); la gap CND migliora i report, non il runtime.

---

## 3 — Valutazione da audit del progetto

### Verdetto in 2 frasi

Il progetto è una **base di produzione solida**, già usata ogni giorno su moduli critici (audit, NC, qualifiche, saldatura, CND, documenti), con governance di sviluppo matura. Resta però un sistema in cui **la conformità “assistita da AI” è ancora più fragile della conformità operativa manuale**: molte norme sono appena digitalizzate, non tutte sono in seed/motore, e diversi pezzi dipendono da HITL umano prima di poter essere considerati affidabili.

### Cosa funziona bene

- **Moduli maturi in campo**: Audit multi-standard, NC (ISO 10.2), Qualifiche, WPQR/WPS/Welding Book/Commesse 3834, SAL, Documenti/Scadenzari, Riesame, RBAC multi-tenant, obblighi legali, CND VT/MT/PT con Word e offline — uso quotidiano Camellini/Mason.
- **Workflow Lead/Deputy**: brief, slice, test L1, PR, gate CI + Bugbot + Security Review; parallelismo disciplinato; lezioni scritte (non solo “memoria di chat”).
- **Digitalizzazione norme accelerata**: batch recenti (14555, 3834-2/-4 2021, 9712, 19011, NDT, fili/flussi, ecc.) + backlog e gate “non inventare”.
- **Multi-tenant e offline-first**: architettura consapevole (`organization_id`, sync server-wins, PWA); fix recente bozze CND con scope tenant.
- **Qualità di processo**: migrazioni tracciate, smoke percorsi critici, ADR, gap-report, piani epic — rarità per un prodotto PMI.

### Rischi / non conformità «da auditor»

| Rischio | Perché conta |
|--------|----------------|
| **Isolamento tenant offline** | Lezione bozze CND: senza `organization_id` locale si rischia leak tra organizzazioni. Fix fatto (#588); il pattern va **generalizzato** a ogni bozza/localStorage/IndexedDB, non solo CND. |
| **Digitalizzato ≠ seed ≠ risposta AI affidabile** | MD/JSON in repo non implica regole in produzione né risposte Assistente/gap corrette. STUD-3-B (range 14555) è correttamente bloccato su HITL — segnale sano, ma finché non c’è OK umano il pezzo non è “conforme prodotto”. |
| **Gap-analysis formale vs nuove MD** | Nuove norme digitalizzate; non risulta rifatta in automatico una gap-analysis modulo-per-modulo su tutto il batch. Inventario fonti sì; chiusura del loop “fonte → codice → test normativo” ancora parziale. |
| **HITL aperti** | Estratto 14555 → STUD-3-B; CND UT (modello verbale); residui CND firma/foto offline. |
| **Dipendenza merge umano / Cloud Agent** | Per design Cursor l’agente non mergia: throughput e rischio “PR ferma” restano sul committente. Non è un bug di sicurezza; è un collo di bottiglia operativo. |
| **Logout vs bozze solo locali** | ADR-007 ancora proposto: logout pulisce store locale → lavoro non sincronizzato a rischio. |
| **Provisioning studio** | Creazione primo admin di un nuovo studio cross-tenant ancora bloccata (Alto rischio auth) — frena onboarding SaaS. |
| **Norme MD in Git vs vigore** | Job validità copre il registro documenti tenant, non necessariamente i Markdown di knowledge in repo → rischio risposte su edizione ritirata se non c’è controllo periodico. |

Niente di inventato: tutto emerge da roadmap § Stato attuale, gap fedeltà normativa 25/08, ADR-010/015 e backlog aperto.

### Voto per area

| Area | Giudizio | Nota |
|------|----------|------|
| Funzionalità operative | **Solido** | Ampio perimetro in produzione reale; CND base chiuso; saldatura/NC/qualifiche mature. |
| Affidabilità normativa AI | **Da rafforzare** | Architettura e HITL giusti; fonti in crescita; seed/motori/gap non ancora allineati al ritmo di digitalizzazione. |
| Sicurezza / multi-tenant | **Adeguato** | RBAC e JWT solidi; incidente bozze CND corretto; restano superfici offline e logout da irrigidire. |
| Qualità processo sviluppo | **Solido** | Lead/Deputy, CI, review bot, slice, ADR — sopra la media tipica di un gestionale PMI. |
| Documentazione / governance | **Solido** | Roadmap “fonte unica”, bussola moduli, gap-report, piani epic; densità alta ma navigabile se si rispetta la dieta di contesto. |
| Debito tecnico | **Adeguato** | Debito gestito (modal CSS, PR #10 organizzazione da ricostruire, MC incompleto) più che “caos”; attenzione a non accumulare eccezioni offline/tenant. |

### Azioni correttive prioritarie (max 5)

1. **Checklist isolamento tenant su ogni persistenza locale** (localStorage / IndexedDB / coda offline): audit mirato + stesso pattern del fix CND, partendo dai flussi critici (audit, NC, ingest).
2. **Chiudere il loop fonti → HITL → seed/codice** sulle norme appena digitalizzate: prima 14555 (STUD-3-B dopo OK), poi gap-analysis formali sui moduli toccati (WPQR, CND/9712, MC apporto), senza dichiarare “conforme AI” solo perché c’è un MD.
3. **Residui CND ad alto impatto operativo**: modello UT (HITL) e, in coda, firma / foto offline — chiudono il ciclo “incarico → campo → verbale”.
4. **Gate logout / bozze non sync** (ADR-007): avviso o sync forzato prima di cancellare lo store locale — riduce perdita dati e rischio multi-tenant percepito dall’utente.
5. **Controllo vigore Markdown KB** (anche solo alert periodico al superadmin): riduce risposte su testi obsoleti. (*Quaderno 1090: digitalizzato #593.*)

**In sintesi da auditor di prodotto:** giudicherei il sistema **idoneo all’uso operativo quotidiano** sui moduli maturi, con **riserva esplicita** sull’uso di AI/gap come prova di conformità normativa finché HITL e seed non chiudono il circuito. Il processo di sviluppo è un punto di forza; il rischio principale non è “mancano feature”, ma **confondere digitalizzazione e maturità normativa del motore**.

---

## Riferimenti correlati (già in repo)

| Documento | Path |
|-----------|------|
| Estratto HITL 14555 | [`docs/reference/ISO-14555-2025-range-validita-WPQR.md`](../reference/ISO-14555-2025-range-validita-WPQR.md) |
| Gap STUD WPQR | [`GAP_WPQR_STUD_WELDING_PIASTRA_TUBO_2026-08-25.md`](GAP_WPQR_STUD_WELDING_PIASTRA_TUBO_2026-08-25.md) |
| Gap fedeltà normativa | [`GAP_NORM_FIDELITY_STRATEGICA_2026-08-25.md`](GAP_NORM_FIDELITY_STRATEGICA_2026-08-25.md) |
| Stream STUD | [`docs/agent-tasks/DEPUTYTASK_WPQR_STUD.md`](../agent-tasks/DEPUTYTASK_WPQR_STUD.md) |
| Roadmap § Stato attuale | [`docs/PROJECT_ROADMAP.md`](../PROJECT_ROADMAP.md) |

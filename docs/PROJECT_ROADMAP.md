# Roadmap — Sistema Gestione ISO 9001 / SaaS Multi-Tenant

> **Data Inizio**: 13 gennaio 2026

## Stato attuale e priorità (fonte unica)

> Leggere questa sezione **prima** di tutto il resto del file.

> **Risposta standard a «stato di avanzamento del progetto e priorità da affrontare»**: sintetizzare da questa sezione (moduli maturi + sessione più recente + tabella priorità sotto), **non** dal banner storico più sotto (superato, tenuto solo per traccia) né dall'archivio marzo 2026 [`docs/archive/PROJECT_CONTEXT_STATO_FUNZIONALITA_2026-03.md`](archive/PROJECT_CONTEXT_STATO_FUNZIONALITA_2026-03.md). **Aggiornare questa sezione a fine sessione** se emergono nuove priorità o se una priorità elencata viene chiusa (stesso principio delle "Lezioni apprese" in [GUIDA_CONSOLIDATA.md](GUIDA_CONSOLIDATA.md) — sintesi qui, dettaglio linkato).

**Ultimo aggiornamento di questa sezione**: 26/08/2026 (STUD-1 WPQR stud/P+T; CI re-run sera; ciclo CND base già chiuso).

### Moduli maturi (in produzione, uso quotidiano dai clienti Camellini/Mason)

Audit multi-standard (9001/14001/45001) · Non Conformità (workflow ISO 10.2 completo) · Qualifiche Personale saldatori/NDT/coordinatori (ISO 9606-1/14732/14731/9712) · Saldatura (WPQR con range duali t1/t2 FW, tipologia SW/prigioniero + P+T + doppio materiale, generazione WPS, 15614-1/15614-2, Welding Book, Commesse ISO 3834, Dashboard 3834) · SAL (gap analysis requisiti con AI) · Registro Documenti + Scadenzari · Notifiche/Alert (documenti/NC/qualifiche) · Riesame di Direzione · RBAC multi-tenant (`company_access`) · Registro obblighi legali (ambiente + sicurezza) · Assistente AI / Gap Analysis euristica · CND verbali (VT/MT/PT, gate 9712, Word, Registro, offline).

### Sessione più recente (26/08/2026)

**WPQR STUD-1 (26/08)** — stream [`DEPUTYTASK_WPQR_STUD.md`](agent-tasks/DEPUTYTASK_WPQR_STUD.md) **CHIUSO — TEST OK**: tipologia `SW`, `qualifying_element`, diametro prigioniero (riuso `diameter_*`), Parent Metal 2, `product_type` `P+T`, mig. **159** in PROD. Nessun range ISO 14555 (HITL PDF resta per STUD-3).

**CND operatore — ciclo base chiuso** — CND-1…CND-4, CND-5a, CND-6…CND-9, CND-W su `main`. Slot [`DEPUTYTASK.md`](agent-tasks/DEPUTYTASK.md) / [`DEPUTYTASK1.md`](agent-tasks/DEPUTYTASK1.md) **CHIUSI**. Residuo CND: UT verbale (HITL modello), firma CND-10, foto offline.

**CND-8 bozza come audit (26/08, mergiata #582)** — Nuovo verbale → UUID subito (`seedNdtLocalDraft`); offline via coda CND-9.

**CND-5a ruoli strumento (26/08, mergiata #581)** — giogo / sonda / kit PT in Equipment (`ndtInstrumentRoles.js`).

**CND-9 / CND-W / CND-7 / CND-6** — già su `main` (#578/#579, #577, #574, #575). Deploy VPS: gate 9712 + posa Registro se non ancora fatti.

**NG-3 skill gap-analysis (25/08, mergiata #560)** — percorso «manca MD → backlog → HITL» + mapping.

**WPQR t1/t2 + ISO 15614-2 (25/08, mergiata #558; reprocess #563; polish #566/#567)** — Mason: doppi range spessore FW e norma alluminio. Migrazione **158** in PROD. Backlog: Tabella 4 gruppi Al; STUD-2/3 dopo PDF 14555.

**NG-0+NG-1 fedeltà normativa (25/08)** — gate slice norm-touching, template richiesta PDF, backlog [`NORME_MANCANTI_BACKLOG.md`](reference/NORME_MANCANTI_BACKLOG.md), inventario skill aggiornato. **3834-2/-4:2021** già in repo + seed VPS.

### Sessione precedente (25/08/2026)

**Fedeltà normativa — mappa + digitalizzazione 3834-2/-4 (25/08, #554)** — wayfinder + ingest PDF 2021 + seed VPS. Piano [`PLAN_NORM_FIDELITY_SLICES.md`](agent-tasks/PLAN_NORM_FIDELITY_SLICES.md).

### Sessione precedente (23/08/2026)

**CND — mappa operatore in campo (23/08, wayfinder)** — il modulo verbali/strumenti/9712 **c’è**; manca il ciclo incarico → esecuzione in tasca → Word + NC. Piano [`PLAN_CND_SLICES.md`](agent-tasks/PLAN_CND_SLICES.md). CND-1 (marche VT a scheda) **CHIUSO** sullo slot `DEPUTYTASK.md` (poi riusato per NG-0).

### Sessione precedente (22/08/2026)

**IA-17 timeout ingest dalla cartella (22/08, mergiata #536)** — `POST /documents/norms/ingest-from-folder` e upload batch: client 15 min (`NORM_BATCH_REQUEST_TIMEOUT_MS`), `req`/`res.setTimeout` Node 15 min, nginx `proxy_read_timeout`/`proxy_send_timeout` **900s**. Default GET 10–15s invariato. Brief [`DEPUTYTASK1.md`](agent-tasks/DEPUTYTASK1.md) **CHIUSO**. [PR #536](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/536) (`d1a177d1`).

**IA-16 throttle Gemini ingest cartella (22/08, mergiata #534)** — 429 TPM / rate / resource exhausted è transitorio: retry + backoff, **non** spegne la chiave. `markKeyExhausted` solo 403 o quota giornaliera/billing. Pausa tra PDF in cartella + batch embed. Brief [`DEPUTYTASK.md`](agent-tasks/DEPUTYTASK.md) **CHIUSO**. [PR #534](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/534) (`1e418118`).

**IA-15 duplicati e edizioni ingest norme (22/08, mergiata #532)** — stessa cartella 2.3 / stessa azienda: `UNI EN` ≡ `EN` (`normFamilyKey`); stesso anno → `duplicate`; edizione più nuova → vigente, precedenti `superata`; più vecchia → `pending_review` + warning, non due vigente. Brief precedente **CHIUSO**. [PR #532](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/532) (`8ebea510` / `45496a22`). Residuo: gap RBAC `uploadNorms` (non ingest-from-folder).

**IA-12 ingest famiglia da cartella (21/08, mergiata)** — in **Documenti → Albero → NORME E LEGGI**, pulsante **Ingest dalla cartella**: gira `normIngest` sui PDF già in registry, senza riselezionarli dal PC. Non in Modifica. Brief precedente **CHIUSO** [#524](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/524) / [#525](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/525).

**IA-11 posa norme in NORME E LEGGI (21/08, mergiata #523 + deploy)** — dopo Screening, se il file è `norma` (o hint job) e l’azienda ha già la cartella **2.3**, il documento va in quella cartella (`parent_id`). Senza albero: coda «Cartella mancante». Non è l’ingest (Carica norme); non init albero in create. [PR #523](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/523).

**Import: un solo controllo azienda (21/08, mergiata #521)** — niente tendina «Azienda cliente» sul job. Ambito header è la `company_id` di create/upload/piano. Tutto lo studio / Patrimonio: pulsanti visibili ma `disabled`. Upload su job esistente solo se Ambito === `job.company_id`. Brief precedente CHIUSO.

**IA-5b coda «da completare» (21/08, mergiata #519 + deploy)** — dopo un carico grosso i file incompleti (tipo incerto, cartella assente, campi vuoti, bozza AI) hanno una lista con badge in **Documenti**, stesso modello Inbox/Qualifiche. Click sul badge → Catalogo filtrato (`?incomplete=1`). Da Import, dopo Screening: «Apri coda da completare». Screening non è un cancello. [PR #519](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/519).

**Piano cartella ancorato alla company (21/08, mergiata #518)** — `company_id` catturato al picker, non riletto dal job selezionato al confirm. [PR #518](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/518).

**Import richiede azienda (21/08, mergiata #514 + deploy)** — upload e screening bloccati senza azienda cliente. Ambito **«Tutto lo studio»** / **Patrimonio** non sblocca. Pulsanti restano visibili (`disabled` + title). BE: 400 `COMPANY_REQUIRED_FOR_UPLOAD`. **Annulla caricamento** = elimina job + file (non purge registro). Deploy PROD PID `1134642`→`1149359`, health 200. FE Netlify da `main`. Brief [`DEPUTYTASK.md`](agent-tasks/DEPUTYTASK.md) **CHIUSO**. [PR #514](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/514). Prossima: **IA-5b** coda da completare.

**Ingest cartella tutti i tipi + screening a campioni (20/08, mergiata #511 + deploy)** — «Carica cartella» prende Word/Excel/disegni/PDF (max 80). Estrae testo da PDF/Word/Excel; screening **30→90→200 righe** (tetto 8 000). Disegni/foto: solo nome/cartella. Deploy PROD PID `1108923`→`1134259`, health 200. Brief [`DEPUTYTASK.md`](agent-tasks/DEPUTYTASK.md) **CHIUSO**. [PR #511](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/511). Bugbot/Security Review **non** comparsi sulla revisione; merge umano. Prossima: **IA-5b** coda da completare.

**Ingest archivio IA-1–IA-5 (20/08, mergiata)** — Import PDF posa i tipi nello scaffale azienda; tipo `capitolato` → 2.2; **Carica cartella** (path in `original_name`, max 80); **Screening e posa** (path+nome+testo; auto-posa solo se tipo chiaro + azienda; qualifiche no). Piano: [`PLAN_INGEST_ARCHIVIO_SLICES.md`](agent-tasks/PLAN_INGEST_ARCHIVIO_SLICES.md). [PR #506](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/506) · [#507](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/507) · [#509](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/509).

**Superadmin duplica template Word (20/08, mergiata + deploy)** — «Solo admin/auditor possono duplicare template» anche da superadmin: `authorize()` lo lasciava passare, il controller riboccava. Stesso buco su carica/elimina. Deploy PROD PID `1095643`→`1096030`, health 200. Smoke: duplicate id inesistente → 404, non 403. [PR #503](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/503).

**Template Word sul VPS (20/08, mergiata)** — archivio unico sul server: `GET /report-templates/:id/file`. Export, Duplica e download in Gestione → Template report non leggono più Netlify `/templates/`. Fallback locale solo offline. Backend già deployato (PID `1095643`, health 200). [PR #501](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/501).

**Chiusura audit — checklist spenta in 1.1 (20/08, mergiata)** — AUD-260819-01 segnalava 38% perché restava in IndexedDB il template **Audit di Sistema Saldatura** (`RDP_MSN`) attivato e poi spento, mai compilato. La chiusura conta solo le norme ancora spuntate; all’apertura si rimuove il leftover vuoto. [PR #500](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/500). Dopo Netlify: Ctrl+Shift+R e riaprire l’audit.

**Conclusioni AI editabili (20/08, mergiata)** — nel modal Assistente AI — Conclusioni il testo proposto è un campo modificabile; **Accetta** salva la versione corretta (HITL). [PR #498](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/498). Solo frontend, nessun deploy VPS.

**FW-0 mergiato (20/08)** — dopo il commit di una norma PDF le tavole vanno in `knowledge_figures` (stesso tenant). Errore CLIP non blocca la norma. WPQR **non** collegato. Brief [`DEPUTYTASK_FIGURE_WPQR.md`](agent-tasks/DEPUTYTASK_FIGURE_WPQR.md) **CHIUSO**. [PR #494](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/494). Piano: [`PLAN_FIGURE_WPQR_SLICES.md`](agent-tasks/PLAN_FIGURE_WPQR_SLICES.md). Smoke TEST era rosso per nginx (unattended-upgrade 06:32), non per il codice: `proxy_pass` con slash finale.

**FW-0 riscritto (20/08, docs)** — bisogno reale: tavole delle **norme PDF** in Assistente, non slot WPQR. Epic visiva→WPQR **parcheggiata**. MR-5 già mergiato [#492](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/492).

### Sessione precedente (19/08/2026)

**Multimodal RAG MR-5 mergiato (20/08)** — VLM locale commenta il ritaglio e cita le tavole. `POST /ai/figures/search-by-image` → `{ figures, reply }`; Ollama giù → `reply: null`. [PR #492](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/492).

**Multimodal RAG MR-4 mergiato + deploy (19/08, sera)** — query visiva: ritaglio PNG/JPEG/WebP → stesso spazio CLIP → top-k tavole. `POST /ai/figures/search-by-image`, org dal JWT; lista vuota senza 500. Bottone ritaglio nel composer Assistente. Brief [`DEPUTYTASK5.md`](agent-tasks/DEPUTYTASK5.md) **CHIUSO**. [PR #489](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/489). Mig. **154** già su TEST e PROD. Deploy PROD PID `1031291`→`1048322`, health 200. Piano: [`PLAN_MULTIMODAL_RAG_SLICES.md`](agent-tasks/PLAN_MULTIMODAL_RAG_SLICES.md).

**MC-I3 DDT ≠ 3.1 (19/08, TEST OK)** — [#488](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/488). Estrai su bolla `D.D.T._n._000775RE` classifica `delivery_note`, n. DDT in colonna, mill azzerato (SET, non solo COALESCE). Valuta 409 `NOT_A_CERTIFICATE`; pulsante visibile disabled. Brief [`DEPUTYTASK_MC_INGEST.md`](agent-tasks/DEPUTYTASK_MC_INGEST.md) **CHIUSO**. Prossima ingest: **MC-I4**. ISO-4 **non** toccata.

**ISO-4 architettura RDP (19/08, pomeriggio)** — Mason chiama «RDP» il **verbale di visita**, non il laboratorio. Menu **Saldatura → RDP** spento (route `/saldatura/rdp` resta, tabelle `rdp_*` non droppate). Word della check list 27/01 = export dal modulo **Audit ISO 3834-2** (id 6). Standard Audit id 7 resta (3 audit aperti): solo etichette UI senza «RDP». Scala voto 1–6 = slice successiva (oggi l'app usa C/NC/OSS). File Mason in [`docs/reference/mason-rdp/`](reference/mason-rdp/). Analisi: [`GAP_RDP_DUE_DOCUMENTI_MASON_2026-08-19.md`](gap-reports/GAP_RDP_DUE_DOCUMENTI_MASON_2026-08-19.md). [PR #486](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/486).

**MC-I2 3.1 colata / DDT / norma (19/08, mergiata + deploy)** — [#481](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/481). Alias AI → `heat_or_lot_no`; DDT ≠ A07. Deploy TEST PID `993561`→`1019412`, PROD `1005497`→`1031291`, health 200. Smoke PROD azienda 179 id 6 (`CERTIFICATO31-…-TECNOVESPA-12174.PDF`) → Estrai HTTP 200, `extracted`, colata **`12174/2026`**.

**Multimodal RAG MR-3 mergiato (19/08)** — ingest figure da PDF già sul disco: extract locale (MR-0) + persist CLIP (MR-1). `POST /ai/figures/ingest`, org dal JWT; PDF senza tavole → lista vuota. Brief [`DEPUTYTASK5.md`](agent-tasks/DEPUTYTASK5.md) **CHIUSO**. [PR #484](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/484). Piano: [`PLAN_MULTIMODAL_RAG_SLICES.md`](agent-tasks/PLAN_MULTIMODAL_RAG_SLICES.md).

**Audit — Ambito filtra gli audit (19/08, mergiata)** — via il secondo select Azienda; le azioni restano visibili. [PR #482](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/482).

**Multimodal RAG MR-2 mergiato (19/08)** — citazioni tavola nello stesso pannello Assistente (crop + pagina + bbox). GET `/ai/figures/:id/image`, org dal JWT. Brief [`DEPUTYTASK5.md`](agent-tasks/DEPUTYTASK5.md) **CHIUSO**. [PR #475](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/475). Piano: [`PLAN_MULTIMODAL_RAG_SLICES.md`](agent-tasks/PLAN_MULTIMODAL_RAG_SLICES.md). Serve deploy backend per il GET immagine.

**MC-B OCR scan (19/08, mergiata + deploy)** — [#476](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/476). Estrattore tagga `ocr_ok`; `ocr_skipped` solo formato non PDF. Deploy TEST PID `981527`→`993561`, PROD `967465`→`1005497`, health 200. Smoke PROD azienda 179 id 7 → Estrai HTTP 200, `extracted`, `ocr_ok`, 4397 caratteri.

**ISO-7 — ponte RDP/NDT ↔ commessa (19/08, mergiata)** — `project_id` opzionale su verbali RDP e NDT (mig. **155**). Picker Commessa visibile, `disabled` senza azienda. Testo libero invariato. Helper `resolveOptionalProjectId`. Brief [`DEPUTYTASK1.md`](agent-tasks/DEPUTYTASK1.md) **CHIUSO**. [PR #474](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/474). Migrazione 155 su TEST (hub ISO-7) e **su PROD** (19/08, insieme al deploy backend MC-B: il manifest includeva già il codice ISO-7).

**MC-I1 ruolo upload (19/08)** — in Materiali si sceglie **Base** o **Apporto** prima di Carica (default Base). Distinto dai filtri KPI. Brief [`DEPUTYTASK_MC_INGEST.md`](agent-tasks/DEPUTYTASK_MC_INGEST.md) **CHIUSO**. [PR #473](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/473).

### Sessione precedente (18/08/2026)

**SAL S1a OCR PDF TEST OK (18/08)** — `documentTextExtractor` tenta `ocrExtractor` se lo strato testo è vuoto o sotto soglia ingest; `ocr_unavailable` / `ocr_failed` senza throw. Brief [`DEPUTYTASK.md`](agent-tasks/DEPUTYTASK.md) **CHIUSO**. [PR #471](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/471). Prossima evidenze SAL: **S1b** (OCR immagini). Piano: [`PLAN_SAL_AI_EVIDENCE_SLICES.md`](agent-tasks/PLAN_SAL_AI_EVIDENCE_SLICES.md).

**Multimodal RAG MR-1 TEST OK (18/08)** — persist `knowledge_figures` (mig. **154**, 153 già usata da ISO-6) + adapter CLIP locale (mock L1) + GET `/api/v1/ai/figures/search?q=` isolato per `organization_id`. Brief [`DEPUTYTASK5.md`](agent-tasks/DEPUTYTASK5.md) **CHIUSO**. [PR #469](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/469). **MR-2 non aperta**. Migrazione VPS dopo merge (SCP + `run-migration-154-vps.js`). Piano: [`PLAN_MULTIMODAL_RAG_SLICES.md`](agent-tasks/PLAN_MULTIMODAL_RAG_SLICES.md).

**ISO-6 — ponte NC ↔ commessa (18/08)** — `non_conformities.project_id` opzionale (mig. **153**). Picker Commessa in creazione e drawer, stesso pattern Welding Book. **Non** obbligatorio. PR [#465](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/465). Ingest MC e SAL **non** toccati.

**MC-I0 Valuta 409 (18/08, mergiata)** — [#463](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/463). Deploy TEST PID `967399`, PROD PID `967465`, health 200. Smoke PROD azienda 179: certificato id 4 `extracted` → `pending_review` HTTP 200 (non 409). Prossima ingest: **MC-I1** (ruolo upload). SAL S1a e ISO-4 **non** toccati.

**Multimodal RAG MR-0 mergiato (18/08)** — [PR #464](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/464): `pdf-to-json --extract-figures` (raster + cluster vettoriali, PNG + bbox, locale).

**Router Materiali (18/08, pomeriggio)** — click su un certificato apriva **SAL** perché `/sal` è prefisso di `/saldatura`. Fix: confine di segmento + prefisso più lungo in `RouterContext` ([PR #461](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/461)).

**Rischi — filtri KPI + viste (18/08)** — tab Analisi: banner cliccabili = filtro stato (niente tendina); **Valutazioni** vs **Storico riesami**. PR [#459](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/459) mergiata. **Non** è ROO-18.

**Prossima rischi (HITL prodotto, non questa sessione):** **ROO-10** — fattori §4.1, parti §4.2 e obiettivi §6.2 in una slice dedicata, **scambio di informazioni** con la matrice (oggi solo picker one-way ROO-8). Dettaglio: [PLAN § decisioni](agent-tasks/PLAN_RISCHI_OPPORTUNITA_OBIETTIVI_SLICES.md).

**ROO-17 lista riesami ambito (17/08)** — `GET /risks/reviews?company_id&from&to` su TEST e PROD. PR [#455](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/455).

**MC-5 UI mergiata (18/08)** — [PR #457](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/457): `MaterialCertificatesPage`. Parallelismo MC, non rischi.

### Sessione precedente (17/08/2026)

**MC-4 API mergiata (18/08)** — [PR #456](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/456): `/api/v1/material-certificates`. `compliant` solo HITL. Prossima: **MC-5** UI.

**MC-4 API (17/08)** — `materialCertificates.controller.js`: lista/dettaglio/upload, extract (ingest) e evaluate (motore MC-3 persistito in `pending_review`). `compliant` solo da HITL approve. Prossima: **MC-5** UI.

**MC-3 Rule Engine (17/08)** — `materialComplianceRuleEngine.service.js`: JSON certificato + snapshot KB → `status` + `checks[]`. Zero LLM; non scrive `compliant`. Mergiata [PR #454](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/454).

**ROO-17 lista riesami ambito (17/08)** — `GET /risks/reviews?company_id&from&to`. PR [#455](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/455). Filtri KPI e viste: sessione 18/08 / PR #459.

**EN 10219-1:2006 consegnata (17/08)** — NORMA_00028 + estratto [`EN-10219-1-sezioni-cave.md`](reference/EN-10219-1-sezioni-cave.md). Hollow **a freddo** seedabile se il certificato cita 10219.

**EN 10210-1:2006 consegnata (17/08)** — NORMA_00027 + estratto [`EN-10210-1-sezioni-cave.md`](reference/EN-10210-1-sezioni-cave.md). Hollow **a caldo** seedabile se il certificato cita 10210.

**MC-2 mergiata (17/08)** — [PR #451](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/451): seed EN 10025-2 + loader snapshot/hash.

**MC-1 mergiata (17/08)** — [PR #450](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/450): tabelle `material_certificates` + `material_certificate_checks` (mig. **149**) su TEST e PROD.

**ISO-3 mergiata + deploy (16/08)** — [PR #448](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/448): chiavi EN 10204/10168 + apporto nel prompt capitolato; persistenza mig. 116. VPS health 200.

**MC-0 mergiata (16/08)** — [PR #447](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/447): spec DATA_MODEL/UI/API, `material_role` base\|filler.

**EN 10025-2:2019 consegnata (16/08)** — NORMA_00026 + estratto soglie S235–S500 in [`EN-10025-2-acciai-strutturali.md`](reference/EN-10025-2-acciai-strutturali.md). Sblocca il seed MC-2 per lamiere/profili. Tubi: EN 10210-1 **e** EN 10219-1 presenti (17/08). Soglie apporto (2560/17632/14174) **mancanti** → skip, non fail. Inventario: [`MATERIAL-COMPLIANCE-NORME-SINTESI.md`](reference/MATERIAL-COMPLIANCE-NORME-SINTESI.md).

**Norme certificati 3.1 consegnate (16/08)** — EN 10204, EN 10168, ISO 10474/404/6929 + facsimile MTC → Markdown in `docs/Normative/` + estratti in [`MATERIAL-COMPLIANCE-NORME-SINTESI.md`](reference/MATERIAL-COMPLIANCE-NORME-SINTESI.md). Sblocca dizionario campi MC e chiavi capitolato ISO-3.

**ISO-2 — Riesame §5.3 data/utente + Word** ([PR #443](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/443) **mergiata**): timbro nel JSON, niente blocco apertura, Word checklist. Prossima: ISO-3 (AI capitolato, prompt + chiavi 10204). Brief [`DEPUTYTASK1.md`](agent-tasks/DEPUTYTASK1.md) **CHIUSO**.

**ISO-1* mergiata** (RDP #438, NDT #439, Attrezzature #441, Welding Book #442).

**Lead wayfinder — ISO 3834 HITL 16/08** (solo doc, mergiata [PR #437](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/437)): §5.3 senza blocco; Word RDP Mason; livelli 2/3/4 = meno schermate dopo, partenza senza filtri; certificati = griglia DDT+anagrafica. Conformità = norma + documenti esterni pertinenti all’Ambito (ADR-021).

**Second Brain SB-1** (16/08): snapshot fatti Ambito (NC / qualifiche / documenti, zero LLM) in Assistente AI. Brief [`DEPUTYTASK2.md`](agent-tasks/DEPUTYTASK2.md) **CHIUSO**. Prossima: SB-2. Non sovrascrivere [`DEPUTYTASK.md`](agent-tasks/DEPUTYTASK.md) (SAL S1a).

**In parallelo — SAL AI evidenze**: mappa [`PLAN_SAL_AI_EVIDENCE_SLICES.md`](agent-tasks/PLAN_SAL_AI_EVIDENCE_SLICES.md). Brief [`DEPUTYTASK.md`](agent-tasks/DEPUTYTASK.md) **APERTO** su slice **S1a**. Non sovrascrivere.

**PR [#436](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/436) mergiata + promote PROD (17/08)** — ROO-16 storico riga; ROO-8/15/6b-S; mig **151/152** + catch-up **146/147/148**. **ROO-17** (questa sessione): lista riesami ambito. Prossima **ROO-18** solo dopo HITL. Non toccato [`DEPUTYTASK.md`](agent-tasks/DEPUTYTASK.md) (SAL S1a).

**Chiusura precedente (stesso giorno)** — Patrimonio studio distinto dai clienti ([PR #428](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/428) **mergiata**, verificato dal committente su Camellini). Ingest Excel rischi ROO-6/6c ([PR #429](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/429) **mergiata**): mapping colonne + residuo P/G a coppia.

**Profilo azienda S6** ([PR #426](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/426) **mergiata**, doc [PR #427](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/427) **mergiata**, deploy VPS 15/08): pulsante «Cerca nel registro» in anagrafica. P.IVA → 1 risultato (IT-advanced, verificato TECNOVE). Nome → `IT-search` (max 8); oggi 402 finché in console OpenAPI non è attivo Company Search / credito. S0–S6 codice chiuso.

**Rischi / Opportunità / Obiettivi**: ingest M03 + SWOT + storico riga (ROO-16) + lista riesami (ROO-17) + filtri KPI (#459). Prossima slice dedicata **ROO-10** (4.1/4.2/§6.2 si parlano con la matrice). ROO-18 solo HITL ingest. [PLAN](agent-tasks/PLAN_RISCHI_OPPORTUNITA_OBIETTIVI_SLICES.md).

**Banner Ambito** ([PR #414](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/414) **mergiata**): solo «Ambito» + menu. **Patrimonio dello studio** ([PR #417](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/417) **mergiata**). **Combobox** ([PR #419](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/419) **mergiata**). **Patrimonio = sempre `studio`** ([PR #428](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/428) **mergiata** 15/08/2026): su Camellini non usa più l'id «QS Studio» (48); albero STD distinto dai clienti. **Verificato dal committente** in produzione. Dettaglio: [GUIDA lezione Patrimonio ≠ omonima](GUIDA_CONSOLIDATA.md#lezioni-apprese-consolidate-fonte-unica).

**Harness Cloud**: Chromium di Playwright nello snapshot `cloud-install.sh`. **Kitesurf** non adottato. Dettaglio: [GUIDA lezione Playwright snapshot](GUIDA_CONSOLIDATA.md#lezioni-apprese-consolidate-fonte-unica).

Sessione prodotto precedente (13/08/2026):

**Regressione chiusa** ([PR #408](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/408) mergiata): dopo Ambito unico il pulsante **Carica qualifiche (batch)** spariva su «Tutto lo studio» (era montato solo con azienda selezionata). I pulsanti batch restano visibili, disabilitati se manca l'azienda; l'azienda salvata sulla vecchia chiave Qualifiche viene migrata nella chiave globale. Stesso trattamento WPQR/WPS. Dettaglio: [GUIDA lezione Azioni gated](GUIDA_CONSOLIDATA.md#lezioni-apprese-consolidate-fonte-unica).

Ambito azienda **unico** in alto mergiato ([PR #401](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/401)): `CompanyScopeSelect` nell'header, vale su tutta l'app finché l'utente non lo cambia. I selettori di pagina sono **eliminati** (non spostati); le **azioni** di pagina si conservano. Default: admin/personale studio → Tutto lo studio; utente di un'azienda → quella azienda, non modificabile.

Attivati **Bugbot** e **PR Routing & Approval** (Cursor Automations) sul repo — revisione automatica su ogni PR + approvazione automatica su rischio Basso, mai su backend/migrazioni/normativa AI. Non è un cambio prodotto — riguarda solo il workflow agente. Dettaglio: [GUIDA lezione PR Routing & Approval](GUIDA_CONSOLIDATA.md#lezioni-apprese-consolidate-fonte-unica) · [guida setup](how-to/SETUP_PR_ROUTING_APPROVAL.md).

Harness (stesso giorno): handoff se la slice non chiude ([`HANDOFF_TEMPLATE.md`](agent-tasks/HANDOFF_TEMPLATE.md)); gate 5 domande prima di codice nuovo (Ponytail in `sgq-operating-memory.mdc`); smoke UI percorsi critici (`smoke-percorsi-critici.mjs`); una sessione = una slice. Dieta avvio: bussola in `PROJECT_CONTEXT.md` + roadmap **solo** § Stato.

Sessione prodotto precedente (10/08/2026): fix filtri dashboard duplicati (Qualifiche PR #368, Scadenzari #371, NC #374, Saldatura DEPUTYTASK4) + bug `daysUntilDue` / alert email (PR #369).

### Priorità aperte ORA (ordine indicativo, non rigido — verificare col committente prima di iniziare una sessione dedicata)

| # | Priorità | Perché | Dove riprendere |
|---|---|---|---|
| 1 | **Modulo Notifiche/Alert — destinatario allerte qualifiche non è una scelta esplicita in anagrafica** | Oggi risolto da un algoritmo a cascata, non da una scelta visibile in UI | `qualificationAlert.service.js` (`resolveWeldingCoordinatorRecipients`) |
| 2 | **Shell dialog di revisione ingest — markup/CSS duplicato** (non urgente, basso rischio) | `IngestReviewDialog.jsx` vs dialog interno `ReprocessQueueBanner.jsx`: guscio overlay duplicato (~60-80 righe); pattern sistemico su molti altri modal nel progetto | Vedi backlog sotto per dettaglio |
| 3 | **Pagina Impostazioni → Organizzazione (P.IVA + logo tenant)** | PR #10 aperta da aprile 2026, 180 file in conflitto — richiede ricostruzione, non merge | Vedi riga dedicata nel backlog sotto |
| 4 | **Material Compliance AI — ingest certificati (base e apporto)** | MC-0…MC-5 + MC-I0 + MC-I1 + MC-B (#476) + MC-I2 (#481) + **MC-I3** (DDT ≠ mill). Prossima: **MC-I4** busta 1→N | [PLAN](agent-tasks/PLAN_MATERIAL_COMPLIANCE_SLICES.md) · brief [MC-I3 CHIUSO](agent-tasks/DEPUTYTASK_MC_INGEST.md) |
| 5 | **Rischi — ingest / data riesame (ROO-18, HITL)** | Lista riesami ambito c’è (ROO-17, verificata su TEST); data riesame esplicita e ingest→review solo dopo conferma | [PLAN §7](agent-tasks/PLAN_RISCHI_OPPORTUNITA_OBIETTIVI_SLICES.md) |
| 6 | **SAL AI evidenze — OCR + documento mancante (HITL)** | **S1a** mergiata (#471): OCR PDF in `documentTextExtractor`. Prossima: **S1b** OCR immagini | [PLAN](agent-tasks/PLAN_SAL_AI_EVIDENCE_SLICES.md) · brief [S1a CHIUSO](agent-tasks/DEPUTYTASK.md) |
| 7 | **ISO 3834 — completezza per processi (RBAC + ponti + report)** | ISO-1*…ISO-3 + ISO-6/7 mergiate. Menu `/saldatura/rdp` spento. Prossima: **ISO-4** Word visita Mason **da Audit ISO 3834-2** (id 6), layout check list 27/01. Scala 1–6 = ISO-4b (HITL). ISO-5 Word Welding Book indipendente | [PLAN](agent-tasks/PLAN_3834_SLICES.md) · [gap 19/08](gap-reports/GAP_RDP_DUE_DOCUMENTI_MASON_2026-08-19.md) · PR [architettura #486](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/486) |
| 8 | **Second Brain — Assistente di Ambito (SB-1 fatti, zero LLM)** | Studio + clienti paganti: fatti dell'Ambito in app, non AIOS Claude. Chat dopo i numeri veri | [PLAN](agent-tasks/PLAN_SECOND_BRAIN_SLICES.md) · brief [SB-1](agent-tasks/DEPUTYTASK2.md) |
| 9 | **Multimodal RAG — figure normative in locale** | MR-0…**MR-5** mergiati (#464/#469/#475/#484/#489/#492). Prossima: **FW-0** hook ingest norma PDF → CLIP (brief PRONTO, non APERTO) | [PLAN figure](agent-tasks/PLAN_FIGURE_WPQR_SLICES.md) · [PLAN MR](agent-tasks/PLAN_MULTIMODAL_RAG_SLICES.md) |

> Nota: **Modulo NC — card statistiche duplicate da due tendine** (era riga 1) è stato chiuso da PR #374 (10/08/2026) — riga rimossa da questa tabella, non ancora aggiornata al momento in cui è stata scritta DEPUTYTASK4.

Elenco completo (voci meno urgenti, decisioni di prodotto in attesa, task parcheggiati con motivo): tabella [Backlog parcheggiato](#backlog-parcheggiato-task-futuri--fonte-unica) più sotto.

---

<details>
<summary>Banner storico pre-10/08/2026 (superato — non usarlo per "a che punto siamo", tenuto solo come traccia cronologica)</summary>

> **Ultimo Aggiornamento**: 16 giugno 2026
> **Prossimo Step**: ADR-009 completato (Fasi 1-4, 22/07/2026); Fase 5 superata da decisione 07/06/2026 (PR #52). Vedi sezione "VISION VINCOLANTE" più sotto per lo stato aggiornato e il prossimo passo.
> **Backlog**: 🔴 ADR-009 Fase 2-5 (multi-standard/document_type/AI-ready) | ✅ **Modulo NC completo** — Fase 1 + Hardening H1–H6 + drawer ISO 10.2 + RichTextField; **attesa feedback utenti** 30/05/2026 ([GUIDA](GUIDA_CONSOLIDATA.md#modulo-nc-organizzativo--fase-1--hardening--ux-drawer-route-nc-30052026), [PROMPT_RIPRESA_NC](agent-tasks/PROMPT_RIPRESA_NC.md), [MANUALE_UTENTE_NC](how-to/MANUALE_UTENTE_NC.md)) | P2 NC: AI CAPA, export PDF, LIBRERIA_UI Fase B/C | ✅ **REG-NORM-SOT R1–R7** — registro documentale SoT norme/leggi, ADR-011, deploy VPS (25/05/2026; [GUIDA](GUIDA_CONSOLIDATA.md#sessione-25052026--registro-norme-sot-r1r7-completato-e-chiusura-pr)) | ✅ **PR #60/#62** merge template Word audit + fix seed legislativo | ✅ **Fix JSX Unicode Rischi / Qualifiche / Progetti** — escape `\u` solo in espressioni stringa JS (`RisksPage`, `QualificationForm`, `ProjectsPage`; playbook in [GUIDA_CONSOLIDATA.md](GUIDA_CONSOLIDATA.md), 22/05/2026) | ✅ **Playbook encoding / caratteri non riconoscibili** — [GUIDA_CONSOLIDATA.md](GUIDA_CONSOLIDATA.md) + script `backend/scripts/check-utf8-encoding.js` (16/05/2026) | ✅ **ADR-009 Fase 1** — PendingIssuesCascade UI/UX + badge standard + navigazione accordion (12/05/2026) | ✅ Fix pending-issues filtro NC/OSS/NV + CHECK constraint DB (12/05/2026) | ✅ Fix NC statistics alias SQL riservati (12/05/2026) | ✅ Fix pending-issues lazy-init nc_id post-MERGE (12/05/2026) | ✅ Fix validazione guided close collapse button (09-10/05/2026) | ✅ Fix CORS nginx fallback backend down (08/05/2026) | ✅ Fix licenze admin/superadmin bypass requireLicensedModule (08/05/2026) | ✅ Fix Exception 1 campi testo si svuotano (08/05/2026) | ✅ Fix Exception 4 multi-standard (08/05/2026) | ✅ Fix race rendering checklist multi-device (PR #39, 08/05/2026) | ✅ GAP-B1/B2/B3 custom checklist (PR #37, 08/05/2026) | Tabella "Rilievi Emersi" Word: aggiungere C e N.A. (da decidere con cliente) | norm_excerpt ISO 9001 (standard_id=1, backlog) | ✅ SYNC-5 allegati offline | ✅ migration 048-049-050 applicate
> **Decisione prossima traccia documenti (aprile 2026)**: dopo chiusura smoke **0–3**, scegliere **una** traccia prioritaria — **Sprint 10** (ingest → staging → registry) se il valore commerciale immediato è il registro documenti; **`norm_excerpt`** (colonna + Word) se serve un miglioramento rapido sui report senza attendere lo staging completo. Le due tracce possono convivere solo se il product owner definisce ordine e capacità; altrimenti evitare doppio carico in parallelo sulla stessa sessione.

</details>

> **Riferimenti**: [GUIDA_CONSOLIDATA.md](GUIDA_CONSOLIDATA.md) (esperienza operativa) | [adr/ADR-009](adr/ADR-009-multi-standard-architettura-per-norma.md) | [adr/ADR-008](adr/ADR-008-event-sourcing-sync.md) | [adr/ADR-006](adr/ADR-006-auto-reconcile-cache-sync.md) | [DATABASE_SCHEMA.md](reference/DATABASE_SCHEMA.md) (schema DB)

---

## Open points e memoria trasversale (non perdere il filo)

**Regola**: gli argomenti “aperti” che attraversano più sessioni vanno elencati **qui** (sintesi) e dettagliati nell’**ADR** o nel doc tecnico indicato. Le session AI devono leggere questa sezione + l’ADR collegato. I **task futuri parcheggiati** (non prioritari) hanno una sezione dedicata: [Backlog parcheggiato](#backlog-parcheggiato-task-futuri--fonte-unica).

| Tema | Sintesi | Tracciamento |
|------|---------|----------------|
| **Logout vs lavoro solo locale** | Oggi: pulizia IndexedDB + sync queue al logout (`sgq:userLoggedOut`) per sicurezza multi-tenant → bozze non ancora sul server **a rischio** se l’utente esce senza sync. Serve gate + export / sync forzato (vedi ADR). | [ADR-007-logout-offline-backup-e-mirror-cartella-pc.md](adr/ADR-007-logout-offline-backup-e-mirror-cartella-pc.md) (**Proposto**) |
| **Mirror / cartella PC (backup bundle audit)** | Non attivo nel flusso principale (IndexedDB only, `storageAdapter.js`). Opzionale desktop in ADR Fase B. | Stesso **ADR-007** |
| **Menu audit vs RBAC** | **Frontend:** merge IndexedDB + `filterLocalAuditsAfterServerFetch`, logout svuota cache; remount menu (`AuditSelector`). **Backend (richiede deploy VPS):** `GET /audits` e dettaglio filtrano con `studioScopeClause` (`auditListRbac.service.js`); ruolo JWT normalizzato in `auth.middleware.js`; ruoli non previsti → vincolo `created_by` (mai lista org-wide implicita); `organization_id` sempre da `req.user` in `listAudits` / `getAuditById`. Test Jest: `auditListRbac.service.test.js`. | `StorageContext.jsx`, `AuditSelector.jsx`, `backend/src/services/auditListRbac.service.js`, `backend/src/middleware/auth.middleware.js`, `backend/src/controllers/audit.controller.js`; [ARCHITETTURA_UTENTI_RBAC.md](ARCHITETTURA_UTENTI_RBAC.md) |
| **Disconnessione temporanea (non logout)** | Comportamento atteso: IndexedDB + coda; vedi doc dedicata. | [GESTIONE_PERDITA_CONNESSIONE.md](GESTIONE_PERDITA_CONNESSIONE.md) |
| **Riorganizzazione documentazione (Fase 3)** | Fase 1–2 **fatte** (21/05/2026, PR #58 + struttura how-to/reference/specs). Backlog doc: ADR suffissi, archive agent-tasks, opz. `explanation/`, snellire GUIDA. **Priorità inferiore** ad ADR-009 Fase 2. | [INDICE_DOCUMENTAZIONE.md](INDICE_DOCUMENTAZIONE.md#fase-3--piano-operativo-prossima-sessione-doc) |
| **Tooling Cursor / MCP / Node** | ✅ Completato 30/05/2026 — estensioni, GitHub MCP (43 tools), Playwright MCP (23 tools), `.editorconfig`, script sync PAT. **Prossimo**: fix 2 test `importNormCommit` + smoke circuito Registro Norme. | [GUIDA_CONSOLIDATA.md](GUIDA_CONSOLIDATA.md#sessione-30052026--tooling-cursor--mcp--node--vitest-chiusura-sessione) |
| **Modulo NC — feedback campo** | Sviluppo pianificato **chiuso** 30/05/2026. Monitorare: email 08:05, push custom da audit reale, UX drawer (Camellini). Bug → nuova chat + [PROMPT_RIPRESA_NC](agent-tasks/PROMPT_RIPRESA_NC.md). | [GUIDA — chiusura NC](GUIDA_CONSOLIDATA.md#sessione-30052026--modulo-nc-chiusura-sessione--attesa-feedback-utenti) |
| **NC — rubrica dual-level Studio/Azienda** | **Epic Personale azienda** approvata 02/06/2026. **S1 ✅** — schema e regole in [ADR-012](adr/ADR-012-company-personnel-anagrafica.md) (`company_personnel` + bridge `notification_contacts`). **Prossimo:** S2 migration 078 → S3 API → S4–S5 UI ([TASK_PERSONALE_AZIENDA_SLICES.md](agent-tasks/TASK_PERSONALE_AZIENDA_SLICES.md)). Non rimuovere «referente esterno» su verifica/azioni finché S8 non è live. | [ADR-012](adr/ADR-012-company-personnel-anagrafica.md); [ARCHITETTURA_UTENTI_RBAC.md](ARCHITETTURA_UTENTI_RBAC.md) |
| **Hardening harness doppio (HK-1…HK-10)** | Audit giugno 2026: allineare governance Cursor (ADR-015), alleggerire GUIDA, collare AI runtime (NormBroker v1, licenze, audit trail, gap analysis MVP). Piano: [PLAN_HARNESS_HARDENING_SLICES.md](agent-tasks/PLAN_HARNESS_HARDENING_SLICES.md) (verificare se `DEPUTYTASK.md` linkato lì è ancora quello giusto — il file è stato riusato per altri brief da allora). **Continuazione 13/08/2026** (non numerata HK, stesso filone): dieta avvio + bussola moduli, handoff sessione interrotta, gate Ponytail, smoke percorsi critici — [lezione GUIDA](GUIDA_CONSOLIDATA.md#lezioni-apprese-consolidate-fonte-unica). | `.cursor/rules/`, ADR-010/015, `normBroker.service.js`, `gapAnalysis.service.js`, `check-harness-boot.js` |
| **Controparti azienda (PR1 ✅ · PR2 ✅)** | Tab **Controparti** in scheda azienda; `company_counterparties` (mig. **096**); backfill + `projects.end_customer_id` (mig. **097**); API nested; select committente in Riesame Requisiti con sync FK↔snapshot (`ContractReviewPage`, PR #230/#233). | Mig. 096–097; `companyCounterparties.controller.js`; `commercialCustomerCounterparty.service.js`; `CompanyCounterpartiesPanel.jsx`; `ContractReviewPage.jsx` |
| **"Ambito" azienda — selettore unico in header (13/08/2026, UI ✅ PR #401)** | FE: un solo `CompanyScopeSelect` in `AppLayout`; le liste filtrano da `CompanyScopeContext`. Resta backlog **RBAC backend**: `equipment.controller.js` / RDP / NDT non usano ancora `companyAccess.service.js` (equipment filtra su `user.company_id` inesistente). Qualifiche resta l'unico modulo con `company_id` NOT NULL a DB. | `appCompanyScope.js` · [GUIDA lezione Ambito unico](GUIDA_CONSOLIDATA.md#lezioni-apprese-consolidate-fonte-unica) · [ARCHITETTURA_UTENTI_RBAC.md §8.3](ARCHITETTURA_UTENTI_RBAC.md#83-cosa-manca-o-è-parziale-gap-noti) |
| **Pivot WPS — generazione da WPQR (non ingest)** | Feedback Mason 30/07/2026: matcher 15614 + bozza 15609 + Word Annex A. **P0–P5 ✅** (P5: advisory WPQR + visione nel riesame, non bloccante). | [MODULO_WPS_GENERAZIONE_SCOPO_E_ROADMAP.md](specs/MODULO_WPS_GENERAZIONE_SCOPO_E_ROADMAP.md) |
| **Material Compliance AI (certificati EN 10204, base e apporto)** | Modulo proposto 05/08/2026: PDF → estrazione AI → Rule Engine → HITL. **MC-0 mergiata 16/08** ([PR #447](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/447)). **Prossimo:** MC-1 migration. Soglie lamiere EN 10025-2 in Markdown; tubi e soglie apporto ancora da consegnare (skip). | [sintesi](reference/MATERIAL-COMPLIANCE-NORME-SINTESI.md) · [MODULO](specs/MODULO_MATERIAL_COMPLIANCE_AI.md) · [PLAN](agent-tasks/PLAN_MATERIAL_COMPLIANCE_SLICES.md) · ADR-020…024 |
| **Rischi, Opportunità e Obiettivi (processo M03)** | Draft studio M03-R00. **ROO-17** lista riesami ambito. Prossima: ROO-18 solo HITL. Cataloghi 4.1/4.2 restano opzionali. Non parallelizzare su `RisksPage.jsx`. | [PLAN](agent-tasks/PLAN_RISCHI_OPPORTUNITA_OBIETTIVI_SLICES.md) · [spec M03](specs/M03_ANALISI_RISCHI_OPPORTUNITA.md) · [DEPUTYTASK_RISCHI_ROO.md](agent-tasks/DEPUTYTASK_RISCHI_ROO.md) |
| **SAL AI evidenze (OCR + doc mancante)** | Estendere lettura evidenze (OCR PDF/immagini riusando `ocrExtractor`) e flusso HITL «tipo tipico → candidati registro → collega/carica/ignora». Prima slice: **S1a**. | [PLAN](agent-tasks/PLAN_SAL_AI_EVIDENCE_SLICES.md) · [DEPUTYTASK.md](agent-tasks/DEPUTYTASK.md) |
| **ISO 3834 completo/affidabile (processi §5–18)** | Vista per processo. HITL 16/08 chiusi. ISO-1*+ISO-2 mergiate; ISO-3 = prompt certificati base/apporto. | [PLAN](agent-tasks/PLAN_3834_SLICES.md) · [DEPUTYTASK1.md](agent-tasks/DEPUTYTASK1.md) · [gap 15/08](gap-reports/GAP_RDP_3834_2026-08-15.md) |

---

## Backlog parcheggiato (task futuri — fonte unica)

> Elenco **unico** dei task non prioritari, parcheggiati con motivo e condizione di ripresa. Quando un task riprende, spostarlo nella sequenza priorità attiva sotto. Le lezioni operative collegate stanno in [GUIDA_CONSOLIDATA.md § Lezioni apprese](GUIDA_CONSOLIDATA.md#lezioni-apprese-consolidate-fonte-unica).

| Task | Origine | Perché parcheggiato | Condizione di ripresa |
|------|---------|---------------------|-----------------------|
| **Verifica mensile vigore Markdown norme in Git (giorno 1) — scadenziario superadmin** | HITL 16/08/2026, dopo digitalizzazione EN 10204/10168 | `pdf_to_json` **non** interroga UNI/ISO: estrae solo testo. Il job esistente (`normValidityChecker`, lunedì 03:00) copre il **registro documenti dei tenant**, non `docs/Normative/*.md` né `knowledge/`. Rischio: agente ISO-3/MC su edizione ritirata | Non urgente. Slice: (1) lookup UNI in conversione (frontmatter vigore); (2) cron `0 6 1 * *` su elenco Markdown KB; (3) alert in dashboard superadmin (`BillingDashboardPage`), **non** in Scadenzari da file. Riusare `uniStoreConnector` / `normCatalogLookup`. Nessun download automatico del testo UNI (ToS). |
| **Pagina Impostazioni → Organizzazione (P.IVA + logo tenant)** | [PR #10](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/10) (resta **aperta**) | **Aggiornamento 08/08/2026**: verificato stato reale su GitHub — `mergeable: CONFLICTING`, **180 file coinvolti nel confronto** con `main` (branch fermo da aprile 2026, 4 mesi di deriva). Non è più un semplice rebase: la funzionalità (P.IVA/logo tenant) non risulta ancora implementata altrove, ma il codice della PR va **ricostruito su base aggiornata**, non aggiornato. Il committente aprirà una sessione dedicata (nuova chat, eventualmente recuperando la chat originale che l'ha prodotta) invece di procedere in coda a questa | Sessione dedicata: NON tentare "Update branch"/merge diretto (rischio alto con 180 file in conflitto). Verificare prima se la funzionalità serve ancora così com'è; se sì, ripartire da `main` corrente e reimplementare il form (`OrganizationProfileForm`), non risolvere i conflitti a mano. Poi chiudere questa PR o sostituirla |
| **Caricamento verbale di audit con revisione = numeratore audit** | Chiusura [PR #52](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/52) (07/06/2026) | Il report Word deve restare **modificabile** e caricato **manualmente** (no automatismo audit-close → registry) | Tipo doc «Verbale di audit» (cartella 12 AUDIT); al caricamento `revision = audit.audit_number` read-only; valutare allargare `document_registry.revision` (NVARCHAR > 20); salvare `audit_id`/`audit_number` in `type_specific_data`. Dettaglio in [DEPUTYTASK.md](agent-tasks/DEPUTYTASK.md) |
| **T6 — Recovery UI + history API + compaction notturna** | Sprint sync T (ADR-008) | Dipende da T5 stabile | Compliance ISO 9001 §7.5; vedi [GUIDA § ADR-008](GUIDA_CONSOLIDATA.md#architettura-target-sync--event-sourced-adr-008) |
| **Sicurezza link allegati Word — token download monouso** | Discussione 08/03/2026 | Bassa priorità; core stabilizzato prima | Sostituire JWT nei link Word con token a scadenza 48h (vedi *Fase 0.B* sotto) |
| **Riorganizzazione doc Fase 3c–3f** | [INDICE_DOCUMENTAZIONE.md](INDICE_DOCUMENTAZIONE.md#fase-3--piano-operativo-prossima-sessione-doc) | Priorità inferiore allo sviluppo prodotto | Cartella `explanation/` opzionale, snellimento GUIDA, README root repo |
| **Modulo §9.1 Monitoraggio, misurazione, analisi e valutazione (KPI/indicatori)** | Backlog Riesame di Direzione 23/06/2026 ([GUIDA § Stato AI riesame](GUIDA_CONSOLIDATA.md)) | Modulo §9.1 non ancora strutturato; nessuna tabella KPI/indicatori dedicata (oggi §9.1 è solo clausola coperta e tag su sotto-funzioni statistiche) | Prerequisito per: **integrazione KPI nel Riesame di Direzione (Slice 4)** e dashboard prestazioni cross-modulo. Stato: **da pianificare** — definire entità indicatori/target/misurazioni periodiche e aggregazione multi-tenant prima di sbloccare la Slice 4 |
| **Range di qualificazione automatico WPQR/patentino (Tabelle 7 Level 1 / parti GAP)** | Gap analysis ingest 26/07/2026 ([GUIDA](GUIDA_CONSOLIDATA.md#lezioni-apprese-consolidate-fonte-unica)) | Tabella 8/9 e Tabella 7 Level 2 (bande 3–40 mm) già codificate; **Tabella 5 acciai** ✅ P0 (PR #326). Restano GAP: Tabella 7 Level 1 (cifra iniziale), Tabella 6 nichel | P1 espone API/UI; Level 1 solo dopo verifica su PDF ufficiale; ingest continua a preferire range **dichiarati** sul documento |
| **Normalizzazione attiva pre-commit (filler ISO 14341 / gas ISO 14175) — oggi solo warning** | Gap analysis ingest 26/07/2026 (risposta Domanda 2) | `ingestPlausibilityChecks.js` (26/07/2026) segnala pattern/codice non riconosciuto solo come **warning**, non normalizza né blocca; normalizzare in automatico (es. `normalizeShieldingGasCode`) rischierebbe di sovrascrivere un valore corretto ma scritto in formato non previsto dal normalizzatore | Solo se emergono falsi negativi ricorrenti in produzione (dato reale, non ipotetico) — priorità P2, richiede raccolta di alcuni casi reali prima di decidere la soglia di confidenza per l'auto-correzione |
| **Pannello statistiche apprendimento ingest (superadmin)** | Richiesta committente 27/07/2026, a valle verifica ADR-017/`ingestFeedback.service.js` (`getLearningStats` già pronta, non esposta in UI) | Bassa priorità — nessun difetto da correggere, solo visibilità: quante correzioni raccolte per tipo documento (`import_extraction_feedback`) e quanti pattern condivisi anonimi (`ingest_reference_patterns`) | Solo lato **superadmin**; UI minima (tabella/contatori per doc_type + organizzazione), riusa `getLearningStats` già esistente — nessuna nuova migrazione prevista |
| ✅ **Meccanismo "Rielaborazioni disponibili" esteso alla WPQR** — **Chiuso 08/08/2026** | Richiesta esplicita committente, dopo verifica gap ([GUIDA § 08/08/2026](GUIDA_CONSOLIDATA.md#lezioni-apprese-consolidate-fonte-unica)) | Generalizzato il registro (prima solo `qualifications`) a `wpqr_records` — migrazione **143**, `reprocessTableAdapters.js`, 6 nuovi campi rielaborabili (`preheat_temp`, `interpass_temp`, `throat_test_mm`, `product_type`, `rotated_position`, `thickness_max_unlimited`). Deploy in produzione + smoke OK | — |
| **Primo admin di un nuovo studio creato da UI — cross-tenant bloccato** | DEPUTYTASK1 (10/08/2026), Slice S3 — provisioning nuovo studio | Verificato con test Vitest reale: il selettore "Studio (auditor org)" del form "Nuovo utente" filtra su `ao.organization_id === user.organization_id`, e `admin.controller.js::createUser` forza `organization_id = req.user.organization_id` + valida `auditor_org_id` sulla stessa org — un superadmin non può quindi mai assegnare il primo utente a uno studio appena creato (organization_id sempre diverso dal proprio). Il brief vietava di toccare questo flusso ("va riusato com'è") ed è comunque una modifica Alto rischio (auth/creazione utenti cross-tenant) | Decisione Lead/committente: estendere `createUser` per accettare un `organization_id` target quando l'attore è superadmin (con validazione dedicata), oppure introdurre un endpoint separato "crea primo admin per un nuovo studio". Richiede conferma esplicita prima di procedere (regola Alto rischio) |
| **Scheduler automatico rielaborazione campi ingest (`reprocess-qualifications.js` periodico)** | Richiesta committente 28/07/2026 — backfill `transfer_mode` completato manualmente (15 proposte in coda). **Lancio manuale via pannello superadmin completato** (28/07/2026): registro `reprocessableFields.js` + endpoint `GET/POST /admin/reprocess-tasks` + sezione "Rielaborazioni disponibili" in `BillingDashboardPage.jsx` (vedi [GUIDA § Registro rielaborazioni + pannello superadmin](GUIDA_CONSOLIDATA.md#lezioni-apprese-consolidate-fonte-unica)) | **Decisione di costo, non tecnica, confermata**: ogni rielaborazione richiama l'AI (costo reale); uno scheduler automatico su tutto il DB a intervalli fissi genererebbe chiamate AI ricorrenti non supervisionate. **Resta deliberatamente NON implementato** — il superadmin vede l'alert e lancia manualmente dalla dashboard, nessun cron | Solo su **conferma esplicita del committente** sul trade-off costo/comodità (es. cron mensile che chiama `POST /admin/reprocess-tasks/:key/run` per ogni voce del registro); implementazione stimata: job `node-schedule` in `alertScheduler.js` + log esito, nessuna nuova migrazione |
| **Modulo Notifiche/Alert — destinatario allerte qualifiche non è una scelta esplicita in anagrafica** | Sessione fix `daysUntilDue` 10/08/2026 ([GUIDA § Bug critico trasversale daysUntilDue](GUIDA_CONSOLIDATA.md#lezioni-apprese-consolidate-fonte-unica)) — committente ha chiesto di spostare l'approfondimento su una chat dedicata (modulo distinto, anche se correlato a Qualifiche) | Oggi il destinatario email per le allerte qualifiche è deciso da un algoritmo a cascata (`resolveWeldingCoordinatorRecipients`), non da una scelta visibile in UI; il flag anagrafica «Coordinatore saldatura responsabile (primario)» serve solo ad autorizzare la conferma semestrale, non è collegato agli alert | Sessione dedicata al modulo Notifiche/Alert (non Qualifiche): valutare se rendere il destinatario delle allerte qualifiche/documenti una scelta esplicita in anagrafica azienda, invece dell'attuale risoluzione implicita a cascata; eventualmente estendere anche a NC/documenti per coerenza |
| **Modulo NC — card statistiche duplicate da due tendine di filtro** | Sessione fix filtri Qualifiche/Scadenzari 10/08/2026 ([sgq-operating-memory.mdc § Filtri: singola fonte di verità](../.cursor/rules/sgq-operating-memory.mdc)) — committente ha chiesto una chat dedicata | `NCPage.jsx`: card cliccabili (Aperte/Scadute/In scadenza/Totale) duplicate da **due** select separati ("Stato" + "Tutte le scadenze") — anti-pattern più marcato di Scadenzari (PR #371, risolto) | Sessione dedicata al modulo NC: applicare la stessa regola (consolidare in card, verificare nessun valore solo-tendina venga perso prima di rimuoverla, aggiungere card mancanti se serve) |
| **Shell dialog di revisione ingest — markup/CSS duplicato (non la logica)** | Verifica 10/08/2026 su segnalazione committente (esperienza pregressa sessione 09/08/2026, già parzialmente corretta) | `IngestReviewDialog.jsx` e il dialog interno di `ReprocessQueueBanner.jsx` condividono già `IngestSourcePreview`, `FieldInput`, `useIngestReviewSplit` (riuso reale, sessione 09/08/2026) — resta duplicato solo il "guscio" (overlay fullscreen + header/expand + CSS quasi clone `ingest-review__*` vs `reprocess-dialog__*`, ~60-80 righe). Il pattern "ogni modal reinventa il proprio overlay CSS" è inoltre **sistemico** nel progetto (decine di `*-overlay`/`modal-overlay` in pagine diverse), non isolato a questi due file | Non urgente, basso rischio in sé (nessun bug funzionale) — valutare un componente shell condiviso (`IngestReviewShell`/classi CSS comuni) solo se si affronta il tema in una sessione dedicata al riuso UI dei dialog, non come fix isolato |

---

## Visione Strategica Aggiornata (07/03/2026) — 4 Scenari, 2 Clienti

### I 4 Scenari d'uso emersi

| # | Scenario | Chi lo usa | Standard | Output |
|---|---|---|---|---|
| 1 | **Audit di sistema** | Camellini | ISO 9001 / 14001 / 45001 | Report audit + checklist C/NC/NA |
| 2 | **Audit di terza parte** | Camellini / Mason | Norme del committente | Report audit con ref. normative committente |
| 3 | **Consulenza / SAL** | Camellini | ISO 9001 / 14001 / 45001 | Tabella avanzamento requisiti (Discusso/In corso/Completato) |
| 4 | **Rapporto di Prova** | Mason | ISO 3834 | Report con misure, prove, foto obbligatorie |

### Regola di prioritizzazione (urgenze clienti)

Quando emerge un’urgenza (es. modulo **VT** o **MT**):
- si implementa come **vertical slice** con dati + UI minima + test + feature flag/dark launch
- si evita di introdurre debito strutturale: si appoggia sempre al “Document Registry” + “Requirements/Status” (se già avviati) o si crea lo scheletro minimo riusabile
- l’obiettivo è rilasciare valore senza cambiare direzione: la roadmap resta valida, cambia solo l’ordine delle slice

### I 2 clienti attuali

**Marco Camellini** — Auditor sistemi di gestione
- Scenario 1: audit ISO 9001 ✅ (in produzione), ISO 14001 e 45001 (da completare)
- Scenario 3: SAL documentale per aziende in fase di implementazione SGQ

**Mason** — Coordinatore di saldatura
- Scenario 4: Rapporti di Prova ISO 3834-2 con evidenze fotografiche
- Template di riferimento: `Check List Audit/RDP_MSN-260127-01_REV_0.docx`
- **Pivot WPS (30/07/2026)**: generazione WPS da WPQR + Word Annex A + upload legacy secondario. **P0–P2b ✅**. Spec: [MODULO_WPS_GENERAZIONE_SCOPO_E_ROADMAP.md](specs/MODULO_WPS_GENERAZIONE_SCOPO_E_ROADMAP.md). **In attesa feedback Mason.**

### Risorse normative disponibili (leggibili dal tool)
| File | Norma | Uso previsto |
|---|---|---|
| `Normative/UNI EN ISO 9001_2015 Rev. 0.txt` | ISO 9001:2015 | Checklist ✅ |
| `Normative/...UNI EN ISO 14001_2015 Rev. 0.pdf` | ISO 14001:2015 | Checklist da costruire |
| `Normative/...UNI ISO 45001_2018 Rev. 0.pdf` | ISO 45001:2018 | Checklist da costruire |
| `Normative/...UNI EN ISO 3834-1_2021 Rev. 0.pdf` | ISO 3834-1 | Criteri scelta livello |
| `Normative/...UNI EN ISO 3834-3_2021 Rev. 0.pdf` | ISO 3834-3 | Requisiti livello intermedio |
| `Normative/...UNI EN ISO 3834-5_2021 Rev. 0.pdf` | ISO 3834-5 | Documenti e record |
| `Normative/...UNI EN ISO 3834-2_2021 Rev. 0.md` (`NORMA_00029`) | ISO 3834-2 | Requisiti livello completo — **edizione 2021** (25/08/2026); 2006 archivio |
| `Normative/...UNI EN ISO 3834-4_2021 Rev. 0.md` (`NORMA_00030`) | ISO 3834-4 | Requisiti livello elementare — **edizione 2021** (25/08/2026); 2006 archivio |

### Cosa differenzia i 4 scenari tecnicamente

| Elemento | Scenario 1 | Scenario 2 | Scenario 3 | Scenario 4 |
|---|---|---|---|---|
| Tipo risposta | C/NC/NA/OSS/OM | C/NC/NA | Discusso/In corso/Completato | Conforme/NC + misure |
| Riferimento norma | Standard ISO | **Norme committente** | Standard ISO | ISO 3834 + spec. committente |
| Foto/allegati | Opzionale | Opzionale | No | **Obbligatorio** |
| Struttura UI | Accordion sezioni | Accordion sezioni | Tabella tracker | Form + gallery foto |
| Template Word | Report audit | Report audit terza parte | SAL avanzamento | Rapporto di prova |

### Scenario 2 — soluzione per ref. normative committente
Il campo `clauseRef` (già presente nella checklist) serve come ancoraggio normativo.
Per audit di terza parte, l'auditor aggiunge nelle note o in un campo "Riferimento committente"
la procedura specifica richiesta dal cliente — non serve una checklist per ogni committente.

### Campo `norm_excerpt` — feature trasversale (tutti gli scenari)
Nel report ISO 14001 del cliente, sotto ogni punto auditato appare lo stralcio della norma.
**Piano**: aggiungere colonna `norm_excerpt NVARCHAR(MAX)` in `checklist_questions`.
Il testo può essere pre-caricato dalle normative PDF (già disponibili e leggibili).
Impatto: report Word molto più professionali, nessuna modifica alla UI.

---

## Visione Strategica (decisione 03/03/2026)

Il progetto evolve da **MVP mono-tenant** a **piattaforma SaaS multi-tenant** per studi di consulenza ISO.

### Modello utenti
```
QS Studio (superadmin — noi)
  └── Studio/Auditor (nostro cliente — abbonamento per standard)
        └── Azienda auditata (cliente dell'auditor — accesso read-only ai propri audit)
```

### Modello commerciale
- Canone per standard abilitato: ISO 9001 / ISO 14001 / ISO 45001 / Checklist Libera
- Tab standard visibili solo se abbonamento attivo per quell'auditor
- Futura: modulo workflow implementazione SGQ come add-on

### Principio di sviluppo: Dark Launch
Ogni nuovo modulo nasce come **tab nascosta** visibile solo agli admin QS Studio.
Gli auditor lo ricevono solo quando stabile e collaudato — zero interruzioni operative.

---

## Stato Avanzamento al 15/03/2026

| Area | Descrizione | Status |
|---|---|---|
| DB migrations 001-018 | Schema base, checklist, allegati, pending_issues | ✅ Completato |
| Auth / JWT | Cookie httpOnly, CORS, authenticateDownload | ✅ Completato |
| Checklist ISO 9001 | 35 domande, clauseRef esatti da documento originale | ✅ Completato (06/03) |
| Checklist ISO 14001 | 46 domande da DB, sezioni 14001_s4/14001_s5 | ✅ Completato |
| Audit CRUD | Crea, modifica, elimina, lista, statistiche | ✅ Completato |
| Sync offline-first | IndexedDB + server-wins + retry/backoff | ✅ Completato |
| Allegati | Upload, preview blob, replace desktop, delete | ✅ Completato |
| Rilievi pendenti | PendingIssuesCascade + pending_issues table | ✅ Completato |
| Re-audit | checkReaudit endpoint + AuditSelector | ✅ Completato |
| Export Word ISO 9001 | Template + Heading2 per TOC + clauseRef corretti | ✅ Completato (06/03) |
| Export Word ISO 14001 | Intestazioni per standard + numerazione corretta | ✅ Completato |
| Multi-standard UI | Tab ISO 9001 + ISO 14001, fix 4 bug 9894ed5 | ✅ Completato |
| Fix sync multi-standard | standard_ids array, auditConverter, checkbox | ✅ Completato |
| **Fase 1: DB multi-tenant** | companies, auditor_orgs, user_org_roles, subscriptions | ✅ Completato |
| **Server come fonte di verità** | Cache IndexedDB sostituita ad ogni download server | ✅ Completato |
| **Dev locale robusto** | Proxy Vite, SW disabilitato su localhost | ✅ Completato |
| **Logo azienda** | Upload/preview/delete logo in CompaniesPage; logo_url nel DB | ✅ Completato (06/03) |
| **ISO 3834-2** | Standard, sezioni DB, template Word generato | ✅ Completato (06/03) |
| **UX audit** | Pulsante "← Lista Audit" + indicatore salvataggio | ✅ Completato (06/03) |
| **Fix campo Note** | Barra spaziatrice funzionante (rimosso trim live) | ✅ Completato (06/03) |
| **Fix sommario Word** | Stili Titolo1/2, colonne DXA, margini stretti | ✅ Completato (07/03) |
| **Fix VERIFICATORE** | Campo meta.auditorName corretto | ✅ Completato (07/03) |
| **Fix backend paths** | require() corretti in certificationFindings | ✅ Completato (07/03) |
| **Fix colonne Word fisse** | tblLayout fixed + ordine OOXML corretto | ✅ Completato (08/03) |
| **Fix allegati in Word** | auditId numerico, hyperlink fldSimple cliccabili | ✅ Completato (08/03) |
| **Checklist personalizzate** | Sezioni/items dinamici, evidenze, template report assegnabile, migrazioni 025-026 | ✅ Completato (15/03) |
| **Report template per custom** | Risoluzione template, VerbaleVisita-generic, assegnazione in CustomChecklistsPage | ✅ Completato (15/03) |
| **Azienda committente da anagrafica** | Menu a tendina da companies (AuditSelector) | ✅ Completato (15/03) |
| **AuditSelector Q2+Q3** | Nascondi audit chiusi (default) + filtro azienda → audit; `auditsMenuKey` sul select audit | ✅ Completato (04/05/2026) |
| **Sync/API con UUID** | create/delete audit e custom-checklist-responses accettano UUID; merge preserva customChecklistId | ✅ Completato (15/03) |
| **Deploy backend VPS** | pscp/plink per controller, script deploy-controllers-to-vps.ps1 | ✅ Completato (15/03) |
| Export Word ISO 3834 | Template `ISO3834-audit-report.docx` già presente e valido; pipeline `wordExport.js` verificata end-to-end (test `wordExport.iso3834FullExport.test.js`: OOXML valido, placeholder tutti sostituiti, tabelle checklist C/NC/OSS/OM/NA/NV, allegati) — nessun bug riscontrato | ✅ Testato e verificato (23/07/2026) |
| Gap ISO 3834 P1/P2 (commesse/qualifiche) | Gate soft "Riesame tecnico §5.3" in `ProjectsPage` (checklist 17 punti, migration 128 `technical_review_checklist`); warning qualifica saldatore scaduta/in scadenza su assegnazione commessa (`welderQualificationExpiryWarnings.js`, riuso `semaforo` backend); selettore livello ISO 3834 (2/3/4) in `CompanyDetailPage` con guida criteri §5 (migration 129 `companies.iso3834_level`) | ✅ Completato (23/07/2026) |
| Suggeritore AI conformità 3834-3 (pattern SAL) | `weldingAiSuggest.service.js` + `POST /projects/:id/ai/suggest-compliance` (gate `ai_norms`, pattern `salAiSuggest`), pulsante "Suggerisci stato (AI)" in `ProjectsPage` — proposta human-in-the-loop, nessuna scrittura automatica | ✅ Mergiato [PR #291](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/291) (23/07/2026), deploy-manifest aggiornato, backend VPS deployato e verificato (401 su rotta protetta) |
| **Foto embedded in Word** | pic:cNvPr id univoci per range separati (100+checklist ISO, 30000+custom, 88001+logo, 89001+logo org); fix già in produzione; checkbox UI "Incorpora foto" sempre visibile | ✅ Risolto (2026-04-23) |
| **Admin utenti (CRUD + standard)** | `UsersAdminPage`, API admin users; abbonamenti / piani | ✅ Core mar/2026; abbonamenti 🔲 |
| ISO 14001 checklist completa | 53 domande in 7 sezioni clausola (migration 049, prod 07/05/2026) | ✅ Completato |
| ISO 45001 checklist | Da norma PDF disponibile | 🔲 Backlog |
| Modulo SAL (Scenario 3) | Tracker requisiti×stati + export Word + AI suggeritore (Fasi 0–5-B) — spec: [MODULO_SAL_SCOPO_E_ROADMAP.md](specs/MODULO_SAL_SCOPO_E_ROADMAP.md) | ✅ Live (smoke L3 consigliato) |
| **Generatore WPS da WPQR (Mason)** | Pivot 30/07/2026: Tabella 5 + generator (**P0**) → API/UI/AskAi (**P1**) → Word Annex A (**P2**) → upload PDF solo legacy (**P2b**). Spec: [MODULO_WPS_GENERAZIONE_SCOPO_E_ROADMAP.md](specs/MODULO_WPS_GENERAZIONE_SCOPO_E_ROADMAP.md) | ✅ P0–P2b; attesa feedback Mason |
| Modulo RDP (Scenario 4) | MVP backend+frontend (branch `feat/rdp-mason-module-mvp`): tabelle `rdp_reports/rdp_sections/rdp_tests`, CRUD `rdp.controller.js`, `RDPModule.jsx` con foto obbligatorie per prova (`RdpTestAttachments.jsx`) | 🟡 Mergiato [PR #290](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/290) (23/07/2026), migrazione 127 eseguita in produzione, backend VPS deployato e verificato — **Word export ancora bloccato**: manca `app/public/templates/rdp-mason-report.docx` (richiede input/layout dal cliente Mason, vedi nota sotto) |
| Campo norm_excerpt | Stralcio norma nel report Word | ✅ ISO 14001 (07/05/2026) · 🔲 ISO 9001 backlog |

**Progress Overall**: ~85% funzionalità core Scenario 1 · **Macro piattaforma** (SaaS completo, registry documenti, sprint collegati): indicativo **~65%**

---

## Roadmap per Fasi

### Fase 0 — Chiusura bug minori e completamento Scenario 1 — PROSSIMA

| # | Task | File | Note |
|---|---|---|---|
| 0.1 | Test export Word ISO 9001 sommario | produzione | Verificare cap. 1→11, colonne, margini |
| 0.2 | ISO 14001 checklist da norma PDF | DB migration + `checklistTemplates.js` | Norma già disponibile e leggibile |
| 0.3 | ISO 45001 checklist da norma PDF | DB migration + `checklistTemplates.js` | Norma già disponibile e leggibile |
| 0.4 | Campo norm_excerpt in checklist_questions | DB + wordExportHelpers.js | Alto impatto, bassa complessità |
| 0.5 | Rilievi pendenti reali in Word | `ExportPanel.jsx`, `wordExport.js`, `wordExportHelpers.js` | ✅ Già implementato — `GET /audits/:id/pending-issues` + fallback `checkReaudit` in ExportPanel.jsx |
| 0.6 | Fix Auth Mobile (ADR-004) | `auth.controller.js`, `apiService.js` | localStorage JWT — prerequisito per mobile |

---

### Fase 0.B — Requisiti Trasversali (da integrare nelle fasi successive)

Questi due aspetti impattano su più fasi e vanno considerati in ogni decisione architetturale.

#### Sicurezza link allegati nel Word — download token monouso (Fase 0 / bassa priorità)
**Problema**: i link agli allegati embedded nel report Word contengono il JWT di sessione completo dell'auditor.
Chiunque riceva il file Word può aprire i link e scaricare gli allegati senza fare login.
Il token ha permessi ampi (intera API) e potenzialmente lunga scadenza.

**Soluzione**: sostituire il JWT con **token monouso a scadenza breve** (48h), dedicati al singolo allegato.

```
Tabella DB:
  download_tokens (
    token_hash    VARCHAR(64) PK,   -- SHA-256 del token, mai il token grezzo
    attachment_id INT FK,
    created_by    INT FK users,
    expires_at    DATETIME,         -- ora generazione + 48h
    used_at       DATETIME NULL     -- NULL = non ancora usato
  )

Backend:
  POST /attachments/download-token  → genera token per lista attachment_id
  GET  /attachments/download?dt=TOKEN → valida (esiste? non scaduto?) e serve il file

Frontend (wordExport.js):
  Prima di costruire il Word, chiama l'API per ottenere i token temporanei
  Sostituisce getViewUrl → URL con ?dt=TOKEN invece di ?token=JWT
```

**Stima**: ~4-5 ore (DB 2h + Backend 1h + Frontend 2h)
**Priorità**: bassa — da fare dopo stabilizzazione core (Fase 0 completata)
**Riferimento**: discussione 08/03/2026

#### Audit Locking — accesso concorrente (Fase 1)
**Problema**: se due auditor aprono lo stesso audit contemporaneamente si sovrascrivono le risposte.
**Soluzione**: pessimistic lock con TTL (time-to-live).

**Stato (21/03/2026)**: implementato in codice — migrazione `database/migrations/027_audit_locks.sql`, `backend/src/services/auditLock.service.js`, route `/audits/:auditRef/lock` (+ status), header `X-Audit-Lock-Token` sulle scritture, `AuditLockBanner.jsx`, heartbeat ~60s, TTL `AUDIT_LOCK_TTL_MINUTES` (default 15). **Produzione**: eseguire migrazione sul DB prima del deploy backend.

```
Flusso proposto:
  - Utente A apre audit → backend registra lock (audit_id, user_id, expires_at = now+15min)
  - Utente B apre stesso audit → backend risponde "locked by Utente A"
  - Frontend mostra banner: "Audit in uso da [nome] — accesso sola lettura"
  - Lock si rinnova automaticamente ogni 10 min se utente è attivo
  - Lock scade se utente chiude tab / va offline / inattivo >15 min

Tabella DB:
  audit_locks (audit_id FK, user_id FK, locked_at, expires_at, session_token)
  INDEX su expires_at per cleanup automatico

Backend:
  POST /audits/:id/lock    → acquisisce lock (o restituisce chi lo ha)
  DELETE /audits/:id/lock  → rilascia lock
  PUT /audits/:id/lock     → rinnova lock (heartbeat ogni 10 min)

Frontend:
  AuditLockBanner.jsx      → banner avviso accesso concorrente
  Heartbeat in useEffect   → rinnova lock finche audit e aperto
```

#### Offline Resilience Android — gestione disconnessione (Fase 0 + Fase 2)
**Problema**: su Android PWA la connessione può cadere durante la compilazione.
Il Service Worker e limitato, la quota IndexedDB e ~50MB, la File API non e supportata.

**Stato attuale**: sync offline-first gia implementato per risposte. Mancano:
- Feedback visivo chiaro quando si e in modalita offline
- Gestione upload allegati offline (store blob in IndexedDB → upload al reconnect)
- Warning quando IndexedDB si avvicina al limite quota
- Fallback export Word su Android (gia parzialmente gestito con file-saver)

**Piano**:
```
Fase 0.3 (Auth Mobile ADR-004) — prerequisito
Fase 2 — SyncService v3: store attachments_offline in IndexedDB v3
          StorageQuotaService: monitor spazio ogni 5 min, warning a 60%, cleanup a 80%
          ConnectionStatusBanner: indicatore permanente online/offline
```

---

### Fase 0.B — Nuovi Moduli Documento (Scenario 3 e 4)

Questi moduli hanno struttura dati e UI completamente diversi dall'audit checklist.
Vanno costruiti come **tipi documento separati** identificati da `document_type` in `audits`.

#### Modulo SAL — Stato Avanzamento Lavori (Scenario 3 — Camellini)
**Riferimento**: `Check List Audit/CLIENTE - SAL documentale iso 14001 - 9001 - 45001.docx`
**Struttura**: tabella requisiti × stati (Discusso / In corso / Da validare / Completato)
**Colori**: ogni standard ha un colore (nero=tutti, rosso=45001, verde=14001, blu=9001)

```
DB: aggiungere document_type IN ('audit', 'sal', 'rdp') in tabella audits
UI: nuovo componente SALModule.jsx con tabella tracker
Word: template SAL separato con legenda colori
```

#### Modulo RDP — Rapporto di Prova (Scenario 4 — Mason)
**Riferimento**: `Check List Audit/RDP_MSN-260127-01_REV_0.docx`
**Struttura**: sezioni con prove tecniche, misure, fotografie obbligatorie, valutazione risultato
**Differenza chiave**: foto NON opzionali, struttura per prova (non per clausola ISO)

```
DB: tabella rdp_sections, rdp_tests (test_name, expected_value, measured_value, result)
UI: nuovo componente RDPModule.jsx con form prove + EvidenceManager obbligatorio
Word: template RDP con tabelle prove e galleria foto embedded
```

> ✅ **Bug foto embedded risolto (2026-04-23)**: Il codice di embedding (`xmlImageOoxml`) usa ora `imgId` univoci per range separati (100+ per checklist ISO, 30000+ per custom, 88001+ per logo azienda, 89001+ per logo organizzazione). `usePreview` e `preloadImagesIntoAudit` sono attivi. Il prerequisito per RDP è soddisfatto.

> ✅ **MVP implementato e mergiato in produzione (23/07/2026, [PR #290](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/290))**: migrazione `database/migrations/127_rdp_module.sql` (`audits.document_type` + tabelle dedicate `rdp_reports`/`rdp_sections`/`rdp_tests`), backend `rdp.controller.js` + `rdp.routes.js` (licenza `saldatura`), frontend `RDPModule.jsx` + `RdpTestAttachments.jsx` (foto obbligatorie, riuso pattern CND). **Decisione architetturale**: dati RDP su tabelle dedicate (pattern `ndt_reports`) invece che dentro `audits`/checklist — evita di replicare il motore offline-first (IndexedDB/sync/lock) per un modulo che non ne ha bisogno; `audits.document_type` resta comunque disponibile per il registro documentale futuro. **Blocco residuo**: Word export non implementato — manca `app/public/templates/rdp-mason-report.docx` (layout specifico cliente Mason, non deducibile dal solo nome file; richiede il template Word di riferimento o indicazioni dal committente prima di generare il file).

#### Struttura `document_type` in `audits`
```sql
ALTER TABLE audits ADD document_type NVARCHAR(20) NOT NULL DEFAULT 'audit'
  CONSTRAINT CK_audits_doc_type CHECK (document_type IN ('audit', 'sal', 'rdp'));
-- Migration graduale: tutti gli audit esistenti rimangono 'audit'
```

---

### Fase 1 — Fondamenta Multi-Tenant e RBAC (6-8 settimane)

**Obiettivo**: struttura dati e autorizzazioni per supportare auditor multipli con i loro clienti.

#### Nuove tabelle DB
```sql
-- Organizzazioni gerarchiche
auditor_orgs (id, name, email, subscription_plan, is_active, created_at)
  FK: organizations.organization_id (parent = QS Studio)

-- Aziende auditate (clienti degli auditor)
companies (id, auditor_org_id FK, name, vat_number, sector, address, is_active)
  Sostituisce: audits.client_name (stringa libera → FK companies.id)

-- Ruoli per utente per organizzazione
user_org_roles (user_id FK, org_id FK, role: superadmin|admin|auditor|viewer)

-- Abbonamenti per standard
subscriptions (auditor_org_id FK, standard_id FK, plan, valid_from, valid_to, is_active)
```

#### Modifiche tabelle esistenti
```sql
ALTER TABLE audits ADD company_id INT FK companies(id);
  -- client_name rimane per retrocompatibilita, company_id nullable inizialmente
ALTER TABLE users ADD auditor_org_id INT FK auditor_orgs(id);
```

#### Backend
- Middleware RBAC: ogni route verifica ruolo + appartenenza org
- Tenant isolation: ogni query filtra su `auditor_org_id` (non solo `organization_id`)
- Endpoint nuovi: CRUD `companies`, CRUD `auditor_orgs`, gestione `subscriptions`

#### Frontend
- Pagina Anagrafica Aziende (crea / cerca / seleziona)
- Pagina Admin QS Studio: gestione auditor e abbonamenti
- Collegamento audit → azienda al posto del campo testo libero

---

### Fase 2 — UI a Tab per Standard + Feature Flags (6-8 settimane)

**Obiettivo**: layout a tab scalabile, ogni standard come modulo indipendente.

#### Struttura UI proposta
```
[Anagrafica Azienda] [ISO 9001] [ISO 14001] [ISO 45001] [Checklist Libera*]
                         |           |            |
                    re-audit    re-audit      (disabilitata
                    + stampa    + stampa      se no abbonamento)

* visibile solo se abbonamento "Checklist Libera" attivo
```

#### Feature flag
```javascript
// Ogni tab controlla:
const canAccessISO14001 = subscription.includes('ISO_14001') || user.role === 'superadmin';
const canAccessFreeChecklist = subscription.includes('FREE_CHECKLIST') || user.role === 'superadmin';
```

#### Principio Dark Launch
- Durante sviluppo: tab visibile solo a `role === 'superadmin'`
- Dopo collaudo: abilitata per gli auditor con abbonamento
- Mai breaking change per gli auditor attivi

---

### Fase 3 — Sistema Licenze e Abbonamenti (3-4 settimane)

**Obiettivo**: pannello admin QS Studio per gestire chi ha accesso a cosa.

- Dashboard admin: lista auditor, stato abbonamenti, scadenze
- Attivazione/disattivazione standard per auditor
- Notifica automatica scadenza abbonamento
- Log accessi per fatturazione

---

### Fase 4 — Checklist Libera e Gap Analysis (6-8 settimane)

**Obiettivo**: domande personalizzate + motore di conformita query-based.

#### Checklist Libera
```sql
custom_checklists (id, auditor_org_id FK, name, description, is_active)
custom_questions  (id, checklist_id FK, question_text, expected_answer, weight, order)
```
- Builder UI: aggiungi domande una per volta, riordina, assegna peso
- Stesse logiche di risposta (C/NC/OSS/OM/NA/NV)
- Export Word parametrizzato anche per checklist libere

#### Gap Analysis
- Query SQL: confronto risposte vs requisiti attesi per clausola
- Report: clausole non conformi con percentuale gap, trend temporale
- Piano d'azione generato automaticamente da NC e OSS aperti
- Nota: SQL Server con colonne JSON e full-text search e sufficiente — no cambio DB

---

### Fase 5 — Workflow Implementazione SGQ (8-12 settimane)

**Obiettivo**: supportare un'azienda che vuole implementare (non solo auditare) un SGQ.

- Piano d'azione post-audit: task assegnabili con scadenza e responsabile
- Tracciamento avanzamento per clausola
- Dashboard progresso implementazione
- Notifiche milestone e scadenze

---

## 🏛️ Architettura Unificata della Piattaforma (decisione 05/04/2026)

### Scoperta fondamentale: le norme condividono la struttura HLS

ISO 9001, ISO 14001 e ISO 45001 sono costruite sulla stessa **High Level Structure (Annex SL)** — sezioni 4–10 identiche, contenuto diverso. Questo significa che lo stesso motore di checklist funziona per tutti e tre gli standard. ISO 3834 ha struttura diversa (specifica di processo) ma condivide le stesse entità fondamentali.

### 6 entità universali — Domain Model

Ogni sistema di gestione (qualunque norma) ruota attorno a queste 6 entità:

```
ORGANIZZAZIONE
    ├── ha REQUISITI (dalla norma) → verificati da AUDIT → producono RILIEVI
    ├── gestisce DOCUMENTI (§7.5) con versione, approvazione, scadenza
    ├── impiega PERSONE con QUALIFICHE (scadenza, norma di riferimento)
    ├── identifica RISCHI → definisce OBIETTIVI misurabili
    └── RILIEVI + RISCHI → generano AZIONI chiuse da EVIDENZE
```

### 3 Layer architetturali

```
LAYER 3 — UI (React): moduli specifici per scenario che usano componenti universali
           [AuditModule] [SALModule] [WeldingModule] [RDPModule]
           [DocumentBrowser] [AlertDashboard] [DataGrid] [ExportButton]

LAYER 2 — Dominio (Node.js): logica specifica per standard + motori trasversali
           AuditEngine | SALEngine | WeldingEngine | RDPEngine
           AlertEngine | ExportEngine | RAGEngine | ImportEngine

LAYER 1 — Core Platform (DB SQL Server): entità universali condivise
           organizations, standards, document_registry, personnel_qualifications,
           risks_register, objectives, actions, welding_procedures, wpqr_records, projects
```

### Nuove tabelle DB universali (da creare in Sprint A)

```sql
document_registry (
  id, company_id, standard_id, doc_type, doc_code, title,
  revision, status,            -- 'vigente'|'in_revisione'|'obsoleto'|'in_approvazione'
  issue_date, expiry_date,     -- semaforo alert: >60gg verde, 30-60 giallo, <30 rosso
  responsible, retention_years,
  attachment_id FK attachments,
  extraction_confidence DECIMAL(3,2),  -- 0.0-1.0 da AI import
  import_status                -- 'ai_draft'|'verified'|'active'
)

personnel_qualifications (
  id, company_id, person_name, person_id FK users NULL,
  qualification_type,          -- 'iso9606_1'|'iso9712_vt'|'iso14731_iwt'|'iso14732'
  certificate_number,
  standard_ref,                -- es. 'ISO 9606-1'
  welding_process,             -- es. '141' (TIG), '111' (elettrodo)
  material_group,              -- es. '1.1' (ISO/TR 15608)
  position_range,              -- es. 'PA PF'
  issue_date, expiry_date,
  issuing_body,
  attachment_id FK attachments,
  extraction_confidence DECIMAL(3,2),
  import_status
)

risks_register (
  id, company_id, standard_id, clause_ref,
  risk_type,                   -- 'risk'|'opportunity'
  description, context,
  probability INT,             -- 1-5
  impact INT,                  -- 1-5
  score AS (probability * impact),
  mitigation_action, owner, due_date, status
)

objectives (
  id, company_id, standard_id, clause_ref,
  description, target_value, unit, current_value,
  measurement_frequency, due_date, status, responsible
)

actions (
  id, company_id, standard_id,
  source_type,                 -- 'audit_nc'|'risk'|'sal_gap'|'incident'|'management_review'
  source_id,                   -- FK al record sorgente
  description, responsible, due_date,
  status,                      -- 'aperta'|'in_corso'|'verificata'|'chiusa'
  evidence_text, attachment_id FK attachments,
  created_at, closed_at
)

-- Specifiche ISO 3834
welding_procedures (           -- WPS
  id, company_id, wps_code, revision,
  welding_process,             -- codice ISO 4063 (es. 141, 111, 135)
  material_group,              -- ISO/TR 15608
  filler_material, shielding_gas,
  joint_type, position,
  thickness_range_min, thickness_range_max,
  preheat_temp, interpass_temp, pwht,
  qualification_standard,      -- es. 'ISO 15614-1'
  status, attachment_id
)

wpqr_records (                 -- WPQR collegato a WPS
  id, wps_id FK welding_procedures,
  wpqr_code, test_date, issuing_body,
  vt_result, rt_result, ut_result, mt_result, pt_result,
  tensile_result, bend_result, impact_result, hardness_result,
  validity_range_description,
  expiry_date NULL,
  attachment_id
)

projects (                     -- Commesse ISO 3834
  id, company_id, project_code, client_name, client_company_id FK companies NULL,
  description, start_date, end_date,
  applicable_wps_ids,          -- JSON array di wps ids
  status,                      -- 'offerta'|'in_corso'|'completato'|'archiviato'
  requirements_review_date, technical_review_date
)
```

### Pipeline di importazione documentale assistita da AI

Ogni documento normativo ha struttura definita dalla norma → estrazione deterministica:

```
PDF upload (batch) → rilevamento tipo documento → estrazione testo (pdf-parse / OCR)
  → LLM extraction con schema Zod → preview con confidence score per campo
  → validazione utente (campi incerti in giallo) → commit in DB + alert engine aggiornato
```

**Tipi documento supportati (con schema di estrazione noto):**

| Tipo | Norma | Campi chiave estratti |
|---|---|---|
| Patentino saldatore | ISO 9606-1 | nome, processo, gruppo mat., posizione, scadenza |
| Qualifica operatore | ISO 14732 | nome, processo, scadenza |
| Cert. NDT | ISO 9712 | nome, metodo (VT/MT/PT/UT/RT), livello (1/2/3), scadenza |
| WPS | ISO 15609-1 | codice, processo, materiale, posizione, parametri |
| WPQR | ISO 15614-1 | riferimento WPS, prove eseguite, range validità |
| Dichiarazione CE macchine | Dir. 2006/42/CE | modello, S/N, direttive, scadenza verifica |
| Cert. taratura strumento | ISO 17662 | strumento, valore, incertezza, scadenza |

**Regola AI-import**: ogni record importato ha `import_status = 'ai_draft'` fino a conferma umana. Solo record `'verified'` o `'active'` appaiono negli elenchi ufficiali e nelle esportazioni per enti certificatori.

---

### Piano Sprint — da avviare dalla prossima sessione

| Sprint | Contenuto | Output concreto | Stima |
|---|---|---|---|
| **A — Core Foundation** | Migration tabelle universali + API CRUD + `<DataGrid />` con export Excel | Struttura DB e griglia dati funzionante per tutti i moduli | 1 settimana |
| **B — Alert Engine + Document Browser** | Cron job backend + Nodemailer + `<DocumentBrowser />` navigazione cartelle | Notifiche email scadenze + esplorazione documenti per tipo | 1 settimana |
| **C — Modulo SAL** | SAL tracker requisiti × stati + Word export SAL + colori standard | Camellini può fare SAL digitale per ISO 9001/14001/45001 | 1-2 settimane |
| **D — Modulo Welding (ISO 3834)** | WPS/WPQR registry + qualifiche saldatori con alert + gestione commesse | Mason ha il registro completo ISO 3834 con scadenze | 2 settimane |
| **E — AI Import Pipeline** | **v1 in produzione**: upload batch + `pdf-parse` + confidence + revisione umana + **estrazione JSON OpenAI opzionale** su testo estratto (tabella sprint **9**). **Fasi successive**: staging tipizzato (sprint **10**), poi OCR e agenti multi-step / commit registry | Import massivo patentini, WPS, WPQR, dichiarazioni CE (progressivo) | v1 fatto; estensioni 1-2 settimane a slice |
| **F — RAG** | Indicizzazione vettoriale documenti + norm_excerpt + ricerca semantica | Ricerca "trova tutte le NC legate a clausola 8.4" | dopo registry + staging stabili |

**Regola di sequenza**: ogni sprint è indipendente e consegna valore, ma A è prerequisito di tutti. B è prerequisito di C e D. E (estensioni oltre v1) è prerequisito di F.

**Nota allineamento (11/04/2026)**: la tabella numerata **Sprint 0–11** in basso è la **fonte di verità** per naming e prerequisiti; questa tabella A–F resta come macro-fasi di prodotto.

---

## Note Architetturali Permanenti

| Decisione | Motivazione |
|---|---|
| `fetchAttachmentBlob()` non img src | Browser non invia Authorization header cross-origin su :8443 |
| conformity_status trigger: NC/OSS/NV | OM escluso: e osservazione minore, non rilievo persistente |
| section_code non clause_number | Colonna reale in checklist_questions |
| Backend su systemd | Restart: `systemctl restart sgq-backend` — NON fuser da solo |
| Dark launch per nuove feature | Auditor ricevono feature solo quando collaudate — zero interruzioni |
| client_name → company_id FK (Fase 1) | Retrocompatibilita: campo nullable, migrazione graduale |
| SQL Server sufficiente per gap analysis | JSON columns + full-text search — no cambio tecnologia DB |
| **Stili Word in italiano** | Template usa Titolo1/Titolo2 — NON Heading1/Heading2 (Word italiano) |
| **Margini Word via JS** | Regex su sectPr in injectOoxmlMarkers — evita manipolazione binaria .docx |
| **document_type in audits** | Campo per distinguere audit/SAL/RDP — retrocompatibile (default='audit') |
| **Audit Scenario 2 (terza parte)** | Gestito con clauseRef + campo note — no checklist per ogni committente |
| **norm_excerpt in checklist_questions** | Stralcio norma per ogni clausola — appare nel report Word sotto la valutazione |

---

## 🏛️ VISION VINCOLANTE — Decisione strategica 08/04/2026

> Questa sezione è **congelata**. Le decisioni qui riportate non si riaprono.
> Ogni modifica richiede approvazione esplicita del product owner.

### Modello di business definitivo

```
QS Studio (superadmin — proprietari della piattaforma)
│
├── Auditor/Consulente  (es. Camellini, Mason — WRITE su tutto)
│   │  Pagano per ogni azienda che gestiscono
│   │  Possono essere: auditor puri, consulenti implementazione, coordinatori saldatura
│   │
│   ├── Azienda A  (cliente — può acquistare moduli in autonomia, ha WRITE sui propri dati)
│   ├── Azienda B
│   └── Azienda C
│
└── Azienda autonoma  (acquista direttamente — gestisce da sola con write completo)
```

**Fatturazione**: per azienda attiva nell'archivio (= ha dati + occupa spazio server).  
Un auditor che gestisce 10 aziende → 10 licenze. Prezzo varia per modulo attivato.

**Modulo Reclami**: i reclami e le NC li inserisce **l'azienda** che acquista il modulo (non solo il consulente).

### Strategia Mobile / Desktop

| Dispositivo | Attività | Moduli accessibili |
|---|---|---|
| **Mobile Android (PWA)** | Campo: cattura e verifica (checklist, NC, foto, scadenze/qualifiche, CND) + assistente AI citato | **P0**: Audit, NC, Documenti/Scadenze (consultazione), Qualifiche (consultazione), CND se licenza, Home/alert. **P1**: AI Chat / assist, Reclami light. **P2**: SAL riga singola |
| **Tablet** | Audit con più spazio, consultazione documenti in cantiere | Come mobile + più viewport checklist |
| **Desktop** | Analisi, report Word, SAL completo, riesame, gap, configurazione | Tutti i moduli |

**Regola progettuale**: le schermate di gestione dati (form, tabelle complesse, configurazione) sono **desktop-first**. Il mobile rimane ottimizzato per il **campo**.

**Check di prodotto (fonte)**: [specs/PRODUCT_CHECK_MOBILE_AI.md](specs/PRODUCT_CHECK_MOBILE_AI.md) — matrice moduli × mobile × AI, contratto di affidabilità AI, sequenza slice M-AI-1…6.  
**Stato (21/07/2026)**: M-AI-1…5 ✅ completati (PR #259–#265). PR2 Controparti ✅ verificata già in main (commits `565fed3`, `cd93ab1`, `81aae9a`).  
**Backlog aperto (parcheggiato — riprendere su richiesta)**: M-AI-6 SAL mobile compatto (FE only, bassa priorità) · M-AI-5b qualifiche Q&A strutturata (endpoint backend DB-aware, media priorità Mason) · §9.1 KPI/indicatori (prerequisito Riesame Slice 4, richiede pianificazione schema).

### Architettura UI — Navigation Foundation

- **React Router v6**: URL semantici, deep linking, back button browser
- **Layout fisso**: sidebar sinistra su desktop (240px), bottom navigation su mobile (5 voci)
- **Home Dashboard**: "Cosa fare oggi" — alert scadenze, NC aperte, prossimi audit
- **Feature flags**: ogni modulo ha un flag di licenza. Se non attivo → schermata `<ModuleLocked />`

### Moduli licenziabili

| Modulo | Target | Contenuto |
|---|---|---|
| **AUDIT** | Auditor / Consulenti | Audit ISO 9001/14001/45001, checklist, NC, report Word |
| **SGQ** | Aziende / Consulenti | Documenti, Qualifiche, Rischi, Obiettivi, Azioni, SAL |
| **RECLAMI** | Aziende | Reclami clienti (inserimento da azienda), NC interne, follow-up |
| **SALDATURA** | Coordinatori / Aziende | WPS/WPQR, qualifiche saldatori, NDT, commesse ISO 3834 |
| **Material Compliance AI** (proposto) | Ufficio qualità / metalmeccanico | Certificati EN 10204 3.1: estrazione + Rule Engine + approvazione umana. Gate MVP: seam su `saldatura` + `ai_import`. Spec: [MODULO_MATERIAL_COMPLIANCE_AI.md](specs/MODULO_MATERIAL_COMPLIANCE_AI.md) |
| **ALERT** | Incluso in tutti | Email automatiche scadenze, dashboard semaforo |
| **AI** | Add-on | Import batch PDF (v1 testo locale), staging tipizzato (Sprint 10), ricerca semantica (backlog) |
| **Commesse / Riesame contratto** | Add-on futuro | Workflow riesame requisiti §8.2 (pilota “ordine diretto”): stati, checklist, allegati — vedi [MINI_SPEC_RIESAME_REQUISITI_CONTRATTO.md](specs/MINI_SPEC_RIESAME_REQUISITI_CONTRATTO.md) |
| **Office Round-trip (beta)** | Auditor / Aziende (desktop) | Apertura Word/Excel desktop e salvataggio diretto su server via WebDAV/Helper custom — vedi [MINI_SPEC_OFFICE_ROUNDTRIP_WEBDAV.md](specs/MINI_SPEC_OFFICE_ROUNDTRIP_WEBDAV.md) |

### Roadmap Sprint definitiva

| Sprint | Nome | Contenuto | Prerequisito |
|---|---|---|---|
| **0** | Navigation Foundation | React Router v6, sidebar, home dashboard, ModuleLocked | — |
| **1** | Document Registry UX | Redesign UX (vista Priorità, wizard form, export Excel) | Sprint 0 |
| **2** | Qualifiche + Alert Engine | Personnel qualifications, cron email scadenze | Sprint 0 |
| **3** | NC & Azioni Correttive | Loop audit→azione→verifica, workflow status | Sprint 0 |
| **4** | SAL (Stato Avanzamento Lavori) | Motore gap analysis operativa clausola-per-clausola + griglia requisiti×stati + report Word. **Spec**: [MODULO_SAL_SCOPO_E_ROADMAP.md](specs/MODULO_SAL_SCOPO_E_ROADMAP.md) — verdetto «gap engine condiviso come ossatura», letto anche dal Riesame di Direzione. **Fase 5-A ✅ (suggeritore stato AI)**: pulsante «Suggerisci stato (AI)» (riga + bulk) su `/sal`; l'AI legge le evidenze documentali collegate e PROPONE stato + confidenza + motivazione (human-in-the-loop ISO §7.5, nessuna scrittura automatica). Backend `salAiSuggest.service.js` + `POST /companies/:id/gap-ai-suggest` (gate licenza `ai_norms` sopra `sal`), riuso `aiProviderAdapter` + `documentTextExtractor`. Nessuna migrazione (proposta runtime). **Fase 5-B ✅ (conformità legislativa)**: il suggeritore AI valuta anche gli obblighi di legge collegati alla clausola via `linked_legislation` (D.Lgs. 81/2008, 152/2006) — testo articoli caricato da `normBroker.getClauseText`, output per-articolo `{coverage covered/partial/missing, gap, rationale}` + confidenza. Due assi distinti in UI («Conformità norma tecnica» vs «Conformità legislativa»). Nessuna migrazione, additivo su 5-A. **Seam capability ✅ (18/07/2026)**: `SAL_LEGAL_CONFORMITY` centralizzata in `moduleLicense.service.js` (oggi mappa su `ai_norms`, helper `hasSalLegalConformityCapability`); il backend calcola l'asse legislativo solo se la capability è ON (OFF → solo asse tecnico, zero chiamate broker, graceful). Scorporo futuro in **2 mosse**: (1) chiave `ai_legal` in `KNOWN_MODULE_KEYS`; (2) ripuntare la costante del seam. **Fatturazione a regime** = «per azienda gestita» → prerequisito futuro `company_id` su `ai_interactions` (non ora). | Sprint 3 |
| **5** | Saldatura ISO 3834 | WPS/WPQR, qualifiche saldatori, commesse | Sprint 2 |
| **6** | Rischi + Obiettivi | Risk register §6.1, obiettivi §6.2 | Sprint 3 |
| **7** | Reclami + Fornitori | Reclami clienti, valutazione fornitori | Sprint 3 |
| **8** | Licensing Engine | Feature flags, pannello abbonamenti, UI locked | Sprint 0 |
| **9** | Import PDF **v1** (ingest + AI opzionale) | Job `import_jobs` / `import_job_files`, estrazione **testo locale** (`pdf-parse`), confidence euristica, revisione umana, licenza `ai_import`, UI `/settings/import-jobs`. **Analisi strutturata** (OpenAI JSON) su testo estratto: endpoint `POST .../files/:fileId/ai-extract`, migrazione **039**. **Fuori scope immediato**: OCR, agenti multi-tool, commit automatico in registry. Obiettivo: **fondazione ingest** + primo valore AI testabile in sicurezza (revisione umana). | Sprint 1 |
| **10** | Import staging → registry | Da job file a **record di staging tipizzati** (`document_type` / form registry), commit umano verso persistenza documenti. Estensioni: OCR opzionale, classificazione assistita **dopo** registry stabile. | Sprint 9 |
| **11** | Commesse / Riesame contratto | Modulo workflow §8.2 (pilota): stati, storico, checklist, allegati in/out; **separato** dalla sola pipeline PDF. Specifica: [MINI_SPEC_RIESAME_REQUISITI_CONTRATTO.md](specs/MINI_SPEC_RIESAME_REQUISITI_CONTRATTO.md). | Sprint 1, Sprint 10 (consigliato) |
| **12** | Office Round-trip (PoC) | Tool desktop-first per documenti SGQ: link Office URI + endpoint `webdav-link` + WebDAV (GET/PUT/PROPFIND/LOCK/UNLOCK) + lock/versioning baseline. Specifica: [MINI_SPEC_OFFICE_ROUNDTRIP_WEBDAV.md](specs/MINI_SPEC_OFFICE_ROUNDTRIP_WEBDAV.md). | Sprint 1 |

### Copertura normativa per modulo SGQ

| Norma | Requisiti coperti dal modulo SGQ |
|---|---|
| ISO 9001:2015 | §7.5 Documenti, §7.2 Competenze, §8.7+§10.2 NC/Azioni, §8.2.1 Reclami, §8.4 Fornitori, §9.1 Monitoraggio, §9.3 Riesame, §6.1 Rischi, §6.2 Obiettivi |
| ISO 14001:2015 | + Aspetti ambientali, Obblighi conformità, Piani emergenza, Monitoraggio ambientale |
| ISO 45001:2018 | + Identificazione pericoli, Incidenti/infortuni, Valutazione rischi H&S |
| ISO 3834 | Modulo Saldatura separato: WPS/WPQR, Qualifiche 9606/9712, Commesse, Trattamenti termici |

---

## Checklist sessioni — Licenze moduli, auth e allineamento API/UI

> Obiettivo: chiudere i gap tra **pannello licenze**, **menu/route frontend** e **middleware backend**; robustezza credenziali. Spuntare le voci a fine sessione. (Revisione tecnica 12/04/2026.)

**Test, DoD e smoke di release** (tutti i moduli, non solo licenze): piramide L1–L5, matrice manuale e Definition of Done in [GUIDA_CONSOLIDATA.md](GUIDA_CONSOLIDATA.md) — sezione *Piano qualità: fasi di sviluppo e test di robustezza*.

### Sessione A — Sessione utente e licenze “a caldo”

- [x] Dopo `PATCH /admin/licenses`: aggiornare `user` nel client (`GET /auth/me` o merge risposta) senza richiedere login manuale all’admin che salva. *(Implementato: `refreshUser` in `AuthContext` + chiamata da `LicensesSettingsPage` dopo salvataggio — 2026-04-18.)*
- [x] Valutare propagazione agli altri utenti della stessa org (messaggio “riavvia sessione”, evento, o TTL breve token) — documentare scelta in [GUIDA_CONSOLIDATA.md](GUIDA_CONSOLIDATA.md). *(Scelta attuale: niente push real-time; messaggio in UI dopo salvataggio + riga guida tabella A — 2026-04-18.)*
- [ ] `POST /auth/refresh`: includere snapshot minimo (`licensed_modules`, `allowed_standard_ids`) **oppure** interceptor che chiama `/auth/me` dopo refresh riuscito.

### Sessione B — Enforcement backend coerente con il prodotto

- [ ] Allineare **alert** (`GET /alerts`, `GET /alerts/count`): `requireLicensedModule` appropriato (es. `documents`) **oppure** modulo `notifications` / chiave dedicata — allineato alla tabella `KNOWN_MODULE_KEYS`.
- [ ] Inventario route **solo `authenticate`**: custom-checklist, report-template, companies, sync, ecc. — decidere per ciascuna se resta inclusa nel modulo **audit** o merita `requireLicensedModule`.
- [ ] Verificare assenza di endpoint “sensibili” scoperti rispetto al contratto licenze (registro in tabella o ADR breve).

### Sessione C — UX e unicità codice frontend

- [ ] Centralizzare `hasLicensedModule` (un solo hook o util condiviso da `LicensedRoute` e `AppLayout`).
- [ ] Bottom nav mobile: nascondere o disabilitare voci verso moduli non licenziati (coerenza con sidebar).
- [x] Allineare `AuthContext.isAdmin()` a **admin + superadmin** se il context verrà usato per gating (oggi le pagine usano spesso il check inline). *(2026-04-18: `isAdmin()` include `superadmin`.)*

### Sessione D — Sicurezza credenziali e identità

- [ ] **JWT_SECRET** (e segreti analoghi): fail-fast in avvio se mancante in produzione; nessun default nel bundle/server pubblicato.
- [ ] Login con stessa **email su più organizzazioni**: obbligare `organization_id` o errore esplicito “account ambiguo” (no `recordset[0]` non deterministico).
- [ ] Endpoint **`register`**: policy produzione (disabilitato, solo invito, solo superadmin) — allineare a modello commerciale.

### Sessione E — Comportamento DB licenze (opzionale / hardening)

- [ ] Documentare esplicitamente **fail-open** (`licensed_modules` NULL / JSON invalido = tutti i moduli) in guida deploy; se serve modello più stringente: modalità deny-by-default dietro flag o colonna ambiente.

---

## Architettura utenti e segregazione (riferimento unico)

**Documento**: [ARCHITETTURA_UTENTI_RBAC.md](ARCHITETTURA_UTENTI_RBAC.md) — principi, livelli tenant→studio→azienda, catalogo ruoli, deleghe creazione utenti, scope per area, piano migrazione (fasi 0–4), DoD per modifiche RBAC.

**Da implementare in codice** (priorità quando si lavora su auth/audit): fix `auditorOrg.controller` (`isOrgWideAdmin` vs `isSuperadmin`); allineare write path audit/NC/allegati allo stesso scope della lista; servizio centralizzato `assert*` / `get*ScopeWhereClause` come da doc.

---

**Ultimo Aggiornamento**: 16 maggio 2026

### Sequenza priorità aggiornata (29 aprile 2026)

> **Priorità assoluta**: robustezza sync dati — nessuna perdita di lavoro in qualsiasi condizione di rete. Motivazione: bug Camellini 28/04/2026 (risposte checklist e testi mai sincronizzati per lock oscillante su rete mobile). L'affidabilità dell'app professionale viene prima di qualsiasi nuova funzionalità.

| # | Task | Modalità | Stato |
|---|---|---|---|
| P0 | 5 bug Camellini ISO 9001 (accordion, race condition, domande mancanti, audit sparisce) | Deputy | ✅ Chiuso |
| P1 | Custom checklist outcome buttons (C/OSS/NC/OM/NV/NA su flag) — migrazione 043, VPS, merge `e1f3c5b` | Deputy | ✅ Completato — Smoke L3 umano da fare |
| P2 | Sicurezza credenziali: JWT_SECRET fail-fast, login email ambiguo, register prod | Sessione D | ✅ Completato |
| Bug | Audit cancellati non ricompaiono nel menu dropdown (StorageContext.jsx + recentlyDeletedRef) | Fix mirato | ✅ Completato |
| Bug | LOCK-* audit ricomparivano tra device — isIntentionalDraft + forceClearLocalCache | Fix mirato | ✅ Completato (24/04) |
| P3 | **Sprint 0–9** — Navigation, Registry, Alert, Notifiche, Qualifiche, NC, Rischi, Reclami, Licensing, Import PDF | Multi-sessione | ✅ Tutti completati |
| **🔴 SYNC-1** | **save_responses indipendente dal lock** — risposte checklist sempre accodate (bug Camellini) | Fix mirato | ✅ Completato (29/04) — PR #18 — deploy necessario |
| **🔴 SYNC-2** | **Conflict resolution campo per campo** — testi/note non scartati da server-wins su updated_at | Fix mirato | ✅ Completato (29/04) — PR #19 — deploy VPS fatto |
| **🔴 SYNC-3** | **Banner merge dati** — `SyncMergeBanner` avvisa quando il backend applica field-level merge | Fix mirato | ✅ Completato (29/04) — solo frontend, Netlify |
| **🔴 SYNC-4** | **Guard logout con modal React** — `LogoutSyncGuard` con attesa sync, spinner, 3 opzioni | ADR-007 | ✅ Completato (29/04) — solo frontend, Netlify |
| **🟡 SYNC-5** | **Upload allegati offline** — blob in IndexedDB → upload automatico al reconnect | SyncService v3 | ✅ Completato (07/05/2026) — `syncUploadAttachment` fix customItemId, evento `sgq:attachmentSynced`, `delete_attachment` in coda, badge ⏳ UI |
| **🔴 T0** | **Staging environment** — DB separato + dati anonimi. Valutato: **non necessario** per T1-T2 (migrazioni additive). Da rivalutare per T3. | Infra | ✅ Saltato (decisione 29/04) |
| **🔴 T1** | **Temporal tables** su `audit_responses` + `audits` — storicizzazione automatica nativa SQL Server | DB migration | ✅ Completato (29/04/2026) — migration 045, backup pre-T1 ok |
| **🔴 T2** | **Event store** + tabella `audit_events` + endpoint `POST /audits/:uuid/events` + idempotency | Backend | ✅ Completato (30/04/2026) — migration 046, deploy VPS, smoke OK |
| **🔴 T3** | **Frontend event-based** per `save_responses` — ogni risposta = evento atomico (feature flag) | Frontend | ✅ Completato + Smoke L3 ✅ (01/05/2026) — status + note multi-device verificati su prod, `VITE_SYNC_MODE=events` attivo |
| **🔴 T4** | **Frontend event-based** per campi ricchi — `field_updated` con debounce 500ms | Frontend | ✅ Completato (01/05/2026) — generalData/auditObjective/auditOutcome/notes con debounce 500ms |
| **🔴 T5** | **Lock opzionale** — rimuove lock come prerequisito scrittura; lock solo UX informativo | Full-stack | ✅ Completato (01/05/2026) — assertWriteAllowed rimosso da audit/response/customChecklist/attachment controller |
| **🔴 T6** | **Recovery UI + history API** + compaction job notturno — compliance ISO 9001 §7.5 | Full-stack | ⏳ Dopo T5 |
| P4 | ISO 14001 checklist completa da norma PDF | Deputy | Backlog — dopo SYNC-3 |
| P5 | **Deputy Mason — audit 2ª parte + fornitori** (`fornitoreSupplierId`, `GET /suppliers?company_id=`, counterparties mig. 096-097) | Deputy | ✅ Completato — PR [#111](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/111) merged 17/06/2026 |
| P6 | **Sprint 10** - Ingest PDF → staging → document registry (commit umano) | Agente | ✅ Completato (03/05/2026) - commit `939af59` |
| P7 | Sprint 11 — Riesame contratto / commesse | ✅ Completato (25/05/2026) | PR #67, smoke UI OK — vedi [GUIDA](GUIDA_CONSOLIDATA.md#sessione-25052026--registro-norme-sot-r1r7-completato-e-chiusura-pr) |
| P8 | Sprint 12 — Office Round-trip WebDAV (PoC) | Backlog parallelo | [`agent-tasks/TASK_SPRINT12_WEBDAV_PARALLEL.md`](agent-tasks/TASK_SPRINT12_WEBDAV_PARALLEL.md) |
| **S-A1** | **Gate read-only UI** — banner + disabilitazione tutti i controlli per audit `completed`/`approved`/`archived` | Deputy (04/05/2026) | ✅ Completato |
| **S-A2** | **Policy API `AUDIT_READ_ONLY`** — guard HTTP 403 su `saveResponse`, `bulkSaveResponses`, `updateAudit`; stall permanente in syncService | Deputy (04/05/2026) | ✅ Completato |
| **S-A3** | **ClosePanel custom completion** — blocco chiusura audit solo-custom senza risposte | Deputy (04/05/2026) | ✅ Completato |
| **S-A4** | **Pending deep-link** — ordinamento NC→OSS→NV, zero-state esplicito, pulsante "Vai alla domanda" con scroll accordion | Deputy (06/05/2026) | ✅ Completato |
| **S-A5** | **Preserva pendingIssues al reconcile** — Eccezione 7 in `StorageContext.reconcileAuditsFromServer`: locale non azzerato a ogni fetch | Deputy (05/05/2026) | ✅ Completato |
| **S-A6** | **NC audit vs modulo NC** — Opzione C implementata: pulsante "Registra nel modulo NC" in `NonConformitiesManager`. Route `apiService.createNonConformity` corretta. Conflitti Git irrisolti rimossi. `updateAuditMetrics` somma ISO+custom. | Deputy (07/05/2026) | ✅ Completato |
| **HOTFIX-08/05** | **6 fix consecutivi 08/05/2026**: Exception 1 (campi testo si svuotavano da `{}` truthy), Exception 4 (hardcoded ISO_9001 multi-standard), CORS nginx fallback (backend down), licenze admin/superadmin bypass, fix race rendering checklist Sighinolfi (PR #39), 3 GAP custom (PR #37) | Lead (08/05/2026) | ✅ Tutti mergiati su main, deploy Netlify ok |
| **ADR-009** | **Multi-standard / multi-document_type architettura per-norma + AI-ready** — ADR vincolante che chiude il debito strutturale emerso dai 6 hotfix. Modello a 2 assi (`document_type` × `selectedStandards[]`), `byStandard[key]` per dati per-norma, `STANDARDS_REGISTRY` come SoT, flag `isIntegratedSystem` (Annex SL HLS), RDP come specializzazione custom, SAL come modulo gestionale separato, audit pilota di `document_registry`, AI come licenza separata (B-style: nascosta se off) | Lead (08-09/05/2026) | ✅ ADR scritto |
| **ADR-009 Fase 1** | PendingIssuesCascade UI/UX (badge standard, navigazione accordion, chip sezione, SECTION_LABELS) + fix backend pending-issues/NC (filtro NC/OSS/NV, CHECK constraint DB, nc_id post-MERGE, alias SQL) + collapse clausola mobile | Lead (12/05/2026) | ✅ Completato — branch `cursor/adr009-fase1-registro-standard-52c5` mergiato su main, deploy Netlify |
| **ADR-009 Fase 2** | Sezione 11 e Close Panel per-norma + flag SGI integrato | Deputy (22/07/2026) | ✅ Completato — PR #275 |
| **ADR-009 Fase 3** | Export Word integrato SGI + bundle ZIP multi-standard | Lead (22/07/2026) | ✅ Completato — PR #284 |
| **ADR-009 Fase 4** | Custom checklist come "norma virtuale" pari grado a ISO (audit ibridi ISO+custom: blocco separato Sezione 11/12, export Word aggiuntivo) | Lead (22/07/2026) | ✅ Completato |
| **ADR-009 Fase 5** | Audit ↔ document_registry tie-in (audit chiuso = documento del registro con scadenza) | — | ❌ **Superata** (decisione 07/06/2026, chiusura PR #52) — vedi ADR-009 sezione Fase 5 |
| **AI-CTX** | Contesto azienda/studio nell'assistente AI — backend filtra chunk per azienda, frontend chip + dropdown selettore, migrazione 063 | Lead (16/05/2026) | ✅ Completato |
| **AI-OPT-L1** | Knowledge Optimizer Livello 1: dedup cosine >0.95, prune stale NC >180gg, gap detection per azienda — job notturno 03:00, migrazione 064 | Lead (16/05/2026) | ✅ Completato |
| **AI-OPT-L2** | Knowledge Optimizer Livello 2: sintesi AI settimanale, condensazione per azienda, pattern cross-company, enrichment chunk deboli — job domenica 04:00, migrazione 065 | Lead (16/05/2026) | ✅ Completato |
| **AI-KPI** | Dashboard Knowledge Health per admin: `/ai-knowledge-health`, 4 KPI cards, coverage per azienda, gap rilevati, endpoint `GET /ai/knowledge-health` | Lead (16/05/2026) | ✅ Completato |
| **PR #65** | Connettori Normattiva/EUR-Lex + email norme superate (job settimanale) | Lead (25/05/2026) | ✅ Merged `b0a5900`, deploy VPS 25/05 |
| **REG-NORM-SOT** | Refactor: `document_registry` = SoT visibile norme/leggi; slice R1–R7 in [PLAN_REGISTRY_NORM_SOT_SLICES.md](agent-tasks/PLAN_REGISTRY_NORM_SOT_SLICES.md) | Deputy/Lead | ✅ Completato (25/05/2026) — commit `ef0d6f8`, PR #66/#67/#68, ADR-011 |
| **LEGISL-INGEST** | Ingestione testo articoli legge (D.Lgs. 81/2008 → ISO 45001, D.Lgs. 152/2006 → ISO 14001) da Normattiva in `norm_requirements` + matrice `linked_legislation`; connettore `normativaConnector.getClauseText` (riattiva step publicLaw broker). 30 articoli verbatim, seed `backend/data/legislation_seed.json`, script `ingest-legislation-normattiva-vps.js` idempotente. ADR-010 Task 2-B/2-D. | Lead (18/07/2026) | ✅ Completato — branch `feat/legislation-ingest-normattiva` |
| **COMPANY-PROFILE** | Profilo 1:1 + lookup + cerca anagrafica. **S0–S6 ✅** (PR #426, VPS 15/08). Nome richiede Company Search attivo in console OpenAPI. | Lead 23/07 · S6 15/08/2026 | ✅ Completato |
| **REGISTRO-LEGALE** | Registro obblighi legali capitolo-per-capitolo, **ambiente e sicurezza separati**. **Ambiente** `LEG_AMBIENTE_152` (già esistente, 46 voci a granularità capitolo). **Sicurezza** `LEG_SICUREZZA_81` (nuovo, 29 capitoli da Grantini + citazioni, SI/NO/NA/NV). Schema sezioni: mig. **138** (`reference_text`/`linked_legislation`). Agente validità esteso (PR #65). | Lead (28/07–01/08/2026) | ✅ PR #317 MERGED · mig. 138 VPS OK · residuo **N5** (revisione umana contenuto prima di audit cliente) + P2 granularità a/b/c ambiente (Certiquality) |

**Prossimo Step**: REGISTRO-LEGALE N5 + backlog P2 ambiente a/b/c. COMPANY-PROFILE S0–S6 in produzione (ricerca per nome: attivare Search in console OpenAPI).

> **Regola architetturale da ADR-008 (vincolante)**: ogni nuova feature che tocca la sincronizzazione dati deve essere progettata compatibile con il modello event-based. Nessun nuovo endpoint che accetti "stato corrente intero" senza event log parallelo.

> **Regola architetturale da ADR-009 (vincolante)**: ogni nuovo standard / nuovo `document_type` / componente di reportistica deve rispettare il test di scalabilità: aggiungere un nuovo standard ISO = 1 INSERT DB + 1 riga `STANDARDS_REGISTRY` + (opz.) 1 template Word, **zero altre modifiche**. Ogni nuovo modulo deve passare la AI-readiness checklist (schema-first, componenti modulari, `document_type` esplicito, `documentRegistryId` predisposto).

#### Smoke L3 manuale P1 — checklist (utente, produzione)

| # | Passo | Esito | Data | Note |
|---|---|---|---|---|
| 1 | Login Camellini | ✅ | 03/05/2026 | JWT + org 1002 |
| 2 | Crea/apri checklist "Test Smoke L3" con flag "Abilita valutazione" | ✅ | 03/05/2026 | has_outcome_buttons: true, pulsanti visibili |
| 3 | Aprila da dentro audit MSN-260503-01 (custom_checklist_id: 13) | ✅ | 03/05/2026 | |
| 4 | Click C su domanda 1.1 → UI verde, auto-save | ✅ | 03/05/2026 | |
| 5 | Reload F5 → esito "C" persistito sul server | ✅ | 03/05/2026 | |
| 6 | Export Word — tabella checklist colori corretti | ✅ | 10/05/2026 | Colori corretti verificati da Mason |
| 7 | Riepilogo Word — contatori NC/OSS/OM/NV | ✅ | 10/05/2026 | Contatori verificati da Mason |

> **Sprint 9 (implementato / ingest v1 + AI strutturata opzionale)**: come sopra; analisi campi con **OpenAI** solo se `OPENAI_API_KEY` configurata (altrimenti 503). Deploy: migrazioni `038` + `039`, `npm install` backend (`pdf-parse`).  
> **Sprint 10 (implementato — 03/05/2026)**: collegare ingest v1 al **document registry** tramite staging tipizzato e commit esplicito (non confusione con workflow contratti).  
> **Sprint 11 (completato — 25/05/2026)**: riesame requisiti contratto / ciclo commerciale — `ContractReviewPage.jsx`, test L1 14/14; vedi [MINI_SPEC_RIESAME_REQUISITI_CONTRATTO.md](specs/MINI_SPEC_RIESAME_REQUISITI_CONTRATTO.md).
> **Sprint 11b (in corso — 14/06/2026)**: gap LM&CO/PT.MAIDO — distinzione committente commerciale vs azienda SGQ (capacità); migrazione **095** `commercial_customer_*`; contesto AI `buildReviewRequirementsContext` allineato. Slice 2 (RAG doc/qualifiche + FK committente opzionale): vedi [DEPUTYTASK.md](agent-tasks/DEPUTYTASK.md).

#### Backlog riesame requisiti (priorità post-analisi ERAM/LM&CO/PT.MAIDO)

| Priorità | Voce | Stato | Note |
|----------|------|-------|------|
| **P0** | Committente commerciale su `commercial_cases` + UI + contesto AI | ✅ | Migrazione 095; select controparti PR #230/#233 |
| **P0b** | **Checklist riesame personalizzabili per studio** (template prelim/finale) | 📋 Gap map | Hardcoded P1–P10/F1–F6 oggi → catalogo template org/studio; vedi [GAP_MAP_RIESAME_REQUISITI_CHECKLIST.md](specs/GAP_MAP_RIESAME_REQUISITI_CHECKLIST.md) |
| **P1** | RAG documenti/qualifiche per `company_id` in analisi capitolato | ⏳ Slice 2 | DEPUTYTASK R2.1–R2.2 |
| **P2** | Committente come record `companies` (FK opzionale) + audit 2° livello | ⏳ Slice 2–3 | ADR prima di schema |
| **P3** | Modellazione PT.MAIDO (cliente del cliente) multi-livello | ⏳ Backlog | Oltre pilota ordine diretto |
> **Sprint 12 (nuovo backlog tecnico)**: Office Round-trip editing desktop (Windows + Office) con infrastruttura nostra WebDAV/Helper — vedi [MINI_SPEC_OFFICE_ROUNDTRIP_WEBDAV.md](specs/MINI_SPEC_OFFICE_ROUNDTRIP_WEBDAV.md).

---

## Action Plan — Evoluzione futura (backlog 18/06/2026)

**Stato attuale (Slice 1-3 completate, in produzione):**
La pagina NC \u00e8 diventata un Piano Azioni multi-fonte con 7 categorie origine (audit, reclamo, rischi, riesame, miglioramento, operativo, esterno). Migration 098 deployata. PR #114.

### Backlog ordinato per priorit\u00e0

| Priorit\u00e0 | Voce | ISO ref | Note |
|----------|------|---------|------|
| **P1** | **Collegamento Reclami**: picker complaint nel form quando `source_category='complaint'`; mostra `source_complaint_number` nel dettaglio NC | \u00a78.2.1 | FK `source_complaint_id` gi\u00e0 esiste nel DB (migration 055); solo UI da collegare |
| **P1** | **Statistiche per categoria**: breakdown `source_category` nei contatori stats bar (badge separati per NC da audit vs azioni da riesame, ecc.) | \u00a79.1 | Estendere `getNonConformitiesStatistics` + card UI |
| **P2** | **Modulo Riesame di Direzione**: pagina dedicata `RiesameDirectionPage` con campi strutturati (partecipanti, punti ordine del giorno, output) che genera automaticamente azioni nel Piano Azioni | \u00a79.3 | Nuova tabella `management_reviews` + FK verso `action_plan_items` o NC |
| **P2** | **Registro Rischi \u2192 Piano Azioni**: generazione automatica azione `risk_action` quando un rischio/opportunit\u00e0 passa a `in_treatment` | \u00a76.1 | Link **manuale** già live (ROO-3). Auto-insert = HITL in [PLAN ROO-6](agent-tasks/PLAN_RISCHI_OPPORTUNITA_OBIETTIVI_SLICES.md) |
| **P3** | **Dashboard Action Plan**: vista aggregata cross-categoria con KPI (% azioni chiuse per categoria, trend mese, scadute per responsabile) | \u00a79.1 | Nuova sezione in Dashboard o tab dedicata in NCPage |
| **P3** | **Notifiche azioni non-audit**: il servizio `ncAlertEscalation` usa gi\u00e0 la tabella NC — verificare che le azioni da riesame/rischi ricevano promemoria scadenza | \u00a710.2 | Potrebbe funzionare gi\u00e0 — smoke test da fare |
| **P4** | **Export Word Action Plan**: template `.docx` separato per le azioni non legate ad audit (senza sezione checklist, con campo origine) | \u00a77.5 | Estendere `ncWordExport.js` |

---

## Rischi, Opportunità e Obiettivi — piano 07/07/2026 (SUPERATO il 14/08/2026)

> **Fonte unica ora**: [PLAN_RISCHI_OPPORTUNITA_OBIETTIVI_SLICES.md](agent-tasks/PLAN_RISCHI_OPPORTUNITA_OBIETTIVI_SLICES.md) + brief [DEPUTYTASK_RISCHI_ROO.md](agent-tasks/DEPUTYTASK_RISCHI_ROO.md).
>
> Le slice 1–3 di questa tabella sono **in `main`** (PR #279). Il modello a quattro tab è **catalogo**, non il processo. Fonte unica: [PLAN](agent-tasks/PLAN_RISCHI_OPPORTUNITA_OBIETTIVI_SLICES.md) (approccio ribaltato 14/08/2026, draft M03-R00).

**Gap analysis originale** (skill `gap-analysis-normativa`): il modulo `RisksPage` copriva già il §6.2 (Obiettivi con KPI), ma trattava §6.1 come solo "rischi" e non aveva registri §4.1/§4.2. Registri e `nature` ci sono; manca la **catena**.

**Ambiente TEST dedicato disponibile** (attivo dal 19/06/2026): DB `2026-06-18_SGQ_ISO9001` separato da produzione (`SGQ_ISO9001`), servizio `sgq-backend-test` (porta 3001), API `https://sistemi.fr-busato.it:8443/test-api/api/v1`, Netlify Deploy Preview per-PR punta gi\u00e0 in automatico al test-api. Regola agente: ogni migrazione/deploy backend va fatto **prima su TEST senza chiedere conferma** (pattern `run-migration-NNN-test-vps.js` + `deploy-to-vps-test.sh`), poi verificato via Deploy Preview + smoke, **poi** produzione solo dopo TEST OK o merge su `main`.

| Slice | Voce | ISO ref | Rischio tecnico | Stato |
|-------|------|---------|------------------|-------|
| **1 (P0)** | Campo `nature` (`risk`\|`opportunity`) su tabella `risks`, default `risk` (retrocompatibile); UI: selettore natura + trattamenti differenziati (rischio: Accetta/Mitiga/Trasferisci/Evita — opportunità: Persegui/Investi/Non perseguire, nota 2 §6.1.2) | §6.1 | Basso — solo `ALTER TABLE ADD COLUMN` con default | ✅ `nature` fatto (PR #279). Trattamenti opportunità → **ROO-5** |
| **2 (P1)** | Nuove tabelle `context_factors` (§4.1) e `interested_parties` (§4.2); tab Contesto; FK opzionale da `risks` (traccia §6.1.1) | §4.1, §4.2 | Medio | ✅ tabelle + tab fatti (PR #279, mig. 124). Cataloghi = opzionali (ROO-8), non il processo |
| **3 (P2)** | Collegamento Rischi/Opportunità ↔ Piano Azioni quando `status='in_treatment'`; opz. FK obiettivo ← rischio | §6.1, §10.2 | Medio | ✅ pulsante manuale + `source_risk_id` (PR #279, mig. 125). Auto + vista inversa → **ROO-6**. FK obiettivo → **ROO-8** |

Riferimento: `.cursor/skills/gap-analysis-normativa/`. Numerazione migrazioni: **non** usare 121 (già occupato). Sequenza in `database/migrations/` root; al 14/08/2026 ultimo noto `145`.

### Analisi architetturale conservata
Vedi sezione *Sessione 18/06/2026* in `docs/GUIDA_CONSOLIDATA.md` per pattern SQL, RBAC e considerazioni su source_type vs source_category.



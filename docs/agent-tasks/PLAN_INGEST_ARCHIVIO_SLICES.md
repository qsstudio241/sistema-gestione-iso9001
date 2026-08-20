# Piano slice — Ingest massivo archivio (Import PDF → albero → moduli)

> **Destinazione**: screening in background da cartella radice. Lo screening sceglie prima la **stanza** (studio / azienda / commessa), poi lo **scaffale**. Un file = una copia, visibile da due viste se è di commessa. Specialisti già in repo lavorano in parallelo. Primo verticale: documenti di commessa → stanza Riesame + cassetto azienda `2.2`. Review = coda incompleti. Learning = ADR-017.
> **Spec già in repo (non rifare)**: [`MODULO_INGEST_AI_COMMESSE_SCOPO_E_ROADMAP.md`](../specs/MODULO_INGEST_AI_COMMESSE_SCOPO_E_ROADMAP.md) (analisi sul caso, slice #5–#7 già fatte) · [`MINI_SPEC_RIESAME_REQUISITI_CONTRATTO.md`](../specs/MINI_SPEC_RIESAME_REQUISITI_CONTRATTO.md) · albero in mig. 059/076 · ADR-010 HITL
> **Brief attivo**: [`DEPUTYTASK.md`](DEPUTYTASK.md) — **IA-5** (screening + posa). IA-4 in `main` (#506/#507).
> **Mappa creata**: 20/08/2026 (Lead wayfinder A). Codice da IA-1 in poi.

---

## Cosa fa oggi Import PDF (sintesi per il committente)

Il modulo vive in **GESTIONE → Impostazioni → Import PDF** (`/settings/import-jobs`). Licenza `ai_import`, solo **admin**.

Flusso attuale, un job alla volta:

1. **Crea job** — titolo, azienda opzionale, tipo documento opzionale (suggerimento per l’AI).
2. **Carica PDF o cartella** — massimo **80 file**, solo `.pdf`, fino a 200 MB l’uno. «Carica cartella» tiene i path delle sottocartelle in `original_name`. I file finiscono sul server in `uploads/imports/{organizzazione}/{job}/`.
3. **Elabora** — estrae il testo dal PDF (`pdf-parse`). Se il PDF è una scansione senza testo, la confidence è bassa. L’OCR **esiste già** in altri moduli (`ocrExtractor` / `documentTextExtractor`, SAL S1a) ma **non è collegato** a questa pagina.
4. **Analisi AI** (pulsante, non automatica) — propone tipo documento e campi (codice, date, titolo, …). L’operatore può correggere.
5. **Commit a mano**, tre uscite diverse:
   - **Commit al Registry** — crea una riga nel registro documenti. **Solo le norme** (`doc_type=norma`) vengono messe nella cartella **2.3 NORME E LEGGI**. Tutti gli altri tipi restano **senza cartella** (`parent_id` vuoto): sono nell’archivio ma **non sotto Procedure / Capitolati / Scadenzario**.
   - **Commit a Qualifica** — patentino / NDT → anagrafica qualifiche (subito attiva).
   - **Crea caso Riesame** — apre un caso commerciale (`commercial_cases`) collegato a quel PDF. Non popola l’albero documentale.

Limite duro rispetto alla tua visione: **non esiste una scansione di cartella**. L’utente deve scegliere i PDF dal browser. Il server **non può leggere** `C:\Studio\Documenti` del PC dello studio (il browser lo vieta). «Percorso fornito dall’utente» va inteso come: *tu indichi l’archivio, l’app lo riceve e lo classifica* — non come *il server apre il disco del PC*.

---

## Perché non si riparte da zero

Già in produzione e da **riusare**, non duplicare:

| Pezzo | Dove | Ruolo in questa epic |
|---|---|---|
| Job + file + revisione umana | `import_jobs` / `import_job_files`, `ImportJobsPage.jsx` | Stesso contenitore del job massivo |
| Pipeline testo + AI + learning | `documentIngestPipeline`, `documentTypeSchemas`, ADR-017 | Classificare procedura / norma / capitolato |
| Albero SGQ con `folder_code` | template 059 / `sgq_3834_v1` (076) | Destinazione «directory corretta» |
| Placement norme | `resolveNormFolderId` → cartella `2.3` | Da **generalizzare** a tutti i tipi |
| Riesame da job | `POST /contract-reviews/import-from-job` | Ponte file → caso commessa |
| Analisi requisiti sul caso | `caseDocumentAnalysis.service.js`, persistenza `source='text'` | Già fatta (luglio 2026) — si **alimenta**, non si rifà |
| OCR PDF | `ocrExtractor` + `documentTextExtractor` (S1a) | Collegare all’import, non un secondo motore |
| SAL «documento mancante» | [`PLAN_SAL_AI_EVIDENCE_SLICES.md`](PLAN_SAL_AI_EVIDENCE_SLICES.md) S2a/S2b | Dopo che il registro ha i file |

---

## Strategia (due velocità + coda incompleti)

Decisione committente 20/08/2026: **cartella radice con sottocartelle**; lo screening può girare **in background sul server**; in questo step conta **allocare bene**; la review umana è **se necessario**, come i campi nuovi delle qualifiche lasciati vuoti e segnalati all’admin.

```
Cartella radice (N sottocartelle)  — picker browser
        │
        ▼
Upload albero relativo sul server (uploads/imports/…)
        │
        ▼
[screening veloce, coda]  nome + path + prime pagine / OCR corto
        → doc_type + folder_code
        → riga registro già nella cartella giusta
        → stato ai_draft / da_verificare, campi vuoti OK
        │
        ├──► [specialista in parallelo]  patentino → qualificationIngest
        ├──►                         wpqr → wpqrIngest
        ├──►                         norma → normIngest
        ├──►                         capitolato → caso Riesame + caseDocumentAnalysis
        └──►                         procedura / altro → solo registro + coda
        │
        ▼
Coda admin «da completare» (tipo, cartella, campi vuoti, confidence)
        │  correzione umana
        ▼
ADR-017 (feedback org + pattern)  → i job successivi sbagliano di meno
```

**Due velocità (non due motori)**

| Velocità | Cosa decide | Cosa non fa |
|---|---|---|
| **Screening** (questo step) | Di che tipo è, in quale cartella sta | Non riempie più di 2–3 indizi (titolo, codice se ovvio) |
| **Specialista** (subordinato) | Campi del modulo (qualifica, WPQR, requisiti commessa) | Non riclassifica se lo screening è già confermato / ad alta confidence |

**Allocare ≠ certificare.** Mettere il PDF sotto `1.2 PROCEDURE` è un atto di catalogo. Dire «questa procedura è conforme» o «il riesame è chiuso» resta HITL.

**Coda incompleti (pattern già visto)**  
Come `commitToQualification` che **crea la bozza** anche se mancano processo/materiale/scadenza (solo `warnings`, non blocco), e come il profilo azienda `incompleto` / `parziale` / `pronto`: il primo carico massivo **nasce vuoto di metadati**. L’admin non sta fermo al click su ogni file: vede «47 capitolati in 2.2, 12 senza titolo; 8 patentini bozza». Prende in carico i rossi. I verdi (tipo + cartella chiari) restano in coda bassa priorità.

**Orchestratore — sì, ma router, non un secondo cervello LLM**  
Allineato ad ADR-010 e alla spec commesse (FASE 3): v1 = `switch(doc_type)` deterministico che **chiama i service già esistenti** (`qualificationIngest`, `wpqrIngest`, `normIngest`, `caseDocumentAnalysis`). Parallelo = coda job sul server (N file / N tipi insieme). Un LLM che «sceglie gli agenti» arriva solo se il router regge (stessa prudenza della spec commesse FASE 5). Non si installa un harness Cursor dentro l’app.

**Apprendimento**  
Non si addestra un modello. Le correzioni di cartella/tipo/campi vanno in `import_extraction_feedback` + pattern ADR-017 (già fatti in IG-4/IG-5). Il job massivo n. 2 dello stesso studio deve riusare quei few-shot. Niente seconda «skill» parallela.

**Regola di scalabilità**: un tipo nuovo = riga `doc_type → folder_code` + (se serve) schema + un `case` nel router verso lo specialista. Zero pipeline nuova.

### Mappa tipo → cartella (proposta Lead, da usare in IA-1)

Allineata al template già provisionato sulle aziende (codici 059/076):

| `doc_type` oggi | Cartella (`folder_code`) | Titolo albero |
|---|---|---|
| `manuale` | `1.1` | MANUALE |
| `procedura` | `1.2` | PROCEDURE |
| `istruzione` | `1.3` | ISTRUZIONI |
| `modulo` | `1.4` | MODULI |
| `norma` | `2.3` | NORME E LEGGI (già fatto) |
| `cert_*`, `dichiarazione_ce` | `2.1` | CERTIFICATI |
| `wps`, `wpqr` | `9.1` | WPS / WPQR (solo se albero 3834) |
| `report_ndt`, `rdp` | `9.3` | CND |
| `patentino_saldatore`, `qualifica_*`, `cert_ndt` | `4.5` o commit-to-qualification (già esiste) | QUALIFICHE SALDATORI |
| `altro` senza hint | — | resta senza cartella (come oggi) |

**Primo verticale commessa** (IA-2 / IA-6, non IA-1): tipo `capitolato` (poi `ordine` / `rfq`) → **cassetto azienda `2.2`** *e* **stanza commessa** (caso Riesame + scaffale `capitolato` / `drawing` / `order`). Non è il Riesame di direzione (scaffale azienda `14`).

---

## Stanze e scaffali (decisione architetturale — 20/08, da non rinviare)

Concordato col committente: **non è un solo armadio**. Lo screening sbaglia se confonde le stanze.

| Stanza | Cos’è oggi in app | Scaffali | Chi la vede |
|---|---|---|---|
| **Studio** | Albero `content_scope=studio`, `company_id` vuoto, radice `STD` | Patrimonio dello studio (modelli, know-how) | Solo lo studio, mai il cliente |
| **Azienda** | Albero SGQ per `company_id` (template 059/076) | Procedure, Manuale, Norme, Capitolati, Scadenzario, … | Studio + quell’azienda |
| **Commessa (riesame)** | `commercial_cases` + allegati + link al registro | **Altri** scaffali: da cliente (RFQ, capitolato, disegno), offerta, ordine | Chi lavora quel caso |
| **Commessa produzione** (non mescolare) | `projects` ISO 3834 (saldatori, WPS) | Non è un albero documentale | Dopo handoff del riesame |

**Regole vincolanti**

1. **Un file, una copia.** Niente PDF duplicato in azienda e in commessa. La commessa *punta* al record (`commercial_case_documents`), non lo ricopia.
2. **Due viste.** Stesso capitolato: nello scaffale azienda `2.2` *e* nello scaffale commessa «da cliente». Cambi il file una volta.
3. **Scaffali diversi.** In commessa non si ricreano Procedure/Manuale/Norme. Quelli restano nella stanza azienda. In commessa: ruolo (`capitolato`, `drawing`, `order`, …) già usato da `caseDocumentAnalysis`.
4. **Prima la stanza, poi lo scaffale.** Screening: studio vs azienda X vs commessa (sottocartella `Rossi-2024`) → poi tipo → poi specialista.
5. **«Commessa» ≠ «progetto 3834».** Finché il riesame non è handoff, i file stanno sul caso commerciale. Non si inventa un quarto albero su `projects`.

IA-1 tocca **solo scaffali della stanza azienda** (chiudere il buco: procedura → PROCEDURE). La stanza commessa si allestisce da IA-2/IA-6.

### Scalabilità sui documenti di commessa (risposta 20/08)

**Sì, il processo scala sulle commesse** — è il primo verticale apposta. «Scalabile» qui non vuol dire «un click e 10 anni di archivio sono perfetti». Vuol dire: stessa macchina per 1 commessa o 80, senza un modulo nuovo.

| Asse | Perché scala | Limite onesto |
|---|---|---|
| **Molte commesse** | Ogni sottocartella (`Rossi-2024/…`, `Bianchi-2025/…`) è un indizio: screening raggruppa, specialista apre/aggancia **un caso Riesame per gruppo** | Oggi `import-from-job` fa **un caso** da file scelti a mano, max **80 PDF** a job. IA-5 spezza in coda. |
| **File diversi nella stessa commessa** | Router per tipo: capitolato → analisi già esistente; disegno → vision già esistente; ordine → stesso caso. Parallelo = coda, non un LLM-capo | Lo screening deve restare **leggero** (path + nome + poco testo). Vision/analisi piena solo sullo specialista, o i costi esplodono. |
| **Dove stanno i file** | Cartella `2.2` = cassetto SGQ; il **caso Riesame** è il faldone della commessa (allegati + requisiti). I due si legano (IA-6) | Un solo cassetto `2.2` per 200 commesse diventa illeggibile. Raggruppare per sottocartella/caso; sottocartelle in albero = nebbia, non bloccante. |
| **Job successivi** | Correzioni → ADR-017: il secondo carico dello stesso studio classifica meglio gli RFQ | Non si addestra un modello; si accumulano esempi. |

**Non scala** (e non è questo processo): chiudere da solo il riesame, marcare evidenze SAL, o analizzare in profondità ogni PDF allo screening.

**Scadenzario** (cartella `99`): non ci si butta il PDF. Lo scadenzario legge `expiry_date` sul documento già in `1.x` / `2.x`. Slice dedicata dopo il verticale commessa.

---

## Fuori scope

- Il server che apre un path arbitrario sul PC dello studio (`C:\…`) o sul VPS fuori da `uploads/` — rischio sicurezza Alto
- Auto-chiusura di un Riesame / auto-link evidenza SAL / auto-approvazione qualifica (la **bozza** e l’**allocazione in cartella** sì; lo stato «confermato» no)
- Orchestratore LLM che sceglie i tool da solo (v1 = router `doc_type`)
- Secondo anello di learning fuori da ADR-017
- Fine-tuning / secondo motore OCR / seconda pipeline AI
- WebDAV come canale di ingest (altro epic, PoC storico)
- Excel BOM, DWG/STEP, `.doc` binario
- Sottocartella per ogni commessa sotto 2.2 (nebbia)
- Rifare `caseDocumentAnalysis` / checklist §8.2 / coverage WPS (già in produzione)
- Eseguire SAL S1b / MC-I4 / ISO-4 in questa epic
- Aggiornare GUIDA / roadmap § Stato attuale in questa PR (PR docs aperte #502/#504)

---

## Non ancora specificato

- Sottoalbero in **albero azienda** `2.2/Rossi-2024` oltre al caso — utile in vetrina SGQ, non obbligatorio se la stanza commessa (caso + ruoli) è solida
- Quanti file restano solo in stanza commessa (allegato caso) senza riga in registro azienda — default proposto: **sempre anche registro** (una copia, due viste)
- Tipo unico `capitolato` vs `capitolato` / `rfq` / `ordine` — in IA-2 dopo 3–5 PDF reali
- Soglia screening: sotto quale confidence il file resta in `Inbox/da_classificare` invece di 2.2/1.2 — dopo un job reale
- Quanti specialisti in parallelo sul VPS (limite costi AI / CPU OCR) — default prudente (es. 2–3) da misurare
- Picker browser vs copia sul VPS per archivi da decine di GB — solo se Chrome non regge l’upload
- Patrimonio Studio (`STD`) vs solo albero azienda
- Mapping clausola SAL → tipo (nebbia piano SAL S2a)

---

## Decisioni già prese (Lead + committente 20/08/2026)

- **Non un modulo nuovo**: si estende Import PDF + albero + specialisti già esistenti.
- **Sorgente = cartella radice + sottocartelle** (picker). ZIP è piano B, non il default. Il server non legge `C:\` del PC: riceve l’albero e poi lavora in background.
- **Questo step = allocare**: screening tipo + cartella; i campi possono restare vuoti.
- **Review = coda incompleti**, non un cancello su ogni file. Stesso spirito della bozza qualifica con `warnings` e dei campi nuovi lasciati da prendere in carico.
- **Orchestratore v1 = router `doc_type`** verso service già in repo; parallelo = coda server. Non un LLM-capo.
- **Learning = ADR-017** (feedback + few-shot). Il job massivo addestra il successivo, non un modello nuovo.
- **Placement prima della massa**: IA-1 resta la prima slice (senza mapper, lo screening non ha dove mettere i file).
- **Stanze distinte (ora)**: studio / azienda / commessa riesame. Un file, una copia, due viste. Scaffali commessa ≠ scaffali SGQ. `projects` 3834 non è la stanza documentale.
- **Primo verticale = stanza commessa** + cassetto azienda `2.2`. Procedure/norme = stesso screening, stanza azienda.
- **OCR**: riuso S1a, non un secondo motore.
- **Analisi commessa**: non rifare slice #5–#7 — si agganciano dopo l’allocazione in 2.2.

---

## Mappa slice

| Slice | Tema | Perimetro (file/layer) | Dipende da | Tipo |
|-------|------|------------------------|------------|------|
| **IA-1** | Un PDF «Procedura» finisce nella cartella PROCEDURE (oggi solo le norme hanno una cartella) | `documentTreeProvisioner` + `importJobs.controller` `commitToRegistry` + test; **non** UI nuova | — | AFK |
| **IA-2** | Verticale commessa: tipo `capitolato` → cartella `2.2` ✅ | `documentTypes.js`, mappe FE/BE, commit; **non** nuovo caso Riesame | IA-1 | AFK |
| **IA-3** | Preview scaffale nel dialog commit ✅ | `ImportJobsPage.jsx` + `getSuggestedFolderLabel`; override resta `parent_folder_id` API | IA-1 | AFK |
| **IA-4** | Sorgente: cartella radice + path relativo (in `original_name`, no colonna) ✅ | picker `webkitdirectory`, upload albero, path sanitizzato; limite 80; **non** ZIP; screening = IA-5 | IA-1 | AFK |
| **IA-5** | Screening veloce + posa (pulsante, path+nome+testo) | `importScreening` + `POST …/screen-and-place`; auto-posa solo high+azienda+non-qualifica; coda incompleti = IA-5b | IA-1, IA-4 | AFK |
| **IA-5b** | Coda admin «da completare» | lista filtrata incompleti (tipo/cartella/campi), badge come profilo/qualifiche; non blocca lo screening | IA-5 | AFK |
| **IA-6** | Ponte 2.2 → caso Riesame (batch) | riuso `import-from-job` su N file capitolato dello stesso job/cartella relativa | IA-2, IA-5 | AFK |
| **IA-7** | Dopo il ponte: lanciare analisi già esistente | `analyze-documents` / `analyzeRequirements` persistito — **solo hook**, no nuovo motore | IA-6 | AFK |
| **IA-8** | OCR sull’import job (riuso S1a) | `processJob` / extract: se testo sotto soglia → `ocrExtractor` | IA-1 (stesso job, dopo o in parallelo a IA-2/3 se file disgiunti) | AFK |
| **IA-9** | Candidati evidenza SAL dai doc importati | non scrivere `evidence_document_ids`; allinea a SAL S2a/S2b | IA-5 + SAL S2a | AFK |
| **IA-10** | Scadenze da `expiry_date` (norme/cert/procedure) | niente dump in cartella `99`; hook scadenzario esistente | IA-5 | AFK |

**Ordine**: IA-1 → IA-2 (tipo capitolato) e IA-3 (preview un file) → IA-4 (picker cartella) → IA-5 (screening+alloca) → IA-5b (coda) → IA-6 → IA-7. IA-8 (OCR) può entrare in IA-5 se lo screening vede PDF senza testo. IA-9/10 dopo che il registro ha massa.

**Parallelo**: non due brief aperti su `importJobs.controller.js`. IA-3 (solo FE) può stare in `DEPUTYTASK1.md` **dopo** merge IA-1.

---

## Specialisti (oggi / previsti)

Non sono agenti Cursor. Sono **destinazioni** già in codice che il router chiama dopo stanza+tipo. Motore comune (non specialista): `documentIngestPipeline`, OCR, ADR-017.

| # | Specialista oggi | Destinazione | Stanza |
|---|---|---|---|
| 1 | `qualificationIngest` | Qualifiche (patentino, 14732, 14731, NDT, PES/PAV) | Azienda |
| 2 | `wpqrIngest` | WPQR | Azienda |
| 3 | `wpsIngest` | WPS | Azienda |
| 4 | `normIngest` | Norme + cartella `2.3` | Azienda (o studio se patrimonio) |
| 5 | `figureIngest` | Tavole/figure da PDF norma | Stessa della norma |
| 6 | `caseTextAnalysis` | Requisiti da capitolato/ordine | **Commessa** |
| 7 | `drawingExtraction` | Requisiti da disegno (vision) | **Commessa** |
| 8 | Estrai certificato 3.1 (MC) | Materiali | Azienda |
| 9 | `commitToRegistry` | Registro generico (catch-all) | Azienda / studio |

`caseDocumentAnalysis` è già il mini-router di **6+7**, non un decimo cervello.

| Previsti in questa epic | Cosa fa | Non è |
|---|---|---|
| **10. Allestitore stanza commessa** (IA-6, soprattutto deterministico) | Sottocartella → un caso + ruolo scaffale; collega il file già in registro | Nuovo LLM |
| Tipi `capitolato` / `ordine` / `rfq` | Alimentano 6 e 10 | Nuovo motore |

**Non aprire ora** (consumatori, non ingest): SAL evidenze (S2a), welding suggest, obblighi legali, verbale RDP, «specialista procedure» (basta 9 + schema).

**Ordine di crescita**: 9 sistemato (IA-1) → 10 + tipi commessa → gli altri si accendono da soli quando lo screening dice il tipo. Non si progettano 20 agenti.

---

## Dettaglio slice IA-1 (prima eseguibile)

**Non è una domanda al committente.** È il primo pezzo di codice: oggi il registro ha già le cartelle (Procedure, Manuale, Norme…), ma Import PDF ci mette dentro **solo le norme**. Tutto il resto finisce «in mezzo», senza cartella. IA-1 insegna all’app: *se è una procedura → cartella Procedure; se è un manuale → cartella Manuale;* ecc. Senza questo, lo screening massivo non sa dove posare i file.

**In parole povere (prima / dopo)**

- **Oggi:** importi `PG-04 Gestione commesse.pdf`, lo segni come Procedura, fai Commit al Registry → il file è nel registro ma **non** sotto «PROCEDURE». Lo trovi solo cercandolo.
- **Dopo IA-1:** stessa azione → il file compare **dentro** la cartella PROCEDURE dell’azienda (come già succede per una norma in NORME E LEGGI).
- **Tu non devi scegliere nulla** per questa slice. La fai un deputy. Tu vedi il risultato: un PDF di prova nella cartella giusta.

**Obiettivo verificabile**: un PDF già estratto, salvato come procedura (o manuale / istruzione), compare nel registro **sotto la cartella** Procedure / Manuale / Istruzioni dell’azienda. Una norma continua ad andare in Norme. Se la cartella manca → errore chiaro, niente riga orfana.

**DoD**

- [x] Helper unico `resolveFolderByCode(orgId, folderCode, companyId)` (stesso criterio di `resolveNormFolderId`: cartella `doc_type='folder'`, scope org + azienda)
- [x] Mappa statica `doc_type → folder_code` (tabella sopra, senza tipi nuovi)
- [x] `commitToRegistry` imposta `parent_id` + `path_cache` per tutti i tipi mappati, non solo `norma`
- [x] `altro` senza override resta `parent_id` null (comportamento attuale)
- [x] Override esplicito `parent_folder_id` nel body resta valido (`resolveExplicitFolder`)
- [x] Test L1: mappa + commit con cartella trovata / mancante / norma invariata (26 verdi)
- [x] Nessuna UI nuova; nessuna migrazione; nessun tipo `capitolato` (è IA-2)

**File previsti**

- `backend/src/services/documentTreeProvisioner.service.js`
- `backend/src/services/documentTreeProvisioner.studio.test.js` e/o nuovo test accanto
- `backend/src/controllers/importJobs.controller.js`
- `backend/src/controllers/importJobs.controller.test.js`
- questo PLAN (spuntare DoD)

**Cosa NON toccare**

- `ImportJobsPage.jsx` / CSS (IA-3)
- `documentTypes.js` / schemi AI (IA-2)
- `contractReview.controller.js` / `caseDocumentAnalysis.service.js`
- `ocrExtractor.js` / `documentTextExtractor.service.js` (IA-8 / SAL S1b)
- `ingestStaging.controller.js`, Material Compliance, SAL UI
- GUIDA, roadmap § Stato attuale, `PROJECT_CONTEXT.md`
- migrazioni SQL

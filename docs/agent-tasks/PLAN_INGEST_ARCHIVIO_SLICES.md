# Piano slice — Ingest massivo archivio (Import PDF → albero → moduli)

> **Destinazione**: un admin sceglie una **cartella radice** (con N sottocartelle); il server fa **screening in background** (tipo + cartella albero) e **alloca** i file. I metadati restano vuoti/`da_verificare` in una **coda admin** (stesso spirito dei campi qualifiche aggiunti e lasciati da completare). Gli specialisti ingest già in repo partono in parallelo per tipo. Il primo verticale è **capitolato → 2.2 → Riesame**. Le correzioni alimentano ADR-017 per i job successivi.
> **Spec già in repo (non rifare)**: [`MODULO_INGEST_AI_COMMESSE_SCOPO_E_ROADMAP.md`](../specs/MODULO_INGEST_AI_COMMESSE_SCOPO_E_ROADMAP.md) (analisi sul caso, slice #5–#7 già fatte) · [`MINI_SPEC_RIESAME_REQUISITI_CONTRATTO.md`](../specs/MINI_SPEC_RIESAME_REQUISITI_CONTRATTO.md) · albero in mig. 059/076 · ADR-010 HITL
> **Brief attivo**: [`DEPUTYTASK.md`](DEPUTYTASK.md) — slice **IA-1** (APERTO)
> **Mappa creata**: 20/08/2026 (Lead wayfinder A — Chart the map; **nessun codice applicativo** in questa sessione)

---

## Cosa fa oggi Import PDF (sintesi per il committente)

Il modulo vive in **GESTIONE → Impostazioni → Import PDF** (`/settings/import-jobs`). Licenza `ai_import`, solo **admin**.

Flusso attuale, un job alla volta:

1. **Crea job** — titolo, azienda opzionale, tipo documento opzionale (suggerimento per l’AI).
2. **Carica PDF** — massimo **30 file**, solo `.pdf`, fino a 200 MB l’uno. I file finiscono sul server in `uploads/imports/{organizzazione}/{job}/`.
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

**Primo verticale commessa** (IA-2, non IA-1): nuovo tipo `capitolato` (e in seguito `ordine` / `rfq` se servono) → cartella **`2.2` CAPITOLATI**. Poi si riusa «Crea caso Riesame». Non è il Riesame di direzione (cartella `14`).

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

- Sottocartella per commessa sotto `2.2` (es. `2.2/{codice-commessa}`) vs un unico cassetto Capitolati — il path relativo (`Commessa-Rossi/…`) è un indizio, non ancora una cartella nuova
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
- **Primo verticale = commesse / riesame** (`2.2`). Procedure/norme/scadenze = stesso motore, dopo.
- **OCR**: riuso S1a, non un secondo motore.
- **Analisi commessa**: non rifare slice #5–#7 — si agganciano dopo l’allocazione in 2.2.

---

## Mappa slice

| Slice | Tema | Perimetro (file/layer) | Dipende da | Tipo |
|-------|------|------------------------|------------|------|
| **IA-1** | Un PDF «Procedura» finisce nella cartella PROCEDURE (oggi solo le norme hanno una cartella) | `documentTreeProvisioner` + `importJobs.controller` `commitToRegistry` + test; **non** UI nuova | — | AFK |
| **IA-2** | Verticale commessa: tipo `capitolato` → cartella `2.2` | `documentTypes.js` (FE; mirror se esiste), mappa, commit; **non** nuovo caso Riesame | IA-1 | AFK |
| **IA-3** | Preview / override cartella su un file (debug) | `ImportJobsPage.jsx`: mostra cartella proposta; serve per IA-1 prima della massa | IA-1 | AFK |
| **IA-4** | Sorgente: cartella radice + `relative_path` | picker `webkitdirectory`, upload albero, path relativo in `import_job_files`; job passa in coda server; **non** ZIP di default | IA-1 | AFK |
| **IA-5** | Screening veloce in background + allocazione | classifica tipo (path+nome+testo corto) → `commitToRegistry` in cartella; stato `ai_draft`/`da_verificare`; campi vuoti OK | IA-1, IA-4 | AFK |
| **IA-5b** | Coda admin «da completare» | lista filtrata incompleti (tipo/cartella/campi), badge come profilo/qualifiche; non blocca lo screening | IA-5 | AFK |
| **IA-6** | Ponte 2.2 → caso Riesame (batch) | riuso `import-from-job` su N file capitolato dello stesso job/cartella relativa | IA-2, IA-5 | AFK |
| **IA-7** | Dopo il ponte: lanciare analisi già esistente | `analyze-documents` / `analyzeRequirements` persistito — **solo hook**, no nuovo motore | IA-6 | AFK |
| **IA-8** | OCR sull’import job (riuso S1a) | `processJob` / extract: se testo sotto soglia → `ocrExtractor` | IA-1 (stesso job, dopo o in parallelo a IA-2/3 se file disgiunti) | AFK |
| **IA-9** | Candidati evidenza SAL dai doc importati | non scrivere `evidence_document_ids`; allinea a SAL S2a/S2b | IA-5 + SAL S2a | AFK |
| **IA-10** | Scadenze da `expiry_date` (norme/cert/procedure) | niente dump in cartella `99`; hook scadenzario esistente | IA-5 | AFK |

**Ordine**: IA-1 → IA-2 (tipo capitolato) e IA-3 (preview un file) → IA-4 (picker cartella) → IA-5 (screening+alloca) → IA-5b (coda) → IA-6 → IA-7. IA-8 (OCR) può entrare in IA-5 se lo screening vede PDF senza testo. IA-9/10 dopo che il registro ha massa.

**Parallelo**: non due brief aperti su `importJobs.controller.js`. IA-3 (solo FE) può stare in `DEPUTYTASK1.md` **dopo** merge IA-1.

---

## Dettaglio slice IA-1 (prima eseguibile)

**Non è una domanda al committente.** È il primo pezzo di codice: oggi il registro ha già le cartelle (Procedure, Manuale, Norme…), ma Import PDF ci mette dentro **solo le norme**. Tutto il resto finisce «in mezzo», senza cartella. IA-1 insegna all’app: *se è una procedura → cartella Procedure; se è un manuale → cartella Manuale;* ecc. Senza questo, lo screening massivo non sa dove posare i file.

**In parole povere (prima / dopo)**

- **Oggi:** importi `PG-04 Gestione commesse.pdf`, lo segni come Procedura, fai Commit al Registry → il file è nel registro ma **non** sotto «PROCEDURE». Lo trovi solo cercandolo.
- **Dopo IA-1:** stessa azione → il file compare **dentro** la cartella PROCEDURE dell’azienda (come già succede per una norma in NORME E LEGGI).
- **Tu non devi scegliere nulla** per questa slice. La fai un deputy. Tu vedi il risultato: un PDF di prova nella cartella giusta.

**Obiettivo verificabile**: un PDF già estratto, salvato come procedura (o manuale / istruzione), compare nel registro **sotto la cartella** Procedure / Manuale / Istruzioni dell’azienda. Una norma continua ad andare in Norme. Se la cartella manca → errore chiaro, niente riga orfana.

**DoD**

- [ ] Helper unico `resolveFolderByCode(orgId, folderCode, companyId)` (stesso criterio di `resolveNormFolderId`: cartella `doc_type='folder'`, scope org + azienda)
- [ ] Mappa statica `doc_type → folder_code` (tabella sopra, senza tipi nuovi)
- [ ] `commitToRegistry` imposta `parent_id` + `path_cache` per tutti i tipi mappati, non solo `norma`
- [ ] `altro` senza override resta `parent_id` null (comportamento attuale)
- [ ] Override esplicito `parent_folder_id` nel body resta valido
- [ ] Test L1: mappa + commit con cartella trovata / mancante / norma invariata
- [ ] Nessuna UI nuova; nessuna migrazione; nessun tipo `capitolato` (è IA-2)

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

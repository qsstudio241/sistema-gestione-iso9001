# Piano slice — Ingest massivo archivio (Import PDF → albero → moduli)

> **Destinazione**: un admin sceglie un **archivio locale** (cartella o ZIP); l’app elenca i file, propone tipo + cartella dell’albero SGQ, e dopo conferma umana i documenti finiscono nel registro **nella directory giusta**. Il primo percorso verticale è **capitolato / ordine / RFQ → cartella 2.2 CAPITOLATI → caso Riesame requisiti → analisi già esistente**, così SAL e gli assistenti trovano evidenze invece di un registro vuoto.
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

## Strategia (scalabile, primo verticale = commesse / riesame)

```
Archivio locale (cartella o ZIP)
        │
        ▼
[IA-4] Sorgente: il browser invia i file + il percorso relativo
        (es. Commessa-2024-Rossi/RFQ/capitolato.pdf)
        │
        ▼
[IA-1/2] Classifica tipo + propone cartella albero (folder_code)
        │
        ▼
[IA-3/5] Revisione umana per gruppi (non file-per-file su 500 PDF)
        │
        ├──► Registro documenti nella cartella giusta
        ├──► (se capitolato/RFQ/ordine) caso Riesame + analisi già esistente
        └──► (dopo) scadenze da expiry_date · candidati evidenza SAL
```

**Regola di scalabilità**: un tipo documento nuovo = una riga nella mappa `doc_type → folder_code` + (se serve) uno schema in `documentTypeSchemas.js`. Stesso motore. Niente pipeline parallela per «procedure» vs «commesse» vs «norme».

**Regola HITL (ADR-010)**: l’AI propone, l’umano conferma. Nessun commit automatico nel registro, nessun caso Riesame creato da solo, nessun collegamento evidenza SAL da solo. Su un archivio grosso la conferma è **per gruppo** (tutti i file proposti come «Procedura → 1.2»), non un click per file.

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
- Commit automatico senza conferma, anche con confidence alta
- Fine-tuning / secondo motore OCR / seconda pipeline AI
- WebDAV come canale di ingest (altro epic, PoC storico)
- Excel BOM, DWG/STEP, `.doc` binario
- Sottocartella per ogni commessa sotto 2.2 (nebbia)
- Rifare `caseDocumentAnalysis` / checklist §8.2 / coverage WPS (già in produzione)
- Eseguire SAL S1b / MC-I4 / ISO-4 in questa epic
- Aggiornare GUIDA / roadmap § Stato attuale in questa PR (PR docs aperte #502/#504)

---

## Non ancora specificato

- Sottocartella per commessa sotto `2.2` (es. `2.2/{codice-commessa}`) vs tutti i capitolati in un unico cassetto
- Tipo unico `capitolato` vs tre tipi `capitolato` / `rfq` / `ordine` — decidere in IA-2 dopo 3–5 PDF reali
- Job one-shot da migliaia di file: coda a pezzi (es. 50 alla volta) vs un job solo — dopo IA-4 su un archivio vero
- Copia preventiva sul VPS (`uploads/archive-ingest/{org}/`) per archivi da decine di GB — solo se il picker/ZIP non basta
- Stesso ingest sul **Patrimonio Studio** (`folder_code STD`) vs solo albero azienda — dopo IA-1 stabile
- Mapping clausola SAL → tipo documento (già nebbia in piano SAL S2a): questa epic **prepara i file**, non scrive le evidenze

---

## Decisioni già prese (questa sessione Lead)

- **Non un modulo nuovo**: si estende Import PDF + albero + ponti già esistenti.
- **«Percorso» = percorso relativo dentro l’archivio scelto** (es. `Commessa Rossi/02-Capitolato/file.pdf`), più un picker/ZIP nel browser. Il server non legge il disco del PC.
- **Placement in albero prima della scansione massiva**: oggi manca il pezzo «metti nella cartella giusta». Senza quello, importare 200 file produce un mucchio piatto.
- **Primo verticale = riesame requisiti / commesse** (cartella 2.2 + caso Riesame). Procedure, norme, scadenze sono **lo stesso motore**, slice dopo.
- **Conferma umana obbligatoria**; su volumi grandi = conferma per gruppo.
- **OCR**: collegare quello già in repo, non inventarne uno.
- **Analisi commessa**: non rifare le slice #5–#7 di `MODULO_INGEST_AI_COMMESSE` — si alimentano dopo che i file sono in 2.2.

### HITL prodotto (una domanda, non blocca IA-1)

Quando arriveremo a IA-4 (primo job reale): preferisci **selezionare una cartella dal browser** (Chrome) o **caricare uno ZIP**? Entrambe restano nel piano. IA-1 non serve questa risposta.

---

## Mappa slice

| Slice | Tema | Perimetro (file/layer) | Dipende da | Tipo |
|-------|------|------------------------|------------|------|
| **IA-1** | Hello world: tipo → cartella albero al commit Registry | `documentTreeProvisioner` + `importJobs.controller` `commitToRegistry` + test; **non** UI nuova | — | AFK |
| **IA-2** | Verticale commessa: tipo `capitolato` → cartella `2.2` | `documentTypes.js` (FE; mirror se esiste), mappa, commit; **non** nuovo caso Riesame | IA-1 | AFK |
| **IA-3** | Preview cartella prima del commit (un file) | `ImportJobsPage.jsx` dialog commit: mostra cartella proposta, override umano | IA-1 | AFK |
| **IA-4** | Sorgente archivio: cartella browser e/o ZIP + `relative_path` | upload Import (multer/webkitdirectory o ZIP), colonna path relativo; **non** scan path VPS | IA-1 | AFK (+ HITL quale UI prima) |
| **IA-5** | Classifica elenco + conferma per gruppo | process/AI a lotti; UI «accetta tutti Procedura→1.2»; zero auto-commit | IA-3, IA-4 | AFK |
| **IA-6** | Ponte 2.2 → caso Riesame (batch) | riuso `import-from-job` su N file capitolato dello stesso job/cartella relativa | IA-2, IA-5 | AFK |
| **IA-7** | Dopo il ponte: lanciare analisi già esistente | `analyze-documents` / `analyzeRequirements` persistito — **solo hook**, no nuovo motore | IA-6 | AFK |
| **IA-8** | OCR sull’import job (riuso S1a) | `processJob` / extract: se testo sotto soglia → `ocrExtractor` | IA-1 (stesso job, dopo o in parallelo a IA-2/3 se file disgiunti) | AFK |
| **IA-9** | Candidati evidenza SAL dai doc importati | non scrivere `evidence_document_ids`; allinea a SAL S2a/S2b | IA-5 + SAL S2a | AFK |
| **IA-10** | Scadenze da `expiry_date` (norme/cert/procedure) | niente dump in cartella `99`; hook scadenzario esistente | IA-5 | AFK |

**Ordine**: IA-1 → IA-2 e IA-3 (file in parte disgiunti: IA-2 backend tipi, IA-3 solo FE se IA-1 già espone la cartella) → IA-4 → IA-5 → IA-6 → IA-7. IA-8 può partire dopo IA-1 se nessun altro brief tocca `importJobs.controller` `processJob`. IA-9/10 dopo che il registro ha massa.

**Parallelo**: non due brief aperti su `importJobs.controller.js`. IA-3 (solo `ImportJobsPage.jsx`) può stare in `DEPUTYTASK1.md` **dopo** merge IA-1.

---

## Dettaglio slice IA-1 (prima eseguibile)

**Obiettivo verificabile**: un PDF già in stato `extracted`/`reviewed`, committato come `procedura` (o `manuale` / `istruzione`), compare nel registro **sotto la cartella** `1.2` / `1.1` / `1.3` dell’azienda. Una norma continua ad andare in `2.3`. Se la cartella manca → errore chiaro (`FOLDER_NOT_FOUND`), niente riga orfana.

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

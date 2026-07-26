---
name: pdf-to-json
description: >-
  Converte un documento PDF (nuova norma UNI/ISO, Quaderno, checklist esterna,
  capitolato cliente, ecc.) in Markdown revisionabile e poi in JSON strutturato,
  usando il tool locale backend/scripts/pdf_to_json/ (pdfplumber + fallback
  pymupdf/pypdf, OCR opzionale, nessuna chiamata cloud). Usare quando l'utente
  chiede di importare/estrarre/convertire un PDF in JSON, digitalizzare una
  norma, generare dati strutturati da un documento PDF per il progetto.
---

# PDF -> JSON (ProgettoISO)

Skill di progetto per trasformare un PDF in dati strutturati riutilizzabili
dal backend (seed norme, checklist, capitolati), tramite il tool generico
`backend/scripts/pdf_to_json/`. **Da attivare ogni volta che serve produrre
un JSON a partire da un PDF per il progetto**: il tool non e' scritto per un
singolo documento, va sempre riusato invece di scrivere parsing ad-hoc.

## Quando attivare

- Richiesta esplicita: «converti questo PDF in JSON», «importa questa norma»,
  «estrai il testo da questo PDF», «genera i dati per il nuovo Quaderno/checklist»
- Prima di aggiungere una nuova norma/standard al DB (`norm_requirements`)
- Prima di digitalizzare un capitolato cliente o una checklist esterna in formato PDF
- Quando `import-norms-from-markdown.js` non basta o produce risultati fragili
  su un nuovo file (quello script resta specifico per i 6 file norma storici
  con regex hardcoded; questo tool e' la via generica per tutto il resto)

## Input richiesti (chiedere se mancanti)

| Input | Esempio | Default se omesso |
|-------|---------|-------------------|
| **Percorso PDF** (file o cartella) | `docs/Normative/nuova_norma.pdf` | Chiedere sempre: obbligatorio |
| **Schema output** | `generic` (albero) o `norm-clause` (flat, tipo norme) | `generic` |
| **Standard code** (solo se schema `norm-clause`) | `ISO_45001_2018`, `ISO_3834_2_2021` | Nessuno (avviso nel JSON se mancante) |
| **Cartella output** | `docs/Normative/` o cartella temporanea di lavoro | Chiedere se non ovvia dal contesto |

## Workflow step-by-step

```
Progresso conversione PDF -> JSON:
- [ ] 1. Verificare Python locale e dipendenze (vedi Setup)
- [ ] 2. Lanciare la CLI sul PDF (singolo file o cartella batch)
- [ ] 3. Leggere il .md intermedio generato e verificarne la qualita'
- [ ] 4. Se ci sono pagine "ATTENZIONE" (bassa qualita'/OCR), correggerle a mano nel .md
- [ ] 5. Rigenerare/validare il .json solo dopo aver revisionato il .md
- [ ] 6. Usare il .json nel backend (seed, import, ecc.) o consegnarlo al committente
```

### Step 1 — Setup (una tantum per macchina)

Il Python con le librerie necessarie **non** e' lo stub Windows Store risolto
dal comando `python` semplice: usare sempre il percorso assoluto.

```powershell
C:\Users\AI.Project\AppData\Local\Python\bin\python.exe -m pip install -r backend/scripts/pdf_to_json/requirements.txt
```

Librerie usate (tutte locali, nessuna chiamata cloud/API esterna in nessuna
fase): `pdfplumber` (motore primario), `pypdf` e `pymupdf` (fallback testo),
`pytesseract` + `Pillow` (OCR opzionale, solo se il binario di sistema
`tesseract` e' installato a parte — vedi README per il link Windows).

### Step 2 — Eseguire la CLI

Lanciare **sempre dalla radice del repository** (`c:\Dev\ProgettoISO`):

```powershell
# Singolo file, schema generico (albero di sezioni)
C:\Users\AI.Project\AppData\Local\Python\bin\python.exe -m backend.scripts.pdf_to_json.cli `
    --input "percorso\al\documento.pdf" --output-dir out\

# Singolo file, schema norm-clause (per import norme)
C:\Users\AI.Project\AppData\Local\Python\bin\python.exe -m backend.scripts.pdf_to_json.cli `
    --input "percorso\alla\norma.pdf" --output-dir out\ `
    --schema norm-clause --standard-code ISO_45001_2018

# Cartella intera (batch, non ricorsivo)
C:\Users\AI.Project\AppData\Local\Python\bin\python.exe -m backend.scripts.pdf_to_json.cli `
    --input docs\Normative\ --output-dir out\ --verbose
```

Documentazione completa opzioni/schemi JSON: [`backend/scripts/pdf_to_json/README.md`](../../../backend/scripts/pdf_to_json/README.md).

### Step 3-4 — Revisione obbligatoria del Markdown intermedio

Il file `.md` viene **sempre** salvato (default `--keep-markdown`): **aprirlo
e leggerlo prima di fidarsi del JSON**. Contiene commenti
`<!-- Pagina N (motore: ...) -->` per tracciare la provenienza di ogni
sezione. Se una pagina riporta `ATTENZIONE: testo di bassa qualita'`, il
font del PDF ha una codifica non standard (o e' stato usato l'OCR): il testo
di quella sezione va verificato/corretto a mano prima di considerarlo
attendibile. Se compare invece `**Nota tecnica:** ... ordinamento
caratteri`, la pagina e' stata corretta automaticamente (pdfplumber →
pymupdf): rivederla comunque, ma non richiede correzione manuale nella
maggior parte dei casi.

### Step 5-6 — JSON e uso a valle

Il `.json` viene generato **dal Markdown**, non direttamente dal PDF: se una
sezione del `.md` e' sbagliata, si corregge nel `.md` (e si rilancia la
struttura, oppure per correzioni minime si edita a mano il `.json` finale).
Per lo schema `norm-clause`, il formato e' compatibile con
`backend/scripts/import-norms-from-markdown.js` (`standard_code`,
`clause_ref`, `clause_title`, `requirement_text`): puo' alimentare lo stesso
tipo di seed usato per `norm_requirements`.

## Comportamento difensivo (non fidarsi ciecamente dell'exit code 0)

- **PDF scansionato senza testo**: il tool fallisce con errore esplicito
  (non produce JSON vuoto), suggerendo OCR. Se il binario `tesseract` e'
  installato, tenta gia' da solo un OCR locale come ultima risorsa.
- **Font con codifica rotta/offuscata** (visto su PDF reali di
  `docs/Normative/`, es. edizioni "anti-copia"): il tool rileva il testo
  spazzatura (placeholder `(cid:NNN)`, caratteri di controllo) e lo tratta
  come non utilizzabile pagina per pagina. Se **alcune** pagine falliscono
  ma non tutte, il tool **non blocca** l'esecuzione (successo parziale): il
  JSON viene comunque generato, ma va sempre controllato il log/`.md` per le
  pagine segnalate come `ATTENZIONE`.
- **Header/footer ripetuti** (nome azienda, watermark, numeri pagina): rimossi
  automaticamente in fase di pulizia se identici su piu' pagine.
- **Caratteri riordinati su tabelle multi-colonna** (scoperto su ISO 14341,
  tabelle 3A/3B): pdfplumber puo' produrre testo che supera il controllo cid
  ma con i caratteri scambiati dentro le parole (`"Table"` → `"elbaT"`). Il
  tool lo rileva **automaticamente e di default** (nessun flag) tramite
  `quality.py` (punteggio di leggibilita' bigram/dizionario): se una pagina
  scende sotto soglia, viene ri-estratta con pymupdf e si tiene il testo
  migliore. Se il testo scelto e' quello di pymupdf, nel `.md` compare la
  riga visibile `**Nota tecnica:** testo di questa pagina ricostruito con
  motore alternativo per problema di ordinamento caratteri.` — cercarla per
  individuare rapidamente le pagine corrette automaticamente.
- **Font "anti-copia" con testo presente ma corrotto** (diverso dal caso
  precedente: qui il testo estratto NON e' spazzatura, ma alcune lettere sono
  sistematicamente sbagliate, es. `buii`→`butt`, `materia1`→`material`,
  `docurnent`→`document` — visto su `UNI EN ISO 9606-1:2017`). **Non scartare**
  il `.md`: il pattern e' spesso ricorrente e correggibile a dizionario. Se il
  testo va in pipeline di ingest applicativo (non solo digitalizzazione
  norma), vedi `backend/src/utils/textEncodingRepair.js`
  (`repairFontSubstitutionArtifacts` + `detectLikelyFontSubstitutionCorruption`,
  gia' agganciato come step opzionale in `documentIngestPipeline.service.js`).
  Se compaiono NUOVE grafie corrotte non ancora in dizionario, aggiungerle li'
  (parola intera, mai sostituzione di singolo carattere: il font non e'
  uniforme in tutto il documento — rischio falsi positivi su parole reali).

**Lezione (luglio 2026, RC-5/RC-6)**: l'errore di estrazione non e' sempre un
motivo per scartare il PDF. Prima ipotesi "il PDF e' troppo sporco, uso solo
cio' che gia' leggibile" era incompleta: la soluzione migliore e' distinguere
(1) corruzione sistematica ricorrente → dizionario di correzione riutilizzabile,
da (2) tabelle a griglia distrutte dal layout → GAP onesto (non inventare i
numeri, documentare cosa manca). Vedi `docs/reference/ISO-9606-1-range-validita-patentino.md`
e `docs/GUIDA_CONSOLIDATA.md` (sezione Ambiente di lavoro e tooling).

## Esempi di invocazione

**Utente**: «Ho un PDF con la nuova norma ISO 45001:2018 aggiornata, mi serve in JSON per il seed»
→ Eseguire CLI con `--schema norm-clause --standard-code ISO_45001_2018`, poi
revisionare il `.md`, poi indicare come integrare il JSON in
`backend/scripts/import-norms-from-markdown.js` o in un nuovo import mirato.

**Utente**: «Convertimi questo capitolato cliente in JSON strutturato»
→ Schema `generic` (nessuna numerazione clausola normativa attesa), cartella
di output dedicata al progetto/cliente, revisione `.md` prima di consegnare.

**Utente**: «Il vecchio script import-norms-from-markdown.js non prende bene questo nuovo file»
→ Non toccare le regex specifiche dello script legacy: usare questo tool
generico sul nuovo PDF e valutare se il JSON prodotto puo' sostituire o
affiancare l'import esistente per quel file.

**Utente**: «Ho una norma complementare alla 3834 (es. ISO 14175 gas, ISO 4063 processi, ISO 13916 temperature, ISO 15609 WPS)»
→ Schema `norm-clause` + `standard_code` dedicato (es. `ISO_14175_2008`, `ISO_13916_2025`, `ISO_15609_1_2019`),
output in `docs/Normative/` con naming tipo
`Normative NORMA_NNNNN_ UNI EN ISO … Rev. 0.md` (+ `.json` affiancato).
**Attenzione**: se la norma e' un **catalogo di classificazione**, **norma di misura**
o **checklist contenuto documento** (gas, processi, posizioni, temperature, contenuto WPS)
e non un SGQ a clausole 4–10, **non** aggiungerla a `import-norms-from-markdown.js`. Creare invece:
1. estratto operativo in `docs/reference/ISO-….md` (regole AI + simboli frequenti);
2. catalogo JS mirror `app/src/data/` + `backend/src/data/` **solo se** ci sono
   codici da normalizzare (pattern RC in `PLAN_INGEST_REFERENCE_CATALOGS.md`);
   altrimenti modulo leggero solo-prompt (es. temperature) oppure solo schema campi (es. 15609);
3. hook prompt in `importAiExtraction.service.js` / `documentTypeSchemas` se c'e' un campo ingest chiaro
   (es. `shielding_gas` ← ISO 14175; `preheat_temp`/`interpass_temp` ← ISO 13916; variabili WPS ← ISO 15609).
Esempi in repo: ISO 14175:2008 → `ISO-14175-gas-protezione.md` + `shieldingGases14175.js` (RC-3);
ISO 13916:2025 → `ISO-13916-temperature-saldatura.md` + `weldingTemperatures13916.js` (RC-9);
ISO 15609-1/-2:2019 → `ISO-15609-WPS-contenuto.md` + schema WPS arricchito (RC-10, no catalogo simboli);
ISO 14341:2020 → `ISO-14341-consumabili-filo.md` + `fillerWire14341.js` (RC-11, solo prompt: designazioni composite, non catalogo esaustivo).

## Encoding

- Tutti gli output (`.md`, `.json`) sono scritti in **UTF-8 senza BOM** dal
  tool stesso (vedi `cli.py`, `encoding="utf-8"`).
- Se si modificano a mano i file generati, verificare comunque accenti
  italiani corretti (à è é ì ò ù) e assenza di `U+FFFD`; su file toccati
  sotto `app/src` o `backend/src` eseguire
  `node backend/scripts/check-utf8-encoding.js` (nota: questo script non
  copre di default `backend/scripts/pdf_to_json/`, e' pensato per il codice
  applicativo — per i file di questo tool la verifica encoding va fatta
  a vista o con uno script Python ad-hoc).

## Risorse aggiuntive

- Tool e documentazione completa: [`backend/scripts/pdf_to_json/README.md`](../../../backend/scripts/pdf_to_json/README.md)
- Script legacy per le 6 norme storiche (non toccare le sue regex): `backend/scripts/import-norms-from-markdown.js`
- Pattern riutilizzabile: `docs/GUIDA_CONSOLIDATA.md` (sezione pattern/documentazione)

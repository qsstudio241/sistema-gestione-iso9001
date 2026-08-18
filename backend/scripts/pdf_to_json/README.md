# pdf_to_json - PDF -> Markdown -> JSON (ProgettoISO)

Tool Python modulare e riutilizzabile per convertire un documento PDF (norma
ISO/UNI, Quaderno, checklist esterna, capitolato cliente, ecc.) in:

1. un file **Markdown** intermedio, pensato per essere **revisionato da un
   umano** prima di fidarsi del passo successivo;
2. un file **JSON strutturato**, in uno dei due schemi supportati (vedi sotto).

Va usato **ogni volta che serve produrre un JSON specifico per il progetto a
partire da un PDF**: non e' scritto per un singolo documento, ma per essere
generico e riutilizzabile (nuove norme, nuovi Quaderni, checklist, capitolati...).

## Pipeline

```
extract.py           -> testo + tabelle + indizi di formattazione, per pagina
                        (usa quality.py per correggere pagine con caratteri riordinati)
extract_figures.py   -> (opzionale, --extract-figures) tavole raster + cluster
                        vettoriali con bbox, PNG in figures/ + *.figures.json
quality.py           -> punteggio di leggibilita' del testo (bigram/dizionario)
clean.py             -> pulizia/normalizzazione testo
markdown_convert.py  -> conversione in Markdown (heading, liste, tabelle)
structure.py         -> Markdown -> JSON strutturato (albero o lista piatta)
cli.py               -> orchestrazione delle fasi + interfaccia a riga di comando
```

Ogni fase e' una funzione pura testabile in isolamento (vedi `tests/`).

## Installazione dipendenze

Il Python con le librerie necessarie **non** e' quello risolto dal comando
`python` semplice su Windows (che punta allo stub Windows Store): usare
sempre il percorso assoluto.

```powershell
C:\Users\AI.Project\AppData\Local\Python\bin\python.exe -m pip install -r backend/scripts/pdf_to_json/requirements.txt
```

Vedi `requirements.txt` per l'elenco versionato (pdfplumber, pypdf, pymupdf,
pytesseract, Pillow, reportlab). Nessuna di queste librerie chiama servizi
cloud/API esterne: tutta la pipeline gira in locale, incluso l'eventuale OCR.

## Uso della CLI

```powershell
# Singolo file, schema generico (albero di sezioni annidate)
C:\Users\AI.Project\AppData\Local\Python\bin\python.exe -m backend.scripts.pdf_to_json.cli `
    --input "docs\Normative\UNI EN ISO 9001_2015 Rev. 0.pdf" `
    --output-dir out\

# Singolo file, schema norm-clause (compatibile import-norms-from-markdown.js)
C:\Users\AI.Project\AppData\Local\Python\bin\python.exe -m backend.scripts.pdf_to_json.cli `
    --input "docs\Normative\Nuova Norma.pdf" `
    --output-dir out\ `
    --schema norm-clause `
    --standard-code ISO_9001_2015

# Elaborazione di una cartella intera (batch, non ricorsiva)
C:\Users\AI.Project\AppData\Local\Python\bin\python.exe -m backend.scripts.pdf_to_json.cli `
    --input docs\Normative\ `
    --output-dir out\ `
    --verbose
```

Il comando **deve** essere lanciato con `-m` dalla **radice del repository**
(`c:\Dev\ProgettoISO` come cartella corrente): il modulo usa import relativi
interni al package, quindi eseguire `cli.py` direttamente (`python cli.py ...`)
**non funziona** (errore `attempted relative import`).

### Opzioni principali

| Opzione | Default | Descrizione |
|---|---|---|
| `--input` | (obbligatorio) | File PDF singolo o cartella (batch, non ricorsivo) |
| `--output-dir` | (obbligatorio) | Cartella di output per `.md` e `.json` (creata se manca) |
| `--schema` | `generic` | `generic` (albero) oppure `norm-clause` (lista piatta) |
| `--standard-code` | (nessuno) | Codice standard da inserire nei record, usato solo con `--schema norm-clause` |
| `--keep-markdown` / `--no-keep-markdown` | `--keep-markdown` | Salva sempre il `.md` intermedio (consigliato lasciare attivo) |
| `--ocr` / `--no-ocr` | `--ocr` | Tenta OCR locale (tesseract) sulle pagine senza testo, se il binario e' disponibile |
| `--extract-figures` | disattivo | Estrae tavole raster e regioni vettoriali (pymupdf, **locale**): `figures/` + `<nome>.figures.json` |
| `--verbose` | disattivo | Log dettagliato per pagina (motore usato, caratteri, tabelle, indizi heading) |

Per ogni PDF in input vengono scritti `<nome-pdf>.md` e `<nome-pdf>.json`
nella cartella di output. Con `--extract-figures` (default off) si aggiungono
`<nome-pdf>.figures.json` e i PNG in `figures/`.

**Fuori scope (oggi):** il tool **non** verifica se la norma e' in vigore sul catalogo UNI/ISO.
Quella verifica esiste gia' per il registro documenti dei tenant (`normValidityChecker`,
lunedi 03:00). I Markdown in `docs/Normative/` restano un backlog: controllo al
**giorno 1 del mese** in dashboard superadmin (vedi roadmap, backlog parcheggiato).

## Dove finiscono gli output e come revisionarli

- Il file **`.md`** e' sempre generato (salvo `--no-keep-markdown`, sconsigliato):
  **apritelo e leggetelo prima di fidarvi del JSON**. Contiene commenti
  `<!-- Pagina N (motore: ...) -->` che indicano da quale pagina/motore
  proviene ogni sezione, utili per capire dove rivedere l'estrazione.
  Cercare `ATTENZIONE` per le pagine con font a codifica rotta e `**Nota
  tecnica:**` per le pagine corrette automaticamente per caratteri
  riordinati (vedi sezioni dedicate sotto).
- Il file **`.json`** e' generato dal Markdown (non direttamente dal PDF):
  se una sezione nel `.md` e' malformata (heading non riconosciuto, tabella
  spezzata), il problema si vede prima li' e va corretto lì o rilanciando
  la CLI con input migliore, non modificando a mano il JSON.

## Formato JSON - schema `generic`

Albero di sezioni annidate per livello di heading Markdown:

```json
{
  "title": "Documento",
  "level": 0,
  "path": null,
  "content": "",
  "children": [
    {
      "title": "Contesto dell'organizzazione",
      "level": 1,
      "path": "4",
      "content": "",
      "children": [
        {
          "title": "Comprensione dell'organizzazione e del suo contesto",
          "level": 2,
          "path": "4.1",
          "content": "L'organizzazione deve determinare i fattori esterni e interni...",
          "children": []
        }
      ]
    }
  ]
}
```

- `path`: numero di clausola se rilevato nel titolo (es. `"4.1"`), altrimenti `null`.
- `content`: solo il testo proprio della sezione (quello prima della prima
  sotto-sezione), non include il testo dei `children`.

## Formato JSON - schema `norm-clause`

Lista piatta compatibile con lo schema gia' usato da
`backend/scripts/import-norms-from-markdown.js` (`norm_requirements_seed.json`):

```json
[
  {
    "standard_code": "ISO_9001_2015",
    "clause_ref": "4.1",
    "clause_title": "Comprensione dell'organizzazione e del suo contesto",
    "requirement_text": "L'organizzazione deve determinare i fattori esterni e interni..."
  }
]
```

Include **solo** le sezioni il cui titolo inizia con un numero di clausola
riconosciuto (es. `"4.1 Titolo"`); le sezioni senza numero (es. titoli in
MAIUSCOLO senza numerazione) non compaiono in questo schema.

Nota importante: questo tool **non duplica le regex specifiche** di
`import-norms-from-markdown.js` (righi da scartare per singolo file, nomi
azienda hardcoded, ecc.). Usa un parser generico basato solo su heading
Markdown + numerazione, quindi va rivisto/adattato caso per caso se il PDF
sorgente ha rumore particolare (indici, intestazioni ripetute non standard):
lo script legacy resta utilizzabile finche' questo tool non lo sostituisce
formalmente per le norme gia' importate.

## Rilevamento heading (euristica)

In ordine di priorita':

1. **Numerazione di clausola**: righi tipo `"4.1 Titolo"`, `"10.2.3 Titolo"`
   (con o senza punto dopo il numero). Il livello dell'heading = numero di
   segmenti (`"4.1.2"` -> livello 3).
2. **Dimensione carattere** (se disponibile dai metadata pdfplumber/PyMuPDF):
   righi scritti con un carattere sensibilmente piu' grande della mediana
   della pagina.
3. **Rigo TUTTO MAIUSCOLO**: euristica di riserva per titoli senza numerazione.

## OCR per PDF scansionati (opzionale, best-effort)

Se un PDF non produce testo con pdfplumber/PyMuPDF/pypdf (tipico di
scansioni/immagini senza livello testo), il tool **prova automaticamente
un OCR locale** con `pytesseract`, ma **solo se il binario di sistema
`tesseract` e' installato a parte** (non e' un pacchetto pip: va installato
separatamente, es. su Windows
[tesseract-ocr per Windows (UB-Mannheim)](https://github.com/UB-Mannheim/tesseract/wiki)).

- Se il binario `tesseract` **non e' presente** (caso di questo workspace al
  momento della stesura): l'OCR viene saltato e il tool fallisce in modo
  chiaro, segnalando esplicitamente che l'OCR non e' stato tentato per
  assenza del binario.
- Se il binario **e' presente**: il rendering pagina -> immagine avviene
  con PyMuPDF (non serve il binario aggiuntivo `poppler`/`pdf2image`), poi
  l'immagine viene passata a `pytesseract.image_to_string` (lingua `ita+eng`,
  con fallback alla lingua di default se i language pack non sono installati).
- L'OCR e' pensato come **ultima rete per singole pagine problematiche**
  dentro un documento altrimenti testuale, non come sostituto di un OCR di
  qualita' (es. Adobe Acrobat, `ocrmypdf`) per scansioni integrali: la
  precisione di un OCR "al volo" e' inferiore e va sempre rivista sul `.md`
  intermedio prima di fidarsi del JSON.
- Disattivabile con `--no-ocr` (utile per batch veloci su documenti gia'
  noti come testuali, o per riprodurre in modo deterministico l'errore
  "nessun testo estraibile" a scopo di test).

**Nessuna chiamata cloud/API esterna in nessun caso**: ne' per l'estrazione,
ne' per l'OCR, ne' per le figure (`--extract-figures`), ne' per la
strutturazione JSON (parsing deterministico basato su heading Markdown,
non un modello linguistico).

## Estrazione figure (`--extract-figures`, default off)

Le tavole delle norme (es. simboli ISO 2553) sono spesso **vettoriali**:
`page.get_images()` da solo non basta. Con il flag il tool, in locale:

1. raccoglie le immagini XObject con **bbox di pagina** (`get_image_rects`,
   non solo xref) e ne rasterizza il ritaglio in PNG (`kind: raster`);
2. raggruppa i `get_drawings()` vicini, scarta rumore (linee isolate,
   footer/header, cornici a pagina intera) e rasterizza ogni cluster
   (`kind: vector`).

Ogni figura nel JSON ha `id`, `page` (1-based), `bbox` `[x0,y0,x1,y1]` in
punti pagina, `kind`, `path` relativo al PNG, `caption` se c'e' testo
vicino (best-effort, puo' essere `null`). Una pagina senza figure produce
`"figures": []` e exit 0. Nessun embedding, nessun database: solo file
su disco. Non committare PDF coperti da copyright; i test usano fixture
ReportLab in `tests/pdf_fixtures.py`.

## Rilevamento automatico testo con caratteri riordinati (pdfplumber, tabelle multi-colonna)

Scoperto testando il tool su un PDF reale (ISO 14341, tabelle 3A/3B a pag.
11-13): su alcune pagine con **tabelle multi-colonna**, pdfplumber apre il
PDF e produce testo che supera il controllo cid/qualita' di base (nessun
placeholder `(cid:NNN)`, nessun carattere di controllo), ma con i
**caratteri riordinati/scambiati dentro le parole** — es. `"Table"` diventa
`"elbaT"`, `"3Si1"` diventa `"1iS3"`. E' un problema diverso e piu' subdolo
di quello dei font a codifica rotta (vedi sotto): il testo "sembra" pulito
ma e' comunque illeggibile.

Per gestirlo, **attivo di default senza bisogno di flag**:

1. Dopo l'estrazione primaria con pdfplumber, ogni pagina viene valutata da
   `quality.py` (`text_readability_score`): un punteggio di leggibilita'
   0.0-1.0 basato su due euristiche locali (nessun download, nessuna
   chiamata cloud/AI) — confronto con un piccolo dizionario di parole
   comuni italiane/inglesi/tecniche incorporato nel codice, e frequenza dei
   bigrammi di caratteri tipici delle due lingue.
2. Se il punteggio scende sotto la soglia (`quality.DEFAULT_CORRUPTION_THRESHOLD`,
   0.40), la stessa pagina viene ri-estratta con PyMuPDF e i due punteggi
   vengono confrontati: si tiene il testo con punteggio migliore.
3. Se il testo scelto e' quello di PyMuPDF (cioe' pdfplumber aveva il
   problema), nel `.md` generato compare una riga visibile subito dopo il
   marcatore di pagina:

   ```
   **Nota tecnica:** testo di questa pagina ricostruito con motore alternativo per problema di ordinamento caratteri.
   ```

   sullo stesso principio della segnalazione `ATTENZIONE` gia' usata per le
   pagine con font a codifica rotta (vedi sotto), ma come testo visibile
   nel Markdown renderizzato (non un commento HTML), come richiesto per
   questo tipo di anomalia.

Pagine legittimamente povere di testo alfabetico (es. tabelle di soli
codici/numeri) non vengono penalizzate: se non c'e' abbastanza materiale
testuale per un giudizio affidabile, `text_readability_score` ritorna
`None` e la pagina resta invariata (nessun falso positivo).

## Limiti noti

- **Tabelle**: vengono estratte da pdfplumber e convertite in Markdown, ma
  **appese in coda al testo della pagina**, non inserite esattamente nel
  punto del flusso testuale in cui comparivano nel PDF (limite di pdfplumber
  nel correlare posizione tabella <-> posizione testo in modo affidabile per
  ogni tipo di layout). Rivedere il `.md` per verificare la posizione.
- **Ambiguita' liste numerate vs heading**: un rigo tipo `"1. Primo punto"`
  puo' essere interpretato come heading di clausola invece che elemento di
  elenco puntato. E' un compromesso accettato per privilegiare il
  riconoscimento delle clausole normative (caso d'uso primario del tool).
  Se capita, correggere a mano nel `.md` prima di generare il JSON.
- **OCR integrato**: qualita' inferiore a un OCR dedicato, e comunque
  disponibile solo se il binario `tesseract` e' installato sul sistema
  (vedi sopra). Per scansioni intere di bassa qualita' resta preferibile un
  OCR professionale seguito da revisione manuale del testo prima di
  rilanciare questo tool sul PDF ri-esportato con testo.
- **PDF protetti da password**: non gestiti (nessuna delle librerie usate
  tenta di decifrare un PDF protetto); il tool fallisce con errore chiaro.
- **Font con codifica/ToUnicode rotta o offuscata** (scoperto testando il
  tool su un PDF reale del repository, `docs/Normative/UNI EN ISO 9712
  (2012).pdf`): alcune edizioni PDF commerciali di norme UNI/ISO usano
  font con mappatura caratteri non standard (a volte come protezione
  anti-copia). In questi casi pdfplumber/PyMuPDF/pypdf non producono un
  errore ne' testo vuoto, ma un testo "presente" e pero' illeggibile
  (placeholder letterali tipo `(cid:52)(cid:86)...` o sequenze di
  caratteri di controllo). Il tool rileva questo caso con un controllo di
  qualita' del testo (`extract._text_quality_ratio`) e lo tratta come
  "nessun testo utilizzabile", tentando l'OCR (se disponibile) e altrimenti
  fallendo con un messaggio che distingue esplicitamente questa causa da
  una scansione vera e propria. L'OCR e' l'unica soluzione realistica per
  questi PDF, perche' legge i pixel della pagina ignorando la codifica del
  font.

## Test

```powershell
C:\Users\AI.Project\AppData\Local\Python\bin\python.exe -m unittest discover -s backend/scripts/pdf_to_json/tests -v
```

Include test unitari su `clean`/`markdown_convert`/`structure`/`quality`
(fixture testuali, nessuna dipendenza da PDF reali) e test di integrazione
end-to-end che generano PDF sintetici al volo con `reportlab` (nessun file
binario committato nel repository) per validare l'intera pipeline CLI,
incluso il caso di PDF "scansionato" senza testo, il caso di testo con
caratteri riordinati (simulato via mock dei motori di estrazione) e
l'estrazione figure MR-0 (`tests/test_extract_figures.py`: almeno 1 raster
e 1 vector, bbox non degeneri, pagina senza figure -> `figures: []`).

### Test manuale con un PDF reale (consigliato prima di usare il tool su un documento importante)

```powershell
# Dalla radice del repository (c:\Dev\ProgettoISO)
C:\Users\AI.Project\AppData\Local\Python\bin\python.exe -m backend.scripts.pdf_to_json.cli `
    --input "percorso\al\tuo\documento.pdf" `
    --output-dir tmp_pdf_to_json_test\ `
    --verbose
```

Aprire poi il `.md` generato e verificare che titoli, paragrafi e tabelle
siano ragionevoli prima di usare il `.json`.

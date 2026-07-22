# ISO 2553 — Simboli di saldatura sui disegni (riferimento operativo SGQ)

> **Uso**: assistente AI per l'estrazione requisiti da disegni tecnici (`drawingExtraction.service.js`, `req_type: weld_symbol`), supporto interpretativo per commesse/preventivi.
> **Fonte**: sintesi tecnica propria, basata sui principi generali di ISO 2553 (rappresentazione simbolica delle saldature sui disegni) e su bibliografia di settore comparativa ISO/AWS. **Nessun testo normativo copiato** — solo tabelle/regole sintetiche, come per gli altri riferimenti in questa cartella. Per un'applicazione contrattuale vincolante consultare il testo integrale della norma.
> **Catalogo codice**: `backend/src/data/weldingSymbols2553.js` (fonte unica per il prompt AI).
> **Cataloghi collegati**: `weldingProcesses4063.js` (codice processo indicato in coda al simbolo), `weldingPositions6947.js` (posizione di saldatura, non parte del simbolo ma spesso citata a fianco).

## Scopo

ISO 2553 definisce come rappresentare graficamente un giunto saldato su un disegno tecnico, senza dover disegnare la sezione reale del giunto. Il sistema è usato in tutta Europa (in UK/EN come **BS EN ISO 2553**); il sistema americano equivalente è **ANSI/AWS A2.4**, simile ma con differenze di posizionamento non intercambiabili.

## Struttura del simbolo

Un simbolo di saldatura completo è composto da:

| Elemento | Funzione |
|---|---|
| **Linea di rimando** (arrow line) | Punta al giunto da saldare; non è mai orizzontale (per non confondersi con la linea di riferimento) |
| **Linea di riferimento** (reference line) | Sempre orizzontale; nel sistema ISO è **doppia**: una continua + una tratteggiata, parallele |
| **Simbolo elementare** | La forma (V, U, triangolo, cerchio, ecc.) che identifica il tipo di saldatura, posizionata sulla linea di riferimento |
| **Simboli supplementari** | Aggiunti al simbolo elementare per indicare profilo, finitura o istruzioni particolari |
| **Quote** | Numeri a sinistra (dimensione principale) e a destra (lunghezza/passo) del simbolo |
| **Coda** (tail/fork) | Facoltativa: contiene il codice processo ISO 4063, riferimenti a note del disegno o alla WPS. Si omette se non necessaria |

### Lato freccia vs lato opposto

- Simbolo sulla linea **continua** → saldatura sul **lato freccia** (arrow side).
- Simbolo sulla linea **tratteggiata** → saldatura sul **lato opposto** (other side).
- Se la saldatura è presente su entrambi i lati (es. doppio cordone d'angolo), la linea tratteggiata può essere omessa e i simboli compaiono su entrambi i lati della sola linea continua.

## Tabella — simboli elementari più frequenti

| Simbolo | Designazione italiana | Forma grafica |
|---|---|---|
| Saldatura di testa a V | Preparazione a V su un lembo, comune per spessori medi | V rovesciata |
| Saldatura di testa a lembi retti | Nessuna preparazione (square butt) | due linee verticali parallele |
| Saldatura di testa a lembo smussato | Un solo lembo preparato (single bevel) | mezza V |
| Saldatura di testa a U / a J | Per spessori elevati, riduce il metallo d'apporto | U o mezza U |
| **Saldatura d'angolo** (fillet) | Il triangolo più comune; il cateto verticale va sempre a sinistra | triangolo |
| Saldatura su lembi rialzati/di bordo | Edge weld — saldatura a bassa resistenza per sigillatura | due linee verticali con base arrotondata |
| Saldatura a tappo o cava | Foro riempito di metallo d'apporto (plug/slot) | rettangolo |
| Saldatura a punti / a rulli (resistenza) | Richiede accesso da entrambi i lati | cerchio pieno / cerchio allungato |
| Saldatura a punti / continua ad arco | Eseguibile da un solo lato | cerchio pieno / allungato su un lato della linea |
| Riporto (surfacing) | Rivestimento anti-usura o anticorrosione | semicerchio |

## Tabella — simboli supplementari più frequenti

| Simbolo | Significato |
|---|---|
| Piano/a raso (flat/flush) | Profilo del cordone finito a raso, senza indicare il metodo |
| Convesso / concavo | Profilo del cordone richiesto |
| Raccordo dei piedi del cordone | Toes blended smoothly — usato per migliorare la resistenza a fatica |
| **Saldatura perimetrale** (weld all round) | Cerchio pieno all'incrocio freccia/linea — saldatura continua tutto attorno |
| Saldatura in cantiere (field/site weld) | Bandierina — saldatura non eseguita in officina |
| Piattina di supporto (backing strip) | Lettera **R** = removibile dopo saldatura; lettera **M** = materiale specificato in coda |

## Notazione delle quote

| Posizione | Significato |
|---|---|
| A **sinistra** del simbolo | Dimensione principale: **z** = cateto (leg length), **a** = spessore di gola (throat thickness), **s** = spessore di gola effettivo per saldature a piena penetrazione profonda |
| A **destra** del simbolo | Lunghezza/passo per saldature intermittenti, formato tipico `n × l (e)`: n = numero tratti, l = lunghezza di ciascuno, (e) = distanza tra i tratti |
| **Assente** su saldatura di testa | In ISO 2553 significa piena penetrazione, per tutta la lunghezza del giunto (default) |
| In **coda** alla linea di riferimento | Codice processo ISO 4063 (es. "141" = TIG) o riferimento a nota/WPS |

## Differenze principali rispetto al sistema AWS (solo per riconoscimento, non normative)

- AWS usa una **singola** linea di riferimento (continua); il lato freccia/altro lato è indicato dalla posizione del simbolo **sotto/sopra** la linea, non da continua/tratteggiata come in ISO.
- AWS ammette dimensioni di preparazione del giunto (angoli, root gap) direttamente nel simbolo; ISO 2553 le rimanda alla WPS.
- AWS include simboli non presenti in ISO 2553: distanziale (spacer), inserto consumabile, melt-through dedicato, simboli NDT (RT, UT, MT, PT, VT...). Se un disegno di origine estera li riporta, vanno segnalati come "simbolo non-ISO" invece di forzare una corrispondenza.

## Regole per l'estrazione AI (`weld_symbol`, `drawingExtraction.service.js`)

| Regola | Dettaglio |
|---|---|
| `value_text` | Riportare la designazione italiana standard (es. "saldatura d'angolo, cateto 5mm, perimetrale"), non solo la descrizione della forma grafica |
| `field_key` | `welding_process` se in coda è presente un codice ISO 4063; altrimenti generico (`weld_type`, `weld_size`, ecc.) |
| Simboli non riconosciuti | Non inventare: se la forma non corrisponde a nessun simbolo noto, descriverla come nota generica (`req_type: note`) con confidenza bassa |
| Simboli AWS su disegni non-ISO | Segnalarlo esplicitamente in `value_text` (es. "simbolo AWS, non ISO 2553") invece di normalizzarlo silenziosamente |

## Riferimenti incrociati

- ISO 4063 — nomenclatura processi (codice riportato in coda al simbolo)
- ISO 6947 — posizioni di saldatura (spesso citate a fianco del simbolo, non parte del simbolo stesso)
- ISO 9606-1 / ISO 14732 — qualifiche saldatori/operatori (verificano la capacità di eseguire il giunto indicato dal simbolo)
- ISO 3834 — requisiti di qualità per la saldatura per fusione (contesto generale d'uso dei disegni con simboli)

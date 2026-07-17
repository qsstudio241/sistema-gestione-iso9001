
# ISO 9606-1:2017 — Range di qualificazione e validità patentino saldatore (riferimento operativo SGQ)

> **Uso**: assistente AI, ingest patentini saldatori, alert scadenze.
> **Fonte**: estratto operativo da UNI EN ISO 9606-1:2017 (recepimento EN ISO 9606-1:2017, ISO 9606-1:2012 + Cor 1:2012 + Cor 2:2013). Testo integrale nel Patrimonio Studio — **qui solo tabelle/regole sintetiche**, mai testo normativo copiato.
> **Cataloghi collegati**: `app/src/data/materialGroups15608.js` (gruppo materiale), `weldingProcesses4063.js` (processo), `weldingPositions6947.js` (posizione), `backend/src/utils/weldingDesignation.js` (designazione qualifica).

## Nota sulla fonte di questo estratto (qualità estrazione)

Questo documento nasce dalla conversione PDF→Markdown del tool `backend/scripts/pdf_to_json/` sul file `UNI EN ISO 9606-1_2017.pdf` (50 pagine). Il PDF usa un **font "anti-copia"** che genera errori sistematici di estrazione testo (es. `buii`→`butt`, `materia1`→`material`, `docurnent`→`document` — vedi lezione in `docs/GUIDA_CONSOLIDATA.md` e utility `backend/src/utils/textEncodingRepair.js::repairFontSubstitutionArtifacts`). Le tabelle numeriche a griglia (Tabelle 6, 9, 10 — spessore/posizioni) sono risultate **troppo destrutturate** per essere trascritte con certezza e sono quindi **marcate come GAP** più sotto: non sono state inventate.

## Scopo e principio generale

La qualifica di un saldatore attesta la sua **capacità manuale** (non la procedura, che è oggetto di ISO 15614-1). Una prova qualifica il saldatore non solo per le condizioni testate ma anche per tutte le condizioni "più facili" secondo le variabili essenziali definite dalla norma.

## Variabili essenziali (che determinano il campo di validità)

| Variabile | Dettaglio |
|---|---|
| Processo di saldatura | Codice ISO 4063 (catalogo `weldingProcesses4063.js`) — un cambio di processo richiede nuova qualifica, salvo eccezioni (v. sotto) |
| Tipo prodotto | Piastra (P) o tubo (T) |
| Tipo giunto | Testa a testa (BW) o angolare (FW) — BW non qualifica FW e viceversa, salvo prova supplementare d'angolo |
| Gruppo materiale d'apporto | FM1–FM6 (ISO 9606-1 Tabella 2, mappato su ISO 14343/18274) |
| Tipo materiale d'apporto | Entro il gruppo FM qualificato |
| Dimensioni | Spessore depositato e/o diametro esterno tubo |
| Posizione di saldatura | ISO 6947 (catalogo `weldingPositions6947.js`) |
| Dettagli di giunto | Backing (materiale/gas/flussante), inserto consumabile, mono/multistrato, saldatura sx/dx |

Il/i gruppo/i materiale base (ISO/TR 15608) usato/i nella prova va **sempre registrato** sul certificato, anche se non è variabile essenziale bloccante per la qualifica.

## Continuità tra processi (eccezioni — non serve nuova qualifica)

| Prova con | Qualifica anche per |
|---|---|
| 135 (MAG filo solido) ↔ 138 (MAG filo animato metallico) | Intercambiabili senza nuova prova |
| 121 (SAW filo solido) ↔ 125 (SAW filo animato) | Intercambiabili senza nuova prova |
| 141/143/145 (TIG varianti) | Qualificano reciprocamente 141, 143, 145 — **142 (TIG autogeno) qualifica solo 142** |
| Transfer mode "dip"/corto circuito (131, 135, 138) | Qualifica anche altri transfer mode dello stesso processo, **non viceversa** |

## Tipo di giunto (BW/FW)

- BW qualifica sempre BW; non qualifica FW (e viceversa), **salvo** prova supplementare di filetto (spessore minimo 10 mm, posizione PB) eseguita in aggiunta — in tal caso qualifica anche PA/PB per giunti d'angolo.
- BW su tubo qualifica diramazioni con angolo ≥60° nello stesso campo di validità delle tabelle piastra/tubo.

## Range di qualificazione diametro tubo (ISO 9606-1 Tabella 7 — verificato, leggibile nell'estratto)

| Diametro esterno provino D | Campo di validità |
|---|---|
| D ≤ 25 mm | da D a 2D |
| D > 25 mm | > 0,5·D (minimo 25 mm) |

Codificato in `weldingQualificationRules9606.js::computeQualifiedPipeDiameterRange`.

## Range di qualificazione spessore per giunti d'angolo (ISO 9606-1 Tabella 8 — parziale, verificato)

| Spessore provino t | Campo di validità |
|---|---|
| t < 3 mm | da t a 2t, o 3 mm, il maggiore dei due |

**GAP**: le righe successive della Tabella 8 (t ≥ 3 mm) e l'intera Tabella 6 (spessore depositato per giunti testa a testa, la più usata in pratica) non sono risultate leggibili nell'estrazione automatica — la griglia numerica è risultata destrutturata dal layout PDF. Non sono stati inventati valori: **verifica manuale su copia integrale necessaria** prima di codificare la regola generale spessore↔range per giunti BW.

## Posizioni di saldatura (ISO 6947)

Le posizioni valide/qualificate per BW e FW sono elencate nelle Tabelle 9 e 10 della norma, come matrice posizione-provino × posizione-qualificata. **GAP**: la matrice (righe/colonne con "x") non è risultata ricostruibile dall'estrazione automatica. Regola generale non ambigua confermata nel testo: una prova su tubo in **PH o PJ** (rotazione parziale, D ≥ 150 mm) può coprire più posizioni con un solo provino — dettaglio da verificare a mano se serve calcolare automaticamente le posizioni coperte.

## Designazione qualifica (§11 — ordine confermato)

1. Riferimento norma (ISO 9606-1)
2. Processo/i di saldatura (rif. ISO 4063)
3. Tipo prodotto: piastra (P) o tubo (T)
4. Tipo di giunto: BW o FW — oppure gruppo materiale base per saldatura autogena
5. Tipo/i di materiale d'apporto
6. Dimensioni del provino: diametro D
7. Posizioni di saldatura (rif. ISO 6947)
8. Dettagli di giunto

Implementato in `backend/src/utils/weldingDesignation.js::buildWelderQualificationDesignation` (già presente, pattern coerente).

## Validità e conferma (§9 — verificato, testo leggibile)

| Regola | Dettaglio |
|---|---|
| Decorrenza | Dalla data di esecuzione della prova (non dalla data di rilascio certificato) |
| **Conferma periodica** | Ogni **6 mesi**, a cura del responsabile saldature o dell'esaminatore/organismo — attesta che il saldatore ha lavorato nel campo di validità. Senza conferma, il certificato **diventa non valido**. |
| Rivalidazione — opzione a) | Nuova prova ogni **3 anni** |
| Rivalidazione — opzione b) | Ogni **2 anni**, controllo con radiografia/ultrasuoni o prova distruttiva su 2 saldature eseguite negli ultimi 6 mesi del periodo di validità — estende la validità di altri 2 anni |
| Rivalidazione — opzione c) | Validità **indefinita** se: conferma semestrale rispettata **e** saldatore lavora per lo stesso fabbricante **e** il fabbricante ha sistema qualità certificato ISO 3834-2/3834-3 **e** il fabbricante documenta che il saldatore produce saldature di qualità accettabile |
| Revoca | In caso di dubbio motivato sulla capacità del saldatore, le qualifiche coinvolte vanno revocate (le altre restano valide) |

**Nota implementativa**: questa parte è già coperta a livello dati da `qualifications` (`next_confirmation_due`, alert in `qualificationAlert.service.js`). Le opzioni b)/c) di rivalidazione **non risultano ancora modellate** nello schema: gap segnalato nel piano RC-5/RC-6, non implementato in questa sessione per evitare di forzare una logica di business non richiesta esplicitamente.

## Regole per l'estrazione AI (ingest patentini)

| Campo | Regola |
|---|---|
| `confirmation_interval_months` | Sempre 6 (fisso da norma, non da certificato) |
| Range diametro tubo | Se il certificato riporta un diametro provino, applicare Tabella 7 sopra per calcolare il campo coperto — **solo** se il documento non riporta già il range esplicito |
| Range spessore | **Non calcolare automaticamente** (gap Tabella 6/8) — estrarre solo il valore/range se esplicitamente scritto sul certificato |
| Validità (2/3 anni) | Non assumere un valore fisso: dipende dall'opzione di rivalidazione scelta (a/b/c) — se il certificato non lo specifica, lasciare `null` + warning |

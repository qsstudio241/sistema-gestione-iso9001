
# ISO 9606-1:2017 — Range di qualificazione e validità patentino saldatore (riferimento operativo SGQ)

> **Uso**: assistente AI, ingest patentini saldatori, alert scadenze.
> **Fonte**: estratto operativo da UNI EN ISO 9606-1:2017 (recepimento EN ISO 9606-1:2017, ISO 9606-1:2012 + Cor 1:2012 + Cor 2:2013). Testo integrale nel Patrimonio Studio — **qui solo tabelle/regole sintetiche**, mai testo normativo copiato.
> **Cataloghi collegati**: `app/src/data/materialGroups15608.js` (gruppo materiale), `weldingProcesses4063.js` (processo), `weldingPositions6947.js` (posizione), `backend/src/utils/weldingDesignation.js` (designazione qualifica).

## Nota sulla fonte di questo estratto (qualità estrazione)

Questo documento nasce dalla conversione PDF→Markdown del tool `backend/scripts/pdf_to_json/` sul file `BS EN ISO 9606-1-2017.pdf` (46 pagine, digitalizzato in `docs/Normative/Normative NORMA_00018_ UNI EN ISO 9606-1_2017 Rev. 0.md/.json` il 26/07/2026). Il PDF usa un **font "anti-copia"** che genera errori sistematici di estrazione testo (es. `buii`→`butt`, `materia1`→`material`, `docurnent`→`document` — vedi lezione in `docs/GUIDA_CONSOLIDATA.md` e utility `backend/src/utils/textEncodingRepair.js::repairFontSubstitutionArtifacts`).

**Aggiornamento 26/07/2026 — GAP Tabelle 6/9/10 risolto.** Il problema NON era testo interfogliato/invertito (il fix `quality.py` del 26/07/2026 per colonne interfogliate non era infatti la causa): il PDF usa il font **`SymbolMT`** per i simboli matematici (`<`, `\u2264` = "minore o uguale", `\u2265` = "maggiore o uguale") e per il segno `\u00d7` usato dalla norma nelle Tabelle 9/10 per indicare "posizione per cui il saldatore è qualificato". Questi glifi sono mappati su codepoint Private Use Area (U+F020–U+F0FF secondo la convenzione legacy dei font Symbol su Windows) che `pdfplumber`/`pymupdf` non traducono in Unicode standard: il testo estratto li mostra come **spazi vuoti**, facendo sembrare le tabelle "distrutte" mentre in realtà tutto il resto (numeri, parole, il segno "—" per "non qualificato") era già corretto. Risolto rileggendo i caratteri delle pagine 21, 22 e 24 a livello di glifo (PyMuPDF `rawdict`, char code + font name) e verificando visivamente il render di ogni codepoint speciale trovato: confermato che ogni spazio vuoto nelle celle numeriche corrisponde in modo univoco a uno di questi simboli, permettendo la trascrizione completa e certa delle Tabelle 6, 8 (riga mancante) e 9/10 riportate sotto.

## Scopo e principio generale

La qualifica di un saldatore attesta la sua **capacità manuale** (non la procedura, che è oggetto di ISO 15614-1). Una prova qualifica il saldatore non solo per le condizioni testate ma anche per tutte le condizioni "più facili" secondo le variabili essenziali definite dalla norma.

## Variabili essenziali (che determinano il campo di validità)

| Variabile | Dettaglio |
|---|---|
| Processo di saldatura | Codice ISO 4063 (catalogo `weldingProcesses4063.js`) — un cambio di processo richiede nuova qualifica, salvo eccezioni (v. sotto) |
| Metodo di trasferimento (transfer mode) | **Solo per processi ad arco con filo continuo** (131 MIG, 135 MAG, 136/138 filo animato): spray arc, pulsed arc, short arc (short-circuit/dip), globular. Non esiste per 111 (MMA), 121 (SAW), 141/145 (TIG), 311 (ossiacetilenica). Il modulo certificato ufficiale (§9.3, Annex) elenca "Welding process(es); **Transfer mode**" come voce combinata nella tabella "Range of qualification" |
| Tipo prodotto | Piastra (P) o tubo (T) — **solo queste due categorie**, verificato testualmente (v. nota "Tipo prodotto: solo due categorie" sotto) |
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

## Metodo di trasferimento (transfer mode) — implementato 28/07/2026 (richiesta committente)

**Cos'è**: per i processi ad arco con filo continuo (MIG/MAG e filo animato — ISO 4063 131/135/136/138) il metallo d'apporto passa dal filo al bagno di saldatura in modi fisicamente diversi: **spray arc** (getto continuo di gocce fini), **pulsed arc** (arco pulsato, variante controllata dello spray), **short arc/short-circuit** (arco corto, il filo tocca il pezzo periodicamente — detto anche "dip"), **globular** (gocce grandi e irregolari). Non è un parametro applicabile a processi senza filo continuo in arco (111 elettrodo rivestito, 121 arco sommerso, 141/145 TIG, 311 ossiacetilenica).

**Base normativa trovata (testo originale, non dedotta)**:
- §5.2 (variabili essenziali, eccezioni di processo): *"qualifying the welder for dip (short-circuit) transfer mode (131, 135 and 138) shall qualify him for other transfer modes, but not vice versa."* — il transfer mode è quindi trattato dalla norma come parte delle condizioni verificate dalla prova, con una regola di continuità esplicita.
- §9.3 (modulo certificato ufficiale, Annex): la tabella "Range of qualification" del certificato elenca **"Welding process(es); Transfer mode"** come riga combinata — conferma che il transfer mode è un dato da registrare sul certificato del saldatore, non solo sul WPS/WPQR.

**Decisione presa**: il campo è normativamente pertinente al patentino saldatore (non solo al WPS) e mancava nel modulo Qualifiche pur essendo già gestito come testo libero nel WPQR (`welding.controller.js`, colonna `metal_transfer`). Aggiunto come campo **selezionabile** (enum: spray_arc/pulsed_arc/short_arc/globular, più controllato del testo libero WPQR data la lista chiusa di valori standard) su `qualifications.transfer_mode` (migrazione 136), visibile **solo** quando il processo di saldatura scelto è 131/135/136/138 (`getApplicableWelderFields` in `weldingQualificationRules9606.js`, stesso pattern già usato per il diametro tubo condizionato al tipo prodotto).

**Scelta di non estendere il calcolo del range di validità**: la regola di continuità del §5.2 (dip qualifica anche gli altri transfer mode) non è stata codificata come logica automatica di copertura (es. in `qualificationCoverage.js`/`getCoverage`) — l'intervento resta limitato a registrazione/estrazione del dato, come richiesto per evitare di introdurre logica di matching non esplicitamente richiesta. La nota resta descrittiva in questo documento per un'eventuale implementazione futura, se necessaria.

## Tipo di giunto (BW/FW)

- BW qualifica sempre BW; non qualifica FW (e viceversa), **salvo** prova supplementare di filetto (spessore minimo 10 mm, posizione PB) eseguita in aggiunta — in tal caso qualifica anche PA/PB per giunti d'angolo.
- BW su tubo qualifica diramazioni con angolo ≥60° nello stesso campo di validità delle tabelle piastra/tubo.

## "Tipo prodotto": solo due categorie (P/T) — non esiste una terza categoria "tubo-piastra" (verificato 27/07/2026)

> **Origine della verifica**: segnalazione reale del cliente Studio Mason (coordinatore saldatura, 27/07/2026) — "nella scelta del tipo prodotto dovrebbe darci la possibilità di scegliere anche tubo-piastra, altrimenti il programma legge un tubo-piastra come solo tubo in FW". Verificato sul testo originale della norma (non dedotto): `docs/Normative/Normative NORMA_00018_ UNI EN ISO 9606-1_2017 Rev. 0.md`.

**Trovato esplicitamente nel testo della norma:**

- §5.1 (variabili essenziali): *"The essential variables are: welding process(es); **product type (plate or pipe)**; type of weld (butt or fillet); ..."* — il tipo prodotto è definito come variabile binaria, **solo** piastra o tubo.
- §11 (designazione qualifica, ordine dei codici): *"2) product type: **plate (P), pipe (T)**, refer to 4.3.1 and 5.3"* — i codici ammessi dalla norma per questa variabile sono **solo** `P` e `T`.
- §3.16 (definizioni): *"**branch joint**: joint of one or more tubular parts to the main pipe or to a shell"* — la "diramazione/branch/bocchello" è definita dalla norma come un **tipo di giunto** (una geometria particolare di giunto d'angolo/fillet), non come una terza categoria di "tipo prodotto".
- §5.4 (tipo di giunto, criterio c): *"Butt welds in pipes qualify branch joints with an angle ≥60° and the same range of qualification as in Tables 1 to 12. For a branch weld, **the range of qualification is based on the outside diameter of the branch**"* — per una diramazione (es. bocchello che si inserisce in un tubo o in una piastra/shell), il campo di validità si calcola sul diametro del **ramo** (branch), non su quello del tubo/piastra principale.
- Tabella 13 (metodi di prova): la colonna è *"Fillet weld and branch joint (in plate or pipe)"* — confermando che una diramazione è sempre trattata come variante del giunto d'angolo (FW), eseguibile sia su tubo che su piastra come corpo principale.

**Conclusione (fatto normativo, non interpretazione)**: un bocchello/tubo che si inserisce ortogonalmente in una piastra (o in un altro tubo) è un **giunto di derivazione (branch joint)** — una variante del **tipo di giunto FW**, non un terzo "tipo prodotto". Il campo "Tipo prodotto" resta correttamente `P`/`T` secondo la norma. Il problema segnalato da Mason non è la mancanza di una terza opzione nel menu, ma la **perdita dell'informazione "è una diramazione"** durante l'estrazione automatica AI — il tipo giunto FW e la nota "derivazione/branch" andrebbero preservati nel campo `weld_details` (dettagli di giunto) anche quando `product_type` resta `T`. Fix implementato in `weldingQualificationRules9606.js::buildWelderQualificationRulesPromptSection` + `documentTypeSchemas.js` (istruzioni AI aggiornate per non perdere questa indicazione).

## Range di qualificazione diametro tubo (ISO 9606-1 Tabella 7 — verificato, leggibile nell'estratto)

| Diametro esterno provino D | Campo di validità |
|---|---|
| D ≤ 25 mm | da D a 2D |
| D > 25 mm | > 0,5·D (minimo 25 mm) |

Codificato in `weldingQualificationRules9606.js::computeQualifiedPipeDiameterRange`.

### Nota aggiuntiva — provino SOLO piastra, posizioni PA/PB/PC/PD (VERIFICATA nel testo — 27/07/2026)

> **Aggiornamento 27/07/2026**: la regola segnalata da Studio Mason (cliente reale, feedback
> 16/07/2026) sulla base di patentini in campo è stata **ritrovata e confermata nel testo
> originale della norma**, §5.3 "Product type", durante la verifica della segnalazione
> "tubo-piastra" (v. sezione sopra). Non è più un GAP/dato da confermare: era solo mancante
> nell'estratto sintetico di questo catalogo. Testo originale (§5.3, criteri a/b/c):
>
> - a) *"test piece welds with outside pipe diameter D ≥ 25 mm cover welds in plates"*
> - b) *"test piece welds in plates cover welds in fixed pipe of outside pipe diameter D ≥ 500 mm; in accordance with Tables 9 and 10"*
> - c) *"test piece welds in plates cover welds in rotating pipes of outside pipe diameter D ≥ 75 mm for welding positions PA, PB, PC, and PD; in accordance with Tables 9 and 10"*
>
> Confermano esattamente i valori riportati da Mason: piastra in PA/PB/PC/PD copre tubi fissi
> **≥500 mm**, o **≥75 mm** se la posizione di prova è rotante. Codificata come funzione
> consultiva in `weldingQualificationRules9606.js::describePlateOnlyRotatingPositionDiameterNote`
> (resta un suggerimento/hint per la revisione umana, non popola automaticamente il registro
> qualifiche — il form non ha ancora un campo dedicato "posizione rotante").

## Range di qualificazione spessore per giunti d'angolo (ISO 9606-1 Tabella 8 — verificata, entrambe le righe)

| Spessore provino t | Campo di validità |
|---|---|
| t < 3 mm | da t a 2t, o 3 mm, il maggiore dei due |
| t ≥ 3 mm | da 3 mm, nessun limite superiore |

Codificato in `weldingQualificationRules9606.js::computeQualifiedFilletThicknessRange` (la riga t≥3 era GAP nelle sessioni precedenti, risolta il 26/07/2026 — vedi nota sulla fonte in cima al documento).

## Range di qualificazione spessore depositato per giunti testa a testa (ISO 9606-1 Tabella 6 — §5.7, verificata)

La tabella più usata in pratica (giunti BW, la maggioranza dei casi reali). Spessore provino `s`:

| Spessore depositato del provino s | Campo di validità |
|---|---|
| s < 3 mm | da s a 3 mm, oppure da s a 2s, il maggiore dei due |
| 3 ≤ s < 12 mm | da 3 mm a 2s |
| s ≥ 12 mm | da 3 mm, nessun limite superiore (nota e: provino saldato in almeno 3 passate) |

**Note della norma (§5.7, footnote):**
- Per saldatura ossiacetilenica (processo ISO 4063 **311**): il moltiplicatore "2s" è sostituito da "1,5s" in entrambe le prime due righe (note c/d).
- Per giunti su diramazione (branch): il criterio di spessore si applica al ramo (set-on) oppure al tubo/corpo principale (set-through/set-in) — vedi Figura 1 della norma.
- Per processo singolo e stesso tipo di materiale d'apporto, `s` coincide con lo spessore del materiale base `t` del provino.

Codificato in `weldingQualificationRules9606.js::computeQualifiedThicknessRangeButtWeld` (GAP totale nelle sessioni precedenti, risolta il 26/07/2026 — vedi nota sulla fonte in cima al documento).

## Posizioni di saldatura (ISO 6947) — matrice Tabelle 9/10 (§5.8, verificata)

Le posizioni valide/qualificate per BW e FW sono elencate nelle Tabelle 9 e 10 della norma, come matrice posizione-provino × posizione-qualificata (simbolo `×` = qualificato, `—` = non qualificato). Ricostruita il 26/07/2026 (era GAP nelle sessioni precedenti — vedi nota sulla fonte in cima al documento).

**Tabella 9 — giunti testa a testa (BW):**

| Posizione provino | Posizioni qualificate |
|---|---|
| PA | PA |
| PC | PA, PC |
| PE (piastra) | PA, PC, PE |
| PF (piastra) | PA, PF |
| PH (tubo) | PA, PE, PF |
| PG (piastra) | PG |
| PJ (tubo) | PA, PE, PG |
| H-L045 | PA, PC, PE, PF |
| J-L045 | PA, PC, PE, PG |

**Tabella 10 — giunti d'angolo (FW):**

| Posizione provino | Posizioni qualificate |
|---|---|
| PA | PA |
| PB | PA, PB |
| PC | PA, PB, PC |
| PD | PA, PB, PC, PD, PE |
| PE (piastra) | PA, PB, PC, PD, PE |
| PF (piastra) | PA, PB, PF |
| PH (tubo) | PA, PB, PC, PD, PE, PF |
| PG (piastra) | PG |
| PJ (tubo) | PA, PB, PD, PE, PG |

Codificato in `weldingQualificationRules9606.js::computeQualifiedWeldingPositions` / `isWeldingPositionQualified`.

Regola generale confermata nel testo (§5.8): una prova su tubo in **PH o PJ** (rotazione parziale, D ≥ 150 mm, 2/3 di circonferenza) più una in **PC** (1/3 di circonferenza) con un solo provino coprono anche, rispettivamente, H-L045 (avanzamento verso l'alto) e J-L045 (avanzamento verso il basso) — dettaglio non ancora modellato come calcolo automatico (i due provini vanno registrati separatamente).

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
| `product_type` | Solo `P` (piastra) o `T` (tubo) — mai una terza categoria. Se il documento indica un giunto di derivazione/branch/bocchello (tubo-piastra), il tipo prodotto resta `T` (§3.16/§5.4c: la diramazione è un tipo di giunto, il ramo qualificato è sempre tubolare) — **non perdere l'informazione**: riportare comunque la dicitura originale in `weld_details` |
| Range diametro tubo | Se il certificato riporta un diametro provino, applicare Tabella 7 sopra per calcolare il campo coperto — **solo** se il documento non riporta già il range esplicito |
| Range spessore | Se il certificato riporta lo spessore del provino (`s` per BW Tabella 6, `t` per FW Tabella 8) applicare le formule sopra — **solo** se il documento non riporta già il range esplicito; se i due valori non coincidono, preferire quello esplicito e segnalare la discrepanza come warning, non sovrascrivere |
| Posizioni qualificate | Se il certificato riporta la sola posizione del provino testato, `computeQualifiedWeldingPositions` può derivare l'elenco posizioni coperte (Tabelle 9/10) — usare come suggerimento/cross-check, non per sostituire un elenco posizioni già esplicito sul certificato |
| Validità (2/3 anni) | Non assumere un valore fisso: dipende dall'opzione di rivalidazione scelta (a/b/c) — se il certificato non lo specifica, lasciare `null` + warning |
| `transfer_mode` | Estrarre **solo** se `welding_process` è 131/135/136/138 e il certificato lo riporta esplicitamente (spray_arc/pulsed_arc/short_arc/globular) — per altri processi lasciare `null`, il parametro non esiste |

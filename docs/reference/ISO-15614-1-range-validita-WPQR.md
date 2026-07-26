
# ISO 15614-1:2017 — Livelli, range di qualificazione e campi WPQR (riferimento operativo SGQ)

> **Uso**: assistente AI, ingest WPQR, modulo 3834.
> **Fonte**: estratto operativo da BS EN ISO 15614-1:2017 "Specification and qualification of welding procedures for metallic materials — Welding procedure test — Part 1: Arc and gas welding of steels and arc welding of nickel and nickel alloys". Testo integrale nel Patrimonio Studio — **qui solo tabelle/regole sintetiche**, mai testo normativo copiato.
> **Digitalizzazione**: `docs/Normative/Normative NORMA_00019_ UNI EN ISO 15614-1_2017 Rev. 0.md` (+ `.json`).
> **Cataloghi collegati**: `materialGroups15608.js`, `weldingProcesses4063.js`, `weldingPositions6947.js`.
> **Codice**: `weldingQualificationRules15614.js` (app + backend mirror).

## Nota sulla fonte di questo estratto (qualità estrazione — aggiornata 26/07/2026)

Ri-estratto il 26/07/2026 con `backend/scripts/pdf_to_json/` dopo il fix del 26/07/2026 (`quality.py`, rilevamento caratteri riordinati/invertiti). **Nessuna pagina di questo PDF è stata segnalata come corrotta/invertita** dal controllo di leggibilità: il font non è "anti-copia" come in ISO 9606-1/14341, quindi quel fix specifico non era il problema qui. Il vero miglioramento è che le **tabelle a griglia (5, 6, 7, 8, 9)** sono ora estratte come vere tabelle Markdown pulite (righe/colonne corrette) grazie al rilevamento tabellare nativo di `pdfplumber`, invece del testo a flusso libero che le "interfogliava" nella digitalizzazione precedente. Risultato:

- **Tabelle 5 e 6** (matrice compatibilità gruppi materiale acciaio / nichel) — **prima GAP totale** ("troppo interfogliate, non trascritte"), **ora leggibili** come matrici pulite (vedi sotto). Non ancora codificate in JS (vedi motivazione in fondo).
- **Tabelle 7, 8, 9** (spessore/diametro) — già presenti nella versione precedente con alcune bande "ricostruite"/incerte, **confermate** dalla nuova estrazione indipendente per le parti leggibili. **Persiste** un problema di troncamento (non interfogliamento): nella colonna "Level 1" di Tabella 7, 5 righe su 7 perdono la cifra iniziale "0," (es. "5 to 2 t" invece di "0,5 to 2 t"). Colonna "Level 2" e colonne spessore depositato risultano invece leggibili con le cifre iniziali intatte nella maggior parte dei casi.

**Conclusione qualità**: il fix del 26/07/2026 (caratteri riordinati) non era il meccanismo che ha risolto il problema di questo documento — qui il miglioramento viene dal motore di rilevamento tabelle di `pdfplumber`, già disponibile ma il cui output non era stato usato correttamente nella prima digitalizzazione. Il problema "interfogliamento colonne" segnalato in passato è oggi **risolto per le tabelle a griglia** (5/6/7/8/9); resta un **GAP puntuale e circoscritto** sulla sola colonna Level 1 di Tabella 7 (troncamento cifra iniziale), non un interfogliamento.

## Livelli di qualifica (Level 1 / Level 2)

| Livello | Base | Estensione test | Note |
|---|---|---|---|
| **Level 1** | Requisiti storici tipo ASME BPVC Sezione IX | Estensione test minore | Range di qualificazione generalmente più ampi |
| **Level 2** | Edizioni precedenti di questa norma (EN ISO 15614-1:2004) | Estensione test maggiore | Range di qualificazione generalmente più restrittivi |

**Regola chiave** (testo leggibile, non ambiguo — National foreword + §8.1): una prova qualificata **Level 2 qualifica automaticamente anche Level 1** (non viceversa). Se il contratto o la norma di applicazione **non specifica il livello**, si applicano i requisiti **Level 2** (i più severi) per default.

## Range di qualificazione spessore — giunti testa a testa (Tabella 7, §8.3.2.2)

| Spessore provino t (mm) | Spessore materiale base — Level 1 | Spessore materiale base — Level 2 | Spessore metallo depositato — mono passata | Spessore metallo depositato — multi passata |
|---|---|---|---|---|
| t ≤ 3 | 0,5 t a 2t | *(cella vuota nell'estratto)* | *(cella vuota nell'estratto)* | max. 2s |
| 3 < t ≤ 12 | 1,5 a 2t **(GAP: cifra iniziale incerta)** | 0,5 t (min 3) a 1,3 t | 3 a 2t | max. 2s |
| 12 < t ≤ 20 | **GAP** (estratto: "5 to 2t", manca "0," iniziale) | 0,5 t a 1,1 t | 0,5 t a 2t | max. 2s |
| 20 < t ≤ 40 | **GAP** (idem) | 0,5 t a 1,1 t | 0,5 t a 2t | max. 2s (se s<20) / max. 2t (se s≥20) |
| 40 < t ≤ 100 | **GAP** (idem, "5 to 200") | — (non definito in tabella) | 0,5 t a 2t | max. 2s (se s<20) / max. 200 (se s≥20) |
| 100 < t ≤ 150 | **GAP** (idem) | — | 50 a 2t | max. 2s (se s<20) / max. 300 (se s≥20) |
| t > 150 | **GAP** (estratto: "5 to 1,33 t") | — | 50 a 2t | max. 2s (se s<20) / max. 1,33 t (se s≥20) |

**s** = spessore depositato di ciascun processo nella qualifica multi-processo (non coincide sempre con `t`, il provino testato). Per questo motivo le colonne "spessore metallo depositato" **non sono state codificate in JS**: richiedono di conoscere `s` per singolo processo, un dato che l'ingest oggi non estrae in modo affidabile a livello di singolo processo.

**Regole aggiuntive confermate (testo leggibile, non ambiguo, codificate)**:
- Prova d'urto (impact test) richiesta: provino ≥16 mm → spessore minimo qualificato 16 mm; provino <16 mm → minimo qualificato = spessore del provino; provino ≤6 mm → minimo qualificato = 0,5× spessore provino. **Codificato**: `computeMinimumQualifiedThicknessWithImpactTest`.
- Processi 114/12x/13x con passata >13 mm: spessore massimo materiale base qualificato = 1,1×t (regola generale, non per-riga tabella). **Non codificata** (serve sapere lo spessore della singola passata, dato non sempre disponibile nell'ingest).

**GAP dichiarato**: la colonna "Level 1" per t>3mm **non è codificata** in JS (5 righe su 7 hanno la cifra "0," troncata in testa — rischio di calcolare un range 10× più ampio del reale, es. "5 to 2t" letto come "5mm" invece di "0,5×t"). Solo la colonna "Level 2" per le bande 3–40mm è codificata (cifre iniziali intatte e confermate su due estrazioni indipendenti).

## Range di qualificazione — giunti d'angolo (Tabella 8, §8.3.2.2 — confermata, codificata)

| Spessore provino t | Gola (throat thickness) qualificata | Note |
|---|---|---|
| t ≤ 3 mm | 0,7 t a 2t | + spessore materiale "0,75a a 1,5a" (a = gola nominale in pWPS) e "nessuna restrizione" mono/multi passata — non codificati (variabile diversa da t) |
| 3 < t < 30 mm | 3 a 2t | valore minimo fisso 3 mm (non proporzionale a t) — confermato su due estrazioni indipendenti |
| t ≥ 30 mm | ≥5 mm (solo minimo, nessun massimo definito nell'estratto) | |

**Codificata**: `computeQualifiedFilletThroatThicknessRange`.

Regola aggiuntiva confermata: se un giunto d'angolo è qualificato tramite prova su giunto testa a testa, il range della gola si basa sullo spessore del metallo depositato (non codificata: richiede dato "spessore depositato" separato).

## Diametro tubo (Tabella 9, §8.3.3 — confermata, codificata)

- **Level 1**: il diametro **non è variabile essenziale** — qualsiasi forma prodotto (piastra, tubo, fucinato, fusione) qualifica per tutte le forme.
- **Level 2**: il diametro **è** variabile essenziale. Range di qualificazione: **D ≥ 0,5×D_provino** (nessun limite massimo definito in tabella).
- **Regola piastra→tubo** (paragrafo, testo integrale leggibile, non da tabella): una qualifica su **piastra** copre anche **tubo** con diametro esterno **>500 mm**, oppure **>150 mm** se saldato in posizione **PC**, **PF ruotata** o **PA ruotata**.

**Codificate**: `describeQualifiedPipeDiameterRangeLevel2`, `describePlateCoversPipeDiameterLevel2`, `isDiameterEssentialVariable`.

## Angolo diramazione (branch connection, §8.3.4 — confermata, non codificata come funzione: solo 1 soglia semplice)

Provino con angolo α tra 60° e 90° qualifica 60°≤α<90°; angolo <60° richiede prova dedicata e qualifica da α fino a 90°. Level 1: l'angolo non è variabile essenziale.

## Gruppi materiale coperti da qualifica (Tabella 5 acciai, Tabella 6 nichel/acciaio — ORA LEGGIBILI, non ancora codificate in JS)

**Aggiornamento 26/07/2026**: a differenza della digitalizzazione precedente (GAP totale, "troppo interfogliate"), la nuova estrazione produce matrici pulite e leggibili. Esempio Tabella 5 (gruppi acciaio, righe 1-4 di 11, materiale provino → materiali coperti):

| Materiale provino (riga) | Gruppo 1 | Gruppo 2 | Gruppo 3 | Gruppo 4 |
|---|---|---|---|---|
| 1 | 1-1 | — | — | — |
| 2 | 1-1, 2-1 | 1-1, 2-1, 2-2 | — | — |
| 3 | 1-1, 2-1, 3-1 | 1-1, 2-1, 2-2, 3-1, 3-2 | 1-1, 2-1, 2-2, 3-1, 3-2, 3-3 | — |
| 4 | 4-1 | 4-1, 4-2 | 4-1, 4-2, 4-3 | 4-1, 4-2, 4-3, 4-4 |

(Matrice completa 11×11 nel Markdown digitalizzato, righe 5–11 su pagina successiva; Tabella 6 nichel/acciaio 8×8 + combinazioni con gruppi 1/2/3/5/6/8/11 anch'essa leggibile.)

**Perché NON è ancora codificata in JS** (nonostante ora leggibile): è una matrice 11×11 (+ Tabella 6) con footnote di eccezione (a/b/c: sottogruppi, gruppo padre, leghe a soluzione solida/precipitazione) che modificano la lettura di singole celle. Un errore di trascrizione riga/colonna in una matrice di compatibilità materiali avrebbe impatto diretto su una decisione di conformità/certificazione — rischio più alto rispetto a una formula aritmetica su un solo parametro (spessore/diametro). **Prossimo passo se si vuole chiudere il gap**: verifica visiva riga-per-riga sulla pagina PDF originale (27-29) prima di trasformare la matrice in lookup table JS.

**Regola generale non ambigua e sicura da applicare oggi**: il campo `material_group` estratto/inserito va sempre riportato **come singolo gruppo/sottogruppo testato**, senza inferire automaticamente altri gruppi coperti (finché la matrice non è codificata e verificata).

## Numero di passate (single run / multi-run)

Variabile essenziale trasversale (non una tabella a sé): un cambio da multi-passata a mono-passata (o viceversa, su un lato) richiede nuova qualifica quando sono richieste prove d'urto o durezza (§8.4.3). Campo WPQR: `single_multi_run` (`single`|`multi`), già presente nello schema ingest (RC-6/DEPUTYTASK1).

## Posizione di saldatura (§8.4.2 — regola generale confermata, non tabellare)

Se non sono richieste prove d'urto né di durezza, la saldatura del provino in **qualsiasi posizione** (tubo o piastra) qualifica **tutte le posizioni** (tubo o piastra). Se sono richieste, servono provini nella posizione a massimo e minimo apporto termico (tipicamente PF/PA per il massimo, PC/PE per il minimo su giunti testa a testa in piastra). Saldatura verticale discendente (PG, PJ, J-L045) richiede provino specifico.

## Campi essenziali WPQR (§8, elenco confermato + modulo certificato pag. finale norma)

| Campo | Fonte |
|---|---|
| Processo di saldatura | ISO 4063 |
| Tipo di giunto (BW/T-joint/branch/fillet) | — |
| Materiale base (gruppo/sottogruppo) | ISO/TR 15608 — **solo gruppo testato, non inferire coperture (Tabella 5/6 GAP codice)** |
| Materiale d'apporto | Designazione + gruppo |
| Spessore testato → range qualificato | Tabelle 7/8 (vedi sopra: Level 2 e Tabella 8 codificati, Level 1 GAP) |
| Diametro testato → range qualificato | Tabella 9 — **codificato** (Level 2: ≥0,5×D) |
| Posizione di saldatura | ISO 6947 |
| Livello (Level 1 / Level 2) | Dichiarato o default Level 2 se assente |
| Angolo diramazione (branch) | 60°–90° in prova → qualifica 60°≤α<90°; angolo <60° richiede prova dedicata |
| Mono/multi passata | `single_multi_run` |

## Regole per l'estrazione AI (ingest WPQR)

| Campo | Regola |
|---|---|
| `qualification_level` | `1` o `2`; se il documento non lo specifica esplicitamente, **non assumere `2` di default nel dato estratto** — lasciare `null` + warning (il default normativo "Level 2 se non specificato" è una regola contrattuale, non un dato del certificato) |
| Range spessore (Level 2, bande 3–40mm) | Può essere calcolato con `computeQualifiedMaterialThicknessRangeLevel2` **solo per cross-check/suggerimento**, mai per sovrascrivere un valore dichiarato esplicitamente sul WPQR |
| Range spessore (Level 1, o Level 2 oltre 40mm) | **Non calcolare** — GAP colonna Level 1 (troncamento cifra), Level 2 oltre 40mm non definito in tabella |
| Range diametro (Level 2) | Può essere calcolato con `describeQualifiedPipeDiameterRangeLevel2` come suggerimento; estrarre sempre il valore dichiarato se presente |
| Gola giunti d'angolo | `computeQualifiedFilletThroatThicknessRange` disponibile come suggerimento (Tabella 8 completa) |
| Gruppo materiale coperto | Solo il gruppo testato, mai inferire compatibilità incrociate (Tabella 5/6 leggibili ma non ancora codificate — vedi sezione dedicata) |

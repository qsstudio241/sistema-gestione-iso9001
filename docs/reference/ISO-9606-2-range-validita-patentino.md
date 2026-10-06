# ISO 9606-2:2004 — Range di qualificazione e validità patentino saldatore alluminio (riferimento operativo SGQ)

> **Uso**: verifica qualifiche vs norma (epic [`PLAN_VERIFICA_QUALIFICHE_NORMA_SLICES.md`](../agent-tasks/PLAN_VERIFICA_QUALIFICHE_NORMA_SLICES.md), slice VQ-10), assistente AI, ingest patentini saldatori alluminio.
> **Fonte**: estratto operativo da EN ISO 9606-2:2004 (seconda edizione, 2004-12-15, `NORMA_00032`: `docs/Normative/Normative NORMA_00032_ UNI EN ISO 9606-2_2004 Rev. 0.md/.json`, digitalizzata 25/08/2026). **Edizione unica**: non esistono altre edizioni da coprire. Testo integrale nel Patrimonio Studio — **qui solo tabelle/regole sintetiche**, mai testo normativo copiato.
> **Schema**: parallelo a [`ISO-9606-1-range-validita-patentino.md`](ISO-9606-1-range-validita-patentino.md) (stesse sezioni, stessa sequenza) per facilitare il confronto; la sezione «Differenze da 9606-1» è il punto di arrivo.
> **Cataloghi collegati (solo lettura)**: `app/src/data/materialGroups15608.js` (gruppo materiale; **manca il gruppo `26`**), `weldingProcesses4063.js`, `weldingPositions6947.js`. **Nessuna funzione JS** per 9606-2 oggi (le regole sono VQ-10).
> **Stato della revisione**: 06/10/2026, slice VQ-3 (solo documentazione). Ogni numero ha clausola/tabella + `NORMA_00032`. Nessuna soglia ricavata a memoria.

## Nota sulla fonte di questo estratto (qualità estrazione)

Legenda dello **stato di leggibilità** usata in tutte le tabelle:

| Stato | Significato |
|---|---|
| `leggibile` | Il testo/le celle del Markdown `NORMA_00032` sono lette direttamente, senza ricostruzione |
| `ricostruita da glifi` | Celle perse dall'estrazione e ricostruite rileggendo i glifi (come per 9606-1 Tab. 6/9/10). **Per 9606-2 non serve**: nessuna riga di questo documento usa questo stato |
| `GAP` | Non leggibile con certezza o non risolvibile senza il PDF / un'altra norma: **non** inventare, vedi sezione «GAP / da confermare con il PDF» |

Verifica fatta il 06/10/2026 sul file `NORMA_00032`:

- **A differenza di `NORMA_00018` (9606-1) il font di 9606-2 non è «anti-copia»**: i simboli `≤`, `≥`, `×` sono caratteri Unicode standard o lettere `X` (l'unico carattere in area privata è U+F8E7, un punto elenco nel Foreword). Le tabelle 2–8 sono quindi **leggibili cella per cella** senza rilettura a livello di glifo.
- Le tabelle compaiono due volte nel Markdown (testo scorrevole + tabella pdfplumber) e le due copie **coincidono** (verificato per Tab. 2, 3, 4, 5, 6, 7, 8).
- **Tab. 1** (spessori per giunti a processo singolo e multiprocesso) è una tabella con **figure** (chiavi 1–4): il Markdown ne dà solo la parte testuale → `GAP` parziale (vedi §5.2).
- **Annex B** (esempi di designazione) è leggibile e permette di **incrociare** Tab. 2, 3, 4, 5, 6, 7, 8 (sezione «Verifica incrociata con Annex B»).
- Il PDF **non** è in Git (`docs/Normative/*.pdf` ignorato): ciò che richiede il PDF è marcato `GAP`.

## Scopo e principio generale (§1, Introduzione)

Qualifica dei saldatori per la **saldatura per fusione di alluminio e leghe**, manuale o parzialmente meccanizzata (§1). Non qualifica saldatura completamente meccanizzata/automatica (rimando a EN 1418 / ISO 14732). Principio dell'Introduzione: una prova qualifica il saldatore per le condizioni usate **e** per tutti i giunti considerati più facili da saldare; la prova può servire anche a qualificare una procedura (rimando a ISO 15614-2) se rispetta tutti i requisiti (es. dimensioni del provino). La qualifica del saldatore attesta la **capacità manuale** (§1), non la procedura.

Edizioni precedenti: la seconda edizione annulla e sostituisce ISO 9606-2:1994 e incorpora l'Amd.1:1998; l'Introduzione dice che le qualifiche EN 287-2 / ISO 9606-2 preesistenti, a fine validità, si interpretano secondo questa norma (`NORMA_00032`, Foreword + Introduction). `leggibile`.

## Variabili essenziali (§5.1 — che determinano il campo di validità)

Il §5.1 elenca otto variabili essenziali; **ogni variabile ha un campo di validità** e fuori campo serve una nuova prova. Tutti i provini vanno saldati con le variabili essenziali indipendenti, **tranne** §5.7 e §5.8. Stato: `leggibile`.

| Variabile (§5.1) | Dettaglio | Dove |
|---|---|---|
| a) Processo di saldatura | Solo 131, 141, 15 (§4.2) | §5.2 |
| b) Tipo prodotto | Piastra (P) o tubo (T) | §5.3 |
| c) Tipo di giunto | Testa a testa (BW) o d'angolo (FW) | §5.4 |
| d) Gruppo di materiale base | Gruppi 21–26 (CR ISO 15608) | §5.5, Tab. 2 |
| e) Materiale d'apporto | Con/senza apporto; AlMg→AlSi; He nel gas del 131 | §5.6 |
| f) Dimensioni | Spessore **del materiale** `t` e diametro esterno tubo `D` | §5.7, Tab. 3–5 |
| g) Posizione | Matrice a 10 colonne | §5.8, Tab. 6 |
| h) Dettagli di giunto | Supporto (nb/mb), un lato/due lati, singolo/multi strato | §5.9, Tab. 7–8 |

Differenza strutturale da 9606-1: **non esistono** gruppi FM1–FM6, tipo di rivestimento/filo, né metodo di trasferimento tra le variabili essenziali. Le uniche regole sull'apporto sono in §5.6.

Note del §5.1 (note a piè pagina 2 e 3): «plate» include anche barre estruse piatte; «pipe» include tubo, tubolare e profilo cavo. `leggibile`.

## Processi di saldatura (§4.2, §5.2)

| Regola | Dettaglio | Clausola | Stato |
|---|---|---|---|
| Processi qualificati | **131** (MIG), **141** (TIG), **15** (plasma). Nota: i principi possono essere applicati ad altri processi per fusione | §4.2 | `leggibile` |
| Un processo per prova | Ogni prova qualifica normalmente **un solo** processo; il cambio processo richiede nuova prova | §5.2 | `leggibile` |
| Multi-processo | Ammesso con un solo provino (giunto multiprocesso) o con più prove separate; campi per giunti BW in Tab. 1 | §5.2 | `leggibile` (testo) / `GAP` (Tab. 1, figure) |
| **Corrente del 141** | Per il processo 141 il passaggio **da corrente continua ad alternata e viceversa** richiede nuova prova: è quindi una **variabile essenziale** in 9606-2 | §5.2 | `leggibile` |

Nessuna equivalenza tra processi: a differenza della 9606-1 (§5.2: 135↔138, 121↔125, 141/143/145 → 142, transfer mode) la 9606-2 **non elenca eccezioni**. Non si può dedurre che 141 qualifichi 142/143/145 (la norma non li cita). Verificato su `NORMA_00032` §4.2 e §5.2.

Rimando ISO 4063 (`NORMA_00044`, edizione 2023): la 9606-2 cita i numeri di riferimento della ISO 4063:1998 (`131`, `141`, `15`). Nella 4063:2023 `131` è «MIG welding with solid wire electrode» (esistono anche 132 e 133 per filo animato), `141` è «TIG welding with solid filler material» (142 = autogeno) e `15` è la **famiglia** plasma (151, 152, 153, 154, 155). La sigla `15` di 9606-2 può quindi comparire sul certificato come `15` oppure con un sottocodice 15x: la regola VQ-10 deve normalizzare al ramo `15` senza inventare equivalenze tra i sottocodici. Fonte: `NORMA_00044` elenco §5 (ricostruito da pymupdf nel MD). `leggibile`.

### Tab. 1 — spessori per giunti a processo singolo e multiprocesso (BW)

Testo leggibile nel Markdown (struttura figurale non disponibile):

| Caso | Spessore di riferimento per Tab. 3 | Stato |
|---|---|---|
| Giunto a processo singolo | processo 1: `t = s1`; processo 2: `t = s2` (s = spessore di metallo d'apporto) | `leggibile` |
| Giunto multiprocesso | `t = s1 + s2` | `leggibile` |
| Variante con supporto (mb) / senza supporto (nb), processo 1 solo per la zona di radice | `t = t1`, `t = t2`, `t = t1 + t2`; «welding process 1 only for welding of the root area» | `GAP` (assegnazione di `t1`/`t2` alle chiavi 1–4 delle figure, non leggibile dal Markdown) |

Riscontro incrociato con l'esempio B.5 (Annex B): 141 radice `s1 = 5 mm` → 2,5–10 mm; 131 riempimento `s2 = 10 mm` → ≥ 6 mm (applica Tab. 3 a ciascun processo con il proprio `s`). **La regola multiprocesso non va codificata** finché il PDF non conferma le figure: oggi `welding_process_test` è singolo (nessun dato per la combinazione) → `non_verificabile_dato_mancante`.

## Tipo prodotto (§5.3)

| Criterio | Dettaglio | Clausola | Stato |
|---|---|---|---|
| a) Tubo → piastra | La prova su **tubo con D > 25 mm** qualifica anche la saldatura su piastra | §5.3 a) | `leggibile` |
| b) Piastra → tubo | La prova su piastra qualifica tubo con **D ≥ 150 mm** per le posizioni **PA, PB, PC**, con **D ≥ 500 mm** per **tutte le altre** posizioni | §5.3 b) | `leggibile` |

Note: la 9606-2 ammette solo piastra o tubo (§5.1 b). Una piastra in PA/PB/PC copre tubi D ≥ 150 mm (esempi B.1, B.2, B.4: «P → T: D ≥ 150 mm»). La Tab. 6 richiama «Additionally the requirements of 5.3 and 5.4 shall be observed» (nota a). Il §5.7 per le diramazioni (branch) è in «Dimensioni».

## Tipo di giunto (§5.4)

| Criterio | Dettaglio | Clausola | Stato |
|---|---|---|---|
| a) | BW qualifica BW in qualsiasi tipo di giunto, **tranne** le diramazioni (vedi c) | §5.4 a) | `leggibile` |
| **b)** | Se la **maggior parte del lavoro è d'angolo**, il saldatore va qualificato **anche** con un'opportuna prova d'angolo; se la maggior parte è **testa a testa**, **BW qualifica FW** | §5.4 b) | `leggibile` |
| c) | BW su tubo **senza supporto** qualifica diramazioni con angolo **≥ 60°** con lo stesso campo di Tab. 1–7; per una diramazione il campo si basa sul diametro esterno **del ramo** | §5.4 c) | `leggibile` |
| d) | Se il tipo di giunto non è qualificabile con BW/FW (es. diramazione, saldatura di finitura su getti, preriscaldo) si usa un provino specifico (rimando a prEN ISO 15614-4:2003, Fig. 1–2, per i getti) | §5.4 d) | `leggibile` |

Cross-check con Annex B: «BW → `BW, FW (see 5.4 b)`» (B.2, B.3, B.4, B.5, B.6, B.7); «FW → `FW`» (B.1). Quindi in 9606-2 **BW copre FW senza prova supplementare** (a differenza di 9606-1 §5.4 b/e), mentre **FW non copre BW**. I provini FW qualificano per FW: sl→sl; ml→sl, ml (Tab. 8).

## Gruppi di materiale base (§5.5, Tab. 2)

§5.5.1: i gruppi si basano su **CR ISO 15608** (non ISO/TR 15608:2013 — **GAP**: edizione CR non presente in repo, vedi sezione GAP). §5.5.2: la saldatura di un materiale di un gruppo qualifica per tutti gli altri materiali dello stesso gruppo e per gli altri gruppi di Tab. 2; fuori dal sistema di gruppi serve una prova separata.

| Gruppo del provino | Gruppi qualificati |
|---|---|
| 21 | 21, 22 |
| 22 | 21, 22 |
| 23 | 21, 22, 23 (nota b: «see also 5.6») |
| 24 | 24, 25 |
| 25 | 24, 25 |
| 26 | 24, 25, 26 |

Stato Tab. 2: `leggibile` (copia testo e tabella coincidono). Regole aggiuntive (§5.5.2):

- Un provino tra materiali dei gruppi **21–23** e dei gruppi **24 o 25** qualifica **qualsiasi giunto dissimile** tra combinazioni di 21–23 con 24/25. `leggibile`.
- Qualsiasi giunto dissimile con il gruppo **26** richiede una **prova specifica**. `leggibile`.

Osservazioni (da non risolvere a memoria):

- La nota b di Tab. 2 («see also 5.6») rimanda a §5.6, che parla di materiali d'apporto e **non** contiene alcuna condizione sul gruppo 23: il rimando è **non risolvibile dal testo** → `GAP`.
- Le **descrizioni dei gruppi** sono presenti solo come etichette di esempio in Annex B (21 = alluminio puro; 22 = leghe non trattabili termicamente; 23 = leghe trattabili termicamente) e non definiscono 24, 25, 26. La composizione dei gruppi è nella CR ISO 15608 (non in repo) → `GAP` (richiesta HITL 5 di 6).
- Il catalogo `materialGroups15608.js` oggi **non** ha il gruppo `26`; la sintesi `ISO-TR-15608-gruppi-materiali.md` lo riporta come «Al-Cu» ma è una sintesi, non testo ufficiale.

## Materiali d'apporto (§5.6)

La 9606-2 **non** ha i gruppi FM1–FM6 di 9606-1: le regole sono quattro frasi (§5.6, `leggibile`):

| Regola | Clausola |
|---|---|
| La qualifica **con** metallo d'apporto (es. processi 141 e 15) qualifica per la saldatura **senza** apporto, **non viceversa** | §5.6 |
| La qualifica con apporto tipo **AlMg** qualifica l'uso di apporto tipo **AlSi**, **non viceversa** | §5.6 |
| Per il processo **131**, un aumento del tenore di **elio** nel gas di protezione **oltre il 50 %** richiede una nuova prova | §5.6 |
| Abbreviazioni apporto: `nm` = senza apporto, `S` = filo/bacchetta pieno (§4.3.2) | §4.3.2 |

Nota ISO 14175 (`NORMA_00012`): la ISO 14175:2008 classifica le miscele Ar/He come `I3` con **0,5 ≤ He ≤ 95 %** (Tab. 2, `leggibile`; il simbolo «≤» nel MD è reso come «u»): la **sola classe `I3` non basta** per verificare «He > 50 %», serve la composizione nominale nella designazione completa (es. `ISO 14175 – I3 – ArHe – 30`, `NORMA_00012` §5.2.2, esempio 2). Il gas di protezione/ausiliario va sul certificato ma **non** nella designazione (§11, Annex A).

## Dimensioni (§5.7, Tab. 3, 4, 5)

La prova BW si basa sullo **spessore del materiale `t`** (non sullo spessore depositato `s` della 9606-1) e sul diametro esterno del tubo. Nota di §5.7: spessori e diametri **non vanno misurati con precisione**, si applica la filosofia dei valori di tabella. Stato: tutte `leggibile`.

### Tab. 3 — BW, spessore del materiale del provino `t` (§5.7)

| Spessore `t` del provino | Campo di validità |
|---|---|
| t ≤ 6 mm | da 0,5 t a 2 t |
| t > 6 mm | ≥ 6 mm (nessun limite superiore) |

**Conferma del valore annotato nel piano di charting** (`t ≤ 6: 0,5t–2t; t > 6: ≥ 6`): corretto. Osservazioni: al confine `t = 6` si applica la riga superiore (campo 3–12 mm, **non** «≥ 6»), mentre appena sopra (`t = 6,1`) il campo diventa «≥ 6»: discontinuità **come scritta nella norma**, da usare nelle fixture ai bordi (esempio B.3: `t = 3` → 1,5–6 mm; B.2: `t = 15` → ≥ 6 mm; B.7: `t = 8` → ≥ 6 mm).

Tab. 3 è anche la tabella per il ramo di una diramazione (vedi sotto) e per lo spessore in giunti multiprocesso (titolo: «material thickness and weld metal thickness (multi process)»).

### Tab. 4 — Diametro esterno del tubo `D` (§5.7)

| Diametro esterno del provino `D` | Campo di validità |
|---|---|
| D ≤ 25 mm | da D a 2 D |
| D > 25 mm | ≥ 0,5 D (minimo 25 mm) |

Nota a: per profili cavi strutturali `D` è la dimensione del lato **minore**. Cross-check Annex B: `D150` → ≥ 75 mm (B.3), `D200` → ≥ 100 mm (B.5), `D100` → ≥ 50 mm (B.7), `D30/D150` → ≥ 25 mm (B.6: il più piccolo ammesso da D30 è 15 mm, che il minimo di 25 mm alza).

### Tab. 5 — FW, spessore del materiale `t` (§5.7)

| Spessore `t` del provino | Campo di validità |
|---|---|
| t < 3 mm | da t a 3 mm |
| t ≥ 3 mm | ≥ 3 mm (nessun limite superiore) |

**Conferma del valore annotato nel piano** (`t < 3: t–3; t ≥ 3: ≥ 3`): corretto. Nota a: «see also Table 8» (tecnica a strati). Cross-check: B.1 `t = 10` → ≥ 3 mm. **Diverso da 9606-1 Tab. 8** (`t < 3` → da t a 2t o 3 mm, il maggiore): per `1,5 < t < 3` i due campi differiscono (9606-2: fino a 3 mm; 9606-1: fino a 2t).

### Diramazioni (§5.7) e provini di dimensioni diverse

| Caso | Criterio | Stato |
|---|---|---|
| Ramo «set-on» | Tab. 3/4 applicate allo **spessore e al diametro del ramo** | `leggibile` |
| Ramo «set-in» / «set-through» | Tab. 3 sullo **spessore del tubo principale/guscio**; Tab. 4 sul **diametro del ramo** | `leggibile` |
| Provini con D o t diversi | Qualificato dal più sottile al più spesso (Tab. 3) e dal diametro minore al maggiore (Tab. 4) | `leggibile` |

Le figure delle diramazioni **non sono** nel Markdown di `NORMA_00032`: set-on/set-in/set-through restano quelli del testo (nessuna Figura «Branch types» leggibile come nella 9606-1).

## Posizioni di saldatura (§5.8, Tab. 6)

Simboli riferiti a **EN ISO 6947** (edizione citata nella norma: 1993). La tabella è una **matrice 10 × 10**: righe = posizione del provino, colonne = posizioni qualificate. Stato: `leggibile` (copia testo e tabella coincidono; le X sono lettere). **Ordine delle colonne**: `PA, PB, PC, PD, PE, PF (Plate), PF (Pipe), PG (Plate), PG (Pipe), H-L045`; l'intestazione del Markdown è disordinata («PA PB b PC PD b PE PF PF PG PG H-L045 (Plate) (Pipe) (Plate) (Pipe)») ma l'ordine è **confermato** dagli esempi di Annex B (B.3, B.7) e dalle etichette di riga.

| Posizione del provino | PA | PB | PC | PD | PE | PF (pl) | PF (tubo) | PG (pl) | PG (tubo) | H-L045 |
|---|---|---|---|---|---|---|---|---|---|---|
| PA | × | × | – | – | – | – | – | – | – | – |
| PB (nota b) | × | × | – | – | – | – | – | – | – | – |
| PC | × | × | × | – | – | – | – | – | – | – |
| PD (nota b) | × | × | × | × | × | × | – | – | – | – |
| PE | × | × | × | × | × | × | – | – | – | – |
| PF (piastra) | × | × | – | – | – | × | – | – | – | – |
| PF (tubo) | × | × | – | × | × | × | × | – | – | – |
| PG (piastra) | – | – | – | – | – | – | – | × | – | – |
| PG (tubo) | × | × | – | × | × | – | – | × | × | – |
| H-L045 | × | × | × | × | × | × | × | – | – | × |

Note della tabella: (a) si applicano **anche** §5.3 e §5.4; (b) **PB e PD si usano solo per giunti d'angolo** e possono qualificare solo giunti d'angolo nelle altre posizioni.

Regole aggiuntive (§5.8, `leggibile`):

- Provini in posizione su **piastra** qualificano la stessa posizione su **tubi in rotazione** (rimando a §5.3 b).
- La posizione **H-L045** su tubo qualifica per **tutti gli angoli** del tubo.
- Due tubi dello stesso diametro, uno in **PF** e uno in **PC**, qualificano anche il campo di un tubo in **H-L045**. (Esempio B.7: PF + PC → «all, except PG».)
- Per **D ≥ 150 mm** si possono saldare due posizioni (**PF** su 2/3 di circonferenza e **PC** su 1/3) con un provino in posizione fissa.

Cross-check con Annex B: B.1 `PB` (FW) → PA, PB ✓; B.2 `PA` (BW) → PA, PB ✓; B.3 `PF` tubo → PA, PB, PD, PE, PF ✓ (riga «PF tubo»: le colonne PF piastra e PF tubo sono entrambe qualificate); B.7 `PF + PC` → tutte tranne PG ✓.

## Dettagli di giunto (§5.9, Tab. 7, 8)

### Tab. 7 — BW, supporto e lati (`leggibile`)

| Provino | un lato senza supporto (ss nb) | un lato con supporto (ss mb) | due lati (bs) |
|---|---|---|---|
| un lato senza supporto (ss nb) | × | × | × |
| un lato con supporto (ss mb) | – | × | × |
| due lati (bs) | – | × | × |

L'ordine delle colonne della matrice è dedotto dall'ordine delle righe e **confermato** da Annex B: B.2 (`ss mb` → «ss mb, bs»), B.3/B.4/B.6/B.7 (`ss nb` → «ss nb, ss mb, bs»), B.5 (`131` di riempimento → «ss mb, bs»).

### Tab. 8 — FW, tecnica a strati (`leggibile`)

| Provino | single layer (sl) | multi layer (ml) |
|---|---|---|
| single layer (sl) | × | – |
| multi layer (ml) | × | × |

Nota a: **gola** `a` nel campo `0,5 t ≤ a ≤ 0,7 t` (la Fig. 2 e la Fig. 4 indicano invece `0,5 t ≤ a ≤ t` per la gola di progetto: due formulazioni **nella stessa norma**, riportate come scritte). Cross-check: B.1 `sl` → sl; B.2/B.4/B.5/B.6/B.7 «For FW: sl, ml»; B.3 `sl` → «For FW: sl».

## Esame e prove (§6, §7, §8 — sintesi, non usate per i range)

| Voce | Dettaglio | Clausola | Stato |
|---|---|---|---|
| Esaminatore | La saldatura e le prove sono assistite dall'esaminatore o dall'ente; i provini sono marcati con le identificazioni | §6.1 | `leggibile` |
| Condizioni | Saldatura secondo pWPS/WPS EN ISO 15609-1; almeno **un arresto e un riavvio** in radice e in ripresa | §6.3 | `leggibile` |
| Lunghezza d'esame tubi | Minimo 150 mm; se la circonferenza è < 150 mm servono provini aggiuntivi (max tre) | §6.2 | `leggibile` |
| Prove (Tab. 9, BW) | Visivo e radiografico/piegatura/frattura; per **131** con radiografia servono in più due piegature o due fratture | §6.4, Tab. 9 | `leggibile` |
| Prove (FW) | Visivo e frattura (o macro con ≥ 2 sezioni; sui tubi anche radiografia) | §6.4, Tab. 9 | `leggibile` |
| Accettabilità | Livello **B** di EN 30042; livello **C** per eccesso di sovrametallo, convessità, gola eccessiva e penetrazione eccessiva | §7 | `leggibile` |
| Ripetizione | Il saldatore può ripetere la prova; una causa metallurgica estranea richiede una prova aggiuntiva | §8 | `leggibile` |

(La numerazione Tab. 9 «Test methods» è della 9606-2; non è la Tab. 9 «posizioni» della 9606-1.)

## Validità e conferma (§9)

| Regola | Dettaglio | Clausola | Stato |
|---|---|---|---|
| Decorrenza | Dalla **data di saldatura dei provini**, se le prove richieste sono state eseguite con esito accettabile | §9.1 | `leggibile` |
| **Validità del certificato** | **2 anni**, purché il coordinatore di saldatura o il personale responsabile del datore di lavoro confermi che il saldatore ha lavorato nel campo iniziale | §9.2 | `leggibile` |
| **Conferma periodica** | Da ripetere **ogni 6 mesi** | §9.2 | `leggibile` |
| **Prolungamento** | Ogni **2 anni**, a cura di un esaminatore/ente, previa conferma del §9.2 **e**: a) registrazioni/evidenze rintracciabili al saldatore e alla/e WPS di produzione; b) evidenza **volumetrica** (RT o UT) oppure distruttiva (frattura o piegature) su **due saldature eseguite nei sei mesi precedenti**, conservata ≥ 2 anni; c) saldature conformi ai livelli del §7; d) i risultati di b) devono dimostrare che il saldatore ha **riprodotto le condizioni originali** | §9.3 | `leggibile` |
| Variabili da confermare | Annex D (informativo), Tab. D.1: processo, tipo prodotto (tubo/piastra/diramazione), tipo di giunto, gruppo materiale, apporto (designazione), spessore, diametro, posizione, dettagli. **Spessore e diametro possono variare ±50 %** rispetto al provino iniziale | Annex D | `leggibile` |

Cross-check con 9606-1 §9: la 9606-2:2004 **non** ha le opzioni di rivalidazione a) ritest 3 anni / c) validità indefinita con ISO 3834: c'è **una sola** via (conferma semestrale + prolungamento biennale con due saldature). Non esiste una scelta del «metodo» da dichiarare sul certificato: un dato in meno da verificare rispetto a 9606-1 (decisione D7 non necessaria per 9606-2). La **revoca** (9606-1 §9.4) **non** è nel testo letto di 9606-2.

**Nota implementativa**: il record `qualifications` ha già `exam_date`, `expiry_date`, `next_confirmation_due`; la plausibilità per 9606-2 è `expiry − exam = 2 anni` (con `confirmation_interval_months = 6`), mentre per 9606-1 dipende dall'opzione a/b/c. Nessuna regola è codificata in questa slice (VQ-10).

## Certificato e designazione (§10, §11, Annex A, Annex B)

### Certificato (§10)

| Regola | Dettaglio | Stato |
|---|---|---|
| Contenuto | Tutte le variabili essenziali vanno registrate; nessun certificato se una prova richiesta non è superata; emesso sotto la responsabilità dell'esaminatore/ente | `leggibile` |
| Formato | Annex A raccomandato; altro formato ammesso se contiene le informazioni di Annex A | `leggibile` |
| Un certificato per provino | In generale uno per provino; se più provini, un certificato combinato **può** unire i campi, ma **una sola** tra queste variabili essenziali può cambiare: tipo di giunto, posizione, spessore del materiale (salvo gli esempi di §5.7) | `leggibile` |
| Lingua | Raccomandati inglese, francese o tedesco (in combinazione con un'altra lingua) | `leggibile` |
| Prove pratiche e conoscenze | Designate «Accepted» o «Not tested» | `leggibile` |

### Designazione (§11) — ordine delle voci

1. Numero della norma (`EN ISO 9606-2`)
2. Processo/i (§4.2, §5.2, ISO 4063)
3. Tipo prodotto: piastra (P) o tubo (T)
4. Tipo di giunto: BW o FW
5. Gruppo di materiale (§5.5)
6. Materiale d'apporto (§5.6)
7. Dimensioni: spessore `t` e diametro `D` (§5.7)
8. Posizioni (§5.8)
9. Dettagli di giunto (§5.9)

Nota: il testo numera «b) 1)…8)» dopo «a) il numero della norma»; qui le voci sono elencate in sequenza. Il **tipo di gas di protezione e di supporto non entra nella designazione**, ma va sul certificato (§11). Esempi in Annex B (`leggibile`): `EN ISO 9606-2 131 P FW 22 S t10 PB sl`; `… 141 T BW 23 S t3 D150 PF ss nb`.

### Campi del certificato (Annex A — informativo)

| Campo Annex A | Stato modello (dati ingest `qualifica` saldatore) | Clausola |
|---|---|---|
| Designazione/i | modellato (`qualification_designation`) | Annex A |
| Riferimento WPS | **non modellato** | Annex A |
| Esaminatore/ente + n. di riferimento | modellati (`issuing_body`, `certificate_number`) | Annex A |
| Nome saldatore | modellato (`welder_name`) | Annex A |
| Identificazione, metodo di identificazione, fotografia | non modellati | Annex A |
| Data e luogo di nascita (se richiesti) | **non modellato** | Annex A |
| Datore di lavoro | da verificare sul record (non una colonna del form ingest) | Annex A |
| Codice/norma di prova | modellato (`standard_reference`) | Annex A |
| Conoscenza del lavoro («Job knowledge»: Acceptable/Not tested) | **non modellata** | Annex A, Annex C |
| Campo «Test piece / Range of qualification» per: processo/i, tipo prodotto, tipo di giunto, gruppo/i materiale, materiale d'apporto (designazione), gas di protezione, ausiliari (es. gas di supporto), spessore del materiale, diametro, posizione, dettagli di giunto | processo, prodotto, giunto, gruppo, gas, spessore, diametro, posizione, dettagli: modellati; **ausiliari: non modellati** | Annex A |
| Tipo di prove (visivo, radiografico, frattura, piegatura, trazione intagliata, macro): eseguite e accettate / non eseguite | **non modellato** | Annex A |
| Data di saldatura | modellata (`exam_date`) | Annex A |
| Validità fino a | modellata (`expiry_date`) | Annex A |
| Conferma per i 6 mesi seguenti (§9.2): data/firma/qualifica | modellata in parte (`last_confirmation_date`, `next_confirmation_due`) | Annex A |
| Prolungamento per i 2 anni seguenti (§9.3): data/firma/qualifica | non modellato come campo dedicato (si riflette in `expiry_date`) | Annex A |

Differenze di modulo rispetto ad Annex A di 9606-1: la 9606-2 **non** ha «Transfer mode», «Filler material group(s)», «Deposited thickness», «Type of current and polarity», «Multi-layer/single layer» né «Supplementary fillet weld test»; ha una sola «Validity of qualification until». Poiché la **corrente** (DC/AC) è una variabile essenziale del 141 (§5.2) ma **non** ha una riga nel modulo Annex A, la verifica non può contare su un campo dedicato: → `non_verificabile_dato_mancante`.

### Verifica incrociata con Annex B

Gli esempi di Annex B sono usati qui come **controllo di coerenza** (non come regole). Tutti gli esempi sono coerenti con le tabelle 2–8, tranne due incongruenze **interne alla norma** riportate in «GAP»:

| Esempio | Designazione | Esito del controllo |
|---|---|---|
| B.1 | 131 P FW 22 S t10 PB sl | Tab. 5 `t = 10` → ≥ 3 ✓; PB → PA, PB ✓; Tab. 2 gruppo 22 → 21, 22 ✓; §5.3 b → «P → T: D ≥ 150» ✓ |
| B.2 | 131 P BW 23 S t15 PA ss mb | Tab. 3 → ≥ 6 ✓; Tab. 7 ss mb → ss mb, bs ✓; §5.4 b → BW, FW ✓; Tab. 2 gruppo 23 → 21, 22, 23 ✓ |
| B.3 | 141 T BW 23 S t03 D150 PF ss nb | Tab. 3 `t = 3` → 1,5–6 ✓; Tab. 4 `D = 150` → ≥ 75 ✓; Tab. 6 PF tubo → PA, PB, PD, PE, PF ✓; Tab. 7 ss nb → ss nb, ss mb, bs ✓ |
| B.4 | 131 P BW 22 S t13 PA ss nb + 131 P FW 22 S t13 PB ml | Tab. 3 → ≥ 6 ✓ |
| B.5 | 141/131 T BW 22 S t15(5/10) D200 PA ss nb | multiprocesso: 141 `s1 = 5` → 2,5–10 ✓; 131 `s2 = 10` → ≥ 6 ✓; D200 → ≥ 100 ✓ |
| B.6 | 141 T BW 21 S t3 D30 PF ss nb + t10 D150 | min 1,5 mm ✓; D → ≥ 25 ✓ (incongruenza `t10` / «13 mm», v. GAP) |
| B.7 | 141 T BW 22 S t8 D100 PF + PC ss nb | Tab. 3 → ≥ 6 ✓; Tab. 4 → ≥ 50 ✓; «all, except PG» ✓ |

## Differenze da ISO 9606-1:2017 (riepilogo per il confronto)

| Tema | ISO 9606-1:2017 (`NORMA_00018`) | ISO 9606-2:2004 (`NORMA_00032`) |
|---|---|---|
| Materiale base | Acciai (gruppi 1–11 ISO/TR 15608) | Alluminio e leghe (gruppi 21–26 CR ISO 15608), §5.5, Tab. 2 |
| Processi | 111, 114, 121, 125, 131, 135, 136, 138, 141, 142, 143, 145, 15, 311 (§4.2); equivalenze in §5.2 | **Solo 131, 141, 15** (§4.2); nessuna equivalenza di processo; corrente DC/AC del 141 essenziale |
| Spessore BW | **`s` depositato** (Tab. 6: `s < 3`, `3 ≤ s < 12`, `s ≥ 12` con ≥ 3 passate) | **`t` del materiale** (Tab. 3: `t ≤ 6` → 0,5t–2t; `t > 6` → ≥ 6) |
| Spessore FW | Tab. 8: `t < 3` → t–2t o 3; `t ≥ 3` → ≥ 3 | Tab. 5: `t < 3` → t–3; `t ≥ 3` → ≥ 3 |
| Diametro | Tab. 7: stesso criterio (D ≤ 25 → D–2D; D > 25 → ≥ 0,5D, min 25) | Tab. 4: **stesso criterio** |
| Tubo → piastra | §5.3 a: `D > 25 mm` | §5.3 a: `D > 25 mm` |
| Piastra → tubo | §5.3 b/c: `D ≥ 500` (fisso); `D ≥ 75` per tubi in rotazione in PA, PB, PC, PD | §5.3 b: `D ≥ 150` per **PA, PB, PC**; `D ≥ 500` per tutte le altre |
| BW → FW | §5.4 b: **no**, salvo prova supplementare d'angolo (§5.4 e, ≥ 10 mm, PB, Annex C) | §5.4 b: **sì** se prevale il lavoro BW; **se prevale il FW serve prova d'angolo** |
| Diramazione | §5.4 c: BW su tubo qualifica diramazioni ≥ 60° | §5.4 c: BW su tubo **senza supporto** qualifica diramazioni ≥ 60° |
| Apporto | FM1–FM6 (Tab. 2–3), tipi di rivestimento/filo (Tab. 4–5) | Nessun gruppo FM: solo §5.6 (con→senza apporto; AlMg→AlSi; He > 50 % nel 131) |
| Posizioni | Tab. 9 (BW) e Tab. 10 (FW): 9 + 9 righe, simboli PH/PJ per tubo | **Tab. 6 unica**: 10 × 10, simboli PF/PG con colonne piastra/tubo; nota b su PB/PD |
| Dettagli di giunto | Tab. 11 (6 × 6: nb, mb, bs, gb, ci, fb) + Tab. 12 | Tab. 7 (3 × 3: nb, mb, bs) + Tab. 8 |
| Validità | §9.2 conferma 6 mesi; §9.3 a/b/c (3 anni ritest / 2 anni con 2 saldature / indefinita con ISO 3834-2/-3); §9.4 revoca | §9.2 validità **2 anni** + conferma 6 mesi; §9.3 prolungamento **ogni 2 anni**; nessuna opzione a/c; nessuna revoca nel testo letto |
| Campi Annex A | Transfer mode, gruppo FM, spessore depositato, corrente/polarità, prova d'angolo supplementare, metodo di rivalidazione | Nessuno di questi; compare «Validity until» e il prolungamento biennale |
| Job knowledge | Annex B | Annex C (informativo, raccomandato, non obbligatorio) |
| Edizioni | 2012/2013/2017 stesso testo (EN ISO 9606-1:2017) | **Edizione unica** 2004 |

## Checklist dato ↔ norma ↔ UI ↔ API (dal brief, riconfermata sul testo)

| Dato | Valore annotato nel piano | Esito (lettura `NORMA_00032`) | Clausola | UI / API |
|---|---|---|---|---|
| Spessore materiale `t` (BW) | `t ≤ 6`: 0,5t–2t; `t > 6`: ≥ 6 | **Confermato** | Tab. 3 (§5.7) | VQ-10 / nessuna persistenza |
| Spessore FW | `t < 3`: t–3; `t ≥ 3`: ≥ 3 | **Confermato** | Tab. 5 (§5.7) | VQ-10 / idem |
| Posizioni (matrice a 10 colonne) | tabella posizioni | **Confermata** (10 colonne; ordine verificato con Annex B) | Tab. 6 (§5.8) | VQ-10 / idem |
| Validità / conferma / prolungamento | §9 | **Confermato**: 2 anni; conferma 6 mesi; prolungamento ogni 2 anni | §9.2, §9.3 | VQ-10 / idem |
| Processi equivalenti | 9606-1 §5.2: 141/143/145 → 141/142/143/145 | Fuori da 9606-2 (nessuna equivalenza); per 9606-1 vedi la discordanza dell'estratto | 9606-1 §5.2 | VQ-6 |

## Note operative per VQ-10 (non vincolanti, nessun codice qui)

- Profili `9606-2:BW` e `9606-2:FW` (decisione del piano): solo `leggibile` per Tab. 2–8 e §9; **non** codificare Tab. 1 (multiprocesso) né il gruppo 26 / sottogruppi Al finché non c'è la CR ISO 15608 (severità massima `info`, HITL 5).
- Severità: certificato più largo della norma = `warn`; più stretto = `info` (asimmetria del piano). Le regole di posizione, spessore e diametro sono **ricalcolabili** dai campi `welding_position_test`, `thickness_t_test_mm`, `pipe_diameter_test_mm`.
- La sola ambiguità sui simboli delle posizioni su tubo (PF/PG di 9606-2 vs PH/PJ di 9606-1) va risolta **per profilo di norma**: non mappare PF↔PH né PG↔PJ senza ISO 6947 integrale (vedi GAP).

## GAP / da confermare con il PDF

| # | Punto | Perché | Cosa serve | Impatto |
|---|---|---|---|---|
| G1 | **Tab. 1** (multiprocesso e giunti con/senza supporto): assegnazione di `t1`, `t2`, `s1`, `s2` alle chiavi 1–4 delle figure | Il Markdown ha solo il testo della tabella, non le figure | PDF `ISO 9606-2:2004` (Tab. 1 di §5.2) | VQ-10: nessuna regola multiprocesso; `non_verificabile_dato_mancante` |
| G2 | **Gruppi Al 21–26** (composizione, sottogruppi, gruppo 26) | Tab. 2 rimanda a CR ISO 15608; ISO/TR 15608 e CR ISO 15608 integrali non sono in repo | CR ISO 15608 + ISO/TR 15608 (richiesta HITL 5 di 6) | Gruppo Al solo `info`; `materialGroups15608.js` senza `26` |
| G3 | **Nota b di Tab. 2** («see also 5.6») per il gruppo 23 | §5.6 non contiene condizioni sul gruppo 23: rimando non risolvibile dal testo | PDF (verifica del rimando; possibile refuso) | Nessuna regola aggiuntiva sul gruppo 23 |
| G4 | **Simboli posizione tubo**: PF/PG (9606-2, EN ISO 6947:1993) vs PH/PJ (9606-1:2017, ISO 6947 più recente) | La corrispondenza PF(tubo)↔PH e PG(tubo)↔PJ è **inferita** dagli esempi (B.3: «PF = tubo fisso, asse orizzontale»), non dichiarata in nessuna delle due norme | ISO 6947 integrale (richiesta HITL 6 di 6, P3) | VQ-10: posizione del certificato 9606-2 da interpretare per profilo, senza mappare ai simboli 9606-1 |
| G5 | **Incongruenza interna di Annex B (B.6)**: designazione `t3 / t10`, spiegazione «Material thickness: 3 mm/13 mm» | Due valori diversi per lo stesso provino nella stessa norma | PDF (controllo del refuso) | Nessuno: B.6 è usato solo come esempio |
| G6 | **Gola del FW**: Tab. 8 nota a `0,5 t ≤ a ≤ 0,7 t` vs Fig. 2/Fig. 4 `0,5 t ≤ a ≤ t` | Due intervalli nella stessa norma | PDF (Fig. 2, 4 e Tab. 8) | Nessuna regola sul valore di gola |
| G7 | **Tabelle prove (Tab. 9 «Test methods»), Fig. 5–9** | Figure non nel Markdown | PDF | Nessuno (le prove non sono range) |
| G8 | **ISO 9606-3/-4/-5** (rame, nichel, titanio) | Non presenti in repo | Fuori scope (richiesta HITL 6 di 6, solo su richiesta) | `non_verificabile_fonte_mancante` |
| G9 | **EN 287-2 / 9606-2:1994** (certificati legacy alluminio) | Non presenti in repo; l'Introduzione dice solo che a fine validità le qualifiche esistenti si interpretano secondo la 2004 | Testo 1994, solo se il committente ha certificati legacy (decisione D5) | `non_verificabile_fonte_mancante` per edizioni diverse dal 2004 |

Nessuno di questi punti blocca la **lettura** delle tabelle 2–8 e del §9: servono solo a non inventare ciò che il Markdown non permette di leggere con certezza.

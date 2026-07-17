
# ISO 15614-1:2017 — Livelli, range di qualificazione e campi WPQR (riferimento operativo SGQ)

> **Uso**: assistente AI, ingest WPQR, modulo 3834.
> **Fonte**: estratto operativo da BS EN ISO 15614-1:2017 "Specification and qualification of welding procedures for metallic materials — Welding procedure test — Part 1: Arc and gas welding of steels and arc welding of nickel and nickel alloys". Testo integrale nel Patrimonio Studio — **qui solo tabelle/regole sintetiche**, mai testo normativo copiato.
> **Cataloghi collegati**: `materialGroups15608.js`, `weldingProcesses4063.js`, `weldingPositions6947.js`.

## Nota sulla fonte di questo estratto (qualità estrazione)

Estratto dalla conversione PDF→Markdown del file `BS EN ISO 15614-1-2017...pdf` (50 pagine) con `backend/scripts/pdf_to_json/`. A differenza di ISO 9606-1, qui il font **non è corrotto** (nessun pattern tipo `buii`→`butt`): il problema è un **layout a due colonne** che il motore di estrazione a volte fonde/interfoglia (es. celle di tabella o paragrafi affiancati intrecciati carattere per carattere). Le tabelle con **matrice di compatibilità gruppi materiali** (Tabella 5/6 — nichel/acciaio) sono risultate troppo interfogliate per essere trascritte con certezza e sono **marcate come GAP**. Le tabelle di range spessore (Tabelle 7/8/9) sono risultate **ricostruibili con confidenza media-alta** (stessi valori confermati su due occorrenze del testo grezzo) e sono riportate con avviso di verifica.

## Livelli di qualifica (Level 1 / Level 2)

| Livello | Base | Estensione test | Note |
|---|---|---|---|
| **Level 1** | Requisiti storici tipo ASME BPVC Sezione IX | Estensione test minore | Range di qualificazione **più ampi** (meno restrittivi) |
| **Level 2** | Edizioni precedenti di questa norma (EN ISO 15614-1:2004) | Estensione test maggiore | Range di qualificazione **più restrittivi** |

**Regola chiave**: una prova qualificata **Level 2 qualifica automaticamente anche Level 1** (non viceversa). Se il contratto o la norma di applicazione **non specifica il livello**, si applicano i requisiti **Level 2** (i più severi) per default.

## Range di qualificazione spessore — giunti testa a testa (Tabella 7, ricostruita da estratto — verificare su copia ufficiale prima di uso contrattuale/certificativo)

| Spessore provino t (mm) | Spessore materiale base — Level 1 | Spessore materiale base — Level 2 | Spessore metallo depositato (mono/multistrato) |
|---|---|---|---|
| t ≤ 3 | 0,5 a 2t | max 2t | secondo processo |
| 3 < t ≤ 12 | 1,5 a 2t | 0,5 (min 3) a 1,3t | 3 a 2t |
| 12 < t ≤ 20 | 0,5 a 2t (banda ricostruita, cifra iniziale incerta) | 0,5 a 1,1t | 0,5 a 2t |
| 20 < t ≤ 40 | idem | 0,5 a 1,1t | 0,5 a 2t (max 2t se <20, altrimenti diverso) |
| 40 < t ≤ 100 | 0,5 a 2×100 (banda ricostruita) | — | 0,5 a 2t |
| 100 < t ≤ 150 | idem | — | 0,5 a 2t |
| t > 150 | 0,5 a 1,33t | — | 0,5 a 2t |

**Avviso**: righe da 12 mm in su hanno cifre iniziali (`0,`) perse nell'estrazione (compaiono come "5 to 2" invece di "0,5 to 2"); la ricostruzione assume il pattern coerente con le righe superiori/leggibili, ma **non è stata verificata carattere per carattere sul PDF originale**. Non usare questi valori per decisioni di conformità/certificazione senza controllo umano su copia ufficiale.

Regole aggiuntive confermate (testo leggibile, non ambiguo):
- Se è richiesta la prova d'urto (impact test): provino ≥16 mm → spessore minimo qualificato 16 mm; provino <16 mm → minimo qualificato = spessore del provino; provino ≤6 mm → minimo qualificato = 0,5× spessore provino.
- Processi 114/12x/13x con passata >13 mm: spessore massimo materiale base qualificato limitato (vedi nota "a" tabella, non riportare valore esatto — gap).

## Range di qualificazione — giunti d'angolo (Tabella 8, parziale — confermato)

| Spessore provino t | Gola (throat thickness) |
|---|---|
| t ≤ 3 mm | 0,7 a 2t |
| 3 < t < 30 mm | 3 a 2t (banda incompleta, verificare) |
| t ≥ 30 mm | ≥5 mm (valore minimo, non massimo — verificare) |

## Diametro tubo (Tabella 9 — regola generale confermata, valori numerici GAP)

- Level 1: il diametro **non è variabile essenziale** — qualsiasi forma prodotto (piastra, tubo, fucinato, fusione) qualifica per tutte le forme.
- Level 2: il diametro **è** variabile essenziale, con range di qualificazione secondo Tabella 9 (valori numerici non ricostruibili con certezza dall'estrazione — GAP).
- Regola pratica confermata: qualifica su piastra copre anche tubo con diametro esterno >500 mm, o >150 mm se saldato in posizione PC, PF ruotata o PA ruotata.

## Gruppi materiale coperti da qualifica (Tabella 5/6 — GAP, non trascritto)

Le matrici di compatibilità tra gruppi materiale ISO/TR 15608 (es. quali combinazioni acciaio-acciaio o nichel-nichel sono coperte da una singola prova) sono risultate **troppo interfogliate/frammentate** nell'estrazione per essere trascritte in modo affidabile. **Non riportare** valori di compatibilità gruppo-materiale da questo documento: usare `materialGroups15608.js` solo per la normalizzazione del codice gruppo, non per inferire coperture incrociate.

Regola generale non ambigua e sicura da applicare: il campo `parent_material_group` estratto/inserito va sempre riportato **come singolo gruppo/sottogruppo testato**, senza inferire automaticamente altri gruppi coperti.

## Campi essenziali WPQR (§8, elenco non ambiguo)

| Campo | Fonte |
|---|---|
| Processo di saldatura | ISO 4063 |
| Tipo di giunto (BW/T-joint/branch/fillet) | — |
| Materiale base (gruppo/sottogruppo) | ISO/TR 15608 |
| Materiale d'apporto | Designazione + gruppo |
| Spessore testato → range qualificato | Tabelle 7/8 (vedi sopra, con avviso) |
| Diametro testato → range qualificato | Tabella 9 (GAP valori) |
| Posizione di saldatura | ISO 6947 |
| Livello (Level 1 / Level 2) | Dichiarato o default Level 2 se assente |
| Angolo diramazione (branch) | 60°–90° in prova → qualifica 60°≤α<90°; angolo <60° richiede prova dedicata |

## Regole per l'estrazione AI (ingest WPQR)

| Campo | Regola |
|---|---|
| `qualification_level` | `1` o `2`; se il documento non lo specifica esplicitamente, **non assumere `2` di default nel dato estratto** — lasciare `null` + warning (il default normativo "Level 2 se non specificato" è una regola contrattuale, non un dato del certificato) |
| Range spessore | Estrarre solo se esplicito sul WPQR; non calcolare da Tabella 7 salvo revisione umana (valori marcati GAP/incerti in questo estratto) |
| Range diametro | Idem — Tabella 9 non disponibile con certezza |
| Gruppo materiale coperto | Solo il gruppo testato, mai inferire compatibilità incrociate (Tabella 5/6 GAP) |

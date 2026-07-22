
# ISO 14732:2013 — Qualifica operatori/preparatori di saldatura automatica e meccanizzata (riferimento operativo SGQ)

> **Uso**: assistente AI, ingest qualifiche `qualifica_14732`, alert scadenze.
> **Fonte**: estratto operativo da UNI EN ISO 14732:2013 (recepimento EN ISO 14732:2013, ISO 14732:2013, seconda edizione — sostituisce ISO 14732:1998/EN 1418:1997). Testo integrale nel Patrimonio Studio — **qui solo tabelle/regole sintetiche**, mai testo normativo copiato.
> **Cataloghi collegati**: `weldingProcesses4063.js` (processo), `weldingPositions6947.js` (posizione), `weldingQualificationRules9606.js` (regole saldatori manuali, per confronto).

## Nota sulla fonte di questo estratto (qualità estrazione)

Documento fornito come **scansione immagine** (nessun livello testo nel PDF), diversamente da ISO 9606-1 e ISO 15614-1 (font corrotto ma testo presente). Convertito con `backend/scripts/pdf_to_json/` usando **OCR locale Tesseract 5.4** (motore installato appositamente su questo PC, pacchetto lingua italiana incluso — nessun dato caricato su servizi cloud, scelta deliberata per non distribuire copie di norme a pagamento a terzi). Risultato: **28/28 pagine con testo utile**. Le clausole normative (§1–§7, Annessi A/B/C, §2 Normative references) sono risultate **chiaramente leggibili**; solo le pagine di copertina/copyright/frontespizio/indice (pag. 1-2, 4, 6, 9, 12, 26-28) presentano rumore OCR sul testo di intestazione ripetuto ("MASTERWELD SRL", codice UNIstore) — **nessuna perdita di informazione tecnica**, marcato come non rilevante.

## Scopo e differenza da ISO 9606

ISO 14732 qualifica **operatori di saldatura** (welding operator) e **preparatori/impostatori** (weld setter) per saldatura **completamente meccanizzata o automatica** — non la capacità manuale del saldatore (oggetto di ISO 9606-1..5), né la procedura (ISO 15614). Non si applica al personale che si occupa solo di carico/scarico dell'unità automatica. Le prove di qualifica per la saldatura a punto/prigionieri restano su ISO 14555.

## Metodi di qualificazione (§4.1 — quattro vie alternative)

| Metodo | Base normativa |
|---|---|
| a) Prova di qualifica procedura | ISO 15614 (parte pertinente) |
| b) Prova di pre-produzione | ISO 15613 |
| c) Provino standard | ISO 9606 (parte pertinente) |
| d) Prova di produzione o campione di produzione | — |

**Nota**: qualunque metodo scelto va integrato da una **prova di conoscenza funzionale dell'unità di saldatura** (Annesso A, obbligatoria) ed eventualmente da un test di conoscenza tecnica (Annesso B, facoltativo).

## Variabili essenziali (che determinano il campo di validità — §4.2)

Il principio generale (§4.2.1) è: se l'operatore lavora secondo una WPS qualificata, **non ci sono limitazioni** al campo di validità oltre a quelle elencate sotto — a differenza di ISO 9606-1 (che ha tabelle spessore/diametro/posizione dedicate), qui le variabili essenziali sono **cambi di configurazione**, non range dimensionali.

### Saldatura automatica (§4.2.2 — richiede nuova qualifica se cambia)

- Processo di saldatura (eccetto varianti nel processo 13 secondo ISO 4063)
- Saldatura con/senza sensore d'arco e/o di giunto (in entrambe le direzioni)
- Da tecnica mono-passata a multi-passata per lato (non viceversa)
- Tipo di unità di saldatura (incluso il sistema di controllo robot)

### Saldatura meccanizzata (§4.2.3 — richiede nuova qualifica se cambia)

- Processo di saldatura (eccetto varianti nel processo 13)
- Da controllo visivo diretto a remoto e viceversa
- Rimozione del controllo automatico di lunghezza d'arco
- Rimozione dell'inseguimento automatico del giunto
- Aggiunta di posizioni di saldatura non già qualificate secondo **ISO 9606-1** (unico punto in cui 14732 rinvia esplicitamente alle posizioni 9606-1/ISO 6947)
- Da tecnica mono-passata a multi-passata per lato (non viceversa)
- Rimozione del backing
- Rimozione degli inserti consumabili

## Validità e conferma (§5 — testo leggibile, verificato)

| Regola | Dettaglio |
|---|---|
| Decorrenza | Dalla data di saldatura del/i provino/i, se i risultati sono accettabili |
| **Conferma periodica** | Ogni **6 mesi**, a cura del responsabile saldature o esaminatore/organismo — **identico a ISO 9606-1**. Senza conferma, il certificato diventa non valido |
| Rivalidazione — opzione a) | Nuova prova ogni **6 anni** — ⚠️ **diverso da ISO 9606-1 (3 anni)**: è il valore citato dal cliente come "operatori 6" |
| Rivalidazione — opzione b) | Ogni **3 anni**, controllo con radiografia/ultrasuoni o prova distruttiva su 2 saldature eseguite negli ultimi 6 mesi del periodo di validità — estende la validità di altri 3 anni. ⚠️ **diverso da ISO 9606-1 (ciclo 2 anni)** |
| Rivalidazione — opzione c) | Validità **indefinita** se: conferma semestrale rispettata **e** l'operatore lavora per lo stesso fabbricante **e** il fabbricante ha sistema qualità certificato ISO 3834-2/3834-3 **e** il fabbricante documenta saldature di qualità accettabile — **identico a ISO 9606-1** |
| Revoca | In caso di dubbio motivato sulla capacità dell'operatore, le qualifiche coinvolte vanno revocate (le altre restano valide) |

**Il metodo scelto (a/b/c) va dichiarato sul certificato al momento del rilascio** (§5.1) — non assumere un valore fisso in ingest, va sempre letto dal documento.

## Campi del certificato (Annesso C — informativo, elenco non ambiguo)

| Campo | Note |
|---|---|
| Nome operatore/preparatore, identificazione, data/luogo di nascita, datore di lavoro | Dati anagrafici |
| Riferimento WPS/pWPS del fabbricante | Norma base della qualifica |
| Test di conoscenza funzionale (obbligatorio) | Esito accettabile/non testato |
| Processo/i di saldatura | ISO 4063 |
| Tipo di unità di saldatura | Testo libero |
| **Dettagli saldatura meccanizzata**: controllo visivo/remoto, controllo automatico lunghezza arco, inseguimento automatico giunto | Solo se applicabile |
| Posizione di saldatura | ISO 6947 |
| Tecnica mono/multi-passata | — |
| Backing materiale | — |
| Inserto consumabile | — |
| **Dettagli saldatura automatica**: sensore di giunto, controllo sensore d'arco, tecnica mono/multi-passata, tipo di unità | Solo se applicabile |
| Metodo di qualificazione (a/b/c/d, §4.1) | — |
| Data saldatura provino, validità "fino a", rivalidazione (§5.2/5.3), esaminatore/organismo | — |

## Bibliografia — famiglia di norme collegate (§2 Normative references, testo integrale leggibile)

Elenco ufficiale confermato direttamente dal testo della norma (fonte primaria, non dedotto):

| Norma | Oggetto |
|---|---|
| ISO 3834-2 / -3 | Requisiti di qualità per la saldatura per fusione (completi / standard) |
| ISO 4063 | Nomenclatura processi di saldatura |
| ISO 9606-1 / -2 / -3 / -4 / -5 | Qualifica saldatori: acciai / alluminio / rame / nichel / titanio-zirconio |
| ISO 14555 | Saldatura ad arco di prigionieri |
| ISO 15609-1 / -3 / -4 / -5 | Specifica WPS: arco / fascio elettroni / laser / resistenza |
| ISO 15613 | Qualifica WPS da prova di pre-produzione |
| ISO 15614-1 / -2 / -5 / -6 / -7 / -8 / -11 / -13 / -14 | Qualifica procedure di saldatura (acciai/nichel, alluminio, titanio-zirconio, rame, rivestimento, tubo-piastra, fascio, resistenza, ibrida laser-arco) |
| ISO 6947 | Posizioni di saldatura |
| ISO 857-1 | Vocabolario processi di saldatura per fusione |
| ISO 10447 | Prove peel/chisel su saldature a punto/proiezione |
| ISO 14731 | Coordinamento di saldatura — compiti e responsabilità |
| ISO/TR 25901 | Vocabolario saldatura e processi collegati |

**Nessuna norma aggiuntiva "sorpresa"**: la lista confirma quanto già ipotizzato (9606-2..5, 15612/15613/15614 famiglia, 15609), con l'unica new entry non prevista **ISO 10447** (prove peel/chisel, non prioritaria per il modulo qualifiche) e **ISO 857-1**/**ISO/TR 25901** (vocabolario, non normativa di range).

## Regole per l'estrazione AI (ingest `qualifica_14732`)

| Campo | Regola |
|---|---|
| `confirmation_interval_months` | Sempre 6 (fisso da norma, uguale a ISO 9606-1) |
| Rivalidazione (6 anni / 3 anni / indefinita) | **Non assumere un default**: leggere il metodo dichiarato sul certificato (§5.1); se assente, lasciare `null` + warning — mai riusare i valori di ISO 9606-1 (3/2 anni) per questo tipo documento |
| `welding_type` (automatico vs meccanizzato) | Determina quali variabili essenziali si applicano (§4.2.2 vs §4.2.3) — estrarre se dichiarato, altrimenti null |
| Posizioni di saldatura | Solo per saldatura **meccanizzata** sono variabile essenziale esplicita (nuova posizione = nuova qualifica); per l'automatica non è citata come variabile essenziale — estrarre comunque se presente sul certificato |
| Metodo di qualificazione (a/b/c/d) | Estrarre se dichiarato (rif. a quale norma è stata usata: 15614/15613/9606/prova produzione) |

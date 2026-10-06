# Piano operativo — riunione 3 ottobre 2026

> **Fonte**: registrazione Plaud del 3 ottobre 2026, inizio **09:14** ora italiana (07:14 UTC), titolo «Anonimizzazione Documenti, Gestione Qualifiche Saldatori e Sviluppo Sistema».
> **Cosa è questo file**: l'ordine di lavoro deciso in riunione, allineato a ciò che è **già** nel repository il 3 ottobre 2026 (`origin/main`, dopo il merge della sintesi Mason #693). Non è codice. Non sostituisce la roadmap: lo stato del prodotto resta in [`docs/PROJECT_ROADMAP.md`](../PROJECT_ROADMAP.md) § Stato attuale (ultimo aggiornamento lì: 20/09/2026).
> **Nel verbale** compaiono «VPQR» e «VPS»: sono la stessa cosa di **WPQR** e **WPS**. Nel riassunto automatico «BV» indica lo **spessore depositato**, non l'ente Bureau Veritas (quell'ente è già una voce a parte nei menu). «FPC» nel riassunto automatico è scritto «Factory Plan Control»; nelle norme già in repo (EN 10219 / EN 10210) FPC è il **controllo di produzione in fabbrica**. Qui si usa il significato delle norme in repo.
> **Non si inventano clausole né soglie.** Dove il testo ufficiale manca, la riga resta bloccata.

## Legenda

| Stato | Significato |
|---|---|
| **Già in app** | Il comportamento c'è. Non rifarlo. Se la riunione lo ha visto funzionare, il passo successivo è solo una verifica. |
| **Da fare** | Manca il pezzo deciso in riunione. |
| **Bloccato da decisione** | Serve una scelta (o il testo della norma) prima di scrivere regole. |

## Contesto già in prodotto (non è la coda di oggi)

Roadmap § Stato (20/09/2026): moduli maturi includono Qualifiche, Saldatura (WPQR/WPS/3834), Alert, Registro, CND, Second Brain (fino a CTX-3). Prossimi HITL già scritti lì: CTX-4, ING-5, ROO-18, S1c, ISO-4b, registry Material Compliance. Questo piano **non li chiude e non li sposta**. La coda sotto è quella della riunione.

Bussola moduli: [`PROJECT_CONTEXT.md`](../../PROJECT_CONTEXT.md) (Qualifiche, WPQR/WPS, Ingest, Alert, CND).

---

## 1. Qualifiche — prima fetta

Decisione di riunione: saldatore (ISO 9606) e operatore (ISO 14732) restano separati; non si copiano i vincoli di spessore dall'una all'altra. In lettura vince il **campo di validità** del certificato, non la designazione (la designazione descrive la prova). BV (spessore depositato) resta distinto da FV (giunto d'angolo) e la regola non si perde. T1/T2 e D1/D2: un solo range se i due valori sono uguali, due range se sono diversi. In scheda si vedono solo i campi del caso (testa a testa oppure d'angolo). Confidenza sopra il 90% in verde; obiettivo di qualità 98–99% (obiettivo di riunione, non una soglia già codificata).

| Voce | Stato | Già nel repo | Manca |
|---|---|---|---|
| Due tipi: saldatore 9606 e operatore 14732 (revalidazione 3 anni vs 6 anni; campi macchina solo sull'operatore) | Già in app | `QualificationForm.jsx`, migrazione 122, estratto [`ISO-14732-operatori-saldatura.md`](../reference/ISO-14732-operatori-saldatura.md) | — |
| Non applicare le tabelle di spessore della 9606 all'operatore 14732 | Da fare | L'estratto 14732 dice che le variabili essenziali sono cambi di configurazione, non range dimensionali | Lo stesso blocco spessore / diametro / giunto è ancora visibile anche per il tipo 14732 |
| Priorità al campo di validità rispetto alla designazione | Da fare | Il prompt di estrazione dice di non sovrascrivere un range scritto sul certificato con il calcolo, e di segnalare lo scarto | Manca la regola persistente: la designazione descrive la prova; l'estensione si legge dal campo di validità |
| Calcolo dello spessore depositato (testa a testa) e dello spessore d'angolo | Già in app | `computeQualifiedThicknessRangeButtWeld` (tabella 6) e `computeQualifiedFilletThicknessRange` (tabella 8) in `weldingQualificationRules9606.js`; estratto [`ISO-9606-1-range-validita-patentino.md`](../reference/ISO-9606-1-range-validita-patentino.md) | — |
| BV = spessore depositato, persistente, distinto da FV | Da fare | I due calcoli esistono, ma in scheda c'è un solo paio minimo/massimo | Due formati e una regola che resti anche dopo molti giunti d'angolo. Non confondere questa sigla con Bureau Veritas |
| T1/T2: un range se uguali, due se diversi | Da fare | Sulla WPQR le colonne t1 e t2 ci sono sempre (migrazione 158) e sono sempre due campi | La regola «collassa se uguali» non c'è. Sulla qualifica c'è un solo range di spessore |
| D1/D2: stessa regola del diametro | Da fare | Un solo range diametro, in qualifica (`pipe_diameter_min/max`) e in WPQR (`diameter_min/max`) | Il secondo diametro, e il collasso se i due coincidono |
| In scheda solo i campi del caso testa a testa oppure d'angolo | Da fare | Il diametro tubo si nasconde se il prodotto è piastra; il metodo di trasferimento compare solo per i processi 131, 135, 136, 138 | Il tipo di giunto non nasconde i campi di spessore |
| Verde se confidenza sopra il 90%; obiettivo 98–99% | Da fare | In revisione ingest le etichette sono Alta / Media / Bassa (accordo tra regole e AI), non una percentuale. In Import PDF si vede una percentuale sul file | La soglia numerica e l'obiettivo 98–99% non sono nel codice. Non fissarli come clausola: sono un obiettivo di qualità della riunione |

Giunti di derivazione (tubo-piastra, tubo-tubo): già chiarito sull'estratto 9606 che non sono un terzo tipo di prodotto. Il testo va in «dettagli giunto». Non riaprire quel punto.

---

## 2. WPS a partire dalla WPQR — seconda fetta

Si fa **dopo** il punto 1. Due modi, entrambi voluti:

1. scelgo la WPQR che conosco e inserisco pochi parametri (per esempio lo spessore);
2. parto dai parametri e i filtri progressivi scartano le WPQR non compatibili fino a lasciarne una.

Poi è obbligatoria la seconda pagina della WPQR (apporto termico, volt, ampere, tolleranze). Solo dopo: multiprocesso 111+135 e saldatura di prigionieri lato operatore 14732.

| Voce | Stato | Già nel repo | Manca |
|---|---|---|---|
| Bozza WPS da materiali, spessori e processo, più export Word | Già in app | Generatore P0–P5 in [`MODULO_WPS_GENERAZIONE_SCOPO_E_ROADMAP.md`](../specs/MODULO_WPS_GENERAZIONE_SCOPO_E_ROADMAP.md) e pulsante «Genera WPS» in `WeldingProceduresPage.jsx`. [`PLAN_3834_SLICES.md`](PLAN_3834_SLICES.md) lo dà per chiuso in attesa di feedback | Non è ancora nessuno dei due modi decisi il 3 ottobre |
| Modo (a): scelgo la WPQR e pochi parametri | Da fare | La ricerca parte dai parametri del giunto, non da una WPQR scelta in un menu | Menu della WPQR, documento visibile, pochi campi per produrre la WPS |
| Modo (b): filtri progressivi fino a una sola WPQR | Da fare | Il generatore propone candidati e una bozza | Due pannelli collegati che escludono fino a una WPQR applicabile |
| Seconda pagina obbligatoria: apporto termico, volt, ampere, tolleranze | Da fare | Sulla WPQR c'è un campo testo `heat_input_note` (segnaposto con esempio di tolleranza). Non è obbligatorio e non è strutturato in volt e ampere | Lettura obbligatoria della seconda pagina e uso di quei valori nel generatore. Il «±25%» citato in riunione è un esempio, non una soglia da codificare |
| Multiprocesso 111+135 | Da fare | — | Dopo i modi (a)/(b) e la seconda pagina |
| Prigionieri e operatore 14732 | Da fare | Campi WPQR stud e range 14555 già chiusi (STUD-1, STUD-3-B, vedi sotto) | Generazione WPS e mappatura dell'operatore (diametro del piolo, parametri) dopo i modi (a)/(b) |

---

## 3. Norme mancanti prima delle regole — terza fetta

Prima si sistema la fonte, poi si scrivono regole. Nessuna soglia nuova senza testo.

| Voce | Stato | Già nel repo | Manca |
|---|---|---|---|
| ISO 14555:2025 (saldatura di prigionieri) come fonte e come range WPQR | Già in app | `NORMA_00033`, estratto [`ISO-14555-2025-range-validita-WPQR.md`](../reference/ISO-14555-2025-range-validita-WPQR.md), codice STUD-3-B. In [`NORME_MANCANTI_BACKLOG.md`](../reference/NORME_MANCANTI_BACKLOG.md) è `digitalizzata` | Non ridigitalizzarla |
| Confusione OCR: un certificato 14555 letto come 15614 «livello 2» | Da fare | La norma in libreria c'è. Il sintomo descritto in riunione è sulla lettura del certificato, non sull'assenza del PDF | Diagnosi sui certificati stud già caricati. Se il modello cita ancora la 15614, si corregge il riconoscimento, non si inventa una tabella |
| Processo 783 (famiglia stud in ISO 4063) | Numero sbloccato (06/10/2026); regole 78x ancora da decidere | Testo ISO 4063:2023 (quinta ed.) in `NORMA_00044`, ricontrollato il 06/10 su un secondo PDF identico (24 pag., pag. 11: **78 Arc stud welding**: 783 drawn arc con ferrule o gas, 784 short-cycle, 785 CD drawn arc, 786 CD con innesco a punta; 781/787 obsoleti, Annex B). `weldingProcesses4063.js` (backend e app) ha già 783–786 con diciture identiche al testo. L'estratto 14555 resta valido: il 4063 è solo l'indicazione di processo, i range vengono dal §10.2.8 | Il 4063 non dà range né regole. Annex C: l'acronimo USA `SW` corrisponde a 783/785/786, quindi il numero va letto dal documento: **vietato dedurlo**. Nessuna regola o aggiornamento date «per il processo 783» finché non è deciso come mappare 783–786 sui range 14555 |
| Metodo di trasferimento: un solo valore (short, spray, pulsato, globulare) | Già in app | Campo `transfer_mode`, visibile solo per 131/135/136/138. Estratto 9606 §5.2: l'arco corto qualifica anche gli altri modi, non il contrario. Quella continuità **non** è nel calcolo di copertura | — |
| Più metodi insieme e range combinati | Bloccato da decisione | — | Prima il testo (HITL). Poi il calcolo combinato. L'esempio di riunione «3–6 in short e 3–18 in spray» illustra il problema: **non è una soglia da scrivere in codice** |

---

## 4. Ingest — quarta fetta

| Voce | Stato | Già nel repo | Manca |
|---|---|---|---|
| Caricare più PDF di qualifiche in un colpo | Già in app | Batch qualifiche fino a 50 file nella stessa richiesta; Import PDF fino a 80 file per job ([`PLAN_INGEST_ARCHIVIO_SLICES.md`](PLAN_INGEST_ARCHIVIO_SLICES.md)) | Non è una coda: l'estrazione del batch gira nella richiesta |
| Coda quando si supera il lotto che in riunione va in timeout (oltre 5 PDF) | Da fare | Il «5» è ciò che si è visto in riunione, non un tetto scritto nel codice | Lavorazione asincrona, così un plico più lungo non cade per timeout |
| Tool sul PC per scegliere le pagine (miniature) prima dell'invio all'AI | Da fare | Lo strumento PDF locale del repo serve a digitalizzare le norme, non a far scegliere le pagine di un plico da 90–100 fogli | Anteprima e invio solo delle pagine utili |
| Scritta «Errore qualifica» | Già in app | In Import PDF, se il passaggio a qualifica fallisce, compare «Errore qualifica» (`ImportJobsPage.jsx`) | — |
| Diagnosi di quell'errore su cartelle piccole | Da fare | L'etichetta c'è | Ripetere l'import su una cartella ridotta e leggere la causa, senza rialzare il tetto dei file prima |

---

## 5. Firme e alert — quinta fetta

In riunione gli alert a 30, 14, 7 e 1 giorni e la mail delle NC risultano **già provati**. Qui si verifica, non si ricostruisce.

| Voce | Stato | Già nel repo | Manca |
|---|---|---|---|
| Mail delle non conformità a 30 / 14 / 7 / 1 giorni | Già in app | `ncAlertEscalation.service.js`: soglie dell'organizzazione più 14, 7 e 1. Con i default (30 e 7) la serie è quella della riunione | Solo verifica in esercizio. Non rifare il motore |
| Mail di scadenza delle qualifiche | Già in app | `qualificationAlert.service.js` invia la mail e usa la curva dei **documenti** (35, 28, 21, 14, 7, 3, 1, più i giorni impostati dall'organizzazione, di solito 30 e 7). Promemoria giornaliero dopo la scadenza: già previsto per i documenti | Verifica. La curva delle qualifiche è più larga di «solo 30/14/7/1»: non restringerla in questa fetta |
| Conferma semestrale (date, nome di chi conferma) ed elenco Excel | Già in app | Sezione conferma in scheda qualifica; export Excel `conferme_semestrali` | Non compila il PDF del certificato |
| Pulsante da telefono che registra la conferma e compila il PDF | Da fare | — | Il gesto di conferma deve scrivere data, firma e controllore sul PDF |
| Acrobat sul server per modificare o firmare il PDF | Bloccato da decisione | — | Si apre solo se viene chiesto. Alternativa già detta in riunione: report Word che ripete l'ultima pagina per la stampa. La firma grafica sui verbali CND resta parcheggiata (CND-10) |

---

## 6. Classificazione documenti — sesta fetta

| Voce | Stato | Già nel repo | Manca |
|---|---|---|---|
| Prefisso, numerazione automatica e mesi di scadenza per tipo di documento | Già in app | Impostazioni studio, scheda Documenti; tabella `doc_type_config` ([`AGENT_ALERTS_AND_DOC_TYPES.md`](../AGENT_ALERTS_AND_DOC_TYPES.md)) | Non è ancora lo schema ISO 9001 / EN 1090 / ISO 3834 / FPC |
| Macro-categorie, prefissi e numerazione legati a ISO 9001, EN 1090, ISO 3834 e FPC | Da fare | Albero cartelle dello studio e cartella norme. Il Quaderno EN 1090 è una guida digitalizzata, non il capitolo di numerazione | Lo schema deciso in riunione. Il riassunto automatico parla di sette macro-categorie: i nomi non sono nel verbale in modo abbastanza netto da fissarli qui |
| Revisione di default a 5 anni | Da fare | I mesi di scadenza si impostano per tipo; non c'è un default di 60 mesi | Impostare 5 anni come default di revisione documentale. È una scelta della riunione, non una clausola di norma |

---

## Decisioni aperte — niente codice

| Decisione | Stato | Come sta il prodotto oggi |
|---|---|---|
| Database unico oppure un database per cliente, con il parere dei finanziatori | Bloccato da decisione | Un solo SQL Server, più aziende nello stesso archivio (`organization_id`). Separare i database alza l'isolamento e la complessità. Non si migra finché la scelta non è presa |
| LLM locale che oscura email e nomi prima di Gemini o Anthropic; la mappa dei campi oscurati resta sul posto (oppure si cancella, se l'anonimizzazione deve essere definitiva) | Bloccato da decisione | L'app parla con i modelli cloud già configurati. Non c'è un passaggio locale di anonimizzazione |
| Dove stanno le qualifiche CND: documenti del cliente oppure dello studio | Bloccato da decisione | Il piano CND già in repo tiene le qualifiche ISO 9712 nel modulo Qualifiche: personale dello studio, e la stessa regola se l'azienda cliente ha la licenza CND. La riunione ha riaperto il punto. Non si sposta nulla finché non si conferma |

Temi del verbale che non entrano in questa coda: Second Brain e l'archivio norme con avviso se una norma citata non c'è sono già in app (piano Second Brain fino a CTX-3; richieste norme in Libreria). Dominio, secondo fattore di accesso e canone mensile dell'AI sono scelte organizzative, non fette di questo piano.

---

## Prossima slice consigliata

**Punto 1 (Qualifiche).**

Prima sessione, se il punto 1 non entra tutto in un giro: separare i vincoli di spessore tra 9606 e 14732, far vincere il campo di validità sulla designazione, persistere «BV = spessore depositato» distinto da FV. Subito dopo, sempre nel punto 1: T1/T2 e D1/D2 (un range se uguali), scheda con i soli campi del giunto, obiettivo di confidenza. Non partire dal generatore WPS, dal processo 783 né dall'Acrobat.

## Piani già nel repo

| Tema | Dove |
|---|---|
| ISO 3834, WPS, qualifiche nel sistema | [`PLAN_3834_SLICES.md`](PLAN_3834_SLICES.md) |
| Generazione WPS (P0–P5) | [`MODULO_WPS_GENERAZIONE_SCOPO_E_ROADMAP.md`](../specs/MODULO_WPS_GENERAZIONE_SCOPO_E_ROADMAP.md) |
| Range patentino 9606 | [`ISO-9606-1-range-validita-patentino.md`](../reference/ISO-9606-1-range-validita-patentino.md) |
| Operatori 14732 | [`ISO-14732-operatori-saldatura.md`](../reference/ISO-14732-operatori-saldatura.md) |
| Prigionieri 14555 e divieto sul 783 | [`ISO-14555-2025-range-validita-WPQR.md`](../reference/ISO-14555-2025-range-validita-WPQR.md), [`DEPUTYTASK_WPQR_STUD.md`](DEPUTYTASK_WPQR_STUD.md) |
| Norme ancora senza testo | [`NORME_MANCANTI_BACKLOG.md`](../reference/NORME_MANCANTI_BACKLOG.md) |
| Import massivo | [`PLAN_INGEST_ARCHIVIO_SLICES.md`](PLAN_INGEST_ARCHIVIO_SLICES.md) |
| Pipeline ingest | [`PLAN_INGEST_LEARNING_SLICES.md`](PLAN_INGEST_LEARNING_SLICES.md) |
| CND e qualifiche 9712 | [`PLAN_CND_SLICES.md`](PLAN_CND_SLICES.md) |
| Alert e tipi documento | [`AGENT_ALERTS_AND_DOC_TYPES.md`](../AGENT_ALERTS_AND_DOC_TYPES.md) |
| Stato prodotto | [`PROJECT_ROADMAP.md`](../PROJECT_ROADMAP.md) § Stato attuale |

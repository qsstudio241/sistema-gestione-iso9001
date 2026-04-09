# Registro Documenti SGQ — Guida utente

> **Versione**: 1.0  
> **Data**: 09 aprile 2026  
> **Basata su**: test E2E Sprint 1 — commit `fe25fb7` (branch `main`)  
> **Applicativo**: [https://systemgest.netlify.app](https://systemgest.netlify.app)

---

## Cos'è il Registro Documenti

Il **Registro Documenti** è la sezione dell'applicativo SGQ ISO 9001 che ti permette di gestire tutti i documenti del tuo Sistema Gestione Qualità: procedure, istruzioni operative, moduli, politiche e altri documenti richiesti dalla norma ISO 9001:2015 (§7.5).

Da questa sezione puoi:
- Vedere in un colpo d'occhio quali documenti richiedono attenzione urgente (scaduti, in scadenza, in revisione)
- Aggiungere nuovi documenti al sistema
- Modificare i dati di documenti esistenti
- Archiviare documenti non più in vigore
- Esportare la lista completa o filtrata in formato CSV (apribile con Excel)

---

## Come accedere

1. Effettua il login su [https://systemgest.netlify.app](https://systemgest.netlify.app) con le tue credenziali
2. Dopo il login, ti trovi nella **Dashboard principale**
3. Nella **barra di navigazione laterale** (su computer) o nella **barra in fondo allo schermo** (su smartphone/tablet), clicca la voce **"Documenti"**
4. Si apre la pagina **Registro Documenti** con il contatore del totale documenti presenti nel sistema

---

## Tab "Priorità" — Cosa fare oggi

Quando apri la sezione Documenti, il primo tab che vedi è **"⚠️ Priorità"** — questa è la vista pensata per la gestione quotidiana.

### Cosa mostra

Il tab Priorità analizza automaticamente i tuoi documenti e li raggruppa in tre categorie di urgenza:

| Colore scheda | Significato | Azione richiesta |
|---|---|---|
| 🔴 Rosso | **Documenti scaduti** — la data di revisione è già passata | Aggiorna o archivia subito |
| 🟠 Arancione | **In scadenza entro 60 giorni** — la revisione si avvicina | Pianifica la revisione |
| 🔵 Blu | **In revisione** — documenti che stai attualmente revisionando | Porta a termine la revisione |

### Quando tutto è a posto

Se non ci sono situazioni urgenti, il tab mostra un messaggio verde:

> ✅ **Tutto in ordine** — nessun documento richiede attenzione

Accanto al messaggio compare il pulsante **"+ Aggiungi documento"** per creare subito un nuovo documento se necessario.

### Il badge numerico

Se ci sono documenti urgenti, il tab "Priorità" mostra un piccolo **badge rosso** con il numero di situazioni che richiedono attenzione. Questo badge è visibile anche quando sei su altri tab, come promemoria.

---

## Tab "Catalogo" — Vista completa

Il tab **"Catalogo"** mostra tutti i tuoi documenti in una tabella con tutte le colonne di dettaglio.

### Colonne della griglia

| Colonna | Descrizione |
|---|---|
| Codice | Il codice identificativo del documento (es. PG-01, IO-003) |
| Titolo | Il nome completo del documento |
| Tipo | La categoria (Procedura, Istruzione operativa, Modulo, Politica, Altro) |
| Revisione | Il numero di revisione attuale |
| Stato | Lo stato del documento: Vigente, Obsoleto, In revisione |
| Emissione | Data di prima emissione |
| Scadenza | Data entro cui deve essere revisionato |
| Responsabile | La persona responsabile del documento |
| Azienda | L'organizzazione di appartenenza |
| Azioni | Pulsanti per modificare (✏️) o archiviare (🗄️) il documento |

### Ricerca rapida

In alto nel Catalogo trovi un **campo di ricerca**. Digita una parola qualsiasi (anche solo una parte del titolo o del codice) e la griglia si aggiorna istantaneamente mostrando solo i documenti corrispondenti.

Esempio: digita `PG` per vedere solo le procedure, oppure digita il nome di un responsabile per trovare i suoi documenti.

### Filtri avanzati

Per default, i filtri sono **nascosti** per mantenere la vista pulita. Per usarli:

1. Clicca il pulsante **"⚙️ Filtri ▼"** — il pannello filtri si apre
2. Seleziona uno o più filtri combinati:
   - **Tipo documento**: mostra solo un tipo (es. solo Procedure)
   - **Stato**: mostra solo i documenti vigenti, obsoleti o in revisione
   - **Azienda**: filtra per organizzazione (utile in installazioni multi-azienda)
   - **Solo in scadenza (30gg)**: mostra solo i documenti che scadono nei prossimi 30 giorni
3. La griglia si aggiorna automaticamente ad ogni selezione
4. Per ripristinare tutto, clicca **"Reset"**
5. Per chiudere il pannello filtri, clicca di nuovo **"⚙️ Filtri ▲"**

---

## Aggiungere un nuovo documento

La creazione di un nuovo documento avviene tramite un **wizard in 2 passi** — una procedura guidata che divide i campi in due schermate successive per rendere più semplice il processo.

### Come avviare il wizard

Clicca il pulsante **"+ Nuovo documento"** in alto a destra della pagina.

### Passo 1 — Identificazione

Il primo passo raccoglie le informazioni di base per identificare il documento:

| Campo | Obbligatorio | Note |
|---|---|---|
| **Tipo documento** | Sì | Scegli tra: Procedura, Istruzione operativa, Modulo, Politica, Altro — clicca il chip corrispondente |
| **Titolo** | ✅ **Sì** | Nome completo e descrittivo del documento |
| **Codice** | No | Codice identificativo (es. PG-01, IO-003, MOD-007) |
| **Azienda** | No | L'organizzazione di riferimento |

> **Attenzione**: se clicchi "Avanti →" senza inserire il Titolo, apparirà il messaggio di errore *"Il titolo è obbligatorio"* e non potrai procedere.

Per passare al secondo passo, clicca **"Avanti →"**.

### Passo 2 — Dettagli

Il secondo passo raccoglie le informazioni di dettaglio per la gestione del documento:

| Campo | Note |
|---|---|
| **Revisione** | Numero di revisione (es. 0, 1, 2) |
| **Stato** | Vigente, In revisione, Obsoleto |
| **Data emissione** | Data di prima emissione |
| **Data scadenza** | Data entro cui deve essere revisionato |
| **Responsabile** | Nome del responsabile del documento |
| **Luogo di conservazione** | Dove è archiviato il documento fisico |
| **Norma di riferimento** | La clausola ISO applicabile |
| **Note** | Qualsiasi annotazione aggiuntiva |

Puoi tornare al passo precedente con **"← Indietro"** senza perdere i dati già inseriti.

Quando hai compilato i campi desiderati, clicca **"Crea documento"** per salvare. La modale si chiude e il documento appare subito nel Catalogo.

---

## Modificare un documento esistente

Per modificare un documento già presente nel sistema:

1. Vai al tab **Catalogo**
2. Trova il documento che vuoi modificare (usa la ricerca se necessario)
3. Clicca l'icona **✏️** (matita) nella colonna Azioni della riga corrispondente
4. Si apre il **form di modifica** — una schermata unica con tutti i campi pre-compilati con i valori attuali

> **Nota**: a differenza della creazione (che usa il wizard in 2 passi), la modifica mostra tutti i campi in una sola schermata. Non c'è un indicatore di passi.

5. Modifica i campi che ti interessano
6. Clicca **"Salva modifiche"**
7. La modale si chiude e la griglia si aggiorna con i nuovi valori

Per verificare che le modifiche siano state salvate, riapri il documento con ✏️ e controlla i campi.

---

## Archiviare un documento

Quando un documento non è più in vigore (es. è stato sostituito da una versione più recente, o non è più applicabile), puoi archiviarlo portandolo in stato **"Obsoleto"**.

### Come archiviare

1. Nel tab **Catalogo**, trova il documento da archiviare
2. Clicca l'icona **🗄️** nella colonna Azioni
3. Appare una **richiesta di conferma direttamente sulla riga** del documento — non si apre nessuna finestra pop-up del browser
4. Leggi il messaggio di conferma e:
   - Clicca **"Sì"** per confermare l'archiviazione
   - Clicca **"No"** (o il pulsante di annullamento) per tornare indietro senza modifiche

Dopo l'archiviazione, il documento cambia stato in **"Obsoleto"** e scompare dalla vista standard del Catalogo (che per default mostra solo i documenti vigenti).

### Visualizzare i documenti archiviati

Per vedere i documenti archiviati:
1. Apri i filtri nel tab Catalogo (⚙️ Filtri ▼)
2. Seleziona Stato = **"Obsoleto"**
3. La griglia mostra i documenti archiviati

> **Importante**: l'archiviazione è reversibile tramite modifica del documento (cambia lo stato da "Obsoleto" a "Vigente"). I documenti archiviati non vengono cancellati dal sistema — rimangono nel database per garantire la tracciabilità richiesta da ISO 9001:2015 §7.5.

---

## Esportare la lista in Excel

Puoi esportare la lista dei documenti in formato CSV (Comma-Separated Values), un formato compatibile con Excel e altri fogli di calcolo.

### Come esportare

1. Nel tab **Catalogo**, applica eventuali filtri o ricerche per selezionare i documenti da esportare
2. Clicca il pulsante **"⬇️ Esporta CSV"**
3. Viene scaricato automaticamente un file con il nome nel formato `documenti_sgq_AAAA-MM-GG.csv`

> **Nota**: l'export rispetta i filtri attivi. Se hai filtrato per Tipo = "Procedura", il CSV conterrà solo le procedure.

### Aprire il file in Excel

1. Apri Excel
2. Vai su **File → Apri** e seleziona il file scaricato
3. Se Excel mostra la procedura guidata di importazione, seleziona:
   - Separatore: **punto e virgola (;)**
   - Codifica: **UTF-8**
4. I dati saranno organizzati nelle colonne: Codice, Titolo, Tipo, Revisione, Stato, Emissione, Scadenza, Responsabile, Azienda, Norma, Paragrafo, Note

---

## Domande frequenti

**D: Perché non vedo il pulsante "← Indietro" nella pagina Documenti?**  
R: È normale. La navigazione tra le sezioni avviene tramite la **sidebar** (su desktop) o la **barra in basso** (su smartphone). Non c'è un pulsante "Indietro" nell'header della pagina Documenti.

**D: Ho creato un documento senza data di scadenza. Posso aggiungerla dopo?**  
R: Sì. Clicca l'icona ✏️ sul documento nel Catalogo e aggiungi la data di scadenza nel form di modifica.

**D: Il tab Priorità mostra "Tutto in ordine" ma so di avere documenti in scadenza. Perché?**  
R: Controlla che i documenti abbiano una **data di scadenza** impostata. Se la data non è inserita, il sistema non può calcolare la scadenza. Puoi anche usare il filtro **"Solo in scadenza (30gg)"** nel Catalogo per trovare i documenti critici.

**D: Dopo aver archiviato un documento, non lo vedo più nel Catalogo. È stato cancellato?**  
R: No. Il documento è ancora nel sistema con stato "Obsoleto". Per vederlo, apri i filtri e seleziona Stato = "Obsoleto". I documenti non vengono mai eliminati fisicamente per garantire la tracciabilità ISO 9001.

**D: Posso esportare solo alcuni tipi di documento in CSV?**  
R: Sì. Applica prima il filtro desiderato (es. Tipo = "Procedura") nel tab Catalogo, poi clicca "Esporta CSV". Il file conterrà solo i documenti corrispondenti ai filtri attivi.

**D: Come faccio a trovare velocemente un documento specifico?**  
R: Usa il **campo di ricerca** nel tab Catalogo. Puoi digitare anche solo una parte del titolo o del codice. La griglia si aggiorna istantaneamente.

**D: Posso modificare un documento obsoleto?**  
R: Sì. Trova il documento archiviato (filtra per Stato = Obsoleto), clicca ✏️ e modifica lo stato riportandolo a "Vigente" o qualsiasi altro valore.

---

*Guida prodotta il 09 aprile 2026 — basata su test E2E Sprint 1 del progetto SGQ ISO 9001*

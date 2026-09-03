# Walkthrough admin — Riesame requisiti / Valutazione commesse (passi 1–10)

> Tono operativo («Io admin faccio così»). Stringhe UI verificate su `ContractReviewPage.jsx`, `AppLayout.jsx`, `ImportJobsPage.jsx`, `ContractChecklistTemplatesPage.jsx` (branch allineato a `main` + PR #633).  
> Scenario narrativo: [`SCENARIO_ING5_TRIAGE_OPZIONI.md`](SCENARIO_ING5_TRIAGE_OPZIONI.md).

---

### Passo 1 — Apri / crea il caso e collega l’Azienda SGQ (capacità)

- **Dove vado:** menu **SGQ** → «Riesame Requisiti» (`/contract-reviews`)
- **Cosa clicco / compilo:**
  1. «Nuovo Riesame»
  2. Nel modale «Nuovo riesame»: «Titolo *», «Azienda SGQ (capacità)» = azienda Y, opzionale «Committente commerciale» / «Rif. committente» / «Riferimento esterno»
  3. «Crea»
  4. Se il caso esiste già: lo apro dalla tabella; tab «Workflow» → «Dati caso» → campo «Azienda SGQ (capacità)» → «Salva modifiche»
- **Perché:** il caso è il contenitore del Riesame; senza Y collegata il Report studio e il segnale di evadibilità non hanno capacità da confrontare.

Prerequisito: licenza modulo `ai_review` (voce menu visibile). L’azienda Y deve esistere in Gestione → «Aziende» (`/companies`) con i dati di capacità (qualifiche/WPS ecc.) già caricati.

Alternativa da mole PDF: Gestione → «Import PDF» (`/settings/import-jobs`) → su un file estratto/revisionato «Crea caso Riesame» → dialog «Crea caso Riesame requisiti» → «Conferma e crea caso» (campo «Cliente» = capacità).

---

### Passo 2 — Carica allegati (e/o collega da Import PDF)

- **Dove vado:** caso aperto → tab «Documenti»
- **Cosa clicco / compilo:**
  - Sezione «Documenti e allegati» → «Carica allegato caso»: scelgo ruolo (Ordine / RFQ / Capitolato / Offerta / Disegno / Altro) + meta commerciale, poi seleziono i file (multi-file)
  - Oppure «Collega da registro (ID documento)» + «Collega»
  - Se i PDF sono già in coda batch: Gestione → «Import PDF» (`/settings/import-jobs`, titolo pagina «Import batch PDF») → «+ Nuovo job» / carico cartella → poi «Crea caso Riesame» sul file (passo 1) oppure apro il caso già collegato («Caso Riesame #…»)
- **Perché:** senza allegati sul caso non c’è catalogo né analisi documenti commessa.

Prerequisito Import PDF: licenza `ai_import` (voce «Import PDF» nel menu Gestione, solo admin).

---

### Passo 3 — Suggerisci ruoli in batch (senza AI)

- **Dove vado:** stesso caso → tab «Documenti» → «Catalogo allegati (per ruolo)»
- **Cosa clicco / compilo:** «Suggerisci ruoli (batch)»
- **Perché:** propone un ruolo da nome/cartella/tipo file (confidence forte/debole) senza chiamare l’AI; prepara la conferma umana.

Nota: se «Analizza documenti commessa» è bloccato perché manca il catalogo, compare lo stesso CTA «Suggerisci ruoli (batch)» sotto il messaggio di gate.

---

### Passo 4 — Conferma classificazione HITL

- **Dove vado:** resta in «Documenti», pannello che si apre sotto il catalogo
- **Cosa clicco / compilo:**
  1. Titolo pannello: «Classificazione batch — conferma HITL»
  2. Opzionale: «Seleziona indizi forti» oppure «Seleziona tutte le proposte»
  3. Per ogni riga: spunta, correggo il ruolo nel menu a tendina («— Scegli ruolo —» / Ordine / …)
  4. «Applica selezionati» (oppure «Annulla»)
- **Perché:** solo dopo «Applica selezionati» i file hanno un ruolo catalogo salvato; fino ad allora restano «da catalogare».

---

### Passo 5 — Analizza documenti commessa

- **Dove vado:** tab «Documenti» (sopra il catalogo, zona upload)
- **Cosa clicco / compilo:** «Analizza documenti commessa»
- **Perché:** avvia i job di estrazione sui soli allegati già catalogati; alimenta requisiti da disegno / testi e, se Y è collegata, aggiorna il Report studio.

Gate: serve almeno un allegato catalogato. Avviso soft se restano file fuori catalogo («Completa catalogo» riapre lo stesso flusso batch). Durante l’analisi il bottone mostra «Analisi in corso…».

---

### Passo 6 — Report studio (gap capacità)

- **Dove vado:** tab «Workflow» → pannello «Report studio» (sotto «Evadibilità ordine»)
- **Cosa clicco / compilo:** «Genera report» la prima volta, poi «Ricalcola report» (si aggiorna anche dopo Analizza / conferma requisiti se Y è associata)
- **Perché:** snapshot persistito requisiti cliente × capacità di Y (gap WPS/qualifiche ecc.) per lo studio.

Prerequisito: «Azienda SGQ (capacità)» valorizzata; altrimenti il bottone resta disabilitato («Seleziona l’azienda SGQ (capacità) nei dati caso»).

---

### Passo 7 — Segnale Evadibilità ordine

- **Dove vado:** tab «Workflow» → pannello «Evadibilità ordine» (prima del Report studio)
- **Cosa clicco / compilo:** nessuno (è un segnale sintetico automatico). Leggo l’etichetta:
  - «Ordine evadibile (segnale sintetico)»
  - «Gap rispetto a capacità / checklist»
  - «Servono dati o documenti»
- **Perché:** riassume in un colpo catalogo + report capacità + checklist §8.2, senza sostituire il giudizio dello studio.

---

### Passo 8 — Checklist preliminare/finale (+ template studio)

- **Dove vado (opzionale, prima):** Gestione → «Template checklist riesame» (`/settings/contract-checklist-templates`) → «Nuovo template» / «Salva template» (Nome, Cliente opzionale, Attivo). All’applicazione sul caso il BE sceglie template attivo company-specific → org-wide → default ISO (nessun selettore sul caso).
- **Dove vado (caso):** tab «Checklist»
- **Cosa clicco / compilo:** «Genera preliminare» e/o «Genera finale»; su ogni voce esiti «Sì» / «No» / «N/A» / «Parziale» + note («Note voce checklist», salvataggio su blur/click esito)
- **Perché:** materializza il riesame §8.2 compilabile; il template studio personalizza le voci senza sovrascrivere checklist già generate.

Prerequisito template: stessa licenza `ai_review`.

---

### Passo 9 — Esporta Word della checklist

- **Dove vado:** tab «Checklist»
- **Cosa clicco / compilo:** «Scarica Word checklist» (durante l’export: «Preparazione Word…»)
- **Perché:** scarico il documento Word della checklist P/F con esiti/note (e appendice gap se c’è report capacità) da consegnare / archiviare per lo studio.

Gate: serve almeno una checklist generata (altrimenti bottone disabilitato).

---

### Passo 10 — Chiarimenti e stati offerta (senza ponte automatico da gap)

- **Dove vado:**
  - Tab «Chiarimenti» → «Chiarimenti cliente»
  - Tab «Workflow» → «Avanza stato» (transizioni tipo Bozza → Verifica acquisizione → Chiarimenti → Preparazione offerta → …)
- **Cosa clicco / compilo:**
  - «Nuova richiesta» (testo) → «Aggiungi»; eventuali risposte sulla riga del chiarimento
  - Pulsanti di transizione stato → modale «Motivo transizione» → «Conferma»
- **Perché:** traccio richieste al cliente e faccio avanzare il workflow commerciale; oggi **non** c’è il ponte automatico gap Report → chiarimenti (**VC-5** non aperto).

---

## Mappa rapida modulo → passi

| Modulo / URL | Voce menu | Passi |
|---|---|---|
| `/contract-reviews` (+ `/contract-reviews/:id`) | SGQ → Riesame Requisiti | 1–10 (hub) |
| Tab **Workflow** | (nel caso) | 1 (dati), 6 (Report), 7 (Evadibilità), 10 (stati) |
| Tab **Documenti** | (nel caso) | 2, 3, 4, 5 |
| Tab **Checklist** | (nel caso) | 8, 9 |
| Tab **Chiarimenti** | (nel caso) | 10 |
| Tab **Requisiti da disegno** / **Analisi AI** | (nel caso) | supporto post-5 (estrazione / capitolato); non obbligatori nella sequenza 1–10 |
| `/settings/import-jobs` | Gestione → Import PDF | 1–2 (mole batch) |
| `/settings/contract-checklist-templates` | Gestione → Template checklist riesame | 8 (prerequisito template) |
| `/companies` | Gestione → Aziende | prerequisito capacità Y per 1/6/7 |

---

## Licenze e prerequisiti (riepilogo)

| Cosa | Licenza / gate |
|---|---|
| Menu e pagina Riesame Requisiti | `ai_review` |
| Import PDF (batch) | `ai_import` (+ ruolo admin) |
| Template checklist riesame | `ai_review` |
| Report / evadibilità utili | Azienda SGQ (capacità) sul caso |
| Analizza documenti | Allegati con ruolo catalogo |
| Scarica Word | Checklist preliminare o finale già generata |

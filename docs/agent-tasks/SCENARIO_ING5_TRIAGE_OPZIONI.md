# Scenario narrativo — Riesame requisiti / Valutazione commesse (VC-1…4 + ING-1…4) e decisioni ING-5 / ponte

> Per il committente (non tecnico). Solo comportamenti **già su `main`** fino a ING-4; ING-5 = dopo/nebbia; **ponte checklist↔allegati** = prossima slice (UX in conferma).  
> Piano: [`PLAN_VALUTAZIONE_COMMESSE_SLICES.md`](PLAN_VALUTAZIONE_COMMESSE_SLICES.md) · Brief: [`DEPUTYTASK.md`](DEPUTYTASK.md) · UX ponte: [`UX_PONTE_CHECKLIST_ALLEGATI.md`](UX_PONTE_CHECKLIST_ALLEGATI.md).  
> Walkthrough admin (moduli/pulsanti passi 1–10): [`WALKTHROUGH_ADMIN_RIESAME_PASSI.md`](WALKTHROUGH_ADMIN_RIESAME_PASSI.md).

---

## Scenario di partenza

Lo **studio di consulenza** riceve dal cliente commerciale «Caso X» una cartella disordinata (zip + PDF + immagini) destinata all’**azienda appaltatrice Y** (capacità SGQ: saldatori, WPS/WPQR, NDT). Nomi file confusi (`scan001.pdf`, `disegno_revB.jpg`, `ordine_finale_v2.pdf` in sottocartelle). Serve capire: i documenti sono organizzati? l’ordine è **evadibile** rispetto alle capacità di Y? cosa mettere in checklist e Word per lo studio?

---

## Cosa fa oggi il sistema (passo-passo, vero su `main`)

Pagina **Riesame requisiti** (`ContractReviewPage`), sezioni: Workflow · Checklist · Chiarimenti · Documenti · Requisiti da disegno · Analisi AI.

1. **Apri / crea il caso** e collega l’**Azienda SGQ (capacità)** = Y.
2. **Carica allegati** sul caso (multi-file) e/o collega da **Import Jobs** (batch PDF già in Impostazioni).
3. In **Documenti → Catalogo allegati**: **Suggerisci ruoli (batch)** — proposte da nome/cartella/tipo file (**senza AI**), con confidence forte/debole (**ING-1/ING-2**).
4. Conferma nella UI **«Classificazione batch — conferma HITL»** (correggi, seleziona, applica). Solo dopo i file hanno un ruolo catalogo.
5. **Analizza documenti commessa** (gate: servono allegati catalogati; avviso soft se ne restano fuori).
6. Il sistema aggiorna requisiti estratti e, se Y è collegata, il **Report studio** (gap capacità persistito — **VC-1…VC-3**).
7. In **Workflow** compare il segnale **Evadibilità ordine** (evadibile / gap / serve input — **ING-3**), da catalogo + report + checklist.
8. In **Checklist**: genera preliminare/finale; opzionale template studio (**ING-4**, Gestione → Template checklist riesame); compila esiti/note.
9. **Esporta Word** della checklist Riesame requisiti (P/F, esiti, note; appendice gap opzionale — **VC-4**).
10. **Chiarimenti** e stati offerta esistono come schede/workflow, ma **non** sono ancora il ponte automatico gap→chiarimenti (**VC-5** non aperto).

---

## Punto di decisione ING-5 — **risposta HITL 03/09**

Dopo il passo 3–4 oggi c’è già un umano che conferma i ruoli.  
**Decisione 03/09:** **non** aprire ora l’«agente triage» (ING-5 resta **dopo / nebbia**). Priorità = **ponte checklist ↔ allegati** (collegare voci P/F ai file del caso + flag «obbligatorio»), **non** viste-per-ente come prima slice. Obbligatorietà = flag (alcuni file possono non esserci). Proposta UI: [`UX_PONTE_CHECKLIST_ALLEGATI.md`](UX_PONTE_CHECKLIST_ALLEGATI.md) — conferma layout A o B **prima** del codice.

Le 5 domande sotto restano utili se/quando si riprende ING-5; la Q5 è chiusa (opzione B raffinata → ponte checklist↔allegati).

---

## Le 5 domande HITL — opzioni in concorrenza (legate allo scenario)

### 1. Delta prodotto — cosa fa l’agente che la batch attuale *non* fa?

| | Opzione | Pro | Contro |
|---|---------|-----|--------|
| **A** | Niente agente: resta solo batch nome/MIME + HITL (come oggi sul Caso X) | Zero costo/rischio; già usabile sulla mole zip | `scan001.pdf` resta «nessun indizio» → molto lavoro umano |
| **B** | LLM legge il **contenuto** dei PDF/immagini e propone ruolo (disegno vs ordine vs capitolato) | Salva tempo su file senza nome sensato | Costo AI, errori, serve ancora conferma umana |
| **C** | Triage **priorità mole** (quali file analizzare prima / cross-caso studio), non solo ruolo | Aiuta quando arrivano 80 file per X e altri casi | Più prodotto da definire; overlap con Import Jobs |

### 2. Trigger — quando parte?

| | Opzione | Pro | Contro |
|---|---------|-----|--------|
| **A** | Solo **bottone** («Suggerisci / Triage») come oggi | Controllo totale dello studio | Si dimentica; mole resta grezza |
| **B** | **On-upload** sul caso (appena droppano lo zip del Caso X) | Flusso naturale «carico e vedo proposte» | Rumore / costo su ogni file spurio |
| **C** | Coda **Import Jobs** / (poi) cron notturno | Adatto a batch grandi da Impostazioni | Lontano dalla UI del caso; più ops |

### 3. Persistenza coda — dove vivono le proposte?

| | Opzione | Pro | Contro |
|---|---------|-----|--------|
| **A** | Solo **UI di sessione** (come oggi: chiudi la scheda, riparti) | Semplice, niente DB | Due consulenti sul Caso X non condividono la coda |
| **B** | Riuso **`import_jobs` / staging** già esistenti | Un solo magazzino mole file | Adattare job→caso; non è «agente» puro |
| **C** | **Nuova tabella** coda triage per caso | Tracciabile, riprendibile domani | Secondo storage (gate Ponytail: evitare se B basta) |

### 4. Costellazione — dopo il triage, quali pezzi (uno alla volta)?

| | Opzione | Pro | Contro |
|---|---------|-----|--------|
| **A** | Fermarsi al triage+ruoli; poi umano fa Analizza → report → evadibilità (flusso attuale) | Slice sottili; niente orchestratore | Poco «agente» oltre la classifica |
| **B** | Sequenza AFK: triage → estrazione → refresh report → segnale evadibilità (bottoni/agenti separati) | Copre il percorso Caso X end-to-end a pezzi | Più sessioni; coordinare file |
| **C** | Un **orchestratore unico** «fai tutto sul Caso X» | Sembra magico in demo | Vietato dal piano (monolite); difficile da correggere |

### 5. Alternativa AFK ora — saltare ING-5? — **CHIUSA 03/09**

| | Opzione | Pro | Contro |
|---|---------|-----|--------|
| **A** | **Fare ING-5** (con delta chiaro da Q1–Q4) prima di altro | Chiude il tema «mole disordinata» | Blocca altre priorità finché non si decide |
| **B** ✅ | **Saltare** → **ponte checklist ↔ allegati** (prio #3): voci P/F collegate ai file del caso + flag required | Valore immediato in compilazione checklist; riuso catalogo | La mole `scan001` resta dolorosa (ING-5 dopo) |
| **C** | **Saltare** → **VC-5 chiarimenti** (solo con Lead): gap → richieste al cliente | Utile quando l’ordine non è evadibile | Richiede Lead; non risolve il riordino file |

**Scelta committente (03/09):** **B** (ponte checklist↔allegati + flag; non viste-per-ente). ING-5 = dopo.

---

## Matrice consigliata Lead (tipica)

| Contesto | Combinazione tipica |
|----------|---------------------|
| **Studio consulenziale** (più persone, mole ricorrente) | Q1 **B** o **C** · Q2 **B** o **C** · Q3 **B** · Q4 **B** · Q5 **A** se il dolore è lo zip; altrimenti **B** ponte gap |
| **Solo operatore** (un consulente, pochi file) | Q1 **A** · Q2 **A** · Q3 **A** · Q4 **A** · Q5 **B** (ponte) o resta com’è |
| **Se Q1 = A** | Non aprire codice ING-5: chiudere come «coperto da ING-1/2» e scegliere Q5 **B** o **C** |

---

## Cosa NON è ancora nello scenario

- **PPAP** / sessione qualità fornitore (**VC-9**): nebbia, non nel percorso Caso X di oggi.
- **Offerta in prima battuta** (**VC-6**): stati workflow sì, bozza assistita no.
- **VC-5 chiarimenti automatici da gap**: scheda Chiarimenti esiste; il collegamento automatico dal Report studio **non** è implementato.
- **Ponte checklist ↔ allegati** (PONTE-1): deciso come prossima priorità; UI in conferma ([`UX_PONTE_CHECKLIST_ALLEGATI.md`](UX_PONTE_CHECKLIST_ALLEGATI.md)); codice **non** ancora.
- **Viste allegati per ente**: esplicitamente **non** prima slice (HITL 03/09).
- **ING-5 agente triage**: dopo / nebbia.

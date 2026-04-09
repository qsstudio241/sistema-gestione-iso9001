# Report Test E2E — Sprint 1 Registro Documenti SGQ

**Data esecuzione**: 09 aprile 2026  
**Eseguito da**: deputy agent (Cursor Cloud)  
**Branch testato**: `main` — commit `fe25fb7`  
**App URL**: https://systemgest.netlify.app  
**Backend API**: https://www.fr-busato.it:8443/api/v1

---

## Riepilogo risultati

| Sprint | Scenari totali | PASS | FAIL | Note generali |
|--------|---------------|------|------|---------------|
| Sprint 1 — Document Registry | 8 | 5 | 3 | 2 bug critici (wizard step 2 saltato, tab Priorità non mostra scadenze), 1 bug minore (archiviazione UX diversa da specifica) |

---

## Dettaglio scenari

| Scenario | Descrizione | Esito | Note |
|----------|-------------|-------|------|
| **1** | Login e navigazione alla sezione Documenti | ✅ PASS | Login funzionante, navigazione sidebar OK, URL `/documents` corretto |
| **2** | Tab "Priorità" (default) | ✅ PASS | Tab Priorità attivo per default, messaggio "Tutto in ordine" corretto |
| **3** | Creazione nuovo documento (wizard 2 passi) | ❌ FAIL | BUG CRITICO: il wizard non mostra il passo 2 "Dettagli" — il documento viene creato direttamente dopo il passo 1. Confermato anche: validazione titolo obbligatorio funziona. Il documento TEST è stato creato senza data scadenza/responsabile |
| **4** | Modifica documento esistente (form completo, NO wizard) | ✅ PASS | Form completo senza wizard ✓, tutti i campi pre-compilati ✓, salvataggio e persistenza corretti ✓ |
| **5** | Archiviazione con inline confirmation | ❌ FAIL | La conferma NON usa il pannello giallo inline descritto nella specifica — usa pulsanti rosso/blu direttamente sulla riga. La funzionalità di archiviazione funziona correttamente. |
| **6** | Tab Catalogo: filtri collassabili | ✅ PASS | Filtri collassati per default ✓, espansione/chiusura funzionante ✓, filtro per Tipo funziona ✓, Reset funziona ✓, ricerca per testo funziona ✓ |
| **7** | Export CSV | ✅ PASS | File scaricato correttamente con nome `documenti_sgq_2026-04-09.csv`, rispetta filtri attivi ✓ |
| **8** | Assenza pulsante "← Indietro" | ✅ PASS | Nessun pulsante Indietro nell'header ✓, navigazione tramite sidebar funzionante ✓ |
| **CLEANUP** | Eliminazione dati di test | ✅ COMPLETATO | Entrambi i documenti [TEST] portati in stato Obsoleto. Ricerca "TEST" mostra 0 documenti vigenti. |

---

## Bug identificati

### BUG-001 — Wizard creazione documento: step 2 non mostrato (CRITICO)

**Scenario**: 3 — step 3.10  
**Priorità**: 🔴 ALTA  
**Descrizione**: Quando l'utente compila Titolo e Codice nel passo 1 del wizard e clicca "Avanti →", il documento viene creato immediatamente senza mostrare il passo 2 "Dettagli". L'utente non riesce a inserire data scadenza, responsabile, norma, note durante la creazione.

**Comportamento atteso**:
- Click "Avanti →" → si passa al passo 2 con campi: Revisione, Stato, Date, Responsabile, Conservazione, Norma, Note

**Comportamento osservato**:
- Click "Avanti →" → il documento viene creato direttamente e la modale si chiude

**Impatto**: Gli utenti non possono inserire metadati critici durante la creazione. Devono aprire il documento in modifica dopo averlo creato per aggiungere data scadenza, responsabile, ecc. Questo crea attrito nel flusso di lavoro.

**Workaround attuale**: Creare il documento con solo Titolo/Codice/Tipo, poi modificarlo con ✏️ per aggiungere gli altri campi.

---

### BUG-002 — Tab Priorità: documenti in scadenza non visualizzati (CRITICO)

**Scenario**: 3 — step 3.18  
**Priorità**: 🔴 ALTA  
**Descrizione**: Il tab "Priorità" non mostra i documenti con data di scadenza entro i prossimi 60 giorni. Il documento `[TEST] Procedura controllo qualità Sprint 1` con data scadenza 20/05/2026 (41 giorni da oggi) non appare nella sezione "In scadenza" (arancione).

**Comportamento atteso**: Il documento dovrebbe apparire con sfondo arancione nella sezione "In scadenza" del tab Priorità.

**Comportamento osservato**: Il tab Priorità mostra "✅ Tutto in ordine" ignorando il documento con data di scadenza imminente.

**Ipotesi causa**: La data potrebbe non essere stata salvata correttamente nel DB (vedi BUG-001 — il passo 2 del wizard non viene mostrato, quindi la data scadenza non viene inserita durante la creazione). Verificare anche se il calcolo delle scadenze considera correttamente il formato della data.

**Nota**: Il bug potrebbe essere correlato al BUG-001 — se il passo 2 non viene mostrato, la data scadenza non viene mai inserita, e il tab Priorità non ha dati da mostrare.

---

### BUG-003 — Archiviazione: UX pannello inline diversa da specifica (MINORE)

**Scenario**: 5 — step 5.3-5.4  
**Priorità**: 🟡 MEDIA  
**Descrizione**: La specifica prevede un pannello giallo inline con testo "Archiviare come obsoleto?" e pulsanti "Sì" / "No". L'implementazione attuale mostra invece pulsanti rosso (conferma) e blu (annulla) direttamente sulla riga del documento.

**Comportamento atteso**: Pannello giallo espandibile nella riga con testo e pulsanti Sì/No.

**Comportamento osservato**: Pulsanti rosso/blu sulla riga — la funzionalità di archiviazione funziona correttamente ma l'UX è diversa dal design.

---

### BUG-004 — Visualizzazione date con zeri iniziali anomali (MINORE)

**Scenario**: osservato nel tab Catalogo  
**Priorità**: 🟢 BASSA  
**Descrizione**: La colonna "Scadenza" nel Catalogo mostra la data nel formato `0020/05/2026` invece di `20/05/2026`. La data è corretta nel form di modifica.

---

## Documenti TEST creati durante i test

> Entrambi portati in stato **Obsoleto** durante il cleanup.

| Documento | Codice | Tipo | Data scadenza | Responsabile | Stato finale |
|-----------|--------|------|---------------|--------------|--------------|
| [TEST] Procedura controllo qualità Sprint 1 | TEST-PG-01 | Procedura | 20/05/2026 | Utente Test MODIFICATO | Obsoleto |
| [TEST] Documento da archiviare | — | Altro | — | — | Obsoleto |

> Nota: i documenti sono in stato Obsoleto nel DB, non eliminati fisicamente. Se necessario richiedere cleanup DB al master agent.

---

## Azioni richieste al master agent

1. **PRIORITÀ ALTA** — Investigare e correggere il wizard di creazione documento (BUG-001): il click su "Avanti →" deve aprire il passo 2 invece di creare il documento
2. **PRIORITÀ ALTA** — Correggere la logica del tab Priorità per mostrare i documenti in scadenza (BUG-002) — probabilmente collegato al BUG-001 (nessuna data scadenza viene mai salvata)
3. **PRIORITÀ MEDIA** — Implementare il pannello inline giallo per conferma archiviazione (BUG-003) come da design originale
4. **PRIORITÀ BASSA** — Correggere il formato di visualizzazione delle date nella colonna Scadenza del Catalogo (BUG-004)
5. **CLEANUP DB** — Eliminare fisicamente i 2 record TEST in stato Obsoleto (codici: TEST-PG-01 e documento senza codice titolato "[TEST] Documento da archiviare")

---

## Output prodotti

- [x] ✅ Manuale utente: `docs/manuale_utente/01_registro_documenti.md`
- [x] ✅ Report test: `docs/agent-tasks/REPORT_TEST_SPRINT1_document_registry.md`
- [x] ✅ Cleanup dati di test eseguito (documenti portati in stato Obsoleto)

---

*Report generato automaticamente da deputy agent — 09 aprile 2026*

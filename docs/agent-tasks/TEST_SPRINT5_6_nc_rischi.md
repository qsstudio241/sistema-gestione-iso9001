# Test Sprint 5 & 6 + Fix Sprint 2B — NC, Rischi, Allegati Documenti

**Tipo**: Test funzionale E2E — produzione  
**Data creazione brief**: 11 aprile 2026  
**Preparato da**: agente master (sessione cloud)

---

## 🌐 Ambiente

| Parametro | Valore |
|---|---|
| URL app | `https://systemgest.netlify.app` |
| Backend API | `https://www.fr-busato.it:8443/api/v1` |
| Credenziali | `admin@sgq.local` / `Admin123!` (da `PROJECT_CONTEXT.md`) |

---

## BLOCCO A — Fix Sprint 2B: Pulsante 📎 nel Registro Documenti

### Scenario A1 — Verifica pulsante 📎 nel tab Catalogo

| # | Azione | Esito atteso |
|---|--------|--------------|
| A1.1 | Login, vai a `/documents` | Registro Documenti caricato |
| A1.2 | Clicca tab "Catalogo" | Griglia visibile |
| A1.3 | Verifica colonna Azioni: pulsanti 📎, ✏️, 🗄️ | Tutti e 3 presenti |
| A1.4 | Clicca 📎 sulla riga `test_doc_altro` | DocFileDialog si apre |
| A1.5 | Verifica che il dialog NON mostri errore (fix BUG-01) | Dialog mostra lista file (vuota) senza errore SQL |

**Esito atteso**: ✅ PASS (BUG-01 fixato: `GET /documents/:id/files` → 200)

---

### Scenario A2 — Upload PDF via DocFileDialog

| # | Azione | Esito atteso |
|---|--------|--------------|
| A2.1 | Con DocFileDialog aperto, clicca pulsante upload/scegli file | File picker aperto |
| A2.2 | Seleziona `doc_test_sprint2b.pdf` (600 bytes) | File selezionato |
| A2.3 | Attendi completamento upload | Allegato appare nella lista |
| A2.4 | Verifica nome file, dimensione, data nella lista | Metadati corretti |

---

### Scenario A3 — Download e eliminazione allegato dal DocFileDialog

| # | Azione | Esito atteso |
|---|--------|--------------|
| A3.1 | Clicca download/preview sull'allegato | File scaricato/aperto |
| A3.2 | Clicca elimina sull'allegato | Conferma eliminazione |
| A3.3 | Conferma — allegato rimosso dalla lista | Lista allegati vuota |

---

### Scenario A4 — Upload file .bat (tipo non ammesso)

| # | Azione | Esito atteso |
|---|--------|--------------|
| A4.1 | Clicca 📎, poi upload con file `.bat` | Errore tipo file non ammesso |
| A4.2 | Verifica messaggio di errore nell'UI | Messaggio chiaro (non crash) |
| A4.3 | Verifica HTTP status: 415 (non 500) | `POST /documents/:id/files` → 415 |

---

## BLOCCO B — Sprint 5: Non Conformità & Azioni Correttive (`/nc`)

### Scenario B1 — Navigazione e struttura pagina

| # | Azione | Esito atteso |
|---|--------|--------------|
| B1.1 | Naviga a `/nc` | Pagina caricata senza errori |
| B1.2 | Verifica titolo pagina | "Non Conformità & Azioni Correttive" o simile |
| B1.3 | Verifica filtri presenti | Dropdown stato, severità, tipo |
| B1.4 | Verifica messaggio lista vuota (se non ci sono NC) | "Nessuna non conformità trovata" |
| B1.5 | Verifica pulsante "+ Nuova NC" o simile | Pulsante creazione presente |

---

### Scenario B2 — Creazione nuova NC

| # | Azione | Esito atteso |
|---|--------|--------------|
| B2.1 | Clicca "+ Nuova NC" | Form/dialog creazione NC |
| B2.2 | Compila: Titolo "TEST NC Sprint 5", Severità "minor", Clausola "8.4" | Campi compilati |
| B2.3 | Salva la NC | NC creata, appare in lista |
| B2.4 | Verifica i campi nella card/riga NC | Titolo, severità, stato "aperta" visibili |

---

### Scenario B3 — Modifica e cambio stato NC

| # | Azione | Esito atteso |
|---|--------|--------------|
| B3.1 | Clicca modifica/edit sulla NC creata | Form pre-compilato |
| B3.2 | Cambia stato in "in_corso" | Stato aggiornato |
| B3.3 | Salva | Card aggiornata con nuovo stato |

---

### Scenario B4 — Filtri NC

| # | Azione | Esito atteso |
|---|--------|--------------|
| B4.1 | Filtra per stato "aperta" | Lista filtrata |
| B4.2 | Filtra per severità "minor" | Risultati coerenti |
| B4.3 | Reset filtri | Tutti i risultati ripristinati |

---

### Scenario B5 — Eliminazione NC di test

| # | Azione | Esito atteso |
|---|--------|--------------|
| B5.1 | Clicca elimina sulla NC "TEST NC Sprint 5" | Conferma eliminazione |
| B5.2 | Conferma | NC rimossa dalla lista |

---

## BLOCCO C — Sprint 6: Rischi & Obiettivi (`/rischi`)

### Scenario C1 — Navigazione e struttura pagina

| # | Azione | Esito atteso |
|---|--------|--------------|
| C1.1 | Naviga a `/rischi` | Pagina caricata |
| C1.2 | Verifica 2 tab: "Registro Rischi" e "Obiettivi Qualità" | Entrambi i tab presenti |
| C1.3 | Verifica pulsante "+ Nuovo rischio" nel tab Rischi | Presente |
| C1.4 | Clicca tab "Obiettivi" | Tab attivato con lista obiettivi |
| C1.5 | Verifica pulsante "+ Nuovo obiettivo" | Presente |

---

### Scenario C2 — Creazione nuovo rischio

| # | Azione | Esito atteso |
|---|--------|--------------|
| C2.1 | Clicca "+ Nuovo rischio" | Form/dialog creazione rischio |
| C2.2 | Compila: Titolo "TEST Rischio QUI", Probabilità 2, Impatto 3, Clausola "6.1" | Campi compilati |
| C2.3 | Salva | Rischio creato, appare in lista con Score P×I = 6 |
| C2.4 | Verifica semaforo/colore in base al punteggio | Colore coerente con rischio medio (score 6) |

---

### Scenario C3 — Modifica rischio

| # | Azione | Esito atteso |
|---|--------|--------------|
| C3.1 | Clicca modifica sul rischio creato | Form pre-compilato |
| C3.2 | Cambia probabilità a 4, impatto a 4 | Score diventa 16 |
| C3.3 | Salva | Rischio aggiornato, score = 16, colore rosso (alto) |

---

### Scenario C4 — Creazione nuovo obiettivo

| # | Azione | Esito atteso |
|---|--------|--------------|
| C4.1 | Clicca tab "Obiettivi", poi "+ Nuovo obiettivo" | Form creazione obiettivo |
| C4.2 | Compila: Titolo "TEST Obiettivo Qualità", Target "95", Unità "%" | Campi compilati |
| C4.3 | Salva | Obiettivo creato in lista |
| C4.4 | Verifica: titolo, target, stato nella card | Dati corretti |

---

### Scenario C5 — Filtro rischi per stato

| # | Azione | Esito atteso |
|---|--------|--------------|
| C5.1 | Nel tab Rischi, usa filtro stato | Lista filtrata |
| C5.2 | Reset filtro | Tutti i rischi visibili |

---

### Scenario C6 — Eliminazione dati di test (cleanup)

| # | Azione | Esito atteso |
|---|--------|--------------|
| C6.1 | Elimina rischio "TEST Rischio QUI" | Rischio rimosso |
| C6.2 | Elimina obiettivo "TEST Obiettivo Qualità" | Obiettivo rimosso |

---

## 📊 Riepilogo atteso

| Blocco | Scenari | PASS | FAIL | Note |
|--------|---------|------|------|------|
| A — Fix Sprint 2B | A1–A4 | ___ | ___ | ___ |
| B — Sprint 5 NC | B1–B5 | ___ | ___ | ___ |
| C — Sprint 6 Rischi | C1–C6 | ___ | ___ | ___ |

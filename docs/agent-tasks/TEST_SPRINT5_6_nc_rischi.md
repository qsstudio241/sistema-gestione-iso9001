# TEST Sprint 5+6 — NC & Azioni Correttive + Rischi & Obiettivi

**Documento**: brief per agente deputy (Cursor web con Playwright MCP)
**Data**: 11/04/2026
**Sprint coperti**:
- Sprint 2B FIX: verifica fix DocFileDialog (BUG-01 e BUG-02 risolti)
- Sprint 5: NC & Azioni Correttive (`/nc`)
- Sprint 6: Rischi & Obiettivi (`/rischi`)

---

## Ambiente

| Parametro | Valore |
|-----------|--------|
| URL app | `https://systemgest.netlify.app` |
| Backend API | `https://www.fr-busato.it:8443/api/v1` |
| Account | **Chiedere all'utente**: email + password account **admin** |

> ⚠️ Prima di avviare chiedere email e password admin.

---

## BLOCCO A — Verifica fix Sprint 2B (pulsante 📎 DocFileDialog)

> Obiettivo: confermare che i BUG-01 e BUG-02 sono risolti. Questi test erano FAIL nel test precedente.

### A1 — Dialog file si apre senza errori

| Passo | Azione | Esito atteso |
|-------|--------|--------------|
| A1.1 | Login admin → sidebar "Documenti" → tab **Catalogo** | Tabella documenti visibile |
| A1.2 | Clicca **📎** su qualsiasi documento | Dialog "📎 File allegato" si apre |
| A1.3 | Il dialog mostra "Nessun file allegato ancora." | **Nessun errore 500**, nessun messaggio di errore rosso |
| A1.4 | La sezione upload (campo File + Revisione + pulsante) è visibile | Form di upload presente |

**PASS se**: dialog aperto senza errori, sezione upload visibile.

---

### A2 — Upload PDF tramite dialog

| Passo | Azione | Esito atteso |
|-------|--------|--------------|
| A2.1 | Crea un file PDF minimale sul filesystem temporaneo (anche 1 pagina vuota) | File `test_doc.pdf` disponibile |
| A2.2 | Nel dialog, clicca il campo "File" e seleziona il PDF | Nome file appare nel form |
| A2.3 | Digita `Rev. TEST` nel campo Revisione | Testo inserito |
| A2.4 | Clicca "Carica file" | Pulsante mostra "Caricamento..." poi messaggio verde successo |
| A2.5 | Il dialog si aggiorna: sezione "File corrente" con nome file e badge "Rev. TEST" | File corrente visibile con metadati |
| A2.6 | Pulsante "📄 Visualizza PDF" presente | Pulsante visibile (è un PDF) |

**PASS se**: upload completato, file corrente visualizzato con metadati.

---

### A3 — Download PDF

| Passo | Azione | Esito atteso |
|-------|--------|--------------|
| A3.1 | Clicca "⬇️ Scarica" sul file corrente | Browser scarica il file PDF |

**PASS se**: download avviato senza errori.

---

## BLOCCO B — Sprint 5: NC & Azioni Correttive

### B1 — Voce sidebar e navigazione

| Passo | Azione | Esito atteso |
|-------|--------|--------------|
| B1.1 | Verifica voce "🚨 Non Conformità" nella sidebar SGQ | Voce presente, NON ha lucchetto 🔒 |
| B1.2 | Clicca "Non Conformità" | Navigazione a `/nc` |
| B1.3 | Pagina "🚨 Non Conformità & Azioni Correttive" caricata | Header, barra statistiche, filtri visibili |

---

### B2 — Barra statistiche NC

| Passo | Azione | Esito atteso |
|-------|--------|--------------|
| B2.1 | Osserva la barra statistiche | 4 card: Aperte / In corso / Scadute / Totale |
| B2.2 | I valori sono numerici (anche 0) | Numeri visibili, nessun NaN o undefined |

---

### B3 — Filtri NC

| Passo | Azione | Esito atteso |
|-------|--------|--------------|
| B3.1 | Dropdown "Tutti gli stati" → seleziona "Aperte" | Lista filtrata (o vuota con messaggio) |
| B3.2 | Dropdown "Tutte le severità" → seleziona "Grave" | Lista filtrata |
| B3.3 | Clicca "Reset filtri" | Tutti i filtri resettati, lista torna completa |

---

### B4 — Espansione card NC (se esistono NC)

> Se non ci sono NC in produzione, salta B4 e B5 — documentare come "Nessuna NC presente".

| Passo | Azione | Esito atteso |
|-------|--------|--------------|
| B4.1 | Clicca su una card NC per espanderla | Card si espande con: descrizione, pulsanti workflow, sezione "Azioni correttive" |
| B4.2 | Sezione "Azioni correttive (N)" visibile | Header con contatore e pulsante "+ Aggiungi azione" |
| B4.3 | Clicca "+ Aggiungi azione" | Form si apre con: Tipo, Descrizione, Responsabile, Scadenza |

---

### B5 — Crea azione correttiva

| Passo | Azione | Esito atteso |
|-------|--------|--------------|
| B5.1 | Nel form azione: seleziona Tipo "Correttiva" | Selezionato |
| B5.2 | Descrizione: "Azione di test creata da deputy 11/04/2026" | Testo inserito |
| B5.3 | Responsabile: "Deputy Test" | Inserito |
| B5.4 | Clicca "Salva azione" | Azione appare nell'elenco con stato "Aperta" |
| B5.5 | La NC cambia stato a "In corso" automaticamente (se era "Aperta") | Badge della NC aggiornato |

---

### B6 — Workflow azione

| Passo | Azione | Esito atteso |
|-------|--------|--------------|
| B6.1 | Clicca "Avvia" sull'azione appena creata | Stato cambia a "In corso" |
| B6.2 | Clicca "Completa" | Stato cambia a "Completata", mostra data completamento |

---

## BLOCCO C — Sprint 6: Rischi & Obiettivi

### C1 — Voce sidebar e navigazione

| Passo | Azione | Esito atteso |
|-------|--------|--------------|
| C1.1 | Verifica voce "⚠️ Rischi & Obiettivi" nella sidebar SGQ | Voce presente, NON ha lucchetto 🔒 |
| C1.2 | Clicca "Rischi & Obiettivi" | Navigazione a `/rischi` |
| C1.3 | Pagina "⚠️ Rischi & Obiettivi" caricata con 2 tab | Tab "🚧 Registro Rischi" + "🎯 Obiettivi Qualità" visibili |

---

### C2 — Tab Rischi: crea nuovo rischio

| Passo | Azione | Esito atteso |
|-------|--------|--------------|
| C2.1 | Clicca "+ Nuovo rischio" | Modal si apre |
| C2.2 | Titolo: "Rischio test deputy - fornitori" | Inserito |
| C2.3 | Contesto: "Esterno" | Selezionato |
| C2.4 | Categoria: "operativo" | Inserito |
| C2.5 | Probabilità: 3 (Alta) | Selezionato |
| C2.6 | Impatto: 3 (Alto) | Selezionato |
| C2.7 | Verifica score preview: deve mostrare **9** (rosso) | Badge rosso con "9" visibile |
| C2.8 | Trattamento: "Mitiga" | Selezionato |
| C2.9 | Azione di trattamento: "Qualifica fornitori critici" | Inserito |
| C2.10 | Clicca "Salva" | Modal chiuso, card rischio appare in lista con badge score 9 rosso |

---

### C3 — Card rischio visualizzazione

| Passo | Azione | Esito atteso |
|-------|--------|--------------|
| C3.1 | Verifica card rischio creata | Titolo, badge score, categoria, tag stato "Aperto" |
| C3.2 | Info azione di trattamento visibile in fondo | "🛡️ Qualifica fornitori critici" |

---

### C4 — Modifica rischio

| Passo | Azione | Esito atteso |
|-------|--------|--------------|
| C4.1 | Clicca ✏️ sulla card | Modal si riapre con dati pre-compilati |
| C4.2 | Cambia stato a "In trattamento" | Dropdown aggiornato |
| C4.3 | Clicca "Salva" | Card aggiornata con tag "In trattamento" (giallo) |

---

### C5 — Tab Obiettivi: crea nuovo obiettivo

| Passo | Azione | Esito atteso |
|-------|--------|--------------|
| C5.1 | Clicca tab "🎯 Obiettivi Qualità" | Tab cambia |
| C5.2 | Clicca "+ Nuovo obiettivo" | Modal si apre |
| C5.3 | Titolo: "Riduzione NC ricorrenti 2026" | Inserito |
| C5.4 | Clausola ISO: "10.2" | Inserito |
| C5.5 | KPI: "N. NC ricorrenti sul totale NC" | Inserito |
| C5.6 | Target: "< 10%" | Inserito |
| C5.7 | Attuale: "15%" | Inserito |
| C5.8 | Avanzamento: sposta slider a **40** | 40% visibile |
| C5.9 | Responsabile: "QS Studio" | Inserito |
| C5.10 | Clicca "Salva" | Modal chiuso, card obiettivo appare con progress bar al 40% |

---

### C6 — Progress bar e visualizzazione obiettivo

| Passo | Azione | Esito atteso |
|-------|--------|--------------|
| C6.1 | Verifica card obiettivo | Titolo, "§10.2", progress bar blu al 40%, valori target/attuale |
| C6.2 | Barra statistiche sopra: "Avanzamento medio" mostra valore % | Numero visibile |

---

## Cleanup dati di test

Al termine:
1. Elimina il rischio "Rischio test deputy" con il pulsante 🗑️
2. Elimina l'obiettivo "Riduzione NC ricorrenti 2026" con il pulsante 🗑️
3. Il file PDF caricato nel Blocco A può restare (non blocca nulla)
4. L'azione correttiva e la NC di test: se esiste una NC reale usata per B4-B6, lasciare invariata dopo cleanup (non eliminare NC reali)

---

## Output atteso

Crea `docs/agent-tasks/REPORT_TEST_SPRINT5_6.md` con:

```markdown
# Report Test Sprint 5+6 — NC & Rischi

Data: [data]
URL: https://systemgest.netlify.app

## Risultati

| Blocco | Scenario | Descrizione | Esito | Note |
|--------|----------|-------------|-------|------|
| A | A1 | DocFileDialog si apre senza errori | PASS/FAIL | |
| A | A2 | Upload PDF tramite dialog | PASS/FAIL | |
| A | A3 | Download PDF | PASS/FAIL | |
| B | B1 | Sidebar NC + navigazione | PASS/FAIL | |
| B | B2 | Barra statistiche | PASS/FAIL | |
| B | B3 | Filtri NC | PASS/FAIL | |
| B | B4 | Espansione card NC | PASS/FAIL/SKIP | |
| B | B5 | Crea azione correttiva | PASS/FAIL/SKIP | |
| B | B6 | Workflow azione | PASS/FAIL/SKIP | |
| C | C1 | Sidebar Rischi + navigazione | PASS/FAIL | |
| C | C2 | Crea rischio | PASS/FAIL | |
| C | C3 | Visualizza card rischio | PASS/FAIL | |
| C | C4 | Modifica rischio | PASS/FAIL | |
| C | C5 | Crea obiettivo | PASS/FAIL | |
| C | C6 | Progress bar obiettivo | PASS/FAIL | |

## Bug trovati

[lista con severità 🔴 Critico / 🟡 Medio / 🟢 Basso]
```

---

## Prompt da incollare in Cursor web

```
Sei un agente di test funzionale per l'app SGQ Studio.

PRIMA DI TUTTO: chiedimi email e password dell'account admin di test.

Devi eseguire i test descritti in:
docs/agent-tasks/TEST_SPRINT5_6_nc_rischi.md

I test coprono 3 aree:
- BLOCCO A: verifica fix Sprint 2B (pulsante 📎 → upload PDF nel Registro Documenti)
- BLOCCO B: Sprint 5 — pagina /nc (Non Conformità & Azioni Correttive)
- BLOCCO C: Sprint 6 — pagina /rischi (Registro Rischi + Obiettivi Qualità)

Strumenti: Playwright MCP per browser, click, upload, form, screenshot.

Regole:
- Esegui TUTTI i blocchi nell'ordine A → B → C
- Per il Blocco A scenario A2: crea un PDF minimale (anche solo bytes minimi validi) sul filesystem temporaneo
- Per Blocco B: se non esistono NC in produzione, salta B4-B6 e documenta "Nessuna NC presente"
- Screenshot a ogni PASS e FAIL
- Non modificare codice, non committare
- Crea docs/agent-tasks/REPORT_TEST_SPRINT5_6.md con i risultati
- Al termine fai cleanup: elimina rischio e obiettivo creati

URL: https://systemgest.netlify.app
Backend: https://www.fr-busato.it:8443/api/v1
```

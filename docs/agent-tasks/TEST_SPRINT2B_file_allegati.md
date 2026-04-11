# TEST Sprint 2B — Gestione File Allegati Documenti

**Documento**: brief per agente deputy (Cursor web con Playwright MCP)
**Data**: 11/04/2026
**Sprint**: Sprint 2B — upload/download/versioning file su documenti del registro

---

## Contesto

| Parametro | Valore |
|-----------|--------|
| URL app | `https://systemgest.netlify.app` |
| Backend API | `https://www.fr-busato.it:8443/api/v1` |
| Credenziali | **Chiedere all'utente prima di avviare**: email + password account **admin** |

> ⚠️ Prima di avviare i test chiedere all'utente: email e password di un account **admin** di test.

---

## Funzionalità da testare

Sprint 2B ha aggiunto la possibilità di allegare file fisici (Word, PDF, Excel, ecc.) ai documenti del Registro. Ogni riga del Catalogo ora ha un pulsante 📎 che apre un dialog per caricare, visualizzare e scaricare file, con storico delle versioni.

---

## Prerequisiti

1. Accedere come admin
2. Navigare su `/documents` → tab **Catalogo**
3. Verificare che esista almeno un documento con stato `vigente` su cui fare i test  
   - Se non esiste, crearne uno con titolo `[TEST-2B] Documento allegato` prima di iniziare

---

## Scenari di test

---

### SCENARIO 1 — Presenza pulsante 📎 nella tabella Catalogo

| Passo | Azione | Esito atteso |
|-------|--------|--------------|
| 1.1 | Vai su `/documents` → tab **Catalogo** | Tabella documenti visibile |
| 1.2 | Osserva la colonna Azioni di ogni riga | Ogni riga deve mostrare 3 pulsanti: **📎** (file), **✏️** (modifica), **🗄️** (archivia) |
| 1.3 | Verifica che 📎 sia il primo pulsante a sinistra | Ordine: 📎 ✏️ 🗄️ |

**PASS** se: il pulsante 📎 è presente su ogni riga del catalogo.

---

### SCENARIO 2 — Dialog file: stato vuoto (nessun file allegato)

| Passo | Azione | Esito atteso |
|-------|--------|--------------|
| 2.1 | Clicca 📎 su un documento che NON ha file allegati | Dialog "File allegato" si apre |
| 2.2 | Intestazione dialog | Titolo "📎 File allegato", sottotitolo con nome documento |
| 2.3 | Area principale | Messaggio "Nessun file allegato ancora." con suggerimento di caricare |
| 2.4 | Sezione upload | Form con campo "File" (input file) + campo "Revisione (opzionale)" + pulsante "Carica file" |
| 2.5 | Pulsante "Carica file" senza file selezionato | Pulsante deve essere **disabilitato** (grigio, non cliccabile) |
| 2.6 | Chiudi cliccando X o fuori dal dialog | Dialog si chiude, tabella intatta |

**PASS** se: dialog apre, mostra stato vuoto, pulsante disabilitato senza file.

---

### SCENARIO 3 — Upload primo file (PDF)

**Prerequisito**: prepara un file PDF di test (qualsiasi PDF piccolo, es. una pagina).

| Passo | Azione | Esito atteso |
|-------|--------|--------------|
| 3.1 | Clicca 📎 sullo stesso documento vuoto | Dialog aperto |
| 3.2 | Nella sezione upload, clicca sul campo "File" | Si apre il file picker del sistema operativo |
| 3.3 | Seleziona il file PDF di test | File selezionato — il nome appare sotto il form con dimensione |
| 3.4 | Nel campo "Revisione" digita `Rev. 1` | Testo inserito |
| 3.5 | Clicca "Carica file" | Il pulsante mostra "Caricamento in corso..." |
| 3.6 | Attendi il completamento | Appare messaggio verde: "✅ File '[nome].pdf' ([dimensione]) caricato con successo." |
| 3.7 | Il dialog si aggiorna automaticamente | La sezione "File corrente" appare con: nome file, badge "Rev. 1", dimensione, data |
| 3.8 | Verifica pulsanti sul file corrente | Deve apparire **"📄 Visualizza PDF"** (perché è un PDF) + **"⬇️ Scarica"** |

**PASS** se: upload avviene senza errori, file corrente visualizzato con metadati.

---

### SCENARIO 4 — Visualizzazione PDF inline

| Passo | Azione | Esito atteso |
|-------|--------|--------------|
| 4.1 | Con il PDF caricato (Scenario 3), clicca "📄 Visualizza PDF" | Si apre una nuova tab del browser con il PDF |
| 4.2 | Verifica che il PDF sia visualizzabile | Il browser mostra il contenuto del PDF (non download forzato) |
| 4.3 | Torna al tab principale | Dialog ancora aperto, file ancora mostrato |

**PASS** se: PDF aperto inline nel browser.

---

### SCENARIO 5 — Download file generico (non-PDF)

**Prerequisito**: prepara un file DOCX o XLSX di test.

| Passo | Azione | Esito atteso |
|-------|--------|--------------|
| 5.1 | Apri dialog 📎 su un documento (puoi usarne uno nuovo o lo stesso) | Dialog aperto |
| 5.2 | Carica il file DOCX/XLSX con revisione `Rev. 1` | Upload completato |
| 5.3 | Per file non-PDF, il pulsante "📄 Visualizza PDF" NON appare | Solo il pulsante **"⬇️ Scarica"** è visibile |
| 5.4 | Clicca "⬇️ Scarica" | Il browser scarica il file (non apre nel browser) |

**PASS** se: file non-PDF non mostra il pulsante "Visualizza PDF", lo scarica correttamente.

---

### SCENARIO 6 — Seconda revisione e storico versioni

| Passo | Azione | Esito atteso |
|-------|--------|--------------|
| 6.1 | Con un documento che ha già un PDF (Scenario 3), apri nuovamente dialog 📎 | File corrente visibile |
| 6.2 | Nella sezione upload, seleziona un secondo file PDF | File selezionato |
| 6.3 | Digita `Rev. 2` nel campo Revisione | Testo inserito |
| 6.4 | Clicca "Carica file" | Upload completato con messaggio verde |
| 6.5 | Il file corrente ora mostra il secondo file con "Rev. 2" | Badge "Rev. 2" visibile nella sezione "File corrente" |
| 6.6 | Verifica presenza sezione "Versioni precedenti (1)" | Sezione collassata presente con contatore "(1)" |
| 6.7 | Clicca su "▼ Versioni precedenti (1)" per espandere | Lista mostra il primo file con "Rev. 1" e pulsante ⬇️ |
| 6.8 | Clicca ⬇️ sulla versione precedente | Il file della versione precedente viene scaricato |

**PASS** se: versioning funziona, storico accessibile, download versioni precedenti OK.

---

### SCENARIO 7 — Blocco file eseguibili

| Passo | Azione | Esito atteso |
|-------|--------|--------------|
| 7.1 | Apri dialog 📎 su qualsiasi documento | Dialog aperto |
| 7.2 | Crea un file di test con estensione `.bat` (es. `test.bat`) sul desktop | File creato |
| 7.3 | Seleziona il file `test.bat` nel file picker | File selezionato lato client |
| 7.4 | Osserva il comportamento | Deve apparire un messaggio di errore rosso: "Formato non consentito per sicurezza: .bat" — il file NON deve essere selezionato o deve essere bloccato |
| 7.5 | Il pulsante "Carica file" rimane disabilitato | Non si può procedere con il file bloccato |

**PASS** se: file .bat (e simili) bloccato con messaggio di errore chiaro.

---

## Cleanup dati di test

Al termine dei test:
1. Vai su `/documents` → tab **Catalogo**
2. Cerca `[TEST-2B]`
3. Archivia il documento di test → conferma con "Sì"

I file fisici caricate rimarranno sul server (non si cancellano) ma il documento sarà archiviato come "obsoleto".

---

## Output atteso

Crea il file `docs/agent-tasks/REPORT_TEST_SPRINT2B_file_allegati.md` con:

```markdown
# Report test Sprint 2B — File Allegati

Data: [data]
URL: https://systemgest.netlify.app

## Risultati

| Scenario | Descrizione | Esito | Note |
|----------|-------------|-------|------|
| 1 | Pulsante 📎 in tabella Catalogo | PASS/FAIL | |
| 2 | Dialog stato vuoto | PASS/FAIL | |
| 3 | Upload primo file PDF | PASS/FAIL | |
| 4 | Visualizzazione PDF inline | PASS/FAIL | |
| 5 | Download file non-PDF | PASS/FAIL | |
| 6 | Seconda revisione + storico | PASS/FAIL | |
| 7 | Blocco file eseguibili | PASS/FAIL | |

## Bug trovati

[lista con priorità 🔴 🟡 🟢]
```

---

## Prompt da incollare in Cursor web (Composer)

```
Sei un agente di test funzionale. Devi verificare le funzionalità di Sprint 2B (file allegati documenti) dell'app SGQ Studio.

PRIMA DI TUTTO: chiedimi email e password dell'account admin di test.

Poi segui ESATTAMENTE gli scenari nel file:
docs/agent-tasks/TEST_SPRINT2B_file_allegati.md

Strumenti: Playwright MCP per browser, navigazione, click, upload file, screenshot.

Regole:
- Esegui ogni scenario nell'ordine indicato
- Per lo scenario 3 ti servirà un file PDF: puoi crearne uno minimale (anche solo testo) sul filesystem temporaneo
- Per lo scenario 7 crea un file test.bat vuoto temporaneo
- Documenta PASS/FAIL con screenshot
- Non modificare codice, non committare
- Crea docs/agent-tasks/REPORT_TEST_SPRINT2B_file_allegati.md con i risultati

URL: https://systemgest.netlify.app
```

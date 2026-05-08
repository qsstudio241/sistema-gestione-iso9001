# Test Sprint 1 — Registro Documenti SGQ

**Tipo**: Test funzionale E2E + produzione manuale utente  
**Sprint**: Sprint 1 — Document Registry UX  
**Data creazione brief**: 09 aprile 2026  
**Preparato da**: agente master (sessione desktop)  
**Eseguito da**: agente deputy (Cursor web con browser)

---

## 🎯 Obiettivo

Verificare che tutte le funzionalità introdotte in Sprint 1 funzionino correttamente
sull'app in produzione, e produrre il manuale utente della sezione Registro Documenti.

---

## 🌐 Ambiente

| Parametro | Valore |
|---|---|
| URL app | `https://systemgest.netlify.app` |
| Commit da testare | `fe25fb7` (branch `main`) |
| Backend API | `https://www.fr-busato.it:8443/api/v1` |
| Credenziali | **NON inserire credenziali in questo file** — chiederle all'utente prima di iniziare |

> Prima di avviare i test, chiedere all'utente: email e password di un account **admin** di test.

---

## 📋 Scenari di test

Ogni scenario va eseguito **nell'ordine indicato**. Per ogni scenario:
- Annotare **PASS** o **FAIL** nella colonna Esito
- In caso di FAIL: annotare il comportamento osservato vs atteso
- Fare screenshot se disponibile

---

### Scenario 1 — Login e navigazione alla sezione Documenti

| # | Azione | Esito atteso |
|---|--------|--------------|
| 1.1 | Apri `https://systemgest.netlify.app` in modalità normale | Pagina di login visibile |
| 1.2 | Inserisci credenziali admin e clicca "Accedi" | Dashboard home caricata correttamente |
| 1.3 | Nella sidebar sinistra (desktop) o barra in basso (mobile), clicca **Documenti** | URL diventa `/documents`, pagina Registro Documenti caricata |
| 1.4 | Verifica che il titolo della pagina sia "Registro Documenti" | Titolo e sottotitolo con totale documenti visibili |

**Esito**: ☐ PASS  ☐ FAIL  
**Note**: _______________

---

### Scenario 2 — Tab "Priorità" (default)

| # | Azione | Esito atteso |
|---|--------|--------------|
| 2.1 | Verifica che al caricamento sia attivo il tab **"⚠️ Priorità"** (non "Catalogo") | Tab Priorità selezionato di default, bordo blu sotto |
| 2.2 | Osserva il contenuto: se ci sono documenti scaduti o in scadenza, compaiono le schede colorate | Sezione rossa per scaduti, arancione per in scadenza, blu per in revisione |
| 2.3 | Se non ci sono documenti urgenti, verifica il messaggio "tutto ok" | Appare "✅ Tutto in ordine" con pulsante "+ Aggiungi documento" |
| 2.4 | Verifica che il badge rosso sul tab Priorità mostri il numero di documenti urgenti (se > 0) | Badge numerico rosso accanto all'etichetta "Priorità" |

**Esito**: ☐ PASS  ☐ FAIL  
**Note**: _______________

---

### Scenario 3 — Creazione nuovo documento (wizard 2 passi)

> I documenti creati in questo scenario sono **TEST DATA** da eliminare nel cleanup finale.
> Usare il prefisso `[TEST]` nel titolo per identificarli facilmente.

**Passo 1 — Apertura wizard:**

| # | Azione | Esito atteso |
|---|--------|--------------|
| 3.1 | Clicca il pulsante **"+ Nuovo documento"** in alto a destra | Si apre la modale "Nuovo documento" |
| 3.2 | Verifica che sia visibile l'indicatore di progresso con **"1 — Identificazione"** e **"2 — Dettagli"** | Indicatore a 2 step, step 1 evidenziato (sfondo blu) |
| 3.3 | Verifica che il form mostri: selezione tipo (chip cliccabili), campo Titolo, campo Codice, campo Azienda | Solo questi 4 elementi, nessun campo data/norma/note |

**Passo 2 — Compilazione passo 1:**

| # | Azione | Esito atteso |
|---|--------|--------------|
| 3.4 | Clicca sul chip **"Procedura"** | Chip si evidenzia con bordo blu |
| 3.5 | Clicca su un chip diverso, ad es. **"Istruzione operativa"** | Il nuovo chip si evidenzia, il precedente si deseleziona |
| 3.6 | Ritorna su **"Procedura"** | Chip Procedura selezionato |
| 3.7 | Clicca **"Avanti →"** senza inserire il titolo | Messaggio di errore "Il titolo è obbligatorio" — il wizard NON avanza |
| 3.8 | Inserisci nel campo Titolo: `[TEST] Procedura controllo qualità Sprint 1` | Testo inserito correttamente |
| 3.9 | Inserisci nel campo Codice: `TEST-PG-01` | Testo inserito |
| 3.10 | Clicca **"Avanti →"** | Il wizard avanza al passo 2 — step "2 — Dettagli" ora evidenziato |

**Passo 3 — Compilazione passo 2:**

| # | Azione | Esito atteso |
|---|--------|--------------|
| 3.11 | Verifica che il form mostri: Revisione, Stato, Date, Responsabile, Conservazione, Norma, Note | Tutti i campi del passo 2 visibili |
| 3.12 | Clicca **"← Indietro"** | Torna al passo 1 mantenendo i dati già inseriti (titolo e codice ancora presenti) |
| 3.13 | Clicca di nuovo **"Avanti →"** | Torna al passo 2 |
| 3.14 | Inserisci Data scadenza: una data tra 30 e 60 giorni da oggi | Data inserita |
| 3.15 | Inserisci Responsabile: `Utente Test` | Campo compilato |
| 3.16 | Clicca **"Crea documento"** | Modale si chiude, documento creato, griglia si aggiorna |

**Passo 4 — Verifica creazione:**

| # | Azione | Esito atteso |
|---|--------|--------------|
| 3.17 | Vai al tab **"Catalogo"** | Il documento `[TEST] Procedura controllo qualità Sprint 1` è visibile in griglia con codice `TEST-PG-01` |
| 3.18 | Verifica che nella tab **"Priorità"** compaia nella sezione "In scadenza" (data era entro 60gg) | Scheda arancione con il documento di test |

**Esito**: ☐ PASS  ☐ FAIL  
**Note**: _______________

---

### Scenario 4 — Modifica documento esistente (form completo, NO wizard)

| # | Azione | Esito atteso |
|---|--------|--------------|
| 4.1 | Nel tab **Catalogo**, trova il documento `[TEST] Procedura controllo qualità Sprint 1` |  |
| 4.2 | Clicca l'icona **✏️** (modifica) nella colonna Azioni | Si apre la modale "Modifica — [TEST] Procedura..." |
| 4.3 | Verifica che **NON** ci sia l'indicatore wizard a 2 step | Form completo in unica schermata con tutti i campi |
| 4.4 | Verifica che tutti i campi siano pre-compilati con i valori inseriti in precedenza | Titolo, Codice, Data scadenza, Responsabile già presenti |
| 4.5 | Modifica il campo Responsabile in: `Utente Test MODIFICATO` | Campo aggiornato |
| 4.6 | Clicca **"Salva modifiche"** | Modale si chiude, riga in griglia aggiornata |
| 4.7 | Riapri il documento con ✏️ e verifica che il Responsabile sia `Utente Test MODIFICATO` | Modifica persistita correttamente |

**Esito**: ☐ PASS  ☐ FAIL  
**Note**: _______________

---

### Scenario 5 — Archiviazione con inline confirmation (NO popup browser)

> Creare prima un secondo documento di test da archiviare.

| # | Azione | Esito atteso |
|---|--------|--------------|
| 5.1 | Crea un secondo documento di test: titolo `[TEST] Documento da archiviare`, tipo "Altro" | Documento creato nel Catalogo |
| 5.2 | Trova il documento nel Catalogo, clicca il pulsante **🗄️** (Archivia) | **NON** appare nessun popup del browser — compare invece un pannello giallo nella riga stessa |
| 5.3 | Verifica il testo del pannello: "Archiviare come obsoleto?" con pulsanti "Sì" e "No" | Pannello inline giallo con testo e due pulsanti |
| 5.4 | Clicca **"No"** | Il pannello scompare, il documento rimane invariato |
| 5.5 | Clicca di nuovo **🗄️**, poi clicca **"Sì"** | Il documento cambia stato in "Obsoleto" (badge grigio) e scompare dalla lista vigenti |
| 5.6 | Nella tab Catalogo, seleziona filtro Stato = "Obsoleto" | Il documento `[TEST] Documento da archiviare` è visibile come obsoleto |

**Esito**: ☐ PASS  ☐ FAIL  
**Note**: _______________

---

### Scenario 6 — Tab Catalogo: filtri collassabili

| # | Azione | Esito atteso |
|---|--------|--------------|
| 6.1 | Vai al tab **Catalogo** | La barra filtri è **nascosta** (collassata) per default |
| 6.2 | Clicca il pulsante **"⚙️ Filtri ▼"** | Il pannello filtri si espande mostrando: tipo, stato, azienda, checkbox scadenza |
| 6.3 | Clicca di nuovo **"⚙️ Filtri ▲"** | Il pannello si chiude |
| 6.4 | Riapri i filtri, seleziona Tipo = "Procedura" | La griglia si aggiorna mostrando solo le procedure |
| 6.5 | Clicca **"Reset"** | Tutti i filtri tornano ai valori predefiniti, griglia mostra tutti i documenti vigenti |
| 6.6 | Digita `TEST` nel campo di ricerca | La griglia filtra mostrando solo i documenti con `TEST` nel titolo o codice |

**Esito**: ☐ PASS  ☐ FAIL  
**Note**: _______________

---

### Scenario 7 — Export CSV

| # | Azione | Esito atteso |
|---|--------|--------------|
| 7.1 | Nel tab **Catalogo**, clicca **"⬇️ Esporta CSV"** | Viene scaricato un file `.csv` con data nel nome (es. `documenti_sgq_2026-04-09.csv`) |
| 7.2 | Apri il file con Excel o un editor di testo | Il file si apre con caratteri italiani corretti (nessun carattere strano tipo `Ã `) — le colonne sono separate da `;` |
| 7.3 | Verifica che le colonne siano: Codice, Titolo, Tipo, Revisione, Stato, Emissione, Scadenza, Responsabile, Azienda, Norma, Paragrafo, Note | Tutte le colonne presenti nell'ordine corretto |
| 7.4 | Verifica che i documenti di test (`[TEST]...`) siano presenti nel CSV | Righe con i dati inseriti durante i test |
| 7.5 | Applica un filtro (es. Tipo = Procedura) poi esporta di nuovo | Il CSV contiene solo le procedure filtrate — l'export rispetta i filtri attivi |

**Esito**: ☐ PASS  ☐ FAIL  
**Note**: _______________

---

### Scenario 8 — Verifica assenza pulsante "← Indietro"

| # | Azione | Esito atteso |
|---|--------|--------------|
| 8.1 | Nella pagina Registro Documenti, controlla l'header della pagina | **Non è presente** nessun pulsante "← Indietro" nell'header |
| 8.2 | Per navigare fuori dalla sezione Documenti, usa la sidebar o la barra inferiore | La navigazione funziona normalmente senza il pulsante Indietro |

**Esito**: ☐ PASS  ☐ FAIL  
**Note**: _______________

---

## 🧹 Cleanup — Eliminazione dati di test

> **DA ESEGUIRE OBBLIGATORIAMENTE** al termine di tutti i test.

I documenti creati durante i test sono identificabili dal prefisso `[TEST]` nel titolo
o dal codice `TEST-*`.

**Metodo 1 — Tramite UI (preferito):**

1. Vai al tab **Catalogo**
2. Cerca `TEST` nella barra di ricerca
3. Per ogni documento trovato:
   - Clicca ✏️ → cambia Stato in "Obsoleto" → Salva (oppure)
   - Clicca 🗄️ → Sì (archivia come obsoleto)
4. Ripeti la ricerca per verificare che non rimangano documenti TEST con stato vigente

**Metodo 2 — Tramite API (se l'UI non permette eliminazione fisica):**

Esegui la seguente chiamata API autenticata per eliminare fisicamente i record di test
(soft-delete già fatto dall'UI li porta a status=obsoleto, non li elimina dal DB):

```
DELETE https://www.fr-busato.it:8443/api/v1/documents/{id}
Authorization: Bearer {token}
```

> Nota: l'endpoint DELETE esegue una soft-delete (status → obsoleto). Per eliminazione
> fisica dal DB contattare il master agent per eseguire cleanup diretto via migration script.

**Verifica cleanup:**

| # | Verifica | Esito atteso |
|---|--------|--------------|
| C.1 | Cerca `TEST` nel Catalogo (tutti gli stati) | Nessun documento con prefisso `[TEST]` in stato vigente/in_revisione |
| C.2 | I documenti `[TEST]` in stato obsoleto sono accettabili temporaneamente — annotare gli ID per cleanup DB successivo | ID annotati: _______________ |

---

## 📄 Output atteso — Manuale utente

Al termine dei test, creare il file **`docs/manuale_utente/01_registro_documenti.md`**
con la seguente struttura, popolata con quanto osservato durante i test:

```markdown
# Registro Documenti SGQ — Guida utente

## Cos'è il Registro Documenti
[Descrizione breve della funzione]

## Come accedere
[Navigazione dalla sidebar]

## Tab Priorità — "Cosa fare oggi"
[Spiegazione schede rosse/arancioni/blu + quando appare "Tutto in ordine"]

## Tab Catalogo — Vista completa
[Filtri, ricerca, paginazione]

## Aggiungere un nuovo documento
[Wizard 2 passi — passo 1 e passo 2 descritti per un utente non tecnico]

## Modificare un documento esistente
[Form completo, differenza con il wizard]

## Archiviare un documento
[Inline confirmation — spiegazione che NON appare un popup]

## Esportare la lista in Excel
[Export CSV, come aprirlo in Excel]

## Domande frequenti
[Popolare con i dubbi emersi durante i test]
```

---

## 📊 Report finale

Al termine dei test compilare:

| Sprint | Scenari totali | PASS | FAIL | Note generali |
|--------|---------------|------|------|---------------|
| Sprint 1 — Document Registry | 8 | ___ | ___ | _______________ |

**In caso di FAIL**:
- Aprire una issue su GitHub con label `bug` e titolo `[Sprint1] <descrizione problema>`
- NON modificare il codice direttamente — segnalare al master agent nella prossima sessione

---

## 🔁 Prompt pronto (da incollare in Cursor web)

```
Leggi il file docs/agent-tasks/TEST_SPRINT1_document_registry.md nel repo
https://github.com/qsstudio241/sistema-gestione-iso9001

Sei il deputy agent incaricato di eseguire i test funzionali E2E del Sprint 1
del progetto Sistema Gestione ISO 9001.

Istruzioni operative:
1. Leggi TUTTO il brief prima di iniziare
2. Chiedi all'utente le credenziali di login (email + password account admin di test)
3. Apri il browser su https://systemgest.netlify.app
4. Esegui ogni scenario nell'ordine indicato, annotando PASS/FAIL per ogni step
5. Esegui OBBLIGATORIAMENTE il cleanup finale (Scenario Cleanup)
6. Produci il file docs/manuale_utente/01_registro_documenti.md
7. Crea un branch test/sprint1, committa il manuale utente e il report finale, apri una PR verso main

NON committare credenziali. NON modificare codice. Solo testare e documentare.
```

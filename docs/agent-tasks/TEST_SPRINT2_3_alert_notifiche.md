# Test Sprint 2 & Sprint 3 — Alert Engine + Notifiche SGQ

**Tipo**: Test funzionale E2E — produzione  
**Sprint**: Sprint 2 (Qualifiche + Alert Engine) e Sprint 3 (NC & Azioni Correttive)  
**Data creazione brief**: 11 aprile 2026  
**Preparato da**: agente master (sessione cloud)  
**Eseguito da**: agente deputy (Cursor cloud con browser Playwright)

---

## 🎯 Obiettivo

Verificare le funzionalità implementate per Sprint 2 e Sprint 3 nell'app in produzione:
- **Alert Engine**: dashboard home con semaforo scadenze, badge sidebar, documenti in scadenza
- **Moduli bloccati**: Qualifiche (Sprint 2), Azioni Correttive (Sprint 3) — pagine `ModuleLocked` corrette
- **Pagina Notifiche**: configurazione email, toggle alert, pulsante "Invia email di test"
- **Sidebar badge**: contatore alert attivo con aggiornamento ogni 5 minuti

---

## 🌐 Ambiente

| Parametro | Valore |
|---|---|
| URL app | `https://systemgest.netlify.app` |
| Branch | `main` |
| Backend API | `https://www.fr-busato.it:8443/api/v1` |
| Credenziali | Vedere `PROJECT_CONTEXT.md` — account admin di test |

---

## 📋 Scenari di test

### Scenario 1 — Login e verifica Home Dashboard

| # | Azione | Esito atteso |
|---|--------|--------------|
| 1.1 | Apri `https://systemgest.netlify.app` | Pagina di login visibile |
| 1.2 | Inserisci email e password admin, clicca "Accedi" | Dashboard home caricata |
| 1.3 | Verifica saluto contestuale (Buongiorno/Buon pomeriggio/Buonasera) | Saluto con nome utente visibile |
| 1.4 | Verifica messaggio di stato sotto il saluto | "Tutto in ordine" OPPURE "Ci sono elementi che richiedono la tua attenzione" |
| 1.5 | Verifica presenza sezione "📊 Panoramica" con 4 StatBox | Documenti vigenti, Qualifiche (🔒), Rischi & Obiettivi (🔒), Azioni |
| 1.6 | Verifica presenza sezione "🚀 Accesso rapido" con 3 pulsanti | Nuovo audit, Aggiungi documento, Aziende |

**Esito**: ☐ PASS  ☐ FAIL  
**Note**: _______________

---

### Scenario 2 — Alert urgenti sulla Home (documenti scaduti)

| # | Azione | Esito atteso |
|---|--------|--------------|
| 2.1 | Sulla Home, verifica se appare la sezione "⚠️ Richiede attenzione" | Se ci sono documenti scaduti o NC in ritardo, la sezione rossa appare |
| 2.2 | Se la sezione è visibile: clicca su una AlertCard per espanderla | La lista degli item appare con titolo e data |
| 2.3 | Clicca "Vai ai documenti →" sull'AlertCard documenti scaduti | Navigazione a `/documents` |
| 2.4 | Torna alla Home (clicca "Home" in sidebar) | Home ricaricata |
| 2.5 | Verifica sezione "🟡 In scadenza nei prossimi 30 giorni" (se presente) | Lista documenti in scadenza con data e azienda |

**Esito**: ☐ PASS  ☐ FAIL  
**Note**: _______________

---

### Scenario 3 — Badge alert nella sidebar

| # | Azione | Esito atteso |
|---|--------|--------------|
| 3.1 | Osserva la sidebar sinistra, voce "Documenti" | Se ci sono documenti urgenti, badge numerico rosso/arancione visibile |
| 3.2 | Il badge mostra un numero ≥ 0 | Numero intero coerente con i documenti scaduti/in scadenza |
| 3.3 | Naviga su `/documents` e torna alla Home | Il badge rimane visibile e coerente |

**Esito**: ☐ PASS  ☐ FAIL  
**Note**: _______________

---

### Scenario 4 — Modulo Qualifiche bloccato (Sprint 2)

| # | Azione | Esito atteso |
|---|--------|--------------|
| 4.1 | Nella sidebar, clicca "Qualifiche" (con icona 🔒) | Navigazione a `/qualifiche` |
| 4.2 | Verifica che appaia la schermata `ModuleLocked` | Titolo "Qualifiche Personale", icona 🎓 |
| 4.3 | Verifica il badge "In arrivo" visibile | Badge giallo/arancione con testo "In arrivo" |
| 4.4 | Verifica l'elenco funzionalità incluse (4 voci) | "Registro qualifiche con semaforo scadenze", "Alert email automatici 60/30/7 giorni", "Collegamento a WPS e commesse (ISO 3834)", "Storico rinnovi e documenti allegati" |
| 4.5 | Verifica il testo "Rilascio previsto" | "Sprint 2 — Prossimamente" |

**Esito**: ☐ PASS  ☐ FAIL  
**Note**: _______________

---

### Scenario 5 — Modulo Azioni Correttive bloccato (Sprint 3)

| # | Azione | Esito atteso |
|---|--------|--------------|
| 5.1 | Nella sidebar, clicca "Azioni" (con icona 🔒) | Navigazione a `/azioni` |
| 5.2 | Verifica che appaia la schermata `ModuleLocked` | Titolo "Azioni Correttive & Preventive", icona ✅ |
| 5.3 | Verifica il badge "In arrivo" | Badge visibile |
| 5.4 | Verifica l'elenco funzionalità (4 voci) | "Workflow aperta → assegnata → in corso → verificata → chiusa", "Assegnazione responsabile con email notifica", "Collegamento a NC audit, rischi, reclami", "Dashboard KPI: % chiuse, ritardi" |
| 5.5 | Verifica il testo "Rilascio previsto" | "Sprint 3 — Prossimamente" |

**Esito**: ☐ PASS  ☐ FAIL  
**Note**: _______________

---

### Scenario 6 — Pagina Notifiche & Alert (Settings)

| # | Azione | Esito atteso |
|---|--------|--------------|
| 6.1 | Nella sidebar, sezione "Gestione", clicca "Notifiche" | Navigazione a `/settings/notifications` |
| 6.2 | Verifica il titolo della pagina | Titolo "Notifiche & Alert" con sottotitolo |
| 6.3 | Verifica lo status SMTP | Riga con indicatore stato SMTP configurato |
| 6.4 | Verifica il campo "Indirizzi email" | Campo input di testo placeholder `mario.rossi@studio.it, ...` |
| 6.5 | Verifica i 3 campi numerici/orario | "Prima notifica", "Seconda notifica", "Orario invio giornaliero" con valori default (30, 7, 08:00) |
| 6.6 | Verifica la card "Tipi di alert attivi" | 3 toggle: "Documenti in scadenza", "Non conformità aperte", "Qualifiche in scadenza" |
| 6.7 | Verifica il toggle "Documenti in scadenza" sia ON di default | Toggle abilitato per default |
| 6.8 | Verifica il toggle "Non conformità aperte" sia ON di default | Toggle abilitato per default |
| 6.9 | Verifica il toggle "Qualifiche in scadenza" sia OFF di default | Toggle disabilitato per default (attivo con Sprint D) |
| 6.10 | Verifica la card "Stato notifiche" con toggle principale | Toggle ON/OFF notifiche con descrizione contestuale |
| 6.11 | Clicca "Salva configurazione" senza inserire email | Appare messaggio di errore "Inserisci almeno un indirizzo email destinatario." |
| 6.12 | Inserisci `test@sgq.local` nel campo email, clicca "Salva configurazione" | Messaggio di successo "✓ Configurazione salvata" (3 secondi) |

**Esito**: ☐ PASS  ☐ FAIL  
**Note**: _______________

---

### Scenario 7 — Pulsante "Invia email di test"

| # | Azione | Esito atteso |
|---|--------|--------------|
| 7.1 | Sulla pagina Notifiche, il pulsante "Invia email di test" è **disabilitato** se il campo email è vuoto | Pulsante grigio/disabilitato |
| 7.2 | Inserisci un'email valida nel campo | Il pulsante "Invia email di test" diventa cliccabile |
| 7.3 | Clicca "Invia email di test" | Stato "Invio in corso..." mentre attende la risposta |
| 7.4 | Verifica l'esito: OK o FAIL con messaggio | Appare un pannello con esito (verde=successo, rosso=errore SMTP) |
| 7.5 | Clicca la "×" per chiudere il pannello esito | Il pannello scompare |

**Esito**: ☐ PASS  ☐ FAIL  
**Note**: _______________

---

### Scenario 8 — API Alert Count (verifica integrazione backend)

| # | Azione | Esito atteso |
|---|--------|--------------|
| 8.1 | Apri la Home e attendi il caricamento completo | Il badge nella sidebar per "Documenti" si aggiorna dopo il caricamento |
| 8.2 | Naviga tra le sezioni e torna alla Home | Il badge rimane persistente e non si azzera |
| 8.3 | Verifica che la sezione "📊 Panoramica" mostri un numero per "Documenti vigenti" | Numero intero ≥ 0 (non "—") |

**Esito**: ☐ PASS  ☐ FAIL  
**Note**: _______________

---

## 📊 Riepilogo atteso

| Sprint | Scenari | PASS | FAIL | Note |
|--------|---------|------|------|------|
| Sprint 2 — Alert Engine + Qualifiche | 1, 2, 3, 4, 8 | ___ | ___ | ___ |
| Sprint 3 — Azioni + Notifiche | 5, 6, 7 | ___ | ___ | ___ |
| **TOTALE** | **8** | ___ | ___ | ___ |

---

## 🔁 Prompt pronto (da incollare in Cursor cloud)

```
Leggi il file docs/agent-tasks/TEST_SPRINT2_3_alert_notifiche.md

Sei l'agente di test incaricato di eseguire i test funzionali E2E di Sprint 2 e Sprint 3
del progetto Sistema Gestione ISO 9001.

1. Leggi TUTTO il brief prima di iniziare
2. Usa le credenziali di test in PROJECT_CONTEXT.md (admin@sgq.local / Admin123!)
3. Apri il browser su https://systemgest.netlify.app
4. Esegui ogni scenario nell'ordine indicato, annotando PASS/FAIL per ogni step
5. Documenta ogni PASS e FAIL con uno screenshot
6. Crea il file docs/agent-tasks/REPORT_TEST_SPRINT2_3_alert_notifiche.md con i risultati

NON committare credenziali. NON modificare codice. Solo testare e documentare.
```

# Test Sprint 2B — File Allegati Documenti SGQ

**Tipo**: Test funzionale E2E — produzione  
**Sprint**: Sprint 2B — Allegati al Registro Documenti  
**Data creazione brief**: 11 aprile 2026  
**Preparato da**: agente master (sessione cloud)  
**Eseguito da**: agente deputy (Cursor cloud con browser Playwright)

---

## 🎯 Obiettivo

Verificare le funzionalità di gestione allegati per i documenti del Registro SGQ:
- **Upload allegato** a un documento esistente via API `/attachments/upload`
- **Preview/download** allegato esistente via `/attachments/:id/view` e `/download`
- **Sostituzione** allegato esistente via `/attachments/:id/replace`
- **Eliminazione** allegato via `/attachments/:id`
- **Validazione tipo file**: tipi non ammessi (es. `.bat`) devono essere rifiutati
- **Stato UI**: verificare che il `DocumentForm` mostri o meno la sezione allegati

---

## 🌐 Ambiente

| Parametro | Valore |
|---|---|
| URL app | `https://systemgest.netlify.app` |
| Backend API | `https://www.fr-busato.it:8443/api/v1` |
| Credenziali | Vedere `PROJECT_CONTEXT.md` — `admin@sgq.local` |
| Tipi file ammessi | JPEG, PNG, GIF, WebP, MP3/WAV, MP4, PDF, DOC/DOCX, XLS/XLSX, PPT/PPTX, TXT, CSV |
| Dimensione max | 10 MB per file |
| Tipi NON ammessi | .bat, .exe, .sh, .zip, .js, .php, ecc. |

---

## 📋 Scenari di test

### Scenario 1 — Login e accesso al Registro Documenti

| # | Azione | Esito atteso |
|---|--------|--------------|
| 1.1 | Apri `https://systemgest.netlify.app` | Pagina di login visibile |
| 1.2 | Login con credenziali admin | Dashboard home caricata |
| 1.3 | Clicca "Documenti" nella sidebar | Navigazione a `/documents` — Registro Documenti |
| 1.4 | Vai al tab "Catalogo" | Griglia documenti visibile |
| 1.5 | Identifica il documento di test esistente (`test_doc_altro`) | Documento visibile nella griglia |

**Esito**: ☐ PASS  ☐ FAIL  
**Note**: _______________

---

### Scenario 2 — Verifica UI DocumentForm (presenza sezione allegati)

| # | Azione | Esito atteso |
|---|--------|--------------|
| 2.1 | Clicca ✏️ (modifica) su un documento esistente | Si apre la modale di modifica |
| 2.2 | Verifica presenza/assenza sezione upload allegati nella modale | Documenta se la sezione allegati è presente o meno (funzionalità in sviluppo) |
| 2.3 | Chiudi la modale con ✕ | Modale chiusa |
| 2.4 | Clicca "+ Nuovo documento" | Si apre la modale wizard a 2 passi |
| 2.5 | Inserisci un titolo di test e clicca "Avanti →" | Avanza al passo 2 |
| 2.6 | Verifica presenza/assenza sezione upload allegati nel passo 2 | Documenta lo stato |
| 2.7 | Chiudi la modale con "Annulla" | Modale chiusa, nessun documento creato |

**Esito**: ☐ PASS  ☐ FAIL  
**Note**: _______________

---

### Scenario 3 — Upload allegato PDF via API (audit esistente)

> Prerequisito: serve un audit esistente. Il backend `/attachments/upload` accetta `audit_id` o `nc_id`.
> Per i documenti del registry, la FK `attachment_id` non è ancora esposta dall'UI.
> Testa l'upload via l'audit già esistente nell'app.

| # | Azione | Esito atteso |
|---|--------|--------------|
| 3.1 | Naviga alla sezione Audit: clicca "Audit" nella sidebar | URL `/audit` — lista audit |
| 3.2 | Apri un audit esistente (qualsiasi audit in lista) | Audit caricato con le sue sezioni |
| 3.3 | Individua la sezione allegati in una domanda della checklist | Sezione con pulsante "➕ Aggiungi Allegati" |
| 3.4 | Clicca "➕ Aggiungi Allegati" | Menu si apre con le opzioni (Foto, Documenti, Verbali) |
| 3.5 | Clicca "📎 Documenti" | Si apre il file picker del browser |
| 3.6 | Seleziona un file PDF di test (creato sul filesystem) | File selezionato |
| 3.7 | Attendi il completamento upload | Allegato appare nella lista con nome, dimensione, data |
| 3.8 | Verifica che l'allegato sia visibile nella sezione `AttachmentPreview` | File con icona 📄 e nome visibile |

**Esito**: ☐ PASS  ☐ FAIL  
**Note**: _______________

---

### Scenario 4 — Download e preview allegato

| # | Azione | Esito atteso |
|---|--------|--------------|
| 4.1 | Nell'audit con allegato appena caricato, individua il file nella `AttachmentPreview` | File visibile |
| 4.2 | Clicca sull'icona di preview/download | Si apre preview inline (PDF nel browser) o parte download |
| 4.3 | Verifica che non appaia un errore 401/403 | Accesso autorizzato |
| 4.4 | Verifica che il file scaricato/mostrato corrisponda a quello caricato | Contenuto corretto |

**Esito**: ☐ PASS  ☐ FAIL  
**Note**: _______________

---

### Scenario 5 — Verifica endpoint API allegati (chiamate dirette)

| # | Azione | Esito atteso |
|---|--------|--------------|
| 5.1 | Verifica che la network request `POST /attachments/upload` risponda 201 | Status 201 Created |
| 5.2 | Verifica che `GET /attachments/:id/view` risponda 200 con il file | Status 200 con Content-Type corretto |
| 5.3 | Verifica che `GET /attachments/:id/download` risponda 200 | Status 200 con Content-Disposition: attachment |

**Esito**: ☐ PASS  ☐ FAIL  
**Note**: _______________

---

### Scenario 6 — Upload file non permesso (.bat)

| # | Azione | Esito atteso |
|---|--------|--------------|
| 6.1 | Torna alla sezione allegati di un audit | Sezione allegati visibile |
| 6.2 | Clicca "📎 Documenti" e seleziona un file `.bat` (creato sul filesystem) | File picker aperto |
| 6.3 | Verifica la risposta del backend | Il server deve rispondere con errore 400/415 "Tipo file non supportato" |
| 6.4 | Verifica il messaggio di errore nell'UI | L'UI mostra un messaggio di errore (non silenzioso) |

**Esito**: ☐ PASS  ☐ FAIL  
**Note**: _______________

---

### Scenario 7 — Eliminazione allegato

| # | Azione | Esito atteso |
|---|--------|--------------|
| 7.1 | Individua l'allegato PDF caricato nello Scenario 3 | Allegato visibile nell'audit |
| 7.2 | Clicca il pulsante "✕" (rimuovi) sull'allegato | Appare dialog di conferma (o azione diretta) |
| 7.3 | Conferma l'eliminazione | L'allegato scompare dalla lista |
| 7.4 | Verifica che `GET /attachments/:id` risponda 404 o che il file non sia più accessibile | Allegato eliminato dal backend |

**Esito**: ☐ PASS  ☐ FAIL  
**Note**: _______________

---

## 🧹 Cleanup

> Al termine dei test, verificare che non rimangano allegati di test "orfani" nel sistema.
> Gli allegati caricati durante i test devono essere eliminati via UI o API.

---

## 📊 Riepilogo atteso

| Sprint | Scenari | PASS | FAIL | Note |
|--------|---------|------|------|------|
| Sprint 2B — Allegati Documenti | 1–7 | ___ | ___ | ___ |

---

## 🔁 Prompt pronto (da incollare in Cursor cloud)

```
Leggi il file docs/agent-tasks/TEST_SPRINT2B_file_allegati.md

Sei l'agente di test incaricato di eseguire i test funzionali E2E Sprint 2B
del progetto Sistema Gestione ISO 9001.

Usa le credenziali dal vault / amministratore (email in `PROJECT_CONTEXT.md`; nessuna password in repository).
Apri il browser su https://systemgest.netlify.app.
Esegui ogni scenario nell'ordine indicato con screenshot PASS/FAIL.
Crea docs/agent-tasks/REPORT_TEST_SPRINT2B_file_allegati.md con i risultati.
NON modificare codice. NON committare.
```

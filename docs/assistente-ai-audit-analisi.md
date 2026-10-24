# Analisi: «Chiedi all'AI» dalla checklist audit

> **Tipo**: analisi in sola lettura (nessun codice cambiato, nessun accesso a PROD).  
> **Data**: 24/10/2026  
> **Branch**: `cursor/assistente-ai-audit-analisi-4bdf`  
> **Destinatario**: committente (testo semplice) + deputy (mappa file).  
> **Vincoli**: TEST prima; PROD solo con sì esplicito; niente credenziali in questo file.

---

## In una frase

Oggi il pulsante più visibile «Chiedi all'AI» **porta via** dalla domanda verso una **chat generica**. L'AI **non risponde da sola**. Non c'è un pulsante **Indietro**. Esiste già un secondo pulsante, sotto gli allegati, che resta sulla domanda — ma è poco evidente e non fa quello che serve.

---

## 1. Cosa succede oggi (visto dall'utente)

Sulla checklist audit, **su ogni domanda**, ci sono **due** pulsanti con lo stesso nome.

| Ordine a schermo | Dove | Cosa fa al tap | Resta sulla domanda? |
|---|---|---|---|
| **1. Primo** (sopra gli allegati) | `AskAiButton` | Salva un «segnalibro» della domanda e apre la pagina **Assistente AI** (`/ai-assistant`) | **No** |
| **2. Secondo** (sotto gli allegati) | `QuestionAiPanel` | Apre un riquadro sotto la domanda: 5 chip (Valuta / Gap / Spiega / Bozza / Opportunità) | **Sì** |

Il reclamo («pagina poco chiara, non torno indietro») corrisponde al **primo** pulsante: è quello che si vede prima, è lo stesso stile usato anche su NC e Qualifiche, e **cambia pagina**.

Il **secondo** è più vicino al flusso desiderato (resta sulla domanda), ma:

- non parla subito: bisogna scegliere un chip;
- gli allegati **non arrivano** davvero all'AI (bug di cablaggio, vedi § 4);
- i cinque chip non coincidono con le due modalità chieste (suggerisci domanda / verifica evidenze).

---

## 2. Flusso desiderato vs oggi

| Passo desiderato | Oggi | Gap |
|---|---|---|
| 1. In audit, su un punto, ho un dubbio su **come porre** la domanda. Premo «Chiedi all'AI» e **ricevo subito** un commento su norma, clausola, testo, stato risposta, con suggerimenti di domanda. | Il primo pulsante apre una chat vuota («Come posso aiutarti?»). Compare al massimo una riga piccola «Clausola attiva: §X.Y» e dei chip da cliccare. **Nessuna risposta automatica.** Lo stato C/NC e le note **non** vengono passati. | Manca la risposta immediata contestuale. |
| 2. Faccio la domanda in campo, compilo la risposta, allego evidenze. | Si fa sulla checklist, **fuori** dalla pagina AI. Per tornare alla domanda non c'è un pulsante: solo la freccia del browser (poco visibile in PWA) o il menu Audit (si perde lo scroll). | Manca **Indietro / torna alla domanda**. |
| 3. Richiedo di nuovo all'AI: analizza **risposta + allegati** e dice se le evidenze bastano, e cosa manca. | La chat globale può leggere il testo di alcuni allegati **solo se** l'utente scrive una domanda e il file è già sul server (PDF/Word/TXT). Foto e scansioni vanno in OCR solo su quel percorso. Il pannello inline **non legge** gli allegati. L'AI della chat ha istruzione di **non** certificare C/NC. | Manca la modalità «verifica evidenze». |

---

## 3. Mappa codice (cosa fa «Chiedi all'AI»)

### 3.1 Percorso A — navigazione via (quello che vede l'utente)

```
Checklist / custom checklist
  → AskAiButton (onBeforeNavigate)
  → saveChecklistFocus(...) in sessionStorage
  → navigate("/ai-assistant")
  → AiAssistantPage (chat vuota, chip da cliccare)
  → solo se l'utente scrive o clicca un chip:
       POST /api/v1/ai/chat  →  aiChat.controller.js
```

| Pezzo | File |
|---|---|
| Pulsante | `app/src/components/AskAiButton.jsx` |
| Stile | `app/src/components/AskAiButton.css` |
| Uso in checklist ISO | `app/src/components/ChecklistModule.jsx` (wrapper `QuestionCard` locale) |
| Uso in checklist custom / obblighi | `app/src/components/CustomChecklistAuditView.jsx` |
| Stesso pulsante anche su | `NcDetailPanel.jsx`, `QualificationsPage.jsx`, `WeldingProceduresPage.jsx` |
| Segnalibro domanda | `app/src/utils/aiAssistantContext.js` (`saveChecklistFocus`, `buildChecklistAskAiFocus`) |
| Pagina di arrivo | `app/src/pages/AiAssistantPage.jsx` + `.css` |
| Rotta FE | `app/src/App.jsx` → `/ai-assistant` (licenza `ai_chat`) |
| Menu | `app/src/layouts/AppLayout.jsx` (voce «Assistente AI») |
| Router | `app/src/contexts/RouterContext.jsx` (`history.pushState`, **nessuno stato di ritorno**) |
| API | `POST /api/v1/ai/chat` — `backend/src/routes/aiChat.routes.js` |
| Prompt + contesto | `backend/src/controllers/aiChat.controller.js` |
| Client HTTP | `app/src/services/apiService.js` → `aiChat()` |

**Cosa viene salvato prima di partire** (`buildChecklistAskAiFocus`):

- norma della checklist (`standardKey`);
- clausola (`clauseRef`);
- id e **testo** della domanda (max 2000 caratteri sul testo di riferimento);
- elenco allegati: **solo nome, id, tipo, categoria** (niente file, niente testo estratto);
- flag «focus legale» (14001 / 45001).

**Cosa non viene salvato:** esito C/NC/OSS, note dell'auditor, azienda, URL di ritorno, scroll.

Il segnalibro vive in `sessionStorage` (`sgq_ai_checklist_focus:<uuid-audit>`). Si perde chiudendo la scheda del browser.

### 3.2 Percorso B — pannello sotto la domanda (già in codice, incompleto)

```
QuestionCard (universale)
  → QuestionAiPanel
  → tap su un chip (Valuta / Gap / Spiega / Bozza / Opportunità)
  → POST /api/v1/ai/question-assistant
  → questionAssistant.controller.js
       + questionAssistantPrompts.service.js
```

| Pezzo | File |
|---|---|
| UI | `app/src/components/QuestionAiPanel.jsx` + `.css` |
| Innesto | `app/src/components/QuestionCard.jsx` (dopo Note e allegati) |
| API | `backend/src/routes/questionAssistant.routes.js` |
| Controller | `backend/src/controllers/questionAssistant.controller.js` |
| Prompt 5 mode | `backend/src/services/questionAssistantPrompts.service.js` |
| Brief storico | `docs/agent-tasks/DEPUTYTASK_AI_CHECKLIST.md` (13/09/2026) |

Questo percorso **resta sulla domanda**. Ha pulsanti «Applica a Note» e «Cambia esito»: quelli **scrivono** sulla checklist (rilevante per #861/#862, vedi § 7).

### 3.3 Perché non si torna indietro

1. `AskAiButton` fa solo `navigate("/ai-assistant")`. Non salva `/audit` né l'id della domanda.
2. La pagina Assistente **non ha** un pulsante Indietro / «Torna alla domanda».
3. Il router usa `history.pushState`: la **freccia del browser** in teoria torna a `/audit`, ma in PWA sul telefono quella freccia spesso non si vede. Il menu in basso «Audit» riapre la lista/scheda **senza** scrollare alla domanda.
4. Lo scroll alla domanda **esiste già** in audit (`handleGoToQuestion` in `AuditAccordionLayout.jsx`, id DOM `question-<id>`), ma **nessun** link dall'AI lo usa.
5. `window.scrollTo(0, 0)` al `navigate` azzera la posizione: anche col browser-back l'utente può ritrovarsi in cima.

---

## 4. Cosa mostra la pagina Assistente AI oggi (sezione per sezione)

Pagina: **Assistente AI** (`/ai-assistant`). È la chat **generale** dello studio (Second Brain / Ambito), non una scheda della domanda.

| Zona | Cosa si vede | Perché è poco chiaro in audit |
|---|---|---|
| **Intestazione blu** | Titolo «Assistente AI». Sottotitolo: «Studio: … — chiedi qualsiasi cosa sui dati del tuo SGQ». | Sembra un help generale, non «aiuto su questa domanda». |
| **Chip Ambito** | «Ambito: nome azienda» oppure «tutto lo studio». Si cambia **solo** dal selettore in alto dell'app. | Chi arriva dalla checklist non capisce se è ancora «su quella domanda». |
| **Chip Norma** | Tendina «Tutte le norme» / ISO 9001 / … | Può non coincidere con la norma della domanda (è l'auto-norma dell'audit o una scelta manuale). |
| **Cestino** | «Nuova conversazione» (se ci sono già messaggi). | Cancella la chat, non torna all'audit. |
| **Aggiorna indice** | Solo admin. | Jargon tecnico. |
| **Barra fatti Ambito** | Numeri (NC, scadenze, …) dell'azienda in scope. | Utile in ufficio, rumore durante un punto checklist. |
| **Area vuota** | Icona, «Come posso aiutarti?», testo generico su audit/NC/rischi. Se c'è un segnalibro: riga «Clausola attiva: §X.Y — dom. N — K allegati». | La clausola è una nota a piè, non il titolo. **Nessuna risposta.** |
| **Chip suggeriti** (se c'è clausola) | «Cosa chiede il §…?», «Cosa devo verificare…?», «Quali documenti…?» / «Cosa dicono gli allegati…?», eventualmente «Cosa manca per chiudere l'audit». | Sono **scorciatoie da cliccare**, non una risposta. Manca «come porre la domanda in campo». |
| **Cronologia chat** | Messaggi precedenti dello stesso utente (salvati in `sessionStorage`, non nell'audit). Separatori se cambia azienda/audit. | Si può vedere una conversazione vecchia su un altro tema. |
| **Campo in basso** | «Scrivi la tua domanda…» + pulsante invio. | L'utente deve inventare la domanda. |
| **Quadrato / dropzone** | Carica **solo immagini** (PNG/JPEG/WebP, max 4 MB) per cercare **tavole/figure** nelle norme, non per analizzare l'allegato della domanda. | Facile scambiarlo per «allega l'evidenza». |
| **Disclaimer** | I suggerimenti AI sono indicativi e richiedono un professionista. | Corretto; va tenuto. |

Finché l'utente **non** scrive o clicca un chip, **nessuna chiamata AI** parte.

---

## 5. Cosa riceve l'AI (quando finalmente si parla)

### 5.1 Chat globale `POST /ai/chat`

**System prompt** (sintesi, niente segreti): assistente SGQ; rispondi in italiano; usa solo il contesto; non inventare; human-in-the-loop: **non certificare conformità e non scrivere C/NC al posto dell'auditor**.

Blocco extra se c'è un audit aperto:

- UUID audit, norma checklist, clausola, id + primi 200 caratteri del testo domanda;
- elenco allegati (nome + eventuale estratto testo, max 1800 caratteri per file, max 4 file estratti, max 8 in elenco);
- se 14001/45001: ancora agli allegati, non inventare evidenze;
- se la clausola non è in Libreria: messaggio «norma assente».

Poi aggiunge: profilo azienda (nome, **P.IVA**, settore, indirizzo), fatti Ambito, mappa conformità, chunk RAG dello studio, ultime correzioni di stile (`ai_feedback`).

**Manca nel prompt:** esito attuale (C/NC/…), note dell'auditor.

**Allegati:** il frontend manda solo metadati. Il backend **ricarica dal DB** gli allegati della domanda (`attachments` + `audits`) e prova `extractDocumentText`.

### 5.2 Pannello inline `POST /ai/question-assistant`

Cinque mode, prompt in `questionAssistantPrompts.service.js`:

| Chip UI | Mode | Cosa chiede al modello |
|---|---|---|
| Valuta | `conformity_assessment` | Esito C/NC/OSS/OM + motivazione + gap |
| Gap | `evidence_gap` | Documenti mancanti |
| Spiega | `norm_interpretation` | Cosa significa la clausola in pratica |
| Bozza | `draft_notes` | Testo per il campo Note |
| Opportunità | `om_opportunity` | Miglioramenti anche se conforme |

Il body manda `question` (testo, clausola, stato, note) e `attachments`. **Problema:** `QuestionCard` passa `attachmentManager?.files`, ma `useAttachmentManager` **non espone** `files` (espone `listAttachments`). Quindi `attachments` è quasi sempre `[]`. Il backend, se manca il testo estratto, **non** legge il file dal disco: log «text extraction skippato (pre-calcolo frontend)» — e il frontend **non** precalcola.

Risultato: il pannello «Valuta / Gap» ragiona su **nomi file assenti** e sulle note, non sul contenuto delle evidenze.

---

## 6. Allegati, OCR, modello, costo, riuso ingest

| Tema | Stato nel codice | Limite |
|---|---|---|
| Tipi che l'AI **testuale** sa leggere | PDF, DOCX, TXT (e `text/*`) | Foto/JPEG/PNG **non** nel filtro della chat checklist (`isTextExtractableAttachment`) |
| OCR | Già esiste: `documentTextExtractor.service.js` (pdfplumber/testo + fallback OCR `ita+eng`, max 3 pagine PDF; immagini via tesseract). Usato dall'**ingest** documenti e dalla **chat globale**. **Non** usato dal pannello inline. | OCR se il testo nativo è sotto ~50 caratteri (`INGEST_OCR_MIN_CHARS`) |
| Quanti file | Chat: max 8 in elenco, **4** estratti. Pannello: max 8 (ma oggi lista vuota). Checklist: max **10** file / domanda, **10 MB** l'uno, **50 MB** totali. Foto checklist compresse in JPEG (lato lungo 1600 px). Dropzone figure chat: **4 MB**, solo PNG/JPEG/WebP. | Estrarre 10 foto da 10 MB in un tap è costoso: va un tetto esplicito |
| Modello | Adapter `aiProviderAdapter.js`. Default codice: **Gemini** (`gemini-3.8-flash` se `GEMINI_MODEL` non è impostato). Fallback Anthropic se Gemini è a quota. Azure/OpenAI se non c'è Gemini. **Non stampare chiavi.** ADR-010 cita ancora «1.5 Flash»: il default in codice è più nuovo. | Il modello reale è quello sul VPS (env), non questo file |
| Costo in app | L'adapter Gemini mette `cost: 0` (non c'è listino in codice). Ogni tap = 1 chiamata chat (+ eventuale OCR locale). Tetto API: **60** richieste AI / 15 min / utente (`RATE_LIMIT_AI_MAX`, #862). | Fase 2: non lanciare OCR su tutti gli allegati in automatico |
| Riuso ingest | **Sì, da riusare**, non reinventare: `extractDocumentText`, `searchSimilar` / `norm_chunks`, `checkNormSourceAvailability`, `loadChecklistAttachmentsForChat`. L'ingest qualifiche/WPQR (`ingestStaging`) è un altro tubo (schemi documento), non va innestato sulla checklist. | |

Le figure (tavole norma) sono un terzo tubo: `POST /ai/figures/search-by-image`. Non è «analizza questa evidenza».

---

## 7. Riservatezza e salvataggio (e #861 / #862)

### Dati cliente verso il modello

| Percorso | Cosa può finire nel prompt | Anonimizzazione |
|---|---|---|
| Chat `/ai/chat` | Nome azienda, **P.IVA**, indirizzo, testo domanda, estratti allegati, fatti Ambito, chunk RAG | **Non** usa `redactPayloadForAi` (`aiPromptPrivacy.js`). Quella privacy è dell'ingest qualifiche/WPQR, non della chat. |
| Pannello quesito | Testo domanda, note, nomi file (quando arrivassero) | Stesso: **nessuna** redazione verso il modello. I **log** mascherano il nome file (`redactFileNameForLog`). |
| Log usage chat | Primi 2000 caratteri della domanda utente + 500 della risposta, in `ai_usage_log` | Tabella uso interno, non verso il modello |

**Implicazione:** oggi l'AI di audit può vedere dati identificativi del cliente. Per la fase 2 (allegati) va deciso **prima** se applicare la stessa redazione dell'ingest, o se (scelta di business) l'auditor accetta di mandare il testo delle evidenze al provider. Non è una decisione da prendere nel codice senza il committente.

### Dove vive lo scambio AI

- Chat: solo `sessionStorage` (`sgq:ai-assistant-messages:<org>:<user>`). **Non** entra nelle Note della domanda.
- Pannello: in memoria React. «Applica a Note» / «Cambia esito» **sì** scrivono la checklist.

### Rispetto di #861 / #862 (salvataggio audit robusto)

Lezioni già in GUIDA e in `main` (PR #861, #862):

- le domande si salvano **a differenze**, una alla volta, con orario della modifica;
- la scheda (conclusioni) non deve reinviare **tutte** le risposte;
- l'assistente ha un **tetto proprio** (60/15 min), non deve condividere quello dei salvataggi;
- conflitto: se il server ha una versione più nuova, non si sovrascrive.

**Regola per le fasi successive (vincolante):**

- la risposta AI **non** deve scrivere in automatico su Note / esito / `save_question_diff`;
- niente nuovo endpoint che faccia `responses/bulk` o sync intero;
- se si vuole «tenere» lo scambio: `sessionStorage` sulla domanda, oppure un tap esplicito «Copia nelle note» (una scrittura, come oggi «Applica a Note»);
- non toccare `syncService.js` / `StorageContext.jsx` / `auditMetadataSync.js` in queste slice.

---

## 8. Piano a fasi piccole

**Scelta di forma (raccomandata):** restare **sulla domanda** (potenziare il pannello già presente) e **non** aprire la chat globale per questo uso. La chat `/ai-assistant` resta per Ambito / domande libere. Il primo pulsante in checklist va unificato col pannello, così sparisce il salto di pagina.

Alternativa (se si vuole tenere la chat): aggiungere «Torna alla domanda» + auto-invio. Più lavoro di routing, stessa pagina confusa. **Sconsigliata come prima slice.**

### Fase 0 — allineamento (questa PR)

Solo questo documento. Nessun codice. Nessun TEST/PROD.

### Fase 1 — ritorno + risposta immediata contestuale (prima slice di codice)

**Cosa vede l'utente:** sulla domanda, un solo «Chiedi all'AI». Al tap si apre il riquadro **sulla stessa scheda** e arriva **subito** un testo: cosa chiede la norma/clausola, cosa è già compilato, 3–5 domande da fare in campo. Pulsante **Chiudi** (si resta in audit). Niente salto a `/ai-assistant`.

**Cosa non fa ancora:** non legge il contenuto degli allegati; non propone C/NC da solo in automatico.

| File probabili | Ruolo |
|---|---|
| `QuestionAiPanel.jsx` / `.css` | Auto-avvio mode «suggerisci domanda»; titolo chiaro; Chiudi |
| `QuestionCard.jsx` | Un solo pulsante; passare note, esito, `listAttachments(...)` (metadati) |
| `ChecklistModule.jsx` + `CustomChecklistAuditView.jsx` | Togliere o spegnere `AskAiButton` **solo in checklist** (NC/Qualifiche restano com'è) |
| `questionAssistantPrompts.service.js` | Nuova mode `suggest_questions` (o riuso `norm_interpretation` con output «domande da porre») |
| `questionAssistant.controller.js` | Accettare la mode; **non** estrarre file in questa fase |
| Test | `QuestionAiPanel` (nuovo L1) · `questionAssistantPrompts` · eventuale test «un solo pulsante in checklist» |

**Rischi:** due pulsanti residui se si dimentica la custom checklist; auto-chiamata AI a ogni apertura per sbaglio (solo al tap); prompt che «certifica» — tenere il disclaimer e il divieto C/NC automatico.

**Stima (ampiezza, non giorni):** 1 slice FE+prompt, ~6 file, L1 Vitest + build `app/`. Nessuna migrazione. Nessun deploy VPS obbligatorio se il backend della mode nuova non è ancora in PROD: **prima TEST**.

**Solo su TEST:** chiamata AI reale su un audit di prova (non cliente PROD); verifica che **non** partano salvataggi checklist extra (Network: niente `responses/bulk` al tap AI).

### Fase 2 — verifica evidenze (seconda slice)

**Cosa vede l'utente:** dopo aver compilato e allegato, un secondo tap «Verifica evidenze». L'AI legge note + testo degli allegati (se estraibile) e risponde: sufficiente / cosa manca. L'esito C/NC **non** si cambia da solo.

| File probabili | Ruolo |
|---|---|
| `questionAssistant.controller.js` | **Riusare** `loadChecklistAttachmentsForChat` + `enrichAttachmentsWithExtractedText` già in `aiChat.controller.js` (estrarre helper condiviso, non copiare) |
| `documentTextExtractor.service.js` | Solo riuso; eventuale estensione OCR immagini **se** il committente la vuole (costo) |
| `QuestionAiPanel.jsx` | Chip unico «Verifica evidenze»; elenco «file letti / file non letti (foto)» |
| `aiPromptPrivacy.js` | Solo se il committente sceglie di anonimizzare anche questo flusso |
| Test | controller: allegati da DB, skip se path assente, tetto 4 file; privacy se attivata |

**Rischi:** OCR lento su foto cantiere; prompt troppo lungo; costo token; dati cliente nel provider; tentazione di auto-scrivere le Note (vietato). Foto: senza estendere l'OCR, dire in UI «questa foto non è stata letta — descrivila nelle note».

**Stima:** 1 slice BE+FE, riuso extractor, **nessuna** nuova tabella se lo scambio non si persiste. Se si vuole storico permanente in DB → altra slice + migrazione + sì esplicito.

**Solo su TEST:** 1 PDF testo, 1 scansione, 1 foto; misurare tempo e se l'OCR gira sul VPS TEST. **Non** usare PDF cliente in Git.

### Fase 3 (opzionale, dopo feedback campo)

- Deep-link ` /audit?highlight=question-<id>` + riuso `handleGoToQuestion` se qualche flusso resta sulla chat globale.
- Copia esplicita «metti il parere AI nelle note» (una scrittura a differenze).
- Unificare i cinque chip storici in due modalità visibili (Suggerisci / Verifica).
- Decisione privacy (redazione sì/no) verbalizzata in ADR o GUIDA a sezione.

---

## 9. Test previsti (quando si farà il codice)

| Livello | Cosa | Quando |
|---|---|---|
| L1 FE | Un solo pulsante in checklist; pannello si apre e mostra la risposta finta; Chiudi non naviga | Fase 1 |
| L1 BE | Prompt `suggest_questions` contiene clausola + testo + stato; non contiene file binari | Fase 1 |
| L1 BE | Verifica evidenze: 0 allegati → «nessun file»; 1 PDF con path → estratto; foto → «non letto» | Fase 2 |
| Build | `cd app && NODE_ENV=test npm run test:run` (file toccati) + `npm run build` | Ogni slice |
| Smoke TEST | Percorso audit: tap AI, nessuna 429, nessun bulk risposte | Prima di chiedere PROD |
| Bugbot | Un `bugbot run` a slice chiusa (Dashboard Manual Only) | PR di codice, non questa |

Questa PR documentale: **nessun** test da eseguire sul prodotto.

---

## 10. Cosa serve solo su TEST (mai PROD senza sì)

- Provare Fase 1 e 2 su **ambiente TEST** (Netlify preview / backend TEST), audit di prova.
- OCR e chiavi AI: già sul VPS; non copiare segreti in chat o in Git.
- Migrazioni: **nessuna** in Fase 1–2 se non si persiste lo scambio.
- Deploy PROD backend: solo dopo TEST OK e sì esplicito (tocca AI + checklist).
- PDF / evidenze **cliente**: restano sul dispositivo/TEST, **non** si committano.

---

## 11. Decisioni da chiedere al committente (prima della Fase 2)

1. **Dove vive l'AI della domanda?** Raccomandazione: **sulla checklist**. Confermare.
2. **L'AI può vedere P.IVA, indirizzo, testo degli allegati?** Oggi sì nella chat globale. Per le evidenze: redigere o lasciare?
3. **Le foto vanno lette (OCR) o basta il PDF + le note?** OCR foto = più lento e costoso.
4. **Lo scambio si copia nelle Note solo se l'utente preme un pulsante?** Raccomandazione: **sì** (allineato a #862).

---

## 12. Riferimenti (già in repo)

- ADR-010 — architettura AI, adapter, disclaimer HITL  
- `#861` / `#862` — salvataggio checklist a differenze + tetto AI separato  
- `docs/GUIDA_CONSOLIDATA.md` § Sync (lezione 23/10/2026 scheda audit / «Troppe richieste»)  
- `docs/agent-tasks/DEPUTYTASK_AI_CHECKLIST.md` — pannello 5 mode (13/09)  
- `docs/specs/PRODUCT_CHECK_MOBILE_AI.md` — check mobile 19/07 (in parte superato: il pulsante c'è, ma naviga via)  
- `docs/agent-tasks/PLAN_SECOND_BRAIN_SLICES.md` — chat Ambito ≠ AI sul singolo quesito  

Nessun PDF cliente è stato aperto o committato per questa analisi.

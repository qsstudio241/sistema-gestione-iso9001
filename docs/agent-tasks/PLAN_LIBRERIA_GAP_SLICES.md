# Piano slice — Gap fonti (Libreria + Assistente AI)

> **Destinazione**: quando l’assistente (Gemini via `POST /ai/chat`) risponde a un tenant e rileva che manca una fonte di **know-how piattaforma** (MD/RAG non tenant-specific), il gap è **sempre evidenziato** nella risposta; viene creata una **richiesta in Libreria**; i **superadmin** ricevono **email** (SMTP già in uso). Il cerchio si chiude in due vie: (1) ingest tenant nella propria libreria/registro, (2) digitalizzazione piattaforma da superadmin in Cursor (PDF→MD/JSON, **senza** automatismo al click).
>
> **Sequel di**: [`PLAN_LIBRERIA_NORME_SLICES.md`](PLAN_LIBRERIA_NORME_SLICES.md) (LN-1…LN-5 UI shell — COMPLETATO).
>
> **Spec / ADR**: [ADR-010](../adr/ADR-010-ai-agentic-architecture.md) · [ADR-011](../adr/ADR-011-registry-norm-sot.md) · Assistente `app/src/pages/AiAssistantPage.jsx` + `backend/src/controllers/aiChat.controller.js` · email `backend/src/services/alertMail.service.js` · Libreria `NormLibraryPage.jsx`
>
> **Mappa creata**: 30/08/2026 · HITL committente

---

## Fuori scope

- Push notification mobile (fase 2; ora solo email)
- Avvio automatico `pdf_to_json` / pipeline Cursor dal click «Aggiungi richiesta»
- Scraping store UNI/CEI
- Context 1M di default
- Far vedere il gap agli altri tenant (solo chi ha chiesto + alert a quel tenant)
- Far eseguire la via (2) a ruoli diversi da `superadmin`

## Non ancora specificato

- Schema esatto prompt Gemini per emettere gap strutturati (JSON nel reply vs blocco dedicato) — si decide in LG-1 dal codice esistente citations/RAG
- Se la richiesta piattaforma vive in tabella dedicata vs estensione storage server delle richieste LN-5 — preferenza: **persistenza server** (localStorage LN-5 non basta per email/multi-device)
- Digest email vs una mail per gap — default LG-1: **una email per gap nuovo** (dedupe stesso codice+tenant in finestra breve)
- Come il superadmin marca «Digitalizzata piattaforma» dopo Cursor (LG-5)

## Decisioni già prese (HITL 30/08/2026)

- MD piattaforma = know-how **abbonamento**, non proprietà del singolo tenant
- Gap evidenziato dall’agente che risponde (**API Gemini** / assistente in-app)
- Visibilità gap in UI: **solo il tenant** che ha fatto la domanda (+ suo alert in risposta)
- Via **(1)** utente: alimenta libreria/registro con ingest (es. batch norme) — scope tenant
- Via **(2)** solo **superadmin**: MD piattaforma via agenti Cursor + PDF→JSON, controllo qualità, chiusura cerchio
- Notifica superadmin: email a utenti con ruolo **`superadmin` dal DB**; push mobile più avanti
- Prima slice eseguibile: evidenza gap in risposta + scrittura richiesta Libreria + email — **nessun** automatismo pdf-to-json

## Due vie di chiusura (contratto)

| Via | Chi | Cosa aggiorna |
|-----|-----|----------------|
| **1 — Tenant** | Utente del tenant | Libreria/Documenti **del tenant** (ingest) |
| **2 — Piattaforma** | Solo superadmin | Know-how condiviso (`docs/Normative/` / seed / RAG piattaforma) via Cursor |

## Mappa slice

| Slice | Tema | Perimetro | Dipende da | Tipo | Stato |
|-------|------|-----------|------------|------|-------|
| **LG-1** | Gap in risposta Gemini + persistenza richiesta + email superadmin | BE: rilevamento/estrazione gap da `/ai/chat` (o post-process); persistenza server richiesta; `alertMail` → email a `role=superadmin`; FE: blocco gap in `AiAssistantPage` + riga in Libreria; test L1/BE | Decisioni HITL | AFK | **CHIUSO** — TEST OK (30/08/2026, `cursor/lg1-libreria-gap-9166`, PR #610) |
| **LG-2** | UX conferma tenant + deep-link Libreria | FE: CTA «Vai in Libreria» / prefill; distinguere richiesta *tenant ingest* vs *piattaforma*; alert in-app già nella risposta | LG-1 | AFK | **CHIUSO** — TEST OK (30/08/2026, `cursor/lg2-libreria-gap-ux-7143`) |
| **LG-3** | Coda superadmin (sola lettura/azioni leggere) | FE/BE: lista gap piattaforma aperti (filtro via 2); link a Libreria Gestione; niente pdf-to-json | LG-1 | AFK | da fare |
| **LG-4** | Chiusura via 1 (tenant) | Quando ingest tenant copre il codice richiesto → stato richiesta aggiornato; niente tocco know-how piattaforma | LG-1 | AFK | da fare |
| **LG-5** | Chiusura via 2 (superadmin post-Cursor) | Azione «segna digitalizzata piattaforma» + note qualità; opz. email/ack al tenant richiedente | LG-3 | AFK | da fare |
| **LG-6** | Push mobile (opz.) | Solo se prodotto lo chiede dopo email stabile | LG-1 | HITL | nebbia / fuori priorità |

**Stato piano:** IN CORSO — LG-1…LG-2 CHIUSI; prossima **LG-3**.

## Decisioni già prese (aggiunte LG-1)

- Blocco macchina `<<<SGQ_SOURCE_GAPS ... SGQ_SOURCE_GAPS>>>` nella reply Gemini; strip lato server
- Tabella `library_source_requests` (mig. 160); email solo per `closure_path=platform`
- Dedupe stessa org+codice in stato open/in_progress entro 7 giorni

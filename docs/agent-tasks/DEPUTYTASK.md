# DEPUTYTASK — LG-1: Gap fonti in risposta Gemini + Libreria + email superadmin

**Stato:** APERTO  
**Aperto:** 30/08/2026  
**Piano:** [`PLAN_LIBRERIA_GAP_SLICES.md`](PLAN_LIBRERIA_GAP_SLICES.md)  
**Rischio:** Medio — BE additivo (`/ai/chat`, persistenza, email); niente breaking auth/sync; migrazione solo se additive/nullable  
**Comando:** `Leggi docs/agent-tasks/DEPUTYTASK.md ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.`

## Obiettivo (verificabile)

Dopo una domanda all’assistente AI (`POST /ai/chat` / Gemini), se manca una fonte di know-how **piattaforma** utile alla risposta:

1. La risposta al **tenant che ha chiesto** evidenzia il gap (dove serve la fonte + perché).
2. Viene **scritta una richiesta** visibile in **Gestione → Libreria** (persistenza **server**, non solo localStorage LN-5).
3. Tutti gli utenti DB con ruolo **`superadmin`** ricevono **email** (riuso `alertMail.service.js` / SMTP env).
4. **Nessun** avvio automatico di `pdf_to_json` (il superadmin digitalizza in Cursor a mano).

## HITL già chiusi (non rinegoziare)

- Gap visibile solo al tenant richiedente; via digitalizzazione piattaforma = solo superadmin.
- Via 1 = libreria/registro tenant; via 2 = know-how prodotto condiviso.
- Email a superadmin dal DB; push mobile fuori scope LG-1.
- pdf-to-json resta manuale Cursor (superadmin).

## File previsti (orientativi — Gate Ponytail)

- `backend/src/controllers/aiChat.controller.js` (+ service correlato se già esiste)
- Persistenza richieste gap (nuovo modulo minimo o estensione API documenti/libreria) + eventuale migrazione **additive** in `database/migrations/`
- `backend/src/services/alertMail.service.js` (riuso)
- `app/src/pages/AiAssistantPage.jsx` (+ CSS minimo / componenti esistenti tipo disclaimer/citazioni)
- `app/src/pages/NormLibraryPage.jsx` — mostrare richieste server (merge o sostituzione progressiva vs solo localStorage)
- Test: BE mirati + `app` Vitest su blocco gap / Libreria
- `backend/scripts/deploy-manifest.json` se aggiungi `.js` in `backend/src/`

## Cosa NON toccare

- Avvio automatico PDF→JSON / skill Cursor da API
- Push mobile
- Auth JWT / syncService (salvo lettura `role` già in token/DB)
- Enum `doc_type` nuovi senza gate ADR-011
- Altri moduli (CND, SAL, WPQR) fuori dal percorso chat→Libreria→email
- `docs/GUIDA_CONSOLIDATA.md` / roadmap § Stato attuale se c’è parallelo (bozza nel brief; sync post-merge)

## DoD

- [ ] Gap strutturato evidenziato in UI assistente per il solo tenant chiamante
- [ ] Richiesta persistita server-side e listabile in Libreria (stato tipo «da digitalizzare piattaforma» o equivalente chiaro)
- [ ] Email inviata (o tentata con log chiaro se SMTP assente in test) a utenti `superadmin`
- [ ] Note richiesta: spazio per **dubbi qualità** / secondo passaggio (non gergo STUD-x interno)
- [ ] Test L1/BE verdi + build FE se tocchi `app/`
- [ ] PR draft; aggiorna branch da `origin/main` prima del push finale
- [ ] Brief → CHIUSO — TEST OK (o HANDOFF se non chiudi)

## Verifica

```bash
# BE mirato (adatta al path test creato)
cd backend && npm test -- --testPathPattern='aiChat|libraryGap|libraryRequest' 
cd app && NODE_ENV=test npm run test:run -- src/tests/normLibraryPage.test.jsx src/tests/AiAssistant
cd app && npm run build
```

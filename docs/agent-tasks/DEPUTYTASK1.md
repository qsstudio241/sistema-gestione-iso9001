# DEPUTYTASK1 — P1 Generatore WPS: API + UI + AskAi (caso Mason)

**Stato:** APERTO  
**Priorità:** P1 — valore operativo per Mason (dopo P0 mergiato)  
**Branch base:** `main` (con P0: `wpsGenerator.service.js` + Tabella 5)  
**Branch consigliato:** `cursor/wps-generator-p1-<suffix>`  
**Creato da:** Lead 30/07/2026  
**Prerequisito:** PR [#326](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/326) mergiata — `generateWpsFromWpqr` su `main`  
**Spec:** [MODULO_WPS_GENERAZIONE_SCOPO_E_ROADMAP.md](../specs/MODULO_WPS_GENERAZIONE_SCOPO_E_ROADMAP.md) § Dettaglio P1

> **Allineamento Git (autonomo)**: `git fetch origin main` + `git pull origin main` prima di leggere questo brief. Verificare su `origin/main` che qui ci sia `Stato: APERTO` e che esista `backend/src/services/wpsGenerator.service.js`.

---

## Contesto

P0 ha il motore deterministico. P1 lo espone all’operatore:

1. **API** `POST /welding/wps/generate` → chiama `generateWpsFromWpqr` (nessuna scrittura DB).
2. **UI** «Genera WPS» su `WeldingProceduresPage` → form → anteprima / estensioni mancanti → **Salva bozza** via `POST /welding/wps` esistente.
3. **AskAi** — chip/suggerimento per il caso Mason in linguaggio naturale; matching resta nel service P0 (l’AI non decide i range 15614).

Caso accettazione: FW, S355 10 mm + S235 5 mm.

---

## Cosa NON toccare

- Logica di matching in `wpsGenerator.service.js` / Tabella 5 (solo *chiamare*).
- Sync audit / ADR-008 / auth.
- Deprecare `WpsUploadButton` (P2).
- Migrazioni DB (non necessarie).
- Tabella 6 nichel / Tabella 7 Level 1.

---

## Slice P1-A — Endpoint

**File tipici:**

- `backend/src/controllers/welding.controller.js` — handler `generateWPS`
- `backend/src/routes/welding.routes.js` — `POST /welding/wps/generate` **prima** di `/:id`
- Test: `backend/src/controllers/welding.controller.test.js` o file dedicato `wpsGenerate*.test.js`
- `deploy-manifest.json` se nuovi file (service già presente)

**Contratto:**

```http
POST /api/v1/welding/wps/generate
Authorization: Bearer …
Content-Type: application/json

{
  "company_id": 123,          // opzionale — Ambito
  "joint_type": "FW",
  "welding_process": "135",   // opzionale
  "parent_material_a": "S355",
  "parent_material_b": "S235",
  "thickness_a_mm": 10,
  "thickness_b_mm": 5
}
```

**Risposta 200:** shape di `generateWpsFromWpqr` (`status`, `wpqr_used`, `candidates`, `wps_draft`, `extensions_needed`, `warnings`).  
**Validazione:** `joint_type` + materiali + spessori numerici richiesti; 400 se mancanti.  
**Scope:** `organization_id` da JWT; passare `company_id` al service.  
**AI:** in P1-A **non** chiamare LLM se body strutturato. (`free_text` opzionale = fuori scope minimo; se implementato, gate `ai_norms` + parse → stessi campi, matching sempre P0.)

**Test Jest minimi:** mock `generateWpsFromWpqr` → ok / not_possible; 401/403 licenza se già pattern nei test welding.

---

## Slice P1-B — UI

**File tipici:**

- `app/src/pages/WeldingProceduresPage.jsx` (+ CSS se serve)
- `app/src/services/apiService.js` — `generateWPS(data)` → `POST /welding/wps/generate`
- Test Vitest mirato (modal/form o handler)

**UX:**

| Elemento | Comportamento |
|----------|----------------|
| Pulsante **«Genera WPS»** | Header tab WPS, vicino a «+ Nuova WPS»; rispetta Ambito azienda |
| Form | Tipo giunto (FW/BW), materiale A/B, spessore A/B (mm), processo opzionale |
| Submit | Chiama API generate; loading + errori leggibili |
| `ok` / `partial` | Anteprima campi `wps_draft` + warnings; **Salva bozza** → `createWPS` con status `bozza` (o valore già usato dal form) + `company_id` da Ambito; poi chiudi e ricarica lista |
| `not_possible` | Elenco `extensions_needed` in italiano; niente salvataggio |
| Stili | Riuso classi `wp-*` esistenti; niente card decorative parallele |

**Default form (demo Mason):** precompilabile FW / S355 / S235 / 10 / 5 (utile smoke).

---

## Slice P1-C — AskAi (minimo utile)

**File tipici:**

- `app/src/pages/WeldingProceduresPage.jsx` — `saveQualContext` già presente: arricchire con hint generazione
- `app/src/pages/AiAssistantPage.jsx` — `buildContextualSuggestions`: se `qualType === 'wps'`, chip tipo  
  «Genera una WPS FW per S355 10 mm + S235 5 mm usando le WPQR disponibili»

**Flusso preferito (scegliere il più semplice che funziona):**

- **A (consigliato):** chip → naviga a `/saldatura/procedure` con query/state che apre il form Genera precompilato Mason; utente conferma → API.
- **B:** chip solo testo guida; utente usa il form manuale.

**Vietato:** usare l’LLM per dire se un range 15614 è coperto.  
Se compare testo AI: `AiDisclaimer`.

---

## DoD

- [ ] Endpoint + test Jest verdi
- [ ] UI genera → anteprima → salva bozza (caso Mason)
- [ ] Controesempio UI o test: not_possible mostra estensioni
- [ ] Chip/suggerimento AskAi (P1-C minimo)
- [ ] Vitest mirati + `npm run build` in `app/`
- [ ] Deploy VPS backend (`deploy-to-vps.sh` + health) perché nuovo handler in controller già deployato
- [ ] Spec: riga P1 → ✅; `DEPUTYTASK1` → `CHIUSO — TEST OK`
- [ ] GUIDA: una riga se emerge lezione (es. route generate prima di `/:id`)

**Merge:** tocca backend controller/routes → **chiedere conferma** al committente prima di `gh pr merge` (policy).

---

## Riferimenti rapidi

| Asset | Path |
|-------|------|
| Motore P0 | `backend/src/services/wpsGenerator.service.js` |
| Routes | `backend/src/routes/welding.routes.js` |
| UI | `app/src/pages/WeldingProceduresPage.jsx` |
| API client | `app/src/services/apiService.js` (`createWPS` già c’è) |
| Spec P1 | `docs/specs/MODULO_WPS_GENERAZIONE_SCOPO_E_ROADMAP.md` |

---

## Comando deputy

```
Leggi docs/agent-tasks/DEPUTYTASK1.md ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.
```

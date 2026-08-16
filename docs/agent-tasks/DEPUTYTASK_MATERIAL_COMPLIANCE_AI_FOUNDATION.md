# DEPUTYTASK — Material Compliance AI — Fondazione MC-0 (solo documentazione)

**Stato:** APERTO  
**Priorità:** P1 — fondazione modulo (nessun codice applicativo)  
**Branch base:** `main`  
**Slice:** MC-0  
**Creato da:** Lead 05/08/2026  
**Spec:** [MODULO_MATERIAL_COMPLIANCE_AI.md](../specs/MODULO_MATERIAL_COMPLIANCE_AI.md)  
**Piano:** [PLAN_MATERIAL_COMPLIANCE_SLICES.md](PLAN_MATERIAL_COMPLIANCE_SLICES.md)  
**ADR:** [020](../adr/ADR-020-material-compliance-ai-module.md) · [021](../adr/ADR-021-material-requirements-hierarchy.md) · [022](../adr/ADR-022-ai-extraction-rule-engine.md) · [023](../adr/ADR-023-material-knowledge-base.md) · [024](../adr/ADR-024-material-certificate-workflow.md)

> **Allineamento Git (autonomo)**: prima di leggere questo brief eseguire `git fetch origin main` e `git pull origin main` (o partire da `origin/main` aggiornato). **Non** chiedere al committente di farlo.

---

## Contesto (leggere prima)

1. `PROJECT_CONTEXT.md`
2. `docs/PROJECT_ROADMAP.md` (riga open point Material Compliance)
3. `docs/GUIDA_CONSOLIDATA.md` (principi doc + riuso AI/ingest)
4. Spec + ADR sopra + `docs/ARCHITETTURA_UTENTI_RBAC.md`

Il modulo **non** è un’app nuova. Riusa ingest, AI adapter, Document Registry, RBAC, company scope.  
**ADR-022 vincolante**: AI estrae; Rule Engine valuta; operatore approva.

---

## Cosa NON toccare

- Codice `app/` / `backend/src/` (questa slice è **solo** `docs/specs/` + eventuale link in MODULO/PLAN)
- Sync audit / ADR-008
- Numerazione migrazioni (solo **proporre** nomi tabelle in DATA_MODEL; niente `.sql` in MC-0)
- Nuove dipendenze npm

---

## Slice MC-0 — Tre spec tecniche

### File da creare

| File | Contenuto minimo |
|------|------------------|
| `docs/specs/MATERIAL_COMPLIANCE_DATA_MODEL.md` | Entità, colonne, FK, indici, stati ADR-024, relazione a `import_jobs` / document registry, snapshot hash KB |
| `docs/specs/MATERIAL_COMPLIANCE_UI.md` | Route, voci menu **MVP slim** (lista+dettaglio), componenti riusati, gate `ModuleLocked`, desktop-first |
| `docs/specs/MATERIAL_COMPLIANCE_API.md` | Endpoint, payload, errori, seam licenza, riuso `importAiExtraction` / `aiProviderAdapter` |

### Vincoli di contenuto

- Menu MVP: **non** includere Dashboard/Statistiche/editor KB come obbligatori
- OCR: **in MVP** (MC-B dopo extract). I certificati in campo sono di solito scansioni (HITL 16/08). Riusare `documentTextExtractor` / `ocrExtractor` (stesso SAL S1a), non un secondo motore. In DATA_MODEL/API prevedere `reason: ocr_*` come sull’ingest WPQR.
- Path KB: `knowledge/material-compliance/` con `companies/<slug>/` (non cartella fissa `tecnove/`)
- Nessun `if (cliente === …)` nel design API/motore
- Formato ADR/spec progetto: header con stato/link, tabelle, «Cosa NON fare»

### Dopo le tre spec

Aggiornare in `MODULO_MATERIAL_COMPLIANCE_AI.md` e `PLAN_MATERIAL_COMPLIANCE_SLICES.md` i link alle tre spec e spuntare DoD MC-0.

---

## Definition of Done

- [ ] Tre file spec committati, UTF-8 senza BOM, accenti italiani corretti
- [ ] Nessun `U+FFFD`
- [ ] Link da MODULO + PLAN funzionanti
- [ ] Nessuna modifica codice runtime
- [ ] PR aperta su branch `cursor/…-c6d4` (o branch assegnato)

## Test L1

```bash
node backend/scripts/check-utf8-encoding.js docs/specs/MATERIAL_COMPLIANCE_DATA_MODEL.md
node backend/scripts/check-utf8-encoding.js docs/specs/MATERIAL_COMPLIANCE_UI.md
node backend/scripts/check-utf8-encoding.js docs/specs/MATERIAL_COMPLIANCE_API.md
```

---

## Chiusura

Esito: **TEST OK** (spec complete) oppure **FIX NON APPLICABILI** solo se su `origin/main` le tre spec esistono già e coincidenti.  
Dopo merge MC-0: Lead apre brief MC-1 (migration) su `DEPUTYTASK.md` o file numerato dedicato — **non** mescolare DB e UI nella stessa PR.

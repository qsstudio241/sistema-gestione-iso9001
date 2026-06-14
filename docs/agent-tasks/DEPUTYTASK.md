# DEPUTYTASK — Riesame requisiti slice 2 (RAG + committente anagrafica) — 14/06/2026

**Stato:** DA ESEGUIRE

**Prerequisito:** slice 1 committata e migrazione **095** applicata su VPS/DB (`commercial_customer_name`, `commercial_customer_ref`).

---

## Obiettivo

Completare il gap LM&CO / PT.MAIDO oltre la distinzione testuale: arricchire l'analisi AI con documenti e qualifiche dell'azienda SGQ, e valutare modellazione anagrafica del committente commerciale.

## Slice 2 — task

| # | Task | DoD |
|---|------|-----|
| R2.1 | **RAG riesame** — in `buildReviewRequirementsContext`, oltre a norm chunks, cercare in `knowledge_chunks` / registro documenti filtrati per `company_id` del caso (qualifiche saldatori, WPS, certificati) | Prompt AI include estratti pertinenti; test unitario con mock DB |
| R2.2 | **Endpoint o flag** — opzione `includeCompanyKnowledge: true` su `POST /ai/suggest` e `POST /contract-reviews/:id/analyze` | Retrocompatibile (default true solo se company_id presente) |
| R2.3 | **Valutazione committente anagrafica** — ADR breve: `commercial_customer_company_id` FK opzionale vs testo libero attuale; impatto audit secondo livello su committenti | Doc in `docs/adr/` o sezione roadmap; nessun breaking change senza migrazione |
| R2.4 | **UI** — badge/link committente se collegato ad anagrafica; hint copertura qualifiche collegata al committente | Smoke L3 scenario ERAM/LM&CO/PT.MAIDO |

## Verifica

1. Migrazione 095 già OK in produzione
2. Caso test: company_id = LM&CO, commercial_customer_name = PT.MAIDO
3. Analisi AI elenca gap con riferimento a qualifica/WPS trovata in RAG (se indicizzata)
4. Test L1 backend + build Vite verdi

## Deploy

- Migrazione solo se R2.3 introduce FK (096+)
- Deploy controller + frontend via flusso standard VPS/Netlify

---

Leggi questo file ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.

# DEPUTYTASK — Registro documenti slice D2/D3 (chiuso)

**Stato:** CHIUSO — **TEST OK** (01/06/2026)  
**Branch:** `cursor/doc-registry-scope-d2-d3-9c87`  
**PR:** https://github.com/qsstudio241/sistema-gestione-iso9001/pull/78 — **mergiata su main**

## Esito

- **D2**: ambito azienda condiviso (Priorità / Catalogo / Albero), `localStorage`, prefill `DocumentForm`
- **D3**: auto-provisioning albero in `POST /companies` (VPS deployato)

## Test L1

15/15 OK (`documentRegistryUrl`, `documentRegistryCompanyScope`, `useDocumentTree.companyScope`)

## Smoke L3 (manuale)

Registro → header Ambito → filtri coerenti; nuova azienda → albero con cartelle provisioning.

# DEPUTYTASK — Registro documenti slice D1 (chiuso)

**Stato:** CHIUSO — **TEST OK** (01/06/2026)  
**Branch:** `cursor/doc-tree-company-scope-d1-9c87`  
**PR:** (aperta da cloud agent)

## Esito

Slice **D1**: selettore ambito azienda sulla tab **Albero** del Registro documenti.

- UI: «Tutto lo studio» / singola azienda (come Ricerca SGQ)
- API: `GET /documents/tree?company_id=` e figli lazy con stesso filtro
- URL: `?tab=tree&company_id=` (+ `select` per deep link)
- Cartelle custom: aggiunta ok; cartelle provisioning (`is_system_folder`) non modificabili/eliminabili (invariato)

## Test L1

- `documentRegistryUrl.test.js` (+ company_id)
- `useDocumentTree.companyScope.test.js` (4 test)

## Smoke L3 (manuale)

Registro documenti → tab Albero → cambiare ambito → verificare in Network `company_id` su tree/children.

## Prossimo backlog

- **D2**: scope condiviso Priorità + Catalogo; `localStorage` opzionale
- **D3**: provisioning albero per singola `company` alla creazione cliente

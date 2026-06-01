# DEPUTYTASK — Registro documenti slice D2/D3

**Stato:** IN CORSO (cloud agent)  
**Branch:** `cursor/doc-registry-scope-d2-d3-9c87`

## Obiettivo

- **D2**: ambito azienda condiviso su Priorità + Catalogo + Albero; persistenza `localStorage`; prefill `DocumentForm`
- **D3**: auto-provisioning albero documentale alla creazione azienda (backend idempotente)

## Test L1

```bash
cd app && NODE_ENV=test npx vitest run src/tests/documentRegistryUrl.test.js src/tests/documentRegistryCompanyScope.test.js src/tests/useDocumentTree.companyScope.test.js
```

## Deploy VPS (D3)

Dopo merge: `scp company.controller.js` + restart `sgq-backend.service`.

## Smoke L3

1. Registro → cambiare ambito in header → Priorità/Catalogo/Albero filtrati
2. Refresh pagina → ambito ripristinato da URL o localStorage
3. Anagrafica aziende → nuova azienda → tab Albero con ambito quella azienda mostra cartelle provisioning

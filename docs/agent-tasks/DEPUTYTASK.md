# DEPUTYTASK — Profilo azienda conformità legislativa (ADR-018)

**Stato:** CHIUSO  
**Chiuso:** 15/08/2026 — S6 mergiata (PR #426) + doc (PR #427) + deploy VPS  
**Spec:** [ADR-018](../adr/ADR-018-company-profile-conformita-legislativa.md) · [Catalogo campi/Excel](../specs/COMPANY_PROFILE_CAMPI_E_TEMPLATE_EXCEL.md)

---

## Esito

| Slice | Stato |
|-------|--------|
| S1 Migration | FATTO — `145_company_profile.sql` |
| S2 API + tab UI | FATTO — GET/PUT + tab «Profilo conformità» |
| S3 Import Excel | FATTO — detect / import / template |
| S4 Completeness + sync | FATTO — PR #411 |
| S5 Lookup OpenAPI | FATTO — PR #418 · Recupera da registro |
| S6 Cerca in anagrafica | FATTO — PR #426 · deploy 15/08 |

**In produzione**
- `POST /companies/:id/profile/lookup` + conferma import `source=registry`
- `POST /companies/registry/search` — P.IVA → 1 risultato; nome → lista max 8
- UI: **Recupera da registro** (Profilo) · **Cerca nel registro** (Anagrafica)
- Token `SGQ_OPENAPI_COMPANY_TOKEN` già nel `.env` VPS

**Attesa umana (non codice):** in console OpenAPI attivare **Company Search**. Finché 402, l’avviso «credito o piano insufficiente» è il comportamento voluto. Poi una prova: nome TECNOVE → lista → Usa questa → Salva.

---

## Fuori scope (resta fuori)

- Auto-create aziende da Excel multi-riga.
- Registro obblighi automatico da ATECO.
- iCRIBIS / scraping siti pubblici.

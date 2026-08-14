# DEPUTYTASK — Profilo azienda conformità legislativa (ADR-018) — S5

**Stato:** CHIUSO  
**Priorità:** P1 — lookup OpenAPI Company (ATECO + anagrafica A), human-in-the-loop  
**Chiuso:** 14/08/2026 — PR #418 mergiata (`956547a7`)  
**Spec:** [ADR-018](../adr/ADR-018-company-profile-conformita-legislativa.md) · [Catalogo campi/Excel](../specs/COMPANY_PROFILE_CAMPI_E_TEMPLATE_EXCEL.md)

---

## Esito

| Slice | Stato |
|-------|--------|
| S1 Migration | FATTO — `145_company_profile.sql` |
| S2 API + tab UI | FATTO — GET/PUT + tab «Profilo conformità» |
| S3 Import Excel | FATTO — detect / import / template |
| S4 Completeness + sync | FATTO — PR #411 |
| S5 Lookup OpenAPI | FATTO — PR #418 |

**S5 in produzione (codice):** `POST /companies/:id/profile/lookup` (dry-run) + conferma via `POST .../import` con `source: 'registry'`. UI: pulsante **Recupera da registro**.

**Manca solo configurazione umana:** `SGQ_OPENAPI_COMPANY_TOKEN` nel `.env` del VPS (`/var/www/sgq-backend/.env`, stesso posto di `GEMINI_API_KEY`) e riavvio `sgq-backend`. Senza token l'API risponde 503. Non incollare il token in chat.

---

## Fuori scope (resta fuori)

- Auto-create aziende da Excel multi-riga.
- Registro obblighi automatico da ATECO.
- iCRIBIS (sito, non API).

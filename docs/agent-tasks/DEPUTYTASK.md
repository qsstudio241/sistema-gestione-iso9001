# DEPUTYTASK — Migrazione alberi per-azienda batch — 13/06/2026

**Stato:** TEST OK — Sessione chiusa

---

## Obiettivo

Isolare gli ambienti documentali per azienda negli studi che usavano ancora l'albero condiviso (`company_id` NULL). Slice: diagnosi → DRY_RUN → apply per tenant.

## Esito

| Verifica | Risultato |
|----------|-----------|
| Scan tutti i tenant | 2 da migrare: org **1003** MASON, org **1004** ERAM |
| DRY_RUN batch | OK |
| Apply batch | OK — MASON + ERAM migrati |
| Post-scan | `Tenant da migrare: 0` |
| ERAM DNV | 15 norme, `company_id=16` |
| ERAM LM&CO | 0 norme (albero vuoto, corretto) |

## Script

- `backend/scripts/scan-shared-document-trees.js`
- `backend/scripts/migrate-shared-trees-batch.js`
- `backend/scripts/migrate-per-company-document-trees-vps.js` (+ `rehomeSharedOrphans`)

## Operativo utente

Registro documenti → tab **Albero** → **Ambito = nome azienda** → hard refresh PWA.

---

Leggi questo file ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.

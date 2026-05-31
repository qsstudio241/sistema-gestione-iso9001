# DEPUTYTASK — RBAC Fase 2 (NC, allegati, registry)

**Branch suggerito:** `feat/rbac-phase-2-nc-attachments-registry`  
**Priorità pipeline committente:** 2/4 (dopo merge AI deep link + chat persist su `main`)

## Comando deputy

```
Leggi docs/agent-tasks/DEPUTYTASK.md ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.
```

## Obiettivo

Estendere lo **stesso predicato studio/tenant** già usato su lista/dettaglio/sync audit (`auditListRbac.service.js` → `studioScopeClause`) a **write path audit**, **NC**, **allegati** e **document registry**, come da [ARCHITETTURA_UTENTI_RBAC.md](../ARCHITETTURA_UTENTI_RBAC.md) sez. 5–7 (Fase 1–2).

**Regola:** GET e PUT/POST/DELETE/sync/download devono usare **lo stesso criterio di visibilità**. Minimo privilegio: mai lista org-wide implicita per `auditor`/`viewer` senza studio assegnato.

## Riferimenti obbligatori

- `docs/ARCHITETTURA_UTENTI_RBAC.md` — matrice scope, fasi migrazione
- `docs/GUIDA_CONSOLIDATA.md` — smoke tabella **RBAC / studio** (due utenti, `auditor_org` diversi)
- `backend/src/services/auditListRbac.service.js` — **non duplicare** la logica; riusare o estrarre helper condiviso se serve join su `audits`
- Test esistenti: `backend/src/services/auditListRbac.service.test.js`, `backend/src/controllers/nc.controller.test.js`

## Slice (ordine consigliato)

### Slice A — Audit write path (completamento Fase 1)

| Endpoint / area | File indicativo | Azione |
|-----------------|-----------------|--------|
| `updateAudit`, `deleteAudit`, `upsertAudit`, `bulkSaveResponses`, `completeAudit`, statistiche | `audit.controller.js` | Verificare che ogni query su `audits` includa `studioScopeClause` come `listAudits`/`getAuditById`; 403/404 se fuori scope |
| Sync bulk | `sync.controller.js` | Confermare scope su fetch audit; allineare se gap |

**DoD:** auditor studio A non modifica/sync audit di studio B (id noto → 404 o 403 coerente con GET).

### Slice B — NC (Fase 2)

`nc.controller.js` usa già `studioScopeClause` in molti handler — **audit completo**:

- Lista, dettaglio, create/update/delete, stats, export: scope via join `audits` + stesso alias/parametri
- Create: verificare che l'`audit_id` referenziato sia nello scope utente **prima** dell'INSERT

**DoD:** test Jest aggiuntivi o estesi (pattern già in `nc.controller.test.js`).

### Slice C — Allegati

`attachment.controller.js` oggi filtra solo `organization_id`.

- GET lista/dettaglio/download/delete: join audit (o NC→audit) + `studioScopeClause`
- Upload: dopo risoluzione `audit_id`/`nc_id`, assert audit in scope (come upload già fa per org)

**DoD:** test mirati attachment se esistono; altrimenti 2–3 casi Jest minimi (auditor A non scarica allegato audit B).

### Slice D — Document registry (policy prodotto)

Da ARCHITETTURA: **una sola policy** org-wide (solo org_admin) **oppure** filtro studio/company.

- **Default task:** documentare scelta in commento PR + applicare **org-wide per org_admin/superadmin** e **studio via `auditor_org_id` sulle company collegate** dove il modello dati lo consente; se i documenti non hanno studio, proporre filtro minimo (es. solo org + licenza `documents`) e segnalare gap in chiusura
- Controller: `documentRegistry*.js` / servizi registry — aggiungere scope coerente su list/get/update/delete

**DoD:** almeno list + getById protetti; nota in GUIDA se policy parziale.

## Test e deploy

| Livello | Comando | Obiettivo |
|---------|---------|-----------|
| L1 backend | `cd backend` → `npx jest auditListRbac.service.test.js nc.controller.test.js --no-coverage` (+ nuovi test slice) | Tutti verdi |
| L1 backend ampio | `npm test` se tempo | Nessuna regressione |
| Deploy VPS | **Obbligatorio** se tocchi controller: `backend/scripts/deploy-controllers-to-vps.ps1` + restart + verifica PID | API produzione allineata |
| L3 smoke | Due utenti stesso tenant, `auditor_org_id` diversi: GET/PUT audit, NC, allegato, registry secondo policy | Tabella GUIDA RBAC |

## Criteri chiusura — TEST OK

- [ ] Slice A–C: nessun endpoint critico senza scope studio dove l'audit è la radice del dato
- [ ] Test Jest verdi per le modifiche
- [ ] Se deploy VPS: health + smoke RBAC documentato (data, esito)
- [ ] Aggiornamento breve `docs/GUIDA_CONSOLIDATA.md` (esperienza RBAC Fase 2)
- [ ] Commit su branch feature; **non** merge su main (lead committente)

## Non in scope (task successivi)

- Fase 3 `studio_admin`, Fase 4 `user_company_access`
- Licenze per-azienda, MVP SAL (pipeline 3–4)

---

*Creato 31/05/2026 — lead post-merge `88caa9b` (AI deep link + chat persist).*
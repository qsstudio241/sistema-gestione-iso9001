# Task deputy — audit `2026-04` non visibile con credenziali Mason

> Creato: 20 aprile 2026  
> Priorità: critica (utente cliente non vede audit nel menu a tendina)  
> Ambito: diagnostica RBAC/API + allineamento dati tenant/studio + smoke login Mason.

---

## 1) Problema da risolvere

Con account Mason, nel menu audit non compare `2026-04`.

Nota tecnica già verificata: il dropdown frontend mostra tutti gli audit presenti nello stato locale; se manca una voce, tipicamente non è un filtro UI ma un problema a monte (API `GET /audits` / scope RBAC / dati disallineati).

---

## 2) Ipotesi principali (da verificare in ordine)

1. audit `2026-04` non torna da `GET /audits` per scope `studioScopeClause` (RBAC).
2. `audits.organization_id` non coerente con tenant/studio dell’utente Mason.
3. `audits.company_id` nullo o collegato a company di studio diverso (quindi escluso dal filtro studio).
4. audit creato da altro utente e senza company valida -> fallback `created_by = @user_id` lo nasconde.
5. endpoint VPS non allineato all’ultima logica RBAC (deploy incompleto backend).

---

## 3) Vincoli non negoziabili

- Nessun allargamento permessi “temporaneo” che riduca isolamento tenant/studio.
- Nessuna modifica distruttiva ai dati.
- Se servono correzioni DB, prima diagnosi **read-only** con evidenze; poi fix minimo e reversibile.
- No segreti in repo/chat.

---

## 4) Piano operativo obbligatorio

## Fase A — Diagnosi read-only (obbligatoria)

1. Verificare con utente Mason:
   - chiamata `GET /api/v1/audits?page=1&limit=200` (e pagine successive se presenti);
   - confermare se `2026-04` manca già in risposta API.
2. Su DB (read-only), raccogliere:
   - record `audits` di `2026-04` (`audit_id`, `organization_id`, `company_id`, `created_by`, `is_deleted`);
   - utente Mason (`user_id`, `organization_id`, `auditor_org_id`, `role`);
   - `companies.id` collegata all’audit e relativo `auditor_org_id` / tenant.
3. Verificare mismatch con query diagnostiche già presenti in `database/scripts/`:
   - `split_tenants_diagnose_audits_company_id_null.sql`
   - `split_tenants_fix_users_audits_org_mismatch.sql` (solo parte diagnostica prima di UPDATE)

## Fase B — Fix minimo

Applicare solo il fix necessario in base alla causa trovata:

- se mismatch tenant su audit/company/user: riallineare dati coerentemente;
- se deploy backend incompleto: deploy VPS file backend e restart servizio;
- se bug codice RBAC reale: patch mirata con test.

## Fase C — Smoke in loop (obbligatorio)

Ripetere `review -> fix -> smoke` fino a chiusura reale:

1. login Mason;
2. menu audit contiene `2026-04`;
3. apertura audit ok (nessun 403/404 inatteso);
4. verifica che altri audit di studi diversi **non** compaiano.

---

## 5) DoD

- [ ] Causa root documentata con evidenza (API/DB/log).
- [ ] `2026-04` visibile e apribile con account Mason.
- [ ] Nessuna regressione isolamento RBAC (no fuga cross-studio).
- [ ] Eventuale procedura aggiornata in `docs/GUIDA_CONSOLIDATA.md` se è cambiato il runbook.

---

## 6) Output finale univoco

Usare una sola forma:

- `TEST OK`
- `FIX NON APPLICABILI: <elenco + motivazione + prossimo passo>`

---

## 7) Prompt pronto per Agents Window

```text
Segui rigorosamente `docs/agent-tasks/TASK_MASON_AUDIT_2026-04_VISIBILITY_2026-04-20.md`.

Obiettivo: ripristinare visibilità dell’audit `2026-04` per utente Mason senza rompere RBAC.

Regole:
- prima diagnosi read-only con evidenze API/DB
- poi fix minimo mirato
- loop obbligatorio review -> fix -> smoke
- output finale univoco: `TEST OK` oppure `FIX NON APPLICABILI: ...`

Consegna:
1) causa root con evidenza
2) file/query/fix applicati
3) smoke eseguiti e risultato
4) output univoco obbligatorio
```


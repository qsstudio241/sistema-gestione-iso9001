# Policy di approvazione PR — `app/src/` (Basso rischio, ambito ristretto)

> Vedi [`sgq-git-autonomy.mdc`](../../.cursor/rules/sgq-git-autonomy.mdc) § Livelli di rischio —
> "typo/fix 1-2 file frontend non sync/auth/DB" è Basso per definizione. Questo file esiste per
> tenere quella regola **contenuta a questa directory**, non come eccezione nel fallback root (vedi
> nota di correzione in [`APPROVAL_POLICY.md`](../../APPROVAL_POLICY.md) — rilievo Bugbot 13/08/2026).

## Approvazione automatica

Consentita solo se **tutte** le condizioni sono vere:

- Diff ≤ 2 file, tutti dentro `app/src/**`.
- Nessun file in `app/src/services/apiService.js` (chiamate sync/API centrali),
  `app/src/contexts/**` che gestiscono auth/sync, `app/src/utils/*CompanyScope*.js` (scope
  multi-tenant condiviso tra pagine).
- Bugbot Review Context senza rilievi critici.
- CI verde (`ci-app-pr`).

## Altrimenti

Solo `Request Reviewers`, mai `Approve` — in particolare per modifiche a componenti/hook condivisi da
più pagine (es. `AppLayout.jsx`, `CompanyScopeContext.jsx`), dove un fix "piccolo" può avere effetto
su molti moduli contemporaneamente.

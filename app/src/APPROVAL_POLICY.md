# Policy di approvazione PR — `app/src/` (Basso rischio, ambito ristretto)

> Vedi [`sgq-git-autonomy.mdc`](../../.cursor/rules/sgq-git-autonomy.mdc) § Livelli di rischio —
> "typo/fix 1-2 file frontend non sync/auth/DB" è Basso per definizione. Questo file esiste per
> tenere quella regola **contenuta a questa directory**, non come eccezione nel fallback root (vedi
> nota di correzione in [`APPROVAL_POLICY.md`](../../APPROVAL_POLICY.md) — rilievo Bugbot 13/08/2026).

> **Corretto 13/08/2026** dopo un secondo rilievo reale di Bugbot su questo stesso file (Medium
> Severity, [PR #404](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/404)): la
> formulazione precedente escludeva solo i context "che gestiscono auth/sync", una qualifica
> interpretabile che lasciava fuori `CompanyScopeContext.jsx` (scope multi-tenant, non "auth/sync" in
> senso stretto) e non nominava affatto `companyAccess.js`. Sostituita con un elenco senza
> qualificatori ambigui: **tutta** la directory `contexts/`, il file `companyAccess.js` per nome
> esplicito, e qualunque file con `CompanyScope` nel nome ovunque in `app/src/**` (non solo `utils/`).

## Approvazione automatica

Consentita solo se **tutte** le condizioni sono vere:

- Diff ≤ 2 file, tutti dentro `app/src/**`.
- **Nessun file tra questi** (elenco esaustivo, non un pattern parziale):
  - `app/src/services/apiService.js` (chiamate sync/API centrali).
  - Qualunque file dentro `app/src/contexts/**` — l'intera directory, senza eccezioni: gestisce stato
    applicativo condiviso tra pagine (auth, sync, scope multi-tenant).
  - `app/src/utils/companyAccess.js`.
  - Qualunque file il cui nome contiene `CompanyScope`, in qualunque sottodirectory di `app/src/**`
    (`utils/*CompanyScope*.js`, `components/CompanyScopeSelect.jsx`, ecc.) — scope multi-tenant
    condiviso tra più moduli.
- Bugbot Review Context senza rilievi critici.
- CI verde (`ci-app-pr`).

## Altrimenti

Solo `Request Reviewers`, mai `Approve` — in particolare per modifiche a componenti/hook condivisi da
più pagine (es. `AppLayout.jsx`), dove un fix "piccolo" può avere effetto su molti moduli
contemporaneamente.

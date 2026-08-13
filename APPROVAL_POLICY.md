# Policy di approvazione PR — ProgettoISO (default, fallback finale)

> Letta da **PR Routing & Approval** (Cursor Automations) solo quando nessuna `APPROVAL_POLICY.md` più
> specifica in una directory ancestrale copre il file modificato. Il criterio di rischio (Basso/Medio/
> Alto) è definito in [`sgq-git-autonomy.mdc`](.cursor/rules/sgq-git-autonomy.mdc) § Livelli di rischio.

> **Corretto 13/08/2026** dopo un rilievo reale di Bugbot sulla versione precedente di questo file
> (High Severity, vedi [PR #402](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/402)):
> la vecchia regola "approva se ≤2 file e non nella denylist" lasciava passare senza controllo path
> senza policy dedicata come `backend/scripts/**`, `.github/workflows/**`, `database/scripts/**` —
> proprio i path che toccano produzione/CI. Sostituita con un default **deny-by-default**: nessuna
> lista di eccezioni da mantenere aggiornata, zero buchi per path futuri non ancora previsti.

## Regola (unica)

**Mai approvazione automatica su questo fallback.** Sempre `Request Reviewers`.

Questo file si applica esattamente a: qualunque path che non ha una `APPROVAL_POLICY.md` più vicina.
Oggi questo significa, tra gli altri: `backend/scripts/**`, `.github/workflows/**`,
`database/scripts/**`, file di configurazione a livello repo (`netlify.toml`, `package.json`, ecc.).
Tutti questi toccano produzione, CI/CD o configurazione condivisa — **sempre** review umana, senza
eccezioni codificate qui.

Le uniche aree con una regola di approvazione automatica **più permissiva** sono quelle con una
propria `APPROVAL_POLICY.md` dedicata, oggi:

| Area | Policy |
|---|---|
| `docs/**` | [`docs/APPROVAL_POLICY.md`](docs/APPROVAL_POLICY.md) |
| `.cursor/rules/**` | [`.cursor/rules/APPROVAL_POLICY.md`](.cursor/rules/APPROVAL_POLICY.md) |
| `app/src/**` | [`app/src/APPROVAL_POLICY.md`](app/src/APPROVAL_POLICY.md) |
| `backend/src/**` | [`backend/src/APPROVAL_POLICY.md`](backend/src/APPROVAL_POLICY.md) (mai approvazione, comunque) |
| `database/migrations/**` | [`database/migrations/APPROVAL_POLICY.md`](database/migrations/APPROVAL_POLICY.md) (mai approvazione, comunque) |

## Regola di declassamento (vale sempre, anche nelle policy specifiche)

Se la PR tocca anche un solo file di livello Alto (qualunque directory), tratta l'intera PR come Alto
— non spezzare artificialmente per farla rientrare nel Medio o nel Basso.

## Mai approvazione automatica (a prescindere dalla directory)

- Autenticazione/JWT, `syncService` (ADR-008/ADR-002), RBAC/`company_access`.
- Logica normativa AI: `weldingAiSuggest.service.js`, `salAiSuggest.service.js`,
  `wpsGenerator.service.js`, `gapAnalysis*`, `moduleLicense.service.js`.
- Migrazioni SQL, script deploy/VPS, workflow CI/CD.

## Se Bugbot non è disponibile

Nessun segnale Bugbot equivale a un rilievo critico: mai approvazione automatica.

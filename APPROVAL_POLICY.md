# Policy di approvazione PR — ProgettoISO (default)

> Letta da **PR Routing & Approval** (Cursor Automations) per decidere se assegnare reviewer e/o
> approvare automaticamente una PR. Non sostituisce mai la review umana e non mergia mai (vincolo di
> prodotto Cursor — vedi [`sgq-git-autonomy.mdc`](.cursor/rules/sgq-git-autonomy.mdc) § Vincolo verificato).

Si applica quando nessuna `APPROVAL_POLICY.md` più specifica in una sottodirectory copre i file
modificati. Il criterio di rischio (Basso/Medio/Alto) è definito in
[`sgq-git-autonomy.mdc`](.cursor/rules/sgq-git-autonomy.mdc) § Livelli di rischio — questo file applica
quella tabella, non ne definisce una nuova.

## Regola di declassamento (vale sempre)

Se la PR tocca anche un solo file di livello Alto, tratta l'intera PR come Alto — non spezzare
artificialmente per farla rientrare nel Medio.

## Approvazione automatica

Consentita **solo se tutte** le condizioni sono vere:

- Nessun file in `backend/src/controllers/**`, `backend/src/services/**` (eccetto costanti/barrel
  puri), `backend/src/middleware/**`, `database/migrations/**`.
- Bugbot Review Context: nessun rilievo critico o bloccante.
- CI pertinente verde (`ci-app-pr`, `smoke-test`, `ci-harness-boot`).
- Diff ≤ 2 file, oppure interamente dentro `docs/**` o `.cursor/rules/**`.

In tutti gli altri casi: solo **Request Reviewers**, mai **Approve**.

## Mai approvazione automatica (a prescindere dalla dimensione del diff)

- Autenticazione/JWT, `syncService` (ADR-008/ADR-002), RBAC/`company_access`.
- Logica normativa AI: `weldingAiSuggest.service.js`, `salAiSuggest.service.js`,
  `wpsGenerator.service.js`, `gapAnalysis*`, `moduleLicense.service.js`.
- Migrazioni SQL (vedi [`database/migrations/APPROVAL_POLICY.md`](database/migrations/APPROVAL_POLICY.md)).

## Se Bugbot non è disponibile

Nessun segnale Bugbot equivale a un rilievo critico: mai approvazione automatica.

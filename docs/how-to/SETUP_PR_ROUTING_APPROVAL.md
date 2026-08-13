# Setup PR Routing & Approval (Cursor Automations) — ProgettoISO

**Stato**: proposta pronta lato repo. Attivazione finale richiede accesso al **Dashboard Cursor**
(cursor.com), non eseguibile da un Cloud Agent — nessun agente ha credenziali/permessi di admin
sull'organizzazione Cursor.

**Fonti verificate** (13/08/2026, tramite subagent `cursor-guide` sulla documentazione ufficiale, non
per deduzione):

- [cursor.com/docs/approval-agents](https://cursor.com/docs/approval-agents) — cosa fa e come si
  configura "PR Routing & Approval"
- [cursor.com/docs/cloud-agent/automations](https://cursor.com/docs/cloud-agent/automations) — trigger
  supportati, dove si legge `APPROVAL_POLICY.md`/`ROUTING.md`
- [cursor.com/docs/cloud-agent/security](https://cursor.com/docs/cloud-agent/security) — vincolo "mai
  merge autonomo" (già citato in `sgq-git-autonomy.mdc`)
- [cursor.com/docs/models-and-pricing](https://cursor.com/docs/models-and-pricing) — disponibilità per
  piano (non incluso nel piano Start)

## Cosa fa davvero (e cosa non fa)

- Assegna reviewer in base a code ownership/commit history quando una PR viene aperta o aggiornata.
- Può **approvare** (mai mergiare) una PR a basso rischio, quando i segnali configurati lo permettono.
- Legge questi segnali: risk score, `APPROVAL_POLICY.md` (nella directory più prossima ai file
  modificati), `.cursor/approval-policies/ROUTING.md`, Bugbot Review Context, Security Review Context
  (richiede piano Team/Enterprise).
- **Non sostituisce mai una code review completa** ("It does not replace a full code review" — doc
  ufficiale) e **non mergia mai**: il merge resta sempre un click umano.

## Cosa è già pronto nel repo (questa PR)

| File | Scopo |
|---|---|
| `APPROVAL_POLICY.md` (root) | Policy di default — mai approvazione se tocca backend/migrazioni/auth/sync/normativa AI |
| `docs/APPROVAL_POLICY.md` | Basso rischio — approvazione consentita se Bugbot pulito e diff solo `docs/**` |
| `.cursor/rules/APPROVAL_POLICY.md` | Basso ma governance — mai approvare se la modifica allenta un vincolo di sicurezza |
| `backend/src/APPROVAL_POLICY.md` | Mai approvazione automatica, sempre review umana |
| `database/migrations/APPROVAL_POLICY.md` | Mai approvazione automatica, sempre review umana |
| `.cursor/approval-policies/ROUTING.md` | Routing per area |

Questi file sono **inerti** finché l'automation non viene attivata da dashboard: mergiare questa PR non
comporta nessun rischio operativo.

## Cosa devi fare tu (solo tu puoi farlo — richiede login Dashboard Cursor con permessi admin/owner)

1. Verifica il piano del team su `cursor.com/settings` → **Automations non è incluso nel piano Start**;
   serve Pro/Pro Plus/Ultra/Team/Enterprise. Se avete piano Team/Enterprise potete usare anche
   "Security Review Context" (opzionale, non richiesto da questa proposta).
2. Vai su [cursor.com/automations/from-cursor/pr-routing-and-approval](https://cursor.com/automations/from-cursor/pr-routing-and-approval).
3. Attiva **"Enable PR Routing and Requests for Review"**.
4. **Consigliato per il primo giro**: lascia **disattivato** "Automatically Approve PRs" — parti solo
   con l'assegnazione reviewer per 1–2 settimane, osserva il comportamento, poi valuta di attivare
   l'approvazione automatica solo per le aree Basso (vedi domanda 3 sotto).
5. Seleziona il repository `sistema-gestione-iso9001`.
6. Trigger da abilitare: **Pull request opened**, **Pull request pushed**, **Comment added** (per
   reagire anche a follow-up tipo `@cursor`).
7. Segnali: abilita **Bugbot Review Context**. Lascia **Security Review Context** disattivato se non
   avete piano Team/Enterprise.
8. Custom Prompt — incolla esattamente questo testo nel campo dedicato:

```text
Sei l'agente di routing/approvazione PR per ProgettoISO (SGQ ISO 9001 multi-tenant).

Criterio di rischio (fonte: .cursor/rules/sgq-git-autonomy.mdc):
- Basso: docs/**/*.md, .cursor/rules/**, fix 1-2 file frontend non sync/auth.
- Medio: backend additivo/non-breaking, migrazioni nullable/additive, nuovo campo/endpoint senza
  toccare auth/sync/schema critico.
- Alto: breaking change API/schema DB, migrazioni distruttive, auth.middleware, syncService, JWT,
  logica di compliance normativa non validata.

Regola di declassamento: se la PR tocca anche un solo file di livello Alto, tratta l'intera PR come
Alto — non spezzare artificialmente per farla rientrare nel Medio.

Comportamento richiesto:
1. Approva automaticamente SOLO se: rischio Basso secondo la tabella sopra, Bugbot Review Context
   senza rilievi critici, CI verde, diff coerente con le APPROVAL_POLICY.md nelle directory toccate.
2. Per rischio Medio: assegna reviewer, NON approvare mai automaticamente, anche se Bugbot è pulito —
   serve comunque un check umano secondo il gate documentato in sgq-git-autonomy.mdc.
3. Per rischio Alto: assegna reviewer con nota esplicita "livello Alto — richiede conferma committente
   prima del merge"; non approvare mai.
4. Se Bugbot non ha potuto eseguire (nessun context disponibile): non approvare mai, tratta come se ci
   fosse un rilievo critico.
5. Non approvare mai automaticamente PR che toccano logica normativa AI (weldingAiSuggest,
   salAiSuggest, wpsGenerator, gapAnalysis, moduleLicense) — sempre review umana, anche con diff piccolo.
6. Se una directory ha un file APPROVAL_POLICY.md, quella policy vince su questo prompt generale.
```

9. Azioni: abilita **"Request Reviewers"**. Abilita **"Approve PR"** solo se hai risposto sì alla
   domanda 3 più sotto.
10. Salva e attiva.

## Domande a cui serve una tua risposta prima di considerare la configurazione definitiva

1. **Piano Cursor del team**: Pro / Pro Plus / Team / Enterprise? (Determina se "Security Review
   Context" è disponibile — non blocca il resto.)
2. **Bugbot è già attivo come automation "always-on" sul repo**, o oggi lo invocate solo su richiesta
   tramite il subagente `bugbot` (come descritto in `sgq-git-autonomy.mdc`)? Se non è già
   un'automation attiva, va abilitata anche quella prima che "Bugbot Review Context" abbia dati reali
   da leggere — altrimenti PR Routing & Approval assegnerà solo reviewer, mai approvazione, per
   mancanza di segnale (comportamento comunque sicuro per il punto 4 del Custom Prompt).
3. **Rollout**: partire prudente (solo Request Reviewers, punto 4 sopra) o attivare da subito
   l'approvazione automatica sulle aree Basso (docs/rules)?
4. **Auto-merge nativo GitHub**: lo valutiamo in combinazione (già segnalato come opzione separata in
   `sgq-git-autonomy.mdc`, da attivare solo su richiesta esplicita), o resta fuori scope per ora?

## Dopo l'attivazione

- Aggiornare `sgq-git-autonomy.mdc` § Protocollo "pronto al click" PR con una riga che segnala che il
  routing/approvazione a basso rischio è ora automatizzato (fatto in questa stessa PR, vedi sotto).
- Monitorare per 1–2 settimane: se PR Routing & Approval assegna reviewer in modo scorretto o approva
  qualcosa che non doveva, correggere prima il `APPROVAL_POLICY.md` più vicino ai file coinvolti,
  non disattivare l'intera automation.

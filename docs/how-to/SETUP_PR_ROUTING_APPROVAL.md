# Setup PR Routing & Approval (Cursor Automations) — ProgettoISO

**Stato**: proposta pronta lato repo, guida aggiornata per **piano Ultra individuale** (confermato
13/08/2026). Attivazione finale richiede accesso al **Dashboard Cursor** (cursor.com), non eseguibile
da un Cloud Agent — nessun agente ha credenziali/permessi admin sull'account.

**Fonti verificate** (13/08/2026, tramite subagent `cursor-guide` sulla documentazione ufficiale, non
per deduzione):

- [cursor.com/docs/approval-agents](https://cursor.com/docs/approval-agents) — cosa fa e come si
  configura "PR Routing & Approval"
- [cursor.com/docs/bugbot](https://cursor.com/docs/bugbot) — setup, vincoli piano Individual, billing
- [cursor.com/docs/security-agents](https://cursor.com/docs/security-agents) — vincolo Team/Enterprise
- [cursor.com/docs/cloud-agent/automations](https://cursor.com/docs/cloud-agent/automations) — trigger,
  scope Private/Team Visible/Team Owned, dove si legge `APPROVAL_POLICY.md`/`ROUTING.md`
- [cursor.com/docs/cloud-agent/security](https://cursor.com/docs/cloud-agent/security) — vincolo "mai
  merge autonomo"
- [cursor.com/docs/integrations/github](https://cursor.com/docs/integrations/github) — permessi GitHub
  App (Administration in sola lettura)
- [cursor.com/help/account-and-billing/bugbot-usage-based-billing](https://cursor.com/help/account-and-billing/bugbot-usage-based-billing) — costo per run

## Piano confermato: Ultra ($200/mo, individuale)

Compatibile con tutto il necessario, con **tre differenze concrete** rispetto a un piano Team che
cambiano come va configurato (non solo "costa meno"):

| Aspetto | Su Ultra (individuale) | Su Team/Enterprise |
|---|---|---|
| PR Routing & Approval | Solo scope **Private** (nessun "Team Visible"/"Team Owned" — questi richiedono un'organizzazione Cursor con più membri) | Anche condiviso con service account team |
| Bugbot | **"Runs only on PRs you author"** — vedi rischio sotto | Gira su tutte le PR di tutti i contributor del repo |
| Security Review Context | **Non disponibile** (richiede Team/Enterprise, billing a pool team) | Disponibile |

Nessuna di queste è bloccante per l'obiettivo (routing/approvazione automatica su PR a basso rischio),
ma la seconda richiede una verifica pratica prima di fidarsi del meccanismo.

## Rischio da verificare per primo: Bugbot "solo PR che autori tu"

**Testo esatto della doc**: *"Bugbot runs only on PRs you author"* (piano Individual).

Le PR di questa proposta sono aperte da **Cloud Agent** tramite la GitHub App di Cursor collegata al
tuo account. Non è documentato in modo esplicito se Cursor attribuisce quelle PR a te (come titolare
dell'account che ha lanciato l'agente) o a un'identità bot separata — se fosse la seconda, Bugbot
**non** girerebbe automaticamente su quelle PR con un piano Individual, e "Bugbot Review Context" nel
Custom Prompt di PR Routing & Approval resterebbe sempre vuoto (comportamento comunque sicuro: il
prompt tratta "nessun segnale" come rilievo critico, quindi non approva mai — ma perderesti il
beneficio di velocità).

**Verifica pratica da fare tu** (5 minuti, dopo aver abilitato Bugbot — punto 2 sotto): apri o aggiorna
una PR creata da Cloud Agent (es. proprio questa, [#402](../../.)) e controlla se compare il check
`Cursor Bugbot` / un commento di review automatico entro qualche minuto, **senza** che tu scriva
`bugbot run` a mano. Se compare → tutto funziona come previsto. Se non compare dopo ~10 minuti → il
meccanismo non gira automaticamente sulle PR dei Cloud Agent col tuo piano, e serve il fallback: fai
commentare `bugbot run` (o `cursor review`) all'agente stesso come ultimo passo prima di chiedere la
tua revisione — un passo in più ma ancora molto meno lavoro del gate manuale attuale.

## Costo (usage-based billing, dati reali non stimati)

- Ogni run Bugbot costa in media **$1.00–$1.50**, secondo dimensione/complessità della PR.
- Consuma prima l'usage incluso nel piano Ultra, poi l'on-demand usage se abilitato; **se l'on-demand è
  disabilitato, Bugbot si ferma finché non rinnovi il ciclo di fatturazione** (non fallisce in modo
  silenzioso, semplicemente non gira più).
- Monitora il consumo reale su `cursor.com/dashboard/spending` dopo la prima settimana.
- Se il costo preoccupa, puoi impostare Bugbot su "**Run only when mentioned**" invece di automatico —
  perdi la parte "always-on" ma tieni il controllo del costo per PR.

## Cosa fa davvero PR Routing & Approval (e cosa non fa)

- Assegna reviewer in base a code ownership/commit history quando una PR viene aperta o aggiornata.
- Può **approvare** (mai mergiare) una PR a basso rischio, quando i segnali configurati lo permettono.
- Legge questi segnali: risk score, `APPROVAL_POLICY.md` (nella directory più prossima ai file
  modificati), `.cursor/approval-policies/ROUTING.md`, Bugbot Review Context.
- **Non sostituisce mai una code review completa** ("It does not replace a full code review" — doc
  ufficiale) e **non mergia mai**: il merge resta sempre un click umano.

## Cosa è già pronto nel repo

| File | Scopo |
|---|---|
| `APPROVAL_POLICY.md` (root) | Fallback finale — **deny-by-default**, mai approvazione automatica |
| `docs/APPROVAL_POLICY.md` | Basso rischio — approvazione consentita se Bugbot pulito e diff solo `docs/**` |
| `.cursor/rules/APPROVAL_POLICY.md` | Basso ma governance — mai approvare se la modifica allenta un vincolo di sicurezza |
| `app/src/APPROVAL_POLICY.md` | Basso rischio ristretto — mai fuori da componenti/hook condivisi |
| `backend/src/APPROVAL_POLICY.md` | Mai approvazione automatica, sempre review umana |
| `database/migrations/APPROVAL_POLICY.md` | Mai approvazione automatica, sempre review umana |
| `.cursor/approval-policies/ROUTING.md` | Routing per area — **YAML** (`product`/`boundary`/`policies`) |
| `.cursor/BUGBOT.md` | Regole custom Bugbot allineate a `sgq-operating-memory.mdc`/`sgq-git-autonomy.mdc` (multi-tenant, human-in-the-loop AI, encoding, migrazioni idempotenti) |

Questi file sono **inerti** finché Bugbot e l'automation non vengono attivati da dashboard: mergiare
questa PR non comporta nessun rischio operativo né costo.

## Validazione reale (13/08/2026) — il meccanismo ha già trovato 2 problemi veri

La PR che ha introdotto la prima versione di questi file ([#402](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/402)) è stata rivista **automaticamente** da Bugbot, Security Reviewer e PR Routing & Approval non appena il committente ha attivato Bugbot da dashboard — senza invocare nulla a mano. Bugbot ha trovato 2 problemi reali nei file appena scritti:

1. **High Severity**: la policy di default (root) approvava automaticamente qualunque diff ≤2 file fuori da una denylist — path come `backend/scripts/**` o `.github/workflows/**`, senza policy dedicata, ci sarebbero passati senza controllo. **Corretto**: il fallback root è ora deny-by-default (mai approvazione), con `app/src/APPROVAL_POLICY.md` dedicato per isolare la regola Basso del frontend.
2. **Medium Severity**: `ROUTING.md` era scritto come tabella Markdown, ma lo schema documentato ufficialmente è **YAML** (`product`/`boundary`/`policies`) — verificato indipendentemente sulla doc ufficiale prima di correggere, non solo sulla parola di Bugbot. **Corretto**: convertito in YAML.

Questo conferma due cose insieme: (a) il meccanismo automatico funziona ed è già intervenuto utilmente al primo giro reale; (b) la revisione resta necessaria anche su contenuti "solo policy" — un buco logico o un errore di schema non si vede leggendo il Markdown, si vede solo con uno strumento che lo confronta con lo schema reale.

## Cosa devi fare tu — ordine consigliato (Bugbot prima, poi il routing)

### Passo 1 — Attiva Bugbot (serve come input per il passo 2)

1. Collega il repo su `cursor.com/dashboard/integrations` se non è già collegato.
2. Vai su [cursor.com/automations/from-cursor/bugbot](https://cursor.com/automations/from-cursor/bugbot).
3. Abilita Bugbot sul repository `sistema-gestione-iso9001` (lascia **disattivato** "Run only when
   mentioned" per avere il comportamento always-on di default — attivalo dopo se il costo preoccupa).
4. Fai la verifica pratica descritta sopra (PR Cloud Agent → Bugbot gira da solo?).

### Passo 2 — Attiva PR Routing & Approval

1. Vai su [cursor.com/automations/from-cursor/pr-routing-and-approval](https://cursor.com/automations/from-cursor/pr-routing-and-approval).
2. Attiva **"Enable PR Routing and Requests for Review"**. Scope: resterà **Private** (unica opzione
   su piano individuale — nessuna perdita funzionale per un solo operatore).
3. **Consigliato per il primo giro**: lascia **disattivato** "Automatically Approve PRs" — parti solo
   con l'assegnazione reviewer per 1–2 settimane, osserva il comportamento, poi valuta di attivare
   l'approvazione automatica solo per le aree Basso (vedi domanda 2 sotto).
4. Seleziona il repository `sistema-gestione-iso9001`.
5. Trigger da abilitare: **Pull request opened**, **Pull request pushed**, **Comment added**.
6. Segnali: abilita **Bugbot Review Context**. Lascia **Security Review Context** disattivato — non
   disponibile sul piano Ultra individuale (richiede Team/Enterprise, confermato).
7. Custom Prompt — incolla esattamente questo testo nel campo dedicato:

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

8. Azioni: abilita **"Request Reviewers"**. Abilita **"Approve PR"** solo se hai risposto sì alla
   domanda 2 più sotto.
9. Salva e attiva.

## Domande residue (dopo la tua risposta "Ultra")

1. ~~Piano Cursor~~ → **Risposto: Ultra.** Compatibile, con i vincoli sopra.
2. **Rollout**: partire prudente (solo Request Reviewers) o attivare da subito l'approvazione
   automatica sulle aree Basso (docs/rules)?
3. **Auto-merge nativo GitHub** in combinazione: lo valutiamo ora o resta fuori scope per ora?
4. **Costo**: vuoi Bugbot sempre-attivo (~$1–1.5/PR, consuma usage Ultra) o preferisci "Run only when
   mentioned" per tenere il controllo manuale del costo, accettando un passo in più per PR?

## Dopo l'attivazione

- Fai la verifica pratica sul primo punto (Bugbot gira da solo su PR Cloud Agent?) e riportamela: se il
  meccanismo non gira in automatico, aggiorno il workflow dei deputy per far commentare `bugbot run`
  come ultimo passo prima di segnalare la PR pronta.
- Monitora per 1–2 settimane: se PR Routing & Approval assegna reviewer in modo scorretto o approva
  qualcosa che non doveva, correggere prima il `APPROVAL_POLICY.md` più vicino ai file coinvolti, non
  disattivare l'intera automation.
- Controlla `cursor.com/dashboard/spending` dopo la prima settimana per il costo reale Bugbot.

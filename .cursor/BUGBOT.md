# Regole custom Bugbot — ProgettoISO

> Letto da Bugbot durante la code review automatica su ogni PR. Non sostituisce le regole agente in
> `.cursor/rules/**` (quelle guidano chi scrive il codice) — questo file guida chi lo **rilegge**.
> Fonte dei criteri: [`sgq-operating-memory.mdc`](rules/sgq-operating-memory.mdc) e
> [`sgq-git-autonomy.mdc`](rules/sgq-git-autonomy.mdc).

## Multi-tenant (bloccante)

- Segnala come critico qualsiasi query SQL su tabelle applicative senza filtro `organization_id` o
  scope equivalente (`company_access`), salvo tabelle esplicitamente globali (es. `standards`,
  `norm_*` di riferimento condiviso).
- Segnala se un nuovo endpoint API non applica RBAC/`company_access` già in uso altrove nello stesso
  controller.

## Human-in-the-loop AI (bloccante)

- Segnala come critico qualsiasi scrittura automatica (senza conferma utente esplicita) di output AI
  su dati normativi/di conformità (es. `weldingAiSuggest.service.js`, `salAiSuggest.service.js`,
  `wpsGenerator.service.js`, `gapAnalysis*`, moduli ADR-010/ADR-018/ADR-019/ADR-024) — il pattern
  richiesto è sempre "propone, l'utente conferma/modifica/rifiuta" (`AiDisclaimer` + azione esplicita).

## Migrazioni DB (bloccante)

- Segnala come critico un file in `database/migrations/**` che non sia idempotente (manca
  `IF NOT EXISTS` / controllo esistenza colonna-tabella prima di `ALTER`/`CREATE`).
- Segnala `ON DELETE CASCADE` su foreign key SQL Server (pattern vietato in questo progetto — vedi
  `sgq-operating-memory.mdc` § Migrazioni DB).
- Segnala se manca il corrispondente script `run-migration-<N>-vps.js` per una nuova migrazione.

## Encoding e qualità testo (non bloccante ma da segnalare)

- Segnala testo italiano con apostrofo al posto dell'accento (es. "qualita'" invece di "qualità") in
  stringhe UI visibili all'utente.
- Segnala escape `\uXXXX` usati come testo JSX letterale invece che dentro un'espressione stringa JS
  (rischio: il carattere non viene decodificato e finisce a schermo così com'è).

## Sicurezza (bloccante)

- Segnala segreti/credenziali in chiaro nel diff (password, token, chiavi API, connection string).
- Segnala `console.log`/log di debug lasciati in file di produzione (`backend/src/controllers/**`,
  `backend/src/services/**`) fuori da blocchi già marcati come debug temporaneo.

## Riuso UI (non bloccante ma da segnalare)

- Segnala markup/CSS duplicato per pattern già coperti da componenti esistenti: `status-btn`,
  `notes-textarea`, `QuestionCard.jsx`, `AttachmentSection.jsx`, `AiDisclaimer.jsx` (vedi
  `docs/reference/LIBRERIA_UI_SGQ.md`).

## Cosa NON segnalare

- Stile/formattazione già gestito da linter/build automatici.
- Assenza di test su file di sola documentazione o su `APPROVAL_POLICY.md`/`ROUTING.md` (nessuna logica
  eseguibile).

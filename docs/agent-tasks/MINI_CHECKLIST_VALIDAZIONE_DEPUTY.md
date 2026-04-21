# Mini checklist — validazione output deputy

> Uso rapido (5 minuti) prima di considerare "chiuso" un task svolto da deputy.
> Obiettivo: evitare regressioni su deploy, documentazione e allineamento roadmap/guida.

---

## 1) Coerenza con brief e scope

- [ ] Il deputy ha rispettato il file task di riferimento in `docs/agent-tasks/` (scope + DoD + vincoli).
- [ ] Non ha introdotto attività fuori scope senza nota esplicita (es. refactor ampio non richiesto).
- [ ] Il linguaggio e le istruzioni sono comprensibili per uso operativo (niente passaggi impliciti).

## 2) Deploy e operatività VPS

- [ ] Se il task tocca backend, è scritto chiaramente che il VPS è **copia file** (non clone Git).
- [ ] Le istruzioni usano `backend/scripts/deploy-controllers-to-vps.ps1` + restart `sgq-backend`.
- [ ] Non ci sono frasi fuorvianti tipo "basta git pull sul server" per applicare il fix.
- [ ] Se coinvolto RBAC/auth audit list, è menzionato anche `src/middleware/auth.middleware.js`.

## 3) Allineamento documenti ufficiali

- [ ] Aggiornati i documenti corretti: `PROJECT_CONTEXT.md`, `docs/PROJECT_ROADMAP.md`, `docs/GUIDA_CONSOLIDATA.md` (se necessario anche `docs/BACKEND_API.md` / `docs/ARCHITETTURA_UTENTI_RBAC.md`).
- [ ] Nessun nuovo `SESSION_NOTES_*` operativo creato.
- [ ] "Prossimo step" roadmap resta coerente con lo stato reale del lavoro.

## 4) Verifiche e rischi residui

- [ ] Sono indicati test/smoke minimi ripetibili (L1 automatico + eventuale L3 manuale).
- [ ] Ogni rischio residuo è dichiarato in chiaro (es. "richiede deploy VPS", "smoke umano da fare").
- [ ] Se manca un passaggio bloccante, è scritto cosa fare e dove farlo.

## 5) Sicurezza e igiene repo

- [ ] Nessun segreto in markdown/commit/chat (password, token, chiavi).
- [ ] Nessuna istruzione che richiede di incollare credenziali in chiaro.
- [ ] Eventuali file locali sensibili sono indicati come gitignored (es. `.ssh-deploy.local.ps1`).

## 6) Follow-up obbligatorio: fix + smoke in loop

- [ ] Ogni anomalia **applicabile** trovata in review viene corretta subito (fix minimo, niente refactor extra).
- [ ] Dopo ogni fix si rilanciano i test/smoke pertinenti (L1 e/o L3 in base al task).
- [ ] Si ripete il ciclo **review -> fix -> smoke** finché:
  - esito positivo completo, **oppure**
  - restano solo fix **non applicabili** (es. dipendenze esterne, credenziali umane, vincoli ambiente).
- [ ] I fix non applicabili sono elencati con motivo chiaro e prossimo passo operativo.

---

## Esito finale (da compilare)

- **Stato**: [ ] APPROVATO  [ ] APPROVATO CON RISERVA  [ ] NON APPROVATO
- **Output univoco obbligatorio** (scegliere una sola forma):
  - `TEST OK`
  - `FIX NON APPLICABILI: <elenco puntuale + motivazione>`
- **Correzioni richieste**: ...
- **Note operative per prossima sessione**: ...

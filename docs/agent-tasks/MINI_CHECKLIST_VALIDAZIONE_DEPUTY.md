# Mini checklist — validazione output deputy

> Uso rapido (5 minuti) prima di considerare "chiuso" un task svolto da deputy.
> Obiettivo: evitare regressioni su deploy, documentazione e allineamento roadmap/guida.

---

## Esito task: Hardening harness doppio HK-1..HK-10 (30/06/2026)

**Stato**: ✅ APPROVATO

**Output**: `TEST OK`

### Checklist compilata

#### 1) Coerenza con brief e scope
- [x] Tutte le 10 slice HK-1..HK-10 completate (vedi tabella DEPUTYTASK.md).
- [x] Nessuna attività fuori scope: ogni commit atomico rispetta la slice.
- [x] FIX NON APPLICABILI documentati:
  - HK-5 `/ai/feedback`: non è una chiamata AI → non aggiunto `logAiInteraction` (feedback già tracciato in `ai_feedback`).
  - HK-7 `norm_access_log`: table non esiste ancora su VPS → inserita con graceful degradation, richiede migrazione DB separata.

#### 2) Deploy e operatività VPS
- [x] HK non richiede deploy VPS (solo codice JS/JSX committato su branch).
- [x] Backend modificato va deployato con `deploy-controllers-to-vps.ps1` + restart `sgq-backend` dal desktop.
- [x] Migrazione DB pendente: tabella `norm_access_log` (colonne: `id`, `organization_id`, `standard_code`, `source`, `created_at`).

#### 3) Allineamento documenti
- [x] `docs/GUIDA_CONSOLIDATA.md`: nuova sezione "Harness agentico AI" con lezioni HK.
- [x] `docs/adr/ADR-010`: aggiunta sezione "Stato implementazione 2026-06".
- [x] `docs/adr/ADR-015`: creato (Lead/Deputy workflow).
- [x] `PROJECT_CONTEXT.md`: aggiunto "Harness agentico".
- [x] Nessun `SESSION_NOTES_*` creato.

#### 4) Verifiche e rischi residui
- [x] Test L1 backend: 11/11 (aiAuditTrail x4, normBroker x4, gapAnalysis x3).
- [x] Build Vite frontend: verde su tutte le slice che toccano app/.
- [x] Encoding check: OK sui file .mdc/.md toccati.
- [ ] Smoke L3 manuale su VPS: non eseguito (deploy non richiesto in questo task).
- Rischio residuo: `norm_access_log` — se la tabella non esiste in prod, le insert falliscono silenziosamente (warn + continua).

#### 5) Sicurezza e igiene repo
- [x] Nessun segreto in commit/chat.
- [x] File script temporanei `tmp_hk4_*.py` da pulire (non commit).

#### 6) Follow-up obbligatorio
- [x] Tutti i fix rilevati durante il lavoro sono stati corretti (quote JS, template literal rotte).
- FIX NON APPLICABILI: `/ai/feedback` audit trail; `norm_access_log` table on VPS.

---

## Prossimi passi operativi

1. **Deploy VPS backend** (da desktop): `.\backend\scripts\deploy-controllers-to-vps.ps1` + restart.
2. **Migrazione DB VPS** `norm_access_log`:
   ```sql
   CREATE TABLE norm_access_log (
     id INT IDENTITY(1,1) PRIMARY KEY,
     organization_id INT NOT NULL DEFAULT 0,
     standard_code NVARCHAR(100) NOT NULL,
     source NVARCHAR(50) NOT NULL,
     created_at DATETIME2 NOT NULL DEFAULT GETDATE()
   );
   ```
3. **PR verso `main`**: aprire PR da branch `cursor/harness-hardening-hk-6b60`, verificare CI, fare merge.

---

## Checklist generica (vuota per usi futuri)

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

- [ ] Aggiornati i documenti corretti: `PROJECT_CONTEXT.md`, `docs/PROJECT_ROADMAP.md`, `docs/GUIDA_CONSOLIDATA.md`.
- [ ] Nessun nuovo `SESSION_NOTES_*` operativo creato.
- [ ] "Prossimo step" roadmap resta coerente con lo stato reale del lavoro.

## 4) Verifiche e rischi residui

- [ ] Sono indicati test/smoke minimi ripetibili (L1 automatico + eventuale L3 manuale).
- [ ] Ogni rischio residuo è dichiarato in chiaro.
- [ ] Se manca un passaggio bloccante, è scritto cosa fare e dove farlo.

## 5) Sicurezza e igiene repo

- [ ] Nessun segreto in markdown/commit/chat.
- [ ] Nessuna istruzione che richiede di incollare credenziali in chiaro.
- [ ] Eventuali file locali sensibili sono indicati come gitignored.

## 6) Follow-up obbligatorio: fix + smoke in loop

- [ ] Ogni anomalia **applicabile** trovata in review viene corretta subito.
- [ ] Dopo ogni fix si rilanciano i test/smoke pertinenti.
- [ ] I fix non applicabili sono elencati con motivo chiaro e prossimo passo operativo.

## 7) Branch PR allineato (no «Update branch»)

- [ ] Branch allineato a `origin/main` (merge fatto **ora**, prima dell'ultimo push/PR) — vedi `sgq-git-autonomy.mdc` § Aggiornare il branch.

---

## Esito finale (da compilare)

- **Stato**: [ ] APPROVATO  [ ] APPROVATO CON RISERVA  [ ] NON APPROVATO
- **Output univoco obbligatorio** (scegliere una sola forma):
  - `TEST OK`
  - `FIX NON APPLICABILI: <elenco puntuale + motivazione>`
- **Correzioni richieste**: ...
- **Note operative per prossima sessione**: ...

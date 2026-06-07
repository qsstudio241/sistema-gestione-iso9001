# DEPUTYTASK — Riorganizzazione profonda documentazione + triage PR (07/06/2026)

**Stato:** IN REVISIONE (PR aperta) — branch `docs/reorg-knowledge-base`

**Task:** Riorganizzazione profonda della knowledge base (solo documentazione/regole, **nessun codice applicativo**), eseguita in **worktree isolato** su disco locale `C:` da `origin/main` aggiornato (HEAD `9e6dae6`) per **non** toccare la WIP del committente nel working tree principale (Google Drive). Risultato su branch dedicato + **PR da rivedere** (overlap con WIP docs del committente).

## Cosa è stato fatto
- **Lezioni apprese consolidate (fonte unica)**: nuova sezione in `docs/GUIDA_CONSOLIDATA.md` con tabella regole + link al dettaglio (form annidati, isolamento AI multi-tenant, notifiche NC + escalation, fix `studioScopeClause`, encoding UTF-8, worktree su `C:`, `gh`→MCP GitHub, numerazione migrazioni, sync ADR-008).
- **Metodo di lavoro codificato**: nuova regola `.cursor/rules/sgq-workflow-method.mdc` (slice verticali, multitasking sicuro, worktree isolati, una sola op git pesante per repo, triage PR backlog, sequenza migrazioni, encoding).
- **Backlog parcheggiato (fonte unica)**: nuova sezione in `docs/PROJECT_ROADMAP.md` (include #10 P.IVA/logo dopo billing 082, requisito verbale audit, T6, token Word, doc Fase 3c–3f).
- **Encoding bonificato** in `GUIDA_CONSOLIDATA.md`: rimossi 8 caratteri di controllo (`\a`/`\v`/`\f`/NUL che mangiavano la lettera iniziale) e ripristinate le parole (`admin`, `verified`, `approved_at/by`, `verification_note`, hash commit). Mantenuto l'unico `U+FFFD` voluto nel playbook caratteri.
- **Indice**: aggiornati `GUIDA` (TOC) e `INDICE_DOCUMENTAZIONE.md` con i nuovi ingressi.

## Triage PR
- **PR #31** (perf sync debounce + Word page break): **CHIUSA** via MCP GitHub — superata in tutte le parti (sync coperto da ADR-008/T2–T5; page break Word già rimossi; lezioni già in guida/regole). Commento dettagliato pubblicato.
- **PR #10** (settings org P.IVA + logo): **resta APERTA** — commentata come **parcheggiata** (ripresa dopo stabilizzazione billing 082). Registrata nel backlog roadmap.

## Verifica
- Encoding: 0 caratteri di controllo residui; nessun BOM; accenti italiani corretti.
- Link interni nuovi verificati; nessun file spostato (struttura cartelle invariata) → nessun anchor rotto.
- Nessuna modifica a codice `app/` o `backend/`.

## Passi manuali per il committente
1. Sistemare la propria **WIP docs** nel working tree principale, poi rivedere e **mergiare la PR** `docs/reorg-knowledge-base` quando non c'è più overlap.
2. `git pull origin main` dopo il merge.

---

## Task futuro pendente — Caricamento verbale di audit con revisione = numeratore audit

**Origine:** chiusura **PR #52** (07/06/2026). L'automatismo audit-close → `document_registry` (ADR-009 Fase 5) **non** è desiderato: il report Word esportato deve restare **modificabile** e **caricato manualmente** nell'albero. Tracciato anche in [PROJECT_ROADMAP.md § Backlog parcheggiato](../PROJECT_ROADMAP.md#backlog-parcheggiato-task-futuri--fonte-unica).

- Tipo documento dedicato **"Verbale di audit"** nella cartella **12 AUDIT**.
- Al caricamento: selezione audit → `revision = audit.audit_number` (formato `PREFISSO-YYMMDD-NN`); campo revisione **read-only**.
- Opzionale: riconoscimento audit dal nome file export (`{Cliente}_{NumeroAudit}_{Standard}.docx`, trattini resi come underscore).
- Note tecniche: `document_registry.revision` è `NVARCHAR(20)` → valutare allargamento colonna (numeri audit fino a ~26 char); nessuna FK audit → salvare `audit_id`/`audit_number` in `type_specific_data`.


---

## Esito sessione 07/06/2026 - CHIUSA

**Sessione chiusa il 07/06/2026.** main locale = origin/main = `9e6dae6` (allineato, nessun pull necessario). Tutte le PR di sessione gia' mergiate/chiuse; restano aperte SOLO:
- **#98** (questa, docs reorg): DRAFT, lasciata per **review umana** del committente per overlap con la sua WIP docs locale non committata.
- **#10** (settings org P.IVA/logo): **parcheggiata** in backlog, ripresa dopo stabilizzazione billing 082.

**Working tree principale e WIP del committente NON toccati** (nessun commit/stash/pull su main; lavoro solo su branch docs reorg via API).

**Azioni manuali del committente al rientro (in ordine):**
1. Sistemare/committare la WIP docs nel working tree principale.
2. Rivedere e mergiare la PR #98 (`docs/reorg-knowledge-base`).
3. `git pull origin main`.
4. Valutare #10 dopo stabilizzazione billing 082.

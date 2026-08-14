# DEPUTYTASK — Rischi / Opportunità / Obiettivi — ROO-4 (origine §4.1/§4.2)

**Stato:** APERTO  
**Priorità:** P1 — chiude la catena ISO 6.1.1 (i rischi devono derivare da contesto e parti)  
**Branch base:** `main`  
**Slice:** ROO-4  
**Creato da:** Lead 14/08/2026 (wayfinder-sgq, sessione mappa — non eseguire altre slice)  
**Piano:** [PLAN_RISCHI_OPPORTUNITA_OBIETTIVI_SLICES.md](PLAN_RISCHI_OPPORTUNITA_OBIETTIVI_SLICES.md)

> **Allineamento Git (autonomo)**: prima di leggere questo brief eseguire `git fetch origin main` e `git pull origin main` (o partire da `origin/main` aggiornato). **Non** chiedere al committente di farlo.

---

## Contesto (leggere prima)

Il modulo è **già in produzione**: CRUD rischi/opportunità (`nature`), obiettivi, tab Contesto (`context_factors` + `interested_parties`), pulsante manuale verso Piano Azioni. Le slice 1–3 (PR #279) sono chiuse.

**Manca la traccia normativa**: `risks` ha solo un enum `context` (`internal`|`external`|`interested_party`) — nessun FK verso le righe §4.1/§4.2. L'auditor non può vedere *da quale fattore o parte* nasce il rischio.

Questa slice è il hello-world della catena. **Non** toccare trattamenti opportunità (ROO-5), auto-azioni (ROO-6), obiettivi (ROO-8).

`DEPUTYTASK.md` resta il brief **profilo azienda** (ADR-018) — non sovrascriverlo.

## Cosa NON toccare

- `docs/agent-tasks/DEPUTYTASK.md` e brief Material Compliance.
- CHECK `treatment` su `risks` (ROO-5).
- `nc.controller.js` / `NcCreateModal` / `source_risk_id` (ROO-6).
- Schema `objectives` (ROO-8).
- Sync / IndexedDB / ADR-008.
- `backend/database/migrations/` (cartella morta). Non riservare un numero di migrazione in questo brief.

## Slice ROO-4 — Origine 4.1/4.2 sul rischio

### File previsti

- `database/migrations/NNN_risks_origin_context.sql` — **NNN = prossimo libero** (`ls database/migrations/ | sort | tail -5` al momento dell'esecuzione; oggi ultimo noto `145`)
- `backend/scripts/run-migration-NNN-vps.js` (pattern cloud: SQL inline + `require` database VPS)
- `backend/src/controllers/risks.controller.js` (create / update / list / getOne)
- `app/src/pages/RisksPage.jsx` (form + card + azione «Deriva da» sul tab Contesto)
- Test L1: `backend/src/controllers/risks.controller.test.js` (nuovo) e/o Vitest mirato se si estrae un helper puro

Nessun file controller/route nuovo → `deploy-manifest.json` invariato, salvo verifica.

### Schema

Su `risks`, colonne **opzionali** (idempotenti, senza `ON DELETE CASCADE` fragile):

- `context_factor_id INT NULL`
- `interested_party_id INT NULL`

Vincolo applicativo (non CHECK DB): al più **una** delle due valorizzata. Se arrivano entrambe → 400.

Niente FK SQL Server verso le tabelle origine (pattern progetto: colonne INT senza `REFERENCES`). Validare in controller: la riga esiste, stesso `organization_id`, e se il rischio ha `company_id` l'origine è della stessa azienda **oppure** `company_id` origine NULL.

### API

- `POST/PUT /risks` accettano `context_factor_id` / `interested_party_id` (null per slegare).
- `GET /risks` e `GET /risks/:id` restituiscono anche `context_factor_description`, `interested_party_name` (LEFT JOIN).
- Se si imposta un'origine, allineare `context` se assente: fattore `internal`/`external` → stesso valore; parte → `interested_party`. Non sovrascrivere un `context` già scelto dall'utente.

### UI

1. Nel form rischio: due select (fattori attivi / parti attive) filtrati per ambito azienda del form; mutua esclusione.
2. Sulla card: badge «Da contesto: …» o «Da parte: …» se l'origine c'è.
3. Tab Contesto: pulsante **«Deriva rischio/opportunità»** su ogni fattore e ogni parte — apre `RiskForm` con origine e `context` precompilati, `company_id` ereditato.

Riuso classi esistenti (`risk-form`, `nature-badge`, `risk-cat`). Nessun CSS parallelo salvo una classe badge minima in `RisksPage.css` se serve.

Ambito: `useCompanyScope()` è già cablato — **non** aggiungere un secondo selettore in pagina. I picker origine filtrano per `filterCompany` dell'header.

### DoD

- [ ] Migration applicabile due volte senza errore (TEST VPS prima, pattern `run-migration-NNN-test-vps.js` / deploy test).
- [ ] Creare un rischio da un fattore: persistenza + badge in lista.
- [ ] Creare un'opportunità da una parte: stesso percorso, `nature=opportunity`.
- [ ] 400 se entrambe le FK; 404/400 se origine di altro tenant.
- [ ] Test L1 verdi; `npm run build` se si tocca `app/`.
- [ ] Aggiornare il PLAN: spuntare DoD ROO-4, gist in «Decisioni già prese».

### Test L1

- Jest: create con `context_factor_id` valido; reject cross-org; reject entrambe le FK.
- Build Vite se JSX toccato.

## Parallelismo

ROO-5 (trattamenti) tocca lo stesso `RisksPage.jsx` + CHECK `treatment` — **non** parallelizzare con ROO-4. ROO-10 (RBAC objectives) è su file disgiunti e può andare in `DEPUTYTASK2.md` solo se un secondo deputy parte dopo il merge di ROO-4 o su perimetro davvero disgiunto (`risks.controller.js` è condiviso: evitare).

# DEPUTYTASK — Rischi / Opportunità / Obiettivi — ROO-4 (riga di analisi M03)

**Stato:** APERTO  
**Priorità:** P1 — il record `risks` deve poter essere una riga M03, non solo un titolo + enum  
**Branch base:** `main`  
**Slice:** ROO-4  
**Creato da:** Lead 14/08/2026 (wayfinder-sgq, **secondo** passaggio: processo → CRUD → gap)  
**Piano:** [PLAN_RISCHI_OPPORTUNITA_OBIETTIVI_SLICES.md](PLAN_RISCHI_OPPORTUNITA_OBIETTIVI_SLICES.md)  
**Spec:** [M03_ANALISI_RISCHI_OPPORTUNITA.md](../specs/M03_ANALISI_RISCHI_OPPORTUNITA.md)

> **Allineamento Git (autonomo)**: `git fetch origin main` e partire da `origin/main` aggiornato. **Non** chiedere al committente di farlo.

---

## Contesto (leggere prima)

Il draft studio **M03-R00** è una matrice: elemento → contesto → parti → azioni attuali → P×G → ulteriori azioni → residuo. L'app ha quattro tab CRUD. La prima mappa wayfinder (FK catalogo→rischio) è **superata**.

Questa slice rende visibile **una riga M03** sul record `risks` già esistente. Non ingest (ROO-6). Non score residuo / scala 1–4 (ROO-5, ROO-13). Non FK cataloghi (ROO-8).

`DEPUTYTASK.md` resta il brief profilo azienda — non sovrascriverlo.

## Cosa NON toccare

- `docs/agent-tasks/DEPUTYTASK.md` e brief Material Compliance.
- CHECK `probability`/`impact` (restano 1–3) e CHECK `treatment`.
- `nc.controller.js` / `NcCreateModal` / `source_risk_id`.
- Schema `objectives`.
- Tabelle `context_factors` / `interested_parties` (niente FK nuove).
- Sync / ADR-008.
- `backend/database/migrations/` (cartella morta). Non riservare un numero di migrazione qui.

## Slice ROO-4 — Campi riga M03

### File previsti

- `database/migrations/NNN_risks_m03_line.sql` — **NNN = prossimo libero** (`ls database/migrations/ | sort | tail -5` all'esecuzione)
- `backend/scripts/run-migration-NNN-vps.js`
- `backend/src/controllers/risks.controller.js` (create / update / list / getOne)
- `app/src/pages/RisksPage.jsx` (form + card, ordine colonne M03)
- Test L1: `backend/src/controllers/risks.controller.test.js` (nuovo) e `npm run build` se si tocca JSX

Nessun controller/route nuovo → `deploy-manifest.json` invariato, salvo verifica.

### Schema (opzionali, idempotenti, niente `ON DELETE CASCADE`)

Su `risks`:

| Colonna | Tipo | Excel |
|---------|------|-------|
| `evaluated_element` | NVARCHAR(200) NULL | Elemento valutato |
| `context_text` | NVARCHAR(MAX) NULL | Contesto |
| `interested_parties_text` | NVARCHAR(MAX) NULL | Parti interessate |
| `current_actions` | NVARCHAR(MAX) NULL | Azioni attuali |
| `further_actions` | NVARCHAR(MAX) NULL | Possibili ulteriori azioni |

Non migrare `treatment_desc` in `further_actions` (niente backfill obbligatorio). Se `further_actions` è vuoto e `treatment_desc` è pieno, la UI può mostrare `treatment_desc` come fallback in lettura.

### API

- POST/PUT accettano i cinque campi (stringa o null).
- GET lista/dettaglio li restituiscono.
- Validazione: `title` resta obbligatorio (titolo del rischio/opportunità sulla riga). `evaluated_element` opzionale.

### UI

Ordine del form allineato a M03: Elemento valutato → Titolo → Natura → Contesto (testo) → Parti interessate (testo) → Azioni attuali → P/G esistenti → Ulteriori azioni → responsabile / data revisione già presenti.

Sulla card: mostrare elemento (se c'è) sopra il titolo; contesto/parti/azioni come righe corte, non solo `description`.

**Non** aggiungere selettore ambito di pagina (`useCompanyScope` già cablato).  
**Non** togliere l'enum `context` in questa slice (deprecato di fatto; ROO-8/9).  
Riuso classi `risk-form` / `risk-card`. Nessun look nuovo.

### DoD

- [ ] Migration idempotente, prima su TEST VPS.
- [ ] Creare un rischio con i cinque campi: persistono e si vedono in lista.
- [ ] Record esistenti senza i nuovi campi: form e lista restano usabili.
- [ ] Test L1 + build se JSX toccato.
- [ ] Aggiornare il PLAN: gist in «Decisioni già prese».

### Test L1

- Jest: create con i nuovi campi; update parziale; lista include le colonne.
- `npm run build` se si tocca `app/`.

## Parallelismo

ROO-5/6/7/9 toccano gli stessi file — **non** parallelizzare. ROO-11 (solo objectives RBAC) è l'unico perimetro disgiunto, e solo se non si apre `risks.controller.js`.

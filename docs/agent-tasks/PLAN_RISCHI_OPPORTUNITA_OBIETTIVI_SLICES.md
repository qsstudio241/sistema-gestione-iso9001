# Piano slice — Rischi, Opportunità e Obiettivi

> **Destinazione**: il modulo è un **pacchetto evidenze** ISO 9001 §4.1 → §4.2 → §6.1 → §6.2 (e input §9.3): dal contesto e dalle parti interessate si derivano rischi/opportunità con trattamento adatto, le azioni sono tracciate e se ne valuta l'efficacia, gli obiettivi hanno piano 6.2.2 e origine visibile.
> **Spec / norma**: [ISO 9001:2015 §4.1–4.2, §6.1–6.2](../Normative/UNI%20EN%20ISO%209001_2015%20Rev.%200.md) · Quaderno 3 *Risk Based Thinking* · skill `gap-analysis-normativa`
> **Brief attivo**: [DEPUTYTASK_RISCHI_ROO.md](DEPUTYTASK_RISCHI_ROO.md) (ROO-4)
> **Codice oggi**: `app/src/pages/RisksPage.jsx` · `backend/src/controllers/risks.controller.js` · `contextFactors.controller.js` · `interestedParties.controller.js` · route `/rischi` (licenza `rischi`)
> **Storico**: slice 1–3 del piano 07/07/2026 **già in `main`** (PR [#279](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/279), 22/07/2026; migrazioni **123/124/125**). La tabella in `PROJECT_ROADMAP.md` che le segnava «Pianificato» è stantia — questa mappa la sostituisce.

## Funzione prevista (perché esiste il modulo)

Non è un elenco di rischi. È il ciclo HLS che l'auditor chiede di vedere:

1. **§4.1** — fattori interni/esterni rilevanti (PESTLE come aiuto, non obbligo).
2. **§4.2** — parti interessate + requisiti/aspettative.
3. **§6.1.1** — da 4.1 e 4.2 si **determinano** rischi **e** opportunità (assicurare risultati, accrescere effetti desiderati, prevenire indesiderati, migliorare).
4. **§6.1.2** — si **pianificano azioni** proporzionate, le si integrano nei processi, se ne **valuta l'efficacia**. Trattamenti rischio ≠ opportunità (note 1–2).
5. **§6.2** — obiettivi misurabili, coerenti con la politica, con piano cosa/risorse/chi/quando/come si valuta.
6. **§9.3** — il Riesame di Direzione già aggrega i rischi come input (`managementReviews.controller.js`).

Oggi i quattro registri (fattori, parti, rischi/opportunità, obiettivi) **esistono ma sono silos**. Il lavoro restante è **chiudere la catena**, non rifare il CRUD.

## Fuori scope

- Nuova chiave licenza (resta `rischi`).
- Generazione AI di rischi/obiettivi.
- Modulo KPI §9.1 dedicato (già in backlog parcheggiato).
- Offline/sync IndexedDB (il modulo è solo API; non toccare ADR-008).
- Cambiare il workflow NC / Piano Azioni oltre il link `source_risk_id`.
- Aspecti ambientali 14001 / pericoli SSL 45001 come registri separati (nebbia — vedi sotto).
- Sovrascrivere `DEPUTYTASK.md` (profilo azienda ADR-018, ancora APERTO).

## Non ancora specificato

- 14001 aspetti / 45001 pericoli: stesso registro con tag `standard_id` o moduli distinti.
- Matrice probabilità/impatto 1–3 (oggi) vs 1–5 (schema vision in roadmap, mai adottato).
- Export Word/PDF del pacchetto evidenze 4.1/4.2/6.1/6.2.
- Campi strutturati obiettivo: funzione / livello / processo (6.2.1 «relativi alle funzioni, ai livelli e ai processi»).
- Promemoria scadenza `review_date` (il servizio alert NC potrebbe già coprire le azioni derivate — smoke da fare, non pre-spezzare).

## Decisioni già prese

- **ROO-1** — `nature` (`risk`|`opportunity`) su `risks`, default `risk` — PR #279, migrazione 123.
- **ROO-2** — tabelle `context_factors` (§4.1) e `interested_parties` (§4.2) + tab Contesto in `RisksPage` — PR #279, migrazione 124. PESTLE = testo libero su `category`.
- **ROO-3** — `non_conformities.source_risk_id` + pulsante manuale «Crea azione» se `status='in_treatment'` (`NcCreateModal`) — PR #279, migrazione 125.
- Ambito azienda: `useCompanyScope()` (header unico, PR #401). `company_id` resta opzionale a DB. **Non** reintrodurre un selettore di pagina. **Non** è NOT NULL come Qualifiche (ROO-11 = HITL).
- Score = `probability × impact` (1–3 ciascuno). Riesame direzione già legge i rischi aperti/in trattamento.
- Numerazione migrazioni: sequenza condivisa in `database/migrations/` (root). Al charting l'ultimo file è `145_company_profile.sql` — il deputy prende il **prossimo libero** al momento, senza riservare.

## Mappa slice

| Slice | Tema | Perimetro (file/layer) | Dipende da | Tipo |
|-------|------|------------------------|------------|------|
| ROO-1 | `nature` rischio/opportunità | `risks.nature` + badge UI | — | AFK **FATTO** |
| ROO-2 | Registri §4.1 / §4.2 | `context_factors`, `interested_parties`, tab Contesto | — | AFK **FATTO** |
| ROO-3 | Link manuale → Piano Azioni | `source_risk_id` + `NcCreateModal` | ROO-1 | AFK **FATTO** |
| **ROO-4** | **Origine 4.1/4.2 sul rischio** (catena 6.1.1) | migrazione FK opzionali + `risks.controller` + picker/`Deriva da` in `RisksPage` | ROO-2 | AFK |
| ROO-5 | Trattamenti differenziati opportunità | CHECK `treatment` + form/etichette (Persegui/Investi/Non perseguire) | ROO-1 | AFK |
| ROO-6 | Azioni visibili sul rischio | GET azioni per `source_risk_id` + card; **non** auto-insert (HITL se si vuole l'auto) | ROO-3 | AFK (auto = HITL) |
| ROO-7 | Efficacia trattamento §6.1.2 b)2 | campi esito/data/nota su `risks` + UI revisione | ROO-5 | AFK |
| ROO-8 | Obiettivo: origine + piano 6.2.2 | FK opz. `source_risk_id` + risorse / come si valuta | ROO-4 | AFK |
| ROO-9 | Copy e filtri natura | tab «Rischi e opportunità», titolo form, filtro `nature` | ROO-1 | AFK |
| ROO-10 | Hardening RBAC/stats | `company_id` in update risk; `assertMutatingAllowed` su objectives; stats con `companyAccess` | — | AFK |
| ROO-11 | `company_id` obbligatorio | DB + UI come Qualifiche | HITL prodotto | HITL |
| ROO-12 | Export informazioni documentate | Word/PDF pacchetto 4.1/4.2/6.1/6.2 | ROO-4, ROO-8 | HITL formato |

**Tipo**: `AFK` = il deputy chiude da solo. `HITL` = serve una risposta prodotto prima o durante.

Ogni slice aperta è un **tracer verticale** (schema → API → UI → test L1), non uno strato orizzontale.

## ROO-4 — prima slice eseguibile (dettaglio)

Vedi brief [DEPUTYTASK_RISCHI_ROO.md](DEPUTYTASK_RISCHI_ROO.md).

**Hello world**: da un fattore di contesto (o una parte) → «Deriva rischio/opportunità» → form con origine precompilata → card rischio con badge cliccabile verso il fattore/parte.

## Qualità / vincoli deputy

- Una sessione = una slice. Se non chiude: handoff nel brief ([HANDOFF_TEMPLATE.md](HANDOFF_TEMPLATE.md)).
- Context default/basso. Non rileggere GUIDA intera.
- Migrazioni solo in `database/migrations/` (root), idempotenti. Mai `backend/database/migrations/` (cartella morta).
- UI: riuso classi di `RisksPage.css` / design system; non inventare un look nuovo.
- Test L1: Jest sul controller se si tocca BE; Vitest/build se si tocca `RisksPage.jsx`.
- Encoding UTF-8 senza BOM; accenti italiani reali.

# Piano slice — Second Brain (Assistente di Ambito)

> **Destinazione**: in app, l’utente vede e interroga **i fatti del solo Ambito attivo** (NC, scadenze, gap). La chat (`/ai-assistant`) consuma quei fatti; non è un cervello parallelo.
> **Spec**: [ADR-010](../adr/ADR-010-ai-agentic-architecture.md) · [SAL §K](../specs/MODULO_SAL_SCOPO_E_ROADMAP.md) · Ambito (`CompanyScopeSelect`)
> **Stato (07/09/2026):** SB-1 ✅ · SB-2 ✅ · SB-3 ✅ · SB-4 ✅ · SB-5 bozza ✅ · **SB-6 ✅** · **CTX-0 ✅** · **CTX-1 ✅** (badge/wizard Studio). Brief Alert HITL: [`DEPUTYTASK.md`](DEPUTYTASK.md) (no codice). **Prossima:** CTX-2 se serve JSON, altrimenti backlog.  
> **Mappa:** 16/08/2026 (wayfinder). Intuizione AIOS: livelli contesto/dati/intelligence **dentro** il prodotto, non cartella Claude parallela.

---

## Fuori scope

- Vault **Obsidian / LLM Wiki** in-app; skill wiki GitHub — KB prodotto = **DB** + moduli esistenti (vedi `PROJECT_CONTEXT.md` § Harness)
- Cartella Claude Code, SQLite locale, `/prime` che carica GUIDA intera
- Unificare harness Cursor (ADR-015) col cervello in-app — restano **sviluppo** vs **prodotto**
- Nuova chiave licenza (`ai_brain`) — MVP riusa `ai_chat`
- Meeting / WhatsApp / Fireflies / Slack; chat che **scrive** NC/WPS/SAL senza HITL
- Vector store nuovo — fatti operativi = query SQL vive (`ambitoFacts`)
- Pagina «iOS Control» — si estende `AiAssistantPage.jsx`
- OAuth Gmail/Drive nella prima ondata CTX; auto-salvataggio contesto senza conferma admin

---

## Non ancora specificato (nebbia — non aprire ora)

- Verbali meeting cliente (consenso/retention) — dopo SB stabili
- Card fatti in Home; memoria decisioni oltre moduli DB; stile few-shot per-studio
- Quota/caching blocco fatti; estensione gap SAL/WPQR; connettori email/Drive + retention

---

## Decisioni già prese

- **SB-1 ✅** — `GET /ai/ambito-facts` + card; zero LLM; isolamento `company_id`
- **SB-3 ✅** — `POST /ai/chat` inietta `loadAmbitoFacts` (org+company)
- **SB-4 ✅** — `companyId` null → aggregati studio + top urgenze; RAG `studioSafeOverview` (no chunk client misti)
- **SB-5 bozza ✅** — nav NC/Qualifiche/Scadenze da `AmbitoFactsBar`; no write autonoma
- In-app, N cervelli (`organization_id` + `company_id`); prima i fatti, poi la chat
- Studio su «Tutto lo studio» = solo aggregati → **SB-4** ✅
- Collare ADR-010; nessuna migrazione per SB-1…SB-4
- Contesto scritto (`ai_context_notes` / profilo) ≠ fatti live SQL — non fonderli
- Wizard contesto + due rubriche (studio ≠ azienda); email/Drive opt-in dopo CTX-3

---

## Gap vs funzione attesa

| Aspetto | Oggi | Atteso | Slice |
|---------|------|--------|-------|
| Fatti Ambito | Snapshot SQL + card | (fatto) | **SB-1** ✅ |
| Chat usa gli stessi numeri | Blocco fatti in prompt | (fatto) | **SB-3** ✅ |
| «Tutto lo studio» | Aggregati + top urgenze; RAG studio-safe | (fatto) | **SB-4** ✅ |
| Automazioni da bottone | Nav HITL da card | (bozza fatta; write autonoma vietata) | **SB-5** |
| Contesto studio/azienda | Textarea / profilo | Wizard + score vs rubrica | **CTX-0…3** |
| Email / Drive | Assente | Opt-in Alto | **CTX-4** |

---

## CTX-0 — Rubrica + score (DoD)

**Obiettivo:** score contesto % da rubrica **versionata** (studio ≠ azienda), **zero LLM**. Nessun wizard UI (→ CTX-1). Nessuna migrazione.

### Rubriche canoniche (codice)

| Scope | Version | File | Campi (già in DB) | Pesi |
|-------|---------|------|-------------------|------|
| Studio | `studio-v1` | `backend/src/data/aiContextRubrics.js` | `organization_name`+`vat_number` · `ai_context_notes` (≥40 char) · `audit_report_prefix` | 30 · 50 · 20 |
| Azienda | `company-v1` | stesso | `name`+`vat_number`+`sector` · `address` (≥8) | 50 · 50 |

Badge: `incompleto` (<50) / `parziale` (50–79) / `pronto` (≥80) — stesse soglie di `company_profile` completeness; **non** fonderli (profilo legale ADR-018 ≠ contesto AI).

### DoD CTX-0

- [x] Rubriche `studio-v1` / `company-v1` versionate e congelate in data module
- [x] `scoreAgainstRubric` + wrapper `aiContextScore.service` (puro, zero LLM)
- [x] Test L1: vuoto / parziale / pieno / minLength
- [x] Manifest deploy aggiornato se file nuovi in `src/data` / `src/services`
- [ ] **Fuori slice:** UI badge, wizard, endpoint nuovo, migrazioni, merge con `computeProfileCompleteness`

### CTX-1 — Badge % + wizard Studio (DoD)

**Obiettivo:** in **Il mio Studio** mostrare score contesto AI vs `studio-v1` e guida sui campi mancanti. Zero LLM. Nessuna migrazione. Nessun OAuth. Salvataggio solo su conferma (Salva).

### DoD CTX-1

- [x] GET/PATCH `/organizations/me` include `ai_context` (`scoreStudioContext`)
- [x] Badge % + livello su Contesto Assistente AI (`StatusBadge`, pattern profilo)
- [x] Checklist missing con label rubrica; anteprima live (mirror FE `app/src/data/aiContextRubrics.js`)
- [x] HITL: nessun auto-save note/profilo
- [x] Test L1 FE + Jest controller; build FE
- [ ] **Fuori slice:** wizard azienda `company-v1`, CTX-2 JSON, enrichment web, Alert #3

### CTX-2…4 (outline — non aprire ora)

| Slice | Tema | Note |
|-------|------|------|
| **CTX-2** | Persistenza strutturata | Solo se textarea non basta — eventuale JSON additivo + HITL se breaking |
| **CTX-3** | Enrichment web | Opt-in; dopo CTX-1 stabile |
| **CTX-4** | Email/Drive | Alto + HITL (già in mappa) |

---

## Mappa slice

| Slice | Tema | Perimetro | Dipende | Tipo |
|-------|------|-----------|---------|------|
| **SB-1** ✅ | Snapshot fatti Ambito | `ambitoFacts.service` + GET + card AI | — | AFK |
| **SB-2** ✅ | Ambito header = unico input | Card/GET + chat seguono `CompanyScopeContext`; chip locale read-only | SB-1 | AFK |
| **SB-3** ✅ | Chat consuma snapshot | `aiChat.controller` + stesso service | SB-1 | AFK |
| **SB-4** ✅ | Vista studio aggregata | GET `companyId` null: totali + top urgenze | SB-2 | AFK |
| **SB-5** | Pulsanti operativi | Nav moduli con Ambito; gated se manca azienda | SB-2 | AFK |
| **SB-6** ✅ | Fatti SAL | `getSalSummary` → counts Ambito + card/nav `/sal` | SB-3 | AFK |
| **CTX-0** ✅ | Rubrica + score % | `aiContextRubrics` + `aiContextScore.service` | — | AFK |
| **CTX-1** ✅ | Badge + wizard Studio | `organizations/me` + `StudioSettingsPage` | CTX-0 | AFK |
| **CTX-2…3** | Persist / enrich | JSON / web — file disgiunti | CTX-1 | AFK |
| **CTX-4** | Email/Drive | OAuth Alto + HITL | CTX-3 | HITL |

**Ordine fatti:** SB-1 → SB-2 → SB-3 → SB-4 → SB-5. **Contesto** parallelo (file ≠ chat): CTX-0 → … → CTX-3.

**Rischio SB-1…SB-5 / CTX-0:** Medio (additivo, no schema/auth nuovo) — PR + Bugbot. Non Alto.

---

## Hello world (riferimento)

- **SB-1:** tre numeri veri (NC / qualifiche 30gg / documenti 30gg) per Ambito, zero LLM — brief storico `DEPUTYTASK2.md`.
- **CTX-0:** score contesto % da rubrica versionata, zero LLM — brief `DEPUTYTASK2.md` (slot post SB-6).
- **CTX-1:** badge % + checklist missing su Il mio Studio — brief `DEPUTYTASK2.md` (slot post CTX-0).

---

## Allineamento ai 5 livelli AIOS (solo prodotto)

| Livello | Artefatto | Slice |
|---|---|---|
| Contesto | Rubrica + score (CTX-0 ✅) + wizard Studio (CTX-1 ✅) → azienda/enrich | CTX-0…3 |
| Dati | Snapshot SQL `ambitoFacts` | SB-1, SB-4, SB-6 |
| Intelligence | Moduli esistenti; meeting = nebbia | — |
| Automazioni | Pulsanti → moduli, HITL | SB-5 |
| Controllo | `AiAssistantPage` + `ai_chat` | SB-1…SB-3 |

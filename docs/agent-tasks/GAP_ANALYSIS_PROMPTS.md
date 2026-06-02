# Prompt Gap Analysis — esecuzione parallela

> Prompt pronti da incollare in chat **Agent** Cursor (Multitask).  
> Skill operativa: `.cursor/skills/gap-analysis-normativa/SKILL.md`  
> Template matrice: `docs/reference/GAP_ANALYSIS_TEMPLATE.md`  
> Output persistente: `docs/gap-reports/GAP_<MODULO>_<DATA>.md` (sostituire `<DATA>` con `YYYY-MM-DD`, es. `2026-05-31`)

---

## A) Prompt master — coordinatore struttura intera

Incollare in **una** finestra Agent dedicata alla visione d'insieme (non ai singoli moduli in dettaglio).

```
Esegui gap analysis di STRUTTURA INTERA ProgettoISO — ruolo COORDINATORE (non worker modulo).

## Skill e vincoli
- Segui `.cursor/skills/gap-analysis-normativa/SKILL.md` e `reference.md`
- Usa il template `docs/reference/GAP_ANALYSIS_TEMPLATE.md`
- Profondità: completa su architettura/roadmap; sui singoli moduli limitati a sintesi se esistono già report in `docs/gap-reports/`
- NON duplicare l'analisi dettagliata clausola-per-clausola dei worker: se l'utente ha lanciato worker paralleli, leggi i loro file `docs/gap-reports/GAP_*.md` e incorpora solo sintesi + gap trasversali
- NON creare `SESSION_NOTES_*.md`
- Rispondi in italiano

## Perimetro
- Incrocio moduli, dipendenze, 4 scenari prodotto (roadmap — Visione Strategica)
- Layer architetturali (Core / Dominio / UI) e 6 entità universali (roadmap — Domain Model)
- ADR vincolanti: ADR-002, ADR-008, ADR-009, ADR-011
- Backlog aperto in `docs/PROJECT_ROADMAP.md` (ADR-009 Fase 2-5, SAL, RDP, licenze, sync T6, ecc.)

## Fonti obbligatorie (lettura sintetica)
1. `PROJECT_CONTEXT.md`
2. `docs/PROJECT_ROADMAP.md` — scenari 1-4, sprint, open points
3. `docs/GUIDA_CONSOLIDATA.md` — sezioni moduli rilevanti
4. `docs/ARCHITETTURA_UTENTI_RBAC.md`
5. Report worker già presenti in `docs/gap-reports/` (se esistono)

## Deliverable
1. Matrice gap **trasversale** (modulo — dipendenza — scenario — priorità)
2. Mappa dipendenze tra moduli (chi blocca chi: es. ADR-009 Fase 2 → export 14001, SAL → Sprint 3 NC)
3. Matrice sintesi moduli — stato (Implementato / Parziale / Backlog / Assente)
4. Executive summary: gap P0/P1/P2 **di piattaforma** (non solo un modulo)
5. Limiti documentali globali (3834-2 assente, template SAL/RDP solo Word, ecc.)

## Salvataggio
Scrivi il file: `docs/gap-reports/GAP_STRUTTURA_<DATA>.md`
(crea la cartella `docs/gap-reports/` se manca)

## Se i worker non sono ancora partiti
Procedi con analisi strutturale da roadmap + ADR; segnala esplicitamente quali moduli richiedono worker dedicati per copertura clausole.
```

---

## B) Prompt worker — uno per modulo modulo modulo

Copiare l'intero blocco del modulo scelto in una finestra Agent separata.

---

### B1 — Audit ISO 9001 (clausole 4-10)

```
Gap analysis modulo AUDIT ISO 9001 — clausole 4-10.

## Skill
Segui `.cursor/skills/gap-analysis-normativa/SKILL.md`, `reference.md` e template `docs/reference/GAP_ANALYSIS_TEMPLATE.md`. Profondità: completa.

## Scope
- Modulo: audit checklist ISO 9001 (Scenario 1 — Camellini)
- Standard: ISO_9001_2015
- Clausole: 4-10 (tutte)
- Confronto quantitativo Conforma vs checklist app (ADR-002: ~47 punti Conforma vs seed/UI)

## Fonti normative
- `docs/Normative/UNI EN ISO 9001_2015 Rev. 0.md`

## Quaderni / guide operative
- `Quaderni/Linea Guida Conforma 9001_2015.txt` (gold standard evidenze — ADR-002)
- `Quaderni/Quaderni Qualità 2-Fattori del contesto e parti interessate_ocred.txt` (4.1, 4.2)
- `Quaderni/Quaderni Qualità 3-Risk based thinking_ocred.txt` (6.1)
- `Quaderni/Quaderni Qualità 4-Approccio per processi_ocred.txt` (4.4)
- `Quaderni/Quaderni qualità 5-Audit_ocred.txt` (metodologia audit)

## Architettura / codice (verifica mirata)
- `docs/agent-tasks/AUDIT_MODULE_LEAD_BRIEF.md` (G1-G9)
- `docs/adr/ADR-002-checklist-alignment-strategy.md`
- `docs/adr/ADR-009-multi-standard-architettura-per-norma.md`
- `app/src/components/ChecklistModule.jsx`, `QuestionCard.jsx`, `checklistInitializer.js`
- `backend/data/norm_requirements_seed.json` (conteggio clausole)

## Output richiesto
1. Matrice gap completa (template)
2. Riepilogo gap P0 / P1 / P2
3. Limiti documentali (se presenti)
4. Slice consigliate (opzionale)

## Salvataggio
`docs/gap-reports/GAP_AUDIT_9001_<DATA>.md`

NON creare SESSION_NOTES. Rispondi in italiano.
```

---

### B2 — NC organizzative (§10.2)

```
Gap analysis modulo NC ORGANIZZATIVO — ISO 9001 §10.2 (e equivalenti 14001/45001 dove rilevante).

## Skill
Segui `.cursor/skills/gap-analysis-normativa/SKILL.md`, `reference.md` e template `docs/reference/GAP_ANALYSIS_TEMPLATE.md`. Profondità: completa.

## Scope
- Modulo: registro NC / CAPA (`/nc`)
- Standard primario: ISO_9001_2015 §10.2
- Includere: collegamento audit → NC (S-A6), workflow stati, notifiche, export

## Fonti normative
- `docs/Normative/UNI EN ISO 9001_2015 Rev. 0.md` — sezione 10.2
- (riferimento) `docs/Normative/Normative NORMA_00003_ UNI EN ISO 14001_2015 Rev. 0.md` — NC equivalenti
- (riferimento) `docs/Normative/Normative NORMA_00002_ UNI ISO 45001_2018 Rev. 0.md` — NC equivalenti

## Quaderni
- `Quaderni/Linea Guida Conforma 9001_2015.txt` — sezione 10 / evidenze NC
- `Quaderni/Quaderno_6 Linee guida UNI EN ISO 14001.txt` — NC ambientali (se applicabile)

## Doc / codice
- `docs/how-to/MANUALE_UTENTE_NC.md`
- `docs/GUIDA_CONSOLIDATA.md` — sezione modulo NC
- `docs/PROJECT_ROADMAP.md` — backlog P2 (AI CAPA, export PDF)
- Route `/nc`, drawer ISO 10.2, `NonConformitiesManager.jsx`

## Output richiesto
1. Matrice gap (template)
2. Riepilogo P0 / P1 / P2
3. Distinzione gap normativo vs funzionale (es. export PDF = funzionale P2)

## Salvataggio
`docs/gap-reports/GAP_NC_<DATA>.md`

NON creare SESSION_NOTES. Rispondi in italiano.
```

---

### B3 — Audit ISO 14001

```
Gap analysis modulo AUDIT ISO 14001 — clausole 4-10.

## Skill
Segui `.cursor/skills/gap-analysis-normativa/SKILL.md`, `reference.md` e template `docs/reference/GAP_ANALYSIS_TEMPLATE.md`. Profondità: completa.

## Scope
- Modulo: audit checklist ISO 14001 (Scenario 1)
- Standard: ISO_14001_2015, clausole 4-10
- Include: checklist DB (53 domande, migration 049), export Word 14001, norm_excerpt

## Fonti normative
- `docs/Normative/Normative NORMA_00003_ UNI EN ISO 14001_2015 Rev. 0.md`

## Quaderni
- `Quaderni/Quaderno_6 Linee guida UNI EN ISO 14001.txt` (linea guida applicativa + evidenze attese)

## Architettura / codice
- `docs/adr/ADR-009-multi-standard-architettura-per-norma.md` (Fase 2-3: sezione 11, Close Panel, export per-norma)
- `docs/PROJECT_ROADMAP.md` — stato checklist 14001, norm_excerpt
- Checklist templates, `wordExport.js`, sezioni `14001_s*`

## Output richiesto
1. Matrice gap completa
2. Riepilogo P0 / P1 / P2
3. Gap legati ad ADR-009 Fase 2-3 (sezione 11 per-norma, export indipendente)

## Salvataggio
`docs/gap-reports/GAP_AUDIT_14001_<DATA>.md`

NON creare SESSION_NOTES. Rispondi in italiano.
```

---

### B4 — Audit ISO 45001

```
Gap analysis modulo AUDIT ISO 45001 — clausole 4-10.

## Skill
Segui `.cursor/skills/gap-analysis-normativa/SKILL.md`, `reference.md` e template `docs/reference/GAP_ANALYSIS_TEMPLATE.md`. Profondità: completa.

## Scope
- Modulo: audit checklist ISO 45001 (Scenario 1 — backlog Camellini)
- Standard: ISO_45001_2018, clausole 4-10 (Annex SL HLS)
- Stato atteso: checklist in backlog (roadmap Fase 0.3)

## Fonti normative
- `docs/Normative/Normative NORMA_00002_ UNI ISO 45001_2018 Rev. 0.md`

## Quaderni
- Nessuna linea guida Conforma dedicata 45001 in repo — segnalare come limite documentale
- Contesto HLS: riuso struttura 9001/14001; `Quaderni/Quaderni qualità 5-Audit_ocred.txt` (metodologia audit trasversale)

## Architettura / codice
- `docs/PROJECT_ROADMAP.md` — Fase 0.3, tab ISO 45001
- `docs/adr/ADR-009-multi-standard-architettura-per-norma.md`
- Assenza/presenza seed checklist 45001 in DB e UI

## Output richiesto
1. Matrice gap (norma vs stato attuale vs backlog)
2. Riepilogo P0 / P1 / P2
3. Dipendenze: ADR-009, pattern checklist 9001/14001 da riusare

## Salvataggio
`docs/gap-reports/GAP_AUDIT_45001_<DATA>.md`

NON creare SESSION_NOTES. Rispondi in italiano.
```

---

### B5 — ISO 3834 / RDP Mason (Scenario 4)

```
Gap analysis modulo ISO 3834 e RDP — Rapporto di Prova (Scenario 4 — Mason).

## Skill
Segui `.cursor/skills/gap-analysis-normativa/SKILL.md`, `reference.md` e template `docs/reference/GAP_ANALYSIS_TEMPLATE.md`. Profondità: completa.

## Scope
- Modulo: RDP / saldatura / document_type `rdp`
- Standard: ISO 3834-1, 3834-3, 3834-5 (+ 3834-2 **assente in repo** — limite documentale)
- Template cliente: `Check List Audit/RDP_MSN-260127-01_REV_0.docx`
- Foto obbligatorie, prove tecniche, misure

## Fonti normative
- `docs/Normative/Normative NORMA_00005_ UNI EN ISO 3834-1_2021 Rev. 0.md`
- `docs/Normative/Normative NORMA_00009_ UNI EN ISO 3834-3_2021 Rev. 0.md`
- `docs/Normative/Normative NORMA_00008_ UNI EN ISO 3834-5_2021 Rev. 0.md`

## Quaderni (contesto, non modulo app)
- `Quaderni/Quaderno11_Direttiva Atex.txt` — sicurezza ATEX (contesto esterno)

## Architettura / codice
- `docs/PROJECT_ROADMAP.md` — Scenario 4, Modulo RDP, Sprint 5 Saldatura
- `docs/adr/ADR-009-multi-standard-architettura-per-norma.md` — RDP come specializzazione
- Assenza `RDPModule.jsx`, tabelle `rdp_sections`/`rdp_tests` (backlog)
- Prerequisito foto Word: risolto 2026-04-23 (roadmap)

## Output richiesto
1. Matrice gap norma + template cliente vs implementazione
2. Riepilogo P0 / P1 / P2
3. Tabella limiti documentali (3834-2, template Word-only)

## Salvataggio
`docs/gap-reports/GAP_RDP_3834_<DATA>.md`

NON creare SESSION_NOTES. Rispondi in italiano.
```

---

### B6 — SAL consulenza Camellini (Scenario 3)

```
Gap analysis modulo SAL — Stato Avanzamento Lavori (Scenario 3 — Camellini).

## Skill
Segui `.cursor/skills/gap-analysis-normativa/SKILL.md`, `reference.md` e template `docs/reference/GAP_ANALYSIS_TEMPLATE.md`. Profondità: completa.

## Scope
- Modulo: SAL documentale / `document_type` `sal`
- Standard: ISO 9001 + 14001 + 45001 (tracker requisiti — stati: Discusso / In corso / Da validare / Completato)
- Template: `Check List Audit/CLIENTE - SAL documentale iso 14001 - 9001 - 45001.docx`

## Fonti normative (per righe tracker)
- `docs/Normative/UNI EN ISO 9001_2015 Rev. 0.md`
- `docs/Normative/Normative NORMA_00003_ UNI EN ISO 14001_2015 Rev. 0.md`
- `docs/Normative/Normative NORMA_00002_ UNI ISO 45001_2018 Rev. 0.md`

## Quaderni
- Nessun quaderno SAL dedicato — tracker da norme + template Word cliente

## Architettura / codice
- `docs/PROJECT_ROADMAP.md` — Fase 0.B SAL, Sprint 4, colori per standard
- Assenza `SALModule.jsx`, `document_type` in `audits` (backlog)
- Dipendenza Sprint 3 NC (roadmap)

## Output richiesto
1. Matrice gap (requisito — stato implementazione implementazione implementazione)
2. Riepilogo P0 / P1 / P2
3. Confronto struttura template Word vs modello dati proposto in roadmap

## Salvataggio
`docs/gap-reports/GAP_SAL_<DATA>.md`

NON creare SESSION_NOTES. Rispondi in italiano.
```

---

### B7 — Registro norme e documenti

```
Gap analysis modulo REGISTRO NORME E DOCUMENTI (SoT documentale).

## Skill
Segui `.cursor/skills/gap-analysis-normativa/SKILL.md`, `reference.md` e template `docs/reference/GAP_ANALYSIS_TEMPLATE.md`. Profondità: completa.

## Scope
- Modulo: registro documenti / norme SoT (REG-NORM-SOT R1-R7)
- Clausole: ISO 9001 §7.5 (controllo documenti), §8.2 (riesame requisiti)
- Include: import norme, `norm_requirements`, connettori Normattiva/EUR-Lex, validit—/scadenze

## Fonti normative
- `docs/Normative/UNI EN ISO 9001_2015 Rev. 0.md` — §7.5, §8.2
- Tutti i file in `docs/Normative/` per copertura import

## Quaderni / regolamenti
- `Quaderni/Regolamento Accredia 4722_RG_01rev_03.txt` — contesto certificazione/accredito

## Architettura / codice
- `docs/adr/ADR-011-registry-norm-sot.md`
- `docs/adr/ADR-010-ai-agentic-architecture.md` — NormBroker
- `docs/agent-tasks/PLAN_REGISTRY_NORM_SOT_SLICES.md`
- `backend/scripts/import-norms-from-markdown.js`, migration 052
- Sprint 9-10 import PDF → staging ? registry

## Output richiesto
1. Matrice gap R1-R7 vs stato deploy
2. Riepilogo P0 / P1 / P2
3. Gap documentali vs funzionali (OCR, staging, Office round-trip)

## Salvataggio
`docs/gap-reports/GAP_REGISTRO_NORME_<DATA>.md`

NON creare SESSION_NOTES. Rispondi in italiano.
```

---

### B8 — RBAC / multi-tenant / piattaforma SaaS

```
Gap analysis modulo RBAC, MULTI-TENANT e PIATTAFORMA SaaS.

## Skill
Segui `.cursor/skills/gap-analysis-normativa/SKILL.md`, `reference.md` e template `docs/reference/GAP_ANALYSIS_TEMPLATE.md`. Profondità: completa su architettura; norme solo dove rilevanti (—7.5 tracciabilità accessi).

## Scope
- Modello tenant: QS Studio → Auditor/Studio ? Azienda
- RBAC: ruoli, scope audit/NC/allegati, licenze moduli
- Feature flags, dark launch, abbonamenti per standard
- NON è gap analysis clausole ISO — focus conformità prodotto e sicurezza dati

## Fonti normative (secondarie)
- ISO 9001 §7.5 — tracciabilità documenti e controllo accessi (solo se rilevante)

## Documentazione obbligatoria
- `docs/ARCHITETTURA_UTENTI_RBAC.md`
- `docs/PROJECT_ROADMAP.md` — Visione SaaS, Fase 1-3, checklist Sessioni A-E licenze
- `docs/GUIDA_CONSOLIDATA.md` — RBAC audit list, logout sync
- `docs/adr/ADR-007-logout-offline-backup-e-mirror-cartella-pc.md`

## Codice (verifica mirata)
- `backend/src/services/auditListRbac.service.js`
- `backend/src/middleware/auth.middleware.js`
- `LicensesSettingsPage`, `LicensedRoute`, `requireLicensedModule`

## Output richiesto
1. Matrice gap (area — stato — rischio dati)
2. Riepilogo P0 / P1 / P2 (priorità sicurezza e isolamento tenant)
3. Allineamento checklist roadmap Sessioni A-E

## Salvataggio
`docs/gap-reports/GAP_RBAC_SAAS_<DATA>.md`

NON creare SESSION_NOTES. Rispondi in italiano.
```

---

### B9 — Export Word / reportistica

```
Gap analysis modulo EXPORT WORD e REPORTISTICA (trasversale).

## Skill
Segui `.cursor/skills/gap-analysis-normativa/SKILL.md`, `reference.md` e template `docs/reference/GAP_ANALYSIS_TEMPLATE.md`. Profondità: completa.

## Scope
- Export Word audit 9001/14001/3834, custom checklist, SAL (backlog), RDP (backlog)
- Campo `norm_excerpt`, `clauseRef`, pending issues, allegati/foto embedded
- Template report, sommario, sicurezza link allegati (token monouso — backlog)

## Fonti normative
- Riferimenti clausola via checklist — non gap clausole singole clausole singole clausole singole (delegare ai worker audit)
- Confronto evidenze attese Conforma vs contenuto report 9001

## Quaderni
- `Quaderni/Linea Guida Conforma 9001_2015.txt` — evidenze attese in report

## Architettura / codice
- `docs/PROJECT_ROADMAP.md` — export Word, norm_excerpt, foto embedded, ADR-009 Fase 3
- `app/src/utils/wordExport.js`, `wordExportHelpers.js`, `ExportPanel.jsx`
- Template in `Check List Audit/`

## Output richiesto
1. Matrice gap per standard/tipo documento (9001 / 14001 / 3834 / custom / SAL / RDP)
2. Riepilogo P0 / P1 / P2
3. Dipendenze ADR-009 Fase 3 (export per-norma)

## Salvataggio
`docs/gap-reports/GAP_EXPORT_WORD_<DATA>.md`

NON creare SESSION_NOTES. Rispondi in italiano.
```

---

### B10 — Sync offline / multi-device

```
Gap analysis modulo SYNC OFFLINE e MULTI-DEVICE.

## Skill
Segui `.cursor/skills/gap-analysis-normativa/SKILL.md`, `reference.md` e template `docs/reference/GAP_ANALYSIS_TEMPLATE.md`. Profondità: completa su architettura sync.

## Scope
- Offline-first: IndexedDB, sync queue, server-wins, event-based (T1-T5 completati)
- Multi-device: reconcile, debounce hydrate, field-level merge, lock UX (T5)
- Allegati offline (SYNC-5), logout guard (SYNC-4), recovery/history (T6 backlog)
- Conformit— operativa ISO §7.5 — integrità record (non clausole singole)

## Fonti normative (secondarie)
- ISO 9001 §7.5 — integrità e tracciabilità record

## Documentazione obbligatoria
- `docs/adr/ADR-008-event-sourcing-sync.md`
- `docs/adr/ADR-006-auto-reconcile-cache-sync.md`
- `docs/adr/ADR-007-logout-offline-backup-e-mirror-cartella-pc.md`
- `docs/GESTIONE_PERDITA_CONNESSIONE.md`
- `docs/PROJECT_ROADMAP.md` — sequenza SYNC-1..6, T6

## Codice (verifica mirata)
- `StorageContext.jsx`, `syncService.js`, `SyncMergeBanner.jsx`, `LogoutSyncGuard.jsx`
- `backend` event store, `audit_events`

## Output richiesto
1. Matrice gap (scenario — stato — rischio perdita dati)
2. Riepilogo P0 / P1 / P2
3. Gap residui post Camellini 28/04/2026 e smoke T3

## Salvataggio
`docs/gap-reports/GAP_SYNC_<DATA>.md`

NON creare SESSION_NOTES. Rispondi in italiano.
```

---

### B11 — (Opzionale) Audit terza parte — Scenario 2

```
Gap analysis SCENARIO 2 — Audit di terza parte (norme committente).

## Skill
Segui `.cursor/skills/gap-analysis-normativa/SKILL.md` e template `docs/reference/GAP_ANALYSIS_TEMPLATE.md`.

## Scope
- Audit con riferimenti normativi del committente (non checklist ISO predefinita)
- Uso `clauseRef` + note / campo riferimento committente
- Norme committente NON in `docs/Normative/` — limite documentale

## Fonti
- `docs/PROJECT_ROADMAP.md` — Scenario 2
- `Quaderni/Regolamento Accredia 4722_RG_01rev_03.txt` — contesto audit/certificazione

## Output + salvataggio
Matrice gap + P0/P1/P2 → `docs/gap-reports/GAP_AUDIT_TERZA_PARTE_<DATA>.md`
```

---

### B12 — (Opzionale) Checklist custom / ADR-009 Fase 4

```
Gap analysis CHECKLIST CUSTOM e ADR-009 Fase 4 ("norma virtuale").

## Skill
Segui `.cursor/skills/gap-analysis-normativa/SKILL.md` e template `docs/reference/GAP_ANALYSIS_TEMPLATE.md`.

## Scope
- Checklist personalizzate vs standard ISO
- ADR-009 Fase 4: parit— con norme certificate
- GAP-B1/B2/B3, outcome buttons, export custom

## Fonti
- `docs/adr/ADR-009-multi-standard-architettura-per-norma.md`
- `docs/PROJECT_ROADMAP.md` — custom checklist completata, Fase 4 backlog
- `CustomChecklistAuditView.jsx`, `CustomChecklistsPage.jsx`

## Output + salvataggio
Matrice gap + P0/P1/P2 → `docs/gap-reports/GAP_CUSTOM_CHECKLIST_<DATA>.md`
```

---

## C) Come eseguire in parallelo

Istruzioni per il committente (non serve competenza tecnica).

### Passo 1 — Preparazione
1. Apri Cursor sul progetto `ProgettoISO`
2. Assicurati che `docs/gap-reports/` esista (viene creata al primo report)

### Passo 2 — Avvia i worker (Multitask)
1. Apri **N finestre Agent** (Cursor Multitask): una per ogni modulo da analizzare
2. In ogni finestra incolla **un solo prompt** dalla sezione B (B1, B2, … B10)
3. Sostituisci `<DATA>` con la data odierna (es. `2026-05-31`) nel prompt o lascia che l'agente la metta nel filename
4. Avvia tutte le finestre **in parallelo** — non serve attendere una per avviare l'altra

### Passo 3 — Prompt master struttura
**Opzione A (consigliata):** attendi che almeno i worker P0 siano completati (9001, NC, sync, RBAC), poi incolla il prompt **A** in una finestra dedicata. Il coordinatore legger— i file in `docs/gap-reports/`.

**Opzione B (più veloce):** avvia il prompt **A** in parallelo ai worker; al termine riesegui A chiedendo di rileggere tutti i `GAP_*.md` per aggiornare la sintesi.

### Passo 4 — Consolidamento finale
Quando tutti i report sono in `docs/gap-reports/`, incolla il prompt **D** (sezione sotto) in una nuova finestra Agent.

### Ordine consigliato e dipendenze

| Priorità | Modulo | Prompt | Dipende da | Note |
|----------|--------|--------|------------|------|
| 1 | Audit ISO 9001 | B1 | — | Core produzione Camellini |
| 1 | NC §10.2 | B2 | — | Collegato audit ma analisi indipendente |
| 1 | Sync offline | B10 | — | Rischio perdita dati |
| 2 | Audit ISO 14001 | B3 | ADR-009 Fase 2 (citare) | Checklist ok, export parziale |
| 2 | Export Word | B9 | B1, B3 | Trasversale |
| 2 | RBAC / SaaS | B8 | — | Piattaforma |
| 3 | Registro norme | B7 | — | SoT documentale |
| 3 | Audit ISO 45001 | B4 | B1 pattern | Backlog |
| 4 | SAL | B6 | B2, B4 | Scenario 3 backlog |
| 4 | RDP / 3834 | B5 | B9 foto | Scenario 4 backlog |
| — | Struttura intera | A | tutti i worker | Coordinatore |
| — | Consolidamento | D | A + tutti i worker | Documento unico |

**Regola pratica:** i worker **non** devono modificare gli stessi file contemporaneamente — ognuno scrive solo il proprio `docs/gap-reports/GAP_<MODULO>_<DATA>.md`.

---

## D) Prompt finale — consolidamento

Incollare quando `docs/gap-reports/` contiene i report dei worker (e opzionalmente `GAP_STRUTTURA_*.md`).

```
Consolidamento GAP ANALYSIS — merge di tutti i report modulari.

## Input
Leggi tutti i file in `docs/gap-reports/GAP_*.md` (worker + eventuale GAP_STRUTTURA).

## Skill e template
- `.cursor/skills/gap-analysis-normativa/SKILL.md`
- `docs/reference/GAP_ANALYSIS_TEMPLATE.md`

## Deliverable unico
Crea `docs/gap-reports/GAP_CONSOLIDATO_<DATA>.md` con:

1. **Executive summary** (max 10 bullet): stato piattaforma, gap P0 critici, quick wins P2
2. **Matrice sintesi moduli** (tabella: Modulo | Stato | Gap P0 | Gap P1 | Gap P2 | File sorgente)
3. **Backlog prioritizzato unificato** — lista ordinata P0 → P1 → P2, deduplicata (stesso gap citato da più moduli = una riga con riferimenti incrociati)
4. **Dipendenze implementative** — grafo o tabella (cosa sblocca cosa: es. ADR-009 Fase 2 → export 14001 ? SAL)
5. **Limiti documentali** — riepilogo globale (3834-2, Quaderno_2 vuoto, template Word-only, norme committente)
6. **Slice consigliate** — 5-10 slice verticali committabili con stima impatto
7. **Riferimenti** — elenco file gap-reports usati

## Regole
- NON duplicare matrici clausola-per-clausola dei worker — solo sintesi + backlog
- Se due worker contraddicono uno stato, segnala con nota e preferisci evidenza codice/roadmap
- NON creare SESSION_NOTES
- Opzionale: aggiungere sotto-sezione in `docs/GUIDA_CONSOLIDATA.md` → Esperienza solo se lezione trasversale significativa

Rispondi in italiano. Al termine indica path file creato e conteggio gap per priorità.
```

---

## Riferimenti rapidi

| Risorsa | Path |
|---------|------|
| Skill gap analysis | `.cursor/skills/gap-analysis-normativa/SKILL.md` |
| Catalogo norme/quaderni | `.cursor/skills/gap-analysis-normativa/reference.md` |
| Template matrice | `docs/reference/GAP_ANALYSIS_TEMPLATE.md` |
| Roadmap moduli | `docs/PROJECT_ROADMAP.md` |
| Cartella output | `docs/gap-reports/` |

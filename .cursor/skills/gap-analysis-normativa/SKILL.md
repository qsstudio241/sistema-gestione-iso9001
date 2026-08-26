---
name: gap-analysis-normativa
description: >-
  Esegue gap analysis strutturata sui moduli ProgettoISO confrontando requisiti
  normativi (docs/Normative) e guide operative (Quaderni) con implementazione
  codice e roadmap. Usare quando l'utente chiede gap analysis, conformità modulo,
  verifica clausole, allineamento norma, copertura ISO 9001/14001/45001/3834,
  SAL o RDP.
---

# Gap analysis normativa — ProgettoISO

Skill di progetto per confrontare **requisiti normativi** e **stato app** (codice + roadmap), producendo una matrice actionable.

## Quando attivare

- Richiesta esplicita: «gap analysis», «conformità modulo», «verifica clausole», «allineamento norma»
- Prima di nuove checklist, export Word per-norma, modulo SAL/RDP, estensioni NC/registro
- Review post-implementazione: «copriamo §10.2?», «checklist allineata a Conforma?»

## Input richiesti (chiedere se mancanti)

| Input | Esempio | Default se omesso |
|-------|---------|-------------------|
| **Modulo target** | audit, nc, registro-norme, sal, rdp, export-word | Inferire dal messaggio utente |
| **Standard** | ISO_9001_2015, ISO_14001_2015, ISO_45001_2018, ISO_3834_* | Tutti gli standard del modulo |
| **Scope** | clausole 4–10, solo §10.2, singola feature | Perimetro del modulo (vedi mapping) |
| **Profondità** | rapida (roadmap+brief) / completa (norma+quaderni+codice) | completa |

## Fonti — ordine di lettura

1. **Contesto repo** (sempre, sintesi):
   - `PROJECT_CONTEXT.md`
   - `docs/PROJECT_ROADMAP.md` — scenari 1–4, backlog moduli
   - Sezione moduli in `docs/GUIDA_CONSOLIDATA.md`

2. **Norme** (`docs/Normative/` — markdown, testo ufficiale UNI):
   - Estrarre clausole nello scope (titolo + testo requisito)
   - Catalogo completo: [reference.md](reference.md)
   - Per **3834 / saldatura**: includere anche le norme di **supporto** (cataloghi/misura/contenuto WPS, non seed SGQ): ISO 14175 gas (`NORMA_00012` + `docs/reference/ISO-14175-gas-protezione.md`), ISO 13916 temperature (`NORMA_00013` + `docs/reference/ISO-13916-temperature-saldatura.md`), ISO 15609-1/-2 contenuto WPS (`NORMA_00014`/`00015` + `docs/reference/ISO-15609-WPS-contenuto.md`), ISO 4063, ISO 6947, ISO/TR 15608 — vedi PLAN_INGEST_REFERENCE_CATALOGS

3. **Guide operative** (`Quaderni/` — testo `.txt`, conversione da PDF; suffisso `_ocred` dove applicabile; PDF originali = archivio opzionale):
   - **9001 audit**: `Linea Guida Conforma 9001_2015.txt` (evidenze attese — gold standard ADR-002)
   - **9001 tematici**: Quaderni Qualità 2—5 `_ocred` (contesto, rischi, processi, metodologia audit)
   - **14001 audit**: `Quaderno_6 Linee guida UNI EN ISO 14001.txt`
   - **37001 anti-corruzione**: `Quaderno_10_LG_37001_Conforma_UNI.txt` (contesto normativo; non modulo app)
   - **Accredia / certificazione**: `Regolamento Accredia 4722_RG_01rev_03.txt`
   - **ATEX sicurezza**: `Quaderno11_Direttiva Atex.txt` (contesto esterno)
   - **Fiscale / Industria 4.0**: `Quaderno_9_LG_Iperammortamento_072017.txt` (non modulo app)
   - Catalogo completo e mapping: [reference.md](reference.md)
4. **Architettura e gap funzionali esistenti**:
   - `docs/adr/ADR-002-checklist-alignment-strategy.md` — allineamento checklist
   - `docs/adr/ADR-010-ai-agentic-architecture.md` — NormBroker, norm_requirements
   - `docs/agent-tasks/AUDIT_MODULE_LEAD_BRIEF.md` — gap audit (G1–G9)
   - Codice solo dove serve verificare copertura (grep mirato, non full scan)

5. **DB requisiti** (opzionale, citazione/evidenza):
   - Tabella `norm_requirements` (migration `052_norm_requirements.sql`)
   - Seed: `node backend/scripts/import-norms-from-markdown.js` → `backend/data/norm_requirements_seed.json`
   - Verifica conteggio: `node backend/scripts/check-norms-count.js`

## Quando chiedere PDF

Percorso obbligatorio se manca il Markdown utile. **Non inventare** soglie, clausole o range.

1. Dichiarare in chat tre righe: **coperte / mancanti / si parte su…** (mancante = limite **documentale**, non gap app).
2. Aggiornare [`NORME_MANCANTI_BACKLOG.md`](../../../docs/reference/NORME_MANCANTI_BACKLOG.md) (stato `da_richiedere`).
3. Copiare il blocco **Richiesta norma (HITL)** da [`HANDOFF_TEMPLATE.md`](../../../docs/agent-tasks/HANDOFF_TEMPLATE.md) nel `DEPUTYTASK*` attivo.
4. PDF ricevuto → skill `pdf-to-json` → `docs/Normative/`; poi seed `norm_requirements` + VPS se è norma SGQ a clausole.
5. Il perimetro già coperto dalle fonti presenti **non si blocca**.

Non installare skill GitHub extra: approfondire questa skill + `pdf-to-json`.

## Workflow step-by-step

```
Progresso gap analysis:
- [ ] 0. Dichiarare fonti Markdown (coperte / mancanti / si parte su…). Se manca MD: sezione «Quando chiedere PDF» (backlog + HITL).
- [ ] 1. Definire modulo, standard, scope
- [ ] 2. Leggere fonti normative + Quaderni pertinenti
- [ ] 3. Leggere roadmap/brief/ADR per stato dichiarato
- [ ] 4. Verificare codice (solo aree rilevanti)
- [ ] 5. Compilare matrice (template sotto)
- [ ] 6. Classificare gap normativo vs funzionale
- [ ] 7. Prioritizzare (P0/P1/P2) e proporre slice
- [ ] 8. Consegnare esito (chat + opz. GUIDA se lezione appresa)
```

### Step 1 — Perimetro

Usare [reference.md](reference.md) per mapping modulo → clausole/file. Se lo scope supera le norme disponibili in repo, seguire **Quando chiedere PDF** (limite documentale, non gap app). Per Material Compliance: inventario in [`MATERIAL-COMPLIANCE-NORME-SINTESI.md`](../../../docs/reference/MATERIAL-COMPLIANCE-NORME-SINTESI.md) — dichiarare, tracciare, **partire** sul perimetro coperto; non inventare clausole/soglie.

### Step 2 — Estrazione requisiti

Per ogni clausola nello scope:
- **Testo normativo**: da file in `docs/Normative/` (citare path + `clause_ref`)
- **Evidenze attese** (solo 9001): da Conforma — sezione «POSSIBILI EVIDENZE A SUPPORTO DELLA CONFORMITÀ»
- **Interpretazione operativa**: da Quaderni tematici se applicabile

### Step 3 — Stato app oggi

Fonti in ordine di priorità:
1. `PROJECT_ROADMAP.md` (§ Stato attuale / backlog moduli)
2. Brief modulo (es. AUDIT_MODULE_LEAD_BRIEF)
3. Codice: componenti/API elencati nel brief o in reference

Valori ammessi colonna **Stato app oggi**: `Implementato` | `Parziale` | `Assente` | `Backlog roadmap` | `Non applicabile`

### Step 4 — Gap e priorità

| Tipo gap | Definizione | Esempio |
|----------|-------------|---------|
| **Normativo** | Requisito/clausola non coperta da checklist, flusso o evidenza prevista dalla norma o Conforma | Checklist 9001 con 26 domande vs ~47 punti Conforma (ADR-002) |
| **Funzionale** | Requisito normativo coperto in linea di principio ma implementazione incompleta/bug/UX | G1 read-only post-chiusura audit (AUDIT brief) |

Priorità allineate al repo: **P0** bloccante conformità/dati | **P1** flusso/UX | **P2** hardening

### Step 5 — Output

- **Chat**: matrice + executive summary (3–5 bullet)
- **Template riusabile**: `docs/reference/GAP_ANALYSIS_TEMPLATE.md`
- **Persistenza** (solo se lezione trasversale o chiusura sessione): aggiungere sotto-sezione in `docs/GUIDA_CONSOLIDATA.md` → *Esperienza*, formato:
  ```markdown
  ### Gap analysis [modulo] — [data]
  - Scope: ...
  - Gap P0: ...
  - Riferimento: `.cursor/skills/gap-analysis-normativa/`
  ```
- **NON** creare `SESSION_NOTES_*.md`

## Matrice output (obbligatoria)

| Modulo | Clausola / requisito | Fonte | Stato app oggi | Gap | Tipo | Priorità | Evidenza file |
|--------|----------------------|-------|----------------|-----|------|----------|---------------|
| audit | 4.1 Contesto org. | ISO 9001 §4.1 + Conforma 4.1 | Parziale | Checklist non allineata a sottopunti Conforma | Normativo | P1 | `ADR-002`, `checklistInitializer.js` |
| nc | 10.2 NC e AC | ISO 9001 §10.2 | Implementato | Export PDF assente | Funzionale | P2 | `PROJECT_ROADMAP.md`, `/nc` |

Colonne **Tipo**: `Normativo` | `Funzionale` | `Documentale` (manca fonte in repo)

## Limiti documentali (non confondere con gap app)

| Voce | Stato in repo | Dove trovare altro |
|------|---------------|-------------------|
| ISO 3834-2 / 3834-4 | **Edizione 2021** in repo (`NORMA_00029` / `00030`); 2006 solo archivio | — |
| Modulo SAL | **Live** (tracker + Word); template storico solo riferimento colori | `SALModule.jsx`, `wordExportSal.js` |
| Modulo RDP | **Live** (prove + foto); Word = backlog template Mason | `RDPModule.jsx`; `Check List Audit/RDP_MSN-260127-01_REV_0.docx` |
| Norme committente (audit terza parte) | Per cliente | Non in Normative/ |
| `Quaderno_2_Linea_Guida_1090.{txt,md,json}` | **Digitalizzata** 26/08/2026 (Conforma LG EN 1090); GAP pag. 3 | Contesto carpenteria / marcatura CE |

Segnalare righe con Tipo = `Documentale` quando il gap dipende da testo mancante, non da codice.

## Mapping rapido moduli

Dettaglio esteso in [reference.md](reference.md).

| Modulo | Standard / riferimento | Clausole tipiche | Brief / codice |
|--------|------------------------|------------------|----------------|
| Audit checklist | 9001, 14001, 45001 | 4–10 per standard | `AUDIT_MODULE_LEAD_BRIEF.md`, `ChecklistModule.jsx` |
| NC organizzativo | 9001 §10.2 ( anche 14001/45001 ) | 10.2 | `/nc`, `MANUALE_UTENTE_NC.md` |
| Registro documenti / norme SoT | 9001 §7.5, §8.2 | 7.5, 8.2 | REG-NORM-SOT, ADR-011 |
| Export Word | Trasversale | clauseRef, norm_excerpt | `wordExport.js`, roadmap Fase 0 |
| SAL | 9001/14001/45001 tracker implementazione | per requisito | `SALModule.jsx`, `gapAnalysis.service.js`, spec `MODULO_SAL_SCOPO_E_ROADMAP.md` |
| RDP / 3834 | 3834-1…-5 **2021** (-2/-4 in repo) | processo saldatura | `RDPModule.jsx`, `rdp.controller.js`; Word RDP = backlog template Mason |

## Integrazione norm_requirements

Quando serve elenco clausole strutturato o confronto quantitativo:
1. Leggere `backend/scripts/import-norms-from-markdown.js` — elenco file importati
2. Eseguire import locale se seed assente: `node backend/scripts/import-norms-from-markdown.js`
3. Citare `standard_code` + `clause_ref` dalla seed JSON o da query DB
4. Non confondere **testo DB** con **copertura checklist UI** — due livelli distinti (ADR-002)

## Esempi di invocazione

**Utente**: «Gap analysis modulo NC vs ISO 9001 §10.2»
→ Scope: modulo `nc`, standard `ISO_9001_2015`, clausole 10.2; leggere norma + Conforma (sezione 10) + MANUALE + codice drawer.

**Utente**: «Siamo allineati a Conforma per audit 9001?»
→ Confronto punti Conforma vs `checklistInitializer.js` / seed DB; gap prevalentemente **normativi**; citare ADR-002.

**Utente**: «Cosa manca per SAL?»
→ Spec `MODULO_SAL_SCOPO_E_ROADMAP.md` (live, non assente): `SALModule.jsx` + motore `gapAnalysis`; norme 9001/14001/45001; Tipo gap misto (funzionale/documentale), non «modulo mancante».

## Encoding

- Salvare **sempre** i report e i prompt in **UTF-8 senza BOM** (allineato a `.editorconfig` e `.cursor/rules/sgq-encoding-quality.mdc`).
- Usare accenti italiani reali (à è é ì ò ù), simbolo clausola **§** dove serve, frecce **→** per dipendenze; evitare `?` o U+FFFD al posto degli accenti.
- Prima di chiudere un task gap analysis: rileggere titoli, tabelle e path `Quaderni/` (es. Qualità) e, se possibile, eseguire `node backend/scripts/check-utf8-encoding.js` sui file toccati.
- Playbook esteso: `docs/GUIDA_CONSOLIDATA.md` (sezione *Caratteri non riconoscibili*).

## Risorse aggiuntive

- Catalogo file Normative/Quaderni: [reference.md](reference.md)
- Template matrice copiabile: [../../docs/reference/GAP_ANALYSIS_TEMPLATE.md](../../docs/reference/GAP_ANALYSIS_TEMPLATE.md)

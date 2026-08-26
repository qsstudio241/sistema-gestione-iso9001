# Gap analysis strategica — Fedeltà normativa e crescita capacità agenti

| Campo | Valore |
|-------|--------|
| **Data** | 2026-08-25 |
| **Modulo** | trasversale (harness + runtime AI + fonti) |
| **Standard** | ISO 9001 / 14001 / 45001 / 3834 + asse legislativo SAL |
| **Scope** | tesi: PDCA sistemi di gestione ↔ adesione normativa ↔ ingest MD ↔ skill/agenti |
| **Analista** | Lead (wayfinder A) |
| **Profondità** | completa su architettura/doc; codice solo a campione (NormBroker, skill count) |

## Executive summary

- **Sì**: ProgettoISO è strutturato per supportare **implementazione, monitoraggio e miglioramento** dei sistemi di gestione (ciclo PDCA su più standard e su conformità legislativa).
- **Sì alla direzione**: senza testi normativi in Markdown/DB, agenti e Assistente **non** possono garantire qualità su moduli di conformità; la richiesta al committente + ingest è il modo giusto di crescere.
- **Correzione importante**: non serve una «schiera» di agenti Cursor GitHub. Serve un **loop fonti → poche skill profonde → servizi prodotto** (NormBroker, gap, Second Brain). Due sistemi restano separati: **sviluppo** (ADR-015) e **prodotto** (ADR-010 / Second Brain).
- **Gap principale**: il gate «dichiara fonti / non inventare» esiste già (MC e operating-memory) ma **non è un loop chiuso** con backlog richieste PDF e DoD nei brief di ogni slice norm-touching.
- **Prossimo passo eseguibile**: slice **NG-0** in [`PLAN_NORM_FIDELITY_SLICES.md`](../agent-tasks/PLAN_NORM_FIDELITY_SLICES.md) (policy + template richiesta + backlog stub).

## Fonti consultate (dichiarazione)

| Tipo | Coperto | Mancante / limite |
|------|---------|-------------------|
| Contesto prodotto | `PROJECT_CONTEXT.md`, roadmap § Stato attuale | — |
| Architettura AI | ADR-010, ADR-018, PLAN_SECOND_BRAIN | Connettori UNI Store non operativi come da ADR |
| Skill Cursor repo | gap-analysis, pdf-to-json, wayfinder-sgq | Nessuna skill «conformità legislativa» dedicata |
| Normative MD | ~20+ file in `docs/Normative/` (9001…10219, 9606, 15614, …) + Quaderno LG 1090 in `Quaderni/` | ISO 2560/17632/14174 digitalizzate 26/08 (estratto soglie MC = backlog); 3834-2/-4 ed. 2021 in repo |
| Quaderni | Conforma 9001, Q2–Q6, ATEX, 37001, Accredia, RT-09 | Qualità OCR variabile |
| Runtime | `normBroker.service.js` (local + publicLaw), `gapAnalysis`, seed legislation 81/152 | ApiConnector / WebScraper ADR-010 non nella cascata attuale |
| Inventario MC | `MATERIAL-COMPLIANCE-NORME-SINTESI.md` | Non generalizzato ad altri moduli |

## Matrice gap

| Modulo / asse | Clausola / requisito | Fonte | Stato app oggi | Gap | Tipo | Priorità | Evidenza |
|---------------|----------------------|-------|----------------|-----|------|----------|----------|
| Visione prodotto | PDCA SGQ multi-standard | PROJECT_CONTEXT, roadmap | Implementato (moduli maturi) | Nessuno strategico: Audit/NC/SAL/Riesame/3834/CND/legale | — | — | Roadmap § moduli maturi |
| Harness sviluppo | Prima di seed/gap: dichiarare MD | operating-memory, GUIDA 16/08 | Parziale | Gate limitato a MC/seed/gap; non in ogni brief norm-touching; manca template «richiedi PDF» | Funzionale | P1 | `sgq-operating-memory.mdc` § Fonti Markdown |
| Harness sviluppo | Se manca testo → richiesta a committente | Tesi 25/08 | Assente (informale) | Nessun backlog unico `NORME_MANCANTI`; richiesta ad hoc in chat | Documentale | P1 | File assente |
| Skill Cursor | Agenti specializzati per norma | ADR-015, skills/ | Parziale | Solo 3 skill; crescita corretta = approfondire gap-analysis + ingest, non N agent GitHub | Funzionale | P2 | `.cursor/skills/` |
| Runtime AI | NormBroker multi-source | ADR-010 | Parziale | Cascata reale: local DB + publicLaw; manca scraper/API; fallback «carica PDF» non UX unificata | Funzionale | P2 | `normBroker.service.js` |
| Runtime AI | Gap documentazione vs norma | ADR-010 §5, SAL | Parziale | Motore SAL + suggest legale; non tutti gli standard/clausole; AI cita non certifica (ok) | Funzionale | P1 | `gapAnalysis.service.js`, SAL 5-B |
| Runtime AI | Second Brain / Ambito | PLAN_SECOND_BRAIN | Parziale | SB-1 chiuso; chat non ancora consumatore pieno dei fatti; contesto studio/azienda wizard backlog | Funzionale | P1 | PLAN_SECOND_BRAIN |
| Conformità legislativa | Profilo azienda + obblighi | ADR-018, LEGISL-INGEST | Parziale | Profilo + articoli 81/152 seed; manca copertura settoriale e skill dedicata | Normativo + Documentale | P1 | ADR-018, `legislation_seed` |
| Material Compliance | Soglie da norma prodotto | Sintesi MC | Parziale | Inventario modello; apporto (2560/…) mancante → skip onesto | Documentale | P2 | `MATERIAL-COMPLIANCE-NORME-SINTESI.md` |
| 3834 / RDP | Edizioni vigenti | Normative 00010/00011 | Parziale | 3834-2/-4 in repo come 2006 | Documentale | P1 | skill reference.md |
| CND / 9712 | Qualifica operatori NDT | reference ISO_9712 + PLAN_CND | Parziale | Epic CND operativa; gate 9712 = CND-2 | Funzionale | P1 | PLAN_CND |
| Supervisore + schiera agenti | Orchestrazione specialist | ADR-010, figureKnowledge | Assente come flotta | Esiste un adapter LLM + tool/servizi, non un supervisore multi-agente Cursor in produzione | Funzionale | P2 | ADR-010; vietato seconda governance |
| FE/BE coerente ai dati norma | Campi ↔ clausola | Pattern 9606, MC, ADR-021 | Parziale | Buone pratiche su saldatura/MC; manca checklist obbligatoria nel brief | Funzionale | P1 | GUIDA lezioni Mason |

## Limiti documentali rilevati

| Voce mancante | Impatto | Fonte alternativa |
|---------------|---------|-------------------|
| ISO 3834-2 / -4 ed. 2021 | Digitalizzate 25/08/2026 (`NORMA_00029`/`00030`) | — |
| Quaderno Linea Guida 1090 | **Digitalizzata** 26/08/2026 (`Quaderni/Quaderno_2_Linea_Guida_1090.{md,json,txt}`) | Contesto carpenteria EN 1090; GAP pag. 3 |
| ISO 2560 / 17632 / 14174 | MC apporto: chimica/ReH = skip | PDF → pdf-to-json |
| Norme settoriali oltre 81/152 | Conformità legislativa «per ATECO» incompleta | Elenco HITL + Normattiva |
| Credenziali UNI Store in agent | NormBroker non scarica da store | Ingest manuale PDF (già percorso IA-*) |

## Slice consigliate

Vedi tabella in [`PLAN_NORM_FIDELITY_SLICES.md`](../agent-tasks/PLAN_NORM_FIDELITY_SLICES.md) (NG-0…NG-5).

## Risposta puntuale alla tesi

| Domanda | Verdetto |
|---------|----------|
| Il progetto supporta implementazione / monitoraggio / miglioramento SG? | **Sì** |
| Gli agenti devono sempre chiedersi se sono aderenti alle normative? | **Sì se la slice tocca requisiti/conformità**; no su fix non-normativi |
| Se non hanno i testi, devono richiederli a te? | **Sì**, con template + backlog; senza inventare; senza bloccare il perimetro già coperto |
| Più skill/agenti specializzati migliorano Assistente e moduli? | **Sì se = più fonti MD + skill/servizi mirati**; **no** se = proliferazione agent GitHub / context 1M |
| Frontend/backend coerenti ai dati di monitoraggio? | **Direzione giusta**; formalizzare checklist «dato ↔ norma ↔ UI ↔ API» nei brief (NG-0) |

## Riferimenti

- [ ] `docs/Normative/` (campione + catalogo skill)
- [x] `docs/PROJECT_ROADMAP.md` § Stato attuale
- [x] `PROJECT_CONTEXT.md`
- [x] ADR-010, ADR-015, ADR-018
- [x] PLAN_SECOND_BRAIN, PLAN_MATERIAL_COMPLIANCE (modello inventario)
- [x] `.cursor/skills/gap-analysis-normativa/`
- [x] `backend/src/services/normBroker.service.js`

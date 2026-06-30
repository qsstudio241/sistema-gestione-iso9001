# ADR-001: Multi-Agent Workflow con Tool Approval Policy

> ⚠️ **Stato: Superato da [ADR-015](ADR-015-cursor-lead-deputy-workflow.md)** (2026-06-30)  
> Il workflow Planner/Implementer/Reviewer (GitHub Copilot) è stato sostituito dal modello **Lead/Deputy su Cursor**.  
> Questo documento è conservato come storico. Per il workflow attivo, leggere ADR-015.

---

**Stato**: Superato da ADR-015  
**Data**: 2025-12-14  
**Autore**: System Architect  
**Revisore**: GitHub Copilot  
**Tag**: architettura, governance, qualità

---

## Contesto e Problema

Il progetto **Sistema Gestione ISO 9001** richiede un workflow di sviluppo che garantisca:

1. **Tracciabilità decisioni** architetturali (ISO 9001:2015 punto 7.5)
2. **Separazione responsabilità** tra analisi, implementazione e quality assurance
3. **Prevenzione regressioni** tramite approval controllata di tool e dipendenze
4. **Conformità standard qualità** (coverage ≥80%, OpenAPI validation, ESLint zero-warning)

**Problema**: Workflow tradizionale single-agent:

- Decisioni architetturali non documentate → perdita conoscenza organizzativa
- Modifiche codice senza review preventiva → rischio breaking changes
- Dipendenze aggiunte senza valutazione rischi → vulnerabilità sicurezza
- Test coverage insufficiente → bug in produzione

**Riferimenti ISO 9001:2015**:

- **Punto 4.4**: Sistema di gestione per la qualità - processi necessari e interazioni
- **Punto 6.1**: Azioni per affrontare rischi e opportunità
- **Punto 7.5**: Informazioni documentate - controllo e conservazione

---

## Decisione

**Adottare workflow multi-agent con governance a 3 livelli**:

### 1. Planner Agent (Claude Sonnet 4.5)

**Ruolo**: Analisi architetturale e pianificazione strategica  
**Tool**: `readFile`, `fileSearch` (solo lettura)  
**Output**:

- PLAN numerato (3-7 passi) con Acceptance Criteria
- ADR in `/docs/adr/` per decisioni architetturali
- Handoff strutturato per Implementer Agent

**Vincoli**:

- ❌ NO editing codice diretto
- ❌ NO introduzione dipendenze senza ADR
- ✅ Propone alternative con analisi rischi

### 2. Implementer Agent (Grok Code Fast 1)

**Ruolo**: Esecuzione plan con test iterativi  
**Tool Whitelist**:

- `editFiles`: SOLO in `src/`, `backend/src/`, `tests/`, `docs/adr/`
- `runInTerminal`: SOLO `npm run lint`, `npm test`, `vitest`, `eslint`
- ❌ VIETATI: `npm i`, `npm upgrade`, comandi rete, script non whitelisti

**Output**:

- Diff completo modifiche
- Test summary (coverage report)
- Rollback note per revert rapido

**Procedura**:

1. Legge Handoff (PLAN) + file interessati
2. Propone piano editing → attende approval utente
3. Applica edit minimali → esegue lint+test
4. Itera su fallimenti con fix mirati
5. Consegna diff + summary

### 3. Reviewer Agent (Claude Haiku 4.5)

**Ruolo**: Quality Assurance e conformità standard  
**Tool**: `readFile`, `fileSearch` (solo lettura)  
**Checklist**:

- ✅ ESLint/Prettier conformity
- ✅ Naming conventions (PascalCase/camelCase)
- ✅ Layering architetturale (`api` → `services` → `domain` → `ui`)
- ✅ Multi-tenant isolation (`organization_id`)
- ✅ Sicurezza: no credenziali, JWT httpOnly, rate limit
- ✅ Offline-first: server-wins su campi critici
- ✅ Test coverage ≥80%
- ✅ OpenAPI schema conformity

**Output**: Report strutturato con:

- 🟢 Conformità / 🟡 Warning / 🔴 Blocchi critici
- Raccomandazioni miglioramento
- Riferimenti ISO 9001 pertinenti

---

## Conseguenze

### Impatti Positivi ✅

1. **Tracciabilità**: Ogni decisione architetturale documentata in ADR (ISO 9001:2015 punto 7.5)
2. **Qualità**: Approval preventiva riduce regressioni del 70% (stimato)
3. **Sicurezza**: Tool whitelist previene installazione dipendenze non verificate
4. **Conoscenza**: ADR repository centralizza know-how tecnico (ISO 9001:2015 punto 7.1.6)
5. **Velocità**: Grok Fast per implementazione, Claude Sonnet per analisi profonda

### Impatti Negativi ⚠️

1. **Overhead Iniziale**: Setup workflow richiede 1-2h (mitigato da template ADR)
2. **Learning Curve**: Team deve apprendere sintassi agent-specific (mitigato da documentazione)
3. **Latenza Decisioni**: Approval multi-livello può rallentare hotfix urgenti (mitigato da fast-track emergency)

### Conformità ISO 9001:2015

- **Punto 4.4.1c**: Criteri e metodi per processi → workflow definito con checklist Reviewer
- **Punto 6.1.2**: Pianificazione azioni → PLAN numerato con AC
- **Punto 7.5.3**: Controllo informazioni documentate → ADR versionati in Git
- **Punto 10.2**: Non conformità e azioni correttive → Rollback note per revert

---

## Rischi e Mitigazioni

| Rischio                             | Probabilità | Impatto | Mitigazione                       | Responsabile   |
| ----------------------------------- | ----------- | ------- | --------------------------------- | -------------- |
| Agent bypassa tool whitelist        | Bassa       | Alto    | Monitoring log + audit periodici  | Tech Lead      |
| ADR obsoleto non aggiornato         | Media       | Medio   | Checklist review pre-merge        | Reviewer Agent |
| Handoff ambiguo Planner→Implementer | Bassa       | Alto    | Template handoff standardizzato   | Planner Agent  |
| Hotfix urgente bloccato da approval | Bassa       | Alto    | Fast-track emergency: max 1 agent | Tech Lead      |

**Risk-Based Thinking (ISO 9001:2015 punto 6.1)**:

- **Azione preventiva**: Tool approval hardcoded in agent config
- **Monitoring**: Report settimanale ADR coverage vs codebase changes
- **Riesame**: Quarterly review workflow efficacia con metriche (bug rate, velocity)

---

## Implementazione

### Checklist Attuazione

- [x] Creare `/docs/adr/` con README e template
- [x] Documentare ADR-001 (questo documento)
- [x] Configurare agent definitions in `.github/agents/`
- [x] Aggiornare `style.instructions.md` con riferimenti ADR
- [ ] Training team su workflow (1h session)
- [ ] Primo pilot: implementazione feature minore
- [ ] Retrospettiva post-pilot → adjustment workflow

### File Impattati

```
.github/
├── agents/
│   ├── implementer.agent.md  ← Tool whitelist enforcement
│   ├── planner.agent.md       ← ADR output mandate
│   └── reviewer.agent.md      ← QA checklist
├── instructions/
│   └── style.instructions.md  ← Riferimenti ADR process
├── prompts/
│   └── implementation.prompt.md ← Handoff template
docs/
└── adr/
    ├── README.md              ← Indice ADR
    ├── template.md            ← Template standard
    └── ADR-001-*.md           ← Questo documento
```

### Acceptance Criteria

1. **Funzionale**:

   - ✅ Planner genera ADR in `/docs/adr/` con template compliant
   - ✅ Implementer applica solo modifiche in whitelist path
   - ✅ Reviewer produce report strutturato con checklist

2. **Tracciabilità**:

   - ✅ Ogni modifica ≥ medium complexity referenzia ADR-NNN in commit message
   - ✅ ADR index aggiornato in `/docs/adr/README.md`

3. **Sicurezza**:

   - ✅ Zero esecuzioni `npm i` da Implementer senza ADR approvato
   - ✅ Tool approval log auditable in `.github/workflows/`

4. **Qualità**:
   - ✅ Coverage resta ≥80% post-implementazione
   - ✅ ESLint zero warning dopo edit Implementer

---

## Note Aggiuntive

**Workflow Emergency (Fast-Track)**:

- **Trigger**: Bug critico in produzione (P0 severity)
- **Procedura**: Single agent (Implementer) con post-review obbligatoria entro 24h
- **Audit**: Report incident con root cause analysis (ISO 9001:2015 punto 10.2)

**Tool Approval Exceptions**:

- Dipendenze security patch: approval automatica se CVE score ≥7
- Upgrade Node.js LTS: richiede ADR solo per major version

**Riferimenti Esterni**:

- [Architectural Decision Records (ADR)](https://adr.github.io/)
- [ISO 9001:2015 Clause 7.5 - Documented Information](https://www.iso.org/standard/62085.html)

---

## Changelog

| Data       | Modifica          | Autore           |
| ---------- | ----------------- | ---------------- |
| 2025-12-14 | Creazione ADR-001 | System Architect |

---

**Approvazione**:

- ✅ Planner Agent: 2025-12-14
- ✅ Reviewer Agent: 2025-12-14
- ✅ Tech Lead: 2025-12-14

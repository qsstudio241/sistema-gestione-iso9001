# ADR-019 — Registro obblighi legali: Ambiente (152/06) e Sicurezza (81/08) separati, granularità sotto-domande, agente di validità normativa

> **Stato**: Accettato — 28 luglio 2026
> **Autori**: Lead architect (AI), Product owner (Camellini)
> **Origine**: gap analysis su `Matrice 14001-45001 Grantini [compilata].pdf` (report reale, 46 pag., Dr. Grantini AICQ-SICEV) e `Matrice Certiquality_14001_Remix [vuota].docx` (template ente di certificazione)
> **Brief operativi**: [DEPUTYTASK1.md](../agent-tasks/DEPUTYTASK1.md) (BE schema) · [DEPUTYTASK2.md](../agent-tasks/DEPUTYTASK2.md) (FE render) · [DEPUTYTASK3.md](../agent-tasks/DEPUTYTASK3.md) (contenuto sicurezza P0) · [DEPUTYTASK4.md](../agent-tasks/DEPUTYTASK4.md) (agente validità normativa)
> **Correlati**: ADR-011 (registry norme SoT), ADR-018 (company_profile), [MODULO_SAL_SCOPO_E_ROADMAP.md](../specs/MODULO_SAL_SCOPO_E_ROADMAP.md) (motore gap SAL, `linked_legislation`)

---

## 1. Contesto

I due documenti mostrano cosa Camellini intende per "report di verifica di presunzione di conformità legislativa": per ciascun **capitolo tematico** (es. "5. IMPIANTI TERMICI"), un blocco di **riferimenti legislativi narrativi** (leggi/decreti/regolamenti aggiornati) seguito da **sotto-domande a) b) c)…** con risposta **SI / NO / NA** + annotazioni. Il report combina **ambiente** (D.Lgs. 152/06, ~29 capitoli) e **sicurezza** (D.Lgs. 81/08, ~30 capitoli) in un unico documento, su più sedi.

Gap analysis (sessione 27–28/07/2026) rispetto allo stato attuale del repo:

| Cosa esiste già | File |
|---|---|
| Matrice ambientale a livello di capitolo (46 voci, 1 riga/capitolo, nessuna sotto-domanda) | `app/src/data/checklistTemplates.js` (`ISO_14001_LEGISLATIVO_TEMPLATE`, `standardCode: LEG_AMBIENTE_152`), `backend/src/data/legislativoAmbientaleTemplate.js` |
| Testo di legge collegato a clausole ISO (30 articoli, D.Lgs 81/08 + 152/06) | `backend/data/legislation_seed.json`, formato `linked_legislation` parsato da `salAiSuggest.service.js` (`parseLinkedLegislation`) |
| **Agente di verifica validità norme già esistente** — cron settimanale (lunedì 03:00), email "norme superate" | `backend/src/services/normValidityChecker.service.js` + `alertScheduler.js` (`runNormValidityJob`), connettori `normativaConnector` (Normattiva) e `eurLexConnector` (EUR-Lex) già cablati in `normCatalogLookup.service.js`. **PR #65 (25/05/2026), già in produzione.** |
| Dati di contesto azienda (ATECO, sedi, SSL, ambiente) | ADR-018 `company_profile` (S0 doc fatto, S1–S3 in `DEPUTYTASK.md`, **non toccare in questo ADR**) |
| Nessun template capitolo-per-capitolo per la **sicurezza** (D.Lgs. 81/08) | — assente |
| Nessuna granularità a sotto-domanda (a/b/c + SI/NO/NA) in nessun template | — assente |

**Correzione a una domanda del committente**: l'"agente che verifica periodicamente le leggi e genera alert" **esiste già** (non va creato da zero). Il suo perimetro attuale però è **coarse**: verifica se un intero atto/norma registrato in `document_registry` (con `doc_type='norma'`) è ancora vigente o è stato sostituito/abrogato — non verifica se il *testo di un singolo articolo* citato in un capitolo del registro obblighi è cambiato. Questa distinzione guida la Decisione 5 più sotto.

---

## 2. Decisioni

### D1 — Due moduli separati: Ambiente e Sicurezza

Confermata la richiesta del committente. **Non** un unico "registro obblighi legali" monolitico:

| Modulo | `standardCode` custom checklist | Capitoli | Fonte contenuti |
|---|---|---|---|
| Conformità legislativa **ambientale** | `LEG_AMBIENTE_152` (esiste, da portare a granularità sotto-domanda — P2) | ~29 (D.Lgs. 152/06) | Certiquality docx + Grantini pag. 1–27 |
| Conformità legislativa **sicurezza** | `LEG_SICUREZZA_81` (nuovo — **P0**) | ~30 (D.Lgs. 81/08) | Grantini pag. 28–46 |

Motivazione: isola il blast radius del content-authoring (ambiente e sicurezza sono competenze diverse, aggiornate da fonti diverse, con cicli di modifica indipendenti — coerente con la separazione già fatta in ADR-018 §3.2/3.3 tra campi SSL e campi Ambiente).

### D2 — Granularità: riuso di `custom_checklist_sections`, non nuovo concetto

**Non** si introduce un nuovo concetto "topic/parent-child" sugli item. Si riusa la gerarchia **già esistente** `custom_checklist` → `custom_checklist_sections` → `custom_checklist_items` (migrazione 025):

- **1 capitolo = 1 sezione** (`custom_checklist_sections`, oggi già esistente, oggi usata per raggruppamenti larghi come "4 - AMBIENTE E SICUREZZA"). In questa iniziativa una sezione = un capitolo puntuale (es. "5. IMPIANTI TERMICI"), non un macro-raggruppamento.
- **Sotto-domande a/b/c… = item della sezione** (`custom_checklist_items`, già esistenti, nessuna modifica strutturale).
- **Riferimenti legislativi narrativi** = **due nuove colonne nullable su `custom_checklist_sections`** (nessuna nuova tabella, nessuna modifica a `custom_checklist_items`):
  - `reference_text NVARCHAR(MAX) NULL` — testo narrativo leggibile (l'elenco leggi/decreti come nei due documenti di riferimento).
  - `linked_legislation NVARCHAR(MAX) NULL` — stringa parsabile, **stesso formato già usato da SAL** (`"D.Lgs. 81/2008 art.28; art.29"`), per l'agente di validità (D5).

**Perché questa scelta e non un nuovo `parent_item_id`/`item_kind`**: zero nuove tabelle, zero nuove colonne su `custom_checklist_items` (la tabella con più righe e più codice a valle — export Word, risposte, allegati), zero rischio di regressione sui checklist esistenti (RDP_MSN, SAL evidence linking, ecc. — nessuno di questi usa `custom_checklist_sections.reference_text`, quindi resta `NULL` e invisibile). Il rendering (FE) e l'export (Word) iterano già "sezioni → item": basta aggiungere "se la sezione ha `reference_text`, mostralo prima degli item" — **nessuna modifica alla struttura di iterazione esistente**.

### D3 — Risposta sotto-domanda: sottoinsieme dei pulsanti esistenti, non un nuovo widget

I documenti di riferimento usano SI/NO/NA. Il repo ha già 6 pulsanti standard (`status-btn compliant/non-compliant/partial/om/not-applicable/not-verified` — regola *Riuso UI*). **Non si crea un nuovo componente**: si aggiunge a `QuestionCard.jsx` una prop opzionale `statusOptions` (default = i 6 pulsanti attuali, **retrocompatibile al 100%**) che permette di passare un sottoinsieme (`C`→SI, `NC`→NO, `NA`→NA) per gli item con `response_type` dedicato (nuovo valore stringa, es. `legal_check` — **non richiede migrazione**: la colonna `custom_checklist_items.response_type` non ha `CHECK` constraint, migrazione 025).

### D4 — Reporting: export per modulo (P1), export combinato come aggregatore (P2, secondario)

Confermato l'ordine di priorità del committente. L'export Word riusa il motore già esistente per checklist custom (`wordExport.js`); l'unica estensione necessaria è stampare `reference_text` come paragrafo introduttivo di ogni sezione. L'export "combinato" (ambiente + sicurezza nello stesso file) è un **aggregatore** che concatena i due export esistenti con una copertina comune — non un nuovo layout da progettare da zero. Va fatto **dopo** che i due moduli esistono e sono stabili (P2).

### D5 — Agente di validità normativa: estendere l'esistente, non duplicare, due livelli onesti

**Non si crea un secondo agente.** Si estende `normValidityChecker.service.js` + `alertScheduler.js` (job già schedulato lunedì 03:00). Due livelli, dichiarati esplicitamente perché hanno costo e affidabilità molto diversi:

| Livello | Cosa verifica | Fattibilità | Riuso |
|---|---|---|---|
| **Tier 1 (P1, in questa iniziativa)** | L'**atto** citato in `custom_checklist_sections.linked_legislation` (es. "D.Lgs. 81/2008") è ancora vigente, o è stato abrogato/sostituito? | **Alta** — riusa 100% `normattivaConnector.lookupNormStatus` + `eurLexConnector`, già funzionanti e in produzione (PR #65) | Estensione: nuova query che itera le sezioni con `linked_legislation` popolato, per azienda/organizzazione, e genera alert (email esistente + banner in-app sulla sezione) se l'atto risulta superato |
| **Tier 2 (backlog, fuori da questa iniziativa)** | Il **testo di un singolo articolo** citato è cambiato (non l'intero atto) — richiede fetch periodico + diff contro il testo salvato in `legislation_seed.json`/DB, gestione hash contenuto | **Bassa oggi** — nessuna infrastruttura di diff testo esiste; effort non banale, rischio falsi positivi su rendering Normattiva (pagine JS-only, vedi nota storica su ingest) | Da progettare in un ADR dedicato quando serve; **mai** riscrittura automatica del testo — solo flag "possibile modifica, verificare" |

**Vincolo invariato (AI human-in-the-loop, come SAL/ADR-010)**: l'agente **segnala**, non modifica mai da solo il contenuto normativo salvato. Nessun overwrite silenzioso.

**Riuso obbligatorio**: la funzione `parseLinkedLegislation` (oggi privata in `salAiSuggest.service.js`) va estratta in un util condiviso (es. `backend/src/utils/linkedLegislationParser.js`) **prima** di usarla nel nuovo codice, per evitare due implementazioni divergenti dello stesso parsing (stesso principio "un motore, N consumatori" già applicato al gap engine SAL — vedi §K.3 di MODULO_SAL_SCOPO_E_ROADMAP.md). L'estrazione è un refactor meccanico protetto dai test esistenti di SAL.

### D6 — Contenuto normativo: mai inventato, sempre da fonte verificata

Il testo delle sotto-domande e dei riferimenti legislativi (D3 nei due documenti di riferimento) **non va generato/inventato da un agente AI**. Fonti ammesse, in ordine di preferenza:

1. I due documenti forniti dal committente (Grantini PDF, Certiquality docx) — **solo la parte strutturale** (titoli capitolo, sotto-domande a/b/c, elenco leggi/decreti): **non** le "Evidenze Raccolte" specifiche del cliente terzo SAVECO Italia Srl citato nel PDF Grantini (dato di un cliente non nostro — non va persistito nel repo né nel prodotto).
2. Normattiva.it / EUR-Lex (stesso principio già usato per `legislation_seed.json` — pubblico dominio, art. 5 L. 633/1941).
3. Se una sotto-domanda non è chiaramente riconducibile a una fonte verificata, si segnala come **gap documentale** (non si scrive un placeholder plausibile).

Il committente dovrà rendere disponibili i due file di origine al Deputy che esegue lo Slice 3 (upload nella chat del Deputy, o salvataggio in una cartella locale non versionata — **mai committare** dati di clienti terzi nel repo).

### D7 — Policy di test e parallelizzazione (per l'alto numero di slice)

- **Contratto congelato prima di parallelizzare**: le 2 nuove colonne (D2) e la nuova prop `statusOptions` (D3) sono **definite qui, non nel codice** — questo permette a BE (DEPUTYTASK1) e FE (DEPUTYTASK2) di partire **in parallelo** senza aspettarsi a vicenda, integrando a fine slice.
- **Test L1 mirato per slice** (non suite intera ad ogni commit): ogni DEPUTYTASK indica i file di test specifici da eseguire. Full Vitest/Jest + `npm run build` solo ai **gate** (fine Slice 1+2 insieme, fine Slice 3, fine Slice 4).
- **File disgiunti per stream** (regola multitasking `sgq-workflow-method.mdc`): matrice di ownership in §4.
- **Nessuna migrazione DB condivisa tra stream in parallelo**: solo DEPUTYTASK1 tocca `database/migrations/`.

---

## 3. Cosa NON fare

- Non toccare `checklist_questions` / `audit_responses` (motore standard ISO 9001/14001/45001/3834 — fuori perimetro, massimo rischio di regressione).
- Non introdurre un nuovo concetto `item_kind`/`parent_item_id` (D2 — riuso sezioni).
- Non creare un secondo scheduler/agente di validità normativa (D5 — estendere l'esistente).
- Non generare testo di legge o sotto-domande "plausibili" senza fonte verificata (D6).
- Non persistere nel repo/prodotto le evidenze specifiche del cliente terzo citato nei documenti di riferimento (D6).
- Non toccare `DEPUTYTASK.md` (company_profile ADR-018, S1–S3 ancora aperto — stream indipendente, file disgiunti).
- Non unificare ambiente+sicurezza in un unico export prima che i due moduli singoli siano stabili (D4).

---

## 4. Matrice di ownership file (parallelizzazione sicura)

| Stream | Brief | Scrive | Non tocca |
|---|---|---|---|
| **1 — BE Schema** | [DEPUTYTASK1.md](../agent-tasks/DEPUTYTASK1.md) | `database/migrations/138_*.sql` (rinumerata da 135 in fase di merge con main — vedi §7ter), script VPS, `customChecklist.controller.js`/`.service.js` (esposizione campi in risposta API) | FE, `salAiSuggest.service.js` |
| **2 — FE Render** | [DEPUTYTASK2.md](../agent-tasks/DEPUTYTASK2.md) | `QuestionCard.jsx` (prop opzionale), `CustomChecklistAuditView.jsx`, CSS | migrazioni, controller/service BE |
| **3 — Contenuto sicurezza (P0)** | [DEPUTYTASK3.md](../agent-tasks/DEPUTYTASK3.md) | Nuovo dato `backend/src/data/legislativoSicurezzaTemplate.js` + script build analogo a `buildLegislativoAmbientaleTemplate.js` + nuovo template FE in `checklistTemplates.js` (`LEG_SICUREZZA_81`) | schema, FE render generico, agente validità |
| **4 — Agente validità (P1)** | [DEPUTYTASK4.md](../agent-tasks/DEPUTYTASK4.md) | `backend/src/utils/linkedLegislationParser.js` (nuovo, estratto), `normValidityChecker.service.js`, `alertScheduler.js` | FE, migrazione 138 (usa le colonne dopo che Stream 1 le ha create) |

Sequenza: **1 e 2 partono insieme** (contratto già congelato in questo ADR). **3 parte in parallelo** appena disponibile il contenuto sorgente (non dipende dal codice di 1/2 per iniziare la trascrizione, dipende solo per il test end-to-end finale). **4 dipende da 1** (le colonne devono esistere) ma è indipendente da 2/3 nel codice.

---

## 5. Schema dati (riferimento per DEPUTYTASK1)

```sql
-- Migration 138 (idempotente — rinumerata da 135, vedi §7ter)
ALTER TABLE dbo.custom_checklist_sections ADD reference_text NVARCHAR(MAX) NULL;
ALTER TABLE dbo.custom_checklist_sections ADD linked_legislation NVARCHAR(MAX) NULL;
```

Nessuna nuova tabella. Nessun `ALTER` su `custom_checklist_items`, `audit_custom_checklist_responses`, `attachments`. `response_type` continua a non avere `CHECK` — il nuovo valore convenzionale `legal_check` è solo un contratto applicativo (documentato qui e nei DEPUTYTASK), non un vincolo DB.

---

## 6. Rischi

| Rischio | Mitigazione |
|---|---|
| Estrazione `parseLinkedLegislation` (D5) rompe SAL Fase 5-B | Refactor meccanico (sola move + re-import), gate con suite SAL esistente (`salAiSuggest.service.test.js`, `salAiSuggest.test.jsx`) verde prima di procedere |
| Content-authoring (Stream 3) introduce citazioni di legge errate/inventate | D6 vincolante; revisione umana (committente) obbligatoria prima di considerare il template "pubblicabile" per un cliente reale, come già previsto per `pdf_to_json` (revisione `.md` prima del `.json`) |
| Troppi stream paralleli sullo stesso file per errore | Matrice §4 esplicita; ogni DEPUTYTASK elenca "file previsti" e "non toccare" |
| Tier 2 (diff testo articoli) percepito come "già incluso" | D5 lo dichiara esplicitamente backlog, fuori da questa iniziativa |
| Sezioni granulari (1 per capitolo) rompono assunzioni UI su "poche sezioni larghe" | Verificare in Slice 2 che non ci sia paginazione/limite hardcoded sul numero di sezioni (grep mirato prima di scrivere codice) |

---

## 7. Test previsti (per gate, non per singolo commit)

| Gate | Cosa eseguire |
|---|---|
| Fine Stream 1+2 | `cd app && NODE_ENV=test npx vitest run src/tests/salModule.test.jsx src/tests/customChecklistTemplates.test.js` (mirato) → poi gate pieno: `npm run test:run` + `npm run build`; backend: Jest mirato su `customChecklist.*` |
| Fine Stream 3 | Vitest mirato su nuovo template + smoke manuale (computerUse) apertura checklist `LEG_SICUREZZA_81` in audit reale |
| Fine Stream 4 | Jest su `linkedLegislationParser` + `normValidityChecker` (mock Normattiva/EUR-Lex) + verifica manuale log job (non attendere lunedì: eseguire funzione direttamente da script diagnostico, pattern Fase 4c di `sgq-bug-fix-methodology.mdc`) |

---

## 7bis. Registro note aperte (chiusura obbligatoria entro fine Stream 4)

> Tracciamento vincolante richiesto dal committente 28/07/2026: nessuna area emersa durante l'esecuzione degli stream può restare non tracciata o non chiusa entro la fine dello Stream 4.

| # | Nota | Origine | Stato | Chiusura |
|---|------|---------|-------|----------|
| N1 | Capitolo "IMPIANTI ED APPARECCHIATURE ELETTRICHE / ALTRE RETI TECNOLOGICHE" assente dallo scaffold capitoli di DEPUTYTASK3 (scoperto durante QA Lead) | Scaffold Lead incompleto (regex di estrazione titoli con limite lunghezza riga troppo corto) | ✅ **Risolto** | Aggiunto come `leg_sic_29` in `checklistTemplates.js`, contenuto verificato riga per riga contro `/tmp/analisi_matrici/grantini_extract.txt` (righe 3990-4057) |
| N2 | Capitolo 16 "RISCHIO ELETTRICO" conteneva citazioni (D.P.R. 462/2001, art. 84/86, Legge 186/1968, CEI 64-8) reali ma **mal attribuite** — appartenenti al capitolo N1, non al 16 | Estrazione lineare da PDF multi-colonna (rischio noto, vedi skill `pdf-to-json`) | ✅ **Risolto** | Capitolo 16 ripulito alle sole 4 fonti genuinamente presenti nel suo blocco testuale (righe 3908-3921); le altre spostate su N1 |
| N3 | Template sicurezza senza sotto-domande a)/b)/c) (fonte Grantini non le contiene per i capitoli sicurezza — solo Certiquality le ha, ed è ambiente-only) | Limite documentale della fonte, non bug | ✅ **Documentato come limite accettato** | `LEG_SICUREZZA_81` resta a granularità di capitolo (`questions: []`), pari a `LEG_AMBIENTE_152` prima di questa iniziativa. Backlog: applicare la granularità SI/NO/NA quando sarà disponibile una fonte sicurezza con sotto-domande, o estendendo prima l'ambiente via Certiquality docx (P2) |
| N4 | Mancava l'opzione "Non Verificato" (NV) nelle risposte SI/NO/NA dei capitoli `legal_check` | Richiesta esplicita del committente 28/07/2026 | ✅ **Risolto** | `LEGAL_STATUS_OPTIONS` in `CustomChecklistAuditView.jsx` riusa l'opzione `NV`/`not-verified` già esistente in `STATUS_BUTTONS` (nessun nuovo stato inventato) — ora 4 pulsanti: Sì/No/Non applicabile/Non Verificato |
| N5 | Revisione umana completa (consulente) di tutte le 29 sezioni del registro sicurezza prima dell'uso con un cliente reale | D6 (vincolo permanente, non specifico di questa sessione) | 🔲 **Aperto per natura** — non chiudibile da un agente | Il Lead ha fatto QA a campione (spot-check su ~10 dei 29 capitoli, citazioni verificate verbatim contro la fonte) e una revisione a lettura piena delle sezioni 1-9, 14-16, 21, 23, 26-29. Copertura non esaustiva sulle rimanenti (17-20, 22, 24-25): consigliata lettura finale del consulente prima di un audit reale, come da D6 |

**Nota su N5**: non è un'"area incompleta lasciata a metà" nel senso di lavoro non fatto — è un vincolo strutturale del processo (D6): nessun contenuto normativo va considerato definitivo senza revisione umana finale, indipendentemente da quanta QA automatica/Lead si fa. Le prime 4 note sono invece pienamente chiuse.

---

## 7ter. Merge con `main` (29/07/2026) — conflitti e classificazione

`main` è avanzato di 17 commit dopo la creazione di questo branch (moduli NC, Qualifiche, Ingest — non correlati a questa iniziativa). Fetch + merge eseguiti; **un solo conflitto** rilevato su 70+ file toccati da `main` nel frattempo.

| File | Tipo di conflitto | Causa | Classificazione | Risoluzione |
|---|---|---|---|---|
| `backend/scripts/run-migration-135-vps.js` | `add/add` (stesso path, contenuto diverso) | **Collisione di numerazione migrazione**: sia questo branch (`reference_text`/`linked_legislation`) sia `main` (`effectiveness_verification_notes` su `non_conformities`, migrazione NC) hanno assegnato indipendentemente il numero **135** — nessuno dei due sapeva dell'altro (sviluppo parallelo, sequenza condivisa non sincronizzata in tempo reale) | **Non è un conflitto di intenti**: le due migrazioni toccano tabelle completamente diverse (`custom_checklist_sections` vs `non_conformities`), nessuna sovrapposizione logica. È un conflitto **strutturale/di numerazione** — richiede rinumerare, non solo scegliere un lato del `diff` | ✅ **Risolto**: mantenuto `run-migration-135-vps.js` di `main` (gli appartiene legittimamente, essendo mergiato per primo su `main`). Migrazione di questo branch **rinumerata 135→138** (primo numero libero dopo 135-137 già occupati da `main`): `database/migrations/138_custom_checklist_sections_legal_reference.sql` + nuovo `run-migration-138-vps.js`, contenuto identico solo con numero aggiornato nei commenti/log. Aggiornati i riferimenti in questo ADR (§4, §5) |

**Tutti gli altri file** (`customChecklist.service.js`/`.controller.js`, `checklistTemplates.js`, `deploy-manifest.json`, `GUIDA_CONSOLIDATA.md`, `PROJECT_ROADMAP.md`, ecc.) si sono uniti automaticamente senza conflitti: `main` ha toccato moduli disgiunti (NC, Qualifiche, Ingest) rispetto a questa iniziativa (registro obblighi legali).

**Nessun conflitto di intenti trovato**: nessuna delle modifiche di `main` ridefinisce, rimuove o contraddice una decisione presa in questo ADR.

**Lezione per la sequenza migrazioni condivisa**: la verifica "ultimo numero libero" (`ls database/migrations/ | sort -t_ -k1 -n | tail -5`) va rifatta **al momento del merge finale**, non solo all'inizio dello slice — su un repo con più stream/agenti paralleli il numero può essere preso da un altro branch nel frattempo. Il controllo puntuale nel brief (DEPUTYTASK1, §Slice 1) ha funzionato per l'assegnazione iniziale, ma non copre la finestra tra "scrittura branch" e "merge in main".

**Nota tecnica (per chi ripete questa operazione)**: durante la prima esecuzione di questo merge, un `git stash` intermedio a metà risoluzione conflitto ha rimosso silenziosamente lo stato di merge in corso (`MERGE_HEAD`), producendo un indice incoerente. **Mai usare `git stash` durante un merge con conflitti irrisolti**: se serve un'ispezione parallela, usare `git worktree add` con un checkout separato, oppure completare/abortire il merge prima di cambiare contesto. Recuperato con `git reset --hard HEAD` (il merge non era ancora committato) e rieseguito da capo senza interruzioni.

---

## 8. Esito atteso

Camellini ha due moduli di conformità legislativa (ambiente, sicurezza) capitolo-per-capitolo con sotto-domande SI/NO/NA e riferimenti di legge visibili, export Word per modulo (+ combinato in seconda battuta), e un agente già esistente ora esteso per segnalare quando l'atto normativo citato in un capitolo non è più vigente — senza toccare il motore di audit standard usato da tutti gli altri moduli.

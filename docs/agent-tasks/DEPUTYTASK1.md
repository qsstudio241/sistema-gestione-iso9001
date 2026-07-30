# DEPUTYTASK1 — P0 Generatore WPS da WPQR (Tabella 5 + caso Mason FW)

**Stato:** CHIUSO — TEST OK (30/07/2026, deputy)
> Riepilogo chiusura: Slice A (Tabella 5 + footnote a/b/c in `weldingQualificationRules15614.js` FE/BE mirror + test) + B (`wpsGenerator.service.js` matching deterministico, deploy-manifest) + C (caso Mason FW S355/S235 + controesempi) completate. Nessun endpoint/UI (P1). Nessuna scrittura DB. Merge PR: tocca backend service — conferma committente se richiesto da policy.

**Stato storico:** APERTO  
**Priorità:** P0 — pivot prodotto modulo WPS (Mason)  
**Branch base:** `main`  
**Branch:** `cursor/wps-generator-p0-tab5-1f74`  
**Creato da:** Lead 30/07/2026  
**Spec:** [MODULO_WPS_GENERAZIONE_SCOPO_E_ROADMAP.md](../specs/MODULO_WPS_GENERAZIONE_SCOPO_E_ROADMAP.md)  
**Norma:** [ISO-15614-1-range-validita-WPQR.md](../reference/ISO-15614-1-range-validita-WPQR.md) · digitalizzato `docs/Normative/Normative NORMA_00019_ UNI EN ISO 15614-1_2017 Rev. 0.md` (Table 5, pag. ~27–28)  
**Cataloghi:** `materialGroups15608.js`, `weldingQualificationRules15614.js` (app + backend mirror)

> **Allineamento Git (autonomo)**: prima di leggere questo brief eseguire `git fetch origin main` e `git pull origin main`. **Non** chiedere al committente di farlo. Verificare che questo file su `origin/main` abbia `Stato: APERTO`.

---

## Contesto (leggere prima)

Il modulo WPS non deve centrarsi sull’**ingest PDF WPS**. Il flusso corretto (feedback Mason):

> Genera una WPS per saldatura **FW** di **S355** sp. **10 mm** con **S235** sp. **5 mm**, usando le WPQR disponibili; segnala se non realizzabile perché mancano le estensioni necessarie.

**P0 = fondazione deterministica** (senza UI completa né endpoint pubblico obbligatorio):

1. Codificare **ISO 15614-1 Tabella 5** (acciai) in JS come lookup verificabile.
2. Servizio `wpsGenerator` che fa matching WPQR → copertura → bozza WPS o elenco estensioni.
3. Test L1 sul caso Mason (e controesempi).

L’AI (parse linguaggio naturale / redazione note) è **fuori scope P0** — input strutturato. P1 aggiungerà endpoint + UI + AskAi.

### Mapping gradi caso Mason (ISO/TR 15608)

| Grado | Re tipico | Gruppo |
|-------|-----------|--------|
| **S235** | 235 MPa | **1.1** (`Re ≤ 275`) |
| **S355** | 355 MPa | **1.2** (`275 < Re ≤ 360`) |

Dissimile 1.2 ↔ 1.1: cella Tabella 5 per materiale A/B nel gruppo **1** → combinazione **1-1** (coperta da prova su gruppo 1). Footnote **(a)**: gruppi 1/2/3/11 qualificano acciai a snervamento **uguale o inferiore**.

---

## Cosa NON toccare

- Pipeline ingest WPQR / patentini / ADR-017 (resta).
- Sync audit / ADR-008 / auth JWT.
- UI completa «Genera WPS» (P1).
- Nascondere/rimuovere `WpsUploadButton` (P2).
- Tabella 6 (nichel) — fuori P0 salvo stub `not_implemented`.
- Tabella 7 Level 1 (GAP estrazione) — non inventare cifre; riusare solo Level 2 già codificato + range dichiarati sul WPQR (`thickness_min`/`thickness_max`).

---

## Slice A — Tabella 5 in `weldingQualificationRules15614.js`

**File:**

- `backend/src/data/weldingQualificationRules15614.js`
- `app/src/data/weldingQualificationRules15614.js` (**mirror identico**)
- `backend/src/data/weldingQualificationRules15614.test.js` (+ mirror test FE se esiste pattern)
- Aggiornare estratto: `docs/reference/ISO-15614-1-range-validita-WPQR.md` (sezione Tabella 5: «codificata in JS — P0»)

**API da esportare (nomi suggeriti):**

```js
/** Normalizza '1.2' | '1' | 'group 1.2' → { group: 1, subgroup: '1.2' } */
normalizeMaterialGroupCode(code)

/**
 * Verifica se una prova su materialGroupTested copre parentA + parentB (dissimile o omogeneo).
 * Usa matrice Table 5 + footnotes a/b/c dal MD digitalizzato (celle markdown pulite righe 1–11).
 * @returns {{ covered: boolean, reason: string, qualifiedCombinations?: string[] }}
 */
isParentMaterialCombinationCovered({ materialGroupTested, parentGroupA, parentGroupB })

/**
 * Mappa gradi commerciali comuni → codice 15608 (minimo: S235→1.1, S355→1.2).
 * Estendibile; se sconosciuto → null + warning.
 */
resolveSteelGradeToGroup(gradeName)
```

**Fonte matrice:** preferire le **tabelle Markdown** nel file norma (righe ~643–649 e ~689–697), non il testo a flusso interfogliato sopra. Footnote:

- **(a)** gruppi 1, 2, 3, 11 → snervamento uguale o inferiore  
- **(b)** gruppi 4, 5, 6, 8, 9 → stesso sottogruppo e sottogruppi inferiori dello stesso gruppo  
- **(c)** gruppi 7 e 10 → solo stesso sottogruppo  

**Test obbligatori Tabella 5:**

| Caso | Atteso |
|------|--------|
| Testato `1` o `1.2`, genitori `1.2`+`1.1` (S355+S235) | `covered: true` |
| Testato `8.1`, genitori `1.2`+`1.1` | `covered: false` |
| Testato `1.1`, genitore solo `1.2` (omogeneo S355) | `covered: false` per footnote (a) se si interpreta snervamento superiore non coperto; documentare regola applicata nel test |
| Input null/garbage | `covered: false` o null sicuro, no throw |

---

## Slice B — `wpsGenerator.service.js` (deterministico)

**File nuovi:**

- `backend/src/services/wpsGenerator.service.js`
- `backend/src/services/wpsGenerator.service.test.js`
- Aggiornare `backend/scripts/deploy-manifest.json` se il file va in produzione (anche se endpoint P1: includere già il service)

**Firma suggerita:**

```js
/**
 * @param {object} params
 * @param {number} params.organizationId
 * @param {number|null} params.companyId  // Ambito
 * @param {object} params.request
 * @param {string} params.request.joint_type  // 'FW' | 'BW' | ...
 * @param {string} [params.request.welding_process] // es. '135'
 * @param {string} params.request.parent_material_a  // 'S355' o '1.2'
 * @param {string} params.request.parent_material_b  // 'S235' o '1.1'
 * @param {number} params.request.thickness_a_mm
 * @param {number} params.request.thickness_b_mm
 * @param {object[]} [params.wpqrRecords] // se assente, carica da DB scope org/company
 * @returns {Promise<{
 *   status: 'ok'|'partial'|'not_possible',
 *   wpqr_used: object|null,
 *   candidates: object[],
 *   wps_draft: object|null,
 *   extensions_needed: string[],
 *   warnings: string[]
 * }>}
 */
async function generateWpsFromWpqr(params)
```

**Logica matching (ordine):**

1. Scope: `organization_id` + opzionale `company_id` (pattern Ambito).
2. Filtro processo se richiesto.
3. Filtro tipo giunto se il WPQR lo espone (`joint_type` / campi copertura mig. 133); se assente → `warning` e non escludere in automatico (graceful).
4. **Materiale**: `isParentMaterialCombinationCovered`.
5. **Spessore FW**: usare `thickness_min`/`thickness_max` del WPQR se presenti; altrimenti `computeQualifiedFilletThroatThicknessRange` / range Level 2 già esistenti **solo come suggerimento** con `partial` + warning se si calcola da `thickness_tested`. Entrambi gli spessori richiesti (5 e 10) devono cadere nel range materiale base applicabile, o documentare regola FW adottata (spessore max dei due / entrambi) in commento + test.
6. Se nessuna candidata → `not_possible` + `extensions_needed` human-readable in italiano (es. «Nessuna WPQR copre il gruppo materiale 1.2–1.1», «Spessore 10 mm fuori range dichiarato sulla WPQR X»).
7. Se ok → `wps_draft` minimo allineato a campi `welding_procedures` / 15609: `welding_process`, `material_group`, `joint_type`, `thickness_range_min/max`, `qualification_standard` / `wpqr_ref`, filler/gas/posizione se presenti sulla WPQR. **Nessuna scrittura DB in P0** — solo oggetto draft.

**Cosa NON fare in P0:** chiamare `aiProviderAdapter`, creare route HTTP, modificare frontend.

---

## Slice C — Test caso Mason + chiusura

**Fixture WPQR minima (in-memory, no DB obbligatorio nei unit test):**

```js
{
  id: 1,
  wpqr_code: 'WPQR-MASON-DEMO',
  welding_process: '135',
  base_material_group: '1.2',
  joint_type: 'FW',
  thickness_tested: 10,
  thickness_min: 3,
  thickness_max: 20,
  // ...
}
```

**Casi test generatore:**

| # | Scenario | status atteso |
|---|----------|---------------|
| 1 | FW S355 10 + S235 5, WPQR demo sopra | `ok` (o `partial` solo se warning non bloccanti) |
| 2 | Stesso, WPQR `base_material_group: '8.1'` | `not_possible`, extensions con materiale |
| 3 | Stesso, `thickness_max: 8` | `not_possible` o extensions spessore |
| 4 | Lista WPQR vuota | `not_possible`, messaggio registro vuoto |

**DoD:**

- [x] Jest backend verdi sui nuovi test
- [x] Mirror FE `weldingQualificationRules15614.js` sincronizzato; test FE se già presenti per quel file
- [x] `deploy-manifest.json` aggiornato
- [x] Spec `MODULO_WPS_GENERAZIONE…` → slice P0 marcata
- [x] `DEPUTYTASK1.md` → `Stato: CHIUSO — TEST OK` + commit/PR
- [x] Aggiornare una riga in `docs/GUIDA_CONSOLIDATA.md` (lezione: pivot WPS = generazione da WPQR)

**Fuori DoD P0:** endpoint REST, UI, merge automatico se si tocca solo backend service (chiedere conferma merge se PR tocca backend — criterio operating memory).

---

## Riferimenti rapidi codice esistente

| Asset | Path |
|-------|------|
| Regole 15614 | `backend/src/data/weldingQualificationRules15614.js` |
| Catalogo 15608 | `backend/src/data/materialGroups15608.js` / `app/src/data/...` |
| CRUD WPQR | `backend/src/controllers/welding.controller.js` |
| Campi copertura WPQR | mig. **133**, `DEPUTYTASK1` storico CHIUSO |
| Pattern AI HITL (P1) | `weldingAiSuggest.service.js` |
| Ingest WPS (legacy) | `wpsIngest.service.js` — non estendere in P0 |
| Generatore P0 | `wpsGenerator.service.js` |

---

## Comando deputy (dopo push brief su `origin/main`)

```
Leggi docs/agent-tasks/DEPUTYTASK1.md ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.
```

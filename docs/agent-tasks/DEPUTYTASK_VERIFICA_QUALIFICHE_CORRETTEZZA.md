# DEPUTYTASK_VERIFICA_QUALIFICHE_CORRETTEZZA — VQ-6: pack correttezza ISO 9606-1 + equivalenze di processo §5.2 (prompt e mirror FE)

**Stato:** CHIUSO — TEST OK (06/10/2026, PR draft in attesa di CI + Bugbot + Security Review)  
**Aperto:** 06/10/2026  
**Piano:** [`PLAN_VERIFICA_QUALIFICHE_NORMA_SLICES.md`](PLAN_VERIFICA_QUALIFICHE_NORMA_SLICES.md) § 1.1, 1.3, 1.4 · § 3 · § 4.2 · § 6.2 (riga VQ-6) · § 6.3 VQ-6  
**Dipende da:** VQ-1 (nucleo `qualificationVerify/`, su `main`) · VQ-3 (estratto §5.2 corretto, su `main`)  
**Rischio:** **Medio con gate rafforzato** (D6): backend additivo, esiti solo `info`/`warn` non bloccanti, nessuna migrazione, nessun aggancio a flussi (ingest/route/Rielaborazioni sono VQ-7/VQ-8). Diventa **Alto** (stop + conferma) se serve toccare ingest, controller, auth, sync o schema.  
**Stream:** `DEPUTYTASK_VERIFICA_QUALIFICHE_*.md` (epic verifica qualifiche vs norma; non riusare questo file per altri epic)  
**Branch:** `cursor/vq-6-correttezza-b8ef`  
**Contesto:** default/basso (non 1M)

---

## Obiettivo (una slice = un risultato verificabile)

Il pack `welder9606.correctness` (profili `9606-1:BW`, `9606-1:FW`; edizioni 2017/2013/2012) ricalcola la validità dalla **prova** dichiarata (colonne `*_test`, designazione) riusando le funzioni di `weldingQualificationRules9606.js` e la confronta con la validità scritta sul certificato. Nuova funzione pura `computeQualifiedWeldingProcesses({ testProcess })` (§5.2) usata **sia dal pack sia dal prompt AI** (che prima omettendo 142 divergeva dal testo ufficiale), con mirror FE.

Principio: **la validità scritta sul certificato prevale**. Il pack non restituisce mai un valore da applicare; `expected_value` è solo informativo.

## Gate norme (dichiarato)

- **Coperte:** ISO 9606-1:2017 (`NORMA_00018`, edizioni 2012/2013/2017 identiche): §5.2, §5.3, §5.5, §5.7 Tab. 6/7/8, §5.8 Tab. 9/10, §9, §11; ISO 14175:2008 (`NORMA_00012`) per il gas.
- **Mancanti / non codificate:** Tab. 3/4/5/11/12 (celle «×» non confermate sul PDF, HITL 4; nessuna colonna di validità filler/dettagli, D7) · prova multi-processo (Tab. 1, nessun dato strutturato) · numero di passate (Tab. 6 nota e) · branch joint (Tab. 6 nota b) · EN 287-1 · TR 15608 integrale (sottogruppi).
- **Si parte su:** BW/FW 9606-1, solo tabelle già codificate e verificate (letture per codepoint di VQ-3 identiche alla ricostruzione del 26/07).

## Regole del pack (codice · clausola · severità)

Prefisso codici `WQ9606_1.CORR.`. Se il certificato **non dichiara** la validità di una verifica non si emette nulla (la mancanza è compito del pack di completezza, VQ-5). Se dichiara una validità ma manca l'input di prova → un solo `non_verificabile_dato_mancante` (`info`).

| Codice | Prova → atteso (funzione riusata) | Clausola | Severità |
|--------|-----------------------------------|----------|----------|
| `THK_BW` | `thickness_s_test_mm` (+ processo 311) → `computeQualifiedThicknessRangeButtWeld` | §5.7 Tab. 6 (note c/d per 311) | over_claim `warn` · under_claim `info` · s mancante `dato_mancante` |
| `THK_BW_LAYERS` | s ≥ 12 mm: «almeno 3 passate» non registrato | §5.7 Tab. 6 nota e | `info` fisso `dato_mancante` |
| `THK_FW` | `thickness_t_test_mm` → `computeQualifiedFilletThicknessRange` | §5.7 Tab. 8 | idem |
| `PIPE_DIAMETER` | `pipe_diameter_test_mm` (non P) → `computeQualifiedPipeDiameterRange` | §5.7 Tab. 7 | idem |
| `PLATE_TO_PIPE` | piastra (P) con diametro tubo < 75 mm | §5.3 b), c) | `info` (informativo) |
| `POSITIONS` | `welding_position_test` → `computeQualifiedWeldingPositions` (unione se più posizioni) | §5.8 Tab. 9 (BW) / Tab. 10 (FW) | posizione dichiarata non qualificata `warn` · qualificata non dichiarata `info` · prova assente/non in tabella o posizione fuori tabella (es. PB su BW: prova d'angolo supplementare non modellata) `dato_mancante` |
| `PROCESS` | `welding_process_test` → `computeQualifiedWeldingProcesses` | §5.2 | processo dichiarato oltre l'equivalenza `warn` · prova assente o multi-processo `dato_mancante` |
| `TRANSFER_MODE` | `transfer_mode` su processo ∉ 131/135/136/138 (`getApplicableWelderFields`) | §5.2, Annex A | `info` |
| `DESIGNATION` | `parseWelderQualificationDesignation` ↔ colonne di **prova** (processo, P/T, BW/FW, FM, s/t, D, posizione); **mai** confrontata con la validità | §11 | `warn` su discordanza di token |
| `GAS_14175` | `shielding_gas` ↔ catalogo ISO 14175 (stessa logica di `checkShieldingGasKnown`; la rimozione dal check di plausibilità è VQ-7) | ISO 14175 | `info` |
| `MATERIAL_GROUP` | `material_group` ↔ catalogo TR 15608, gruppi 1–11 | §5.5.1 («should») | `info` |
| `FILLER_GROUP` | `filler_material_group` ∈ FM1–FM6 (non per 142/311: è il gruppo del materiale base) | §5.5.2 Tab. 2 | gruppo inesistente (FM0, FM7…) `warn` · testo senza FM `info` |
| `CONFIRMATION_INTERVAL` | `next_confirmation_due` ≤ (`last_confirmation_date` o `exam_date`) + 6 mesi | §9.2 (§9.1) | oltre 6 mesi `warn` · riferimento assente `dato_mancante` |
| `VALIDITY_PERIOD` | `expiry_date` > `exam_date` + 3 anni | §9.3 | `info` (non vincolante: opzioni b/c) |

Il finding «norma/edizione non coperta» (`SRC.EDITION_NOT_COVERED`) è già dell'engine (`QV.ENGINE.SOURCE_MISSING`).

**Confronto numerico (D2):** nessuna tolleranza oltre l'arrotondamento a 0,01 mm. Un limite non dichiarato (massimo `null` senza flag «senza limite superiore», e per i diametri sempre) **non è un'affermazione**: non si giudica. Per BW con processo di prova ignoto un possibile under_claim diventa `dato_mancante` (311 ha limiti diversi); un over_claim resta `warn` perché vale per qualsiasi processo.

## Discrepanze trovate e decisioni

1. **§5.2 e 142 (già nota)**: il prompt AI diceva «141/143/145 tra loro (142 solo 142)», omettendo che 141/143/145 qualificano anche 142. **Corretto** in backend e mirror FE: il prompt ora è generato da `describeWeldingProcessEquivalences()` che chiama la stessa `computeQualifiedWeldingProcesses` del pack; test di parità prompt ↔ funzione.
2. **Riferimento «§5.2/§9.3» per il transfer mode nel prompt** (divergenza n. 12 di VQ-3): il testo ufficiale colloca la riga «Welding process(es); Transfer mode» in **Annex A**. **Corretto** nel prompt (BE + FE).
3. **Bordo D = 25 mm, §5.3 a)**: il testo ufficiale è `D > 25 mm` (la citazione `≥` stava solo nell'estratto `docs/reference/ISO-9606-1-range-validita-patentino.md`, riga «Nota aggiuntiva», file di VQ-3 non toccato qui). Nel **codice** non c'era alcuna soglia `≥ 25` da correggere: `computeQualifiedPipeDiameterRange` implementa Tab. 7 (`D ≤ 25 → D…2D`, `D > 25 → ≥ 0,5D, min 25`) ed è ora blindata con test a 25 / 25,01 (BE, FE e pack). **Segnalato, non corretto:** `capabilityCoverage/adapters/welder9606.adapter.js` tratta «tubo → piastra» sempre come `ok` («tipicamente coperto»), senza la condizione `D > 25 mm` di §5.3 a); fuori dai file di VQ-6, resta un possibile affinamento dei semafori (decisione D8: non in questa epic).
4. **Ordine di `buildWelderQualificationDesignation` (§11)**: l'ordine reale (processo, P/T, BW/FW, gruppo FM, spessore, diametro, posizioni, dettagli) **coincide** con §11; nessuna discrepanza di ordine (test nel pack). Osservazioni, **non corrette** (fuori file e non certe dal testo): (a) manca la voce 5 «tipo di apporto» (§5.6, non modellata); (b) il token spessore è sempre `t`, anche per BW dove §11 prevede `s` (spessore depositato) — e `parseWelderQualificationDesignation` mappa `t…` su `thickness_t_test_mm`: su un BW la designazione `t10` non popola `thickness_s_test_mm`, quindi `THK_BW` darà `dato_mancante` (con indicazione del solo `t` presente) finché l'ingest/parser non distinguono i due casi.
5. **`normalizeMaterialGroupCode` («22» → `2.2`)**: il normalizzatore del catalogo TR 15608 interpreta «22» (alluminio) come «2.2». Non toccato (fuori file); la regola `MATERIAL_GROUP` confronta i codici numerici esatti col catalogo per evitare falsi esiti.
6. **Under_claim sul processo non emesso**: un certificato 135 con validità «135» (caso normale) segnalerebbe «138 coperto» a ogni lettura; il piano prevede per `CORR.PROCESS` solo il `warn` sull'eccesso.
7. **Profilo `9606-1:UNKNOWN`** (giunto non letto) non è servito dal pack di correttezza (lo stub di VQ-1 dichiara solo BW/FW): le regole comuni su UNKNOWN restano al pack di completezza (VQ-5).
8. **Tab. 7 e giunti d'angolo**: §5.7 apre con «butt welds … deposited thickness and outside pipe diameters», ma Tab. 7 non è limitata ai BW e Annex A riporta il diametro per ogni certificato: la regola `PIPE_DIAMETER` vale per BW e FW. Da confermare sul campione reale (HITL 2).

## Checklist dato ↔ norma ↔ UI ↔ API

| Dato | Clausola / fonte MD | UI | API / persistenza |
|------|---------------------|----|-------------------|
| Finding `WQ9606_1.CORR.*` (tabella sopra) | `NORMA_00018` + `ISO 14175` (`NORMA_00012`) | consumato da `QualificationVerifyPanel` (VQ-2/VQ-9) | nessuna in questa slice (route in VQ-7) · **nessuna persistenza** |
| Equivalenze di processo `computeQualifiedWeldingProcesses` | §5.2 | — | prompt AI (`buildWelderQualificationRulesPromptSection`) + pack |

Nessuna nuova colonna, nessun campo AI-estraibile nuovo.

## File toccati

- *Modificati* `backend/src/data/weldingQualificationRules9606.js` + `.test.js` · `app/src/data/weldingQualificationRules9606.js` (mirror) + `app/src/tests/weldingQualificationRules9606.test.js`
- *Modificato* `backend/src/services/qualificationVerify/packs/welder9606Correctness.pack.js` · *Nuovo* `…/packs/welder9606Correctness.pack.test.js`
- *Modificato (test del nucleo)* `backend/src/services/qualificationVerify/verifyRegistry.test.js`: tolta l'asserzione «tutti i pack stub hanno `rules: []`» (non più vera con regole reali; stessa modifica attesa anche da VQ-5 → conflitto banale in merge)
- *Nuovo* questo brief

## Cosa NON toccato

registry/engine, altri pack, ingest, controller/route, Rielaborazioni, FE oltre il mirror, `jointTypeProfiles.js`, `weldingDesignation.js`, `ingestPlausibilityChecks.js`, `deploy-manifest.json` (nessun file `.js` nuovo in `backend/src/`: i test non vanno nel manifest), migrazioni, GUIDA, roadmap, `PLAN_*`.

## Test L1 (eseguiti)

- `cd backend && npx jest src/services/qualificationVerify src/data/weldingQualificationRules9606 src/utils/weldingDesignation` → 8 suite, 250 test verdi
- `cd app && NODE_ENV=test npx vitest run src/tests/weldingQualificationRules9606.test.js` → 58 test verdi · `npm run build` verde
- `node backend/scripts/check-harness-boot.js` · `node backend/scripts/check-utf8-encoding.js` verdi
- Suite backend senza `database.json` che falliscono già su `main` (non toccate): `importAiExtraction.service`, `qualificationAlert.service`, `scripts/reprocess-qualifications`

## Rielaborazioni (Registro)

**Esenzione dichiarata:** nessun campo AI-estraibile, nessuna colonna. La voce `verify_9606_1` nasce in VQ-8.

## DoD

- [x] `computeQualifiedWeldingProcesses` (+ mirror FE) e prompt corretto su 142, generato dalla stessa funzione; test di parità prompt ↔ funzione
- [x] Regole §4.2 nel pack, per BW e FW, con test ok / warn con clausola / info / non verificabile
- [x] Bordi: s = 2,99 / 3 / 11,99 / 12; t = 2,99 / 3; D = 25 / 25,01; 311 (1,5s); arrotondamento a 0,01 mm
- [x] Mai `warn` su dato non verificabile; ogni finding passa `validateFinding` (anche nei test di contratto del nucleo)
- [x] Nessuna modifica a registry/engine, ingest, FE oltre il mirror, `jointTypeProfiles.js`, manifest
- [x] Tab. 3/4/5/11/12 non codificate come `warn`
- [ ] Gate «pronta» (a carico del teammate ProgettoISO): CI + Bugbot (un solo `bugbot run`) + Security Review letti; **campione reale (HITL 2) prima di «pronta»** (D6)

## HITL

HITL 2 (certificati reali anonimizzati) per misurare i falsi positivi dei `warn` prima di «pronta». HITL 4 (Tab. 3/4/5/11/12) non blocca questa slice.

## Comando di avvio

`Leggi docs/agent-tasks/DEPUTYTASK_VERIFICA_QUALIFICHE_CORRETTEZZA.md ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.`

## Handoff

_(vuoto — slice chiusa)_

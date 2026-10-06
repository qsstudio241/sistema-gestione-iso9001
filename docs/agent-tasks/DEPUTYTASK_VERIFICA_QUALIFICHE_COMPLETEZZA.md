# DEPUTYTASK_VERIFICA_QUALIFICHE_COMPLETEZZA — VQ-5: pack completezza ISO 9606-1 (BW / FW / UNKNOWN)

**Stato:** CHIUSO — TEST OK (06/10/2026)  
**Aperto:** 06/10/2026  
**Piano:** [`PLAN_VERIFICA_QUALIFICHE_NORMA_SLICES.md`](PLAN_VERIFICA_QUALIFICHE_NORMA_SLICES.md) § 1.3 (contratto) · § 1.4 · § 3 (inventario norme) · § 4.1 (checklist) · § 6.2 / § 6.3 VQ-5  
**Dipende da:** VQ-1 (su `main`: PR #718); VQ-3 (estratto 9606-1 corretto, su `main`)  
**Rischio:** **Medio** (gate rafforzato D6) — BE additivo, esiti solo `info`/`warn` non bloccanti, nessuna migrazione, nessuna route, nessun aggancio a ingest/Rielaborazioni (sono VQ-7 e VQ-8). Diventa **Alto** (stop + conferma) se serve toccare auth/sync/JWT, schema o ingest.  
**Stream:** `DEPUTYTASK_VERIFICA_QUALIFICHE_*.md` (epic verifica qualifiche vs norma; non riusare questo file per altri epic)  
**Branch:** `cursor/vq-5-completezza-b8ef`  
**Contesto consigliato:** default/basso (non 1M)

---

## Obiettivo (una slice = un risultato verificabile)

Il pack `welder9606Completeness` (stub di VQ-1) contiene le regole della § 4.1 del piano: per un certificato ISO 9606-1 (profili `9606-1:BW`, `9606-1:FW`, `9606-1:UNKNOWN`; edizioni 2017/2013/2012) segnala, con **clausola citata**, i campi che la norma pretende sul certificato e che mancano. I campi applicabili sono derivati da `getVisibleFieldKeys` (`jointTypeProfiles.js`, solo import): nessuna seconda lista «campi per profilo».

Principio: `warn` solo se il campo è richiesto dalla clausola **e** il dato manca (`status: verificabile`, clausola obbligatoria). Dove manca il dato di contesto (tipo di giunto, tipo di prodotto, processo di prova) la regola **non indovina**: emette `non_verificabile_dato_mancante` (`info`). Gli esiti sono avvisi **non bloccanti**; la validità scritta sul certificato prevale; nessun `expected_value` (sempre `null`).

## Gate norme (dichiarato)

- **Coperte:** ISO 9606-1:2017 (`NORMA_00018` MD leggibile: §5.1, §5.2, §5.3, §5.4, §5.5, §5.6 NOTE, §5.7, §5.8, §5.9, §9.1, §10, §11, Annex A) + `docs/reference/ISO-9606-1-range-validita-patentino.md` (corretto da VQ-3: tabella Annex A modellati/non modellati). Edizioni 2013/2012: stesso testo.
- **Mancanti (non bloccano):** EN 287-1 / 9606-1:2004 (→ finding di engine `non_verificabile_fonte_mancante`, nessuna regola di questo pack); Tab. 3/4/5/11/12 (validità filler/dettagli: non usate qui); le 8 voci Annex A senza colonna (D7 = no).
- **Si parte su:** completezza §5.1/§10/§11/Annex A per BW/FW/UNKNOWN.

## Checklist dato ↔ clausola ↔ UI ↔ API (regole implementate)

UI/API: nessuna in questa slice (pannello = VQ-2; endpoint/ingest = VQ-7; Rielaborazioni = VQ-8). I finding escono da `verifyQualification(...).findings[]`. Nessuna persistenza.

| Codice (`WQ9606_1.COMP.…`) | Dato (colonna / review) | Clausola citata | Severità se manca | Non verificabile quando |
|---|---|---|---|---|
| `PROCESS` | `welding_process_test` / `welding_processes_validity` / `welding_process` (legacy) | §5.1, §5.2, §10, Annex A | `warn` (solo se tutti e tre assenti) | — |
| `PRODUCT_TYPE` | `product_type` | §5.1, §5.3, §11 | `warn` | — |
| `JOINT_TYPE` | `joint_type` (assente ⇒ profilo `UNKNOWN`) | §5.1, §5.4, §11 | `warn` | — |
| `FILLER_GROUP` | `filler_material_group` (DB: `filler_material`) | §5.5, Tab. 2, §11 | `warn` (nessun avviso per 142/311, §5.6 NOTE) | processo di prova non leggibile |
| `THK_VALIDITY` | `thickness_min_mm` + (`thickness_max_mm` o `thickness_max_unlimited`) | §5.7 Tab. 6 (BW) / Tab. 8 (FW) | `warn` | giunto non leggibile (Tab. 6 o 8?) |
| `THK_TEST` | `thickness_s_test_mm` (BW) / `thickness_t_test_mm` (FW) | §5.7 Tab. 6/8, §11 | `info` | giunto non leggibile |
| `PIPE_DIAMETER` | `pipe_diameter_min_mm` / `pipe_diameter_max_mm` (solo T; max assente = nessun limite, Tab. 7) | §5.7 Tab. 7, Annex A | `warn` (solo se entrambi assenti) | tipo prodotto non leggibile |
| `PIPE_DIAMETER_TEST` | `pipe_diameter_test_mm` (solo T) | §5.7 Tab. 7, §11 | `info` | tipo prodotto non leggibile |
| `POSITIONS` | `welding_positions` / `position_range` | §5.8 Tab. 9 (BW) / Tab. 10 (FW) / Tab. 9/10 (UNKNOWN), §11 | `warn` | — |
| `POSITION_TEST` | `welding_position_test` | §5.8, §11 | `info` | — |
| `WELD_DETAILS` | `weld_details` | §5.1, §5.9, §11 | `warn` | — |
| `TRANSFER_MODE` | `transfer_mode` (solo 131/135/136/138) | §5.2, Annex A | `info` | processo di prova non leggibile |
| `MATERIAL_GROUP` | `material_group` | §5.1, §10, Annex A (+ §5.6 per 142/311) | `warn` | — |
| `SHIELDING_GAS` | `shielding_gas` (processi che la ISO 4063 denomina MIG/MAG/TIG, da catalogo) | §10, Annex A | `info` | processo di prova non leggibile |
| `EXAM_DATE` | `exam_date` (alias `issue_date`) | §9.1, §10, Annex A | `warn` | — |
| `CERTIFICATE_NUMBER` | `certificate_number` | §10, Annex A | `warn` | — |
| `ISSUING_BODY` | `issuing_body` (alias `examiner_body`) | §10, Annex A | `warn` | — |
| `STANDARD_REFERENCE` | `standard_reference` (DB: `standard_ref`) | Annex A | `info` | — |

Scelte di lettura della norma (da rivedere sul campione reale, D2/D6): la validità dello spessore richiede entrambi gli estremi (Tab. 6/8 definiscono sempre un minimo); il diametro richiede solo uno dei due estremi (Tab. 7 ammette «nessun limite» e non esiste un flag dedicato); i processi «a gas» sono quelli la cui denominazione ISO 4063:2023 contiene MIG/MAG/TIG (plasma 15 e 114 esclusi: la denominazione non li dichiara a gas).

## File previsti

- *Modificato* `backend/src/services/qualificationVerify/packs/welder9606Completeness.pack.js` (18 regole)
- *Nuovo* `backend/src/services/qualificationVerify/packs/welder9606Completeness.pack.test.js`
- *Modificati (necessità tecnica, solo test)* `verifyEngine.test.js` e `verifyRegistry.test.js` nello stesso modulo: contenevano l'ipotesi «pack di default vuoti» (stub VQ-1) ora falsa; l'engine test usa pack vuoti per testare la meccanica, il test di contratto usa i pack reali. Nessun cambio ad engine/registry/view.
- *Nuovo* questo brief
- Solo lettura/import: `backend/src/data/jointTypeProfiles.js`, `weldingQualificationRules9606.js` (`CONTINUOUS_WIRE_ARC_PROCESSES`), `weldingProcesses4063.js`

## Cosa NON toccare

`verifyRegistry.js`, `verifyEngine.js`, `qualificationRecordView.js`, `registerDefaultPacks.js`, gli altri pack, `jointTypeProfiles.js` (solo import), `weldingQualificationRules9606.js`, ingest/controller/route, Rielaborazioni, FE, `deploy-manifest.json` (il pack stub è già elencato da VQ-1), `database/migrations/**`, `PLAN_*`, GUIDA, ROADMAP.

## Rielaborazioni (Registro)

**Esenzione dichiarata:** nessun campo AI-estraibile, nessuna colonna, nessun valore persistito. La voce `verify_9606_1` nasce in VQ-8.

## Test L1 (eseguiti)

- `cd backend && npx jest src/services/qualificationVerify` → 6 suite, 213 test verdi
- `node backend/scripts/check-harness-boot.js` → OK
- `node backend/scripts/check-utf8-encoding.js` → 0 problemi
- Copertura del pack: per BW, FW e UNKNOWN, ogni regola con caso ok / mancante (clausola in `source.clause` e in `message_it`) / non verificabile (dove definito); 142/311 senza apporto; processi con/senza trasferimento e gas; tubo vs piastra; edizioni 2017/2013/2012 e 2004 (fonte mancante); mode `db` con alias DB; invarianti (`validateFinding`, `warn` solo se verificabile, nessun blocco, `expected_value` sempre `null`).

## DoD

- [x] Regole della § 4.1 nel pack, con campi derivati da `getVisibleFieldKeys`
- [x] Test per BW / FW / UNKNOWN: ok / mancante (warn con clausola) / non verificabile
- [x] P vs T (diametro non richiesto su P); 142/311 (materiale base al posto di FM); info/warn come tabella
- [x] Ogni finding passa `validateFinding`; nessuna regola lancia
- [x] Nessuna migrazione, nessun FE, nessun file fuori perimetro (salvo i due test di modulo sopra)
- [x] Branch allineato a `origin/main` prima di push/PR; `bugbot run` una sola volta a slice chiusa

## HITL

Nessuno bloccante. Richiesta già aperta nel piano (§ 3.1, n. 2): campione di certificati reali anonimizzati per misurare i falsi positivi dei `warn` prima di «pronta» (D6).

## Handoff

_(vuoto — slice chiusa)_

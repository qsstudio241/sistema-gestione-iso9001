# DEPUTYTASK_VERIFICA_QUALIFICHE_PART2 — VQ-10: verifica ISO 9606-2 (funzioni regole, profili per norma, pack, voce Rielaborazioni `verify_9606_2`)

**Stato:** CHIUSO — TEST OK (06/10/2026, PR draft su `cursor/vq-10-part2-b8ef`; undraft/Bugbot/merge a cura del bot ProgettoISO)  
**Aperto:** 06/10/2026  
**Piano:** [`PLAN_VERIFICA_QUALIFICHE_NORMA_SLICES.md`](PLAN_VERIFICA_QUALIFICHE_NORMA_SLICES.md) § 1.2, § 1.3, § 3 · § 6.2 e § 6.3 VQ-10  
**Fonti:** `docs/reference/ISO-9606-2-range-validita-patentino.md` (VQ-3, sezione GAP G1–G9) · `docs/Normative/` NORMA_00032 (EN ISO 9606-2:2004)  
**Dipende da:** VQ-1 (nucleo), VQ-3 (estratto), VQ-8 (Rielaborazioni `kind:'verify'`)  
**Rischio:** **Medio rafforzato** (D6) — BE additivo, nessuna migrazione, nessuna route, nessun FE oltre i file profili. Regola di declassamento: Alto se serve toccare ingest, auth, sync, schema.  
**Stream:** `DEPUTYTASK_VERIFICA_QUALIFICHE_*.md`  
**Branch:** `cursor/vq-10-part2-b8ef`  
**Slice parallele (file disgiunti):** VQ-9 (FE: `IngestReviewDialog.jsx`, `QualificationForm.jsx`, `QualificationsPage.jsx`, `QualificationUploadButton.jsx`) · VQ-BW-S (`weldingDesignation.js` BE/FE, `qualificationIngest.service.js`)

---

## Obiettivo

Le qualifiche ISO 9606-2:2004 (saldatori, alluminio) hanno una verifica propria: funzioni pure per i range (Tab. 3/4/5/6, §9), profili per norma che usano lo spessore del **materiale `t`** per il BW (la 9606-1 resta `s` depositato), pack `welder9606.part2` con completezza e correttezza con clausola citata, e voce **Rielaborazioni** `verify_9606_2` in sola lettura. Tutto ciò che l'estratto marca GAP resta `non_verificabile_fonte_mancante`: non è codificato.

## Gate norme (dichiarato)

- **Coperte:** ISO 9606-2:2004 (edizione unica, NORMA_00032): §4.2, §5.1–§5.9, Tab. 2 (solo presenza campo), Tab. 3, Tab. 4 (identica alla Tab. 7 di 9606-1), Tab. 5, Tab. 6 (10 colonne, nota b), §9.1–§9.3, §10, §11 (solo presenza dei campi), Annex A.
- **Mancanti (GAP, non codificati → `non_verificabile_fonte_mancante`):** G1 Tab. 1 multi-processo (figure non leggibili); G2 composizione dei gruppi Al 21–26, gruppo 26, CR ISO 15608; G4 corrispondenza simboli tubo PF/PG ↔ PH/PJ/J-L045 (ISO 6947 integrale). Edizione 9606-2:1994 non dichiarata in `editions[]` → `SOURCE_MISSING` del motore.
- **Si parte su:** Tab. 3/4/5/6 e §9, valori confermati da VQ-3. Nessuna soglia inventata.

## Checklist dato ↔ norma ↔ UI ↔ API

| Dato | Clausola / fonte MD | UI | API / persistenza |
|------|---------------------|----|-------------------|
| `thickness_t_test_mm` (BW 9606-2) | §5.7 Tab. 3 | profilo `JOINT_TYPE_PROFILES_9606_2` (`testThicknessKey`); il form non è toccato (VQ-9) | nessuna nuova colonna |
| `thickness_t_test_mm` (FW 9606-2) | §5.7 Tab. 5 | idem | idem |
| `pipe_diameter_*` | §5.7 Tab. 4 · §5.3 b) | invariato | idem |
| `welding_position_test` / `welding_positions` | §5.8 Tab. 6 (nota b) | invariato | idem |
| `welding_process_test` / `welding_processes_validity` | §4.2, §5.2 | invariato | idem |
| `next_confirmation_due`, `expiry_date` | §9.2, §9.3 | invariato | idem |
| `verify_9606_2` | — | Fatturazione → Rielaborazioni (lista dal registro) | sola lettura, nessuna whitelist di scrittura |

## File toccati

- *Nuovi* `backend/src/data/weldingQualificationRules9606Part2.js` (+ `.test.js`) · `backend/src/services/qualificationVerify/packs/welder9606Part2.pack.test.js` · questo brief
- *Riscritti* `backend/src/services/qualificationVerify/packs/welder9606Part2.pack.js` (era stub)
- *Modificati* `backend/src/data/jointTypeProfiles.js` · `app/src/data/jointTypeProfiles.js` · `backend/src/data/jointTypeProfiles.test.js` · `app/src/tests/jointTypeProfiles.test.js` · `backend/src/data/reprocessableFields.js` (+ test) · `backend/scripts/deploy-manifest.json` (una riga)
- *Test isolati dai pack di default (già rotti su main dopo VQ-5/6)* `verifyReprocess.service.test.js` · `qualificationReprocess.verify.test.js` · `verifyReprocess.cli.test.js` (estensione 9606-2)
- *Non toccati:* pack 9606-1, ingest, `weldingDesignation.js`, `weldingQualificationRules9606.js` (solo import), form FE, migrazioni, auth/sync.

## Regole del pack (`welder9606.part2`, `editions: ['2004']`, profili `9606-2:BW`/`9606-2:FW`)

Principio: la validità del certificato prevale; `warn` solo se verificabile e il certificato è PIÙ LARGO della norma (nessuna tolleranza oltre 0,01 mm, D2); più stretto, non essenziale o non vincolante = `info`; input mancante = `non_verificabile_dato_mancante`; GAP = `non_verificabile_fonte_mancante`.

**Completezza** (`WQ9606_2.COMP.*`): `PROCESS` (§5.1 a, §5.2) · `PRODUCT_TYPE` (§5.1 b, §5.3) · `MATERIAL_GROUP` (§5.1 d, §5.5, Tab. 2) · `FILLER_MATERIAL` (§5.1 e, §5.6) · `THK_VALIDITY` (§5.7 Tab. 3/5) · `PIPE_DIAMETER` (§5.7 Tab. 4, solo T) · `POSITIONS` (§5.8 Tab. 6) · `WELD_DETAILS` (§5.1 h, §5.9) · `EXAM_DATE` (§9.1) · `CERTIFICATE_NUMBER` · `ISSUING_BODY` (§10) = `warn`; `THK_TEST`, `PIPE_DIAMETER_TEST`, `POSITION_TEST`, `SHIELDING_GAS`, `EXPIRY_DATE`, `STANDARD_REFERENCE` = `info`; `CURRENT_141` (§5.2, corrente c.c./c.a. senza campo strutturato) = `info` non verificabile.

**Correttezza** (`WQ9606_2.CORR.*`): `THK_BW` (§5.7 Tab. 3) · `THK_FW` (§5.7 Tab. 5) · `PIPE_DIAMETER` (§5.7 Tab. 4) · `POSITIONS` (§5.8 Tab. 6) · `PROCESS` (§5.2: nessuna equivalenza) · `CONFIRMATION_INTERVAL` (§9.2: 6 mesi) = `warn` over_claim / `info` under_claim / dato mancante; `PLATE_TO_PIPE` (§5.3 b), `POSITION_TEST_JOINT` (Tab. 6 nota b), `PROCESS_SCOPE` (§4.2) = `info`; `VALIDITY_PERIOD` (§9.3: oltre 2 anni solo con prolungamento, non modellato) = `info` non verificabile; GAP: `MULTI_PROCESS` (Tab. 1), `MATERIAL_GROUP_SOURCE` (Tab. 2), `POSITIONS_SYMBOLS` (PH/PJ/J-L045) = `non_verificabile_fonte_mancante`.

## Profili per norma

`getJointTypeProfile(code, { standard })` e `getVisibleFieldKeys` risolvono la norma da `qualificationType` (`resolveProfileStandard`). **9606-1 invariata** (BW = `s` depositato, FW = `t`; prompt byte-identico): test di non regressione in BE e FE. 9606-2: BW e FW usano `t`; `thickness_s_test_mm` e `transfer_mode` non applicabili.

## Rielaborazioni (Registro)

Voce `verify_9606_2` (`kind:'verify'`, `verifyFamily:'9606-2'`) in `reprocessableFields.js`: nessuna colonna, whitelist di scrittura, AI o PDF. Test: sync registro ↔ famiglie dei pack, nessuna chiave verify nelle whitelist, nessun attributo da backfill, servizio in sola lettura (solo SELECT, solo record 9606-2), CLI `--field=verify_9606_2` rifiutata senza accesso al DB. Nessun nuovo campo AI-estraibile: nessuna voce di backfill da aggiungere.

## Test L1 (eseguiti)

- `cd backend && npx jest src/services/qualificationVerify src/data` verde (incl. 89 test range 9606-2, 77 test pack, non regressione 9606-1)
- `cd backend && npx jest src/services/qualificationReprocess.verify src/controllers/reprocessTasks` verde
- `cd app && NODE_ENV=test npx vitest run src/tests/jointTypeProfiles.test.js` verde · `npm run build` ok
- `node backend/scripts/check-harness-boot.js` e `node backend/scripts/check-utf8-encoding.js` verdi

Già rotti su `origin/main`, estranei alla slice: `backend/scripts/reprocess-qualifications.test.js` (3 test, mock di `ingest_staging`) e alcune suite `src/services/*` che non partono senza DB.

## Rischi / decisioni aperte

- `welding_position_test` PF/PG: serve `product_type` (piastra/tubo), altrimenti `non_verificabile_dato_mancante`.
- Il normalizzatore di ingest `normalizeMaterialGroupCode` è orientato agli acciai e trasforma «22» in «2.2»: per questo il gruppo Al non è mai giudicato (solo `MATERIAL_GROUP_SOURCE`).
- Designazione §11 di 9606-2 non letta: il parser `weldingDesignation.js` è 9606-1 (altra slice).
- Il form `QualificationForm.jsx` è cablato su `thickness_s_test_mm` per BW: il cablaggio del campo `t` per 9606-2 è un seguito per VQ-9; i profili sono pronti.
- `documentIngestPipeline.service.js` chiama `buildProfilePromptSection(profileKey)` senza norma: il prompt 9606-2 è dormiente finché l'ingest non lo passa.
- Helper di confronto range (`compareRange`, `rangeFinding`) duplicati dal pack 9606-1 correttezza: da estrarre in un modulo condiviso.
- Multi-processo: `non_verificabile_fonte_mancante` (come da richiesta); l'estratto G1 indicava `dato_mancante`.

## Comando di avvio

`Leggi docs/agent-tasks/DEPUTYTASK_VERIFICA_QUALIFICHE_PART2.md ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.` (slice già chiusa: FIX NON APPLICABILI)

## Handoff

_(vuoto — slice chiusa)_

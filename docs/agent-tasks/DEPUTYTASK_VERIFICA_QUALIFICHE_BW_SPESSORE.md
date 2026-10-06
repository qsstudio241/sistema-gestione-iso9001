# DEPUTYTASK_VERIFICA_QUALIFICHE_BW_SPESSORE — VQ-BW-S: spessore della prova per profilo giunto (BW → `s` depositato, FW → `t` materiale)

**Stato:** CHIUSO — TEST OK  
**Aperto/chiuso:** 06/10/2026  
**Piano:** [`PLAN_VERIFICA_QUALIFICHE_NORMA_SLICES.md`](PLAN_VERIFICA_QUALIFICHE_NORMA_SLICES.md) (slice nuova, non nel piano originale; onda 3)  
**Dipende da:** VQ-5/VQ-6 (pack correttezza `THK_BW` già su `main`)  
**Rischio:** **Medio** — BE additivo sul percorso ingest, nessuna migrazione, nessun cambio di campi nelle risposte, nessun blocco.  
**Stream:** `DEPUTYTASK_VERIFICA_QUALIFICHE_*.md`  
**Branch:** `cursor/vq-bw-s-b8ef`

---

## Obiettivo

Per ISO 9606-1 lo spessore della prova è lo spessore **depositato `s`** sui giunti testa a testa (BW, Tab. 6 §5.7) e lo spessore del **materiale `t`** sui giunti d'angolo (FW, Tab. 8); §11 voce 6 («spessore depositato `s` o spessore del materiale `t`, e diametro D»). Prima della slice la designazione stampata (`… BW FM1 t10 …`) finiva in `thickness_t_test_mm` anche per i BW, mentre `THK_BW` legge `thickness_s_test_mm`: i BW risultavano `non_verificabile_dato_mancante` anche con certificato corretto.

## Gate norme (dichiarato)

- **Coperte:** ISO 9606-1:2017 Tab. 6 / Tab. 8 / §11 (`docs/reference/ISO-9606-1-range-validita-patentino.md`).
- **Mancanti:** nessuna per questa slice (non introduce soglie né clausole).
- **Si parte su:** assegnazione del dato alla colonna giusta; regole e pack invariati.

## Checklist dato ↔ norma ↔ UI ↔ API

| Dato | Clausola / fonte MD | UI | API / persistenza |
|------|---------------------|----|-------------------|
| `thickness_s_test_mm` (BW) | §5.7 Tab. 6 · §11 voce 6 | già presente (`jointTypeProfiles`, `QualificationForm`) | mapping ingest + INSERT già esistenti (colonna migr. 168) |
| `thickness_t_test_mm` (FW) | Tab. 8 · §11 voce 6 | già presente | idem |

Nessun campo nuovo, nessuna colonna nuova.

## Mapping s/t per profilo (implementato)

Helper unico `resolveTestThicknessByJoint({joint_type, s, t})` in `weldingDesignation.js` (BE) + mirror FE:

| Giunto | Input | Esito |
|--------|-------|-------|
| BW | solo `t` (es. token `t10` della designazione) | `s = t`, `t = null` |
| FW | solo `s` | `t = s`, `s = null` |
| BW / FW | `s` e `t` entrambi presenti | **entrambi salvati**, nessuno spostamento |
| BW / FW | colonna corretta già valorizzata | invariato |
| assente / sconosciuto / `BW/FW` | qualsiasi | **nessuna deduzione** (comportamento precedente) |

Applicato in: parser `parseWelderQualificationDesignation` (indipendente dall'ordine dei token), `mapPipelineFieldsToReview`, `commitQualificationFromFields` (parametri INSERT `thickSTest`/`thickTTest` + `finalFields` della verifica). L'estrattore deterministico (`ruleFieldExtractors.extractPatentinoFields`) eredita la correzione dal parser senza modifiche.

Il commit scriveva già `thickness_s_test_mm` / `thickness_t_test_mm` (colonne migrazione 168) nell'INSERT monolitico; la slice non cambia la forma dell'INSERT, solo i valori. Come per il resto delle colonne del commit, resta il requisito che la 168 sia applicata dove gira il backend.

## File toccati

- `backend/src/utils/weldingDesignation.js` + `.test.js`
- `app/src/utils/weldingDesignation.js` + `app/src/tests/weldingDesignation.test.js` (mirror)
- `backend/src/services/qualificationIngest.service.js` + `.test.js`
- *Nuovo test* `backend/src/services/qualificationVerify/bwSpessoreIngest.integration.test.js` (designazione → parser → ingest → `verifyQualification`: BW con `s` e validità Tab. 6 coerente = nessun `warn`, nessun `non_verificabile_dato_mancante` su `THK_BW`)

## Cosa NON toccato

Pack e regola `THK_BW`, registry/engine, `jointTypeProfiles.js`, FE UI, `reprocessableFields.js`, `deploy-manifest.json` (nessun file nuovo in `backend/src/`), migrazioni, GUIDA, roadmap.

## Test L1

`cd backend && npx jest src/utils/weldingDesignation src/services/qualificationIngest src/services/qualificationVerify` · `cd app && NODE_ENV=test npx vitest run src/tests/weldingDesignation.test.js` · `npm run build` · `node backend/scripts/check-harness-boot.js` · `node backend/scripts/check-utf8-encoding.js`.

Nota: `verifyReprocess.service.test.js` ha 4 test rossi **anche su `main`** (fallimento preesistente, non toccato).

## Rielaborazioni (Registro)

`thickness_s_test_mm` e `thickness_t_test_mm` sono **già** in `REPROCESSABLE_FIELD_REGISTRY` (`reprocessableFields.js`) e nelle whitelist ingest: nessuna voce nuova da aggiungere. Follow-up (non in questa slice): una rielaborazione di `thickness_s_test_mm` su BW esistenti con spessore finito in `t` richiede la rilettura del PDF; i record già salvati con `t` su BW restano `non_verificabile_dato_mancante` finché non rielaborati o corretti a mano.

## Rischi / dopo il deploy

Smoke ingest consigliato dopo il deploy (`node backend/scripts/smoke-ingest-e2e-test.js`): caricare un patentino BW e verificare in revisione `s` valorizzato e `t` vuoto.

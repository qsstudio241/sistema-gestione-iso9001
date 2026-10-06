# Rischio migrazioni 168 e 169 — analisi sola lettura (06/10/2026)

**Esito in una riga:** la domanda «applico 168 e 169 in produzione?» è superata dai fatti. In **PROD** la 168 è applicata dal 05/10 e la 169 dal 06/10 alle 14:14 (verify `PASS`). In **TEST** la 169 è applicata ma la 168 **no**, e il backend di test gira ancora codice vecchio che usa `wq.expiry_date`: è l'unico problema aperto. Nessun DDL/DML eseguito da questa analisi (solo `SELECT` e `CHECK_ONLY`, verificato nel codice dei runner).

## Semaforo

| Migrazione | PROD | TEST |
|---|---|---|
| **168** (6 colonne 9606, additiva) | VERDE: presente, tipi/nullable corretti | GIALLO: **non applicata** (0 colonne su 6) |
| **169** (DROP `wpqr_records.expiry_date`) | VERDE: applicata, codice live allineato | ROSSO: colonna già rimossa, codice test vecchio |

## Evidenze

| # | Punto | Esito | Fonte |
|---|---|---|---|
| 1 | Residui `expiry_date` WPQR in `origin/main` | **Nessun riferimento vivo** alla colonna WPQR. Restano solo `qualifications.expiry_date` (9606, `welding.controller` r.761), `welding_procedures.expiry_date` (WPS/copertura, r.1230–1273) e `document_registry`. Residuo innocuo: `extractWpqrFields` in `ruleFieldExtractors.js` emette `expiry_date` nel JSON di ingest documenti (non va in `wpqr_records`, nessun INSERT/UPDATE lo usa). Nessuna vista/proc/trigger in `database/**` cita `wpqr_records`. | grep `backend/src`, `app/src`, `database/**`; `wpqrIngest.service.js` INSERT r.566; `WPQR_MANUAL_EDITABLE_FIELDS` |
| 2 | Codice su VPS PROD | `welding.controller.js` e `wpqrIngest.service.js` hanno sha256 **identico** a `origin/main` (senza `wq.expiry`); file scritti 14:14:15–18, restart `sgq-backend` 14:14:31, DROP 14:14:44: ordine corretto. Journal dal restart: 0 errori «invalid column». Deploy **parziale**: 25 file identici, 233 solo CRLF, 16 diversi, **23 mancanti** su 297 del manifest (`capabilityCoverage/*`, `qualificationVerify/*`, `jointTypeProfiles.js`, `qualificationVerify.controller.js`). Non bloccante per la 169. Residui `*.bak` in `src/` mai caricati. | sha256 vs `deploy-manifest.json`; `systemctl show`; `journalctl` |
| 2 | Codice su VPS TEST (`/var/www/sgq-backend-test`, `sgq-backend-test`, DB `2026-06-18_SGQ_ISO9001`) | Processo avviato 13/09, file del 20/08. `welding.controller.js` contiene **11 `wq.expiry*`** (INSERT, UPDATE, filtri lista, stats), `wpqrIngest.service.js` scrive `expiry_date`. 67 file diversi e 65 mancanti rispetto a `main`. Journal test senza errori solo perché nessuno ha usato WPQR dopo il DROP. | sha256, grep sul VPS |
| 3 | Stato DB 168 | PROD: 6 colonne `nvarchar(50/200/50)` e `decimal(10,2)` ×3, tutte `NULL`, 151 qualifiche, 0 valorizzate. TEST: assenti. | `INFORMATION_SCHEMA`; runner 168 `CHECK_ONLY` |
| 3 | Stato DB 169 | `expiry_date` assente su PROD (13 righe) e TEST (5); indice `IX_wpqr_records_expiry` assente; 0 vincoli/default/computed/statistiche utente/trigger/moduli SQL dipendenti; FK non trusted 0; `qualifications` e `welding_procedures` hanno ancora `expiry_date`. `169_verify` = `PASS` su entrambi. | `sys.*`; runner 169 `CHECK_ONLY` |
| 4 | Perdita dati | Persi **2 valori su 13 in PROD**, 0 su 5 in TEST (conteggio pre-DROP in PR #712/#713, righe confermate oggi). `169_rollback.sql` ricrea solo colonna `DATE NULL` + indice, **non i valori**. Ultimo backup completo `SGQ_ISO9001`: 18/06/2026; TEST senza backup. Decisione di prodotto 05/10: WPQR senza scadenza. | `msdb.backupset`; `169_rollback.sql` |
| 5 | Frontend | `e60963a2` è su `main`: nessuna chiamata FE invia/filtra `expiry_date` WPQR. Un FE cache/PWA vecchio che lo invia è ignorato: `createWPQR`/`updateWPQR` leggono solo i campi elencati (`WPQR_MANUAL_EDITABLE_FIELDS`), senza `expiry_date`. | `welding.controller.js` r.21, 500–560, 650–670 |
| 6 | CI «Smoke test DB test» | `smoke.controller` interroga solo `INFORMATION_SCHEMA`/conteggi (organizations, users, audits, NC) e `test-api/health`: **non tocca WPQR**, quindi il DROP non lo rompe. Rotto sarebbe solo l'uso reale di WPQR su test (`smoke-percorsi-critici` su WPS/WPQR, se puntato a test). | `smoke.controller.js`, `smoke-test.yml` |

## Ordine consigliato (stato reale: restano solo i passi su TEST)

1. **TEST, 168:** `scp` runner e SQL, poi `SGQ_MIGRATION_TARGET=test node /tmp/run-migration-168-vps.js` (additiva, idempotente). Serve **prima** del deploy: `qualifications.controller.js` di `main` usa le 6 colonne.
2. **TEST, deploy codice `main`:** `bash backend/scripts/deploy-to-vps-test.sh` (manifest completo, restart `sgq-backend-test`, health `test-api`). Confermare MainPID prima/dopo.
3. **TEST, smoke:** health `test-api` 200; lista, stats, creazione/modifica WPQR; `SGQ_SMOKE_BASE_URL` su test se previsto.
4. **PROD, nulla da fare** per 168/169. Facoltativo e separato (non legato alla 169): completare il deploy dei 23 file mancanti e dei 16 diversi con `bash backend/scripts/deploy-to-vps.sh` (168 già presente, quindi sicuro), poi smoke `node backend/scripts/smoke-percorsi-critici.mjs`.
5. **Pulizia:** rimuovere i `.bak` in `src/` PROD.

Comandi esatti (`scp -P 1122` e `ssh -p 1122` verso `spascarella@sistemi.fr-busato.it`, runner copiati in `/tmp/`):

- Pre-check 168 (nessun ALTER): `SGQ_MIGRATION_TARGET=test|prod SGQ_MIGRATION_CHECK_ONLY=1 node /tmp/run-migration-168-vps.js`
- Applica 168: `SGQ_MIGRATION_TARGET=test node /tmp/run-migration-168-vps.js`
- Pre-check 169 (nessun DROP; se già applicata esegue solo il verify `SELECT`): `SGQ_MIGRATION_TARGET=test|prod CHECK_ONLY=1 node /tmp/run-migration-169-vps.js`
- Rimuovere poi i runner da `/tmp`.

**Se si dovesse rifare la 169 su un nuovo ambiente:** deploy codice senza `expiry_date` → export dei valori (`SELECT id, organization_id, expiry_date FROM dbo.wpqr_records WHERE expiry_date IS NOT NULL`, fuori da Git) → `CHECK_ONLY=1` → applica → verify `PASS` → smoke WPQR.

## Rollback

- **168:** nessun rollback necessario (colonne `NULL`, mai usate); `ALTER TABLE ... DROP COLUMN` solo se richiesto.
- **169:** `169_rollback.sql` (colonna vuota + indice). I 2 valori PROD si recuperano solo da un restore del backup 18/06 su database di appoggio, e solo se già presenti allora: non consigliato, salvo richiesta del committente.

## Condizioni di stop

- Il deploy test non parte se la 168 non è applicata su TEST (colonne mancanti → errori in Qualifiche).
- Stop se dopo il restart compaiono «Invalid column name» nel journal, o se health non è `healthy`.
- Nessun nuovo DROP su PROD/TEST senza export valori e conferma esplicita del committente.

## Cosa serve dal committente

Via libera a: (1) applicare la 168 su TEST e rideployare il backend di test (rischio basso, solo ambiente di test); (2) decidere se completare il deploy PROD dei 39 file non allineati; (3) confermare che i 2 valori WPQR persi in PROD non servono (decisione 05/10 già in questo senso).

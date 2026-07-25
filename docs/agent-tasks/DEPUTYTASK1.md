# DEPUTYTASK1 — Ingest WPQR: campi copertura (pag.1) + parametri prova (pag.2)

**Stato:** CHIUSO — TEST OK (25/07/2026, deputy)
> Riepilogo chiusura: Slice A (schema UI+AI FE/BE) + B (estrattori, fix bug processo 111↔135) + C (migrazione 133 idempotente eseguita su VPS produzione, verificata; wpqrIngest.service + welding.controller estesi) + D (form manuale WPQR) tutte completate. Test: backend Jest 918/931 (13 falliti pre-esistenti su `main`, non correlati — verificato per confronto diretto), Vitest FE 881/881, build Vite OK. Deploy backend su VPS eseguito e verificato (health OK, PID rinnovato). Branch `cursor/deputytask1-wpqr-coverage-fields`, mergiato con `main` (conflitti risolti su `documentTypeSchemas.js` con lavoro parallelo ISO 13916/14175/15609). PR da confermare per merge (tocca backend + migrazione DB — richiede conferma committente per criterio "Merge PR automatico").

**Stato storico:** APERTO  
**Priorità:** P1 — copertura requisiti commessa / ISO 3834 (non breaking)  
**Branch base:** `main`  
**Prossima migrazione disponibile:** **133** (verificare `ls database/migrations/ | sort | tail -5` prima di creare)  
**Creato da:** Lead 25/07/2026  
**PDF campione:** WPQR TEC Eurolab `24-03390-01` (UNI EN ISO 15614-1:2019 Level 2, processo 135)  
**Riferimenti:** [ISO-15614-1-range-validita-WPQR.md](../reference/ISO-15614-1-range-validita-WPQR.md) · [PLAN_INGEST_REFERENCE_CATALOGS.md](PLAN_INGEST_REFERENCE_CATALOGS.md) RC-6 · [ISO-4063](../reference/ISO-4063-processi-saldatura.md) · [ISO-6947](../reference/ISO-6947-posizioni-saldatura.md) · [ISO-TR-15608](../reference/ISO-TR-15608-gruppi-materiali.md)

> **Allineamento Git (autonomo)**: prima di leggere questo brief eseguire `git fetch origin main` e `git pull origin main`. **Non** chiedere al committente di farlo. Verificare che questo file su `origin/main` abbia `Stato: APERTO`.

---

## Contesto (leggere prima)

L’ingest WPQR oggi estrae/mostra solo un sottoinsieme minimo (`wpqr_number`, `welding_process`, `material_group`, `thickness_test_mm`, `approval_date`, `standard_reference`). Su un WPQR reale firmato mancano i campi della **pagina 1 (RANGE OF QUALIFICATION)** — indispensabili per la copertura requisiti di commessa — e i **parametri di esecuzione del test** (pag.2, dati tipo WPS/qualifica).

Evidenza Lead (25/07/2026) sul PDF campione con sole regole:

| Campo PDF | Valore reale | Estratto attuale |
|---|---|---|
| N. certificato / WPQR | `24-03390-01` | `24-03390` (troncato) |
| Processo | **135** | **111** (falso positivo su parola «elettrodo») |
| Gruppo | **1.2** | `1` |
| Posizioni / giunto / Level / diametro / filler / gas | presenti | assenti |
| Ente | TEC Eurolab | `null` |

**Obiettivo di questo deputy:** allargare schema AI + UI revisione + estrattori + persistenza DB ai campi di **copertura** (priorità) e ai parametri prova essenziali, senza riscrivere la pipeline ingest né toccare sync/auth.

---

## Cosa NON toccare

- Sync audit / ADR-008, auth JWT, RBAC.
- Pipeline generica `documentIngestPipeline` oltre al minimo per `docType=wpqr`.
- Calcolo automatico range spessore da Tabella 7/8 ISO 15614 (valori ancora da verificare — vedi avviso in `ISO-15614-1-range-validita-WPQR.md`). **Estrarre i range dichiarati sul verbale**; non inventare formule nuove.
- Matrice compatibilità gruppi materiale Tabella 5/6 (GAP documentale).
- Form manuale completo prove NDT (VT/RT/…) oltre a popolare campi già esistenti se l’AI li restituisce.
- `DEPUTYTASK.md` (profilo azienda ADR-018) — lavoro parallelo, file disgiunti.

---

## Campi target (ordine di priorità)

### P0 — Copertura (pag.1 RANGE OF QUALIFICATION)

| Campo logico | Chiave suggerita | Note |
|---|---|---|
| Numero WPQR / Test Certificate | `wpqr_number` / `certificate_number` | Accettare suffisso `-NN` (`24-03390-01`) |
| Norma + livello | `standard_reference`, `qualification_level` | Level `1`\|`2`\|null — **non** defaultare a 2 se assente |
| Processo | `welding_process` | ISO 4063; preferire codice esplicito «135» al match alias |
| Tipo giunto | `joint_type` | es. `BW`, `FW`, o testo `BW+FW` |
| Gruppo materiale | `material_group` | preferire sottogruppo `1.2` se presente |
| Spessore prova | `thickness_test_mm` | dal record di prova (pag.2) |
| Range spessore dichiarato BW/FW | `thickness_min`, `thickness_max` (+ opz. testo `thickness_range_declared`) | **dal verbale**, non ricalcolare |
| Diametro tubo | `diameter_min`, `diameter_max` o testo `diameter_range` | colonne DB già esistono |
| Posizioni | `welding_positions` | ISO 6947 (es. `PA`) |
| Filler | `filler_material` | designazione ISO 14341 |
| PWHT | `pwht` | boolean |
| WPS di riferimento | `wps_ref` (testo) | es. `002p_24 rev.0` — **non** obbligatorio risolvere FK `wps_id` in questa slice |
| Ente / saldatore | `examiner_body` / `welder_name` | TEC Eurolab già in select issuing_body |
| Date | `issue_date` / `approval_date` | preferire «Record issued» / data emissione verbale |

### P1 — Parametri prova (pag.2, essenziali)

| Campo | Chiave | Note |
|---|---|---|
| Specifica materiale base | `base_material_spec` | es. `S355J2+N` |
| Gas protezione | `shielding_gas` | es. `M20` / `Ar 92% CO2 8%` |
| Tipo corrente | `current_type` | es. `DC-EP` |
| Trasferimento metallo | `metal_transfer` | Short/Spray/… |
| Grado meccanizzazione | `mechanization` | manual / partly mechanized / mechanized / automatic |
| Single/multi run | `single_multi_run` | `single`\|`multi` |
| Heat input note | `heat_input_note` | testo breve (±25% …) — opzionale NVARCHAR |

**Fuori scope slice:** tabella passate completa (A/V/speed per run), allegati rapporti NDT singoli.

---

## Slice A — Schema UI revisione + prompt AI (FE+BE mirror)

**File:**

- `app/src/data/documentTypeSchemas.js` — blocco `wpqr`
- `backend/src/data/documentTypeSchemas.js` — mirror `aiPrompt` + `aiExpectedSchema`
- Sezione prompt posizioni/processo già gated per `wpqr` in `importAiExtraction.service.js` — verificare che resti attiva

**Cosa fare:**

1. Espandere `fields` della revisione WPQR con i campi P0 (+ P1 se spazio UI ok; raggruppare con `hint`).
2. Aggiornare `aiPrompt` / `aiExpectedSchema` di conseguenza.
3. `rangeFields` aggiornato: almeno processo, gruppo, spessore, posizioni, thickness_min/max.
4. Encoding UTF-8, accenti italiani corretti.

**DoD:** in revisione ingest compaiono i nuovi campi; build FE ok.

---

## Slice B — Estrattori euristici + bug fix processo 111

**File:**

- `backend/src/utils/ruleFieldExtractors.js` (+ test esistenti/nuovi)
- Eventuale tweak `weldingProcesses4063.js` **solo se** necessario (attenzione regressioni patentini)

**Cosa fare:**

1. **Bug P0:** `inferWeldingProcessFromText` / ordine alias — la parola «elettrodo» (dimensione filo / electrode size) non deve vincere su un codice esplicito `135` nel testo. Preferire: (a) match codice numerico etichettato («Welding process: 135» / «Processo … 135»), poi (b) alias. Test con testo reale del PDF campione (almeno snippet pag.1–2).
2. `extractWpqrReference`: accettare `NN-NNNNN-NN` (es. `24-03390-01`).
3. `extractWpqrFields`: aggiungere posizioni (riuso `extractWeldingPositionsFromText`), filler (regex designazione / «Filler metal designation»), joint_type (BW/FW), qualification_level («Level 1|2»), diameter se possibile, welder_name, TEC Eurolab in `extractIssuingBody` (o riuso normalizzazione già presente).
4. Non impostare `expiry_date` arbitraria sull’ultima data del PDF se non etichettata come scadenza (WPQR spesso senza expiry).

**DoD:** test Jest/Node che sul testo campione processo=`135`, numero contiene `24-03390-01`, gruppo sensato (`1.2` o `1`).

---

## Slice C — Persistenza DB + map ingest

**File:**

- `database/migrations/133_wpqr_coverage_fields.sql` (idempotente, cartella **`database/migrations/`** root — mai `backend/database/migrations/`)
- `backend/scripts/run-migration-133-vps.js` (SQL inline o lettura file; pattern VPS)
- `backend/src/services/wpqrIngest.service.js` — `mapPipelineFieldsToReview` / `mapReviewFieldsToDb` / INSERT
- `backend/src/controllers/welding.controller.js` — create/update WPQR: accettare nuove colonne in `allowed` se necessario
- Test: `wpqrIngest.service.test.js`, eventuali test extractor

**Colonne nuove (solo se mancanti — verificare schema attuale):**

Suggerite (NVARCHAR/DECIMAL/BIT, tutte NULL):

- `qualification_level` NVARCHAR(10)
- `joint_type` NVARCHAR(50)
- `standard_reference` NVARCHAR(100)
- `wps_ref` NVARCHAR(100)
- `base_material_spec` NVARCHAR(100)
- `shielding_gas` NVARCHAR(100)
- `current_type` NVARCHAR(40)
- `metal_transfer` NVARCHAR(80)
- `mechanization` NVARCHAR(40)
- `single_multi_run` NVARCHAR(20)
- `heat_input_note` NVARCHAR(200)
- `thickness_range_declared` NVARCHAR(100) (opz.; altrimenti usare solo min/max già presenti)
- `diameter_range` NVARCHAR(200) (opz. testo libero se min/max ambigui)

Usare colonne già esistenti dove possibile: `diameter_min`/`diameter_max`, `filler_material`, `welding_positions`, `thickness_min`/`thickness_max`, `pwht`.

**Regola range:** se il verbale dichiara BW 3–24, salvare quei valori in `thickness_min`/`thickness_max` e **non** sovrascriverli con `calcThicknessRange(thickness_tested)` salvo assenza del dichiarato.

**DoD:** commit staging → riga `wpqr_records` con almeno processo, gruppo, posizioni, thickness_min/max, qualification_level, joint_type, standard_reference popolabili; migration idempotente; deploy-manifest se nuovi file JS.

---

## Slice D — Form manuale WPQR (allineamento minimo)

**File:** `app/src/pages/WeldingProceduresPage.jsx` (`WPQRFormModal`)

Aggiungere i campi P0 mancanti al form manuale (Level, joint_type, standard_reference, wps_ref, diametro, filler se assente) riusando class CSS `wp-form-*` esistenti. Niente redesign.

**DoD:** create/update manuale salva i nuovi campi senza errore API.

---

## Test e chiusura

```bash
cd backend && npm test -- --testPathPattern='wpqrIngest|ruleFieldExtractors|weldingProcesses' 2>&1 | tail -40
cd app && NODE_ENV=test npm run test:run 2>&1 | tail -30
cd app && npm run build 2>&1 | tail -20
```

Migrazione: pattern Cloud Agent SCP + `node /tmp/run-migration-133-vps.js` sul VPS (non SQL diretto dal cloud).

Dopo TEST OK: aggiornare questo file `Stato: CHIUSO`, nota breve in `docs/GUIDA_CONSOLIDATA.md` (sezione Esperienza), PR ready + merge se solo FE/schema+test verdi; se tocca migration/controller chiedere conferma merge solo se CI rossa o conflitto — altrimenti merge ok dopo smoke migration.

---

## Criterio «già fatto?» (anti-doppio lavoro)

Prima di codificare: `rg "qualification_level" backend/src app/src database/migrations`. Se già presente su `main`, marcare CHIUSO senza riscrivere.

---

## Esito atteso in chat

`TEST OK` oppure `FIX NON APPLICABILI` con motivo.

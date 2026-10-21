'use strict';

/**
 * reprocessableFields.js — registro centralizzato dei campi AI-estraibili che
 * possono richiedere un "backfill" (rielaborazione) su record già presenti in
 * DB, quando il PDF originale è ancora conservato su disco.
 *
 * Nato dal pattern one-off `backend/scripts/reprocess-qualifications.js`
 * (28/07/2026, campo `transfer_mode`, 15 qualifiche). Da quella sessione in poi,
 * per aggiungere un nuovo campo rielaborabile **non serve un nuovo script**:
 * basta una nuova voce qui sotto. Il registro è l'unica fonte usata sia dallo
 * script CLI (`reprocess-qualifications.js`) sia dall'endpoint superadmin
 * (`GET/POST /admin/reprocess-tasks`, `reprocessTasks.controller.js`).
 *
 * Campi di ogni voce:
 * - `key`: identificatore univoco nel registro (usato come URL param
 *   `/admin/reprocess-tasks/:key/run` e come `field_scope` in ingest_staging).
 *   Di norma coincide col nome colonna; se un'altra tabella ha già una voce
 *   con lo stesso nome colonna (es. `thickness_max_unlimited` su
 *   `qualifications` e su `wpqr_records`), la seconda va prefissata (es.
 *   `wpqr_thickness_max_unlimited`) e deve valorizzare `column` esplicitamente.
 * - `column`: nome colonna DB reale, se diverso da `key` (vedi sopra).
 *   Opzionale, default = `key`. Deve esistere anche nella whitelist di
 *   scrittura della tabella corrispondente (REPROCESSABLE_FIELDS in
 *   qualificationIngest.service.js per `qualifications`,
 *   WPQR_REPROCESSABLE_FIELDS in wpqrIngest.service.js per `wpqr_records`)
 *   — whitelist separate per non introdurre un secondo punto di verità
 *   sulla scrittura.
 * - `label`: etichetta leggibile per l'alert e il pannello superadmin.
 * - `module`: modulo licenza/UI di riferimento (`qualifiche` o `saldatura`).
 * - `table`: tabella DB coinvolta (`qualifications` o `wpqr_records`) — vedi
 *   `reprocessTableAdapters.js` per la logica specifica di ciascuna tabella.
 * - `qualTypeLike`: filtro SQL LIKE su qualification_type per i candidati
 *   (solo tabella `qualifications` — `wpqr_records` non ha questa colonna).
 * - `qualTypeLikeAny` (opzionale, solo `qualifications`): come `qualTypeLike` ma elenco di pattern
 *   in OR (campo valido per piu' tipi, es. 9606 e 14732). Se presente ha precedenza su `qualTypeLike`.
 * - `processWhitelist`: se valorizzato, il welding_process (ISO 4063) deve
 *   contenere uno dei codici elencati, altrimenti il campo non è
 *   normativamente applicabile (evita proposte inutili). `null` = nessun filtro.
 * - `jointTypeWhitelist`: come `processWhitelist`, ma su `joint_type` (es.
 *   gola/throat rilevante solo per giunti FW). `null` = nessun filtro.
 * - `candidateWhere`: condizione SQL di selezione candidati, se diversa dal
 *   default `${column} IS NULL` — necessaria per colonne NOT NULL con default
 *   (es. flag booleani come `thickness_max_unlimited`, dove "manca il dato"
 *   non coincide con "colonna NULL"). Opzionale, default `${column} IS NULL`.
 * - `bundleColumns` (opzionale, WPQR): elenco colonne scritte insieme in un
 *   solo passaggio AI / una sola proposta staging (es. t1+t2). Evita N chiamate
 *   sullo stesso PDF. La whitelist di scrittura espone la stessa chiave con
 *   `bundleColumns` dettagliate (writeGuard per colonna).
 * - `kind` (opzionale): assente = `'backfill'` (voci qui sopra, invariate).
 *   `'verify'` = verifica in SOLA LETTURA vs norma (VQ-8): nessuna `column`, nessun
 *   `candidateWhere`, nessuna whitelist di scrittura, nessuna AI, nessun PDF letto, nessuna
 *   proposta in coda. Campi: `verifyFamily` (famiglia norma del registry di verifica,
 *   `qualificationVerify`), `qualTypeLike`. Il conteggio non entra nel totale «dati AI mancanti»
 *   e non scende dopo l'esecuzione: si azzera correggendo i record in Qualifiche.
 */
const { CONTINUOUS_WIRE_ARC_PROCESSES } = require('./weldingQualificationRules9606');

const REPROCESSABLE_FIELD_REGISTRY = {
    transfer_mode: {
        key: 'transfer_mode',
        label: 'Metodo di trasferimento',
        module: 'qualifiche',
        table: 'qualifications',
        qualTypeLike: '%9606%',
        processWhitelist: CONTINUOUS_WIRE_ARC_PROCESSES,
    },
    shielding_gas: {
        key: 'shielding_gas',
        label: 'Gas di protezione',
        module: 'qualifiche',
        table: 'qualifications',
        qualTypeLike: '%9606%',
        processWhitelist: null,
    },
    joint_type: {
        key: 'joint_type',
        label: 'Tipo di giunto',
        module: 'qualifiche',
        table: 'qualifications',
        qualTypeLike: '%9606%',
        processWhitelist: null,
    },
    weld_details: {
        key: 'weld_details',
        label: 'Dettagli saldatura',
        module: 'qualifiche',
        table: 'qualifications',
        qualTypeLike: '%9606%',
        processWhitelist: null,
    },
    // Campi persi al commit ingest (01/08/2026) — vedi GUIDA lezione LOVETERE / PR #340.
    // Alias AI → colonna: filler_material_group → filler_material;
    // pipe_diameter_mm → pipe_diameter_min_mm (risolti in qualificationReprocess.service).
    filler_material: {
        key: 'filler_material',
        label: 'Gruppo materiale d\'apporto (FM)',
        module: 'qualifiche',
        table: 'qualifications',
        qualTypeLike: '%9606%',
        processWhitelist: null,
    },
    pipe_diameter_min_mm: {
        key: 'pipe_diameter_min_mm',
        label: 'Diametro tubo min (mm)',
        module: 'qualifiche',
        table: 'qualifications',
        qualTypeLike: '%9606%',
        // Solo tubo (ISO 9606-1 Tabella 7) — evita chiamate AI inutili su piastre.
        productTypeWhitelist: ['T'],
        processWhitelist: null,
    },
    // Gap analysis 08/08/2026 (fix thickness_max_unlimited esteso alle qualifiche,
    // migrazione 140): patentini ingeriti PRIMA di quel fix hanno la colonna al
    // default (0) anche quando il certificato dichiarava un range aperto — la
    // rielaborazione permette di recuperarlo senza richiedere all'utente di
    // ricaricare il PDF. candidateWhere dedicato: la colonna è NOT NULL, "manca
    // il dato" qui significa "ancora al default E spessore massimo non dichiarato".
    thickness_max_unlimited: {
        key: 'thickness_max_unlimited',
        label: 'Spessore massimo — nessun limite superiore',
        module: 'qualifiche',
        table: 'qualifications',
        qualTypeLike: '%9606%',
        processWhitelist: null,
        candidateWhere: 'thickness_max_unlimited = 0 AND thickness_max_mm IS NULL',
    },
    welding_process_test: {
        key: 'welding_process_test',
        label: 'Processo ISO 4063 — prova',
        module: 'qualifiche',
        table: 'qualifications',
        qualTypeLike: '%9606%',
        processWhitelist: null,
    },
    welding_processes_validity: {
        key: 'welding_processes_validity',
        label: 'Processi ISO 4063 — validità',
        module: 'qualifiche',
        table: 'qualifications',
        qualTypeLike: '%9606%',
        processWhitelist: null,
    },
    welding_position_test: {
        key: 'welding_position_test',
        label: 'Posizione di prova',
        module: 'qualifiche',
        table: 'qualifications',
        qualTypeLike: '%9606%',
        processWhitelist: null,
    },
    thickness_s_test_mm: {
        key: 'thickness_s_test_mm',
        label: 'Spessore depositato s — prova (BW)',
        module: 'qualifiche',
        table: 'qualifications',
        qualTypeLike: '%9606%',
        processWhitelist: null,
        jointTypeWhitelist: ['BW'],
    },
    thickness_t_test_mm: {
        key: 'thickness_t_test_mm',
        label: 'Spessore materiale t del provino — prova (FW)',
        module: 'qualifiche',
        table: 'qualifications',
        qualTypeLike: '%9606%',
        processWhitelist: null,
        jointTypeWhitelist: ['FW'],
    },
    pipe_diameter_test_mm: {
        key: 'pipe_diameter_test_mm',
        label: 'Diametro tubo — prova (mm)',
        module: 'qualifiche',
        table: 'qualifications',
        qualTypeLike: '%9606%',
        productTypeWhitelist: ['T'],
        processWhitelist: null,
    },
    qualification_designation: {
        key: 'qualification_designation',
        label: 'Designazione stampata ISO 9606-1',
        module: 'qualifiche',
        table: 'qualifications',
        qualTypeLike: '%9606%',
        processWhitelist: null,
    },
    // Smoke ingest 08/10/2026: l'emissione era copiata dalla data esame. Candidati: emissione
    // assente OPPURE identica alla data esame (valore derivato dal vecchio comportamento).
    // Colonne gia' esistenti (032 issue_date, 084 examiner_body, 032 standard_ref): nessuna migrazione.
    issue_date: {
        key: 'issue_date',
        label: 'Data di emissione certificato',
        module: 'qualifiche',
        table: 'qualifications',
        qualTypeLikeAny: ['%9606%', '%14732%'],
        processWhitelist: null,
        candidateWhere: '(issue_date IS NULL OR issue_date = exam_date)',
    },
    examiner_body: {
        key: 'examiner_body',
        label: 'Ente / esaminatore',
        module: 'qualifiche',
        table: 'qualifications',
        qualTypeLikeAny: ['%9606%', '%14732%'],
        processWhitelist: null,
    },
    // AI `standard_reference` -> colonna `standard_ref` (nuovo per qualifica_14732; il patentino lo estraeva gia').
    standard_ref: {
        key: 'standard_ref',
        label: 'Norma di riferimento (edizione) — ISO 14732',
        module: 'qualifiche',
        table: 'qualifications',
        qualTypeLike: '%14732%',
        processWhitelist: null,
    },

    // ============================================================
    // WPQR (wpqr_records) — generalizzazione 08/08/2026, gap analysis
    // GAP_WPQR_ESTENSIONI_ANNEX_B_2026-08-07.md: 7 WPQR in produzione (4 con
    // PDF ancora disponibile) ingerite prima dei fix 07-08/08/2026 restano
    // con questi campi vuoti/di default finché non rielaborate.
    // ============================================================
    preheat_temp: {
        key: 'preheat_temp',
        label: 'Temperatura preriscaldo (Tp) — WPQR',
        module: 'saldatura',
        table: 'wpqr_records',
        processWhitelist: null,
    },
    interpass_temp: {
        key: 'interpass_temp',
        label: 'Temperatura interpass (Ti) — WPQR',
        module: 'saldatura',
        table: 'wpqr_records',
        processWhitelist: null,
    },
    throat_test_mm: {
        key: 'throat_test_mm',
        label: 'Spessore gola provino — WPQR',
        module: 'saldatura',
        table: 'wpqr_records',
        processWhitelist: null,
        // Tabella 8 ISO 15614-1: la gola è una variabile qualificata solo sui
        // giunti d'angolo — evita chiamate AI inutili sui giunti BW.
        jointTypeWhitelist: ['FW'],
    },
    product_type: {
        key: 'product_type',
        label: 'Tipo prodotto testato (piastra/tubo) — WPQR',
        module: 'saldatura',
        table: 'wpqr_records',
        processWhitelist: null,
    },
    rotated_position: {
        key: 'rotated_position',
        label: 'Posizione tubo ruotato (PF/PA) — WPQR',
        module: 'saldatura',
        table: 'wpqr_records',
        processWhitelist: null,
        // Rilevante SOLO se testata su piastra e posizione PF/PA dichiarata
        // (ISO 15614-1 §8.3.3 — regola piastra→tubo): fuori da questo caso
        // il flag resta correttamente false, non serve rielaborarlo.
        candidateWhere: "rotated_position = 0 AND product_type = 'P' AND (welding_positions LIKE '%PF%' OR welding_positions LIKE '%PA%')",
    },
    wpqr_thickness_max_unlimited: {
        key: 'wpqr_thickness_max_unlimited',
        column: 'thickness_max_unlimited',
        label: 'Spessore massimo — nessun limite superiore (WPQR)',
        module: 'saldatura',
        table: 'wpqr_records',
        processWhitelist: null,
        candidateWhere: 'thickness_max_unlimited = 0 AND thickness_max IS NULL',
    },
    // PR #558 / mig. 158: range duali t1/t2 su FW. Un solo passaggio AI
    // (bundle) popola fino a 6 colonne — evita 6 chiamate sullo stesso PDF.
    // Candidati: entrambi i min ancora NULL (mai popolati) + PDF su disco.
    // jointTypeWhitelist FW: i BW a singolo range restano sul legacy.
    wpqr_thickness_t1_t2: {
        key: 'wpqr_thickness_t1_t2',
        column: 'thickness_t1_min',
        label: 'Range spessore duali t1/t2 (FW) — WPQR',
        module: 'saldatura',
        table: 'wpqr_records',
        processWhitelist: null,
        jointTypeWhitelist: ['FW'],
        candidateWhere: 'thickness_t1_min IS NULL AND thickness_t2_min IS NULL',
        // Colonne scritte insieme alla conferma (stesso field_scope).
        bundleColumns: [
            'thickness_t1_min',
            'thickness_t1_max',
            'thickness_t1_max_unlimited',
            'thickness_t2_min',
            'thickness_t2_max',
            'thickness_t2_max_unlimited',
        ],
    },
    // STUD-1 (mig. 159): backfill elemento qualificato + Parent Metal 2.
    // Chiavi = schema AI (come product_type), niente prefisso wpqr_ (no collisione).
    qualifying_element: {
        key: 'qualifying_element',
        column: 'qualifying_element',
        label: 'Elemento che si qualifica (base / prigioniero) — WPQR',
        module: 'saldatura',
        table: 'wpqr_records',
        processWhitelist: null,
        candidateWhere: 'qualifying_element IS NULL',
    },
    material_group_2: {
        key: 'material_group_2',
        column: 'base_material_group_2',
        label: 'Gruppo materiale Parent Metal 2 — WPQR',
        module: 'saldatura',
        table: 'wpqr_records',
        processWhitelist: null,
        candidateWhere: 'base_material_group_2 IS NULL',
    },
    base_material_spec_2: {
        key: 'base_material_spec_2',
        column: 'base_material_spec_2',
        label: 'Specifica materiale Parent Metal 2 — WPQR',
        module: 'saldatura',
        table: 'wpqr_records',
        processWhitelist: null,
        candidateWhere: 'base_material_spec_2 IS NULL',
    },
    wpqr_test_date: {
        key: 'wpqr_test_date',
        column: 'test_date',
        label: 'Data di saldatura — WPQR',
        module: 'saldatura',
        table: 'wpqr_records',
        processWhitelist: null,
        candidateWhere: 'test_date IS NULL',
    },
    wpqr_welding_position_test: {
        key: 'wpqr_welding_position_test',
        column: 'welding_position_test',
        label: 'Posizione di saldatura della prova — WPQR',
        module: 'saldatura',
        table: 'wpqr_records',
        processWhitelist: null,
        candidateWhere: 'welding_position_test IS NULL',
    },
    wpqr_diameter_test_mm: {
        key: 'wpqr_diameter_test_mm',
        column: 'diameter_test_mm',
        label: 'Diametro del provino — WPQR',
        module: 'saldatura',
        table: 'wpqr_records',
        processWhitelist: null,
        candidateWhere: 'diameter_test_mm IS NULL',
    },
    wpqr_deposited_thickness_mm: {
        key: 'wpqr_deposited_thickness_mm',
        column: 'deposited_thickness_mm',
        label: 'Spessore metallo depositato — WPQR',
        module: 'saldatura',
        table: 'wpqr_records',
        processWhitelist: null,
        candidateWhere: 'deposited_thickness_mm IS NULL',
    },
    wpqr_thickness_t2_test_mm: {
        key: 'wpqr_thickness_t2_test_mm',
        column: 'thickness_t2_test_mm',
        label: 'Spessore di prova del secondo elemento — WPQR',
        module: 'saldatura',
        table: 'wpqr_records',
        processWhitelist: null,
        candidateWhere: 'thickness_t2_test_mm IS NULL',
    },
    wpqr_filler_make: {
        key: 'wpqr_filler_make',
        column: 'filler_make',
        label: 'Make del materiale d\'apporto — WPQR',
        module: 'saldatura',
        table: 'wpqr_records',
        processWhitelist: null,
        candidateWhere: 'filler_make IS NULL',
    },
    wpqr_filler_size: {
        key: 'wpqr_filler_size',
        column: 'filler_size',
        label: 'Size del materiale d\'apporto (testata) — WPQR',
        module: 'saldatura',
        table: 'wpqr_records',
        processWhitelist: null,
        candidateWhere: 'filler_size IS NULL',
    },
    wpqr_backing_gas: {
        key: 'wpqr_backing_gas',
        column: 'backing_gas',
        label: 'Gas di protezione al rovescio — WPQR',
        module: 'saldatura',
        table: 'wpqr_records',
        processWhitelist: null,
        candidateWhere: 'backing_gas IS NULL',
    },
    wpqr_pwht_details: {
        key: 'wpqr_pwht_details',
        column: 'pwht_details',
        label: 'Dettagli PWHT — WPQR',
        module: 'saldatura',
        table: 'wpqr_records',
        processWhitelist: null,
        candidateWhere: 'pwht_details IS NULL',
    },
    wpqr_heat_input_kind: {
        key: 'wpqr_heat_input_kind',
        column: 'heat_input_kind',
        label: 'Tipo di calcolo apporto termico — WPQR',
        module: 'saldatura',
        table: 'wpqr_records',
        processWhitelist: null,
        candidateWhere: 'heat_input_kind IS NULL',
    },
    wpqr_range_standard_reference: {
        key: 'wpqr_range_standard_reference',
        column: 'range_standard_reference',
        label: 'Norma del range (se diversa dalla qualifica) — WPQR',
        module: 'saldatura',
        table: 'wpqr_records',
        processWhitelist: null,
        candidateWhere: 'range_standard_reference IS NULL',
    },
    wpqr_heat_input_range: {
        key: 'wpqr_heat_input_range',
        column: 'heat_input_range_min',
        label: 'Range / tolleranza apporto termico — WPQR',
        module: 'saldatura',
        table: 'wpqr_records',
        processWhitelist: null,
        candidateWhere: 'heat_input_range_min IS NULL AND heat_input_tol_minus_pct IS NULL',
        bundleColumns: [
            'heat_input_range_min', 'heat_input_range_max', 'heat_input_range_unit',
            'heat_input_range_basis', 'heat_input_tol_minus_pct', 'heat_input_tol_plus_pct',
            'heat_input_plus_unlimited',
        ],
    },
    wpqr_preheat_interpass_test: {
        key: 'wpqr_preheat_interpass_test',
        column: 'preheat_temp_test',
        label: 'Preriscaldo e interpass di prova — WPQR',
        module: 'saldatura',
        table: 'wpqr_records',
        processWhitelist: null,
        candidateWhere: 'preheat_temp_test IS NULL',
        bundleColumns: ['preheat_temp_test', 'interpass_temp_test'],
    },
    wpqr_process_params: {
        key: 'wpqr_process_params',
        column: 'nozzle_diameter_mm',
        label: 'Parametri di processo (pag. 2) — WPQR',
        module: 'saldatura',
        table: 'wpqr_records',
        processWhitelist: null,
        candidateWhere: 'nozzle_diameter_mm IS NULL AND joint_preparation IS NULL',
        bundleColumns: [
            'shielding_gas_flow_l_min_min', 'shielding_gas_flow_l_min_max', 'nozzle_diameter_mm',
            'contact_tube_distance_mm_min', 'contact_tube_distance_mm_max', 'torch_angle_deg',
            'joint_preparation', 'cleaning_method', 'bead_technique', 'electrode_count', 'other_test_info',
        ],
    },
    wpqr_test_results: {
        key: 'wpqr_test_results',
        column: 'vt_result',
        label: 'Esiti di prova (VT…macro) — WPQR',
        module: 'saldatura',
        table: 'wpqr_records',
        processWhitelist: null,
        // NA è un valore vero («non richiesto»), non «mai letto». Candidato solo se NULL.
        candidateWhere: 'vt_result IS NULL',
        bundleColumns: [
            'vt_result', 'pt_result', 'mt_result', 'rt_result', 'ut_result',
            'tensile_result', 'bend_result', 'impact_result', 'hardness_result', 'macro_result',
        ],
    },
    wpqr_test_runs: {
        key: 'wpqr_test_runs',
        column: 'id',
        label: 'Passate di prova (pag. 2) — WPQR',
        module: 'saldatura',
        table: 'wpqr_test_runs',
        processWhitelist: null,
        candidateWhere: 'NOT EXISTS (SELECT 1 FROM wpqr_test_runs r WHERE r.wpqr_id = wpqr_records.id AND r.deleted_at IS NULL)',
    },
    wpqr_validity_runs: {
        key: 'wpqr_validity_runs',
        column: 'id',
        label: 'Passate solo in tabella di validità — WPQR',
        module: 'saldatura',
        table: 'wpqr_test_runs',
        processWhitelist: null,
        // Richiede la migrazione 184 (current_a_min). Il conteggio non lancia
        // questo SQL finché la colonna non c'è (selectReprocessCandidates).
        // Candidati: WPQR che hanno già passate di prova ma nessun range archiviato.
        candidateWhere: 'EXISTS (SELECT 1 FROM wpqr_test_runs r WHERE r.wpqr_id = wpqr_records.id AND r.deleted_at IS NULL) AND NOT EXISTS (SELECT 1 FROM wpqr_test_runs r WHERE r.wpqr_id = wpqr_records.id AND r.deleted_at IS NULL AND r.current_a_min IS NOT NULL)',
    },

    // ============================================================
    // Voci di VERIFICA (kind: 'verify') — sola lettura, vedi header.
    // Piano: docs/agent-tasks/PLAN_VERIFICA_QUALIFICHE_NORMA_SLICES.md § 2.
    // ============================================================
    verify_9606_1: {
        key: 'verify_9606_1',
        kind: 'verify',
        label: 'Verifica qualifiche ISO 9606-1 vs norma',
        module: 'qualifiche',
        table: 'qualifications',
        qualTypeLike: '%9606%',
        verifyFamily: '9606-1',
    },
    verify_9606_2: {
        key: 'verify_9606_2',
        kind: 'verify',
        label: 'Verifica qualifiche ISO 9606-2 vs norma',
        module: 'qualifiche',
        table: 'qualifications',
        qualTypeLike: '%9606%',
        verifyFamily: '9606-2',
    },
};

function listReprocessableFields() {
    return Object.values(REPROCESSABLE_FIELD_REGISTRY);
}


function getReprocessableField(key) {
    return REPROCESSABLE_FIELD_REGISTRY[key] || null;
}

module.exports = {
    REPROCESSABLE_FIELD_REGISTRY,
    listReprocessableFields,
    getReprocessableField,
};

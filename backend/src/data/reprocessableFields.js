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

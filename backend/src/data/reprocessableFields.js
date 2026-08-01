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
 * - `key`: nome colonna/campo (deve esistere anche in REPROCESSABLE_FIELDS di
 *   qualificationIngest.service.js — whitelist separata usata per l'UPDATE
 *   finale, per non introdurre un secondo punto di verità sulla scrittura).
 * - `label`: etichetta leggibile per l'alert e il pannello superadmin.
 * - `module`: modulo licenza/UI di riferimento (per ora solo 'qualifiche').
 * - `table`: tabella DB coinvolta (per ora solo 'qualifications').
 * - `qualTypeLike`: filtro SQL LIKE su qualification_type per i candidati.
 * - `processWhitelist`: se valorizzato, il welding_process (ISO 4063) deve
 *   contenere uno dei codici elencati, altrimenti il campo non è
 *   normativamente applicabile (evita proposte inutili). `null` = nessun filtro.
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

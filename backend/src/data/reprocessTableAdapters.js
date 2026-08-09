'use strict';

/**
 * reprocessTableAdapters.js — specificità per-tabella del meccanismo di
 * rielaborazione (backfill), generalizzato 08/08/2026 dalla WPQR (prima
 * copriva solo `qualifications` — vedi qualificationReprocess.service.js e
 * GAP_WPQR_ESTENSIONI_ANNEX_B_2026-08-07.md).
 *
 * Ogni voce descrive come, per una data tabella:
 * - selezionare le colonne minime necessarie per identificare un candidato
 *   e rilanciare l'estrazione AI (sempre incluse: id, organization_id,
 *   company_id, certificate_file_url — controllate a monte dal chiamante);
 * - determinare il docType da passare alla pipeline di ingest;
 * - mappare i campi grezzi della pipeline in reviewFields — riusa SEMPRE
 *   la stessa funzione già usata dall'ingest "a caldo" (mai duplicata);
 * - quali campi extra mostrare nella coda di revisione superadmin (titolo
 *   della proposta, es. nome persona o codice WPQR);
 * - su quale colonna di `ingest_staging` punta il riferimento al record
 *   target (`target_qualification_id` / `target_wpqr_id` — colonne dedicate,
 *   non una FK polimorfica, per restare coerenti con la migrazione 137);
 * - un'eventuale condizione SQL aggiuntiva di esclusione candidati (es.
 *   niente qualifiche revocate — non applicabile alla WPQR, che non ha
 *   quello stato).
 */
const { mapPipelineFieldsToReview: mapQualificationFields } = require('../services/qualificationIngest.service');
const { mapPipelineFieldsToReview: mapWpqrFields } = require('../services/wpqrIngest.service');

const TABLE_ADAPTERS = {
    qualifications: {
        targetIdColumn: 'target_qualification_id',
        resultIdKey: 'qualification_id',
        excludeCondition: "status != 'revocata'",
        candidateSelectColumns: 'id, organization_id, company_id, person_name, welding_process, product_type, joint_type, qualification_type, certificate_file_url',
        resolveDocType: (row) => (/14732/.test(row.qualification_type || '') ? 'qualifica_14732' : 'patentino_saldatore'),
        // Firma comune (fields, text, fileName) — qualifications usa davvero
        // il testo pipeline per classify/mappare, WPQR lo ignora (vedi sotto).
        mapPipelineFieldsToReview: (fields, text, fileName) => mapQualificationFields(fields, text, fileName),
        buildStagingDisplayFields: (reviewFields) => ({
            person_name: reviewFields.person_name,
            certificate_number: reviewFields.certificate_number,
        }),
    },
    wpqr_records: {
        targetIdColumn: 'target_wpqr_id',
        resultIdKey: 'wpqr_id',
        excludeCondition: null,
        candidateSelectColumns: 'id, organization_id, company_id, wpqr_code, welding_process, product_type, joint_type, welding_positions, thickness_tested, certificate_file_url',
        resolveDocType: () => 'wpqr',
        // wpqrIngest.mapPipelineFieldsToReview(f, fileName) non usa il testo
        // pipeline — parametro ignorato solo per uniformare la firma comune.
        mapPipelineFieldsToReview: (fields, _text, fileName) => mapWpqrFields(fields, fileName),
        buildStagingDisplayFields: (reviewFields) => ({
            wpqr_code: reviewFields.wpqr_number || reviewFields.reference_number,
            certificate_number: reviewFields.certificate_number,
        }),
    },
};

function getTableAdapter(table) {
    const adapter = TABLE_ADAPTERS[table];
    if (!adapter) {
        throw new Error(`Nessun adapter di rielaborazione registrato per la tabella "${table}"`);
    }
    return adapter;
}

module.exports = { TABLE_ADAPTERS, getTableAdapter };

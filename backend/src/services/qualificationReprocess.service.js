/**
 * qualificationReprocess.service.js — logica condivisa di "rielaborazione"
 * (backfill) di campi AI-estraibili su qualifiche già presenti in DB.
 *
 * Estratta da backend/scripts/reprocess-qualifications.js (28/07/2026, primo
 * campo: transfer_mode) per essere richiamabile sia dallo script CLI sia
 * dall'endpoint superadmin (`reprocessTasks.controller.js`) — UNA sola
 * implementazione, mai duplicata. Il registro dei campi rielaborabili vive in
 * `../data/reprocessableFields.js`.
 *
 * Integrità dati (non negoziabile): questo servizio NON scrive mai
 * direttamente sul record qualifications. Crea solo proposte in
 * ingest_staging (migrazione 137) — un utente autorizzato deve confermarle in
 * revisione (stessa coda di IngestReviewDialog / ReprocessQueueBanner) prima
 * che il valore venga scritto sul record definitivo.
 */
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const { query } = require('../config/database');
const { runDocumentIngest } = require('./documentIngestPipeline.service');
const { mapPipelineFieldsToReview, REPROCESSABLE_FIELDS } = require('./qualificationIngest.service');
const { createStagingRecord } = require('./ingestStaging.service');
const { getReprocessableField } = require('../data/reprocessableFields');

/** Limite di sicurezza per un singolo lancio sincrono via API (evita richieste troppo lunghe). */
const DEFAULT_RUN_LIMIT = 100;

function resolveUploadBase() {
    return process.env.UPLOAD_DIR
        ? path.resolve(process.env.UPLOAD_DIR)
        : path.resolve(__dirname, '../../uploads');
}

function resolveCertificateFilePath(certificateFileUrl) {
    const uploadBase = resolveUploadBase();
    const relPart = certificateFileUrl.replace(/^\//, '').replace(/^uploads\//, '');
    return path.join(uploadBase, relPart);
}

function guessDocType(qualificationType) {
    return /14732/.test(qualificationType || '') ? 'qualifica_14732' : 'patentino_saldatore';
}

/**
 * Selezione candidati: qualifiche con `field` NULL, non revocate, con un file
 * certificato ancora presente su disco, filtrate per pertinenza normativa.
 * Esportata per test unitari sulla logica di selezione (senza I/O reale) e per
 * il conteggio esposto dall'endpoint superadmin.
 */
async function selectReprocessCandidates(field, config, { orgId = null } = {}) {
    if (!REPROCESSABLE_FIELDS[field]) {
        throw new Error(`Campo non rielaborabile: ${field} (aggiungilo a REPROCESSABLE_FIELDS)`);
    }

    const conditions = [
        `${field} IS NULL`,
        "status != 'revocata'",
        'certificate_file_url IS NOT NULL',
    ];
    const params = {};
    if (config.qualTypeLike) {
        conditions.push('qualification_type LIKE @qualTypeLike');
        params.qualTypeLike = config.qualTypeLike;
    }
    if (orgId) {
        conditions.push('organization_id = @orgId');
        params.orgId = orgId;
    }

    const result = await query(`
        SELECT id, organization_id, company_id, person_name, welding_process,
               qualification_type, certificate_file_url
        FROM qualifications
        WHERE ${conditions.join(' AND ')}
        ORDER BY id
    `, params);

    const rows = result.recordset || [];
    if (!Array.isArray(config.processWhitelist) || !config.processWhitelist.length) {
        return rows;
    }
    return rows.filter((r) => {
        const proc = String(r.welding_process || '');
        return config.processWhitelist.some((code) => proc.includes(code));
    });
}

async function hasPendingProposal(qualificationId, field) {
    const r = await query(`
        SELECT TOP 1 id FROM ingest_staging
        WHERE target_qualification_id = @qualificationId
          AND field_scope = @field
          AND review_status = 'pending'
    `, { qualificationId, field });
    return r.recordset.length > 0;
}

/**
 * Conteggio candidati per una voce del registro, con breakdown per
 * organizzazione (uso pannello superadmin cross-tenant — vedi
 * reprocessTasks.controller.js). Non tocca mai il disco né chiama l'AI: solo
 * SELECT + filtro JS, stesso identico criterio di `selectReprocessCandidates`.
 * @returns {Promise<{ total: number, byOrganization: Array<{organization_id:number, count:number}> }>}
 */
async function countReprocessCandidates(fieldKey, { orgId = null } = {}) {
    const fieldDef = getReprocessableField(fieldKey);
    if (!fieldDef) {
        throw new Error(`Campo non registrato: ${fieldKey}`);
    }
    const candidates = await selectReprocessCandidates(fieldKey, fieldDef, { orgId });

    const byOrgMap = new Map();
    for (const row of candidates) {
        const orgKey = row.organization_id;
        byOrgMap.set(orgKey, (byOrgMap.get(orgKey) || 0) + 1);
    }
    const byOrganization = Array.from(byOrgMap.entries()).map(([organization_id, count]) => ({
        organization_id,
        count,
    }));

    return { total: candidates.length, byOrganization };
}

/**
 * Esegue la rielaborazione per un campo registrato: rilancia l'estrazione AI
 * sui PDF già caricati dei candidati e crea le proposte in ingest_staging.
 * Sincrona (nessuna coda/job): pensata per volumi da decine a poche centinaia
 * di record — `limit` (default DEFAULT_RUN_LIMIT) evita che una richiesta HTTP
 * resti bloccata troppo a lungo se il registro in futuro copre volumi grandi;
 * se ci sono più candidati del limite, il riepilogo lo segnala esplicitamente
 * così l'operatore può rilanciare per continuare (i candidati già proposti
 * vengono sempre saltati — dedup su ingest_staging pending).
 * @returns {Promise<{field:string,candidatesFound:number,candidatesProcessed:number,proposalsCreated:number,skippedAlreadyProposed:number,skippedNoFile:number,skippedNoValueExtracted:number,errors:number,errorDetails:string[],hasMore:boolean}>}
 */
async function runReprocessForField(fieldKey, { orgId = null, limit = DEFAULT_RUN_LIMIT, dryRun = false } = {}) {
    const fieldDef = getReprocessableField(fieldKey);
    if (!fieldDef) {
        throw new Error(`Campo non registrato: ${fieldKey}`);
    }

    const allCandidates = await selectReprocessCandidates(fieldKey, fieldDef, { orgId });
    const effectiveLimit = limit && limit > 0 ? limit : DEFAULT_RUN_LIMIT;
    const candidates = allCandidates.slice(0, effectiveLimit);
    const hasMore = allCandidates.length > candidates.length;

    const summary = {
        field: fieldKey,
        candidatesFound: allCandidates.length,
        candidatesProcessed: candidates.length,
        proposalsCreated: 0,
        skippedAlreadyProposed: 0,
        skippedNoFile: 0,
        skippedNoValueExtracted: 0,
        errors: 0,
        errorDetails: [],
        hasMore,
    };

    for (const row of candidates) {
        try {
            const filePath = resolveCertificateFilePath(row.certificate_file_url);
            if (!fs.existsSync(filePath)) {
                summary.skippedNoFile++;
                continue;
            }

            if (await hasPendingProposal(row.id, fieldKey)) {
                summary.skippedAlreadyProposed++;
                continue;
            }

            if (dryRun) continue;

            const docType = guessDocType(row.qualification_type);
            const fileName = path.basename(filePath);
            const pdfBuffer = fs.readFileSync(filePath);

            const pipeline = await runDocumentIngest({
                pdfBuffer,
                docType,
                fileName,
                organizationId: row.organization_id,
            });
            const reviewFields = mapPipelineFieldsToReview(pipeline.fields || {}, pipeline.text, fileName);
            const extractedValue = reviewFields[fieldKey];

            if (extractedValue == null || extractedValue === '') {
                summary.skippedNoValueExtracted++;
                continue;
            }

            await createStagingRecord({
                organizationId: row.organization_id,
                companyId: row.company_id,
                docType,
                originalName: fileName,
                storagePath: filePath,
                mimeType: 'application/pdf',
                fileSize: pdfBuffer.length,
                fields: {
                    [fieldKey]: extractedValue,
                    person_name: reviewFields.person_name,
                    certificate_number: reviewFields.certificate_number,
                },
                fieldConfidence: { [fieldKey]: pipeline.fieldConfidence?.[fieldKey] || (pipeline.aiModel ? 'ai' : 'rule_based') },
                warnings: [`Rielaborazione automatica campo "${fieldKey}" su qualifica esistente #${row.id} — verificare valore prima di confermare.`],
                qualificationType: row.qualification_type,
                userId: null,
                aiModel: pipeline.aiModel || null,
                targetQualificationId: row.id,
                fieldScope: fieldKey,
            });

            summary.proposalsCreated++;
        } catch (err) {
            summary.errors++;
            summary.errorDetails.push(`id=${row.id} ${row.person_name || ''}: ${err.message}`);
            logger.error(`[QualifReprocess] Errore rielaborazione id=${row.id} campo=${fieldKey}: ${err.message}`);
        }
    }

    logger.info(`[QualifReprocess] Rielaborazione campo="${fieldKey}" candidati=${summary.candidatesFound} elaborati=${summary.candidatesProcessed} proposte=${summary.proposalsCreated} errori=${summary.errors}`);
    return summary;
}

module.exports = {
    selectReprocessCandidates,
    countReprocessCandidates,
    runReprocessForField,
    guessDocType,
    resolveCertificateFilePath,
    hasPendingProposal,
    DEFAULT_RUN_LIMIT,
};

/**
 * qualificationReprocess.service.js — logica condivisa di "rielaborazione"
 * (backfill) di campi AI-estraibili su record già presenti in DB.
 *
 * Estratta da backend/scripts/reprocess-qualifications.js (28/07/2026, primo
 * campo: transfer_mode) per essere richiamabile sia dallo script CLI sia
 * dall'endpoint superadmin (`reprocessTasks.controller.js`) — UNA sola
 * implementazione, mai duplicata. Il registro dei campi rielaborabili vive in
 * `../data/reprocessableFields.js`.
 *
 * Generalizzata 08/08/2026 (prima copriva solo `qualifications`) per
 * supportare anche `wpqr_records` — le specificità per tabella (colonne da
 * selezionare, come determinare il docType, quale mapper AI→reviewFields
 * usare) vivono in `../data/reprocessTableAdapters.js`. Il nome del file
 * resta invariato per non rompere gli import esistenti (script CLI,
 * controller, test), anche se il contenuto non è più specifico alle
 * qualifiche.
 *
 * Integrità dati (non negoziabile): questo servizio NON scrive mai
 * direttamente sul record definitivo. Crea solo proposte in
 * ingest_staging (migrazioni 137/143) — un utente autorizzato deve
 * confermarle in revisione (stessa coda di IngestReviewDialog /
 * ReprocessQueueBanner) prima che il valore venga scritto sul record
 * definitivo.
 */
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const { query } = require('../config/database');
const { runDocumentIngest } = require('./documentIngestPipeline.service');
const { REPROCESSABLE_FIELDS: QUALIFICATION_WRITE_FIELDS } = require('./qualificationIngest.service');
const { WPQR_REPROCESSABLE_FIELDS } = require('./wpqrIngest.service');
const { createStagingRecord } = require('./ingestStaging.service');
const { getReprocessableField } = require('../data/reprocessableFields');
const { getTableAdapter } = require('../data/reprocessTableAdapters');

/** Whitelist di scrittura finale, una per tabella — mai un'unica lista condivisa (vedi header). */
const WRITE_WHITELISTS = {
    qualifications: QUALIFICATION_WRITE_FIELDS,
    wpqr_records: WPQR_REPROCESSABLE_FIELDS,
};

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

/** Solo per la tabella `qualifications` — vedi reprocessTableAdapters.js per il resolveDocType generico. */
function guessDocType(qualificationType) {
    return /14732/.test(qualificationType || '') ? 'qualifica_14732' : 'patentino_saldatore';
}

/**
 * Risolve il valore estratto dalla review AI verso la chiave colonna DB.
 * Comportamento per `qualifications` invariato (retrocompatibile con i test
 * esistenti, usa `fieldKey` direttamente). Per `wpqr_records` usa sempre
 * `config.column` (può differere dalla chiave di registro, es.
 * `wpqr_thickness_max_unlimited` → colonna `thickness_max_unlimited`) e
 * gestisce i flag booleani NOT NULL con default (propone solo `true`: un
 * "false" riproposto sarebbe rumore, è già il valore di default).
 */
function resolveExtractedReprocessValue(fieldKey, reviewFields = {}, config = {}) {
    if (config.table === 'wpqr_records') {
        const column = config.column || fieldKey;
        // Bundle t1/t2: restituisce un oggetto colonna→valore (almeno un lato
        // popolato). I flag unlimited solo se true (come thickness_max_unlimited).
        if (Array.isArray(config.bundleColumns) && config.bundleColumns.length) {
            const out = {};
            for (const col of config.bundleColumns) {
                const name = typeof col === 'string' ? col : col;
                if (/_max_unlimited$/.test(name)) {
                    if (reviewFields[name] === true) out[name] = true;
                    continue;
                }
                const v = reviewFields[name];
                if (v == null || v === '') continue;
                out[name] = v;
            }
            const hasSide = ['thickness_t1_min', 'thickness_t2_min'].some((k) => out[k] != null);
            return hasSide ? out : null;
        }
        if (column === 'thickness_max_unlimited' || column === 'rotated_position') {
            return reviewFields[column] === true ? true : null;
        }
        const v = reviewFields[column];
        return v == null || v === '' ? null : v;
    }

    // --- Comportamento storico per `qualifications` (invariato) ---
    if (fieldKey === 'filler_material') {
        return reviewFields.filler_material || reviewFields.filler_material_group || null;
    }
    if (fieldKey === 'pipe_diameter_min_mm') {
        const v = reviewFields.pipe_diameter_min_mm ?? reviewFields.pipe_diameter_mm;
        return v == null || v === '' ? null : v;
    }
    if (fieldKey === 'thickness_max_unlimited') {
        // Colonna NOT NULL con default false — riproporre "false" non avrebbe
        // senso (è già il valore attuale): una proposta ha valore solo quando
        // la rilettura del PDF conferma esplicitamente il range aperto.
        return reviewFields.thickness_max_unlimited === true ? true : null;
    }
    const v = reviewFields[fieldKey];
    return v == null || v === '' ? null : v;
}

async function selectReprocessCandidates(field, config, { orgId = null } = {}) {
    const table = config.table || 'qualifications';
    const writeWhitelist = WRITE_WHITELISTS[table];
    if (!writeWhitelist || !writeWhitelist[field]) {
        throw new Error(`Campo non rielaborabile: ${field} (aggiungilo alla whitelist di scrittura di "${table}")`);
    }
    const adapter = getTableAdapter(table);
    const column = config.column || field;

    const conditions = [
        config.candidateWhere || `${column} IS NULL`,
        'certificate_file_url IS NOT NULL',
    ];
    if (adapter.excludeCondition) conditions.push(adapter.excludeCondition);

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
        SELECT ${adapter.candidateSelectColumns}
        FROM ${table}
        WHERE ${conditions.join(' AND ')}
        ORDER BY id
    `, params);

    let rows = result.recordset || [];
    if (Array.isArray(config.processWhitelist) && config.processWhitelist.length) {
        rows = rows.filter((r) => {
            const proc = String(r.welding_process || '');
            return config.processWhitelist.some((code) => proc.includes(code));
        });
    }
    if (Array.isArray(config.productTypeWhitelist) && config.productTypeWhitelist.length) {
        const allowed = new Set(config.productTypeWhitelist.map((p) => String(p).toUpperCase()));
        rows = rows.filter((r) => allowed.has(String(r.product_type || '').toUpperCase()));
    }
    if (Array.isArray(config.jointTypeWhitelist) && config.jointTypeWhitelist.length) {
        rows = rows.filter((r) => {
            const jt = String(r.joint_type || '').toUpperCase();
            return config.jointTypeWhitelist.some((code) => jt.includes(String(code).toUpperCase()));
        });
    }
    return excludeRecordsWithPendingProposal(rows, field, adapter.targetIdColumn);
}

async function hasPendingProposal(recordId, field, targetIdColumn) {
    const r = await query(`
        SELECT TOP 1 id FROM ingest_staging
        WHERE ${targetIdColumn} = @recordId
          AND field_scope = @field
          AND review_status = 'pending'
    `, { recordId, field });
    return r.recordset.length > 0;
}

/**
 * Esclude i record che hanno già una proposta pending in ingest_staging per
 * questo field_scope. Senza questo filtro il conteggio candidati in Fatturazione
 * restava uguale dopo «Lancia» (il campo in DB è ancora NULL finché non
 * confermi in Qualifiche/Saldatura) e il pulsante restava attivo.
 */
async function excludeRecordsWithPendingProposal(rows, fieldKey, targetIdColumn) {
    if (!rows.length) return rows;
    const params = { field: fieldKey };
    const placeholders = [];
    rows.forEach((row, i) => {
        const name = `id${i}`;
        params[name] = row.id;
        placeholders.push(`@${name}`);
    });
    const r = await query(`
        SELECT ${targetIdColumn} AS record_id
        FROM ingest_staging
        WHERE ${targetIdColumn} IN (${placeholders.join(',')})
          AND field_scope = @field
          AND review_status = 'pending'
    `, params);
    const pendingIds = new Set((r.recordset || []).map((row) => row.record_id));
    return rows.filter((row) => !pendingIds.has(row.id));
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
    const table = fieldDef.table || 'qualifications';
    const adapter = getTableAdapter(table);

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

            if (await hasPendingProposal(row.id, fieldKey, adapter.targetIdColumn)) {
                summary.skippedAlreadyProposed++;
                continue;
            }

            if (dryRun) continue;

            const docType = adapter.resolveDocType(row);
            const fileName = path.basename(filePath);
            const pdfBuffer = fs.readFileSync(filePath);

            const pipeline = await runDocumentIngest({
                pdfBuffer,
                docType,
                fileName,
                organizationId: row.organization_id,
            });
            const reviewFields = adapter.mapPipelineFieldsToReview(pipeline.fields || {}, pipeline.text, fileName);
            const extractedValue = resolveExtractedReprocessValue(fieldKey, reviewFields, fieldDef);

            if (extractedValue == null || extractedValue === '') {
                summary.skippedNoValueExtracted++;
                continue;
            }

            const isBundle = extractedValue && typeof extractedValue === 'object' && !Array.isArray(extractedValue)
                && Array.isArray(fieldDef.bundleColumns) && fieldDef.bundleColumns.length;
            const bundleSummary = isBundle
                ? Object.entries(extractedValue).map(([k, v]) => `${k}=${v}`).join('; ')
                : null;

            await createStagingRecord({
                organizationId: row.organization_id,
                companyId: row.company_id,
                docType,
                originalName: fileName,
                storagePath: filePath,
                mimeType: 'application/pdf',
                fileSize: pdfBuffer.length,
                fields: {
                    [fieldKey]: isBundle ? bundleSummary : extractedValue,
                    ...(isBundle ? extractedValue : {}),
                    ...adapter.buildStagingDisplayFields(reviewFields),
                },
                fieldConfidence: { [fieldKey]: pipeline.fieldConfidence?.[fieldKey] || (pipeline.aiModel ? 'ai' : 'rule_based') },
                warnings: [`Rielaborazione automatica campo "${fieldKey}" su record esistente #${row.id} — verificare valore prima di confermare.`],
                qualificationType: row.qualification_type || null,
                userId: null,
                aiModel: pipeline.aiModel || null,
                // Solo UNA delle due colonne target è valorizzata, secondo la tabella.
                targetQualificationId: table === 'qualifications' ? row.id : null,
                targetWpqrId: table === 'wpqr_records' ? row.id : null,
                fieldScope: fieldKey,
            });

            summary.proposalsCreated++;
        } catch (err) {
            summary.errors++;
            summary.errorDetails.push(`id=${row.id}: ${err.message}`);
            logger.error(`[Reprocess] Errore rielaborazione id=${row.id} campo=${fieldKey} tabella=${table}: ${err.message}`);
        }
    }

    logger.info(`[Reprocess] Rielaborazione campo="${fieldKey}" tabella="${table}" candidati=${summary.candidatesFound} elaborati=${summary.candidatesProcessed} proposte=${summary.proposalsCreated} errori=${summary.errors}`);
    return summary;
}

module.exports = {
    selectReprocessCandidates,
    countReprocessCandidates,
    runReprocessForField,
    resolveExtractedReprocessValue,
    guessDocType,
    resolveCertificateFilePath,
    hasPendingProposal,
    excludeRecordsWithPendingProposal,
    DEFAULT_RUN_LIMIT,
};

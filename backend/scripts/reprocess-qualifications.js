/**
 * reprocess-qualifications.js — backfill generico su qualifiche già presenti in DB.
 *
 * Motivazione (richiesta committente 28/07/2026): ogni volta che aggiungiamo un
 * nuovo campo all'estrazione AI (es. transfer_mode) i patentini già ingestiti
 * PRIMA di quella modifica restano con il campo NULL. Il PDF originale è però
 * conservato su disco (certificate_file_url, mai cancellato dopo il commit —
 * vedi ingestStaging.service.js) quindi si può rilanciare l'estrazione AI sullo
 * stesso file, SENZA richiedere all'utente di ricaricarlo.
 *
 * Integrità dati (non negoziabile): questo script NON scrive mai direttamente
 * sul record qualifications. Crea solo proposte in ingest_staging con
 * target_qualification_id + field_scope (migrazione 137) — un utente autorizzato
 * deve confermarle in revisione (stessa coda di IngestReviewDialog) prima che il
 * valore venga scritto sul record definitivo, esattamente come un'ingestione
 * nuova. Aggiorna solo se il campo è ancora NULL (mai sovrascrive correzioni
 * manuali) — vedi applyFieldReprocessUpdate in qualificationIngest.service.js.
 *
 * Generico e riusabile: per aggiungere un nuovo campo rielaborabile, basta
 * aggiungerlo a FIELD_CONFIGS (qui) e a REPROCESSABLE_FIELDS
 * (qualificationIngest.service.js) — nessuno script dedicato per campo.
 *
 * Uso (da backend/, con DB_* in env o .ssh-deploy.local.ps1 in locale, oppure
 * deployato in /var/www/sgq-backend/scripts/ ed eseguito lì per accedere ai
 * file caricati su quel filesystem):
 *   node scripts/reprocess-qualifications.js --field=transfer_mode --dry-run
 *   node scripts/reprocess-qualifications.js --field=transfer_mode
 *   node scripts/reprocess-qualifications.js --field=transfer_mode --org-id=1001 --limit=5
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const { query, getPool, closePool } = require('../src/config/database');
const { runDocumentIngest } = require('../src/services/documentIngestPipeline.service');
const { mapPipelineFieldsToReview, REPROCESSABLE_FIELDS } = require('../src/services/qualificationIngest.service');
const { createStagingRecord } = require('../src/services/ingestStaging.service');
const { CONTINUOUS_WIRE_ARC_PROCESSES } = require('../src/data/weldingQualificationRules9606');

/**
 * Configurazione per campo rielaborabile: quali qualifiche sono candidate.
 * `qualTypeLike`: filtro SQL su qualification_type (LIKE).
 * `processWhitelist`: se presente, il welding_process (ISO 4063) della
 * qualifica deve contenere uno dei codici elencati — altrimenti il campo non
 * è normativamente applicabile e non va rielaborato (evita proposte inutili).
 */
const FIELD_CONFIGS = {
    transfer_mode: { qualTypeLike: '%9606%', processWhitelist: CONTINUOUS_WIRE_ARC_PROCESSES },
    shielding_gas: { qualTypeLike: '%9606%', processWhitelist: null },
    joint_type: { qualTypeLike: '%9606%', processWhitelist: null },
    weld_details: { qualTypeLike: '%9606%', processWhitelist: null },
};

function parseArgs(argv) {
    const out = { field: null, dryRun: false, limit: null, orgId: null };
    for (const arg of argv) {
        if (arg === '--dry-run') out.dryRun = true;
        else if (arg.startsWith('--field=')) out.field = arg.slice('--field='.length).trim();
        else if (arg.startsWith('--limit=')) out.limit = parseInt(arg.slice('--limit='.length), 10);
        else if (arg.startsWith('--org-id=')) out.orgId = parseInt(arg.slice('--org-id='.length), 10);
    }
    return out;
}

function resolveUploadBase() {
    return process.env.UPLOAD_DIR
        ? path.resolve(process.env.UPLOAD_DIR)
        : path.resolve(__dirname, '../uploads');
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
 * Esportata per test unitari sulla logica di selezione (senza I/O reale).
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

async function main() {
    const { field, dryRun, limit, orgId } = parseArgs(process.argv.slice(2));
    if (!field) {
        console.error('Uso: node scripts/reprocess-qualifications.js --field=<nome_campo> [--dry-run] [--limit=N] [--org-id=N]');
        console.error(`Campi disponibili: ${Object.keys(FIELD_CONFIGS).join(', ')}`);
        process.exit(1);
    }
    const config = FIELD_CONFIGS[field];
    if (!config) {
        console.error(`Campo non configurato: ${field}. Disponibili: ${Object.keys(FIELD_CONFIGS).join(', ')}`);
        process.exit(1);
    }

    await getPool();
    console.log(`=== Rielaborazione campo "${field}"${dryRun ? ' (DRY-RUN, nessuna scrittura)' : ''} ===`);

    let candidates = await selectReprocessCandidates(field, config, { orgId });
    if (limit) candidates = candidates.slice(0, limit);
    console.log(`Candidati trovati (${field} NULL + pertinenti + con certificato): ${candidates.length}`);

    let skippedNoFile = 0;
    let skippedAlreadyProposed = 0;
    let skippedNoValueExtracted = 0;
    let proposalsCreated = 0;
    let errors = 0;

    for (const row of candidates) {
        try {
            const filePath = resolveCertificateFilePath(row.certificate_file_url);
            if (!fs.existsSync(filePath)) {
                console.log(`  [SKIP] id=${row.id} ${row.person_name}: file non trovato su disco (${filePath})`);
                skippedNoFile++;
                continue;
            }

            if (await hasPendingProposal(row.id, field)) {
                console.log(`  [SKIP] id=${row.id} ${row.person_name}: proposta già in coda di revisione`);
                skippedAlreadyProposed++;
                continue;
            }

            if (dryRun) {
                console.log(`  [DRY-RUN] id=${row.id} ${row.person_name} (proc=${row.welding_process}) -> rielaborazione simulata su ${path.basename(filePath)}`);
                continue;
            }

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
            const extractedValue = reviewFields[field];

            if (extractedValue == null || extractedValue === '') {
                console.log(`  [SKIP] id=${row.id} ${row.person_name}: nessun valore estratto per "${field}" (documento non lo riporta o AI non l'ha trovato)`);
                skippedNoValueExtracted++;
                continue;
            }

            const stagingId = await createStagingRecord({
                organizationId: row.organization_id,
                companyId: row.company_id,
                docType,
                originalName: fileName,
                storagePath: filePath,
                mimeType: 'application/pdf',
                fileSize: pdfBuffer.length,
                fields: {
                    [field]: extractedValue,
                    person_name: reviewFields.person_name,
                    certificate_number: reviewFields.certificate_number,
                },
                fieldConfidence: { [field]: pipeline.fieldConfidence?.[field] || (pipeline.aiModel ? 'ai' : 'rule_based') },
                warnings: [`Rielaborazione automatica campo "${field}" su qualifica esistente #${row.id} — verificare valore prima di confermare.`],
                qualificationType: row.qualification_type,
                userId: null,
                aiModel: pipeline.aiModel || null,
                targetQualificationId: row.id,
                fieldScope: field,
            });

            console.log(`  [OK] id=${row.id} ${row.person_name}: proposta staging #${stagingId} -> ${field}="${extractedValue}"`);
            proposalsCreated++;
        } catch (err) {
            console.error(`  [ERRORE] id=${row.id} ${row.person_name}: ${err.message}`);
            errors++;
        }
    }

    console.log('\n--- Riepilogo ---');
    console.log(`Candidati esaminati:        ${candidates.length}`);
    console.log(`Proposte create in coda:    ${proposalsCreated}`);
    console.log(`Già in coda (dedup):        ${skippedAlreadyProposed}`);
    console.log(`File non trovato su disco:  ${skippedNoFile}`);
    console.log(`Nessun valore estratto:     ${skippedNoValueExtracted}`);
    console.log(`Errori:                     ${errors}`);
    if (dryRun) console.log('\n(DRY-RUN: nessuna proposta scritta — rilanciare senza --dry-run per generarle davvero)');

    await closePool();
}

module.exports = { selectReprocessCandidates, guessDocType, resolveCertificateFilePath, FIELD_CONFIGS };

if (require.main === module) {
    main().catch(async (e) => {
        console.error('ERRORE FATALE:', e.message);
        try { await closePool(); } catch (_) {}
        process.exit(1);
    });
}

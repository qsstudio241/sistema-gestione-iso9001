'use strict';

/**
 * Ricalcolo dei frammenti in wpqr_records.certificate_number.
 *
 * Default: sola lettura (prima/dopo). --apply scrive solo se NODE_ENV=test
 * e DB_NAME() è il database di TEST. PROD resta in dry-run.
 * Gli id 38 e 39 non vengono mai aggiornati sul numero certificato
 * e non ricevono proposte in Rivedi.
 *
 * Ordine: pulizia del valore già salvato, poi regex sul testo del PDF
 * (niente chiamata AI), poi — solo se i due falliscono — proposta del
 * codice rapporto IIS marcata «da confermare». Un valore che contiene
 * una cifra non viene mai azzerato.
 *
 * --backfill-company (solo insieme a --apply su TEST) copia company_id dalla
 * WPS dove la WPQR ha company_id nullo e wps_id valorizzato. È l'unico punto
 * che legge ancora la colonna deprecata wpqr_records.wps_id: non la azzera.
 *
 *   node scripts/recalc-wpqr-certificate-fragments.js --target=test
 *   node scripts/recalc-wpqr-certificate-fragments.js --target=test --apply --backfill-company
 *   node scripts/recalc-wpqr-certificate-fragments.js --target=prod
 */

const path = require('path');
const {
    extractCertificateNumber,
    isFragmentCertificateNumber,
    isPlausibleCertificateNumber,
    salvageCertificateNumber,
    iisReportCertificateCandidate,
} = require('../src/utils/ruleFieldExtractors');

const REPORT_CODE_WARNING = 'Da confermare: il numero proposto è il codice del rapporto, non un valore letto dal certificato.';

const TEST_DB = '2026-06-18_SGQ_ISO9001';
const PROD_DB = 'SGQ_ISO9001';
const EXCLUDED_CERTIFICATE_IDS = [38, 39];

function planCertificateRecalc({
    id, before, extracted, hasFile, readError = false, wpqrCode = null, referenceNumber = null,
}) {
    const current = before == null || String(before).trim() === '' ? null : String(before);
    const salvaged = salvageCertificateNumber(current);
    const salvageWins = Boolean(salvaged) && salvaged !== current;
    const pdfNumber = (!readError && extracted && isPlausibleCertificateNumber(extracted) && !isFragmentCertificateNumber(extracted))
        ? extracted
        : null;
    // Il codice rapporto non sta nel PDF: un file illeggibile non blocca la proposta.
    const reportCode = iisReportCertificateCandidate(wpqrCode, referenceNumber);

    const row = (extra) => ({ id, before: current, wpqrCode: wpqrCode || null, ...extra });

    if (salvageWins) {
        const plan = row({
            proposed: salvaged, source: 'pulizia', reason: 'salvaged', action: 'update',
        });
        if (EXCLUDED_CERTIFICATE_IDS.includes(Number(id))) {
            return { ...plan, after: current, action: 'skip_excluded' };
        }
        return { ...plan, after: salvaged };
    }
    if (current && !isFragmentCertificateNumber(current)) {
        return row({
            proposed: current, after: current, action: 'unchanged', reason: 'not_fragment', source: '',
        });
    }
    if (pdfNumber) {
        const plan = row({
            proposed: pdfNumber, source: 'PDF', reason: 'extracted', action: 'update',
        });
        if (EXCLUDED_CERTIFICATE_IDS.includes(Number(id))) {
            return { ...plan, after: current, action: 'skip_excluded' };
        }
        return { ...plan, after: pdfNumber };
    }
    if (reportCode) {
        const plan = row({
            proposed: reportCode,
            source: 'codice rapporto da confermare',
            reason: 'report_code_confirm',
            action: 'propose_confirm',
        });
        if (EXCLUDED_CERTIFICATE_IDS.includes(Number(id))) {
            return { ...plan, after: current, action: 'skip_excluded' };
        }
        return { ...plan, after: current };
    }
    if (readError) {
        return row({
            proposed: null, after: current, action: 'unchanged', reason: 'read_error', source: '',
        });
    }
    if (current && /\d/.test(current)) {
        return row({
            proposed: current, after: current, action: 'unchanged', reason: 'kept_has_digit', source: '',
        });
    }
    if (!current) {
        return row({
            proposed: null, after: null, action: 'unchanged', reason: 'empty', source: 'vuoto',
        });
    }
    return row({
        proposed: null,
        after: null,
        action: 'clear',
        reason: hasFile ? 'cleared_no_number' : 'no_file',
        source: 'vuoto',
    });
}

function shouldReadCertificatePdf(before) {
    const current = before == null || String(before).trim() === '' ? null : String(before);
    const salvaged = salvageCertificateNumber(current);
    if (salvaged && salvaged !== current) return false;
    if (current && !isFragmentCertificateNumber(current)) return false;
    return true;
}

function buildReportCodeStaging(row, plan) {
    if (!plan || plan.action !== 'propose_confirm' || !plan.proposed) return null;
    if (EXCLUDED_CERTIFICATE_IDS.includes(Number(row.id))) return null;
    if (row.organization_id == null) return null;
    const code = String(row.wpqr_code || '').trim();
    return {
        organizationId: row.organization_id,
        companyId: row.company_id ?? null,
        docType: 'wpqr',
        originalName: (code || `wpqr-${row.id}`).slice(0, 255),
        storagePath: String(row.certificate_file_url || 'n/a').slice(0, 500),
        mimeType: row.certificate_file_url ? 'application/pdf' : null,
        fileSize: null,
        fields: {
            wpqr_certificate_number: plan.proposed,
            certificate_number: plan.proposed,
            wpqr_code: code || null,
        },
        fieldConfidence: { wpqr_certificate_number: 'rule_based' },
        warnings: [REPORT_CODE_WARNING],
        qualificationType: null,
        userId: null,
        aiModel: null,
        targetQualificationId: null,
        targetWpqrId: row.id,
        fieldScope: 'wpqr_certificate_number',
    };
}

function planCompanyBackfill({ id, companyId, wpsCompanyId }) {
    if (companyId != null && companyId !== '') {
        return { id, action: 'unchanged', company_id: companyId, reason: 'already_set' };
    }
    if (wpsCompanyId == null || wpsCompanyId === '') {
        return { id, action: 'unchanged', company_id: null, reason: 'no_wps_company' };
    }
    return { id, action: 'update', company_id: Number(wpsCompanyId), reason: 'from_wps' };
}

function assertApplyAllowed({ nodeEnv, dbName, apply }) {
    if (!apply) return;
    if (nodeEnv === 'test' && dbName === TEST_DB) return;
    const err = new Error('Scrittura rifiutata: --apply è consentito solo sul database di TEST');
    err.code = 'APPLY_REFUSED';
    throw err;
}

function parseArgs(argv) {
    const out = { apply: false, backfillCompany: false, target: null };
    for (const arg of argv) {
        if (arg === '--apply') out.apply = true;
        else if (arg === '--backfill-company') out.backfillCompany = true;
        else if (arg === '--target=test' || arg === '--target=prod') out.target = arg.slice('--target='.length);
    }
    return out;
}

function resolveRuntime(args, env = process.env) {
    const target = args.target
        || (env.NODE_ENV === 'production' ? 'prod' : (env.NODE_ENV === 'test' ? 'test' : null));
    if (target !== 'test' && target !== 'prod') {
        const err = new Error('Specificare --target=test oppure --target=prod');
        err.code = 'TARGET_REQUIRED';
        throw err;
    }
    if ((args.apply || args.backfillCompany) && target !== 'test') {
        const err = new Error('Scrittura rifiutata su PROD');
        err.code = 'APPLY_REFUSED';
        throw err;
    }
    const backendRoot = target === 'test' ? '/var/www/sgq-backend-test' : '/var/www/sgq-backend';
    return {
        target,
        nodeEnv: target === 'test' ? 'test' : 'production',
        expectedDb: target === 'test' ? TEST_DB : PROD_DB,
        backendRoot,
        envFile: target === 'test' ? path.join(backendRoot, '.env.test') : path.join(backendRoot, '.env'),
        apply: Boolean(args.apply),
        backfillCompany: Boolean(args.backfillCompany),
    };
}

function resolveUploadDir(uploadDirEnv, backendRoot) {
    if (!uploadDirEnv) return path.resolve(backendRoot, 'uploads');
    return path.isAbsolute(uploadDirEnv)
        ? uploadDirEnv
        : path.resolve(backendRoot, uploadDirEnv);
}

function certificateFilePath(url, uploadDir) {
    if (!url) return null;
    const rel = String(url).replace(/^\//, '').replace(/^uploads\//, '');
    return path.join(uploadDir, rel);
}

async function loadPdfText(filePath) {
    const fs = require('fs');
    const pdfParse = require('pdf-parse');
    const parsed = await pdfParse(fs.readFileSync(filePath));
    return parsed && parsed.text ? String(parsed.text) : '';
}

async function main() {
    let cfg;
    try {
        cfg = resolveRuntime(parseArgs(process.argv.slice(2)));
    } catch (err) {
        console.error(err.message);
        process.exit(1);
    }
    process.env.NODE_ENV = cfg.nodeEnv;
    require('dotenv').config({ path: cfg.envFile });
    const { getPool, closePool, query } = require('../src/config/database');
    const fs = require('fs');

    let pool;
    try {
        pool = await getPool();
        const dbRow = await pool.request().query('SELECT DB_NAME() AS db_name');
        const dbName = String((dbRow.recordset[0] && dbRow.recordset[0].db_name) || '').trim();
        if (dbName !== cfg.expectedDb) {
            throw new Error(`database "${dbName}" diverso da ${cfg.expectedDb} — abort`);
        }
        assertApplyAllowed({ nodeEnv: process.env.NODE_ENV, dbName, apply: cfg.apply || cfg.backfillCompany });
        console.log(`target=${cfg.target} database=${dbName} apply=${cfg.apply ? 'yes' : 'no'}`);

        const listed = await query(`
            SELECT id, organization_id, wpqr_code, reference_number, certificate_number,
                   certificate_file_url, company_id, wps_id
            FROM wpqr_records
            WHERE deleted_at IS NULL
            ORDER BY id
        `);
        const rows = listed.recordset || [];
        const nullCompanyWithWps = rows.filter((row) => (
            (row.company_id == null || row.company_id === '') && row.wps_id != null
        )).length;
        console.log(`wpqr_vive=${rows.length} company_null_con_wps_id=${nullCompanyWithWps}`);

        const uploadDir = resolveUploadDir(process.env.UPLOAD_DIR, cfg.backendRoot);

        const plans = [];
        for (const row of rows) {
            const before = row.certificate_number;
            let extracted = null;
            let hasFile = false;
            let readError = false;
            if (shouldReadCertificatePdf(before)) {
                const filePath = certificateFilePath(row.certificate_file_url, uploadDir);
                hasFile = Boolean(filePath && fs.existsSync(filePath));
                if (hasFile) {
                    try {
                        extracted = extractCertificateNumber(await loadPdfText(filePath));
                    } catch (err) {
                        readError = true;
                    }
                }
            }
            plans.push({
                row,
                plan: planCertificateRecalc({
                    id: row.id,
                    before,
                    extracted,
                    hasFile,
                    readError,
                    wpqrCode: row.wpqr_code,
                    referenceNumber: row.reference_number,
                }),
            });
        }

        console.log('id\tcodice\tattuale\tproposto\tfonte');
        for (const { plan } of plans) {
            console.log([
                plan.id,
                JSON.stringify(plan.wpqrCode),
                JSON.stringify(plan.before),
                JSON.stringify(plan.proposed),
                plan.source || '',
            ].join('\t'));
        }

        if (cfg.apply) {
            const check = await pool.request().query('SELECT DB_NAME() AS db_name');
            const again = String((check.recordset[0] && check.recordset[0].db_name) || '').trim();
            assertApplyAllowed({ nodeEnv: process.env.NODE_ENV, dbName: again, apply: true });
            let written = 0;
            for (const { plan } of plans) {
                if (plan.action !== 'update' && plan.action !== 'clear') continue;
                if (plan.action === 'clear' && plan.before && /\d/.test(String(plan.before))) continue;
                const result = await query(`
                    UPDATE wpqr_records
                    SET certificate_number = @next, updated_at = GETDATE()
                    WHERE id = @id
                      AND deleted_at IS NULL
                      AND id NOT IN (38, 39)
                      AND (
                        (@before IS NOT NULL AND certificate_number = @before)
                        OR (@before IS NULL AND (certificate_number IS NULL OR LTRIM(RTRIM(certificate_number)) = N''))
                      )
                `, { id: plan.id, next: plan.after, before: plan.before });
                written += result.rowsAffected ? result.rowsAffected[0] || 0 : 0;
            }
            console.log(`certificate_rows_written=${written}`);

            const { createStagingRecord } = require('../src/services/ingestStaging.service');
            let staged = 0;
            for (const { row, plan } of plans) {
                const params = buildReportCodeStaging(row, plan);
                if (!params) continue;
                const pending = await query(`
                    SELECT TOP 1 id
                    FROM ingest_staging
                    WHERE organization_id = @organizationId
                      AND target_wpqr_id = @id
                      AND field_scope = N'wpqr_certificate_number'
                      AND review_status = N'pending'
                `, { organizationId: row.organization_id, id: row.id });
                if (pending.recordset && pending.recordset.length) continue;
                await createStagingRecord(params);
                staged += 1;
            }
            console.log(`report_code_staging=${staged}`);
        }

        if (cfg.backfillCompany) {
            const candidates = await query(`
                SELECT wq.id, w.company_id AS wps_company_id
                FROM wpqr_records wq
                INNER JOIN welding_procedures w
                  ON w.id = wq.wps_id AND w.organization_id = wq.organization_id
                WHERE wq.deleted_at IS NULL
                  AND wq.company_id IS NULL
                  AND wq.wps_id IS NOT NULL
                  AND w.company_id IS NOT NULL
            `);
            const companyPlans = (candidates.recordset || []).map((row) => planCompanyBackfill({
                id: row.id, companyId: null, wpsCompanyId: row.wps_company_id,
            }));
            console.log(`company_backfill_candidates=${companyPlans.filter((p) => p.action === 'update').length}`);
            if (cfg.apply) {
                const check = await pool.request().query('SELECT DB_NAME() AS db_name');
                const again = String((check.recordset[0] && check.recordset[0].db_name) || '').trim();
                assertApplyAllowed({ nodeEnv: process.env.NODE_ENV, dbName: again, apply: true });
                let written = 0;
                for (const plan of companyPlans) {
                    if (plan.action !== 'update') continue;
                    const result = await query(`
                        UPDATE wpqr_records
                        SET company_id = @company_id, updated_at = GETDATE()
                        WHERE id = @id
                          AND deleted_at IS NULL
                          AND company_id IS NULL
                          AND wps_id IS NOT NULL
                    `, { id: plan.id, company_id: plan.company_id });
                    written += result.rowsAffected ? result.rowsAffected[0] || 0 : 0;
                }
                console.log(`company_rows_written=${written}`);
            }
        }
    } finally {
        try { await closePool(); } catch (_) { /* pool già chiuso */ }
    }
}

module.exports = {
    planCertificateRecalc,
    buildReportCodeStaging,
    shouldReadCertificatePdf,
    planCompanyBackfill,
    assertApplyAllowed,
    parseArgs,
    resolveRuntime,
    resolveUploadDir,
    EXCLUDED_CERTIFICATE_IDS,
    TEST_DB,
    PROD_DB,
    REPORT_CODE_WARNING,
};

if (require.main === module) {
    main().catch((err) => {
        console.error(err.message);
        process.exit(1);
    });
}

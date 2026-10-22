'use strict';

/**
 * Ricalcolo dei frammenti in wpqr_records.certificate_number.
 *
 * Default: sola lettura (prima/dopo). --apply scrive solo se NODE_ENV=test
 * e DB_NAME() è il database di TEST. PROD resta in dry-run.
 * Gli id 38 e 39 non vengono mai aggiornati sul numero certificato.
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
    CERTIFICATE_FRAGMENT_SQL,
} = require('../src/utils/ruleFieldExtractors');

const TEST_DB = '2026-06-18_SGQ_ISO9001';
const PROD_DB = 'SGQ_ISO9001';
const EXCLUDED_CERTIFICATE_IDS = [38, 39];

function planCertificateRecalc({ id, before, extracted, hasFile, readError = false }) {
    const current = before == null ? null : before;
    if (!isFragmentCertificateNumber(current)) {
        return {
            id, before: current, proposed: current, after: current,
            action: 'unchanged', reason: 'not_fragment',
        };
    }
    if (readError) {
        return {
            id, before: current, proposed: null, after: current,
            action: 'unchanged', reason: 'read_error',
        };
    }
    let proposed = null;
    let reason = 'cleared_no_number';
    if (!hasFile) {
        reason = 'no_file';
    } else if (extracted && !isFragmentCertificateNumber(extracted)) {
        proposed = extracted;
        reason = 'extracted';
    }
    if (EXCLUDED_CERTIFICATE_IDS.includes(Number(id))) {
        return { id, before: current, proposed, after: current, action: 'skip_excluded', reason };
    }
    if (reason === 'extracted') {
        return { id, before: current, proposed, after: proposed, action: 'update', reason };
    }
    return { id, before: current, proposed: null, after: null, action: 'clear', reason };
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
            SELECT id, wpqr_code, certificate_number, certificate_file_url, company_id, wps_id
            FROM wpqr_records
            WHERE deleted_at IS NULL
            ORDER BY id
        `);
        const rows = listed.recordset || [];
        const nullCompanyWithWps = rows.filter((row) => (
            (row.company_id == null || row.company_id === '') && row.wps_id != null
        )).length;
        console.log(`wpqr_vive=${rows.length} company_null_con_wps_id=${nullCompanyWithWps}`);

        const uploadDir = process.env.UPLOAD_DIR
            ? path.resolve(process.env.UPLOAD_DIR)
            : path.resolve(cfg.backendRoot, 'uploads');

        const plans = [];
        for (const row of rows) {
            const before = row.certificate_number;
            if (!isFragmentCertificateNumber(before)) {
                plans.push(planCertificateRecalc({ id: row.id, before, extracted: null, hasFile: false }));
                continue;
            }
            const filePath = certificateFilePath(row.certificate_file_url, uploadDir);
            const hasFile = Boolean(filePath && fs.existsSync(filePath));
            let extracted = null;
            let readError = false;
            if (hasFile) {
                try {
                    extracted = extractCertificateNumber(await loadPdfText(filePath));
                } catch (err) {
                    readError = true;
                }
            }
            plans.push(planCertificateRecalc({
                id: row.id, before, extracted, hasFile, readError,
            }));
        }

        console.log('id\tbefore\tafter\taction\treason');
        for (const plan of plans) {
            console.log([
                plan.id,
                JSON.stringify(plan.before),
                JSON.stringify(plan.after),
                plan.action,
                plan.reason,
            ].join('\t'));
        }

        if (cfg.apply) {
            const check = await pool.request().query('SELECT DB_NAME() AS db_name');
            const again = String((check.recordset[0] && check.recordset[0].db_name) || '').trim();
            assertApplyAllowed({ nodeEnv: process.env.NODE_ENV, dbName: again, apply: true });
            let written = 0;
            for (const plan of plans) {
                if (plan.action !== 'update' && plan.action !== 'clear') continue;
                const result = await query(`
                    UPDATE wpqr_records
                    SET certificate_number = @next, updated_at = GETDATE()
                    WHERE id = @id
                      AND deleted_at IS NULL
                      AND id NOT IN (38, 39)
                      AND ${CERTIFICATE_FRAGMENT_SQL}
                `, { id: plan.id, next: plan.after });
                written += result.rowsAffected ? result.rowsAffected[0] || 0 : 0;
            }
            console.log(`certificate_rows_written=${written}`);
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
    planCompanyBackfill,
    assertApplyAllowed,
    parseArgs,
    resolveRuntime,
    EXCLUDED_CERTIFICATE_IDS,
    TEST_DB,
    PROD_DB,
    CERTIFICATE_FRAGMENT_SQL,
};

if (require.main === module) {
    main().catch((err) => {
        console.error(err.message);
        process.exit(1);
    });
}

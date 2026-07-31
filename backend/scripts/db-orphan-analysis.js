/**
 * db-orphan-analysis.js
 * Analisi orfani e anomalie nel database SGQ_ISO9001.
 *
 * Eseguire sul VPS (Cloud Agent):
 *   scp -i /tmp/sgq_key -P 1122 ... spascarella@busato.selfip.com:/tmp/
 *   ssh -i /tmp/sgq_key -p 1122 ... spascarella@busato.selfip.com "node /tmp/db-orphan-analysis.js"
 *
 * Eseguire in locale:
 *   cd backend && node scripts/db-orphan-analysis.js
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ─── Config DB ────────────────────────────────────────────────────────────────
// Usa percorsi assoluti VPS se esiste il backend, altrimenti usa database.json locale
let mssql;
let DB_CONFIG;

const VPS_BACKEND = '/var/www/sgq-backend';
const VPS_ENV     = `${VPS_BACKEND}/.env`;
const VPS_MSSQL   = `${VPS_BACKEND}/node_modules/mssql`;
const VPS_DOTENV  = `${VPS_BACKEND}/node_modules/dotenv`;

if (fs.existsSync(VPS_ENV)) {
    require(VPS_DOTENV).config({ path: VPS_ENV });
    mssql = require(VPS_MSSQL);
    DB_CONFIG = {
        server: '127.0.0.1', port: 11043, database: 'SGQ_ISO9001',
        user: 'pascarella', password: '#Gestione2025@',
        options: { encrypt: false, trustServerCertificate: true, enableArithAbort: true,
                   connectTimeout: 30000, requestTimeout: 120000 },
    };
} else {
    // Esecuzione locale: usa database.json
    const localDotenv = path.join(__dirname, '../../node_modules/dotenv');
    if (fs.existsSync(localDotenv)) require(localDotenv).config();
    else require('dotenv').config();
    mssql = require('mssql');
    const dbJson = path.join(__dirname, '../config/database.json');
    const c = JSON.parse(fs.readFileSync(dbJson, 'utf8')).development || {};
    DB_CONFIG = {
        server: c.server, port: c.port || 1433, database: c.database,
        user: c.user, password: c.password,
        options: { encrypt: false, trustServerCertificate: true, enableArithAbort: true,
                   connectTimeout: 30000, requestTimeout: 120000 },
    };
}

// storage_path nel DB è relativo alla root del backend (es. "uploads/2026/03/file.jpg")
// quindi la base da usare è la root del backend, non la sottocartella uploads
const BACKEND_ROOT = fs.existsSync(VPS_ENV) ? VPS_BACKEND : path.join(__dirname, '..');
const UPLOAD_DIR   = BACKEND_ROOT; // path.join(BACKEND_ROOT, storage_path) = percorso completo

// ─── Utilities ────────────────────────────────────────────────────────────────
function section(title) {
    const line = '═'.repeat(70);
    console.log(`\n${line}`);
    console.log(`  ${title}`);
    console.log(line);
}

function check(label, count, details = []) {
    const icon = count === 0 ? '✅' : '⚠️ ';
    console.log(`  ${icon}  ${label}: ${count}`);
    if (count > 0 && details.length > 0) {
        for (const d of details.slice(0, 10)) {
            console.log(`       ↳ ${JSON.stringify(d)}`);
        }
        if (details.length > 10) {
            console.log(`       ↳ … e altri ${details.length - 10} record`);
        }
    }
}

async function q(pool, sql, params = {}) {
    const req = pool.request();
    for (const [k, v] of Object.entries(params)) req.input(k, v);
    return (await req.query(sql)).recordset;
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
    console.log(`\n${'─'.repeat(70)}`);
    console.log(`  ANALISI ORFANI / ANOMALIE — SGQ_ISO9001`);
    console.log(`  Data: ${new Date().toISOString()}`);
    console.log(`${'─'.repeat(70)}`);

    const pool = await mssql.connect(DB_CONFIG);
    const report = { total: 0, issues: [] };

    function addIssue(cat, label, rows) {
        if (rows.length > 0) {
            report.total += rows.length;
            report.issues.push({ cat, label, count: rows.length, sample: rows.slice(0, 5) });
        }
        check(label, rows.length, rows);
    }

    // ══════════════════════════════════════════════════════════════════════════
    section('CAT-1 — AUDIT CORE');
    // ══════════════════════════════════════════════════════════════════════════

    // 1a. audit_events con audit_id orfano (FK NO_ACTION)
    addIssue('CAT-1', 'audit_events con audit_id inesistente',
        await q(pool, `
            SELECT TOP 20 ae.event_id, ae.audit_id, ae.event_type, ae.server_ts
            FROM audit_events ae
            WHERE NOT EXISTS (SELECT 1 FROM audits a WHERE a.audit_id = ae.audit_id)
        `));

    // 1b. audit_events con user_id orfano
    addIssue('CAT-1', 'audit_events con user_id inesistente',
        await q(pool, `
            SELECT TOP 20 ae.event_id, ae.user_id, ae.event_type
            FROM audit_events ae
            WHERE ae.user_id IS NOT NULL
              AND NOT EXISTS (SELECT 1 FROM users u WHERE u.user_id = ae.user_id)
        `));

    // 1c. audit_locks con audit_id orfano (CASCADE ma verifichiamo)
    addIssue('CAT-1', 'audit_locks con audit_id inesistente (attesi 0)',
        await q(pool, `
            SELECT al.lock_id, al.audit_id
            FROM audit_locks al
            WHERE NOT EXISTS (SELECT 1 FROM audits a WHERE a.audit_id = al.audit_id)
        `));

    // 1d. audits con organization_id orfano
    addIssue('CAT-1', 'audits con organization_id inesistente',
        await q(pool, `
            SELECT a.audit_id, a.audit_number, a.organization_id
            FROM audits a
            WHERE NOT EXISTS (SELECT 1 FROM organizations o WHERE o.organization_id = a.organization_id)
        `));

    // 1e. audits con company_id orfano
    addIssue('CAT-1', 'audits con company_id inesistente',
        await q(pool, `
            SELECT a.audit_id, a.audit_number, a.company_id
            FROM audits a
            WHERE a.company_id IS NOT NULL
              AND NOT EXISTS (SELECT 1 FROM companies c WHERE c.id = a.company_id)
        `));

    // 1f. audits con custom_checklist_id orfano
    addIssue('CAT-1', 'audits con custom_checklist_id inesistente',
        await q(pool, `
            SELECT a.audit_id, a.audit_number, a.custom_checklist_id
            FROM audits a
            WHERE a.custom_checklist_id IS NOT NULL
              AND NOT EXISTS (SELECT 1 FROM custom_checklists cc WHERE cc.id = a.custom_checklist_id)
        `));

    // 1g. audit_responses con question_id orfano (CASCADE — attesi 0)
    addIssue('CAT-1', 'audit_responses con question_id inesistente (attesi 0)',
        await q(pool, `
            SELECT TOP 20 ar.response_id, ar.audit_id, ar.question_id
            FROM audit_responses ar
            WHERE NOT EXISTS (SELECT 1 FROM checklist_questions cq WHERE cq.question_id = ar.question_id)
        `));

    // 1h. audit_standards con standard_id orfano
    addIssue('CAT-1', 'audit_standards con standard_id inesistente',
        await q(pool, `
            SELECT aus.audit_id, aus.standard_id
            FROM audit_standards aus
            WHERE NOT EXISTS (SELECT 1 FROM standards s WHERE s.standard_id = aus.standard_id)
        `));

    // ══════════════════════════════════════════════════════════════════════════
    section('CAT-2 — ALLEGATI (attachments)');
    // ══════════════════════════════════════════════════════════════════════════

    // 2a. Allegati completamente "nudi" (tutti i parent NULL — violazione vincolo logico)
    addIssue('CAT-2', 'attachments senza nessun parent (tutti NULL)',
        await q(pool, `
            SELECT attachment_id, file_name, created_at
            FROM attachments
            WHERE audit_id IS NULL
              AND nc_id IS NULL
              AND document_id IS NULL
              AND custom_item_id IS NULL
              AND commercial_case_id IS NULL
              AND ndt_report_item_id IS NULL
        `));

    // 2b. attachments con nc_id inesistente (NO_ACTION)
    addIssue('CAT-2', 'attachments con nc_id inesistente',
        await q(pool, `
            SELECT TOP 20 att.attachment_id, att.nc_id, att.file_name
            FROM attachments att
            WHERE att.nc_id IS NOT NULL
              AND NOT EXISTS (SELECT 1 FROM non_conformities nc WHERE nc.nc_id = att.nc_id)
        `));

    // 2c. attachments con document_id inesistente (NO_ACTION)
    addIssue('CAT-2', 'attachments con document_id inesistente',
        await q(pool, `
            SELECT TOP 20 att.attachment_id, att.document_id, att.file_name
            FROM attachments att
            WHERE att.document_id IS NOT NULL
              AND NOT EXISTS (SELECT 1 FROM document_registry dr WHERE dr.id = att.document_id)
        `));

    // 2d. attachments con custom_item_id inesistente
    addIssue('CAT-2', 'attachments con custom_item_id inesistente',
        await q(pool, `
            SELECT TOP 20 att.attachment_id, att.custom_item_id, att.file_name
            FROM attachments att
            WHERE att.custom_item_id IS NOT NULL
              AND NOT EXISTS (SELECT 1 FROM custom_checklist_items cci WHERE cci.id = att.custom_item_id)
        `));

    // 2e. attachments con commercial_case_id inesistente
    addIssue('CAT-2', 'attachments con commercial_case_id inesistente',
        await q(pool, `
            SELECT TOP 20 att.attachment_id, att.commercial_case_id, att.file_name
            FROM attachments att
            WHERE att.commercial_case_id IS NOT NULL
              AND NOT EXISTS (SELECT 1 FROM commercial_cases cc WHERE cc.id = att.commercial_case_id)
        `));

    // 2f. attachments con ndt_report_item_id inesistente
    addIssue('CAT-2', 'attachments con ndt_report_item_id inesistente',
        await q(pool, `
            SELECT TOP 20 att.attachment_id, att.ndt_report_item_id, att.file_name
            FROM attachments att
            WHERE att.ndt_report_item_id IS NOT NULL
              AND NOT EXISTS (SELECT 1 FROM ndt_report_items nri WHERE nri.id = att.ndt_report_item_id)
        `));

    // 2g. attachments con uploaded_by inesistente
    addIssue('CAT-2', 'attachments con uploaded_by inesistente',
        await q(pool, `
            SELECT TOP 20 att.attachment_id, att.uploaded_by, att.file_name
            FROM attachments att
            WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.user_id = att.uploaded_by)
        `));

    // 2h. File fisici senza record DB / Record DB senza file fisico
    const dbPaths = await q(pool, `SELECT attachment_id, storage_path, file_name FROM attachments`);
    const missingFiles = [];
    for (const r of dbPaths) {
        const fullPath = path.join(UPLOAD_DIR, r.storage_path);
        if (!fs.existsSync(fullPath)) {
            missingFiles.push({ attachment_id: r.attachment_id, file_name: r.file_name, storage_path: r.storage_path });
        }
    }
    addIssue('CAT-2', 'attachments (DB) con file fisico MANCANTE su disco',  missingFiles);

    // File fisici orfani (senza record DB) — scansione solo della sottodirectory uploads/YYYY
    function listFilesRecursive(dir) {
        let files = [];
        if (!fs.existsSync(dir)) return files;
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                files = files.concat(listFilesRecursive(full));
            } else {
                files.push(full);
            }
        }
        return files;
    }

    // La scansione fisica parte solo dalle directory annuali (uploads/YYYY/) che contengono
    // gli allegati standard. Le sottodirectory specializzate (docs/, imports/, norms/, logos/ ecc.)
    // usano tabelle separate e NON mappano su `attachments`.
    const BASE_UPLOADS = path.join(UPLOAD_DIR, 'uploads');
    const dbPathSet = new Set(dbPaths.map(r => path.join(UPLOAD_DIR, r.storage_path)));
    let physicalFiles = [];
    if (fs.existsSync(BASE_UPLOADS)) {
        for (const entry of fs.readdirSync(BASE_UPLOADS, { withFileTypes: true })) {
            if (entry.isDirectory() && /^\d{4}$/.test(entry.name)) {
                // Solo directory con nome numerico a 4 cifre (anno)
                physicalFiles = physicalFiles.concat(listFilesRecursive(path.join(BASE_UPLOADS, entry.name)));
            }
        }
    }
    const orphanFiles = physicalFiles.filter(f => !dbPathSet.has(f));
    addIssue('CAT-2', 'file fisici su disco senza record in attachments (uploads/YYYY/)', orphanFiles.map(f => ({ path: f.replace(UPLOAD_DIR + '/', '') })));

    // ══════════════════════════════════════════════════════════════════════════
    section('CAT-3 — NON CONFORMITÀ');
    // ══════════════════════════════════════════════════════════════════════════

    // 3a. NC con audit_id inesistente (NO_ACTION)
    addIssue('CAT-3', 'non_conformities con audit_id inesistente',
        await q(pool, `
            SELECT nc.nc_id, nc.audit_id, nc.nc_number, nc.status
            FROM non_conformities nc
            WHERE nc.audit_id IS NOT NULL
              AND NOT EXISTS (SELECT 1 FROM audits a WHERE a.audit_id = nc.audit_id)
        `));

    // 3b. NC con organization_id inesistente
    addIssue('CAT-3', 'non_conformities con organization_id inesistente',
        await q(pool, `
            SELECT nc.nc_id, nc.nc_number, nc.organization_id
            FROM non_conformities nc
            WHERE NOT EXISTS (SELECT 1 FROM organizations o WHERE o.organization_id = nc.organization_id)
        `));

    // 3c. NC con section_code/standard_id inesistente
    addIssue('CAT-3', 'non_conformities con section_code/standard_id inesistente',
        await q(pool, `
            SELECT nc.nc_id, nc.nc_number, nc.section_code, nc.standard_id
            FROM non_conformities nc
            WHERE NOT EXISTS (
                SELECT 1 FROM checklist_sections cs
                WHERE cs.section_code = nc.section_code AND cs.standard_id = nc.standard_id
            )
        `));

    // 3d. nc_actions con nc_id inesistente (CASCADE ma verifichiamo)
    addIssue('CAT-3', 'nc_actions con nc_id inesistente (attesi 0)',
        await q(pool, `
            SELECT nca.action_id, nca.nc_id
            FROM nc_actions nca
            WHERE NOT EXISTS (SELECT 1 FROM non_conformities nc WHERE nc.nc_id = nca.nc_id)
        `));

    // ══════════════════════════════════════════════════════════════════════════
    section('CAT-4 — PENDING ISSUES');
    // ══════════════════════════════════════════════════════════════════════════

    // 4a. pending_issues con source_audit_id inesistente
    addIssue('CAT-4', 'pending_issues con source_audit_id inesistente',
        await q(pool, `
            SELECT pi.issue_id, pi.source_audit_id, pi.target_audit_id, pi.status
            FROM pending_issues pi
            WHERE NOT EXISTS (SELECT 1 FROM audits a WHERE a.audit_id = pi.source_audit_id)
        `));

    // 4b. pending_issues con source_response_id inesistente
    addIssue('CAT-4', 'pending_issues con source_response_id inesistente',
        await q(pool, `
            SELECT pi.issue_id, pi.source_response_id
            FROM pending_issues pi
            WHERE pi.source_response_id IS NOT NULL
              AND NOT EXISTS (SELECT 1 FROM audit_responses ar WHERE ar.response_id = pi.source_response_id)
        `));

    // 4c. pending_issues con question_id inesistente
    addIssue('CAT-4', 'pending_issues con question_id inesistente',
        await q(pool, `
            SELECT pi.issue_id, pi.question_id
            FROM pending_issues pi
            WHERE pi.question_id IS NOT NULL
              AND NOT EXISTS (SELECT 1 FROM checklist_questions cq WHERE cq.question_id = pi.question_id)
        `));

    // 4d. pending_issues con nc_id inesistente
    addIssue('CAT-4', 'pending_issues con nc_id inesistente',
        await q(pool, `
            SELECT pi.issue_id, pi.nc_id
            FROM pending_issues pi
            WHERE pi.nc_id IS NOT NULL
              AND NOT EXISTS (SELECT 1 FROM non_conformities nc WHERE nc.nc_id = pi.nc_id)
        `));

    // ══════════════════════════════════════════════════════════════════════════
    section('CAT-5 — CUSTOM CHECKLISTS');
    // ══════════════════════════════════════════════════════════════════════════

    // 5a. custom_checklist_sections senza custom_checklist padre (CASCADE ma verifichiamo)
    addIssue('CAT-5', 'custom_checklist_sections con custom_checklist_id inesistente (attesi 0)',
        await q(pool, `
            SELECT ccs.id, ccs.custom_checklist_id
            FROM custom_checklist_sections ccs
            WHERE NOT EXISTS (SELECT 1 FROM custom_checklists cc WHERE cc.id = ccs.custom_checklist_id)
        `));

    // 5b. custom_checklist_items senza section padre (CASCADE ma verifichiamo)
    addIssue('CAT-5', 'custom_checklist_items con section_id inesistente (attesi 0)',
        await q(pool, `
            SELECT cci.id, cci.section_id
            FROM custom_checklist_items cci
            WHERE NOT EXISTS (SELECT 1 FROM custom_checklist_sections ccs WHERE ccs.id = cci.section_id)
        `));

    // 5c. audit_custom_checklist_responses con custom_item_id inesistente (CASCADE)
    addIssue('CAT-5', 'audit_custom_checklist_responses con custom_item_id inesistente (attesi 0)',
        await q(pool, `
            SELECT accr.id, accr.custom_item_id, accr.audit_id
            FROM audit_custom_checklist_responses accr
            WHERE NOT EXISTS (SELECT 1 FROM custom_checklist_items cci WHERE cci.id = accr.custom_item_id)
        `));

    // 5d. audit_custom_checklist_responses_history con audit_id+custom_item_id orfano
    addIssue('CAT-5', 'audit_custom_checklist_responses_history con coppia audit_id/custom_item_id inesistente',
        await q(pool, `
            SELECT TOP 20 h.id, h.audit_id, h.custom_item_id
            FROM audit_custom_checklist_responses_history h
            WHERE NOT EXISTS (
                SELECT 1 FROM audit_custom_checklist_responses r
                WHERE r.audit_id = h.audit_id AND r.custom_item_id = h.custom_item_id
            )
        `));

    // ══════════════════════════════════════════════════════════════════════════
    section('CAT-6 — REGISTRO DOCUMENTI');
    // ══════════════════════════════════════════════════════════════════════════

    // 6a. document_registry con attachment_id inesistente (NO_ACTION)
    addIssue('CAT-6', 'document_registry con attachment_id inesistente',
        await q(pool, `
            SELECT TOP 20 dr.id, dr.attachment_id, dr.title
            FROM document_registry dr
            WHERE dr.attachment_id IS NOT NULL
              AND NOT EXISTS (SELECT 1 FROM attachments att WHERE att.attachment_id = dr.attachment_id)
        `));

    // 6b. document_registry con parent_id inesistente (autoreferenza)
    addIssue('CAT-6', 'document_registry con parent_id inesistente (struttura albero rotta)',
        await q(pool, `
            SELECT TOP 20 dr.id, dr.parent_id, dr.title
            FROM document_registry dr
            WHERE dr.parent_id IS NOT NULL
              AND NOT EXISTS (SELECT 1 FROM document_registry p WHERE p.id = dr.parent_id)
        `));

    // 6c. document_registry con company_id inesistente
    addIssue('CAT-6', 'document_registry con company_id inesistente',
        await q(pool, `
            SELECT TOP 20 dr.id, dr.company_id, dr.title
            FROM document_registry dr
            WHERE dr.company_id IS NOT NULL
              AND NOT EXISTS (SELECT 1 FROM companies c WHERE c.id = dr.company_id)
        `));

    // 6d. document_history con document_id inesistente
    addIssue('CAT-6', 'document_history con document_id inesistente',
        await q(pool, `
            SELECT dh.id, dh.document_id
            FROM document_history dh
            WHERE NOT EXISTS (SELECT 1 FROM document_registry dr WHERE dr.id = dh.document_id)
        `));

    // 6e. norm_document_sources con document_id inesistente
    addIssue('CAT-6', 'norm_document_sources con document_id inesistente',
        await q(pool, `
            SELECT nds.id, nds.document_id
            FROM norm_document_sources nds
            WHERE nds.document_id IS NOT NULL
              AND NOT EXISTS (SELECT 1 FROM document_registry dr WHERE dr.id = nds.document_id)
        `));

    // ══════════════════════════════════════════════════════════════════════════
    section('CAT-7 — COMMERCIAL CASES');
    // ══════════════════════════════════════════════════════════════════════════

    // 7a. commercial_cases con commercial_customer_id inesistente
    addIssue('CAT-7', 'commercial_cases con commercial_customer_id inesistente',
        await q(pool, `
            SELECT cc.id, cc.title, cc.commercial_customer_id
            FROM commercial_cases cc
            WHERE cc.commercial_customer_id IS NOT NULL
              AND NOT EXISTS (SELECT 1 FROM company_counterparties cp WHERE cp.id = cc.commercial_customer_id)
        `));

    // 7b. commercial_cases con source_import_job_id inesistente
    addIssue('CAT-7', 'commercial_cases con source_import_job_id inesistente',
        await q(pool, `
            SELECT cc.id, cc.title, cc.source_import_job_id
            FROM commercial_cases cc
            WHERE cc.source_import_job_id IS NOT NULL
              AND NOT EXISTS (SELECT 1 FROM import_jobs ij WHERE ij.id = cc.source_import_job_id)
        `));

    // 7c. commercial_case_history con case_id inesistente (ha CASCADE ma verifichiamo)
    addIssue('CAT-7', 'commercial_case_history con case_id inesistente (attesi 0)',
        await q(pool, `
            SELECT cch.id, cch.case_id
            FROM commercial_case_history cch
            WHERE NOT EXISTS (SELECT 1 FROM commercial_cases cc WHERE cc.id = cch.case_id)
        `));

    // ══════════════════════════════════════════════════════════════════════════
    section('CAT-8 — IMPORT JOBS');
    // ══════════════════════════════════════════════════════════════════════════

    // 8a. import_job_files con job_id inesistente (CASCADE ma verifichiamo)
    addIssue('CAT-8', 'import_job_files con job_id inesistente (attesi 0)',
        await q(pool, `
            SELECT ijf.id, ijf.job_id
            FROM import_job_files ijf
            WHERE NOT EXISTS (SELECT 1 FROM import_jobs ij WHERE ij.id = ijf.job_id)
        `));

    // 8b. import_job_files con commercial_case_id inesistente
    addIssue('CAT-8', 'import_job_files con commercial_case_id inesistente',
        await q(pool, `
            SELECT ijf.id, ijf.commercial_case_id
            FROM import_job_files ijf
            WHERE ijf.commercial_case_id IS NOT NULL
              AND NOT EXISTS (SELECT 1 FROM commercial_cases cc WHERE cc.id = ijf.commercial_case_id)
        `));

    // 8c. import_job_files con qualification_id inesistente
    addIssue('CAT-8', 'import_job_files con qualification_id inesistente',
        await q(pool, `
            SELECT ijf.id, ijf.qualification_id
            FROM import_job_files ijf
            WHERE ijf.qualification_id IS NOT NULL
              AND NOT EXISTS (SELECT 1 FROM qualifications qu WHERE qu.id = ijf.qualification_id)
        `));

    // ══════════════════════════════════════════════════════════════════════════
    section('CAT-9 — QUALIFICHE E PERSONALE');
    // ══════════════════════════════════════════════════════════════════════════

    // 9a. qualifications con personnel_id inesistente
    addIssue('CAT-9', 'qualifications con personnel_id inesistente',
        await q(pool, `
            SELECT q.id, q.person_name, q.personnel_id
            FROM qualifications q
            WHERE q.personnel_id IS NOT NULL
              AND NOT EXISTS (SELECT 1 FROM company_personnel cp WHERE cp.id = q.personnel_id)
        `));

    // 9b. qualifications con previous_qualification_id inesistente (autoreferenza)
    addIssue('CAT-9', 'qualifications con previous_qualification_id inesistente',
        await q(pool, `
            SELECT q.id, q.person_name, q.previous_qualification_id
            FROM qualifications q
            WHERE q.previous_qualification_id IS NOT NULL
              AND NOT EXISTS (SELECT 1 FROM qualifications q2 WHERE q2.id = q.previous_qualification_id)
        `));

    // 9c. qualification_confirmations con qualification_id inesistente
    addIssue('CAT-9', 'qualification_confirmations con qualification_id inesistente',
        await q(pool, `
            SELECT qc.id, qc.qualification_id
            FROM qualification_confirmations qc
            WHERE NOT EXISTS (SELECT 1 FROM qualifications q WHERE q.id = qc.qualification_id)
        `));

    // 9d. company_personnel con company_id inesistente
    addIssue('CAT-9', 'company_personnel con company_id inesistente',
        await q(pool, `
            SELECT cp.id, cp.name, cp.company_id
            FROM company_personnel cp
            WHERE NOT EXISTS (SELECT 1 FROM companies c WHERE c.id = cp.company_id)
        `));

    // 9e. company_personnel con notification_contact_id inesistente
    addIssue('CAT-9', 'company_personnel con notification_contact_id inesistente',
        await q(pool, `
            SELECT cp.id, cp.name, cp.notification_contact_id
            FROM company_personnel cp
            WHERE cp.notification_contact_id IS NOT NULL
              AND NOT EXISTS (SELECT 1 FROM notification_contacts nc WHERE nc.id = cp.notification_contact_id)
        `));

    // 9f. project_welders con qualification_id inesistente
    addIssue('CAT-9', 'project_welders con qualification_id inesistente',
        await q(pool, `
            SELECT pw.id, pw.qualification_id, pw.project_id
            FROM project_welders pw
            WHERE NOT EXISTS (SELECT 1 FROM qualifications q WHERE q.id = pw.qualification_id)
        `));

    // ══════════════════════════════════════════════════════════════════════════
    section('CAT-10 — NDT REPORTS');
    // ══════════════════════════════════════════════════════════════════════════

    // 10a. ndt_report_items con report_id inesistente (ha FK definita)
    addIssue('CAT-10', 'ndt_report_items con report_id inesistente (attesi 0)',
        await q(pool, `
            SELECT nri.id, nri.report_id
            FROM ndt_report_items nri
            WHERE NOT EXISTS (SELECT 1 FROM ndt_reports nr WHERE nr.id = nri.report_id)
        `));

    // 10b. ndt_report_instruments con report_id inesistente
    addIssue('CAT-10', 'ndt_report_instruments con report_id inesistente',
        await q(pool, `
            SELECT nri.id, nri.report_id
            FROM ndt_report_instruments nri
            WHERE NOT EXISTS (SELECT 1 FROM ndt_reports nr WHERE nr.id = nri.report_id)
        `));

    // 10c. ndt_report_instruments con asset_id inesistente
    addIssue('CAT-10', 'ndt_report_instruments con asset_id inesistente',
        await q(pool, `
            SELECT nri.id, nri.asset_id
            FROM ndt_report_instruments nri
            WHERE NOT EXISTS (SELECT 1 FROM equipment_assets ea WHERE ea.id = nri.asset_id)
        `));

    // ══════════════════════════════════════════════════════════════════════════
    section('CAT-11 — UTENTI E ORGANIZZAZIONI');
    // ══════════════════════════════════════════════════════════════════════════

    // 11a. users con organization_id inesistente
    addIssue('CAT-11', 'users con organization_id inesistente',
        await q(pool, `
            SELECT u.user_id, u.email, u.organization_id
            FROM users u
            WHERE NOT EXISTS (SELECT 1 FROM organizations o WHERE o.organization_id = u.organization_id)
        `));

    // 11b. users con auditor_org_id inesistente
    addIssue('CAT-11', 'users con auditor_org_id inesistente',
        await q(pool, `
            SELECT u.user_id, u.email, u.auditor_org_id
            FROM users u
            WHERE u.auditor_org_id IS NOT NULL
              AND NOT EXISTS (SELECT 1 FROM auditor_orgs ao WHERE ao.id = u.auditor_org_id)
        `));

    // 11c. notification_contacts con company_id inesistente
    addIssue('CAT-11', 'notification_contacts con company_id inesistente',
        await q(pool, `
            SELECT nc.id, nc.email, nc.company_id
            FROM notification_contacts nc
            WHERE nc.company_id IS NOT NULL
              AND NOT EXISTS (SELECT 1 FROM companies c WHERE c.id = nc.company_id)
        `));

    // ══════════════════════════════════════════════════════════════════════════
    section('CAT-12 — ANOMALIE LOGICHE (non FK)');
    // ══════════════════════════════════════════════════════════════════════════

    // 12a. Audit senza risposte né risposte custom (audit "vuoti" non draft)
    addIssue('CAT-12', 'audits completati/approvati senza risposte',
        await q(pool, `
            SELECT a.audit_id, a.audit_number, a.status, a.audit_date
            FROM audits a
            WHERE a.status IN ('completed','approved','COMPLETED','APPROVED')
              AND NOT EXISTS (SELECT 1 FROM audit_responses ar WHERE ar.audit_id = a.audit_id)
              AND NOT EXISTS (SELECT 1 FROM audit_custom_checklist_responses accr WHERE accr.audit_id = a.audit_id)
        `));

    // 12b. audit_responses con conformity_status non riconosciuto (per sicurezza)
    addIssue('CAT-12', 'audit_responses con conformity_status non valido',
        await q(pool, `
            SELECT TOP 20 ar.response_id, ar.audit_id, ar.conformity_status
            FROM audit_responses ar
            WHERE ar.conformity_status IS NOT NULL
              AND ar.conformity_status NOT IN ('C','NC','OSS','OM','NA','NV')
        `));

    // 12c. Allegati con storage_path duplicato (stesso file fisico, due record DB)
    addIssue('CAT-12', 'storage_path duplicati in attachments (stesso file, N record)',
        await q(pool, `
            SELECT storage_path, COUNT(*) AS duplicati
            FROM attachments
            GROUP BY storage_path
            HAVING COUNT(*) > 1
        `));

    // 12d. audit_custom_checklist_responses_history senza corrispondenza nella tabella corrente
    //      Già in CAT-5 — skip

    // 12e. Backup table audit_responses_backup_20260111 — record non in audit_responses
    addIssue('CAT-12', 'righe in audit_responses_backup_20260111 non presenti in audit_responses',
        await q(pool, `
            SELECT TOP 20 b.response_id, b.audit_id, b.question_id
            FROM audit_responses_backup_20260111 b
            WHERE NOT EXISTS (SELECT 1 FROM audit_responses ar WHERE ar.response_id = b.response_id)
        `));

    // ══════════════════════════════════════════════════════════════════════════
    section('CAT-13 — KNOWLEDGE / AI');
    // ══════════════════════════════════════════════════════════════════════════

    // 13a. knowledge_chunks con company_id inesistente
    addIssue('CAT-13', 'knowledge_chunks con company_id inesistente',
        await q(pool, `
            SELECT TOP 20 kc.id, kc.company_id
            FROM knowledge_chunks kc
            WHERE kc.company_id IS NOT NULL
              AND NOT EXISTS (SELECT 1 FROM companies c WHERE c.id = kc.company_id)
        `));

    // 13b. knowledge_chunks con standard_id inesistente
    addIssue('CAT-13', 'knowledge_chunks con standard_id inesistente',
        await q(pool, `
            SELECT TOP 20 kc.id, kc.standard_id
            FROM knowledge_chunks kc
            WHERE kc.standard_id IS NOT NULL
              AND NOT EXISTS (SELECT 1 FROM standards s WHERE s.standard_id = kc.standard_id)
        `));

    // ══════════════════════════════════════════════════════════════════════════
    section('CAT-14 — SCADENZARIO E BILLING');
    // ══════════════════════════════════════════════════════════════════════════

    // 14a. deadline_items con company_id inesistente
    addIssue('CAT-14', 'deadline_items con company_id inesistente',
        await q(pool, `
            SELECT di.id, di.company_id, di.title
            FROM deadline_items di
            WHERE di.company_id IS NOT NULL
              AND NOT EXISTS (SELECT 1 FROM companies c WHERE c.id = di.company_id)
        `));

    // 14b. deadline_items con source_document_id inesistente
    addIssue('CAT-14', 'deadline_items con source_document_id inesistente',
        await q(pool, `
            SELECT di.id, di.source_document_id
            FROM deadline_items di
            WHERE di.source_document_id IS NOT NULL
              AND NOT EXISTS (SELECT 1 FROM document_registry dr WHERE dr.id = di.source_document_id)
        `));

    // 14c. billing_events con company_id inesistente
    addIssue('CAT-14', 'billing_events con company_id inesistente',
        await q(pool, `
            SELECT be.id, be.company_id
            FROM billing_events be
            WHERE be.company_id IS NOT NULL
              AND NOT EXISTS (SELECT 1 FROM companies c WHERE c.id = be.company_id)
        `));

    // ══════════════════════════════════════════════════════════════════════════
    section('RIEPILOGO');
    // ══════════════════════════════════════════════════════════════════════════

    console.log(`\n  Totale anomalie rilevate: ${report.total}`);
    console.log(`  Categorie con anomalie:   ${report.issues.length}\n`);

    if (report.issues.length === 0) {
        console.log('  ✅ Nessuna anomalia rilevata — database integro.');
    } else {
        console.log('  Dettaglio anomalie:');
        for (const iss of report.issues) {
            console.log(`    [${iss.cat}] ${iss.label}: ${iss.count}`);
        }
    }

    // Output JSON machine-readable su stderr (per parsing da CI/script)
    process.stderr.write(JSON.stringify({ runAt: new Date().toISOString(), total: report.total, issues: report.issues }, null, 2) + '\n');

    await pool.close();
    process.exit(report.total > 0 ? 1 : 0);
}

main().catch(err => {
    console.error('\nERRORE FATALE:', err.message);
    process.exit(2);
});

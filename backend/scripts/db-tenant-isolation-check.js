/**
 * db-tenant-isolation-check.js
 * Verifica isolamento multi-tenant e coerenza Studio → Azienda nel DB SGQ_ISO9001.
 *
 * Gerarchia tenant:
 *   organizations (L0) ← confine tenant
 *     └─ auditor_orgs  (L1) ← studio di consulenza
 *           └─ companies     (L2) ← azienda cliente
 *                 └─ audits / non_conformities / attachments / ...
 *
 * Eseguire sul VPS:
 *   scp -i /tmp/sgq_key -P 1122 ... spascarella@www.fr-busato.it:/tmp/
 *   ssh -i /tmp/sgq_key -p 1122 ... spascarella@www.fr-busato.it "node /tmp/db-tenant-isolation-check.js"
 */
'use strict';

const fs   = require('fs');
const path = require('path');

const VPS_BACKEND = '/var/www/sgq-backend';
const VPS_ENV     = `${VPS_BACKEND}/.env`;

let mssql, DB_CONFIG;
if (fs.existsSync(VPS_ENV)) {
    require(`${VPS_BACKEND}/node_modules/dotenv`).config({ path: VPS_ENV });
    mssql = require(`${VPS_BACKEND}/node_modules/mssql`);
    DB_CONFIG = {
        server: '127.0.0.1', port: 11043, database: 'SGQ_ISO9001',
        user: 'pascarella', password: '#Gestione2025@',
        options: { encrypt: false, trustServerCertificate: true, enableArithAbort: true,
                   connectTimeout: 30000, requestTimeout: 120000 },
    };
} else {
    require('dotenv').config();
    mssql = require('mssql');
    const c = JSON.parse(fs.readFileSync(path.join(__dirname, '../config/database.json'), 'utf8')).development || {};
    DB_CONFIG = { server: c.server, port: c.port || 1433, database: c.database, user: c.user, password: c.password,
                  options: { encrypt: false, trustServerCertificate: true } };
}

// ─── Utilities ────────────────────────────────────────────────────────────────
function section(title) { const l='═'.repeat(68); console.log(`\n${l}\n  ${title}\n${l}`); }
function check(label, count, details = []) {
    const icon = count === 0 ? '✅' : '⚠️ ';
    console.log(`  ${icon}  ${label}: ${count}`);
    if (count > 0 && details.length > 0) {
        details.slice(0, 10).forEach(d => console.log(`       ↳ ${JSON.stringify(d)}`));
        if (details.length > 10) console.log(`       ↳ … e altri ${details.length - 10} record`);
    }
}
async function q(pool, sql) { return (await pool.request().query(sql)).recordset; }

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
    console.log(`\n${'─'.repeat(68)}`);
    console.log('  CHECK ISOLAMENTO MULTI-TENANT — SGQ_ISO9001');
    console.log(`  Data: ${new Date().toISOString()}`);
    console.log(`${'─'.repeat(68)}`);

    const pool = await mssql.connect(DB_CONFIG);
    const issues = [];
    function addIssue(cat, label, rows) {
        if (rows.length > 0) issues.push({ cat, label, count: rows.length });
        check(label, rows.length, rows);
    }

    // Panoramica tenant
    const orgs = await q(pool, `SELECT organization_id, organization_name FROM organizations ORDER BY organization_id`);
    console.log('\n  Organizzazioni presenti:');
    orgs.forEach(o => console.log(`    org_id=${o.organization_id}  ${o.organization_name}`));

    const aorgs = await q(pool, `
        SELECT ao.id, ao.name AS studio_name, ao.organization_id,
               o.organization_name
        FROM auditor_orgs ao
        JOIN organizations o ON o.organization_id = ao.organization_id
        ORDER BY ao.organization_id, ao.id
    `);
    console.log('\n  Studi (auditor_orgs):');
    aorgs.forEach(a => console.log(`    studio_id=${a.id}  "${a.studio_name}"  → org=${a.organization_id} "${a.organization_name}"`));

    const comps = await q(pool, `
        SELECT c.id, c.name AS company_name, c.auditor_org_id,
               ao.name AS studio_name, ao.organization_id
        FROM companies c
        JOIN auditor_orgs ao ON ao.id = c.auditor_org_id
        ORDER BY ao.organization_id, c.id
    `);
    console.log('\n  Aziende (companies):');
    comps.forEach(c => console.log(`    company_id=${c.id}  "${c.company_name}"  → studio=${c.auditor_org_id} "${c.studio_name}"  org=${c.organization_id}`));

    // ══════════════════════════════════════════════════════════════════════════
    section('ISO-1 — Audit: coerenza organization_id ↔ company_id');
    // ══════════════════════════════════════════════════════════════════════════

    // 1a. audit.organization_id ≠ company.auditor_org.organization_id
    addIssue('ISO-1', 'Audit il cui company_id appartiene a organization diversa',
        await q(pool, `
            SELECT a.audit_id, a.audit_number, a.organization_id AS audit_org,
                   a.company_id, c.name AS company_name,
                   ao.organization_id AS company_org
            FROM audits a
            JOIN companies c ON c.id = a.company_id
            JOIN auditor_orgs ao ON ao.id = c.auditor_org_id
            WHERE a.organization_id <> ao.organization_id
        `));

    // 1b. Audit con custom_checklist_id di una organizzazione diversa
    addIssue('ISO-1', 'Audit con custom_checklist_id di organization diversa',
        await q(pool, `
            SELECT a.audit_id, a.audit_number, a.organization_id AS audit_org,
                   cc.id AS checklist_id, cc.name AS checklist_name,
                   cc.organization_id AS checklist_org
            FROM audits a
            JOIN custom_checklists cc ON cc.id = a.custom_checklist_id
            WHERE a.custom_checklist_id IS NOT NULL
              AND a.organization_id <> cc.organization_id
        `));

    // ══════════════════════════════════════════════════════════════════════════
    section('ISO-2 — Allegati: coerenza tenant tra attachment e entità padre');
    // ══════════════════════════════════════════════════════════════════════════

    // 2a. Allegati legati ad audit di una org, caricati da utente di altra org
    addIssue('ISO-2', 'Allegato (via audit) caricato da utente di organization diversa',
        await q(pool, `
            SELECT att.attachment_id, att.audit_id, att.uploaded_by,
                   a.organization_id AS audit_org,
                   u.organization_id AS uploader_org,
                   u.email AS uploader_email
            FROM attachments att
            JOIN audits a ON a.audit_id = att.audit_id
            JOIN users u ON u.user_id = att.uploaded_by
            WHERE att.audit_id IS NOT NULL
              AND a.organization_id <> u.organization_id
        `));

    // 2b. Allegati legati a NC di audit di una org, caricati da utente di altra org
    addIssue('ISO-2', 'Allegato (via NC) caricato da utente di organization diversa',
        await q(pool, `
            SELECT att.attachment_id, att.nc_id, att.uploaded_by,
                   a.organization_id AS audit_org,
                   u.organization_id AS uploader_org,
                   u.email AS uploader_email
            FROM attachments att
            JOIN non_conformities nc ON nc.nc_id = att.nc_id
            JOIN audits a ON a.audit_id = nc.audit_id
            JOIN users u ON u.user_id = att.uploaded_by
            WHERE att.nc_id IS NOT NULL
              AND a.organization_id <> u.organization_id
        `));

    // 2c. Allegati legati a custom_item di checklist di altra org rispetto all'audit
    addIssue('ISO-2', 'Allegato (via custom_item) con organization checklist ≠ audit org',
        await q(pool, `
            SELECT att.attachment_id, att.custom_item_id, att.audit_id,
                   a.organization_id AS audit_org,
                   cc.organization_id AS checklist_org,
                   cc.name AS checklist_name
            FROM attachments att
            JOIN audits a ON a.audit_id = att.audit_id
            JOIN custom_checklist_items cci ON cci.id = att.custom_item_id
            JOIN custom_checklist_sections ccs ON ccs.id = cci.section_id
            JOIN custom_checklists cc ON cc.id = ccs.custom_checklist_id
            WHERE att.custom_item_id IS NOT NULL
              AND att.audit_id IS NOT NULL
              AND a.organization_id <> cc.organization_id
        `));

    // 2d. Allegati con commercial_case di org diversa dall'uploader
    addIssue('ISO-2', 'Allegato (via commercial_case) con organization ≠ uploader org',
        await q(pool, `
            SELECT att.attachment_id, att.commercial_case_id,
                   cc.organization_id AS case_org,
                   u.organization_id AS uploader_org,
                   u.email AS uploader_email
            FROM attachments att
            JOIN commercial_cases cc ON cc.id = att.commercial_case_id
            JOIN users u ON u.user_id = att.uploaded_by
            WHERE att.commercial_case_id IS NOT NULL
              AND cc.organization_id <> u.organization_id
        `));

    // ══════════════════════════════════════════════════════════════════════════
    section('ISO-3 — Non Conformità: organization_id coerente con audit padre');
    // ══════════════════════════════════════════════════════════════════════════

    // 3a. NC con organization_id diverso dall'audit padre
    addIssue('ISO-3', 'NC con organization_id diverso dall\'audit padre',
        await q(pool, `
            SELECT nc.nc_id, nc.nc_number,
                   nc.organization_id AS nc_org,
                   nc.audit_id,
                   a.organization_id AS audit_org,
                   a.audit_number
            FROM non_conformities nc
            JOIN audits a ON a.audit_id = nc.audit_id
            WHERE nc.organization_id IS NOT NULL
              AND nc.organization_id <> a.organization_id
        `));

    // 3b. NC di audit che appartengono ad aziende di un altro studio
    addIssue('ISO-3', 'NC i cui audit puntano ad azienda di organization diversa da NC.org',
        await q(pool, `
            SELECT nc.nc_id, nc.nc_number, nc.organization_id AS nc_org,
                   a.company_id, c.name AS company_name,
                   ao.organization_id AS company_org
            FROM non_conformities nc
            JOIN audits a ON a.audit_id = nc.audit_id
            JOIN companies c ON c.id = a.company_id
            JOIN auditor_orgs ao ON ao.id = c.auditor_org_id
            WHERE nc.organization_id IS NOT NULL
              AND nc.organization_id <> ao.organization_id
        `));

    // ══════════════════════════════════════════════════════════════════════════
    section('ISO-4 — Custom Checklists: scope coerente con auditor_org');
    // ══════════════════════════════════════════════════════════════════════════

    // 4a. custom_checklists con auditor_org_id di un'altra org rispetto all'organization_id
    addIssue('ISO-4', 'custom_checklists il cui auditor_org appartiene ad altra organization',
        await q(pool, `
            SELECT cc.id, cc.name, cc.organization_id AS cc_org,
                   cc.auditor_org_id,
                   ao.organization_id AS ao_org
            FROM custom_checklists cc
            JOIN auditor_orgs ao ON ao.id = cc.auditor_org_id
            WHERE cc.auditor_org_id IS NOT NULL
              AND cc.organization_id <> ao.organization_id
        `));

    // 4b. audit_custom_checklist_responses con audit di una org e checklist di un'altra
    addIssue('ISO-4', 'Risposte custom-checklist con audit.org ≠ checklist.org',
        await q(pool, `
            SELECT TOP 20 accr.id, accr.audit_id, accr.custom_item_id,
                   a.organization_id AS audit_org,
                   cc.organization_id AS checklist_org,
                   cc.name AS checklist_name
            FROM audit_custom_checklist_responses accr
            JOIN audits a ON a.audit_id = accr.audit_id
            JOIN custom_checklist_items cci ON cci.id = accr.custom_item_id
            JOIN custom_checklist_sections ccs ON ccs.id = cci.section_id
            JOIN custom_checklists cc ON cc.id = ccs.custom_checklist_id
            WHERE a.organization_id <> cc.organization_id
        `));

    // ══════════════════════════════════════════════════════════════════════════
    section('ISO-5 — Document Registry: coerenza organization_id ↔ company_id');
    // ══════════════════════════════════════════════════════════════════════════

    // 5a. document_registry con company_id di altra org rispetto al documento
    addIssue('ISO-5', 'document_registry con company_id di organization diversa',
        await q(pool, `
            SELECT dr.id, dr.title, dr.organization_id AS doc_org,
                   dr.company_id, c.name AS company_name,
                   ao.organization_id AS company_org
            FROM document_registry dr
            JOIN companies c ON c.id = dr.company_id
            JOIN auditor_orgs ao ON ao.id = c.auditor_org_id
            WHERE dr.company_id IS NOT NULL
              AND dr.organization_id <> ao.organization_id
        `));

    // 5b. document_registry con auditor_org_id di altra org
    addIssue('ISO-5', 'document_registry con auditor_org_id di organization diversa',
        await q(pool, `
            SELECT dr.id, dr.title, dr.organization_id AS doc_org,
                   dr.auditor_org_id,
                   ao.organization_id AS ao_org
            FROM document_registry dr
            JOIN auditor_orgs ao ON ao.id = dr.auditor_org_id
            WHERE dr.auditor_org_id IS NOT NULL
              AND dr.organization_id <> ao.organization_id
        `));

    // ══════════════════════════════════════════════════════════════════════════
    section('ISO-6 — Commercial Cases: company coerente con organization');
    // ══════════════════════════════════════════════════════════════════════════

    // 6a. commercial_cases con company_id di altra org
    addIssue('ISO-6', 'commercial_cases con company_id di organization diversa',
        await q(pool, `
            SELECT cc.id, cc.title, cc.organization_id AS case_org,
                   cc.company_id, c.name AS company_name,
                   ao.organization_id AS company_org
            FROM commercial_cases cc
            JOIN companies c ON c.id = cc.company_id
            JOIN auditor_orgs ao ON ao.id = c.auditor_org_id
            WHERE cc.company_id IS NOT NULL
              AND cc.organization_id <> ao.organization_id
        `));

    // ══════════════════════════════════════════════════════════════════════════
    section('ISO-7 — Qualifiche e Personale: azienda ↔ organization');
    // ══════════════════════════════════════════════════════════════════════════

    // 7a. qualifications con company_id di altra org rispetto all'org della qualifica
    addIssue('ISO-7', 'qualifications con company_id di organization diversa',
        await q(pool, `
            SELECT q.id, q.person_name, q.organization_id AS qual_org,
                   q.company_id, c.name AS company_name,
                   ao.organization_id AS company_org
            FROM qualifications q
            JOIN companies c ON c.id = q.company_id
            JOIN auditor_orgs ao ON ao.id = c.auditor_org_id
            WHERE q.organization_id <> ao.organization_id
        `));

    // 7b. company_personnel con organization_id ≠ organizzazione dell'azienda
    addIssue('ISO-7', 'company_personnel con organization_id ≠ org dell\'azienda',
        await q(pool, `
            SELECT cp.id, cp.name, cp.organization_id AS person_org,
                   cp.company_id, c.name AS company_name,
                   ao.organization_id AS company_org
            FROM company_personnel cp
            JOIN companies c ON c.id = cp.company_id
            JOIN auditor_orgs ao ON ao.id = c.auditor_org_id
            WHERE cp.organization_id <> ao.organization_id
        `));

    // 7c. notification_contacts con company_id di altra org
    addIssue('ISO-7', 'notification_contacts con company_id di organization diversa',
        await q(pool, `
            SELECT nc.id, nc.email, nc.organization_id AS contact_org,
                   nc.company_id, c.name AS company_name,
                   ao.organization_id AS company_org
            FROM notification_contacts nc
            JOIN companies c ON c.id = nc.company_id
            JOIN auditor_orgs ao ON ao.id = c.auditor_org_id
            WHERE nc.company_id IS NOT NULL
              AND nc.organization_id <> ao.organization_id
        `));

    // ══════════════════════════════════════════════════════════════════════════
    section('ISO-8 — NDT Reports: company ↔ organization');
    // ══════════════════════════════════════════════════════════════════════════

    addIssue('ISO-8', 'ndt_reports con company_id di organization diversa',
        await q(pool, `
            SELECT nr.id, nr.report_number, nr.organization_id AS report_org,
                   nr.company_id, c.name AS company_name,
                   ao.organization_id AS company_org
            FROM ndt_reports nr
            JOIN companies c ON c.id = nr.company_id
            JOIN auditor_orgs ao ON ao.id = c.auditor_org_id
            WHERE nr.company_id IS NOT NULL
              AND nr.organization_id <> ao.organization_id
        `));

    // ══════════════════════════════════════════════════════════════════════════
    section('ISO-9 — Utenti: auditor_org coerente con organization');
    // ══════════════════════════════════════════════════════════════════════════

    // 9a. Utenti con auditor_org_id di un'altra organizzazione
    addIssue('ISO-9', 'Utenti il cui auditor_org appartiene ad altra organization',
        await q(pool, `
            SELECT u.user_id, u.email, u.role,
                   u.organization_id AS user_org,
                   u.auditor_org_id,
                   ao.organization_id AS ao_org,
                   ao.name AS studio_name
            FROM users u
            JOIN auditor_orgs ao ON ao.id = u.auditor_org_id
            WHERE u.auditor_org_id IS NOT NULL
              AND u.organization_id <> ao.organization_id
        `));

    // ══════════════════════════════════════════════════════════════════════════
    section('ISO-10 — Knowledge Chunks: company ↔ organization');
    // ══════════════════════════════════════════════════════════════════════════

    addIssue('ISO-10', 'knowledge_chunks con company_id di organization diversa',
        await q(pool, `
            SELECT TOP 20 kc.id, kc.organization_id AS chunk_org,
                   kc.company_id, c.name AS company_name,
                   ao.organization_id AS company_org
            FROM knowledge_chunks kc
            JOIN companies c ON c.id = kc.company_id
            JOIN auditor_orgs ao ON ao.id = c.auditor_org_id
            WHERE kc.company_id IS NOT NULL
              AND kc.organization_id <> ao.organization_id
        `));

    // ══════════════════════════════════════════════════════════════════════════
    section('ISO-11 — Scadenzario e Billing: company ↔ organization');
    // ══════════════════════════════════════════════════════════════════════════

    addIssue('ISO-11', 'deadline_items con company_id di organization diversa',
        await q(pool, `
            SELECT di.id, di.organization_id AS item_org,
                   di.company_id, c.name AS company_name,
                   ao.organization_id AS company_org
            FROM deadline_items di
            JOIN companies c ON c.id = di.company_id
            JOIN auditor_orgs ao ON ao.id = c.auditor_org_id
            WHERE di.company_id IS NOT NULL
              AND di.organization_id <> ao.organization_id
        `));

    addIssue('ISO-11', 'billing_events con company_id di organization diversa',
        await q(pool, `
            SELECT be.id, be.organization_id AS event_org,
                   be.company_id, c.name AS company_name,
                   ao.organization_id AS company_org
            FROM billing_events be
            JOIN companies c ON c.id = be.company_id
            JOIN auditor_orgs ao ON ao.id = c.auditor_org_id
            WHERE be.company_id IS NOT NULL
              AND be.organization_id <> ao.organization_id
        `));

    // ══════════════════════════════════════════════════════════════════════════
    section('ISO-12 — Audit Events: organization coerente con audit padre');
    // ══════════════════════════════════════════════════════════════════════════

    addIssue('ISO-12', 'audit_events con organization_id diverso da audit padre',
        await q(pool, `
            SELECT TOP 20 ae.event_id, ae.audit_id,
                   ae.organization_id AS event_org,
                   a.organization_id AS audit_org
            FROM audit_events ae
            JOIN audits a ON a.audit_id = ae.audit_id
            WHERE ae.organization_id <> a.organization_id
        `));

    // ══════════════════════════════════════════════════════════════════════════
    section('RIEPILOGO');
    // ══════════════════════════════════════════════════════════════════════════

    const total = issues.reduce((s, i) => s + i.count, 0);
    console.log(`\n  Totale violazioni isolamento: ${total}`);
    console.log(`  Categorie con problemi:       ${issues.length}\n`);

    if (total === 0) {
        console.log('  ✅ Isolamento multi-tenant INTEGRO — nessuna violazione trovata.');
    } else {
        console.log('  ⚠️  Violazioni trovate:');
        issues.forEach(i => console.log(`    [${i.cat}] ${i.label}: ${i.count}`));
    }

    process.stderr.write(JSON.stringify({ runAt: new Date().toISOString(), total, issues }, null, 2) + '\n');
    await pool.close();
    process.exit(total > 0 ? 1 : 0);
}

main().catch(err => { console.error('\nERRORE FATALE:', err.message); process.exit(2); });

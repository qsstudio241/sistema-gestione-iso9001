/**
 * billing.service.js � Fatturazione B2B2B (QS Studio ? studi ? aziende)
 */

const { query } = require('../config/database');
const logger = require('../utils/logger');
const { getLicensedModuleKeysForOrg } = require('./moduleLicense.service');

const BILLING_STATUSES = ['trial', 'active', 'suspended', 'cancelled'];

function isBillable(billingStatus, companyIsActive) {
    return billingStatus === 'active' && (companyIsActive === true || companyIsActive === 1);
}

function currentPeriodYyyyMm(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
}

function parsePeriodYyyyMm(period) {
    if (!period || !/^\d{4}-\d{2}$/.test(String(period))) return null;
    const [y, m] = String(period).split('-').map(Number);
    if (m < 1 || m > 12) return null;
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 1);
    return { period: String(period), start, end };
}

async function getOrganizationIdForAuditorOrg(auditorOrgId) {
    const r = await query(
        `SELECT organization_id FROM auditor_orgs WHERE id = @id`,
        { id: auditorOrgId }
    );
    return r.recordset[0]?.organization_id || null;
}

async function logBillingEvent({ organizationId, companyId, auditorOrgId, eventType, payload, createdBy }) {
    try {
        await query(`
            INSERT INTO billing_events (
                organization_id, company_id, auditor_org_id,
                event_type, payload_json, created_by, created_at
            )
            VALUES (
                @organization_id, @company_id, @auditor_org_id,
                @event_type, @payload_json, @created_by, GETDATE()
            )
        `, {
            organization_id: organizationId,
            company_id: companyId ?? null,
            auditor_org_id: auditorOrgId ?? null,
            event_type: eventType,
            payload_json: JSON.stringify(payload || {}),
            created_by: createdBy ?? null,
        });
    } catch (err) {
        logger.warn('[BILLING] logBillingEvent failed (non-blocking)', {
            eventType,
            organizationId,
            error: err.message,
        });
    }
}

async function onCompanyCreated({ companyId, auditorOrgId, organizationId, createdBy }) {
    const orgId = organizationId || await getOrganizationIdForAuditorOrg(auditorOrgId);
    if (!orgId) {
        logger.warn('[BILLING] onCompanyCreated: organization_id mancante', { companyId, auditorOrgId });
        return;
    }

    const existing = await query(
        `SELECT id FROM company_billing WHERE company_id = @company_id`,
        { company_id: companyId }
    );
    if (existing.recordset.length) return;

    await query(`
        INSERT INTO company_billing (
            company_id, organization_id, auditor_org_id,
            status, billing_plan, activated_at, created_at, updated_at
        )
        VALUES (
            @company_id, @organization_id, @auditor_org_id,
            'active', 'base', GETDATE(), GETDATE(), GETDATE()
        )
    `, {
        company_id: companyId,
        organization_id: orgId,
        auditor_org_id: auditorOrgId,
    });

    await logBillingEvent({
        organizationId: orgId,
        companyId,
        auditorOrgId,
        eventType: 'company_activated',
        payload: { source: 'company_create', billing_status: 'active' },
        createdBy,
    });
}

async function syncCompanyActiveStatus({ companyId, auditorOrgId, organizationId, isActive, updatedBy }) {
    const orgId = organizationId || await getOrganizationIdForAuditorOrg(auditorOrgId);
    if (!orgId) return;

    const active = isActive === true || isActive === 1;
    const billingRes = await query(
        `SELECT id, status FROM company_billing WHERE company_id = @company_id`,
        { company_id: companyId }
    );

    if (!billingRes.recordset.length) {
        await query(`
            INSERT INTO company_billing (
                company_id, organization_id, auditor_org_id,
                status, billing_plan, activated_at, deactivated_at, created_at, updated_at
            )
            VALUES (
                @company_id, @organization_id, @auditor_org_id,
                @status, 'base', @activated_at, @deactivated_at, GETDATE(), GETDATE()
            )
        `, {
            company_id: companyId,
            organization_id: orgId,
            auditor_org_id: auditorOrgId,
            status: active ? 'active' : 'suspended',
            activated_at: active ? new Date() : null,
            deactivated_at: active ? null : new Date(),
        });
    } else {
        const newStatus = active ? 'active' : 'suspended';
        await query(`
            UPDATE company_billing
            SET status = @status,
                activated_at = CASE WHEN @is_active = 1 THEN COALESCE(activated_at, GETDATE()) ELSE activated_at END,
                deactivated_at = CASE WHEN @is_active = 0 THEN GETDATE() ELSE NULL END,
                updated_at = GETDATE()
            WHERE company_id = @company_id
        `, {
            company_id: companyId,
            status: newStatus,
            is_active: active ? 1 : 0,
        });
    }

    await logBillingEvent({
        organizationId: orgId,
        companyId,
        auditorOrgId,
        eventType: active ? 'company_reactivated' : 'company_deactivated',
        payload: { is_active: active, billing_status: active ? 'active' : 'suspended' },
        createdBy: updatedBy,
    });
}

async function onLicensesUpdated({ organizationId, modules, useDefaults, updatedBy }) {
    await logBillingEvent({
        organizationId,
        eventType: 'licenses_updated',
        payload: { modules: modules || [], use_defaults: !!useDefaults },
        createdBy: updatedBy,
    });
}

async function getBillingOverview() {
    const period = currentPeriodYyyyMm();
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const monthEnd = new Date(monthStart);
    monthEnd.setMonth(monthEnd.getMonth() + 1);

    const orgsRes = await query(`
        SELECT
            o.organization_id,
            o.organization_name,
            o.vat_number,
            COUNT(DISTINCT ao.id) AS studio_count,
            COUNT(DISTINCT c.id) AS total_companies,
            COUNT(DISTINCT CASE
                WHEN cb.status = 'active' AND c.is_active = 1 THEN c.id
            END) AS billable_companies
        FROM organizations o
        LEFT JOIN auditor_orgs ao ON ao.organization_id = o.organization_id AND ao.is_active = 1
        LEFT JOIN companies c ON c.auditor_org_id = ao.id
        LEFT JOIN company_billing cb ON cb.company_id = c.id
        GROUP BY o.organization_id, o.organization_name, o.vat_number
        ORDER BY o.organization_name
    `, {});

    let aiUsageByOrg = {};
    try {
        const aiRes = await query(`
            SELECT organization_id, COUNT(*) AS ai_usage_count
            FROM ai_usage_log
            WHERE created_at >= @month_start AND created_at < @month_end
            GROUP BY organization_id
        `, { month_start: monthStart, month_end: monthEnd });
        aiUsageByOrg = Object.fromEntries(
            (aiRes.recordset || []).map((r) => [r.organization_id, r.ai_usage_count])
        );
    } catch (_) {
        /* ai_usage_log potrebbe non esistere su DB vecchi */
    }

    const tenants = (orgsRes.recordset || []).map((row) => ({
        ...row,
        period,
        ai_usage_count: aiUsageByOrg[row.organization_id] || 0,
    }));

    const totals = tenants.reduce(
        (acc, t) => ({
            tenant_count: acc.tenant_count + 1,
            studio_count: acc.studio_count + (t.studio_count || 0),
            total_companies: acc.total_companies + (t.total_companies || 0),
            billable_companies: acc.billable_companies + (t.billable_companies || 0),
            ai_usage_count: acc.ai_usage_count + (t.ai_usage_count || 0),
        }),
        { tenant_count: 0, studio_count: 0, total_companies: 0, billable_companies: 0, ai_usage_count: 0 }
    );

    return { period, totals, tenants };
}

async function getBillingCompanies({ organizationId } = {}) {
    const params = {};
    let orgFilter = '';
    if (organizationId) {
        orgFilter = 'AND o.organization_id = @organization_id';
        params.organization_id = organizationId;
    }

    const period = currentPeriodYyyyMm();
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const monthEnd = new Date(monthStart);
    monthEnd.setMonth(monthEnd.getMonth() + 1);
    params.month_start = monthStart;
    params.month_end = monthEnd;

    const result = await query(`
        SELECT
            o.organization_id,
            o.organization_name,
            ao.id AS auditor_org_id,
            ao.name AS studio_name,
            c.id AS company_id,
            c.name AS company_name,
            c.is_active AS company_is_active,
            cb.status AS billing_status,
            cb.billing_plan,
            cb.activated_at,
            cb.deactivated_at,
            cb.monthly_fee_cents
        FROM organizations o
        INNER JOIN auditor_orgs ao ON ao.organization_id = o.organization_id
        INNER JOIN companies c ON c.auditor_org_id = ao.id
        LEFT JOIN company_billing cb ON cb.company_id = c.id
        WHERE 1=1 ${orgFilter}
        ORDER BY o.organization_name, ao.name, c.name
    `, params);

    let aiUsageByCompany = {};
    try {
        const aiRes = await query(`
            SELECT organization_id, company_id, COUNT(*) AS ai_usage_count
            FROM ai_usage_log
            WHERE created_at >= @month_start AND created_at < @month_end
            GROUP BY organization_id, company_id
        `, params);
        aiUsageByCompany = Object.fromEntries(
            (aiRes.recordset || []).map((r) => [`${r.organization_id}:${r.company_id}`, r.ai_usage_count])
        );
    } catch (_) {
        /* ai_usage_log potrebbe non esistere su DB vecchi */
    }

    return (result.recordset || []).map((row) => ({
        ...row,
        ai_usage_count: aiUsageByCompany[`${row.organization_id}:${row.company_id}`] || 0,
        is_billable: isBillable(row.billing_status || 'active', row.company_is_active),
        period,
    }));
}

async function getBillingEvents({ limit = 50, organizationId } = {}) {
    const params = { limit: Math.min(parseInt(limit, 10) || 50, 200) };
    let orgFilter = '';
    if (organizationId) {
        orgFilter = 'AND be.organization_id = @organization_id';
        params.organization_id = organizationId;
    }

    const result = await query(`
        SELECT TOP (@limit)
            be.id,
            be.organization_id,
            o.organization_name,
            be.company_id,
            c.name AS company_name,
            be.auditor_org_id,
            ao.name AS studio_name,
            be.event_type,
            be.payload_json,
            be.created_by,
            u.email AS created_by_email,
            be.created_at
        FROM billing_events be
        INNER JOIN organizations o ON o.organization_id = be.organization_id
        LEFT JOIN companies c ON c.id = be.company_id
        LEFT JOIN auditor_orgs ao ON ao.id = be.auditor_org_id
        LEFT JOIN users u ON u.user_id = be.created_by
        WHERE 1=1 ${orgFilter}
        ORDER BY be.created_at DESC
    `, params);

    return (result.recordset || []).map((row) => {
        let payload = null;
        try {
            payload = row.payload_json ? JSON.parse(row.payload_json) : null;
        } catch (_) {
            payload = row.payload_json;
        }
        return { ...row, payload };
    });
}

async function generateSnapshotForPeriod(periodYyyyMm) {
    const parsed = parsePeriodYyyyMm(periodYyyyMm);
    if (!parsed) throw new Error('Periodo non valido (YYYY-MM)');

    const companies = await query(`
        SELECT
            c.id AS company_id,
            c.is_active AS company_is_active,
            c.auditor_org_id,
            ao.organization_id,
            cb.status AS billing_status
        FROM companies c
        INNER JOIN auditor_orgs ao ON ao.id = c.auditor_org_id
        LEFT JOIN company_billing cb ON cb.company_id = c.id
    `, {});

    let inserted = 0;
    for (const row of companies.recordset || []) {
        const modules = await getLicensedModuleKeysForOrg(row.organization_id);
        let aiCount = 0;
        try {
            const aiRes = await query(`
                SELECT COUNT(*) AS cnt FROM ai_usage_log
                WHERE organization_id = @organization_id
                  AND company_id = @company_id
                  AND created_at >= @start AND created_at < @end
            `, {
                organization_id: row.organization_id,
                company_id: row.company_id,
                start: parsed.start,
                end: parsed.end,
            });
            aiCount = aiRes.recordset[0]?.cnt || 0;
        } catch (_) { /* ignore */ }

        const billable = isBillable(row.billing_status || 'active', row.company_is_active);
        const metrics = { ai_usage_count: aiCount };

        const existing = await query(`
            SELECT id FROM billing_snapshots
            WHERE period_yyyy_mm = @period AND company_id = @company_id
        `, { period: parsed.period, company_id: row.company_id });

        if (existing.recordset.length) {
            await query(`
                UPDATE billing_snapshots
                SET is_billable = @is_billable,
                    modules_enabled = @modules_enabled,
                    metrics_json = @metrics_json,
                    auditor_org_id = @auditor_org_id,
                    organization_id = @organization_id
                WHERE period_yyyy_mm = @period AND company_id = @company_id
            `, {
                period: parsed.period,
                company_id: row.company_id,
                organization_id: row.organization_id,
                auditor_org_id: row.auditor_org_id,
                is_billable: billable ? 1 : 0,
                modules_enabled: JSON.stringify(modules),
                metrics_json: JSON.stringify(metrics),
            });
        } else {
            await query(`
                INSERT INTO billing_snapshots (
                    period_yyyy_mm, organization_id, company_id, auditor_org_id,
                    is_billable, modules_enabled, metrics_json, created_at
                )
                VALUES (
                    @period, @organization_id, @company_id, @auditor_org_id,
                    @is_billable, @modules_enabled, @metrics_json, GETDATE()
                )
            `, {
                period: parsed.period,
                organization_id: row.organization_id,
                company_id: row.company_id,
                auditor_org_id: row.auditor_org_id,
                is_billable: billable ? 1 : 0,
                modules_enabled: JSON.stringify(modules),
                metrics_json: JSON.stringify(metrics),
            });
            inserted += 1;
        }
    }
    return { period: parsed.period, inserted, total: (companies.recordset || []).length };
}

async function getExportCsvRows(periodYyyyMm) {
    const parsed = parsePeriodYyyyMm(periodYyyyMm);
    if (!parsed) throw new Error('Periodo non valido (YYYY-MM)');

    let rows = await query(`
        SELECT
            bs.period_yyyy_mm,
            o.organization_name,
            o.vat_number,
            ao.name AS studio_name,
            c.name AS company_name,
            bs.is_billable,
            bs.modules_enabled,
            bs.metrics_json,
            cb.monthly_fee_cents,
            cb.billing_plan
        FROM billing_snapshots bs
        INNER JOIN organizations o ON o.organization_id = bs.organization_id
        INNER JOIN auditor_orgs ao ON ao.id = bs.auditor_org_id
        INNER JOIN companies c ON c.id = bs.company_id
        LEFT JOIN company_billing cb ON cb.company_id = bs.company_id
        WHERE bs.period_yyyy_mm = @period
        ORDER BY o.organization_name, ao.name, c.name
    `, { period: parsed.period });

    if (!rows.recordset.length) {
        await generateSnapshotForPeriod(parsed.period);
        rows = await query(`
            SELECT
                bs.period_yyyy_mm,
                o.organization_name,
                o.vat_number,
                ao.name AS studio_name,
                c.name AS company_name,
                bs.is_billable,
                bs.modules_enabled,
                bs.metrics_json,
                cb.monthly_fee_cents,
                cb.billing_plan
            FROM billing_snapshots bs
            INNER JOIN organizations o ON o.organization_id = bs.organization_id
            INNER JOIN auditor_orgs ao ON ao.id = bs.auditor_org_id
            INNER JOIN companies c ON c.id = bs.company_id
            LEFT JOIN company_billing cb ON cb.company_id = bs.company_id
            WHERE bs.period_yyyy_mm = @period
            ORDER BY o.organization_name, ao.name, c.name
        `, { period: parsed.period });
    }

    return rows.recordset || [];
}

function rowsToCsv(rows) {
    const header = [
        'period',
        'organization',
        'vat_number',
        'studio',
        'company',
        'is_billable',
        'billing_plan',
        'monthly_fee_cents',
        'modules_enabled',
        'ai_usage_count',
    ];
    const escape = (v) => {
        const s = v == null ? '' : String(v);
        if (s.includes('"') || s.includes(',') || s.includes('\n')) {
            return `"${s.replace(/"/g, '""')}"`;
        }
        return s;
    };

    const lines = [header.join(',')];
    for (const row of rows) {
        let aiUsage = '';
        try {
            const m = row.metrics_json ? JSON.parse(row.metrics_json) : {};
            aiUsage = m.ai_usage_count ?? '';
        } catch (_) { /* ignore */ }

        lines.push([
            row.period_yyyy_mm,
            row.organization_name,
            row.vat_number || '',
            row.studio_name,
            row.company_name,
            row.is_billable ? '1' : '0',
            row.billing_plan || 'base',
            row.monthly_fee_cents ?? '',
            row.modules_enabled || '',
            aiUsage,
        ].map(escape).join(','));
    }
    return lines.join('\r\n');
}

module.exports = {
    BILLING_STATUSES,
    isBillable,
    currentPeriodYyyyMm,
    logBillingEvent,
    onCompanyCreated,
    syncCompanyActiveStatus,
    onLicensesUpdated,
    getBillingOverview,
    getBillingCompanies,
    getBillingEvents,
    generateSnapshotForPeriod,
    getExportCsvRows,
    rowsToCsv,
};

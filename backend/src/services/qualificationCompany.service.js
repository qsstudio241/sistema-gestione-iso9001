/**
 * Validazioni centralizzate: ogni qualifica appartiene a una sola azienda cliente.
 */
const { query } = require('../config/database');

/**
 * @param {unknown} raw
 * @returns {number|null}
 */
function parseCompanyId(raw) {
    if (raw == null || raw === '') return null;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * @param {number} companyId
 * @param {number} organizationId
 * @returns {Promise<boolean>}
 */
async function companyBelongsToOrg(companyId, organizationId) {
    const r = await query(`
        SELECT c.id
        FROM companies c
        INNER JOIN auditor_orgs ao ON ao.id = c.auditor_org_id
        WHERE c.id = @company_id AND ao.organization_id = @organization_id
    `, { company_id: companyId, organization_id: organizationId });
    return r.recordset.length > 0;
}

/**
 * @param {object} opts
 * @param {number} opts.organizationId
 * @param {unknown} opts.companyId
 * @param {object|null} [opts.existing] — riga DB su update
 * @returns {Promise<{ ok: true, companyId: number }|{ ok: false, status: number, error: string, code: string }>}
 */
async function validateQualificationCompany({ organizationId, companyId, existing = null }) {
    const parsed = parseCompanyId(companyId);
    if (!parsed) {
        return {
            ok: false,
            status: 400,
            error: "L'azienda cliente \u00e8 obbligatoria per ogni qualifica.",
            code: 'COMPANY_REQUIRED',
        };
    }

    const inOrg = await companyBelongsToOrg(parsed, organizationId);
    if (!inOrg) {
        return {
            ok: false,
            status: 400,
            error: "L'azienda selezionata non appartiene all'organizzazione.",
            code: 'COMPANY_NOT_IN_ORG',
        };
    }

    if (existing?.approval_status === 'approvata') {
        const prev = existing.company_id != null ? parseInt(existing.company_id, 10) : null;
        if (prev != null && prev !== parsed) {
            return {
                ok: false,
                status: 400,
                error: 'Non \u00e8 possibile cambiare azienda su una qualifica gi\u00e0 approvata.',
                code: 'COMPANY_LOCKED_APPROVED',
            };
        }
    }

    return { ok: true, companyId: parsed };
}

/**
 * Impedisce lo stesso certificato/PDF su aziende diverse (stesso tenant).
 * @param {object} opts
 * @param {number} opts.organizationId
 * @param {number} opts.companyId
 * @param {string|null|undefined} opts.certificateNumber
 * @param {string|null|undefined} opts.certificateFileUrl
 * @param {string|null|undefined} opts.certificateOriginalUrl
 * @param {number|null} [opts.excludeId]
 */
async function assertNoCrossCompanyDuplicate({
    organizationId,
    companyId,
    certificateNumber,
    certificateFileUrl,
    certificateOriginalUrl,
    excludeId = null,
}) {
    const certNum = certificateNumber?.trim();
    if (certNum) {
        const r = await query(`
            SELECT TOP 1 id, company_id
            FROM qualifications
            WHERE organization_id = @orgId
              AND status <> 'revocata'
              AND certificate_number = @certNum
              AND company_id IS NOT NULL
              AND company_id <> @companyId
              ${excludeId ? 'AND id <> @excludeId' : ''}
        `, {
            orgId: organizationId,
            certNum,
            companyId,
            ...(excludeId ? { excludeId } : {}),
        });
        if (r.recordset.length) {
            return {
                ok: false,
                status: 409,
                error: 'Esiste gi\u00e0 una qualifica con lo stesso numero certificato assegnata a un\'altra azienda.',
                code: 'DUPLICATE_CERT_OTHER_COMPANY',
            };
        }
    }

    const fileUrls = [certificateFileUrl, certificateOriginalUrl]
        .map((u) => (u && String(u).trim()) || null)
        .filter(Boolean);

    for (const fileUrl of fileUrls) {
        const r = await query(`
            SELECT TOP 1 id, company_id
            FROM qualifications
            WHERE organization_id = @orgId
              AND status <> 'revocata'
              AND company_id IS NOT NULL
              AND company_id <> @companyId
              AND (certificate_file_url = @fileUrl OR certificate_original_url = @fileUrl)
              ${excludeId ? 'AND id <> @excludeId' : ''}
        `, {
            orgId: organizationId,
            companyId,
            fileUrl,
            ...(excludeId ? { excludeId } : {}),
        });
        if (r.recordset.length) {
            return {
                ok: false,
                status: 409,
                error: 'Il file certificato \u00e8 gi\u00e0 associato a una qualifica di un\'altra azienda.',
                code: 'DUPLICATE_FILE_OTHER_COMPANY',
            };
        }
    }

    return { ok: true };
}

module.exports = {
    parseCompanyId,
    companyBelongsToOrg,
    validateQualificationCompany,
    assertNoCrossCompanyDuplicate,
};

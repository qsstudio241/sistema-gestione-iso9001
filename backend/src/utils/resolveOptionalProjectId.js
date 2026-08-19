/**
 * project_id opzionale (ISO-6 NC, ISO-7 RDP/NDT): stessa org;
 * se il record ha azienda, la commessa deve essere di quell'azienda.
 *
 * @returns {Promise<{ skip: true } | { value: number|null } | { error: string, code: string, status: number }>}
 */
async function resolveOptionalProjectId(query, { organizationId, projectId, companyId }) {
    if (projectId === undefined) return { skip: true };
    if (projectId === null || projectId === '') return { value: null };
    const id = parseInt(projectId, 10);
    if (!Number.isFinite(id) || id <= 0) {
        return { error: 'project_id non valido', code: 'VALIDATION_ERROR', status: 400 };
    }
    const rows = await query(
        `SELECT id, company_id FROM dbo.projects
         WHERE id = @id AND organization_id = @organization_id`,
        { id, organization_id: organizationId },
    );
    if (!rows.recordset?.length) {
        return {
            error: 'Commessa non trovata in questa organizzazione',
            code: 'PROJECT_NOT_FOUND',
            status: 404,
        };
    }
    const proj = rows.recordset[0];
    if (companyId != null && companyId !== '' && Number(proj.company_id) !== Number(companyId)) {
        return {
            error: 'La commessa non appartiene all\'azienda del documento',
            code: 'PROJECT_COMPANY_MISMATCH',
            status: 400,
        };
    }
    return { value: id };
}

module.exports = { resolveOptionalProjectId };

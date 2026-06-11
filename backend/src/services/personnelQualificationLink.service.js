/**
 * personnelQualificationLink.service.js
 * Risolve il collegamento persona <-> qualifica tramite company_personnel.
 * Usato da renewQualification e commitToQualification per valorizzare personnel_id.
 */
const { getPool } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Cerca in company_personnel il record corrispondente a person_name + company_id (org-scoped).
 * Ritorna personnel_id (integer) o null se non trovato.
 *
 * @param {object} params
 * @param {string} params.person_name
 * @param {number|null} params.company_id
 * @param {number} params.organization_id
 * @returns {Promise<number|null>}
 */
async function resolvePersonnelForQualification({ person_name, company_id, organization_id }) {
    if (!person_name || !organization_id) return null;
    try {
        const pool = await getPool();

        // Costruisce la query: cerca corrispondenza su full_name (o first_name + last_name)
        // in company_personnel, filtrando per company_id se disponibile.
        const r = pool.request()
            .input('orgId', organization_id)
            .input('name',  person_name.trim());

        let sql = `
            SELECT TOP 1 cp.id AS personnel_id
            FROM company_personnel cp
            WHERE cp.organization_id = @orgId
              AND (cp.full_name = @name OR LTRIM(RTRIM(ISNULL(cp.first_name,'') + ' ' + ISNULL(cp.last_name,''))) = @name)
              AND cp.active = 1
        `;

        if (company_id) {
            r.input('compId', parseInt(company_id));
            sql += ' AND cp.company_id = @compId';
        }

        sql += ' ORDER BY cp.id ASC';

        const result = await r.query(sql);
        if (result.recordset.length) {
            return result.recordset[0].personnel_id;
        }
        return null;
    } catch (err) {
        logger.warn('[PersonnelLink] resolvePersonnelForQualification fallita:', err.message);
        return null;
    }
}

module.exports = { resolvePersonnelForQualification };

/**
 * GET /api/v1/search — Ricerca unificata studio/azienda (Fase C1).
 */

const logger = require('../utils/logger');
const { unifiedSearch } = require('../services/unifiedSearch.service');

/**
 * Query params:
 * - q (min 2 char, obbligatorio)
 * - companyId (opzionale, filtro rigido)
 * - entityTypes (array o CSV: non_conformity, document, audit, complaint, risk, qualification)
 * - limit (default 10, max 25 per tipo)
 */
async function globalSearch(req, res) {
    try {
        const { organization_id } = req.user;
        const { q, companyId, entityTypes, limit } = req.query;

        const term = typeof q === 'string' ? q.trim() : '';
        if (term.length < 2) {
            return res.status(400).json({
                success: false,
                error: 'Il parametro q deve contenere almeno 2 caratteri.',
                code: 'VALIDATION_ERROR',
            });
        }

        let parsedCompanyId = null;
        if (companyId !== undefined && companyId !== null && String(companyId).trim() !== '') {
            parsedCompanyId = parseInt(companyId, 10);
            if (Number.isNaN(parsedCompanyId) || parsedCompanyId < 1) {
                return res.status(400).json({
                    success: false,
                    error: 'companyId non valido.',
                    code: 'VALIDATION_ERROR',
                });
            }
        }

        const result = await unifiedSearch({
            organizationId: organization_id,
            reqUser: req.user,
            q: term,
            companyId: parsedCompanyId,
            entityTypes,
            limit,
        });

        res.json({
            success: true,
            ...result,
        });
    } catch (error) {
        logger.error('[SEARCH] globalSearch error:', error);
        res.status(500).json({
            success: false,
            error: 'Errore durante la ricerca.',
            code: 'SEARCH_ERROR',
        });
    }
}

module.exports = {
    globalSearch,
};

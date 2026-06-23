/**
 * Filtro ambito azienda per API albero documentale.
 * Con company_id: mostra nodi di quell'azienda + nodi condivisi (company_id IS NULL).
 * I nodi condivisi (norme, cartelle di sistema) devono essere visibili in qualsiasi
 * vista aziendale: un filtro STRICT company_id = X escluderebbe le norme e le
 * cartelle di sistema che hanno company_id = NULL.
 *
 * ECCEZIONE (decisione di prodotto): il "Patrimonio Studio" (content_scope='studio')
 * NON deve MAI comparire nelle viste di una singola azienda cliente. In passato,
 * dedurre lo scope dal solo company_id IS NULL causava leak: il know-how dello
 * studio appariva nell'albero del cliente. Con l'etichetta esplicita content_scope
 * escludiamo i nodi 'studio' quando e' attivo un filtro azienda. I nodi 'studio'
 * restano visibili SOLO nella vista studio (company_id assente).
 */

/** Esclude i nodi del Patrimonio Studio (content_scope='studio'). */
function studioExclusion(alias) {
    return `(${alias}.content_scope IS NULL OR ${alias}.content_scope <> 'studio')`;
}

/**
 * @param {string[]} conditions
 * @param {Record<string, unknown>} params
 * @param {string} alias - alias tabella (es. dr)
 * @param {number|null|undefined} companyId
 */
function appendCompanyScopeCondition(conditions, params, alias, companyId) {
    const parsed = companyId != null ? parseInt(companyId, 10) : null;
    if (parsed != null && !Number.isNaN(parsed)) {
        conditions.push(`(${alias}.company_id = @company_id OR ${alias}.company_id IS NULL)`);
        // Vista azienda: mai mostrare il Patrimonio Studio.
        conditions.push(studioExclusion(alias));
        params.company_id = parsed;
    }
}

/**
 * Subquery COUNT figli coerente con il filtro ambito.
 * @param {string} parentAlias
 * @param {number|null|undefined} companyId
 */
function childrenCountSubquery(parentAlias, companyId) {
    const parsed = companyId != null ? parseInt(companyId, 10) : null;
    const companyFilter = parsed != null && !Number.isNaN(parsed)
        ? ` AND (sub.company_id = @company_id OR sub.company_id IS NULL) AND ${studioExclusion('sub')}`
        : '';

    return `(SELECT COUNT(*) FROM document_registry sub
        WHERE sub.parent_id = ${parentAlias}.id
          AND ISNULL(sub.status, 'rilasciato') <> 'obsoleto'${companyFilter})`;
}

module.exports = {
    appendCompanyScopeCondition,
    childrenCountSubquery,
};

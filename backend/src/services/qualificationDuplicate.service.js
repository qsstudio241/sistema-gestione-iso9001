/**
 * Criteri di duplicato delle qualifiche, unica fonte per creazione manuale, ingest/staging e rinnovo.
 *
 * Due criteri convivono nel DB:
 *  - applicativo: stesso certificato + azienda + tipo (qualunque persona);
 *  - indice unico filtrato UX_qualif_org_company_cert_person_active (087, riallineato da 176):
 *    organizzazione + azienda + certificato + persona (qualunque tipo), escluse le revocate e le cestinate.
 * Il controllo applicativo li copre entrambi; l'errore dell'indice (race o scritture dirette)
 * viene tradotto nello stesso messaggio, senza esporre nome indice o dati SQL.
 */

const DUPLICATE_INDEX_NAME = 'UX_qualif_org_company_cert_person_active';

const DUPLICATE_QUALIFICATION_MESSAGE =
    'Qualifica duplicata: esiste già una qualifica attiva con lo stesso numero certificato e azienda '
    + '(stesso tipo oppure stessa persona).';

function duplicateCertificateMessage(certificateNumber) {
    return `Duplicato: certificato ${certificateNumber} già presente.`;
}

/**
 * @param {{ query: (sql: string, params: object) => Promise<{recordset?: object[]}> }} db
 * @param {{ organizationId: number, companyId: number, certificateNumber: string,
 *           qualificationType?: string|null, personName?: string|null, excludeId?: number|null }} p
 * @returns {Promise<boolean>}
 */
async function findQualificationDuplicate(db, {
    organizationId, companyId, certificateNumber, qualificationType, personName, excludeId,
}) {
    const certNum = typeof certificateNumber === 'string' ? certificateNumber.trim() : certificateNumber;
    if (!certNum || !companyId) return false;
    const res = await db.query(
        `SELECT COUNT(*) AS cnt FROM qualifications
         WHERE organization_id = @orgId
           AND certificate_number = @certNum
           AND company_id = @compId
           AND deleted_at IS NULL
           AND status <> 'revocata'
           AND (@excludeId IS NULL OR id <> @excludeId)
           AND (qualification_type = @qualType OR person_name = @personName)`,
        {
            orgId: organizationId,
            certNum,
            compId: companyId,
            qualType: qualificationType ?? null,
            personName: personName ?? null,
            excludeId: excludeId ?? null,
        },
    );
    return (res.recordset?.[0]?.cnt || 0) > 0;
}

function poolDb(pool) {
    return {
        query: (sql, params = {}) => {
            const request = pool.request();
            Object.entries(params).forEach(([k, v]) => request.input(k, v));
            return request.query(sql);
        },
    };
}

function isQualificationDuplicateIndexError(err) {
    if (!err) return false;
    const unique = err.number === 2601 || err.number === 2627;
    return unique && String(err.message || '').includes(DUPLICATE_INDEX_NAME);
}

module.exports = {
    DUPLICATE_INDEX_NAME,
    DUPLICATE_QUALIFICATION_MESSAGE,
    duplicateCertificateMessage,
    findQualificationDuplicate,
    isQualificationDuplicateIndexError,
    poolDb,
};

/**
 * Helper SQL/JS per file allegati al registro documenti (tabella attachments).
 */

/** EXISTS: documento con almeno un allegato (qualsiasi revisione). */
function buildHasAnyFileSql(alias = 'dr') {
    return `
    EXISTS (
        SELECT 1
        FROM attachments att
        WHERE att.document_id = ${alias}.id
    )
`;
}

const HAS_ANY_FILE_SQL = buildHasAnyFileSql('dr');

/** OUTER APPLY: file corrente o, in assenza di flag, l'ultimo caricato. */
function buildCurrentFileApplySql(alias = 'dr') {
    return `
    OUTER APPLY (
        SELECT TOP 1
            att.file_name,
            att.created_at AS file_uploaded_at
        FROM attachments att
        WHERE att.document_id = ${alias}.id
        ORDER BY
            CASE WHEN att.is_current_doc_version = 1 THEN 0 ELSE 1 END,
            att.created_at DESC,
            att.attachment_id DESC
    ) cur_file
`;
}

const CURRENT_FILE_APPLY_SQL = buildCurrentFileApplySql('dr');

function parseTruthyQueryFlag(value) {
    if (value === true || value === 1) return true;
    if (value === false || value === 0 || value == null) return false;
    const s = String(value).trim().toLowerCase();
    return s === '1' || s === 'true' || s === 'yes' || s === 'on';
}

function documentRowHasFile(row) {
    if (row == null) return false;
    if (row.has_file === true || row.has_file === 1) return true;
    if (row.has_file === false || row.has_file === 0) return false;
    return Boolean(row.current_file_name);
}

module.exports = {
    buildHasAnyFileSql,
    buildCurrentFileApplySql,
    HAS_ANY_FILE_SQL,
    CURRENT_FILE_APPLY_SQL,
    parseTruthyQueryFlag,
    documentRowHasFile,
};

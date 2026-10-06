/**
 * verifyReprocess.service.js — voci Rielaborazioni di tipo `kind: 'verify'` (sola lettura).
 *
 * Candidato = record `qualifications` con almeno un finding `warn` verificabile prodotto da
 * `verifyQualification(row, { mode: 'db' })`. Il report non cambia alcun valore: nessuna scrittura
 * sui record, nessuna proposta in coda di revisione, nessuna AI, nessun accesso ai PDF su disco.
 * Questo modulo non importa whitelist di scrittura né servizi di ingest.
 */

'use strict';

const { verifyQualification } = require('./verifyEngine');
const { SEVERITY, STATUS, MODE } = require('./findingTypes');
const { loadQualificationsForVerify } = require('./verifyRecordLoader');

/** Stesso tetto per run dell'attuale DEFAULT_RUN_LIMIT delle rielaborazioni (righe mostrate nel report). */
const VERIFY_ITEMS_LIMIT = 100;
/** Massimo di righe richiedibili con `limit` esplicito (il report resta di dimensione ragionevole). */
const VERIFY_ITEMS_MAX = 1000;

function assertVerifyField(fieldDef) {
    if (!fieldDef || fieldDef.kind !== 'verify' || !fieldDef.verifyFamily) {
        throw new Error('Voce non di tipo verify');
    }
}

function isWarnVerificabile(finding) {
    return finding.severity === SEVERITY.WARN && finding.status === STATUS.VERIFICABILE;
}

/**
 * Scansione in sola lettura: verifica ogni record della famiglia e raccoglie i candidati.
 * @returns {Promise<{recordsChecked: number, recordsTruncated: boolean, missingColumns: string[],
 *   candidates: Array<{row: object, warnings: object[]}>,
 *   findingsByCode: Object<string, number>, notVerifiable: {dato_mancante: number, fonte_mancante: number}}>}
 */
async function scanVerifyRecords(fieldDef, { orgId = null } = {}) {
    assertVerifyField(fieldDef);
    const { rows, truncated, missingColumns } = await loadQualificationsForVerify({
        qualTypeLike: fieldDef.qualTypeLike || null,
        orgId,
    });

    const candidates = [];
    const findingsByCode = {};
    const notVerifiable = { dato_mancante: 0, fonte_mancante: 0 };
    let recordsChecked = 0;

    for (const row of rows) {
        const result = verifyQualification(row, { mode: MODE.DB });
        if (result.standard.family !== fieldDef.verifyFamily) continue;
        recordsChecked += 1;

        for (const f of result.findings) {
            if (f.status === STATUS.NON_VERIFICABILE_DATO_MANCANTE) notVerifiable.dato_mancante += 1;
            else if (f.status === STATUS.NON_VERIFICABILE_FONTE_MANCANTE) notVerifiable.fonte_mancante += 1;
        }

        const warnings = result.findings.filter(isWarnVerificabile);
        if (warnings.length === 0) continue;
        for (const w of warnings) findingsByCode[w.code] = (findingsByCode[w.code] || 0) + 1;
        candidates.push({ row, warnings });
    }

    return { recordsChecked, recordsTruncated: truncated, missingColumns, candidates, findingsByCode, notVerifiable };
}

/**
 * Conteggio per il pannello superadmin (stesso formato di `countReprocessCandidates`).
 * @returns {Promise<{total: number, byOrganization: Array<{organization_id: number, count: number}>}>}
 */
async function countVerifyCandidates(fieldDef, { orgId = null } = {}) {
    const { candidates } = await scanVerifyRecords(fieldDef, { orgId });
    const byOrg = new Map();
    for (const { row } of candidates) {
        byOrg.set(row.organization_id, (byOrg.get(row.organization_id) || 0) + 1);
    }
    return {
        total: candidates.length,
        byOrganization: Array.from(byOrg.entries()).map(([organization_id, count]) => ({ organization_id, count })),
    };
}

/**
 * Report di verifica (sola lettura). `items` contiene i record candidati con i soli avvisi `warn`,
 * limitati a `limit` righe; i contatori sono calcolati su tutti i record controllati.
 */
async function runVerifyReport(fieldDef, { orgId = null, limit = VERIFY_ITEMS_LIMIT } = {}) {
    const scan = await scanVerifyRecords(fieldDef, { orgId });
    const cap = Number.isFinite(limit) && limit > 0 ? Math.min(Math.floor(limit), VERIFY_ITEMS_MAX) : VERIFY_ITEMS_LIMIT;
    const shown = scan.candidates.slice(0, cap);

    return {
        success: true,
        kind: 'verify',
        field: fieldDef.key,
        recordsChecked: scan.recordsChecked,
        recordsWithWarnings: scan.candidates.length,
        findingsByCode: scan.findingsByCode,
        notVerifiable: scan.notVerifiable,
        items: shown.map(({ row, warnings }) => ({
            id: row.id,
            organization_id: row.organization_id,
            person_name: row.person_name || null,
            certificate_number: row.certificate_number || null,
            findings: warnings,
        })),
        hasMore: scan.candidates.length > shown.length || scan.recordsTruncated,
        missingColumns: scan.missingColumns,
    };
}

module.exports = {
    VERIFY_ITEMS_LIMIT,
    VERIFY_ITEMS_MAX,
    scanVerifyRecords,
    countVerifyCandidates,
    runVerifyReport,
};

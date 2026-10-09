/**
 * verifyEngine.js — verifyQualification(recordOrFields, { mode }) → VerifyResult.
 *
 * Puro e senza conoscenza delle norme: costruisce la vista, risolve il profilo e
 * delega ai pack del registry (pipeline condivisa `runVerifyPipeline`, usata anche da verifyWpqr). Nessun blocco: i finding sono solo `info`/`warn`.
 * Non restituisce mai un «valore corretto da applicare» (validità prevale).
 */

'use strict';

const {
    FAMILY, SEVERITY, STATUS, TEXT_STATUS, MODE, ENGINE_CODES,
    makeFinding, validateFinding,
} = require('./findingTypes');
const { toRecordView, SOURCE } = require('./qualificationRecordView');
const { isStandardCovered, resolveProfileKey, getRulesForProfile, getDeclaredCodes } = require('./verifyRegistry');
const { ensureDefaultPacks } = require('./registerDefaultPacks');

const ENGINE_VERSION = '1.1.0';
const BACKLOG_REF = 'docs/reference/NORME_MANCANTI_BACKLOG.md';

function engineFinding(partial) {
    return makeFinding({
        family: FAMILY.COMPLETEZZA,
        severity: SEVERITY.INFO,
        ...partial,
        source: { text_status: TEXT_STATUS.ASSENTE, ref: BACKLOG_REF, ...(partial.source || {}) },
    });
}

function ruleErrorFinding(ruleId, detail) {
    return engineFinding({
        code: ENGINE_CODES.RULE_ERROR,
        status: STATUS.NON_VERIFICABILE_DATO_MANCANTE,
        field: 'engine',
        message_it: `Controllo ${ruleId} non eseguibile (errore interno): ${detail}. La verifica degli altri controlli prosegue.`,
    });
}

function sourceMissingFinding(view) {
    const { label, edition, raw } = view.standard;
    const named = label ? `${label}${edition ? `:${edition}` : ''}` : null;
    return engineFinding({
        code: ENGINE_CODES.SOURCE_MISSING,
        status: STATUS.NON_VERIFICABILE_FONTE_MANCANTE,
        field: 'standard_reference',
        read_value: raw,
        source: { norm: label, edition },
        message_it: named
            ? `Norma o edizione non coperta dalla verifica (${named}): fonte normativa non disponibile, controlli non eseguibili.`
            : 'Norma di riferimento non riconosciuta o non coperta dalla verifica: fonte normativa non disponibile, controlli non eseguibili.',
    });
}

function profileUnresolvedFinding(view) {
    return engineFinding({
        code: ENGINE_CODES.PROFILE_UNRESOLVED,
        status: STATUS.NON_VERIFICABILE_DATO_MANCANTE,
        field: 'joint_type',
        read_value: view.joint_type,
        source: { norm: view.standard.label, edition: view.standard.edition },
        message_it: `Tipo di giunto (BW/FW) non leggibile: controlli ${view.standard.label} non eseguibili.`,
    });
}

function runRule(packId, rule, view) {
    let produced;
    try {
        produced = rule.run(view);
    } catch (err) {
        return [ruleErrorFinding(rule.id, (err && err.message) || String(err))];
    }
    if (produced == null) return [];
    if (!Array.isArray(produced)) {
        return [ruleErrorFinding(rule.id, 'la regola non ha restituito un array di finding')];
    }

    const declared = getDeclaredCodes(rule);
    const out = [];
    for (const raw of produced) {
        const finding = makeFinding(raw);
        const { ok, errors } = validateFinding(finding);
        if (!ok) {
            out.push(ruleErrorFinding(rule.id, `finding non valido (${errors.join('; ')})`));
        } else if (!declared.includes(finding.code)) {
            out.push(ruleErrorFinding(rule.id, `codice ${finding.code} non dichiarato dalla regola (pack ${packId})`));
        } else {
            out.push(finding);
        }
    }
    return out;
}

function sortFindings(findings) {
    const sevRank = { [SEVERITY.WARN]: 0, [SEVERITY.INFO]: 1 };
    const famRank = { [FAMILY.COMPLETEZZA]: 0, [FAMILY.CORRETTEZZA]: 1 };
    return findings
        .map((finding, index) => ({ finding, index }))
        .sort((a, b) => (sevRank[a.finding.severity] - sevRank[b.finding.severity])
            || (famRank[a.finding.family] - famRank[b.finding.family])
            || (a.index - b.index))
        .map((x) => x.finding);
}

function summarize(findings) {
    const summary = { warn: 0, info: 0, verificabili: 0, non_verificabili: 0 };
    for (const f of findings) {
        summary[f.severity] += 1;
        if (f.status === STATUS.VERIFICABILE) summary.verificabili += 1;
        else summary.non_verificabili += 1;
    }
    return summary;
}

const DOMAIN = Object.freeze({ QUALIFICATION: 'qualification', WPQR: 'wpqr' });

function resolveMode(mode) {
    return Object.values(MODE).includes(mode) ? mode : MODE.REVIEW;
}

/**
 * Pipeline condivisa (indipendente dal dominio): copertura standard → profilo → regole del
 * registry → ordinamento → summary. La vista è già costruita dal dominio e deve esporre
 * `standard {family, edition, label, raw}`, `profile` e `joint_type`.
 * `earlyFindings(view)` (opzionale) può restituire un array di finding che chiude subito la verifica
 * (es. dato di contesto del dominio che impedisce di scegliere la norma): `profile` resta `null`.
 */
function runVerifyPipeline(view, { mode, domain, earlyFindings } = {}) {
    const safeMode = resolveMode(mode);
    const standard = { family: view.standard.family, edition: view.standard.edition };

    let profile = null;
    let findings = typeof earlyFindings === 'function' ? earlyFindings(view) : null;
    if (!findings) {
        if (!isStandardCovered(view.standard)) {
            findings = [sourceMissingFinding(view)];
        } else {
            profile = resolveProfileKey(view);
            if (!profile) {
                findings = [profileUnresolvedFinding(view)];
            } else {
                findings = getRulesForProfile(profile)
                    .flatMap(({ packId, rule }) => runRule(packId, rule, view));
            }
        }
    }

    const sorted = sortFindings(findings);
    return {
        profile,
        standard,
        findings: sorted,
        summary: summarize(sorted),
        engine_version: ENGINE_VERSION,
        mode: safeMode,
        domain,
    };
}

/**
 * @param {object} input review-fields dell'ingest o riga DB `qualifications`
 * @param {{mode?: 'ingest'|'review'|'db'}} [opts]
 */
function verifyQualification(input, { mode = MODE.REVIEW } = {}) {
    ensureDefaultPacks();
    const safeMode = resolveMode(mode);
    const view = toRecordView(input, { source: safeMode === MODE.DB ? SOURCE.DB : SOURCE.REVIEW });
    return runVerifyPipeline(view, { mode: safeMode, domain: DOMAIN.QUALIFICATION });
}

module.exports = {
    verifyQualification, runVerifyPipeline, engineFinding, resolveMode, DOMAIN, ENGINE_VERSION,
};

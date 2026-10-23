/**
 * Regole di discrepanza WPQR. Modulo puro, estendibile: WPS e qualifiche
 * saldatore registreranno il proprio valutatore accanto a questo.
 * Nessun if di dominio nel controller. Nessuna soglia inventata: se l'edizione
 * non è in libreria l'avviso dice che la conformità non si può verificare.
 */

'use strict';

const crypto = require('crypto');
const texts = require('../../content/discrepancyNoticeTexts');
const { ensureDefaultPacks } = require('../qualificationVerify/registerDefaultPacks');
const { toWpqrView, SOURCE } = require('../qualificationVerify/wpqrRecordView');
const { isStandardCovered, listRulePacks } = require('../qualificationVerify/verifyRegistry');

const DOMAIN = 'wpqr';

const CODES = Object.freeze({
    CODE_CERT: 'WPQR.CODE_CERT_MISMATCH',
    FILLER: 'WPQR.FILLER_COVER_INNER',
    MATERIAL: 'WPQR.MATERIAL_GROUP_RANGE',
    FILLET: 'WPQR.FILLET_RANGE_INCOMPLETE',
    EDITION: 'WPQR.EDITION_NOT_IN_LIBRARY',
    KEYS: 'WPQR.KEY_FIELDS_EMPTY',
});

function blank(v) {
    return v == null || (typeof v === 'string' && v.trim() === '');
}

function text(v) {
    if (blank(v)) return '';
    return String(v).trim();
}

function fingerprint(code, parts) {
    return crypto.createHash('sha256').update(JSON.stringify([code, parts])).digest('hex');
}

function notice(code, field, message, parts) {
    return {
        code,
        domain: DOMAIN,
        field,
        message_it: message,
        fingerprint: fingerprint(code, parts),
        status: 'aperto',
        blocks_conformity: true,
    };
}

function compactId(v) {
    return text(v).toUpperCase().replace(/[\s._]/g, '');
}

function foldO0(v) {
    return compactId(v).replace(/O/g, '0');
}

function codeValue(record) {
    return text(record.wpqr_code) || text(record.reference_number) || text(record.wpqr_number);
}

function certificateValue(record) {
    return text(record.certificate_number);
}

function enteLabel(record) {
    return text(record.examiner_body) || text(record.testing_body) || text(record.issuing_body);
}

/**
 * Differenza solo lettera O / zero, a parità di lunghezza.
 * @returns {'cert_o'|'code_o'|'mixed'|null}
 */
function oZeroKind(code, cert) {
    const a = compactId(code);
    const b = compactId(cert);
    if (!a || !b || a === b || a.length !== b.length || foldO0(code) !== foldO0(cert)) return null;
    let certO = false;
    let codeO = false;
    for (let i = 0; i < a.length; i += 1) {
        if (a[i] === b[i]) continue;
        const pair = `${a[i]}${b[i]}`;
        if (pair !== '0O' && pair !== 'O0') return null;
        if (a[i] === 'O') codeO = true;
        if (b[i] === 'O') certO = true;
    }
    if (certO && !codeO) return 'cert_o';
    if (codeO && !certO) return 'code_o';
    return 'mixed';
}

function codeCertNotice(record) {
    const code = codeValue(record);
    const cert = certificateValue(record);
    if (!code || !cert || compactId(code) === compactId(cert)) return null;
    const ente = enteLabel(record);
    const dove = ente ? `Sul certificato ${ente}` : 'Sul certificato';
    const kind = oZeroKind(code, cert);
    const message = texts.codeCertMessage({ kind, dove, cert, code });
    return notice(CODES.CODE_CERT, 'certificate_number', message, { code, cert });
}

function fillerKey(value) {
    const s = text(value).toUpperCase().replace(/\s+/g, '');
    if (!s) return null;
    const withLetter = s.match(/(\d{5})-?([AB])\b/);
    if (withLetter) return `${withLetter[1]}-${withLetter[2]}`;
    const num = s.match(/(\d{5})/);
    if (num) return num[1];
    return s.replace(/[^A-Z0-9]/g, '') || null;
}

function innerFillers(record, runs) {
    const list = [];
    const push = (v) => {
        const raw = text(v);
        if (raw) list.push(raw);
    };
    push(record.filler_designation);
    push(record.filler_material_inner);
    for (const run of runs || []) {
        if (!run) continue;
        push(run.filler_designation);
        push(run.filler_material);
    }
    return list;
}

function fillerNotice(record, runs) {
    const cover = text(record.filler_material);
    const coverKey = fillerKey(cover);
    if (!coverKey) return null;
    const inners = innerFillers(record, runs);
    const different = inners.filter((raw) => {
        const key = fillerKey(raw);
        return key && key !== coverKey;
    });
    if (!different.length) return null;
    const inner = different[0];
    const extra = different.length > 1 ? ' (e altre designazioni diverse nelle pagine interne)' : '';
    const message = texts.fillerMessage({ cover, inner, extra });
    return notice(CODES.FILLER, 'filler_material', message, { cover, inner });
}

function subgroupToken(raw) {
    const s = text(raw).replace(',', '.');
    if (!s) return null;
    let m = s.match(/^(\d{1,2})\.(\d)$/);
    if (m) return { group: m[1], sub: m[2] };
    m = s.match(/^(\d{1,2})-(\d)$/);
    if (m) return { group: m[1], sub: m[2] };
    m = s.match(/^(\d{1,2})$/);
    if (m) return { group: m[1], sub: null };
    return null;
}

function tokenOrder(token) {
    if (!token) return null;
    const g = Number(token.group);
    const sub = token.sub == null ? 0 : Number(token.sub);
    return (g * 10) + sub;
}

function parseValidity(raw) {
    const s = text(raw);
    if (!s) return null;
    // «1-1» è il sottogruppo 1.1 (trattino al posto del punto), non un intervallo.
    // L'intervallo si riconosce solo se i due estremi hanno il punto (1.1-1.2) o una parola (to).
    const dotted = s.match(/^(\d{1,2}\.\d)\s*[-–\u2013]\s*(\d{1,2}\.\d)$/);
    if (dotted) {
        const from = subgroupToken(dotted[1]);
        const to = subgroupToken(dotted[2]);
        if (from && to) return { kind: 'range', raw: s, from, to };
    }
    const bits = s.split(/\s*(?:\u2013|\u2014|\/|\bto\b)\s*/i).map((t) => t.trim()).filter(Boolean);
    if (bits.length === 2) {
        const from = subgroupToken(bits[0]);
        const to = subgroupToken(bits[1]);
        if (from && to) return { kind: 'range', raw: s, from, to };
    }
    const one = subgroupToken(s);
    if (one) return { kind: 'single', raw: s, token: one };
    return { kind: 'unreadable', raw: s };
}

function validityRaw(record) {
    const direct = text(record.material_group_range) || text(record.qualified_material_group);
    if (direct) return direct;
    const blob = `${text(record.notes)}\n${text(record.other_test_info)}`;
    const m = blob.match(/validit[àa]\s*(?:gruppi|materiale|materiali)?\s*[:\s]\s*([0-9][0-9.\-\/\u2013 ]{0,40})/i);
    return m ? m[1].trim() : '';
}

function testGroup(record) {
    return text(record.base_material_group) || text(record.material_group);
}

function groupIncluded(test, validity) {
    const t = subgroupToken(test);
    if (!t || !validity || validity.kind === 'unreadable') return null;
    if (validity.kind === 'single') {
        const v = validity.token;
        if (v.sub == null) return t.group === v.group;
        if (t.sub == null) return false;
        return t.group === v.group && t.sub === v.sub;
    }
    const orders = [tokenOrder(validity.from), tokenOrder(validity.to), tokenOrder(t)].map(Number);
    if (orders.some((n) => !Number.isFinite(n))) return null;
    const lo = Math.min(tokenOrder(validity.from), tokenOrder(validity.to));
    const hi = Math.max(tokenOrder(validity.from), tokenOrder(validity.to));
    const cur = tokenOrder(t);
    if (t.sub == null) return false;
    return cur >= lo && cur <= hi;
}

function materialNotice(record) {
    const test = testGroup(record);
    const raw = validityRaw(record);
    if (!test || !raw) return null;
    const validity = parseValidity(raw);
    const inside = groupIncluded(test, validity);
    if (inside === true) return null;
    const message = texts.materialMessage({ inside, test, raw });
    return notice(CODES.MATERIAL, 'material_group_range', message, { test, raw });
}

function isFillet(record) {
    const j = text(record.joint_type).toUpperCase();
    return j === 'FW' || j.includes('FW') || j.includes('ANGOLO');
}

function filletQuote(record) {
    const direct = text(record.certificate_fillet_range) || text(record.fillet_range_read);
    if (direct) return direct.replace(/\s*mm\s*$/i, '').trim();
    const blob = `${text(record.other_test_info)}\n${text(record.notes)}`;
    const m = blob.match(/(?:angolo|gola|fillet|throat)[^\d]{0,40}(\d+(?:[.,]\d+)?)\s*[-–\u2013]\s*(\d+(?:[.,]\d+)?)/i);
    if (!m) return '';
    return `${m[1].replace(',', '.')}-${m[2].replace(',', '.')}`;
}

function filletStructured(record) {
    if (!blank(record.fillet_throat_range)) return true;
    if (record.throat_range_min != null && record.throat_range_min !== '') return true;
    if (record.throat_range_max != null && record.throat_range_max !== '') return true;
    return false;
}

function filletNotice(record) {
    if (!isFillet(record) || filletStructured(record)) return null;
    const quote = filletQuote(record);
    const hasTest = record.throat_test_mm != null && record.throat_test_mm !== '';
    if (!quote && !hasTest) return null;
    const quoted = quote ? ` ${quote} mm` : '';
    const message = texts.filletMessage(quoted);
    return notice(CODES.FILLET, 'fillet_throat_range', message, { quote: quote || null, joint: text(record.joint_type) });
}

function libraryEditions(family) {
    const set = [];
    for (const pack of listRulePacks()) {
        if (!family || pack.standardFamily !== family) continue;
        for (const edition of pack.editions || []) {
            if (!set.includes(edition)) set.push(edition);
        }
    }
    return set;
}

function editionNotice(record) {
    const raw = text(record.standard_reference) || text(record.standard_ref);
    if (!raw) return null;
    ensureDefaultPacks();
    let view;
    try {
        view = toWpqrView(record, { source: SOURCE.REVIEW, runs: [] });
    } catch (err) {
        return notice(
            CODES.EDITION,
            'standard_reference',
            texts.editionUnreadableMessage(raw),
            { raw, error: err.message },
        );
    }
    const standard = view.standard || {};
    if (isStandardCovered(standard) && standard.edition) return null;
    const covered = libraryEditions(standard.family);
    const coveredText = covered.length
        ? ` Le regole in libreria coprono ${standard.label || 'questa norma'} ${covered.join(', ')}.`
        : '';
    const message = texts.editionMessage({ raw, coveredText });
    return notice(CODES.EDITION, 'standard_reference', message, { raw, edition: standard.edition || null });
}

function keyFieldsNotice(record) {
    const missing = [];
    if (!enteLabel(record)) missing.push('ente emittente');
    if (!codeValue(record)) missing.push('codice WPQR');
    if (!certificateValue(record)) missing.push('numero certificato');
    if (!text(record.welding_process)) missing.push('processo di saldatura');
    if (!text(record.standard_reference) && !text(record.standard_ref)) missing.push('norma di riferimento');
    if (!missing.length) return null;
    const onlyEnte = missing.length === 1 && missing[0] === 'ente emittente';
    const message = texts.keyFieldsMessage({ onlyEnte, missing });
    return notice(CODES.KEYS, missing[0] === 'ente emittente' ? 'testing_body' : 'wpqr_code', message, { missing });
}

function evaluateWpqrNotices(record, context = {}) {
    const row = record && typeof record === 'object' ? record : {};
    const runs = Array.isArray(context.runs) ? context.runs : (Array.isArray(row.test_runs) ? row.test_runs : []);
    const page = texts.knownPdfPage(row);
    const out = [];
    for (const item of [
        codeCertNotice(row),
        fillerNotice(row, runs),
        materialNotice(row),
        filletNotice(row),
        editionNotice(row),
        keyFieldsNotice(row),
    ]) {
        if (!item) continue;
        const raw = row[item.field];
        out.push({
            ...item,
            message_it: texts.withPdfPage(item.message_it, page),
            pdf_page: page,
            current_value: raw == null ? '' : String(raw),
        });
    }
    return out;
}

module.exports = {
    DOMAIN,
    CODES,
    evaluateWpqrNotices,
    codeCertNotice,
    fillerNotice,
    materialNotice,
    filletNotice,
    editionNotice,
    keyFieldsNotice,
};

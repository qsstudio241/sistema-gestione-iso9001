'use strict';

/**
 * wpsGenerator.service.js — generazione deterministica bozza WPS da WPQR (P0).
 * Vincoli numerici/gruppo: ISO 15614-1 Tabella 5 + range spessore dichiarati.
 * Nessuna chiamata AI, nessuna scrittura DB in P0.
 */

const {
    isParentMaterialCombinationCovered,
    resolveSteelGradeToGroup,
    computeQualifiedMaterialThicknessRangeLevel2,
    computeQualifiedFilletThroatThicknessRange,
    isDiameterEssentialVariable,
    describePlateCoversPipeDiameterLevel2,
} = require('../data/weldingQualificationRules15614');
const {
    describePlateCoversPipeDiameter15614_2,
    isIso15614Part2,
} = require('../data/weldingQualificationRules15614_2');
const {
    isIso14555,
    describeQualifiedParentThicknessRange14555,
} = require('../data/weldingQualificationRules14555');

/** Lazy require: evita process.exit in unit test senza database.json. */
function getDbQuery() {
    // eslint-disable-next-line global-require
    return require('../config/database').query;
}

/**
 * Carica WPQR nello scope org (+ company opzionale, pattern Ambito).
 * @param {number} organizationId
 * @param {number|null} companyId
 * @returns {Promise<object[]>}
 */
async function loadWpqrRecords(organizationId, companyId = null) {
    const query = getDbQuery();
    const params = { organization_id: Number(organizationId) };
    let sql = `
        SELECT wq.*
        FROM wpqr_records wq
        LEFT JOIN welding_procedures w ON w.id = wq.wps_id
        WHERE wq.organization_id = @organization_id
    `;
    if (companyId != null && companyId !== '') {
        sql += ` AND (wq.company_id = @company_id OR (wq.company_id IS NULL AND w.company_id = @company_id))`;
        params.company_id = Number(companyId);
    }
    sql += ' ORDER BY wq.id DESC';
    const result = await query(sql, params);
    return result.recordset || [];
}

/**
 * Risolve grado commerciale o codice gruppo → codice 15608.
 * @param {string} value
 * @param {string[]} warnings
 */
function resolveParentGroup(value, warnings) {
    const r = resolveSteelGradeToGroup(value);
    if (r.warning) warnings.push(r.warning);
    return r.group;
}

/**
 * Match tipo giunto: se WPQR non espone joint_type → non escludere (warning).
 * @param {object} wpqr
 * @param {string} requested
 * @param {string[]} warnings
 * @returns {boolean} true se compatibile
 */
function jointTypeCompatible(wpqr, requested, warnings) {
    const req = String(requested || '').trim().toUpperCase();
    if (!req) return true;

    const raw = wpqr.joint_type != null ? String(wpqr.joint_type).trim() : '';
    if (!raw) {
        warnings.push(
            `WPQR ${wpqr.wpqr_code || wpqr.id}: tipo giunto non dichiarato — non esclusa automaticamente`
        );
        return true;
    }
    const up = raw.toUpperCase();
    // Accetta "FW", "BW+FW", "BW / FW", ecc.
    if (up.includes(req)) return true;
    return false;
}

/**
 * Preferisce thickness_min/max dichiarati; con t1+t2 presenti usa i range duali
 * (Mason 25/08/2026). Fallback Tabella 7 Level 2 / hint gola come prima.
 *
 * Gap analysis 07/08/2026 (WPQR VB0377/23): thickness_max_unlimited non va
 * sovrascritto da un massimo calcolato Tabella 7 BW.
 *
 * @returns {{ ok: boolean, partial: boolean, reason?: string, range?: object }}
 */
function isTruthyBit(v) {
    return v === true || v === 1 || v === '1' || v === 'true';
}

function parseRangeSide(minRaw, maxRaw, unlimitedRaw) {
    const min = minRaw != null && minRaw !== '' ? Number(minRaw) : null;
    const max = maxRaw != null && maxRaw !== '' ? Number(maxRaw) : null;
    const unlimited = isTruthyBit(unlimitedRaw);
    const has = Number.isFinite(min) || Number.isFinite(max) || unlimited;
    return {
        has,
        min: Number.isFinite(min) ? min : null,
        max: unlimited ? null : (Number.isFinite(max) ? max : null),
        unlimited,
    };
}

function thicknessInDeclaredRange(t, side) {
    if (!side || !side.has) return false;
    if (side.min != null && t < side.min) return false;
    if (!side.unlimited && side.max != null && t > side.max) return false;
    // Range aperto solo-min oppure solo-max illimitato: ok se supera i vincoli sopra.
    if (side.min == null && side.max == null && !side.unlimited) return false;
    return true;
}

function formatSide(side) {
    if (!side || !side.has) return '?';
    const lo = side.min != null ? side.min : '?';
    const hi = side.unlimited ? '∞' : (side.max != null ? side.max : '?');
    return `${lo}-${hi}`;
}

/**
 * Copertura spessore genitori.
 * Gap Mason 25/08/2026 (WPQR-T1T2): i giunti FW con spessori diversi dichiarano
 * due range (t1 e t2). Se entrambi sono presenti sul WPQR, ciascuno dei due
 * spessori di produzione deve rientrare in un range (orientamento A↔t1/B↔t2
 * oppure scambio). Altrimenti si usa il range singolo legacy thickness_min/max.
 */
function checkThicknessCoverage(wpqr, thicknessA, thicknessB) {
    const tA = Number(thicknessA);
    const tB = Number(thicknessB);
    if (!Number.isFinite(tA) || !Number.isFinite(tB) || tA <= 0 || tB <= 0) {
        return { ok: false, partial: false, reason: 'Spessori richiesti non validi' };
    }

    const t1 = parseRangeSide(wpqr.thickness_t1_min, wpqr.thickness_t1_max, wpqr.thickness_t1_max_unlimited);
    const t2 = parseRangeSide(wpqr.thickness_t2_min, wpqr.thickness_t2_max, wpqr.thickness_t2_max_unlimited);

    if (t1.has && t2.has) {
        const orientOk = thicknessInDeclaredRange(tA, t1) && thicknessInDeclaredRange(tB, t2);
        const swappedOk = thicknessInDeclaredRange(tA, t2) && thicknessInDeclaredRange(tB, t1);
        if (orientOk || swappedOk) {
            return {
                ok: true,
                partial: false,
                reason: `Spessori ${tA}/${tB} mm entro range duali t1[${formatSide(t1)}] / t2[${formatSide(t2)}] mm (dichiarati)`,
                range: { min: t1.min, max: t1.max, t1, t2 },
            };
        }
        return {
            ok: false,
            partial: false,
            reason: `Spessore fuori range duali WPQR ${wpqr.wpqr_code || wpqr.id}: richiesti ${tA} e ${tB} mm, t1[${formatSide(t1)}] / t2[${formatSide(t2)}] mm`,
            range: { min: t1.min, max: t1.max, t1, t2 },
        };
    }

    let min = wpqr.thickness_min != null && wpqr.thickness_min !== ''
        ? Number(wpqr.thickness_min) : null;
    let max = wpqr.thickness_max != null && wpqr.thickness_max !== ''
        ? Number(wpqr.thickness_max) : null;
    const maxUnlimited = isTruthyBit(wpqr.thickness_max_unlimited);
    let partial = false;
    let source = maxUnlimited ? 'dichiarato (range aperto, senza limite superiore)' : 'dichiarato';

    if (!Number.isFinite(min) || (!Number.isFinite(max) && !maxUnlimited)) {
        // STUD-3-B: ISO 14555 §10.2.8.6 — tutti gli spessori se pWPS applicabile.
        // Non calcolare Tabella 7 15614 su WPQR stud 14555.
        if (isIso14555(wpqr.standard_reference)) {
            const range14555 = describeQualifiedParentThicknessRange14555({ pWpsApplies: true });
            if (range14555.allThicknesses) {
                return {
                    ok: true,
                    partial: true,
                    reason: `Spessori ok su range ISO 14555 §10.2.8.6 (tutti gli spessori se pWPS applicabile)`,
                    range: { min: null, max: null, allThicknesses: true },
                };
            }
            return {
                ok: false,
                partial: false,
                reason: `WPQR ${wpqr.wpqr_code || wpqr.id}: ISO 14555 ma pWPS non applicabile — range spessore non automatico`,
            };
        }

        const tested = wpqr.thickness_tested != null
            ? Number(wpqr.thickness_tested)
            : null;
        const level2 = Number.isFinite(tested)
            ? computeQualifiedMaterialThicknessRangeLevel2({ testThicknessMm: tested })
            : null;
        if (level2) {
            min = Number.isFinite(min) ? min : level2.minMm;
            // Il massimo calcolato (Tabella 7 BW) non sostituisce MAI un range aperto dichiarato.
            max = maxUnlimited ? null : level2.maxMm;
            partial = true;
            source = maxUnlimited
                ? 'min calcolato Level 2 (Tabella 7) da thickness_tested, max dichiarato illimitato'
                : 'calcolato Level 2 (Tabella 7) da thickness_tested';
        } else if (maxUnlimited && Number.isFinite(min)) {
            // min già dichiarato, max illimitato dichiarato: nessun calcolo necessario.
            source = 'dichiarato (range aperto, senza limite superiore)';
        } else {
            // Fallback informativo gola FW — non usarlo come range materiale base vincente
            const fillet = Number.isFinite(tested)
                ? computeQualifiedFilletThroatThicknessRange({ testThicknessMm: tested })
                : null;
            if (fillet && fillet.maxMm != null) {
                return {
                    ok: false,
                    partial: true,
                    reason: `WPQR ${wpqr.wpqr_code || wpqr.id}: range spessore materiale assente; solo hint gola Tabella 8 [${fillet.minMm}-${fillet.maxMm}] mm — non sufficiente per copertura genitori`,
                    range: { min: fillet.minMm, max: fillet.maxMm },
                };
            }
            return {
                ok: false,
                partial: false,
                reason: `WPQR ${wpqr.wpqr_code || wpqr.id}: range spessore (thickness_min/max) assente e non calcolabile`,
            };
        }
    }

    const inRange = (t) => t >= min && (max == null || t <= max);
    if (inRange(tA) && inRange(tB)) {
        return {
            ok: true,
            partial,
            reason: partial
                ? `Spessori ok su range ${source}`
                : `Spessori ${tA}/${tB} mm entro ${min}-${max == null ? '∞' : max} mm (${source})`,
            range: { min, max },
        };
    }

    return {
        ok: false,
        partial,
        reason: `Spessore fuori range WPQR ${wpqr.wpqr_code || wpqr.id}: richiesti ${tA} e ${tB} mm, range ${min}-${max == null ? '∞' : max} mm (${source})`,
        range: { min, max },
    };
}

/**
 * Copertura diametro tubo (ISO 15614-1 Tabella 9, §8.3.3 — vedi
 * docs/reference/ISO-15614-1-range-validita-WPQR.md). Gap analysis 07/08/2026:
 * `diameter_min`/`diameter_max` erano acquisiti dall'ingest ma mai usati qui —
 * un giunto su tubo poteva essere "coperto" da una WPQR con diametro dichiarato
 * incompatibile, perché il diametro non veniva mai verificato.
 *
 * Applicata SOLO se il chiamante richiede esplicitamente un diametro (giunto su
 * tubo) — un giunto su piastra non deve mai essere filtrato per diametro.
 *
 * Regole:
 * - Level 1: il diametro NON è variabile essenziale (qualsiasi forma prodotto
 *   qualifica tutte le forme) — sempre coperto, nessuna verifica necessaria.
 * - Level 2 (o livello non dichiarato — la norma indica Level 2 come default
 *   contrattuale quando non specificato, §8.1): il diametro È variabile
 *   essenziale. Si usa il range dichiarato sul WPQR (`diameter_min`/`diameter_max`,
 *   stesso pattern di `thickness_min`/`thickness_max` — valore dichiarato sul
 *   verbale, non ricalcolato). Se non dichiarato, la copertura non è verificabile
 *   automaticamente: fail-closed (richiede verifica manuale), mai fail-open.
 *
 * @returns {{ ok: boolean, applicable: boolean, reason?: string, range?: {min:number|null,max:number|null} }}
 */
function checkDiameterCoverage(wpqr, requiredDiameterMm) {
    if (requiredDiameterMm == null || requiredDiameterMm === '') {
        return { ok: true, applicable: false };
    }
    const d = Number(requiredDiameterMm);
    if (!Number.isFinite(d) || d <= 0) {
        return { ok: false, applicable: true, reason: 'Diametro tubo richiesto non valido' };
    }

    if (!isDiameterEssentialVariable(wpqr.qualification_level || '2')) {
        return {
            ok: true,
            applicable: true,
            reason: `WPQR ${wpqr.wpqr_code || wpqr.id}: Level 1 — diametro non variabile essenziale (ISO 15614-1 §8.3.3)`,
        };
    }

    const min = wpqr.diameter_min != null && wpqr.diameter_min !== '' ? Number(wpqr.diameter_min) : null;
    const max = wpqr.diameter_max != null && wpqr.diameter_max !== '' ? Number(wpqr.diameter_max) : null;

    if (min == null && max == null) {
        // Regola "piastra copre tubo" (ISO 15614-1 §8.3.3, testo integrale — gap
        // analysis 08/08/2026): se il provino è stato testato su PIASTRA, non c'è
        // (e non deve esserci) un diametro dichiarato — ma la norma qualifica
        // automaticamente tubi di diametro >500mm, o >150mm se saldato in
        // posizione PC, oppure PF/PA con tubo esplicitamente dichiarato ruotato.
        const isPlate = (() => {
            const pt = String(wpqr.product_type || '').trim().toUpperCase();
            // STUD-1: P+T include copertura piastra → regola §8.3.3 resta applicabile
            // se manca un diametro numerico dichiarato (lato tubo ancora da dichiarare).
            return pt === 'P' || pt === 'P+T';
        })();
        if (isPlate) {
            const rotated = wpqr.rotated_position === true || wpqr.rotated_position === 1 || wpqr.rotated_position === '1';
            const plateRule = isIso15614Part2(wpqr.standard_reference)
                ? describePlateCoversPipeDiameter15614_2({
                    weldingPositions: wpqr.welding_positions,
                    rotatedPosition: rotated,
                })
                : describePlateCoversPipeDiameterLevel2({
                    weldingPositions: wpqr.welding_positions,
                    rotatedPosition: rotated,
                });
            if (d > plateRule.minMm) {
                return {
                    ok: true,
                    applicable: true,
                    reason: `Diametro ${d} mm coperto dalla regola piastra→tubo (>${plateRule.minMm} mm — ${plateRule.note})`,
                    range: { min: plateRule.minMm, max: null },
                };
            }
            return {
                ok: false,
                applicable: true,
                reason: `WPQR ${wpqr.wpqr_code || wpqr.id}: testata su piastra, copre tubo solo >${plateRule.minMm} mm (${plateRule.note}) — richiesti ${d} mm`,
                range: { min: plateRule.minMm, max: null },
            };
        }
        return {
            ok: false,
            applicable: true,
            reason: `WPQR ${wpqr.wpqr_code || wpqr.id}: diametro tubo non dichiarato (Level 2, variabile essenziale ISO 15614-1 Tabella 9) — copertura non verificabile automaticamente`,
        };
    }

    const inRange = d >= (min ?? 0) && (max == null || d <= max);
    if (inRange) {
        return {
            ok: true,
            applicable: true,
            reason: `Diametro ${d} mm entro ${min ?? 0}-${max == null ? '∞' : max} mm dichiarato sul WPQR`,
            range: { min, max },
        };
    }
    return {
        ok: false,
        applicable: true,
        reason: `Diametro fuori range WPQR ${wpqr.wpqr_code || wpqr.id}: richiesto ${d} mm, range dichiarato ${min ?? 0}-${max == null ? '∞' : max} mm`,
        range: { min, max },
    };
}

/**
 * Copertura gola (throat) per giunti d'angolo (ISO 15614-1 Tabella 8, §8.3.2.2 —
 * vedi docs/reference/ISO-15614-1-range-validita-WPQR.md). Chiude la seconda metà
 * del gap analysis 07/08/2026 (GAP_WPQR_ESTENSIONI_ANNEX_B, item 1): la WPQR ora
 * estrae `throat_test_mm` (valore dichiarato del provino), ma la Tabella 8 nella
 * norma ha in realtà DUE formule in direzioni opposte:
 *   (a) spessore materiale provino t -> range gola qualificato (questa funzione,
 *       usa `wpqr.thickness_tested`, stessa formula già usata come hint in
 *       checkThicknessCoverage);
 *   (b) gola nominale provino "a" -> range spessore materiale qualificato
 *       (0,75a-1,5a per mono-passata, nessuna restrizione per multi-passata) —
 *       userebbe `throat_test_mm`, NON ancora implementata qui: è un affinamento
 *       del controllo spessore materiale, non del controllo gola, e viene
 *       lasciata come backlog per non mescolare due controlli diversi nello
 *       stesso fix (vedi nota in fondo al gap report).
 *
 * Applicata SOLO se il chiamante richiede esplicitamente una gola (giunto FW —
 * per giunti BW il concetto di gola non si applica) E il WPQR è di tipo FW.
 *
 * @returns {{ ok: boolean, applicable: boolean, reason?: string, range?: {min:number|null,max:number|null} }}
 */
function checkThroatCoverage(wpqr, requiredThroatMm) {
    if (requiredThroatMm == null || requiredThroatMm === '') {
        return { ok: true, applicable: false };
    }
    const a = Number(requiredThroatMm);
    if (!Number.isFinite(a) || a <= 0) {
        return { ok: false, applicable: true, reason: 'Gola richiesta non valida' };
    }

    const isFillet = String(wpqr.joint_type || '').trim().toUpperCase().includes('FW');
    if (!isFillet) {
        return {
            ok: false,
            applicable: true,
            reason: `WPQR ${wpqr.wpqr_code || wpqr.id}: non è un giunto FW — la gola non è una variabile qualificata su questo tipo di giunto`,
        };
    }

    const tested = wpqr.thickness_tested != null ? Number(wpqr.thickness_tested) : null;
    if (!Number.isFinite(tested)) {
        return {
            ok: false,
            applicable: true,
            reason: `WPQR ${wpqr.wpqr_code || wpqr.id}: spessore provino testato non dichiarato — range gola (Tabella 8) non calcolabile`,
        };
    }

    const range = computeQualifiedFilletThroatThicknessRange({ testThicknessMm: tested });
    if (!range) {
        return {
            ok: false,
            applicable: true,
            reason: `WPQR ${wpqr.wpqr_code || wpqr.id}: spessore provino non valido per il calcolo del range gola`,
        };
    }

    const inRange = a >= range.minMm && (range.maxMm == null || a <= range.maxMm);
    const rangeLabel = `${range.minMm}-${range.maxMm == null ? '∞' : range.maxMm} mm`;
    if (inRange) {
        return {
            ok: true,
            applicable: true,
            reason: `Gola ${a} mm entro ${rangeLabel} qualificati (Tabella 8, da spessore provino ${tested} mm)`,
            range: { min: range.minMm, max: range.maxMm },
        };
    }
    return {
        ok: false,
        applicable: true,
        reason: `Gola fuori range WPQR ${wpqr.wpqr_code || wpqr.id}: richiesta ${a} mm, range qualificato ${rangeLabel} (Tabella 8, da spessore provino ${tested} mm)`,
        range: { min: range.minMm, max: range.maxMm },
    };
}

/**
 * Bozza WPS minima allineata a welding_procedures / 15609.
 */
function buildWpsDraft(wpqr, request, groupA, groupB) {
    const thicknesses = [Number(request.thickness_a_mm), Number(request.thickness_b_mm)]
        .filter((n) => Number.isFinite(n));
    const tMin = thicknesses.length ? Math.min(...thicknesses) : null;
    const tMax = thicknesses.length ? Math.max(...thicknesses) : null;

    return {
        welding_process: request.welding_process || wpqr.welding_process || null,
        material_group: groupA === groupB ? groupA : `${groupA}+${groupB}`,
        parent_material_a: request.parent_material_a || null,
        parent_material_b: request.parent_material_b || null,
        joint_type: request.joint_type || wpqr.joint_type || null,
        thickness_range_min: wpqr.thickness_min != null ? Number(wpqr.thickness_min) : tMin,
        // null = nessun limite superiore dichiarato sul WPQR (gap analysis 07/08/2026) —
        // non sostituire con tMax quando il range è esplicitamente aperto.
        thickness_range_max: (wpqr.thickness_max_unlimited === true || wpqr.thickness_max_unlimited === 1 || wpqr.thickness_max_unlimited === '1')
            ? null
            : (wpqr.thickness_max != null ? Number(wpqr.thickness_max) : tMax),
        thickness_a_mm: request.thickness_a_mm != null ? Number(request.thickness_a_mm) : null,
        thickness_b_mm: request.thickness_b_mm != null ? Number(request.thickness_b_mm) : null,
        pipe_diameter_mm: request.pipe_diameter_mm != null ? Number(request.pipe_diameter_mm) : null,
        throat_mm: request.throat_mm != null ? Number(request.throat_mm) : null,
        qualification_standard: wpqr.standard_reference || 'ISO 15614-1',
        wpqr_ref: wpqr.wpqr_code || null,
        wpqr_id: wpqr.id != null ? wpqr.id : null,
        filler_material: wpqr.filler_material || null,
        shielding_gas: wpqr.shielding_gas || null,
        welding_positions: wpqr.welding_positions || null,
        status: 'bozza',
    };
}

/**
 * Campi minimi per confrontare un giunto con le WPQR (ISO 15614).
 * Se incompleti → status need_input + domande all'utente (AI orchestra, non indovina).
 *
 * @param {object} request
 * @returns {{
 *   complete: boolean,
 *   questions: Array<{ field: string, question: string }>,
 *   resolved?: { jointType: string, groupA: string, groupB: string, thicknessA: number, thicknessB: number },
 *   warnings: string[]
 * }}
 */
function assessJointCoverageInputs(request = {}) {
    const warnings = [];
    const questions = [];

    const jointRaw = String(request.joint_type || '').trim();
    const jointType = jointRaw.toUpperCase();
    if (!jointType) {
        questions.push({
            field: 'joint_type',
            question: 'Qual è il tipo di giunto? (es. FW angolo o BW testa)',
        });
    }

    const matA = String(request.parent_material_a || '').trim();
    const matB = String(request.parent_material_b || '').trim();
    if (!matA) {
        questions.push({
            field: 'parent_material_a',
            question: 'Qual è il materiale / grado del primo pezzo (A)? (es. S355 oppure gruppo 1.2)',
        });
    }
    if (!matB) {
        questions.push({
            field: 'parent_material_b',
            question: 'Qual è il materiale / grado del secondo pezzo (B)? (es. S235 oppure gruppo 1.1)',
        });
    }

    const tAraw = request.thickness_a_mm;
    const tBraw = request.thickness_b_mm;
    const tA = tAraw === '' || tAraw == null ? NaN : Number(tAraw);
    const tB = tBraw === '' || tBraw == null ? NaN : Number(tBraw);
    if (!Number.isFinite(tA) || tA <= 0) {
        questions.push({
            field: 'thickness_a_mm',
            question: 'Qual è lo spessore del pezzo A in mm?',
        });
    }
    if (!Number.isFinite(tB) || tB <= 0) {
        questions.push({
            field: 'thickness_b_mm',
            question: 'Qual è lo spessore del pezzo B in mm?',
        });
    }

    // Materiali presenti ma non mappabili → chiedere chiarimento (non chiudere come "estensione mancante")
    let groupA = null;
    let groupB = null;
    if (matA) {
        groupA = resolveParentGroup(matA, warnings);
        if (!groupA) {
            questions.push({
                field: 'parent_material_a',
                question: `Non riconosco il materiale A «${matA}»: indica un grado noto (es. S355) o il gruppo ISO/TR 15608 (es. 1.2)`,
            });
        }
    }
    if (matB) {
        groupB = resolveParentGroup(matB, warnings);
        if (!groupB) {
            questions.push({
                field: 'parent_material_b',
                question: `Non riconosco il materiale B «${matB}»: indica un grado noto (es. S235) o il gruppo ISO/TR 15608 (es. 1.1)`,
            });
        }
    }

    if (questions.length > 0) {
        return { complete: false, questions, warnings };
    }

    return {
        complete: true,
        questions: [],
        warnings,
        resolved: {
            jointType,
            groupA,
            groupB,
            thicknessA: tA,
            thicknessB: tB,
        },
    };
}

function needInputResult(questions, warnings = []) {
    return {
        status: 'need_input',
        wpqr_used: null,
        candidates: [],
        wps_draft: null,
        extensions_needed: [],
        questions,
        warnings,
    };
}

/**
 * @param {object} params
 * @param {number} params.organizationId
 * @param {number|null} [params.companyId]
 * @param {object} params.request
 * @param {object[]} [params.wpqrRecords]
 * @returns {Promise<{
 *   status: 'ok'|'partial'|'not_possible'|'need_input',
 *   wpqr_used: object|null,
 *   candidates: object[],
 *   wps_draft: object|null,
 *   extensions_needed: string[],
 *   questions?: Array<{ field: string, question: string }>,
 *   warnings: string[]
 * }>}
 */
async function generateWpsFromWpqr(params = {}) {
    const {
        organizationId,
        companyId = null,
        request = {},
        wpqrRecords: injectedRecords,
    } = params;

    const assessed = assessJointCoverageInputs(request);
    if (!assessed.complete) {
        return needInputResult(assessed.questions, assessed.warnings);
    }

    const warnings = [...assessed.warnings];
    const extensionsNeeded = [];
    const { jointType, groupA, groupB } = assessed.resolved;
    // Normalizza request spessori numerici per buildWpsDraft / thickness check
    const normalizedRequest = {
        ...request,
        joint_type: jointType,
        thickness_a_mm: assessed.resolved.thicknessA,
        thickness_b_mm: assessed.resolved.thicknessB,
    };

    let records = injectedRecords;
    if (records == null) {
        if (organizationId == null) {
            return {
                status: 'not_possible',
                wpqr_used: null,
                candidates: [],
                wps_draft: null,
                extensions_needed: ['organizationId obbligatorio se non si passano wpqrRecords'],
                questions: [],
                warnings,
            };
        }
        records = await loadWpqrRecords(organizationId, companyId);
    }

    if (!Array.isArray(records) || records.length === 0) {
        return {
            status: 'not_possible',
            wpqr_used: null,
            candidates: [],
            wps_draft: null,
            extensions_needed: ['Registro WPQR vuoto: nessuna procedura qualificata disponibile per l\'ambito'],
            questions: [],
            warnings,
        };
    }

    const processFilter = request.welding_process
        ? String(request.welding_process).trim()
        : null;

    const candidates = [];
    const materialFailures = [];
    const thicknessFailures = [];
    const diameterFailures = [];
    const throatFailures = [];
    const processFailures = [];
    const jointFailures = [];

    for (const wpqr of records) {
        const localWarnings = [];

        if (processFilter) {
            const proc = wpqr.welding_process != null ? String(wpqr.welding_process).trim() : '';
            if (proc && proc !== processFilter) {
                processFailures.push(
                    `WPQR ${wpqr.wpqr_code || wpqr.id}: processo ${proc} ≠ ${processFilter}`
                );
                continue;
            }
            if (!proc) {
                localWarnings.push(
                    `WPQR ${wpqr.wpqr_code || wpqr.id}: processo non dichiarato — non esclusa`
                );
            }
        }

        if (!jointTypeCompatible(wpqr, jointType, localWarnings)) {
            jointFailures.push(
                `WPQR ${wpqr.wpqr_code || wpqr.id}: tipo giunto ${wpqr.joint_type} non copre ${jointType}`
            );
            continue;
        }

        const testedGroup = wpqr.base_material_group || wpqr.material_group || null;
        const mat = isParentMaterialCombinationCovered({
            materialGroupTested: testedGroup,
            parentGroupA: groupA,
            parentGroupB: groupB,
        });
        if (!mat.covered) {
            materialFailures.push(
                `WPQR ${wpqr.wpqr_code || wpqr.id}: ${mat.reason}`
            );
            continue;
        }

        const th = checkThicknessCoverage(
            wpqr,
            normalizedRequest.thickness_a_mm,
            normalizedRequest.thickness_b_mm
        );
        if (!th.ok) {
            thicknessFailures.push(th.reason || 'Spessore fuori range');
            continue;
        }

        const dia = checkDiameterCoverage(wpqr, normalizedRequest.pipe_diameter_mm);
        if (!dia.ok) {
            diameterFailures.push(dia.reason || 'Diametro fuori range');
            continue;
        }
        // Solo il caso Level 1 (non variabile essenziale) è informativo/degno di
        // nota — un match esplicito su range dichiarato non è un "caveat".
        if (dia.applicable && dia.reason && dia.reason.includes('Level 1')) {
            localWarnings.push(dia.reason);
        }

        const throat = checkThroatCoverage(wpqr, normalizedRequest.throat_mm);
        if (!throat.ok) {
            throatFailures.push(throat.reason || 'Gola fuori range');
            continue;
        }

        candidates.push({
            wpqr,
            material: mat,
            thickness: th,
            diameter: dia,
            throat,
            warnings: localWarnings,
            score: (th.partial ? 1 : 2) + (localWarnings.length ? 0 : 1),
        });
        warnings.push(...localWarnings);
    }

    if (candidates.length === 0) {
        if (materialFailures.length === records.length || materialFailures.length > 0) {
            extensionsNeeded.push(
                `Nessuna WPQR copre il gruppo materiale ${groupA}–${groupB}`
            );
        }
        if (thicknessFailures.length > 0) {
            extensionsNeeded.push(...thicknessFailures.slice(0, 3));
        }
        if (diameterFailures.length > 0) {
            extensionsNeeded.push(...diameterFailures.slice(0, 3));
        }
        if (throatFailures.length > 0) {
            extensionsNeeded.push(...throatFailures.slice(0, 3));
        }
        if (processFailures.length > 0 && candidates.length === 0) {
            extensionsNeeded.push(
                `Nessuna WPQR con processo ${processFilter}`
            );
        }
        if (jointFailures.length > 0) {
            extensionsNeeded.push(
                `Nessuna WPQR con tipo giunto compatibile ${jointType}`
            );
        }
        if (extensionsNeeded.length === 0) {
            extensionsNeeded.push('Nessuna WPQR compatibile con i parametri richiesti');
        }
        const unique = [...new Set(extensionsNeeded)];
        return {
            status: 'not_possible',
            wpqr_used: null,
            candidates: [],
            wps_draft: null,
            extensions_needed: unique,
            questions: [],
            warnings,
        };
    }

    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0];
    const draft = buildWpsDraft(best.wpqr, normalizedRequest, groupA, groupB);
    const status = best.thickness.partial || best.warnings.length > 0 ? 'partial' : 'ok';
    if (best.thickness.partial) {
        warnings.push(
            `Range spessore su WPQR ${best.wpqr.wpqr_code || best.wpqr.id} calcolato (non dichiarato): verificare sul verbale`
        );
    }

    return {
        status,
        wpqr_used: best.wpqr,
        candidates: candidates.map((c) => ({
            id: c.wpqr.id,
            wpqr_code: c.wpqr.wpqr_code,
            base_material_group: c.wpqr.base_material_group,
            joint_type: c.wpqr.joint_type,
            thickness_min: c.wpqr.thickness_min,
            thickness_max: c.wpqr.thickness_max,
            thickness_max_unlimited: c.wpqr.thickness_max_unlimited === true || c.wpqr.thickness_max_unlimited === 1 || c.wpqr.thickness_max_unlimited === '1',
            diameter_min: c.wpqr.diameter_min,
            diameter_max: c.wpqr.diameter_max,
            material_reason: c.material.reason,
            thickness_reason: c.thickness.reason,
            diameter_reason: c.diameter && c.diameter.applicable ? c.diameter.reason : null,
            throat_reason: c.throat && c.throat.applicable ? c.throat.reason : null,
        })),
        wps_draft: draft,
        extensions_needed: [],
        questions: [],
        warnings,
    };
}

module.exports = {
    generateWpsFromWpqr,
    assessJointCoverageInputs,
    loadWpqrRecords,
    checkThicknessCoverage,
    checkDiameterCoverage,
    checkThroatCoverage,
    jointTypeCompatible,
    buildWpsDraft,
};

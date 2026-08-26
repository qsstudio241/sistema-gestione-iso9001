/**
 * wpqrIngest.service.js
 * Ingestion automatica WPQR da PDF — pipeline IG-2 + staging IG-3.
 */

const path = require('path');
const logger = require('../utils/logger');
const { query } = require('../config/database');
const { runDocumentIngest } = require('./documentIngestPipeline.service');
const {
    classifyDocument,
    WRONG_MODULE_FOR_WPQR,
    WRONG_MODULE_MESSAGES,
    SUGGESTED_MODULE,
} = require('../utils/documentClassifier');
const {
    checkDateOrder,
    checkNumericRangeOrder,
    checkFillerMaterial14341Plausibility,
    checkShieldingGasKnown,
    checkThicknessRangeAgainstIso15614Level2,
    checkFilletThicknessRangeNeedsManualVerification,
} = require('../utils/ingestPlausibilityChecks');
const { toNumericOrNull } = require('../utils/numericSanitizer');
const { normalizeJointTypeCode } = require('../utils/textEncodingRepair');

/**
 * Hint stud/prigioniero (STUD-2). Non usare `\bstud\b` da solo: eviterebbe
 * "study" ma resterebbe ambiguo; qui solo formule di saldatura prigionieri.
 * Non calcola range ISO 14555.
 */
const STUD_WELD_HINT_RE = /\b(?:stud\s*weld(?:ing)?|arc\s*stud|drawn[\s-]?arc\s*stud|iso\s*14555|saldatura\s+prigionier|prigionier[oi]|joint\s*type\s*[:.]?\s*sw)\b/i;

function looksLikeStudWelding(text) {
    if (text == null || text === '') return false;
    return STUD_WELD_HINT_RE.test(String(text));
}

const KNOWN_WPQR_JOINT_TYPES = new Set(['BW', 'FW', 'BW+FW', 'SW']);

/**
 * Normalizza joint_type WPQR: sinonimi stud/prigioniero → SW.
 * Non collassa stud in FW. BW / BW+FW restano invariati anche se il PDF
 * cita 14555 in una lista norme. Valori non riconosciuti restano originali
 * (round-trip sentinella / revisione umana).
 */
function normalizeWpqrJointType(val, extraText) {
    if ((val == null || val === '') && (extraText == null || extraText === '')) return null;
    const fromCode = val != null && val !== '' ? (normalizeJointTypeCode(val) || null) : null;
    const known = fromCode && KNOWN_WPQR_JOINT_TYPES.has(fromCode) ? fromCode : null;
    if (known === 'SW') return 'SW';
    if (known === 'BW' || known === 'BW+FW') return known;
    const blob = [val, extraText].filter((x) => x != null && x !== '').join(' ');
    if (looksLikeStudWelding(blob)) return 'SW';
    if (known) return known;
    if (val != null && String(val).trim()) return String(val).trim();
    return null;
}

/**
 * Normalizza product_type: P | T | P+T. "entrambi" / plate+pipe → P+T.
 * Non inferisce P+T da uno stud cilindrico (quello e' SW + diametro prigioniero).
 */
function normalizeWpqrProductType(val) {
    if (val == null || val === '') return null;
    const s = String(val).trim().toUpperCase().replace(/\s+/g, ' ');
    if (!s) return null;
    if (s === 'P+T' || s === 'P/T') return 'P+T';
    if (/\bP\s*\+\s*T\b/.test(s) || /\bP\s+AND\s+T\b/.test(s) || /\bP\s*\/\s*T\b/.test(s)) return 'P+T';
    if (/ENTRAMB/.test(s) || (/\bBOTH\b/.test(s) && !/\bSTUD\b/.test(s))) return 'P+T';
    if (/PIASTRA\s*E\s*TUBO|PLATE\s+AND\s+PIPE|PIPE\s+AND\s+PLATE|TUBE\s+AND\s+PLATE|PIASTRA\s*\+\s*TUBO/.test(s)) {
        return 'P+T';
    }
    if (s === 'P' || /^(PIASTRA|PLATE|SHEET)$/.test(s)) return 'P';
    if (s === 'T' || /^(TUBO|TUBE|PIPE)$/.test(s)) return 'T';
    const hasPlate = /\bPIASTRA\b/.test(s) || /\bPLATE\b/.test(s);
    const hasTube = /\bTUBO\b/.test(s) || /\bPIPE\b/.test(s) || /\bTUBE\b/.test(s);
    if (hasPlate && hasTube) return 'P+T';
    if (hasPlate && !hasTube) return 'P';
    if (hasTube && !hasPlate) return 'T';
    if (['P', 'T', 'P+T'].includes(s)) return s;
    return String(val).trim();
}

/**
 * Diametro prigioniero dichiarato (D1 / D₁), solo se un numero e' sul verbale.
 * Non calcola range 14555.
 */
function extractStudDiameterFromText(text) {
    if (!text) return null;
    const t = String(text);
    const m = t.match(/\bD\s*[1₁I]\s*[=:]\s*(\d+(?:[.,]\d+)?)/i)
        || t.match(/diametro\s+prigionier[oaie]*\s*[=:]?\s*(\d+(?:[.,]\d+)?)/i)
        || t.match(/stud\s*(?:diameter|ø|Ø)\s*[=:]?\s*(\d+(?:[.,]\d+)?)/i);
    return m ? toNumericOrNull(m[1]) : null;
}

/**
 * Controlli di plausibilità/coerenza normativa sui campi estratti (warning-only,
 * mai bloccanti — vedi ingestPlausibilityChecks.js). Gap analysis WPQR 26/07/2026:
 * prima di questa funzione l'estrazione non verificava mai la coerenza dei dati
 * col documento originale (solo duplicato/campo obbligatorio mancante).
 * @param {object} f - reviewFields (mapPipelineFieldsToReview)
 * @returns {string[]}
 */
function checkWpqrPlausibility(f) {
    const warnings = [];
    const dateWarn = checkDateOrder({
        laterDate: f.expiry_date,
        earlierDate: f.approval_date,
        laterLabel: 'Data di scadenza',
        earlierLabel: 'Data di emissione',
    });
    if (dateWarn) warnings.push(dateWarn);

    const thicknessWarn = checkNumericRangeOrder({
        min: f.thickness_min, max: f.thickness_max, label: 'spessore',
    });
    if (thicknessWarn) warnings.push(thicknessWarn);

    const diameterWarn = checkNumericRangeOrder({
        min: f.diameter_min, max: f.diameter_max, label: 'diametro',
    });
    if (diameterWarn) warnings.push(diameterWarn);

    const fillerWarn = checkFillerMaterial14341Plausibility(f.filler_material);
    if (fillerWarn) warnings.push(fillerWarn);

    const gasWarn = checkShieldingGasKnown(f.shielding_gas);
    if (gasWarn) warnings.push(gasWarn);

    const thicknessVsNormWarn = checkThicknessRangeAgainstIso15614Level2({
        thicknessTestMm: f.thickness_test_mm, thicknessMin: f.thickness_min, thicknessMax: f.thickness_max,
        qualificationLevel: f.qualification_level,
    });
    if (thicknessVsNormWarn) warnings.push(thicknessVsNormWarn);

    const filletThicknessWarn = checkFilletThicknessRangeNeedsManualVerification({
        jointType: f.joint_type,
        thicknessMin: f.thickness_min,
        thicknessMax: f.thickness_max,
        thicknessMaxUnlimited: f.thickness_max_unlimited,
    });
    if (filletThicknessWarn) warnings.push(filletThicknessWarn);

    return warnings;
}

// NOTA (TODO consolidamento — non forzato in questo giro, gap analysis 07/08/2026):
// questa formula è duplicata e DISALLINEATA rispetto alla funzione "canonica"
// computeQualifiedMaterialThicknessRangeLevel2 (weldingQualificationRules15614.js,
// Tabella 7 Level 2, bande 3-40mm confermate da doppia estrazione PDF). Esempio
// concreto: per t=30mm questa formula dà [15, 60], la canonica dà [15, 33]. La
// canonica però ritorna null fuori dalle bande 3-40mm (GAP dichiarato), quindi
// sostituirla qui cambierebbe il comportamento anche per WPQR BW già in
// produzione fuori da quelle bande — consolidamento rimandato a una slice
// dedicata con verifica di regressione, non incluso nel fix minimo t1/t2 FW.
function calcThicknessRange(t) {
    if (!t || t <= 0) return { thickness_min: null, thickness_max: null };
    const tNum = parseFloat(t);
    let minT;
    let maxT;
    if (tNum <= 3) {
        minT = tNum;
        maxT = 2 * tNum;
    } else if (tNum <= 12) {
        minT = 3;
        maxT = 2 * tNum;
    } else {
        minT = Math.max(0.5 * tNum, 5);
        maxT = Math.min(2 * tNum, 200);
    }
    return {
        thickness_min: parseFloat(minT.toFixed(2)),
        thickness_max: parseFloat(maxT.toFixed(2)),
    };
}

/**
 * Risolve il range spessore materiale base (min/max) per un WPQR, gestendo
 * correttamente i range aperti "senza limite superiore" e i giunti FW.
 *
 * Gap analysis 07/08/2026 (WPQR reale VB0377/23 "ADA", cliente Mason, giunto
 * ad angolo/fillet S355J2): il verbale dichiara "Fillet Weld: t1 = >=5 ; t2 =>
 * 5" — range aperto, nessun limite superiore. Prima di questo fix, un
 * `thickness_max` nullo (sia perché non estratto, sia perché dichiarato come
 * illimitato) veniva SEMPRE sostituito da `calcThicknessRange` (formula
 * generica calibrata sulla Tabella 7 BW), producendo per questo caso un
 * massimo errato di 60mm invece del reale "illimitato" — rischio di rifiutare
 * come "fuori range" giunti FW di produzione oltre i 60mm, in realtà coperti.
 *
 * Regole:
 * - `thickness_max_unlimited === true` (dichiarato esplicitamente sul
 *   verbale) → `thickness_max` resta `null` (= illimitato) e NON viene mai
 *   sostituito dal calcolo.
 * - `joint_type` contiene "FW" (fillet/angolo) → il fallback calcolato non
 *   viene MAI applicato (la Tabella 7 riguarda solo giunti BW; per FW il
 *   range materiale t1/t2 segue una regola diversa, non riproducibile con la
 *   stessa formula) — se il valore non è dichiarato resta `null` (verrà
 *   segnalato con un warning, vedi `checkFilletThicknessRangeNeedsManualVerification`).
 * - Altrimenti (giunto BW, nessun flag illimitato): comportamento invariato,
 *   fallback calcolato da `calcThicknessRange` solo per i valori assenti.
 *
 * @param {object} f - oggetto con thickness_test_mm/thickness_tested, thickness_min,
 *   thickness_max, thickness_max_unlimited, joint_type
 * @returns {{ thickness_min: number|null, thickness_max: number|null, thickness_max_unlimited: boolean }}
 */
function resolveThicknessRange(f) {
    const thicknessRaw = f.thickness_test_mm ?? f.thickness_tested;
    const thickness_tested = toNumericOrNull(thicknessRaw);
    const thicknessMinSan = toNumericOrNull(f.thickness_min);
    const thicknessMaxSan = toNumericOrNull(f.thickness_max);
    const thicknessMaxUnlimited = f.thickness_max_unlimited === true
        || f.thickness_max_unlimited === 1
        || f.thickness_max_unlimited === '1'
        || f.thickness_max_unlimited === 'true';
    const isFillet = (() => {
        const jtNorm = normalizeWpqrJointType(f.joint_type);
        const jt = String(jtNorm || '').trim().toUpperCase();
        // SW (stud) ≠ FW, ma non usare formule Tabella 7 BW: lascia dichiarato o null.
        return jt.includes('FW') || jt === 'SW';
    })();

    if (thicknessMaxUnlimited) {
        return { thickness_min: thicknessMinSan, thickness_max: null, thickness_max_unlimited: true };
    }

    if (thicknessMinSan != null && thicknessMaxSan != null) {
        return { thickness_min: thicknessMinSan, thickness_max: thicknessMaxSan, thickness_max_unlimited: false };
    }

    if (isFillet) {
        // Nessun fallback calcolato per FW — meglio null + warning che un numero probabilmente sbagliato.
        return { thickness_min: thicknessMinSan, thickness_max: thicknessMaxSan, thickness_max_unlimited: false };
    }

    const { thickness_min: calcMin, thickness_max: calcMax } = calcThicknessRange(thickness_tested);
    return {
        thickness_min: thicknessMinSan != null ? thicknessMinSan : calcMin,
        thickness_max: thicknessMaxSan != null ? thicknessMaxSan : calcMax,
        thickness_max_unlimited: false,
    };
}

function toUnlimitedBit(v) {
    return v === true || v === 1 || v === '1' || v === 'true';
}

/**
 * Estrae i range duali t1/t2 se dichiarati; altrimenti null.
 * Se entrambi presenti e thickness_min/max legacy assenti, popola anche il
 * legacy da t1 (retrocompatibilità liste/UI) senza perdere i due range.
 */
function resolveDualThicknessSides(f) {
    const t1Min = toNumericOrNull(f.thickness_t1_min);
    const t1Max = toNumericOrNull(f.thickness_t1_max);
    const t1Unlimited = toUnlimitedBit(f.thickness_t1_max_unlimited);
    const t2Min = toNumericOrNull(f.thickness_t2_min);
    const t2Max = toNumericOrNull(f.thickness_t2_max);
    const t2Unlimited = toUnlimitedBit(f.thickness_t2_max_unlimited);

    const hasT1 = t1Min != null || t1Max != null || t1Unlimited;
    const hasT2 = t2Min != null || t2Max != null || t2Unlimited;

    return {
        thickness_t1_min: hasT1 ? t1Min : null,
        thickness_t1_max: hasT1 && !t1Unlimited ? t1Max : null,
        thickness_t1_max_unlimited: hasT1 && t1Unlimited,
        thickness_t2_min: hasT2 ? t2Min : null,
        thickness_t2_max: hasT2 && !t2Unlimited ? t2Max : null,
        thickness_t2_max_unlimited: hasT2 && t2Unlimited,
        hasDual: hasT1 && hasT2,
    };
}

async function checkDuplicate(referenceNumber, organizationId, companyId) {
    if (!referenceNumber) return false;
    const result = await query(`
        SELECT id FROM wpqr_records
        WHERE organization_id = @organizationId
          AND company_id = @companyId
          AND (reference_number = @ref OR wpqr_code = @ref)
    `, { organizationId, companyId: companyId || null, ref: referenceNumber });
    return result.recordset.length > 0;
}

function buildCertificateFileUrl(filePath) {
    if (!filePath) return null;
    const uploadBase = process.env.UPLOAD_DIR
        ? path.resolve(process.env.UPLOAD_DIR)
        : path.resolve(__dirname, '../../uploads');
    return '/uploads/' + path.relative(uploadBase, filePath).replace(/\\/g, '/');
}

/** Serializza un array di posizioni/testo in stringa NVARCHAR (es. "PA, PB"). */
function normalizePositions(positions) {
    if (positions == null) return null;
    if (Array.isArray(positions)) return positions.length ? positions.join(', ') : null;
    const s = String(positions).trim();
    return s || null;
}

function mapPipelineFieldsToReview(f, fileName) {
    const referenceNumber = String(
        f.wpqr_number || f.reference_number || f.wpqr_code || fileName.replace(/\.[^/.]+$/, '')
    ).trim();

    const thicknessRaw = f.thickness_test_mm ?? f.thickness_tested;
    // Sanitizzazione numerica (stesso pattern del bug produzione 27/07/2026 su
    // qualificationIngest.service.js/wpsIngest.service.js): "N.A.", stringa vuota,
    // virgola decimale o simboli soglia non devono mai arrivare come stringa
    // grezza a una colonna DECIMAL — vedi numericSanitizer.js.
    const thickness_tested = toNumericOrNull(thicknessRaw);
    // Range spessore: vedi resolveThicknessRange per la gestione di range aperti
    // ("senza limite superiore") e giunti FW (gap analysis 07/08/2026).
    const { thickness_min, thickness_max, thickness_max_unlimited } = resolveThicknessRange(f);
    const dual = resolveDualThicknessSides(f);

    // Retrocompatibilità: se ci sono t1+t2 e manca il range singolo, copia t1
    // sul legacy (le liste UI storiche leggono thickness_min/max).
    let legacyMin = thickness_min;
    let legacyMax = thickness_max;
    let legacyUnlimited = thickness_max_unlimited;
    if (dual.hasDual && legacyMin == null && legacyMax == null && !legacyUnlimited) {
        legacyMin = dual.thickness_t1_min;
        legacyMax = dual.thickness_t1_max;
        legacyUnlimited = dual.thickness_t1_max_unlimited;
    }

    return {
        wpqr_number: referenceNumber,
        reference_number: referenceNumber,
        qualification_level: f.qualification_level || null,
        welding_process: f.welding_process || null,
        material_group: f.material_group || f.base_material_group || null,
        joint_type: normalizeWpqrJointType(f.joint_type),
        // Tipo prodotto testato (piastra/tubo) — gap analysis 08/08/2026: serve a
        // sapere se applicare la regola "piastra copre tubo >500mm (o >150mm in
        // posizione ruotata)" ISO 15614-1 §8.3.3 in wpsGenerator.service.js.
        product_type: normalizeWpqrProductType(f.product_type),
        rotated_position: f.rotated_position === true || f.rotated_position === 1 || f.rotated_position === '1',
        thickness_test_mm: thickness_tested,
        approval_date: f.approval_date || f.issue_date || null,
        standard_reference: f.standard_reference || null,
        filler_material: f.filler_material || null,
        welding_positions: normalizePositions(f.welding_positions),
        examiner_body: f.issuing_body || f.examiner_body || f.testing_body || null,
        welder_name: f.welder_name || null,
        expiry_date: f.expiry_date || null,
        certificate_number: f.certificate_number || null,
        pwht: f.pwht === true || f.pwht === 1 || f.pwht === '1',
        wps_ref: f.wps_ref || null,
        thickness_min: legacyMin,
        thickness_max: legacyMax,
        thickness_max_unlimited: legacyUnlimited,
        thickness_t1_min: dual.thickness_t1_min,
        thickness_t1_max: dual.thickness_t1_max,
        thickness_t1_max_unlimited: dual.thickness_t1_max_unlimited,
        thickness_t2_min: dual.thickness_t2_min,
        thickness_t2_max: dual.thickness_t2_max,
        thickness_t2_max_unlimited: dual.thickness_t2_max_unlimited,
        diameter_min: toNumericOrNull(f.diameter_min),
        diameter_max: toNumericOrNull(f.diameter_max),
        // Gola/throat provino (Tabella 8, giunti FW) — gap analysis 07/08/2026: prima
        // non estratta affatto (solo hint calcolato da thickness_tested, impreciso
        // perché la gola è una variabile distinta dallo spessore materiale base).
        throat_test_mm: toNumericOrNull(f.throat_test_mm),
        base_material_spec: f.base_material_spec || null,
        shielding_gas: f.shielding_gas || null,
        current_type: f.current_type || null,
        metal_transfer: f.metal_transfer || null,
        mechanization: f.mechanization || null,
        single_multi_run: f.single_multi_run || null,
        heat_input_note: f.heat_input_note || null,
        // Gap strutturale 07/08/2026: presenti in fields/aiPrompt/aiExpectedSchema e
        // quindi compilabili in UI, ma mai mappati qui né in mapReviewFieldsToDb —
        // il valore estratto dall'AI veniva scartato prima della revisione umana.
        preheat_temp: f.preheat_temp || null,
        interpass_temp: f.interpass_temp || null,
        // STUD-1: elemento qualificato + Parent Metal 2 (nullable)
        qualifying_element: normalizeQualifyingElement(f.qualifying_element),
        material_group_2: f.material_group_2 || f.base_material_group_2 || null,
        base_material_spec_2: f.base_material_spec_2 || null,
    };
}

function normalizeQualifyingElement(val) {
    if (val == null || val === '') return null;
    const raw = String(val).trim();
    const s = raw.toLowerCase();
    if (['base', 'parent', 'piastra', 'base_metal', 'parent metal 1', 'pm1', 'parent_metal_1'].includes(s)) {
        return 'base';
    }
    if (['stud', 'prigioniero', 'prigionieri', 'pin', 'parent metal 2', 'pm2', 'parent_metal_2'].includes(s)) {
        return 'stud';
    }
    if (['both', 'entrambi', 'all', 'base+stud', 'base + stud'].includes(s)) return 'both';
    if (/prigionier/.test(s) || /\bstud\b/.test(s)) return 'stud';
    if (/\bentramb/.test(s) || /\bboth\b/.test(s)) return 'both';
    if (/\bpiastra\b/.test(s) || /\bparent\s*metal\s*1\b/.test(s)) return 'base';
    return raw;
}

function mapReviewFieldsToDb(f, fileName) {
    const referenceNumber = String(
        f.wpqr_number || f.reference_number || f.wpqr_code || fileName.replace(/\.[^/.]+$/, '')
    ).trim();

    const thicknessRaw = f.thickness_test_mm ?? f.thickness_tested;
    // Sanitizzazione numerica (stesso pattern del bug produzione 27/07/2026 su
    // qualificationIngest.service.js/wpsIngest.service.js): "N.A.", stringa vuota,
    // virgola decimale o simboli soglia non devono mai arrivare come stringa
    // grezza a una colonna DECIMAL — vedi numericSanitizer.js.
    const thickness_tested = toNumericOrNull(thicknessRaw);
    // Range spessore: vedi resolveThicknessRange per la gestione di range aperti
    // ("senza limite superiore") e giunti FW (gap analysis 07/08/2026).
    const { thickness_min, thickness_max, thickness_max_unlimited } = resolveThicknessRange(f);
    const dual = resolveDualThicknessSides(f);

    let legacyMin = thickness_min;
    let legacyMax = thickness_max;
    let legacyUnlimited = thickness_max_unlimited;
    if (dual.hasDual && legacyMin == null && legacyMax == null && !legacyUnlimited) {
        legacyMin = dual.thickness_t1_min;
        legacyMax = dual.thickness_t1_max;
        legacyUnlimited = dual.thickness_t1_max_unlimited;
    }

    return {
        reference_number: referenceNumber,
        qualification_level: f.qualification_level || null,
        welding_process: f.welding_process || null,
        base_material_group: f.material_group || f.base_material_group || null,
        joint_type: normalizeWpqrJointType(f.joint_type),
        product_type: normalizeWpqrProductType(f.product_type),
        rotated_position: f.rotated_position === true || f.rotated_position === 1 || f.rotated_position === '1',
        standard_reference: f.standard_reference || null,
        filler_material: f.filler_material || null,
        thickness_tested,
        thickness_min: legacyMin,
        thickness_max: legacyMax,
        thickness_max_unlimited: legacyUnlimited,
        thickness_t1_min: dual.thickness_t1_min,
        thickness_t1_max: dual.thickness_t1_max,
        thickness_t1_max_unlimited: dual.thickness_t1_max_unlimited,
        thickness_t2_min: dual.thickness_t2_min,
        thickness_t2_max: dual.thickness_t2_max,
        thickness_t2_max_unlimited: dual.thickness_t2_max_unlimited,
        diameter_min: toNumericOrNull(f.diameter_min),
        diameter_max: toNumericOrNull(f.diameter_max),
        throat_test_mm: toNumericOrNull(f.throat_test_mm),
        welding_positions: normalizePositions(f.welding_positions),
        examiner_body: f.examiner_body || f.issuing_body || f.testing_body || null,
        welder_name: f.welder_name || null,
        issue_date: f.approval_date || f.issue_date || null,
        expiry_date: f.expiry_date || null,
        certificate_number: f.certificate_number || null,
        pwht: f.pwht === true || f.pwht === 1 || f.pwht === '1' ? 1 : 0,
        wps_ref: f.wps_ref || null,
        base_material_spec: f.base_material_spec || null,
        shielding_gas: f.shielding_gas || null,
        current_type: f.current_type || null,
        metal_transfer: f.metal_transfer || null,
        mechanization: f.mechanization || null,
        single_multi_run: f.single_multi_run || null,
        heat_input_note: f.heat_input_note || null,
        preheat_temp: f.preheat_temp || null,
        interpass_temp: f.interpass_temp || null,
        qualifying_element: normalizeQualifyingElement(f.qualifying_element),
        base_material_group_2: f.material_group_2 || f.base_material_group_2 || null,
        base_material_spec_2: f.base_material_spec_2 || null,
    };
}

async function extractWPQRFromPdf(pdfBuffer, fileName, organizationId, companyId) {
    const pipeline = await runDocumentIngest({
        pdfBuffer,
        docType: 'wpqr',
        fileName,
        organizationId,
    });
    const warnings = [...pipeline.warnings];
    const reviewFields = mapPipelineFieldsToReview(pipeline.fields || {}, fileName);
    // STUD-2: se l'AI/regole hanno messo FW ma il testo parla di stud/prigioniero,
    // non collassare in FW. BW resta BW (non si sovrascrive un testa a testa).
    reviewFields.joint_type = normalizeWpqrJointType(reviewFields.joint_type, pipeline.text);
    if (reviewFields.joint_type === 'SW' && reviewFields.diameter_min == null) {
        const d1 = extractStudDiameterFromText(pipeline.text);
        if (d1 != null) {
            reviewFields.diameter_min = d1;
            if (reviewFields.diameter_max == null) reviewFields.diameter_max = d1;
        }
    }

    if (pipeline.text.length > 30) {
        const docClass = classifyDocument(pipeline.text);
        logger.info('WPQR doc classification', {
            fileName,
            detected_type: docClass.detected_type,
            confidence: docClass.confidence,
        });

        if (WRONG_MODULE_FOR_WPQR.has(docClass.detected_type) && docClass.confidence !== 'low') {
            return {
                status: 'wrong_module',
                detected_type: docClass.detected_type,
                message: WRONG_MODULE_MESSAGES[docClass.detected_type],
                suggested_module: SUGGESTED_MODULE[docClass.detected_type],
            };
        }

        if (docClass.detected_type === 'unknown') {
            warnings.push('Tipo documento non riconosciuto — verificare i dati estratti');
        } else if ((docClass.detected_type === 'wpqr' || docClass.detected_type === 'wps') && docClass.confidence === 'low') {
            warnings.push('Tipo documento incerto — verificare che sia una WPQR');
        }
    }

    if (!reviewFields.reference_number) {
        warnings.push('Numero WPQR non trovato — inserirlo manualmente in revisione');
    }

    const reviewIsFillet = String(reviewFields.joint_type || '').trim().toUpperCase().includes('FW');
    if (reviewFields.thickness_test_mm && !reviewFields.thickness_min && !reviewIsFillet) {
        // Per giunti FW il range non viene calcolato per design (vedi resolveThicknessRange) —
        // il warning dedicato checkFilletThicknessRangeNeedsManualVerification è già più preciso.
        warnings.push('Spessore testato non riconoscibile — range non calcolato');
    }

    warnings.push(...checkWpqrPlausibility(reviewFields));

    if (reviewFields.reference_number && await checkDuplicate(reviewFields.reference_number, organizationId, companyId)) {
        return {
            status: 'duplicate',
            reference_number: reviewFields.reference_number,
            warnings,
            fields: reviewFields,
            field_confidence: pipeline.fieldConfidence,
        };
    }

    const confidence = pipeline.extractionConfidence >= 70 ? 'alta'
        : pipeline.aiModel ? 'media' : 'bassa';

    return {
        status: 'pending_review',
        fields: reviewFields,
        field_confidence: pipeline.fieldConfidence,
        confidence,
        warnings,
        ai_model: pipeline.aiModel,
    };
}

async function commitWPQRFromFields(fields, organizationId, companyId, options = {}) {
    const { userId = null, filePath = null, fileName = '' } = options;
    const mapped = mapReviewFieldsToDb(fields, fileName);
    const warnings = [];

    if (!mapped.reference_number) {
        const err = new Error('Numero WPQR obbligatorio');
        err.code = 'VALIDATION_ERROR';
        throw err;
    }

    if (await checkDuplicate(mapped.reference_number, organizationId, companyId)) {
        const err = new Error(`WPQR ${mapped.reference_number} già presente`);
        err.code = 'DUPLICATE';
        err.warnings = [`Duplicato: WPQR ${mapped.reference_number} già presente.`];
        throw err;
    }

    const certificate_file_url = buildCertificateFileUrl(filePath);

    const insertResult = await query(`
        INSERT INTO wpqr_records (
            organization_id, company_id,
            reference_number, wpqr_code,
            welding_process, base_material_group, filler_material,
            thickness_tested, thickness_min, thickness_max, thickness_max_unlimited,
            thickness_t1_min, thickness_t1_max, thickness_t1_max_unlimited,
            thickness_t2_min, thickness_t2_max, thickness_t2_max_unlimited,
            diameter_min, diameter_max, throat_test_mm,
            welding_positions, examiner_body, testing_body,
            welder_name, issue_date, expiry_date,
            certificate_number, certificate_file_url,
            pwht, approval_status, status,
            qualification_level, joint_type, standard_reference, wps_ref,
            base_material_spec, shielding_gas, current_type, metal_transfer,
            mechanization, single_multi_run, heat_input_note,
            preheat_temp, interpass_temp, product_type, rotated_position,
            qualifying_element, base_material_group_2, base_material_spec_2,
            created_by, created_at, updated_at
        )
        OUTPUT INSERTED.id
        VALUES (
            @organization_id, @company_id,
            @reference_number, @reference_number,
            @welding_process, @base_material_group, @filler_material,
            @thickness_tested, @thickness_min, @thickness_max, @thickness_max_unlimited,
            @thickness_t1_min, @thickness_t1_max, @thickness_t1_max_unlimited,
            @thickness_t2_min, @thickness_t2_max, @thickness_t2_max_unlimited,
            @diameter_min, @diameter_max, @throat_test_mm,
            @welding_positions, @examiner_body, @examiner_body,
            @welder_name, @issue_date, @expiry_date,
            @certificate_number, @certificate_file_url,
            @pwht, 'bozza', 'attiva',
            @qualification_level, @joint_type, @standard_reference, @wps_ref,
            @base_material_spec, @shielding_gas, @current_type, @metal_transfer,
            @mechanization, @single_multi_run, @heat_input_note,
            @preheat_temp, @interpass_temp, @product_type, @rotated_position,
            @qualifying_element, @base_material_group_2, @base_material_spec_2,
            @created_by, GETDATE(), GETDATE()
        )
    `, {
        organization_id: organizationId,
        company_id: companyId || null,
        reference_number: mapped.reference_number,
        welding_process: mapped.welding_process,
        base_material_group: mapped.base_material_group,
        filler_material: mapped.filler_material,
        thickness_tested: mapped.thickness_tested,
        thickness_min: mapped.thickness_min,
        thickness_max: mapped.thickness_max,
        thickness_max_unlimited: mapped.thickness_max_unlimited ? 1 : 0,
        thickness_t1_min: mapped.thickness_t1_min,
        thickness_t1_max: mapped.thickness_t1_max,
        thickness_t1_max_unlimited: mapped.thickness_t1_max_unlimited ? 1 : 0,
        thickness_t2_min: mapped.thickness_t2_min,
        thickness_t2_max: mapped.thickness_t2_max,
        thickness_t2_max_unlimited: mapped.thickness_t2_max_unlimited ? 1 : 0,
        diameter_min: mapped.diameter_min,
        diameter_max: mapped.diameter_max,
        throat_test_mm: mapped.throat_test_mm,
        welding_positions: mapped.welding_positions,
        examiner_body: mapped.examiner_body,
        welder_name: mapped.welder_name,
        issue_date: mapped.issue_date,
        expiry_date: mapped.expiry_date,
        certificate_number: mapped.certificate_number,
        certificate_file_url,
        pwht: mapped.pwht,
        qualification_level: mapped.qualification_level,
        joint_type: mapped.joint_type,
        standard_reference: mapped.standard_reference,
        wps_ref: mapped.wps_ref,
        base_material_spec: mapped.base_material_spec,
        shielding_gas: mapped.shielding_gas,
        current_type: mapped.current_type,
        metal_transfer: mapped.metal_transfer,
        mechanization: mapped.mechanization,
        single_multi_run: mapped.single_multi_run,
        heat_input_note: mapped.heat_input_note,
        preheat_temp: mapped.preheat_temp,
        interpass_temp: mapped.interpass_temp,
        product_type: mapped.product_type,
        rotated_position: mapped.rotated_position ? 1 : 0,
        qualifying_element: mapped.qualifying_element,
        base_material_group_2: mapped.base_material_group_2,
        base_material_spec_2: mapped.base_material_spec_2,
        created_by: userId,
    });

    const wpqrId = insertResult.recordset[0].id;
    logger.info('WPQR committed from staging', { wpqrId, reference_number: mapped.reference_number, organizationId });

    return {
        wpqr_id: wpqrId,
        reference_number: mapped.reference_number,
        welding_process: mapped.welding_process,
        thickness_tested: mapped.thickness_tested,
        thickness_min: mapped.thickness_min,
        thickness_max: mapped.thickness_max,
        warnings,
    };
}

async function ingestWPQRFromPdf(pdfBuffer, fileName, organizationId, companyId, options = {}) {
    const extracted = await extractWPQRFromPdf(pdfBuffer, fileName, organizationId, companyId);
    if (extracted.status === 'wrong_module') return extracted;
    if (extracted.status === 'duplicate') {
        return { status: 'duplicate', reference_number: extracted.reference_number, warnings: extracted.warnings };
    }

    const committed = await commitWPQRFromFields(
        extracted.fields,
        organizationId,
        companyId,
        { ...options, fileName },
    );

    return {
        status: 'ok',
        ...committed,
        confidence: extracted.confidence,
        field_confidence: extracted.field_confidence,
        warnings: [...(extracted.warnings || []), ...(committed.warnings || [])],
    };
}

/**
 * Campi WPQR ammessi per la "rielaborazione" (backfill) su record già
 * presenti in DB — generalizzazione 08/08/2026 del pattern già usato per le
 * Qualifiche (REPROCESSABLE_FIELDS in qualificationIngest.service.js, vedi
 * commento lì per la motivazione completa). Whitelist esplicita e separata
 * (non condivisa con quella delle Qualifiche): un nuovo campo va aggiunto
 * qui solo dopo aver verificato che la colonna esiste su wpqr_records ed è
 * sicura da scrivere via UPDATE mirato.
 *
 * `writeGuard` esplicito per le colonne NOT NULL con default (BIT) — la
 * guardia standard "colonna IS NULL" non si applicherebbe mai, vedi
 * GAP_WPQR_ESTENSIONI_ANNEX_B_2026-08-07.md.
 */
const WPQR_REPROCESSABLE_FIELDS = {
    preheat_temp: { column: 'preheat_temp' },
    interpass_temp: { column: 'interpass_temp' },
    throat_test_mm: { column: 'throat_test_mm' },
    product_type: { column: 'product_type' },
    rotated_position: { column: 'rotated_position', writeGuard: 'rotated_position = 0' },
    // Chiave prefissata "wpqr_" per non collidere con l'omonima voce delle
    // Qualifiche nel registro condiviso reprocessableFields.js (un unico
    // spazio dei nomi a livello di pannello superadmin).
    wpqr_thickness_max_unlimited: { column: 'thickness_max_unlimited', writeGuard: 'thickness_max_unlimited = 0' },
    // Bundle t1/t2 (mig. 158): una voce registro → più colonne in un UPDATE.
    // `column` = ancora per candidati/sync test; `bundleColumns` espanso in
    // applyFieldReprocessUpdate. Flag BIT: writeGuard = ancora al default 0.
    wpqr_thickness_t1_t2: {
        column: 'thickness_t1_min',
        writeGuard: 'thickness_t1_min IS NULL',
        bundleColumns: [
            { column: 'thickness_t1_min', writeGuard: 'thickness_t1_min IS NULL' },
            { column: 'thickness_t1_max', writeGuard: 'thickness_t1_max IS NULL' },
            { column: 'thickness_t1_max_unlimited', writeGuard: 'thickness_t1_max_unlimited = 0' },
            { column: 'thickness_t2_min', writeGuard: 'thickness_t2_min IS NULL' },
            { column: 'thickness_t2_max', writeGuard: 'thickness_t2_max IS NULL' },
            { column: 'thickness_t2_max_unlimited', writeGuard: 'thickness_t2_max_unlimited = 0' },
        ],
    },
    // STUD-1 (mig. 159): campi stud / Parent Metal 2 — backfill da PDF su record esistenti.
    qualifying_element: { column: 'qualifying_element' },
    material_group_2: { column: 'base_material_group_2' },
    base_material_spec_2: { column: 'base_material_spec_2' },
};

/**
 * Applica un aggiornamento mirato a UNA WPQR già esistente, limitato ai
 * campi in `fieldScope` (whitelist WPQR_REPROCESSABLE_FIELDS). Usato dal
 * percorso di conferma staging in "modalità rielaborazione"
 * (ingestStaging.service.js) — MAI una INSERT: aggiorna solo se il valore
 * attuale in DB è ancora al default, per non sovrascrivere mai una
 * correzione manuale già presente.
 * @returns {Promise<{wpqr_id:number, updated_fields:string[]}>}
 */
async function applyFieldReprocessUpdate(targetWpqrId, organizationId, fieldScope, fields) {
    const scopeFields = String(fieldScope || '').split(',').map((s) => s.trim()).filter(Boolean);
    if (!scopeFields.length) {
        const err = new Error('field_scope mancante o vuoto');
        err.code = 'VALIDATION_ERROR';
        throw err;
    }

    const check = await query(
        'SELECT id FROM wpqr_records WHERE id=@id AND organization_id=@orgId',
        { id: targetWpqrId, orgId: organizationId },
    );
    if (!check.recordset.length) {
        const err = new Error('WPQR destinataria non trovata');
        err.code = 'NOT_FOUND';
        throw err;
    }

    const updatable = [];
    for (const key of scopeFields) {
        const def = WPQR_REPROCESSABLE_FIELDS[key];
        if (!def) continue;
        if (Array.isArray(def.bundleColumns) && def.bundleColumns.length) {
            for (const part of def.bundleColumns) {
                const column = part.column || part;
                const writeGuard = part.writeGuard || `${column} IS NULL`;
                // Valore sotto il nome colonna (proposta multi-campo) oppure
                // sotto la chiave bundle (legacy single-field).
                let value = fields ? fields[column] : undefined;
                if (value === undefined && fields && fields[key] != null && typeof fields[key] === 'object' && !Array.isArray(fields[key])) {
                    value = fields[key][column];
                }
                if (value === undefined || value === null || value === '') continue;
                // Flag BIT: in conferma scrivere solo true (false = default già ok).
                if (/_max_unlimited$/.test(column) && value !== true && value !== 1 && value !== '1') continue;
                updatable.push({ key: `${key}:${column}`, column, value, writeGuard });
            }
            continue;
        }
        const value = fields ? fields[key] : undefined;
        if (value === undefined || value === null || value === '') continue;
        updatable.push({ key, column: def.column, value, writeGuard: def.writeGuard || `${def.column} IS NULL` });
    }

    if (!updatable.length) {
        return { wpqr_id: targetWpqrId, updated_fields: [] };
    }

    // Una UPDATE per colonna (writeGuard indipendente): in un bundle t1/t2
    // alcune colonne possono già essere valorizzate — non devono far fallire
    // l'intero gruppo con un AND globale.
    const updatedFields = [];
    for (const { key, column, value, writeGuard } of updatable) {
        const params = { id: targetWpqrId, orgId: organizationId, val: value };
        const result = await query(`
            UPDATE wpqr_records
            SET ${column} = @val, updated_at = GETDATE()
            WHERE id = @id AND organization_id = @orgId AND (${writeGuard})
        `, params);
        const affected = result?.rowsAffected?.[0] ?? result?.rowsAffected ?? 0;
        if (affected > 0) updatedFields.push(key);
    }

    logger.info(`[WpqrReprocess] Rielaborazione applicata id=${targetWpqrId} campi=${updatedFields.join(',')}`);
    return { wpqr_id: targetWpqrId, updated_fields: updatedFields };
}

module.exports = {
    ingestWPQRFromPdf,
    extractWPQRFromPdf,
    commitWPQRFromFields,
    mapPipelineFieldsToReview,
    mapReviewFieldsToDb,
    resolveThicknessRange,
    resolveDualThicknessSides,
    checkWpqrPlausibility,
    applyFieldReprocessUpdate,
    WPQR_REPROCESSABLE_FIELDS,
    calcThicknessRange,
    normalizeWpqrJointType,
    normalizeWpqrProductType,
    normalizeQualifyingElement,
    looksLikeStudWelding,
    extractStudDiameterFromText,
};

/**
 * Regole di range / accettazione ISO 14555:2025 — stud welding WPQR.
 * Mantenere sincronizzato con backend/src/data/weldingQualificationRules14555.js
 *
 * Estratto operativo (HITL 29/08/2026):
 * docs/reference/ISO-14555-2025-range-validita-WPQR.md
 *
 * Codificato: §10.2.8.4–12, §3.14, Tabella 2 boiler pins.
 * Non inventare codici ISO 4063 famiglia 78x; non usare Annex B come range validità.
 */

/** Momenti minimi piega boiler pins — Tabella 2 HITL (ø mm → Nm). */
export const BOILER_PIN_BEND_MOMENTS_NM = Object.freeze({
  8: 40,
  10: 60,
  12: 85,
});

/** Soglia lastra through-deck (§3.14): spessore < 3 mm. */
export const THROUGH_DECK_SHEET_MAX_MM = 3;

/** Soglia tempo saldatura per posizioni / materiali dissimili (§10.2.8.5 / .9). */
export const WELDING_TIME_MS_POSITION_THRESHOLD = 100;

/** Soglia tempo breve materiali (§10.2.8.4 b / 10.2.8.5 c). */
export const WELDING_TIME_MS_SHORT = 10;

/** Diametro max per scambio gruppi 8/10 ↔ 1/2.1 su materiali simili (§10.2.8.4 a). */
export const SIMILAR_GROUP_SWAP_MAX_DIAMETER_MM = 13;

/**
 * True se la norma di riferimento è ISO 14555 (stud welding).
 * @param {unknown} standardReference
 * @returns {boolean}
 */
export function isIso14555(standardReference) {
  return /14555\b/i.test(String(standardReference || ''));
}

/**
 * Parse gruppo ISO/TR 15608 (es. "1", "2.1", "11.1").
 * @param {unknown} code
 * @returns {{ group: number, subgroup: string|null } | null}
 */
function parseMaterialGroup(code) {
  if (code == null || code === '') return null;
  const raw = String(code).trim();
  if (!raw) return null;
  const cleaned = raw
    .replace(/^(gruppo|group|gr\.?|ISO\/?TR\s*15608)\s*/i, '')
    .replace(/,/g, '.')
    .trim();
  const m = cleaned.match(/^(\d{1,2})(?:\.(\d{1,2}))?$/);
  if (!m) return null;
  const group = Number(m[1]);
  if (!Number.isFinite(group) || group < 1) return null;
  const subgroup = m[2] != null ? `${group}.${m[2]}` : null;
  return { group, subgroup };
}

function sameGroupOrSubgroup(a, b) {
  if (!a || !b) return false;
  if (a.group !== b.group) return false;
  if (a.subgroup && b.subgroup) return a.subgroup === b.subgroup;
  return true;
}

function isGroupInRange(parsed, minG, maxG) {
  return parsed && parsed.group >= minG && parsed.group <= maxG;
}

function isSubgroup211(parsed) {
  return parsed && parsed.subgroup === '2.1';
}

function isSubgroup111(parsed) {
  return parsed && parsed.subgroup === '11.1';
}

/**
 * §10.2.8.8 — sezione/diametro stud.
 * Una prova → solo quella sezione (+ tutte le forme).
 * Due prove → intervallo tra le sezioni (+ tutte le forme).
 *
 * @param {{ testSectionsMm?: number|string|Array<number|string>|null }} params
 * @returns {{ minMm: number, maxMm: number, allForms: true, clause: string } | null}
 */
export function describeQualifiedStudSectionRange({ testSectionsMm } = {}) {
  const raw = Array.isArray(testSectionsMm) ? testSectionsMm : [testSectionsMm];
  const values = raw
    .map((v) => Number(v))
    .filter((n) => Number.isFinite(n) && n > 0);
  if (values.length === 0) return null;

  if (values.length === 1) {
    const s = values[0];
    return {
      minMm: s,
      maxMm: s,
      allForms: true,
      clause: '§10.2.8.8 — una prova: solo la sezione di saldatura usata',
    };
  }

  const minMm = Math.min(...values);
  const maxMm = Math.max(...values);
  return {
    minMm,
    maxMm,
    allForms: true,
    clause: '§10.2.8.8 — due (o più) prove: intervallo tra le sezioni',
  };
}

/**
 * §10.2.8.6 — spessore parent: tutti gli spessori se pWPS applicabile.
 * Non è Tabella 7 ISO 15614-1.
 *
 * @param {{ pWpsApplies?: boolean }} params
 * @returns {{ allThicknesses: boolean, pWpsApplies: boolean, minMm: null, maxMm: null, clause: string }}
 */
export function describeQualifiedParentThicknessRange14555({ pWpsApplies = true } = {}) {
  const applies = pWpsApplies !== false;
  return {
    allThicknesses: applies,
    pWpsApplies: applies,
    minMm: null,
    maxMm: null,
    clause: applies
      ? '§10.2.8.6 — tutti gli spessori se pWPS applicabile (non Tabella 7 15614)'
      : '§10.2.8.6 — pWPS non applicabile: nessuna copertura automatica spessore',
  };
}

/**
 * §10.2.8.9 — posizioni qualificate da posizione di prova e tw.
 *
 * @param {{ weldingTimeMs?: number|string|null, testPosition?: string|null, throughDeck?: boolean }} params
 * @returns {{ covers: string[], weldingTimeMs: number|null, clause: string } | null}
 */
export function describeQualifiedPositions14555({
  weldingTimeMs,
  testPosition,
  throughDeck = false,
} = {}) {
  const tw = weldingTimeMs == null || weldingTimeMs === ''
    ? null
    : Number(weldingTimeMs);
  const pos = String(testPosition || '').trim().toUpperCase();
  if (!pos || !/^(PA|PC|PE)$/.test(pos)) return null;

  if (throughDeck) {
    return {
      covers: pos === 'PA' ? ['PA'] : [],
      weldingTimeMs: Number.isFinite(tw) ? tw : null,
      clause: '§10.2.8.9 — through-deck solo PA',
    };
  }

  if (Number.isFinite(tw) && tw <= WELDING_TIME_MS_POSITION_THRESHOLD) {
    return {
      covers: ['PA', 'PC', 'PE'],
      weldingTimeMs: tw,
      clause: '§10.2.8.9 — tw ≤ 100 ms: una posizione qualifica tutte',
    };
  }

  // tw > 100 ms (o tw sconosciuto → ramo conservativo «oltre 100 ms»)
  let covers = [];
  if (pos === 'PC') covers = ['PC', 'PE', 'PA'];
  else if (pos === 'PE') covers = ['PE', 'PA'];
  else if (pos === 'PA') covers = ['PA'];

  return {
    covers,
    weldingTimeMs: Number.isFinite(tw) ? tw : null,
    clause: Number.isFinite(tw) && tw > WELDING_TIME_MS_POSITION_THRESHOLD
      ? '§10.2.8.9 — tw > 100 ms: PC⊃PE⊃PA (non il contrario)'
      : '§10.2.8.9 — tw non dichiarato: ramo conservativo PC⊃PE⊃PA',
  };
}

/**
 * True se la posizione di produzione è coperta dalla prova (§10.2.8.9).
 */
export function isPositionCovered14555({
  weldingTimeMs,
  testPosition,
  productionPosition,
  throughDeck = false,
} = {}) {
  const desc = describeQualifiedPositions14555({
    weldingTimeMs,
    testPosition,
    throughDeck,
  });
  if (!desc) return false;
  const prod = String(productionPosition || '').trim().toUpperCase();
  return desc.covers.includes(prod);
}

/**
 * §10.2.8.12 — protezione bagno CF / SG / NP.
 * Un metodo specifico → solo quel metodo; NP copre SG (non il contrario).
 *
 * @param {{ qualifiedMethod?: string|null, productionMethod?: string|null }} params
 * @returns {boolean}
 */
export function isBathProtectionCovered14555({
  qualifiedMethod,
  productionMethod,
} = {}) {
  const q = String(qualifiedMethod || '').trim().toUpperCase();
  const p = String(productionMethod || '').trim().toUpperCase();
  if (!['CF', 'SG', 'NP'].includes(q) || !['CF', 'SG', 'NP'].includes(p)) {
    return false;
  }
  if (q === p) return true;
  // NP copre SG, non il contrario; CF non scambia con nessuno
  if (q === 'NP' && p === 'SG') return true;
  return false;
}

/**
 * §10.2.8.4 — materiali simili parent + stud.
 *
 * @param {{
 *   parentGroup?: string|null,
 *   studGroup?: string|null,
 *   studDiameterMm?: number|string|null,
 *   weldingTimeMs?: number|string|null,
 * }} params
 * @returns {{ covered: boolean, clause: string|null, reason?: string }}
 */
export function isSimilarMaterialsCovered14555({
  parentGroup,
  studGroup,
  studDiameterMm,
  weldingTimeMs,
} = {}) {
  const parent = parseMaterialGroup(parentGroup);
  const stud = parseMaterialGroup(studGroup);
  if (!parent || !stud) {
    return { covered: false, clause: null, reason: 'gruppo materiale mancante o non parseabile' };
  }

  // Stesso gruppo 15608
  if (sameGroupOrSubgroup(parent, stud)) {
    return { covered: true, clause: '§10.2.8.4 — stesso gruppo ISO/TR 15608' };
  }

  // Prova su gruppo 1 o 2: copertura snervamento uguale/inferiore è gestita fuori
  // (qui solo scambio esplicito a/b sotto).

  const d = Number(studDiameterMm);
  const tw = Number(weldingTimeMs);

  // (a) fino a 13 mm: 8 o 10 ↔ 1 e 2.1
  if (Number.isFinite(d) && d > 0 && d <= SIMILAR_GROUP_SWAP_MAX_DIAMETER_MM) {
    const aParentOk =
      (parent.group === 8 || parent.group === 10)
      && (stud.group === 1 || isSubgroup211(stud));
    const aStudOk =
      (stud.group === 8 || stud.group === 10)
      && (parent.group === 1 || isSubgroup211(parent));
    if (aParentOk || aStudOk) {
      return { covered: true, clause: '§10.2.8.4 (a) — d ≤ 13 mm: gruppi 8/10 ↔ 1 e 2.1' };
    }
  }

  // (b) tw < 10 ms: gruppo 8 ↔ gruppi 1–6 e 11.1
  if (Number.isFinite(tw) && tw < WELDING_TIME_MS_SHORT) {
    const bParent8 =
      parent.group === 8
      && (isGroupInRange(stud, 1, 6) || isSubgroup111(stud));
    const bStud8 =
      stud.group === 8
      && (isGroupInRange(parent, 1, 6) || isSubgroup111(parent));
    if (bParent8 || bStud8) {
      return { covered: true, clause: '§10.2.8.4 (b) — tw < 10 ms: gruppo 8 ↔ 1–6 e 11.1' };
    }
  }

  return {
    covered: false,
    clause: '§10.2.8.4',
    reason: 'combinazione gruppi non coperta dalle regole a–b (nessuna matrice inventata)',
  };
}

/**
 * §10.2.8.5 — materiali dissimili parent vs stud.
 * (a) tw > 100 ms → qualifica dedicata, nessuna copertura automatica.
 *
 * @param {{
 *   parentGroup?: string|null,
 *   studGroup?: string|null,
 *   weldingTimeMs?: number|string|null,
 * }} params
 * @returns {{ covered: boolean, clause: string|null, dedicatedQualificationRequired?: boolean, reason?: string }}
 */
export function isDissimilarMaterialsCovered14555({
  parentGroup,
  studGroup,
  weldingTimeMs,
} = {}) {
  const parent = parseMaterialGroup(parentGroup);
  const stud = parseMaterialGroup(studGroup);
  if (!parent || !stud) {
    return { covered: false, clause: null, reason: 'gruppo materiale mancante o non parseabile' };
  }

  const tw = weldingTimeMs == null || weldingTimeMs === ''
    ? null
    : Number(weldingTimeMs);

  // (a) tw oltre 100 ms → qualifica dedicata
  if (Number.isFinite(tw) && tw > WELDING_TIME_MS_POSITION_THRESHOLD) {
    return {
      covered: false,
      dedicatedQualificationRequired: true,
      clause: '§10.2.8.5 (a)',
      reason: 'tw > 100 ms: serve qualifica dedicata al tempo specificato (nessuna matrice gruppi)',
    };
  }

  // (c) tw < 10 ms: gruppo 8 ↔ 1–6 e 11.1
  if (Number.isFinite(tw) && tw < WELDING_TIME_MS_SHORT) {
    const cParent8 =
      parent.group === 8
      && (isGroupInRange(stud, 1, 6) || isSubgroup111(stud));
    const cStud8 =
      stud.group === 8
      && (isGroupInRange(parent, 1, 6) || isSubgroup111(parent));
    if (cParent8 || cStud8) {
      return { covered: true, clause: '§10.2.8.5 (c) — tw < 10 ms: gruppo 8 ↔ 1–6 e 11.1' };
    }
  }

  // (b) tw ≤ 100 ms (incluso assente trattato come ≤100 se non >100): 8 o 10 ↔ 1 e 2.1
  if (!Number.isFinite(tw) || tw <= WELDING_TIME_MS_POSITION_THRESHOLD) {
    const bParentOk =
      (parent.group === 8 || parent.group === 10)
      && (stud.group === 1 || isSubgroup211(stud));
    const bStudOk =
      (stud.group === 8 || stud.group === 10)
      && (parent.group === 1 || isSubgroup211(parent));
    if (bParentOk || bStudOk) {
      return { covered: true, clause: '§10.2.8.5 (b) — tw ≤ 100 ms: gruppi 8/10 ↔ 1 e 2.1' };
    }
  }

  return {
    covered: false,
    clause: '§10.2.8.5',
    reason: 'combinazione dissimile non coperta da (b)/(c)',
  };
}

/**
 * §3.14 — lastra through-deck: spessore < 3 mm.
 * @param {{ sheetThicknessMm?: number|string|null }} params
 * @returns {boolean}
 */
export function isThroughDeckSheetThickness({ sheetThicknessMm } = {}) {
  const t = Number(sheetThicknessMm);
  return Number.isFinite(t) && t > 0 && t < THROUGH_DECK_SHEET_MAX_MM;
}

/**
 * §10.2.8.7 — lastra più spessa in prova copre lastre più sottili.
 *
 * @param {{
 *   qualifiedSheetThicknessMm?: number|string|null,
 *   productionSheetThicknessMm?: number|string|null,
 * }} params
 * @returns {{ covered: boolean, clause: string, reason?: string }}
 */
export function isThroughDeckSheetCovered14555({
  qualifiedSheetThicknessMm,
  productionSheetThicknessMm,
} = {}) {
  const q = Number(qualifiedSheetThicknessMm);
  const p = Number(productionSheetThicknessMm);
  if (!Number.isFinite(q) || q <= 0 || !Number.isFinite(p) || p <= 0) {
    return {
      covered: false,
      clause: '§10.2.8.7',
      reason: 'spessore lastra mancante o non valido',
    };
  }
  if (p <= q) {
    return {
      covered: true,
      clause: '§10.2.8.7 — lastra più spessa in prova copre lastre più sottili',
    };
  }
  return {
    covered: false,
    clause: '§10.2.8.7',
    reason: `produzione ${p} mm > lastra qualificata ${q} mm`,
  };
}

/**
 * Tabella 2 — momento minimo piega boiler pins (ø 8/10/12).
 * @param {number|string|null|undefined} diameterMm
 * @returns {number|null}
 */
export function getBoilerPinMinimumBendMomentNm(diameterMm) {
  const d = Number(diameterMm);
  if (!Number.isFinite(d)) return null;
  const key = Math.round(d);
  return BOILER_PIN_BEND_MOMENTS_NM[key] ?? null;
}

/**
 * Accettazione piega boiler pins: criteri §12.3 **oppure** Tabella 2
 * (salvo diversa specifica).
 *
 * @param {{
 *   diameterMm?: number|string|null,
 *   measuredMomentNm?: number|string|null,
 *   clause123Ok?: boolean,
 *   alternativeSpecification?: boolean,
 * }} params
 * @returns {{
 *   accepted: boolean,
 *   criterion: 'alternative_specification'|'clause_12_3'|'table_2'|'fail'|null,
 *   table2MinNm: number|null,
 *   note: string,
 * }}
 */
export function evaluateBoilerPinBendAcceptance({
  diameterMm,
  measuredMomentNm,
  clause123Ok = false,
  alternativeSpecification = false,
} = {}) {
  if (alternativeSpecification) {
    return {
      accepted: true,
      criterion: 'alternative_specification',
      table2MinNm: getBoilerPinMinimumBendMomentNm(diameterMm),
      note: 'Accettazione per specifica diversa (§12.3 / Tabella 2 non applicati)',
    };
  }

  const table2MinNm = getBoilerPinMinimumBendMomentNm(diameterMm);

  if (clause123Ok === true) {
    return {
      accepted: true,
      criterion: 'clause_12_3',
      table2MinNm,
      note: 'Criteri §12.3 soddisfatti (OR rispetto a Tabella 2)',
    };
  }

  const measured = Number(measuredMomentNm);
  if (table2MinNm != null && Number.isFinite(measured) && measured >= table2MinNm) {
    return {
      accepted: true,
      criterion: 'table_2',
      table2MinNm,
      note: `Tabella 2: ø ${Math.round(Number(diameterMm))} mm ≥ ${table2MinNm} Nm`,
    };
  }

  return {
    accepted: false,
    criterion: 'fail',
    table2MinNm,
    note: table2MinNm == null
      ? 'Diametro non in Tabella 2 (solo 8/10/12 mm) e §12.3 non dichiarato OK'
      : `Momento ${Number.isFinite(measured) ? measured : '?'} Nm < minimo Tabella 2 ${table2MinNm} Nm; §12.3 non OK`,
  };
}

export default {
  BOILER_PIN_BEND_MOMENTS_NM,
  THROUGH_DECK_SHEET_MAX_MM,
  WELDING_TIME_MS_POSITION_THRESHOLD,
  WELDING_TIME_MS_SHORT,
  SIMILAR_GROUP_SWAP_MAX_DIAMETER_MM,
  isIso14555,
  describeQualifiedStudSectionRange,
  describeQualifiedParentThicknessRange14555,
  describeQualifiedPositions14555,
  isPositionCovered14555,
  isBathProtectionCovered14555,
  isSimilarMaterialsCovered14555,
  isDissimilarMaterialsCovered14555,
  isThroughDeckSheetThickness,
  isThroughDeckSheetCovered14555,
  getBoilerPinMinimumBendMomentNm,
  evaluateBoilerPinBendAcceptance,
};

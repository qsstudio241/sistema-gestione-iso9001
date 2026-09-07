/**
 * Rubriche versionate contesto AI (Second Brain CTX-0).
 * Studio ≠ azienda. Zero LLM: solo presenza/qualità minima campi già in DB.
 * Fonte piano: docs/agent-tasks/PLAN_SECOND_BRAIN_SLICES.md § CTX-0.
 */

/** @typedef {{ key: string, weight?: number, minLength?: number, label?: string }} RubricItem */
/** @typedef {{ id: string, weight: number, label: string, items: RubricItem[] }} RubricBlock */
/** @typedef {{ version: string, scope: 'studio'|'company', blocks: RubricBlock[] }} AiContextRubric */

/** Badge allineati a company_profile completeness (ADR-018). */
const CONTEXT_LEVELS = Object.freeze({
  incompleto: { max: 49 },
  parziale: { max: 79 },
  pronto: { max: 100 },
});

/**
 * Contesto studio: campi già su `organizations` (mig. 066 + anagrafica).
 * Note operative = peso maggiore («stile di casa»).
 * @type {AiContextRubric}
 */
const STUDIO_CONTEXT_RUBRIC_V1 = Object.freeze({
  version: 'studio-v1',
  scope: 'studio',
  blocks: Object.freeze([
    Object.freeze({
      id: 'identity',
      weight: 30,
      label: 'Identità studio',
      items: Object.freeze([
        Object.freeze({ key: 'organization_name', label: 'Nome studio', weight: 1 }),
        Object.freeze({ key: 'vat_number', label: 'P.IVA studio', weight: 1 }),
      ]),
    }),
    Object.freeze({
      id: 'ops_notes',
      weight: 50,
      label: 'Note operative / stile di casa',
      items: Object.freeze([
        Object.freeze({
          key: 'ai_context_notes',
          label: 'Note operative AI',
          weight: 1,
          minLength: 40,
        }),
      ]),
    }),
    Object.freeze({
      id: 'audit_setup',
      weight: 20,
      label: 'Setup audit',
      items: Object.freeze([
        Object.freeze({ key: 'audit_report_prefix', label: 'Prefisso numerazione audit', weight: 1 }),
      ]),
    }),
  ]),
});

/**
 * Contesto azienda: campi già usati nel prompt AI (`companies`).
 * Profilo legale ADR-018 resta su `computeProfileCompleteness` — non fonderli.
 * @type {AiContextRubric}
 */
const COMPANY_CONTEXT_RUBRIC_V1 = Object.freeze({
  version: 'company-v1',
  scope: 'company',
  blocks: Object.freeze([
    Object.freeze({
      id: 'identity',
      weight: 50,
      label: 'Identità azienda',
      items: Object.freeze([
        Object.freeze({ key: 'name', label: 'Ragione sociale', weight: 2 }),
        Object.freeze({ key: 'vat_number', label: 'P.IVA', weight: 1 }),
        Object.freeze({ key: 'sector', label: 'Settore', weight: 1 }),
      ]),
    }),
    Object.freeze({
      id: 'location',
      weight: 50,
      label: 'Sede / indirizzo',
      items: Object.freeze([
        Object.freeze({ key: 'address', label: 'Indirizzo', weight: 1, minLength: 8 }),
      ]),
    }),
  ]),
});

const RUBRICS_BY_VERSION = Object.freeze({
  [STUDIO_CONTEXT_RUBRIC_V1.version]: STUDIO_CONTEXT_RUBRIC_V1,
  [COMPANY_CONTEXT_RUBRIC_V1.version]: COMPANY_CONTEXT_RUBRIC_V1,
});

function getRubric(version) {
  return RUBRICS_BY_VERSION[version] || null;
}

function getDefaultRubric(scope) {
  if (scope === 'studio') return STUDIO_CONTEXT_RUBRIC_V1;
  if (scope === 'company') return COMPANY_CONTEXT_RUBRIC_V1;
  return null;
}

/**
 * @param {number} score
 * @returns {'incompleto'|'parziale'|'pronto'}
 */
function contextLevel(score) {
  const n = Number(score);
  if (!Number.isFinite(n)) return 'incompleto';
  if (n >= 80) return 'pronto';
  if (n >= 50) return 'parziale';
  return 'incompleto';
}

/**
 * Punteggio item 0..1: vuoto=0; sotto minLength=frazione; pieno=1.
 * @param {unknown} raw
 * @param {RubricItem} item
 */
function itemFillRatio(raw, item) {
  if (raw === null || raw === undefined) return 0;
  const s = String(raw).trim();
  if (!s) return 0;
  const min = item && item.minLength ? Number(item.minLength) : 0;
  if (min > 0 && s.length < min) {
    return Math.max(0.15, Math.min(0.85, s.length / min));
  }
  return 1;
}

/**
 * Score 0..100 vs rubrica versionata. Zero LLM. Puro.
 * @param {AiContextRubric} rubric
 * @param {Record<string, unknown>} values
 * @returns {{
 *   score: number,
 *   level: string,
 *   version: string,
 *   scope: string,
 *   blocks: Array<{ id: string, label: string, weight: number, score: number, missing: string[] }>,
 *   missing: string[],
 * }}
 */
function scoreAgainstRubric(rubric, values) {
  if (!rubric || !Array.isArray(rubric.blocks) || rubric.blocks.length === 0) {
    return {
      score: 0,
      level: 'incompleto',
      version: rubric && rubric.version ? rubric.version : 'unknown',
      scope: rubric && rubric.scope ? rubric.scope : 'unknown',
      blocks: [],
      missing: [],
    };
  }

  const src = values && typeof values === 'object' ? values : {};
  let totalWeight = 0;
  let earned = 0;
  const blockResults = [];
  const missingAll = [];

  for (const block of rubric.blocks) {
    const items = Array.isArray(block.items) ? block.items : [];
    const blockWeight = Number(block.weight) || 0;
    totalWeight += blockWeight;

    let itemWeightSum = 0;
    let itemEarned = 0;
    const missing = [];

    for (const item of items) {
      const w = item.weight != null && Number(item.weight) > 0 ? Number(item.weight) : 1;
      itemWeightSum += w;
      const ratio = itemFillRatio(src[item.key], item);
      itemEarned += w * ratio;
      if (ratio < 1) missing.push(item.key);
    }

    const blockRatio = itemWeightSum > 0 ? itemEarned / itemWeightSum : 0;
    const blockScore = Math.round(blockWeight * blockRatio);
    earned += blockWeight * blockRatio;
    missingAll.push(...missing);

    blockResults.push({
      id: block.id,
      label: block.label || block.id,
      weight: blockWeight,
      score: blockScore,
      missing,
    });
  }

  const score = totalWeight > 0
    ? Math.min(100, Math.max(0, Math.round((100 * earned) / totalWeight)))
    : 0;

  return {
    score,
    level: contextLevel(score),
    version: rubric.version,
    scope: rubric.scope,
    blocks: blockResults,
    missing: [...new Set(missingAll)],
  };
}

module.exports = {
  CONTEXT_LEVELS,
  STUDIO_CONTEXT_RUBRIC_V1,
  COMPANY_CONTEXT_RUBRIC_V1,
  RUBRICS_BY_VERSION,
  getRubric,
  getDefaultRubric,
  contextLevel,
  itemFillRatio,
  scoreAgainstRubric,
};

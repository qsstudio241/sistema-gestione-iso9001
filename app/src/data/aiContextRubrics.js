/**
 * Mirror FE della rubrica contesto AI studio (CTX-1).
 * Fonte canonica backend: backend/src/data/aiContextRubrics.js (studio-v1).
 * Solo anteprima live in Il mio Studio — il GET/PATCH /organizations/me resta fonte API.
 */

/** @typedef {{ key: string, weight?: number, minLength?: number, label?: string }} RubricItem */
/** @typedef {{ id: string, weight: number, label: string, items: RubricItem[] }} RubricBlock */
/** @typedef {{ version: string, scope: 'studio'|'company', blocks: RubricBlock[] }} AiContextRubric */

export const STUDIO_CONTEXT_RUBRIC_V1 = Object.freeze({
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

/** @type {Record<string, string>} */
export const STUDIO_FIELD_LABELS = Object.freeze(
  Object.fromEntries(
    STUDIO_CONTEXT_RUBRIC_V1.blocks.flatMap((b) =>
      b.items.map((item) => {
        const minHint = item.minLength ? ` (\u2265${item.minLength} caratteri)` : '';
        return [item.key, `${item.label}${minHint}`];
      })
    )
  )
);

export function contextLevel(score) {
  const n = Number(score);
  if (!Number.isFinite(n)) return 'incompleto';
  if (n >= 80) return 'pronto';
  if (n >= 50) return 'parziale';
  return 'incompleto';
}

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
 * @param {AiContextRubric} rubric
 * @param {Record<string, unknown>} values
 */
export function scoreAgainstRubric(rubric, values) {
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

export function scoreStudioContext(orgProfile) {
  return scoreAgainstRubric(STUDIO_CONTEXT_RUBRIC_V1, orgProfile || {});
}

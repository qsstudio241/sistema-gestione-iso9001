/**
 * Mappatura riga WPS (coverage[]) -> criteri per `POST /qualifications/coverage/verify`
 * dominio `wpqr_procedure` (COV-5). Funzioni pure, nessuna chiamata di rete.
 *
 * Il tipo giunto non è nelle righe di copertura (non è nelle SELECT BE): resta non verificato
 * e `verified` lo rende esplicito in UI.
 */

/** Tetto di WPS verificate per click (una chiamata verify per WPS). */
export const MAX_WPS_VERIFY = 20;

/** Chiamate verify in parallelo. */
export const VERIFY_BATCH_SIZE = 4;

const MATCH_PRIORITY = { match: 0, partial: 1, no_match: 2 };

function toText(value) {
  if (value == null) return "";
  return String(value).trim();
}

function toPositiveNumber(value) {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(String(value).trim().replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function formatMm(n) {
  return `${n} mm`;
}

/**
 * @param {object} row riga `coverage[]` (welding_process, material_group, thickness_range_min/max)
 * @returns {{ criteria: object, verified: string[] }}
 */
export function wpsRowToWpqrCriteria(row) {
  const criteria = {};
  const verified = [];
  const r = row || {};

  const process = toText(r.welding_process);
  if (process) {
    criteria.welding_process = process;
    verified.push(`Processo ${process}`);
  }

  const min = toPositiveNumber(r.thickness_range_min);
  const max = toPositiveNumber(r.thickness_range_max);
  if (min != null && max != null) {
    const lo = Math.min(min, max);
    const hi = Math.max(min, max);
    criteria.thickness_mm = lo;
    if (hi !== lo) {
      criteria.thickness_b_mm = hi;
      verified.push(`Spessore ${lo}\u2013${formatMm(hi)}`);
    } else {
      verified.push(`Spessore ${formatMm(lo)}`);
    }
  } else if (min != null || max != null) {
    const only = min != null ? min : max;
    criteria.thickness_mm = only;
    verified.push(`Spessore ${formatMm(only)}`);
  }

  const material = toText(r.material_group ?? r.base_material_group);
  if (material) {
    criteria.material_group = material;
    verified.push(`Materiale ${material}`);
  }

  return { criteria, verified };
}

/** True se c'è almeno un criterio: con criteri vuoti il motore risponde `match` su ogni WPQR (falso positivo). */
export function hasUsableCriteria(criteria) {
  if (!criteria || typeof criteria !== "object") return false;
  return Object.values(criteria).some((v) => v !== null && v !== undefined && String(v).trim() !== "");
}

/**
 * Sceglie la capacità migliore: match > partial > no_match; a parità resta la prima
 * (il motore le restituisce già ordinate).
 * @param {Array<{status: string}>} matches
 * @returns {object|null}
 */
export function bestMatch(matches) {
  const list = Array.isArray(matches) ? matches : [];
  let best = null;
  let bestRank = Infinity;
  for (const m of list) {
    const rank = MATCH_PRIORITY[m?.status];
    if (rank === undefined) continue;
    if (rank < bestRank) {
      best = m;
      bestRank = rank;
    }
  }
  return best;
}

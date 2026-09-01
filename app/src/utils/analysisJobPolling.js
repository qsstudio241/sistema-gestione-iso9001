/**
 * VC-3: risoluzione di un tick di polling multi-job analisi documenti.
 * Pure — usata da ContractReviewPage e dai test L1.
 *
 * @param {Array<{ id: number, status: string|null, networkError?: boolean }>} results
 * @returns {{
 *   remainingIds: number[],
 *   anyDone: boolean,
 *   newlyDoneCount: number,
 *   allTerminal: boolean,
 *   banner: 'done'|'error'|null,
 * }}
 */
export function resolveAnalysisPollTick(results) {
  const remainingIds = [];
  let newlyDoneCount = 0;
  let anyDone = false;
  let anyError = false;

  for (const r of results || []) {
    if (!r) continue;
    if (r.networkError || r.status == null || r.status === 'processing') {
      remainingIds.push(r.id);
      continue;
    }
    if (r.status === 'done') {
      anyDone = true;
      newlyDoneCount += 1;
    } else {
      anyError = true;
    }
  }

  const allTerminal = remainingIds.length === 0;
  let banner = null;
  if (allTerminal) {
    banner = anyDone ? 'done' : (anyError ? 'error' : null);
  }

  return {
    remainingIds,
    anyDone,
    newlyDoneCount,
    allTerminal,
    banner,
  };
}

/**
 * Estrae gli extraction_id dai job di analyze-all (async o sync).
 * @param {Array<{ extraction_id?: number|null, status?: string }>|null|undefined} jobs
 * @returns {number[]}
 */
export function collectPollingExtractionIds(jobs) {
  const ids = [];
  for (const j of jobs || []) {
    if (j && j.extraction_id != null) {
      const id = parseInt(String(j.extraction_id), 10);
      if (Number.isFinite(id) && id > 0) ids.push(id);
    }
  }
  return ids;
}

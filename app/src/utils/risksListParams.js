/**
 * Query GET /risks dalla card KPI attiva (statFilter).
 * Totale → niente status (il BE esclude i chiusi).
 * Uno stato → status=.
 * Alta priorità → high_priority=1 (il BE esclude i chiusi).
 */
export function buildRisksListParams({
  statFilter = "total",
  filterCompany = "",
  filterStatus = "",
  showClosed = false,
} = {}) {
  const params = {};
  if (filterCompany) params.company_id = filterCompany;

  if (statFilter === "high_priority") {
    params.high_priority = "1";
    return params;
  }
  if (statFilter && statFilter !== "total") {
    params.status = statFilter;
    return params;
  }

  // Retrocompat test/chiamate vecchie (tendina + checkbox, rimossi in UI).
  if (filterStatus) params.status = filterStatus;
  if (!filterStatus && showClosed) params.include_closed = "1";
  return params;
}

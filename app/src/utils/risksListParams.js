export function buildRisksListParams({ filterStatus = "", filterCompany = "", showClosed = false } = {}) {
  const params = {};
  if (filterStatus) params.status = filterStatus;
  if (filterCompany) params.company_id = filterCompany;
  if (!filterStatus && showClosed) params.include_closed = "1";
  return params;
}

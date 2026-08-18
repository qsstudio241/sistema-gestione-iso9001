export function isoDayLocal(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function defaultReviewFromDay(date = new Date()) {
  return `${date.getFullYear()}-01-01`;
}

export function defaultReviewToDay(date = new Date()) {
  return isoDayLocal(date);
}

export function buildRiskReviewsScopeParams({ companyId, fromDay, toDay } = {}) {
  const params = {};
  if (companyId) params.company_id = String(companyId);
  if (fromDay) params.from = fromDay;
  if (toDay) params.to = toDay;
  return params;
}

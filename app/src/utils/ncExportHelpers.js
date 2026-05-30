/**
 * Export CSV registro NC - client-side con filtri griglia correnti
 */

const NC_CSV_COLUMNS = [
  { id: 'nc_number', label: 'Numero NC', get: r => r.nc_number },
  { id: 'status', label: 'Stato', get: r => r.status },
  { id: 'severity', label: 'Severit\u00E0', get: r => r.severity },
  { id: 'client_name', label: 'Cliente', get: r => r.client_name },
  { id: 'audit_number', label: 'Audit', get: r => r.audit_number },
  { id: 'due_date', label: 'Scadenza', get: r => r.due_date || '' },
  { id: 'source_type', label: 'Origine', get: r => r.source_type || '' },
  { id: 'description', label: 'Descrizione', get: r => r.description || '' },
  { id: 'responsible_person', label: 'Responsabile', get: r => r.responsible_person || '' },
  { id: 'approved_at', label: 'Approvata il', get: r => r.approved_at || '' },
];

export function escapeCsvCell(val) {
  const s = val == null ? '' : String(val);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function buildNcCsvContent(rows, columns = NC_CSV_COLUMNS) {
  const header = columns.map(c => escapeCsvCell(c.label)).join(',');
  const lines = (rows || []).map(row =>
    columns.map(c => escapeCsvCell(c.get(row))).join(',')
  );
  return [header, ...lines].join('\r\n');
}

export function downloadNcCsv(filename, rows) {
  const content = buildNcCsvContent(rows);
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export { NC_CSV_COLUMNS };

/**
 * Scheda audit (date, conclusioni, esito): un solo invio dopo la pausa,
 * e nessun invio se i campi che il server conserva non sono cambiati.
 * Le risposte delle domande non passano di qui.
 */

export const AUDIT_METADATA_SYNC_DEBOUNCE_MS = 1200;

export function auditMetadataSyncSignature(updated, calculatedMetrics) {
  const meta = updated?.metadata || {};
  return JSON.stringify({
    audit_number: meta.auditNumber ?? null,
    client_name: meta.clientName ?? null,
    company_id: meta.companyId ?? null,
    audit_party_type: meta.auditPartyType ?? 'first_party',
    fornitore_name: meta.fornitoreName ?? '',
    fornitore_supplier_id: meta.fornitoreSupplierId ?? null,
    project_year: meta.projectYear ?? null,
    audit_date: meta.auditDate ?? null,
    audit_date_end: meta.auditDateEnd ?? null,
    auditor_name: meta.auditorName ?? null,
    audit_type: meta.auditType ?? null,
    status: meta.status ?? null,
    notes: meta.notes ?? null,
    metrics: calculatedMetrics ?? null,
    selectedStandards: meta.selectedStandards || [],
    custom_checklist_id: meta.customChecklistId ?? updated?.custom_checklist_id ?? null,
    generalData: meta.generalData ?? updated?.generalData ?? null,
    auditObjective: meta.auditObjective ?? updated?.auditObjective ?? null,
    auditOutcome: meta.auditOutcome ?? updated?.auditOutcome ?? null,
  });
}

export function createMetadataSyncScheduler({
  enqueue,
  debounceMs = AUDIT_METADATA_SYNC_DEBOUNCE_MS,
  setTimer = (fn, ms) => setTimeout(fn, ms),
  clearTimer = (id) => clearTimeout(id),
} = {}) {
  if (typeof enqueue !== 'function') {
    throw new Error('createMetadataSyncScheduler: enqueue obbligatorio');
  }

  const timers = new Map();
  const lastSent = new Map();
  const latest = new Map();

  function flushOne(uuid) {
    if (timers.has(uuid)) {
      clearTimer(timers.get(uuid));
      timers.delete(uuid);
    }
    const pending = latest.get(uuid);
    if (!pending) return false;
    latest.delete(uuid);
    if (lastSent.get(uuid) === pending.signature) return false;
    lastSent.set(uuid, pending.signature);
    enqueue(pending.payload);
    return true;
  }

  function schedule(uuid, signature, payload) {
    if (!uuid || signature == null) return;
    if (lastSent.get(uuid) === signature) {
      latest.delete(uuid);
      if (timers.has(uuid)) {
        clearTimer(timers.get(uuid));
        timers.delete(uuid);
      }
      return;
    }
    latest.set(uuid, { signature, payload });
    if (timers.has(uuid)) clearTimer(timers.get(uuid));
    timers.set(uuid, setTimer(() => flushOne(uuid), debounceMs));
  }

  function patchPendingStatus(uuid, status) {
    const pending = latest.get(uuid);
    if (!pending?.payload || !status) return false;
    if (pending.payload.status === status) return true;
    const payload = { ...pending.payload, status };
    let signature = pending.signature;
    try {
      const parsed = JSON.parse(signature);
      if (parsed && typeof parsed === 'object') {
        parsed.status = status;
        signature = JSON.stringify(parsed);
      }
    } catch {
      /* firma opaca: parte comunque il payload aggiornato */
    }
    latest.set(uuid, { signature, payload });
    return true;
  }

  function flushAll() {
    let sent = 0;
    for (const uuid of [...latest.keys()]) {
      if (flushOne(uuid)) sent += 1;
    }
    return sent;
  }

  function hasPending() {
    return latest.size > 0;
  }

  return { schedule, flushAll, hasPending, patchPendingStatus };
}

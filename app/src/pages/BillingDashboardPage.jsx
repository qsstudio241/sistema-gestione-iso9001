/**
 * BillingDashboardPage  -  dashboard fatturazione (solo superadmin QS Studio)
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import apiService from "../services/apiService";
import { useAuth } from "../contexts/AuthContext";
import "./BillingDashboardPage.css";

const VERIFY_KIND = "verify";

const EVENT_LABELS = {
  company_activated: "Azienda attivata",
  company_deactivated: "Azienda disattivata",
  company_reactivated: "Azienda riattivata",
  licenses_updated: "Licenze moduli aggiornate",
};

function formatDate(value) {
  if (!value) return " - ";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return " - ";
  return d.toLocaleString("it-IT");
}

function currentPeriod() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default function BillingDashboardPage() {
  const { user } = useAuth();
  const isSuperadmin = user?.role === "superadmin";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [overview, setOverview] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [events, setEvents] = useState([]);
  const [exportPeriod, setExportPeriod] = useState(currentPeriod());
  const [exporting, setExporting] = useState(false);
  const [exportMsg, setExportMsg] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ovRes, coRes, evRes] = await Promise.all([
        apiService.getBillingOverview(),
        apiService.getBillingCompanies(),
        apiService.getBillingEvents({ limit: 30 }),
      ]);
      if (!ovRes.success) throw new Error(ovRes.error || "Errore overview");
      setOverview(ovRes.data);
      setCompanies(coRes.data || []);
      setEvents(evRes.data || []);
    } catch (e) {
      setError(e.message || "Errore caricamento dashboard fatturazione");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isSuperadmin) load();
  }, [isSuperadmin, load]);

  const reprocess = useReprocessTasks(isSuperadmin);

  async function handleExport() {
    setExporting(true);
    setExportMsg(null);
    setError(null);
    try {
      await apiService.downloadBillingExport(exportPeriod);
      setExportMsg(`Export ${exportPeriod} scaricato.`);
    } catch (e) {
      setError(e.message || "Export non riuscito");
    } finally {
      setExporting(false);
    }
  }

  if (!isSuperadmin) {
    return (
      <div className="billing-page">
        <h1>Fatturazione</h1>
        <p className="billing-error">Accesso riservato al superadmin della piattaforma.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="billing-page">
        <p>Caricamento dashboard fatturazione - </p>
      </div>
    );
  }

  const totals = overview?.totals || {};
  const tenants = overview?.tenants || [];
  const period = overview?.period || currentPeriod();

  return (
    <div className="billing-page">
      <header className="billing-header">
        <div>
          <h1>Fatturazione piattaforma</h1>
          <p className="billing-intro">
            Riepilogo tenant (studi di consulenza), aziende fatturabili e utilizzo AI  -  periodo{" "}
            <strong>{period}</strong>.
          </p>
        </div>
        <button type="button" className="btn-secondary" onClick={load}>
          Aggiorna
        </button>
      </header>

      {error && <p className="billing-error">{error}</p>}
      {exportMsg && <p className="billing-ok">{exportMsg}</p>}

      {reprocess.totalCandidates > 0 && (
        <div className="billing-reprocess-alert" role="alert">
          <span className="billing-reprocess-alert-icon">{"\u26A0\uFE0F"}</span>
          <span>
            <strong>{reprocess.totalCandidates}</strong> record possono essere aggiornati con dati AI mancanti —
            vedi sezione "Rielaborazioni disponibili" più sotto.
          </span>
        </div>
      )}

      <ReprocessTasksSection reprocess={reprocess} />
      <VerifyTasksSection reprocess={reprocess} />

      <section className="billing-summary" aria-label="Riepilogo mese">
        <div className="billing-card">
          <span className="billing-card-label">Tenant</span>
          <span className="billing-card-value">{totals.tenant_count ?? 0}</span>
        </div>
        <div className="billing-card">
          <span className="billing-card-label">Studi attivi</span>
          <span className="billing-card-value">{totals.studio_count ?? 0}</span>
        </div>
        <div className="billing-card billing-card-highlight">
          <span className="billing-card-label">Aziende fatturabili</span>
          <span className="billing-card-value">{totals.billable_companies ?? 0}</span>
        </div>
        <div className="billing-card">
          <span className="billing-card-label">Aziende totali</span>
          <span className="billing-card-value">{totals.total_companies ?? 0}</span>
        </div>
        <div className="billing-card">
          <span className="billing-card-label">Richieste AI (mese)</span>
          <span className="billing-card-value">{totals.ai_usage_count ?? 0}</span>
        </div>
      </section>

      <section className="billing-section" aria-labelledby="billing-tenants-heading">
        <h2 id="billing-tenants-heading">Tenant ? studi ? aziende</h2>
        <div className="billing-table-wrap">
          <table className="billing-table">
            <thead>
              <tr>
                <th>Tenant</th>
                <th>P.IVA</th>
                <th>Studi</th>
                <th>Fatturabili</th>
                <th>Totali</th>
                <th>AI mese</th>
              </tr>
            </thead>
            <tbody>
              {tenants.length === 0 ? (
                <tr>
                  <td colSpan={6} className="billing-empty">
                    Nessun tenant registrato.
                  </td>
                </tr>
              ) : (
                tenants.map((t) => (
                  <tr key={t.organization_id}>
                    <td>{t.organization_name}</td>
                    <td>{t.vat_number || " - "}</td>
                    <td>{t.studio_count ?? 0}</td>
                    <td>
                      <span className="billing-badge billing-badge-active">{t.billable_companies ?? 0}</span>
                    </td>
                    <td>{t.total_companies ?? 0}</td>
                    <td>{t.ai_usage_count ?? 0}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="billing-section" aria-labelledby="billing-companies-heading">
        <h2 id="billing-companies-heading">Dettaglio aziende</h2>
        <div className="billing-table-wrap">
          <table className="billing-table billing-table-compact">
            <thead>
              <tr>
                <th>Tenant</th>
                <th>Studio</th>
                <th>Azienda</th>
                <th>Stato billing</th>
                <th>Fatturabile</th>
                <th>AI mese</th>
              </tr>
            </thead>
            <tbody>
              {companies.length === 0 ? (
                <tr>
                  <td colSpan={6} className="billing-empty">
                    Nessuna azienda. Creare aziende dagli studi per avviare la fatturazione.
                  </td>
                </tr>
              ) : (
                companies.map((c) => (
                  <tr key={c.company_id}>
                    <td>{c.organization_name}</td>
                    <td>{c.studio_name}</td>
                    <td>{c.company_name}</td>
                    <td>
                      <span className={`billing-status billing-status-${c.billing_status || "active"}`}>
                        {c.billing_status || "active"}
                      </span>
                    </td>
                    <td>{c.is_billable ? "S - " : "No"}</td>
                    <td>{c.ai_usage_count ?? 0}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="billing-section billing-section-split">
        <div>
          <h2 id="billing-events-heading">Eventi recenti</h2>
          <div className="billing-table-wrap">
            <table className="billing-table billing-table-compact">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Tenant</th>
                  <th>Evento</th>
                  <th>Dettaglio</th>
                </tr>
              </thead>
              <tbody>
                {events.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="billing-empty">
                      Nessun evento registrato.
                    </td>
                  </tr>
                ) : (
                  events.map((ev) => (
                    <tr key={ev.id}>
                      <td>{formatDate(ev.created_at)}</td>
                      <td>{ev.organization_name}</td>
                      <td>{EVENT_LABELS[ev.event_type] || ev.event_type}</td>
                      <td className="billing-event-detail">
                        {ev.company_name && <span>{ev.company_name}</span>}
                        {ev.studio_name && !ev.company_name && <span>{ev.studio_name}</span>}
                        {ev.payload?.modules && (
                          <span className="billing-muted">
                            {" "}
                            ({ev.payload.modules.length} moduli)
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="billing-export-panel" aria-labelledby="billing-export-heading">
          <h2 id="billing-export-heading">Export CSV</h2>
          <p className="billing-export-intro">
            Scarica lo snapshot mensile per contabilit -  e fatturazione verso gli studi.
          </p>
          <label className="billing-export-label">
            Periodo (YYYY-MM)
            <input
              type="text"
              className="billing-export-input"
              value={exportPeriod}
              onChange={(e) => setExportPeriod(e.target.value)}
              placeholder="2026-06"
              pattern="\d{4}-\d{2}"
            />
          </label>
          <button
            type="button"
            className="btn-primary"
            onClick={handleExport}
            disabled={exporting}
          >
            {exporting ? "Export in corso - " : "Scarica CSV"}
          </button>
        </aside>
      </section>
    </div>
  );
}

/**
 * useReprocessTasks — dati + azioni per la sezione "Rielaborazioni disponibili"
 * (28/07/2026). Registro backend in reprocessableFields.js: campi AI-estraibili
 * che possono necessitare backfill su record già in DB dopo cambi schema.
 * Nessuno scheduler automatico: solo conteggio + lancio manuale. La UI mostra
 * solo le voci con candidate_count > 0 (controllo backlog, non catalogo).
 */
function useReprocessTasks(enabled) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [runningKey, setRunningKey] = useState(null);
  const [results, setResults] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiService.getReprocessTasks();
      if (!res.success) throw new Error(res.error || "Errore caricamento task di rielaborazione");
      setTasks(res.tasks || []);
    } catch (e) {
      setError(e.message || "Errore caricamento task di rielaborazione");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (enabled) load();
  }, [enabled, load]);

  const backfillTasks = useMemo(() => tasks.filter((t) => t.kind !== VERIFY_KIND), [tasks]);
  const verifyTasks = useMemo(() => tasks.filter((t) => t.kind === VERIFY_KIND), [tasks]);

  const run = useCallback(async (key) => {
    setRunningKey(key);
    setResults((prev) => ({ ...prev, [key]: null }));
    try {
      const res = await apiService.runReprocessTask(key);
      if (!res.success) throw new Error(res.error || "Rielaborazione non riuscita");
      setResults((prev) => ({ ...prev, [key]: { ok: true, ...res } }));
      await load();
    } catch (e) {
      setResults((prev) => ({ ...prev, [key]: { ok: false, error: e.message || "Rielaborazione non riuscita" } }));
    } finally {
      setRunningKey(null);
    }
  }, [load]);

  // Verifica norma: sola lettura. Nessun reload e nessun decremento locale dei
  // candidati: il numero è uno stato dei record, non un backlog di proposte.
  const runVerify = useCallback(async (key) => {
    setRunningKey(key);
    setResults((prev) => ({ ...prev, [key]: null }));
    try {
      const res = await apiService.runReprocessTask(key);
      if (!res.success) throw new Error(res.error || "Verifica non riuscita");
      setResults((prev) => ({ ...prev, [key]: { ok: true, ...res } }));
    } catch (e) {
      setResults((prev) => ({ ...prev, [key]: { ok: false, error: e.message || "Verifica non riuscita" } }));
    } finally {
      setRunningKey(null);
    }
  }, []);

  const totalCandidates = backfillTasks.reduce((sum, t) => sum + (t.candidate_count || 0), 0);

  return {
    tasks,
    backfillTasks,
    verifyTasks,
    loading,
    error,
    runningKey,
    results,
    run,
    runVerify,
    reload: load,
    totalCandidates,
  };
}

function ReprocessTasksSection({ reprocess }) {
  const { backfillTasks, loading, error, runningKey, results, run, reload } = reprocess;
  // Solo campi con lavoro da fare: non è un catalogo di tutti i campi possibili
  // (28/07/2026 + chiarimento 25/08/2026). A 0 candidati la riga sparisce.
  const pendingTasks = backfillTasks.filter((t) => (t.candidate_count || 0) > 0);

  return (
    <section className="billing-section" aria-labelledby="billing-reprocess-heading">
      <header className="billing-reprocess-header">
        <div>
          <h2 id="billing-reprocess-heading">Rielaborazioni disponibili</h2>
          <p className="billing-reprocess-intro">
            Backfill di campi AI-estraibili su documenti già caricati (Qualifiche saldatori e WPQR), rilanciando
            l'estrazione sul documento originale già presente. Nessun automatismo: ogni rielaborazione va lanciata
            manualmente qui e genera proposte da confermare nella pagina del modulo corrispondente
            ("Rielaborazioni in coda").
          </p>
          <p className="billing-reprocess-hint billing-muted">
            Dopo «Lancia» i candidati scendono (proposta in coda); tornano a zero solo dopo la conferma nel modulo.
          </p>
        </div>
        <button type="button" className="btn-secondary" onClick={reload} disabled={loading}>
          Aggiorna
        </button>
      </header>

      {error && <p className="billing-error">{error}</p>}

      {loading ? (
        <p>Caricamento task di rielaborazione…</p>
      ) : pendingTasks.length === 0 ? (
        <p className="billing-muted">Nessuna rielaborazione in sospeso.</p>
      ) : (
        <div className="billing-table-wrap">
          <table className="billing-table">
            <thead>
              <tr>
                <th>Campo</th>
                <th>Candidati</th>
                <th>Azione</th>
                <th>Esito ultimo lancio</th>
              </tr>
            </thead>
            <tbody>
              {pendingTasks.map((task) => {
                const result = results[task.key];
                const isRunning = runningKey === task.key;
                const anyRunning = !!runningKey;
                const moduleLabel = task.module === "saldatura" ? "Saldatura" : "Qualifiche";
                return (
                  <tr key={task.key}>
                    <td>{task.label}</td>
                    <td>
                      <span className="billing-badge billing-badge-active">
                        {task.candidate_count}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn-primary billing-reprocess-run-btn"
                        onClick={() => run(task.key)}
                        disabled={anyRunning}
                      >
                        {isRunning ? "Rielaborazione in corso…" : "Lancia rielaborazione"}
                      </button>
                    </td>
                    <td className="billing-reprocess-result">
                      {result?.ok && (
                        <span className="billing-ok">
                          {result.proposalsCreated} proposte create, disponibili in {moduleLabel} → Rielaborazioni in coda
                          {result.hasMore ? " (altri candidati restanti, rilancia per continuare)" : ""}.
                        </span>
                      )}
                      {result && !result.ok && <span className="billing-error">{result.error}</span>}
                      {!result && task.error && <span className="billing-error">Conteggio non disponibile: {task.error}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function formatValue(value) {
  if (value === null || value === undefined || value === "") return "";
  if (Array.isArray(value)) return value.map(formatValue).join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

const CSV_HEADER = ["Persona", "Certificato", "Codice avviso", "Avviso", "Letto", "Atteso dalla norma", "Clausola"];

function csvCell(value) {
  let text = formatValue(value);
  // Neutralizza le formule quando il CSV viene aperto in Excel (numeri negativi esclusi).
  if (/^[=+@\t\r]/.test(text) || (/^-/.test(text) && !/^-\d+([.,]\d+)?$/.test(text))) {
    text = `'${text}`;
  }
  return `"${text.replace(/"/g, '""')}"`;
}

export function buildVerifyCsv(items) {
  const rows = [CSV_HEADER];
  (items || []).forEach((item) => {
    (item.findings || []).forEach((f) => {
      rows.push([
        item.person_name,
        item.certificate_number,
        f.code,
        f.message_it,
        f.read_value,
        f.expected_value,
        f.source?.clause,
      ]);
    });
  });
  return rows.map((row) => row.map(csvCell).join(";")).join("\r\n");
}

function downloadVerifyCsv(key, items) {
  const csv = `\uFEFF${buildVerifyCsv(items)}`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${key}_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function VerifyResultBlock({ task, result }) {
  const items = result.items || [];
  const byCode = Object.entries(result.findingsByCode || {});
  const notVerifiable = result.notVerifiable || {};
  const findingRows = items.flatMap((item) =>
    (item.findings || []).map((f, idx) => ({ item, finding: f, idx })),
  );

  return (
    <div className="billing-verify-result" aria-label={`Esito verifica ${task.label}`}>
      <p className="billing-verify-summary">
        <strong>{task.label}</strong>: {result.recordsChecked ?? 0} record controllati,{" "}
        <strong>{result.recordsWithWarnings ?? 0}</strong> con avvisi norma
        {" · "}non verificabili: {notVerifiable.dato_mancante ?? 0} per dato mancante,{" "}
        {notVerifiable.fonte_mancante ?? 0} per fonte mancante.
      </p>
      {byCode.length > 0 && (
        <p className="billing-muted">
          Per tipo di avviso: {byCode.map(([code, n]) => `${code} (${n})`).join(" · ")}
        </p>
      )}
      <p className="billing-muted">
        Il numero dei candidati non scende dopo la verifica: si azzera correggendo i record in Qualifiche.
      </p>
      {result.hasMore && (
        <p className="billing-muted">
          Mostrati i primi {items.length} record: altri record restano da controllare.
        </p>
      )}
      {findingRows.length === 0 ? (
        <p className="billing-muted">Nessun avviso da mostrare.</p>
      ) : (
        <>
          <div className="billing-table-wrap">
            <table className="billing-table billing-table-compact">
              <thead>
                <tr>
                  <th>Persona / Certificato</th>
                  <th>Avviso</th>
                  <th>Letto</th>
                  <th>Atteso dalla norma</th>
                  <th>Clausola</th>
                </tr>
              </thead>
              <tbody>
                {findingRows.map(({ item, finding, idx }) => (
                  <tr key={`${item.id}-${finding.code}-${idx}`}>
                    <td>
                      {item.person_name || " - "}
                      {item.certificate_number ? (
                        <span className="billing-muted"> · {item.certificate_number}</span>
                      ) : null}
                    </td>
                    <td>{finding.message_it}</td>
                    <td>{formatValue(finding.read_value) || " - "}</td>
                    <td>{formatValue(finding.expected_value) || " - "}</td>
                    <td>{finding.source?.clause || " - "}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            type="button"
            className="btn-secondary billing-verify-csv-btn"
            onClick={() => downloadVerifyCsv(task.key, items)}
          >
            Scarica CSV
          </button>
        </>
      )}
    </div>
  );
}

function VerifyTasksSection({ reprocess }) {
  const { verifyTasks, runningKey, results, runVerify } = reprocess;
  const pendingVerify = verifyTasks.filter((t) => (t.candidate_count || 0) > 0);

  if (pendingVerify.length === 0) return null;
  const anyRunning = !!runningKey;

  return (
    <section className="billing-section" aria-labelledby="billing-verify-heading">
      <h2 id="billing-verify-heading">Verifica qualifiche vs norma</h2>
      <p className="billing-reprocess-intro">
        Sola lettura: nessuna modifica ai record, nessuna AI, nessun costo. Confronta i dati delle qualifiche già
        in archivio con i requisiti della norma e segnala gli avvisi; la correzione resta il normale «Modifica» in
        Qualifiche.
      </p>
      <p className="billing-reprocess-hint billing-muted">
        Consigliato: eseguire prima i backfill dei dati di prova, poi la verifica (i record senza dati di prova
        risultano «non verificabili»). Il numero non scende dopo la verifica: si azzera correggendo i record in
        Qualifiche.
      </p>
      <div className="billing-table-wrap">
        <table className="billing-table">
          <thead>
            <tr>
              <th>Verifica</th>
              <th>Record con avvisi norma</th>
              <th>Azione</th>
            </tr>
          </thead>
          <tbody>
            {pendingVerify.map((task) => {
              const isRunning = runningKey === task.key;
              const result = results[task.key];
              return (
                <tr key={task.key}>
                  <td>{task.label}</td>
                  <td>
                    <span className="billing-badge billing-badge-active">{task.candidate_count}</span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn-primary billing-reprocess-run-btn"
                      onClick={() => runVerify(task.key)}
                      disabled={anyRunning}
                      aria-busy={isRunning}
                      title={anyRunning ? "Un'altra operazione è in corso" : "Esegui la verifica in sola lettura"}
                    >
                      {isRunning ? "Verifica in corso…" : "Esegui verifica"}
                    </button>
                    {result && !result.ok && (
                      <p className="billing-error" role="alert">
                        {result.error}
                      </p>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {pendingVerify.map((task) => {
        const result = results[task.key];
        return result?.ok ? <VerifyResultBlock key={task.key} task={task} result={result} /> : null;
      })}
    </section>
  );
}

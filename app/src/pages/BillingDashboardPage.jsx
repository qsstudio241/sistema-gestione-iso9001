/**
 * BillingDashboardPage � dashboard fatturazione (solo superadmin QS Studio)
 */

import React, { useState, useEffect, useCallback } from "react";
import apiService from "../services/apiService";
import { useAuth } from "../contexts/AuthContext";
import "./BillingDashboardPage.css";

const EVENT_LABELS = {
  company_activated: "Azienda attivata",
  company_deactivated: "Azienda disattivata",
  company_reactivated: "Azienda riattivata",
  licenses_updated: "Licenze moduli aggiornate",
};

function formatDate(value) {
  if (!value) return "�";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "�";
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
        <p>Caricamento dashboard fatturazione�</p>
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
            Riepilogo tenant (studi di consulenza), aziende fatturabili e utilizzo AI � periodo{" "}
            <strong>{period}</strong>.
          </p>
        </div>
        <button type="button" className="btn-secondary" onClick={load}>
          Aggiorna
        </button>
      </header>

      {error && <p className="billing-error">{error}</p>}
      {exportMsg && <p className="billing-ok">{exportMsg}</p>}

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
                    <td>{t.vat_number || "�"}</td>
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
                    <td>{c.is_billable ? "S�" : "No"}</td>
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
            Scarica lo snapshot mensile per contabilit� e fatturazione verso gli studi.
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
            {exporting ? "Export in corso�" : "Scarica CSV"}
          </button>
        </aside>
      </section>
    </div>
  );
}

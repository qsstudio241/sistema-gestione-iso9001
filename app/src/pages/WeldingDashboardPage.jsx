/**
 * WeldingDashboardPage — Dashboard Coordinatore ISO 3834
 * Panoramica operativa: commesse, WPS, qualifiche, alert scadenze.
 */

import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "../contexts/RouterContext";
import apiService from "../services/apiService";
import { formatDate } from "../utils/dateHelpers";
import "./WeldingDashboardPage.css";

const PROJECT_STATUS_LABELS = {
  offerta: "Offerta",
  aperta: "Aperta",
  chiusa: "Chiusa",
  sospesa: "Sospesa",
};

function WeldingDashboardPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  const [projectStats, setProjectStats] = useState({ offerta: 0, aperta: 0, chiusa: 0, sospesa: 0 });
  const [wpsCounts, setWpsCounts] = useState({ attiva: 0, bozza: 0 });
  const [qualAlerts, setQualAlerts] = useState({ in_scadenza_30: 0, scadute: 0 });
  const [alerts, setAlerts] = useState([]);
  const [activeProjects, setActiveProjects] = useState([]);
  const [recentActivities, setRecentActivities] = useState([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    const results = await Promise.allSettled([
      apiService.getProjectStats(),
      apiService.getWPSList({ limit: 500 }),
      apiService.getWPQRList({ limit: 500 }),
      apiService.getProjects({ status: "aperta", limit: 10 }),
      apiService.getQualifications({ qualification_type: "iso9606_1", limit: 200 }),
    ]);

    // Project stats
    if (results[0].status === "fulfilled") {
      const s = results[0].value?.data || results[0].value || {};
      setProjectStats({
        offerta: s.offerta || 0,
        aperta: s.aperta || 0,
        chiusa: s.chiusa || 0,
        sospesa: s.sospesa || 0,
      });
    }

    // WPS counts
    if (results[1].status === "fulfilled") {
      const wpsList = results[1].value?.data || [];
      const attiva = wpsList.filter((w) => w.status === "attiva").length;
      const bozza = wpsList.filter((w) => w.status === "bozza").length;
      setWpsCounts({ attiva, bozza });

      // WPS bozza da >30gg
      const now = Date.now();
      const thirtyDays = 30 * 24 * 60 * 60 * 1000;
      const oldDrafts = wpsList.filter((w) => {
        if (w.status !== "bozza") return false;
        const created = new Date(w.created_at || w.createdAt).getTime();
        return now - created > thirtyDays;
      });

      const newAlerts = [];
      if (oldDrafts.length > 0) {
        newAlerts.push({
          type: "warning",
          icon: "\uD83D\uDFE1",
          text: `${oldDrafts.length} WPS in bozza da oltre 30 giorni`,
          action: () => navigate("/saldatura/procedure"),
        });
      }

      // WPQR scadenze
      if (results[2].status === "fulfilled") {
        const wpqrList = results[2].value?.data || [];
        const expiring = wpqrList.filter((w) => {
          if (!w.expiry_date) return false;
          const exp = new Date(w.expiry_date).getTime();
          return exp > now && exp - now < thirtyDays;
        });
        const expired = wpqrList.filter((w) => {
          if (!w.expiry_date) return false;
          return new Date(w.expiry_date).getTime() < now;
        });
        if (expired.length > 0) {
          newAlerts.push({
            type: "danger",
            icon: "\uD83D\uDD34",
            text: `${expired.length} WPQR scaduti`,
            action: () => navigate("/saldatura/procedure"),
          });
        }
        if (expiring.length > 0) {
          newAlerts.push({
            type: "warning",
            icon: "\uD83D\uDFE0",
            text: `${expiring.length} WPQR in scadenza entro 30 giorni`,
            action: () => navigate("/saldatura/procedure"),
          });
        }
      }

      setAlerts(newAlerts);
    }

    // Active projects
    if (results[3].status === "fulfilled") {
      const projects = results[3].value?.data || [];
      setActiveProjects(projects.slice(0, 10));
    }

    // Qualifiche saldatura
    if (results[4].status === "fulfilled") {
      const quals = results[4].value?.qualifications || [];
      const now = Date.now();
      const thirtyDays = 30 * 24 * 60 * 60 * 1000;
      const scadute = quals.filter((q) => q.semaforo === "rosso").length;
      const inScadenza = quals.filter((q) =>
        q.semaforo === "giallo" || q.semaforo === "arancione"
      ).length;
      setQualAlerts({ in_scadenza_30: inScadenza, scadute });

      if (scadute > 0) {
        setAlerts((prev) => [
          {
            type: "danger",
            icon: "\uD83D\uDD34",
            text: `${scadute} qualifiche saldatore scadute`,
            action: () => navigate("/qualifiche?qualification_type=iso9606_1"),
          },
          ...prev,
        ]);
      }
      if (inScadenza > 0) {
        setAlerts((prev) => [
          ...prev,
          {
            type: "warning",
            icon: "\uD83D\uDFE1",
            text: `${inScadenza} qualifiche saldatore in scadenza`,
            action: () => navigate("/qualifiche?qualification_type=iso9606_1"),
          },
        ]);
      }
    }

    setLoading(false);
  }, [navigate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const totalProjects = projectStats.offerta + projectStats.aperta + projectStats.chiusa + projectStats.sospesa;

  return (
    <div className="wd-page">
      {/* Header */}
      <div className="wd-header">
        <div>
          <h2 className="wd-title">Dashboard ISO 3834 - Coordinatore Saldatura</h2>
          <p className="wd-subtitle">Panoramica operativa</p>
        </div>
        <button className="wd-btn-reload" onClick={loadData} title="Aggiorna">&#x21bb;</button>
      </div>

      {loading ? (
        <div className="wd-loading"><div className="wd-spinner" /><span>Caricamento...</span></div>
      ) : (
        <>
          {/* Card riassuntive */}
          <div className="wd-cards">
            <div className="wd-card wd-card-projects" onClick={() => navigate("/saldatura/commesse")}>
              <div className="wd-card-icon">{"\uD83D\uDCCB"}</div>
              <div className="wd-card-body">
                <span className="wd-card-value">{totalProjects}</span>
                <span className="wd-card-label">Commesse</span>
                <div className="wd-card-detail">
                  <span className="wd-detail-item wd-detail-green">{projectStats.aperta} attive</span>
                  <span className="wd-detail-item wd-detail-blue">{projectStats.offerta} offerta</span>
                  <span className="wd-detail-item wd-detail-gray">{projectStats.chiusa} chiuse</span>
                </div>
              </div>
              <span className="wd-card-arrow">{"\u203A"}</span>
            </div>

            <div className="wd-card wd-card-wps" onClick={() => navigate("/saldatura/procedure")}>
              <div className="wd-card-icon">{"\uD83D\uDD27"}</div>
              <div className="wd-card-body">
                <span className="wd-card-value">{wpsCounts.attiva + wpsCounts.bozza}</span>
                <span className="wd-card-label">WPS</span>
                <div className="wd-card-detail">
                  <span className="wd-detail-item wd-detail-green">{wpsCounts.attiva} attive</span>
                  <span className="wd-detail-item wd-detail-gray">{wpsCounts.bozza} bozza</span>
                </div>
              </div>
              <span className="wd-card-arrow">{"\u203A"}</span>
            </div>

            <div className="wd-card wd-card-qual" onClick={() => navigate("/qualifiche?qualification_type=iso9606_1")}>
              <div className="wd-card-icon">{"\uD83C\uDF93"}</div>
              <div className="wd-card-body">
                <span className="wd-card-value">{qualAlerts.in_scadenza_30 + qualAlerts.scadute}</span>
                <span className="wd-card-label">Qualifiche saldatura</span>
                <div className="wd-card-detail">
                  {qualAlerts.scadute > 0 && (
                    <span className="wd-detail-item wd-detail-red">{qualAlerts.scadute} scadute</span>
                  )}
                  {qualAlerts.in_scadenza_30 > 0 && (
                    <span className="wd-detail-item wd-detail-orange">{qualAlerts.in_scadenza_30} in scadenza</span>
                  )}
                  {qualAlerts.scadute === 0 && qualAlerts.in_scadenza_30 === 0 && (
                    <span className="wd-detail-item wd-detail-green">Tutte valide</span>
                  )}
                </div>
              </div>
              <span className="wd-card-arrow">{"\u203A"}</span>
            </div>
          </div>

          {/* Alert */}
          {alerts.length > 0 && (
            <section className="wd-section">
              <h3 className="wd-section-title wd-section-title-alert">{"\u26A0\uFE0F"} Alert</h3>
              <div className="wd-alerts">
                {alerts.map((a, i) => (
                  <div
                    key={i}
                    className={`wd-alert wd-alert-${a.type}`}
                    onClick={a.action}
                  >
                    <span className="wd-alert-icon">{a.icon}</span>
                    <span className="wd-alert-text">{a.text}</span>
                    <span className="wd-alert-arrow">{"\u203A"}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Commesse attive */}
          <section className="wd-section">
            <h3 className="wd-section-title">Commesse attive</h3>
            {activeProjects.length === 0 ? (
              <div className="wd-empty">
                <p>Nessuna commessa attiva.</p>
                <button className="wd-btn-new" onClick={() => navigate("/saldatura/commesse")}>
                  Vai alle commesse
                </button>
              </div>
            ) : (
              <div className="wd-table-wrap">
                <table className="wd-table">
                  <thead>
                    <tr>
                      <th>Codice</th>
                      <th>Cliente</th>
                      <th>Stato</th>
                      <th>Inizio</th>
                      <th>Fine</th>
                      <th>Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeProjects.map((p) => (
                      <tr key={p.id} onClick={() => navigate("/saldatura/commesse")} className="wd-row-click">
                        <td><strong>{p.project_code}</strong></td>
                        <td>{p.client_name || "-"}</td>
                        <td>
                          <span className={`wd-status wd-status-${p.status || "aperta"}`}>
                            {PROJECT_STATUS_LABELS[p.status] || p.status || "Aperta"}
                          </span>
                        </td>
                        <td>{formatDate(p.start_date)}</td>
                        <td>{formatDate(p.end_date)}</td>
                        <td className="wd-notes-cell">{p.notes ? p.notes.substring(0, 40) + (p.notes.length > 40 ? "..." : "") : "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

export default WeldingDashboardPage;

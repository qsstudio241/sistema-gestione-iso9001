import React, { useState, useEffect, useCallback } from "react";
import apiService from "../services/apiService";
import { useAuth } from "../contexts/AuthContext";
import "./KnowledgeHealthPage.css";

const TYPE_LABELS = {
  audit_conclusion: "Audit",
  non_conformity: "NC",
  qualification: "Qualifiche",
  risk: "Rischi",
  document: "Documenti",
  complaint: "Reclami",
};

function KnowledgeHealthPage() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const isAdmin = user?.role === "admin" || user?.role === "superadmin";

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiService.getKnowledgeHealth();
      setData(res);
    } catch (err) {
      setError(err.message || "Errore nel caricamento dei dati");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) loadData();
    else setLoading(false);
  }, [isAdmin, loadData]);

  if (!isAdmin) {
    return (
      <div className="kh-access-denied">
        <div className="kh-access-denied-icon">??</div>
        <h3>Accesso riservato</h3>
        <p>Questa pagina è accessibile solo agli amministratori.</p>
      </div>
    );
  }

  if (loading) return <LoadingSkeleton />;

  if (error) {
    return (
      <div className="kh-error">
        <div className="kh-error-icon">??</div>
        <h3>Errore di caricamento</h3>
        <p>{error}</p>
        <button className="kh-error-retry" onClick={loadData}>Riprova</button>
      </div>
    );
  }

  if (!data) return null;

  const activeChunks = (data.totalChunks || 0) - (data.staleChunks || 0);
  const qualityPct = Math.round((data.retrievalQuality || 0) * 100);
  const avgTime = ((data.avgResponseTime || 0) / 1000).toFixed(1);
  const queries30d = data.recentUsage?.totalQueries30d || 0;

  const qualityColor = qualityPct > 70 ? "green" : qualityPct >= 50 ? "yellow" : "red";
  const timeColor = parseFloat(avgTime) < 3 ? "green" : parseFloat(avgTime) <= 5 ? "yellow" : "red";

  return (
    <div className="kh-page">
      {/* A) Header */}
      <div className="kh-header">
        <h2>
          <span className="kh-header-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
          </span>
          Knowledge Health
        </h2>
        <p>Stato e performance della base di conoscenza AI</p>
      </div>

      {/* B) KPI Cards */}
      <div className="kh-kpi-row">
        <div className="kh-kpi-card kpi-blue">
          <span className="kh-kpi-label">Chunk attivi</span>
          <span className="kh-kpi-value">{activeChunks.toLocaleString("it-IT")}</span>
          <span className="kh-kpi-sub">su {(data.totalChunks || 0).toLocaleString("it-IT")} totali</span>
        </div>

        <div className={`kh-kpi-card kpi-${qualityColor}`}>
          <span className="kh-kpi-label">Qualità retrieval</span>
          <QualityRing value={qualityPct} color={qualityColor} />
          <span className="kh-kpi-sub">accuratezza risposte</span>
        </div>

        <div className={`kh-kpi-card kpi-${timeColor}`}>
          <span className="kh-kpi-label">Tempo risposta</span>
          <span className="kh-kpi-value">{avgTime}s</span>
          <span className="kh-kpi-sub">media ultimi 30gg</span>
        </div>

        <div className="kh-kpi-card kpi-blue">
          <span className="kh-kpi-label">Domande (30gg)</span>
          <span className="kh-kpi-value">{queries30d}</span>
          <span className="kh-kpi-sub">query all'assistente</span>
        </div>
      </div>

      {/* C) Coverage table */}
      <CoverageTable coverage={data.companyCoverage} />

      {/* D+E grid */}
      <div className="kh-grid-2">
        <GapsCard gaps={data.gapsDetected} />
        <TopCompaniesCard topCompanies={data.recentUsage?.topCompanies} />
      </div>

      {/* F) Optimizer run */}
      <OptimizerCard run={data.lastOptimizationRun} />
    </div>
  );
}

/* ?? Quality ring (SVG circular progress) ???????????????????????????????????? */

function QualityRing({ value, color }) {
  const r = 26;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (value / 100) * circumference;
  const strokeColor = color === "green" ? "#38a169" : color === "yellow" ? "#d69e2e" : "#e53e3e";
  const textColor = color === "green" ? "#276749" : color === "yellow" ? "#975a16" : "#c53030";

  return (
    <div className="kh-quality-ring">
      <svg width="64" height="64" viewBox="0 0 64 64">
        <circle className="kh-quality-ring-bg" cx="32" cy="32" r={r} />
        <circle
          className="kh-quality-ring-fg"
          cx="32" cy="32" r={r}
          stroke={strokeColor}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <span className="kh-quality-ring-value" style={{ color: textColor }}>{value}%</span>
    </div>
  );
}

/* ?? Coverage table ?????????????????????????????????????????????????????????? */

function CoverageTable({ coverage }) {
  if (!coverage || coverage.length === 0) return null;

  const cols = ["audit_conclusion", "non_conformity", "qualification", "risk", "document", "complaint"];
  const totals = {};
  cols.forEach(c => { totals[c] = 0; });
  let grandTotal = 0;

  coverage.forEach(row => {
    cols.forEach(c => {
      const v = row[c] || 0;
      totals[c] += v;
      grandTotal += v;
    });
  });

  return (
    <div className="kh-section">
      <div className="kh-section-title">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2b6cb0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <line x1="3" y1="9" x2="21" y2="9" />
          <line x1="9" y1="3" x2="9" y2="21" />
        </svg>
        Coverage per azienda
      </div>
      <div className="kh-table-wrap">
        <table className="kh-table">
          <thead>
            <tr>
              <th>Azienda</th>
              {cols.map(c => <th key={c}>{TYPE_LABELS[c]}</th>)}
              <th>Totale</th>
            </tr>
          </thead>
          <tbody>
            {coverage.map(row => {
              const rowTotal = cols.reduce((s, c) => s + (row[c] || 0), 0);
              return (
                <tr key={row.companyId}>
                  <td>{row.companyName}</td>
                  {cols.map(c => (
                    <td key={c}>
                      <span className={`kh-cell-count ${(row[c] || 0) === 0 ? "kh-cell-zero" : "kh-cell-ok"}`}>
                        {row[c] || 0}
                      </span>
                    </td>
                  ))}
                  <td><strong>{rowTotal}</strong></td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td>Totale</td>
              {cols.map(c => <td key={c}>{totals[c]}</td>)}
              <td><strong>{grandTotal}</strong></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

/* ?? Gaps card ??????????????????????????????????????????????????????????????? */

function GapsCard({ gaps }) {
  return (
    <div className="kh-section">
      <div className="kh-section-title">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d69e2e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        Gap rilevati
      </div>
      {(!gaps || gaps.length === 0) ? (
        <div className="kh-no-gap">
          <span style={{ fontSize: 20 }}>?</span>
          Nessun gap rilevato — tutte le aziende hanno copertura completa
        </div>
      ) : (
        <ul className="kh-gap-list">
          {gaps.map((g, i) => (
            <li key={i} className="kh-gap-item">
              <span className="kh-gap-icon">??</span>
              <div>
                <div className="kh-gap-company">{g.companyName}</div>
                <div className="kh-gap-types">
                  mancano: {(g.missingTypes || []).map(t => TYPE_LABELS[t] || t).join(", ")}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ?? Top companies bar chart ????????????????????????????????????????????????? */

function TopCompaniesCard({ topCompanies }) {
  const items = (topCompanies || []).slice(0, 5);
  const max = items.reduce((m, c) => Math.max(m, c.queryCount || 0), 1);

  return (
    <div className="kh-section">
      <div className="kh-section-title">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2b6cb0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="20" x2="18" y2="10" />
          <line x1="12" y1="20" x2="12" y2="4" />
          <line x1="6" y1="20" x2="6" y2="14" />
        </svg>
        Aziende più consultate
      </div>
      {items.length === 0 ? (
        <div className="kh-no-gap" style={{ color: "#718096" }}>
          Nessuna query registrata negli ultimi 30 giorni
        </div>
      ) : (
        <div className="kh-bars">
          {items.map((c, i) => (
            <div key={i} className="kh-bar-row">
              <span className="kh-bar-name" title={c.companyName}>{c.companyName}</span>
              <div className="kh-bar-track">
                <div
                  className="kh-bar-fill"
                  style={{ width: `${Math.max((c.queryCount / max) * 100, 4)}%` }}
                />
              </div>
              <span className="kh-bar-count">{c.queryCount}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ?? Optimizer run card ?????????????????????????????????????????????????????? */

function OptimizerCard({ run }) {
  if (!run) return null;

  const statusClass = run.status === "completed" ? "status-completed"
    : run.status === "failed" ? "status-failed"
    : "status-running";

  const statusIcon = run.status === "completed" ? "?"
    : run.status === "failed" ? "?"
    : "?";

  const statusLabel = run.status === "completed" ? "Completato"
    : run.status === "failed" ? "Fallito"
    : "In corso";

  const runTypeLabel = run.run_type === "dedup" ? "Deduplicazione"
    : run.run_type === "refresh" ? "Refresh"
    : run.run_type || "—";

  const dateStr = run.started_at
    ? new Date(run.started_at).toLocaleString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "—";

  return (
    <div className="kh-section">
      <div className="kh-section-title">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#718096" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
        Ultimo optimizer run
      </div>
      <div className="kh-optim-info">
        <span className={`kh-optim-badge ${statusClass}`}>
          {statusIcon} {statusLabel}
        </span>
        <span className="kh-optim-detail"><strong>Tipo:</strong> {runTypeLabel}</span>
        <span className="kh-optim-detail"><strong>Data:</strong> {dateStr}</span>
        {run.chunks_removed != null && (
          <span className="kh-optim-detail"><strong>Chunk rimossi:</strong> {run.chunks_removed}</span>
        )}
        {run.chunks_created != null && (
          <span className="kh-optim-detail"><strong>Chunk creati:</strong> {run.chunks_created}</span>
        )}
      </div>
    </div>
  );
}

/* ?? Loading skeleton ???????????????????????????????????????????????????????? */

function LoadingSkeleton() {
  return (
    <div className="kh-page">
      <div className="kh-skeleton kh-skeleton-header" />
      <div className="kh-kpi-row">
        {[1, 2, 3, 4].map(i => <div key={i} className="kh-skeleton kh-skeleton-kpi" />)}
      </div>
      <div className="kh-skeleton kh-skeleton-section" />
      <div className="kh-grid-2">
        <div className="kh-skeleton kh-skeleton-section" />
        <div className="kh-skeleton kh-skeleton-section" />
      </div>
    </div>
  );
}

export default KnowledgeHealthPage;

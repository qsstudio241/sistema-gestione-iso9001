/**
 * Metrics Dashboard Component
 * Dashboard metriche audit per valutazione prestazioni (punto 9.1 ISO 9001:2015)
 * Sistema Gestione ISO 9001 - QS Studio
 */

import React from "react";
import { useStorage } from "../contexts/StorageContext";
import { useAuditMetrics } from "../hooks/useAuditMetrics";
import { NC_CATEGORY, NC_STATUS } from "../data/auditDataModel";
import { calculateNormCompletion } from "../utils/auditUtils";
import "./MetricsDashboard.css";

function MetricsDashboard() {
  const { currentAudit, audits } = useStorage();
  const metrics = useAuditMetrics(currentAudit);

  if (!currentAudit) {
    return (
      <div className="metrics-dashboard empty">
        <p>Seleziona un audit per visualizzare le metriche</p>
      </div>
    );
  }

  // Calcolo metriche NC
  const ncStats = {
    total: currentAudit.nonConformities?.length || 0,
    major:
      currentAudit.nonConformities?.filter(
        (nc) => nc.category === NC_CATEGORY.MAJOR
      ).length || 0,
    minor:
      currentAudit.nonConformities?.filter(
        (nc) => nc.category === NC_CATEGORY.MINOR
      ).length || 0,
    observation:
      currentAudit.nonConformities?.filter(
        (nc) => nc.category === NC_CATEGORY.OBSERVATION
      ).length || 0,
    open:
      currentAudit.nonConformities?.filter((nc) => nc.status === NC_STATUS.OPEN)
        .length || 0,
    resolved:
      currentAudit.nonConformities?.filter(
        (nc) =>
          nc.status === NC_STATUS.VERIFIED || nc.status === NC_STATUS.COMPLETED
      ).length || 0,
  };

  // Calcolo completamento per norma
  const normCompletions = currentAudit.metadata.selectedStandards.map(
    (norm) => {
      const stats = calculateNormCompletion(currentAudit.checklist, norm);
      return {
        norm,
        percentage: stats.percentage,
        compliant: stats.compliant,
        total: stats.total,
      };
    }
  );

  // Statistiche evidenze (evidences è un oggetto, non array)
  const evidencesArray = Object.values(currentAudit.evidences || {});
  const evidenceStats = {
    total: evidencesArray.length,
    documents: evidencesArray.filter((e) => e.type === "document").length || 0,
    photos: evidencesArray.filter((e) => e.type === "photo").length || 0,
    records: evidencesArray.filter((e) => e.type === "record").length || 0,
  };

  // Statistiche pending issues
  const pendingIssues = currentAudit.pendingIssues || [];
  const pendingStats = {
    total: pendingIssues.length,
    fromPrevious: pendingIssues.filter((i) => i.fromAuditNumber).length || 0,
    resolved: pendingIssues.filter((i) => i.resolved).length || 0,
  };

  return (
    <div className="metrics-dashboard">
      <div className="metrics-header">
        <h3>📊 Dashboard Metriche (Punto 9.1)</h3>
        <p className="metrics-description">
          Monitoraggio e valutazione delle prestazioni del Sistema di Gestione
        </p>
      </div>

      {/* Overview Cards */}
      <div className="metrics-overview">
        <div className="metric-card primary">
          <div className="metric-icon">✓</div>
          <div className="metric-value">{metrics.completionPercentage}%</div>
          <div className="metric-label">Completamento Checklist</div>
          <div className="metric-detail">
            {metrics.compliantCount}/{metrics.totalQuestions} domande conformi
          </div>
        </div>

        <div className="metric-card warning">
          <div className="metric-icon">⚠️</div>
          <div className="metric-value">{ncStats.total}</div>
          <div className="metric-label">Non Conformità</div>
          <div className="metric-detail">
            {ncStats.major} Major • {ncStats.minor} Minor •{" "}
            {ncStats.observation} Osservazioni
          </div>
        </div>

        <div className="metric-card info">
          <div className="metric-icon">📎</div>
          <div className="metric-value">{evidenceStats.total}</div>
          <div className="metric-label">Evidenze Raccolte</div>
          <div className="metric-detail">
            {evidenceStats.documents} Documenti • {evidenceStats.photos} Foto
          </div>
        </div>

        <div className="metric-card accent">
          <div className="metric-icon">⏳</div>
          <div className="metric-value">{pendingStats.total}</div>
          <div className="metric-label">Pending Issues</div>
          <div className="metric-detail">
            {pendingStats.resolved} risolti •{" "}
            {pendingStats.total - pendingStats.resolved} aperti
          </div>
        </div>
      </div>

      {/* Completamento per Norma */}
      {normCompletions.length > 1 && (
        <div className="metrics-section">
          <h4>Completamento per Norma</h4>
          <div className="norm-progress-grid">
            {normCompletions.map(({ norm, percentage, compliant, total }) => (
              <div key={norm} className="norm-progress-card">
                <div className="norm-progress-header">
                  <span className="norm-label">{norm.replace("_", " ")}</span>
                  <span className="norm-percentage">{percentage}%</span>
                </div>
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <div className="norm-progress-detail">
                  {compliant}/{total} domande conformi
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* NC Breakdown */}
      {ncStats.total > 0 && (
        <div className="metrics-section">
          <h4>Analisi Non Conformità</h4>
          <div className="nc-breakdown">
            <div className="nc-chart">
              <div className="nc-bar-group">
                <div className="nc-bar-label">Per Categoria</div>
                <div className="nc-bars">
                  <div
                    className="nc-bar major"
                    style={{
                      width: `${(ncStats.major / ncStats.total) * 100}%`,
                    }}
                  >
                    <span className="nc-bar-value">{ncStats.major}</span>
                  </div>
                  <div
                    className="nc-bar minor"
                    style={{
                      width: `${(ncStats.minor / ncStats.total) * 100}%`,
                    }}
                  >
                    <span className="nc-bar-value">{ncStats.minor}</span>
                  </div>
                  <div
                    className="nc-bar observation"
                    style={{
                      width: `${(ncStats.observation / ncStats.total) * 100}%`,
                    }}
                  >
                    <span className="nc-bar-value">{ncStats.observation}</span>
                  </div>
                </div>
              </div>

              <div className="nc-bar-group">
                <div className="nc-bar-label">Per Status</div>
                <div className="nc-bars">
                  <div
                    className="nc-bar open"
                    style={{
                      width: `${(ncStats.open / ncStats.total) * 100}%`,
                    }}
                  >
                    <span className="nc-bar-value">{ncStats.open}</span>
                  </div>
                  <div
                    className="nc-bar resolved"
                    style={{
                      width: `${(ncStats.resolved / ncStats.total) * 100}%`,
                    }}
                  >
                    <span className="nc-bar-value">{ncStats.resolved}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="nc-legend">
              <div className="legend-item">
                <span className="legend-color major"></span>
                <span>Major ({ncStats.major})</span>
              </div>
              <div className="legend-item">
                <span className="legend-color minor"></span>
                <span>Minor ({ncStats.minor})</span>
              </div>
              <div className="legend-item">
                <span className="legend-color observation"></span>
                <span>Osservazioni ({ncStats.observation})</span>
              </div>
              <div className="legend-item">
                <span className="legend-color open"></span>
                <span>Aperte ({ncStats.open})</span>
              </div>
              <div className="legend-item">
                <span className="legend-color resolved"></span>
                <span>Risolte ({ncStats.resolved})</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Timeline e Date Chiave */}
      <div className="metrics-section">
        <h4>Timeline Audit</h4>
        <div className="timeline-card">
          <div className="timeline-item">
            <div className="timeline-label">Data Audit</div>
            <div className="timeline-value">
              {new Date(currentAudit.metadata.auditDate).toLocaleDateString(
                "it-IT"
              )}
            </div>
          </div>
          <div className="timeline-item">
            <div className="timeline-label">Ultima Modifica</div>
            <div className="timeline-value">
              {new Date(currentAudit.metadata.lastModified).toLocaleDateString(
                "it-IT"
              )}
            </div>
          </div>
          <div className="timeline-item">
            <div className="timeline-label">Status</div>
            <div
              className={`timeline-value status-badge ${currentAudit.metadata.status}`}
            >
              {currentAudit.metadata.status}
            </div>
          </div>
          <div className="timeline-item">
            <div className="timeline-label">Auditor</div>
            <div className="timeline-value">
              {currentAudit.metadata.auditor}
            </div>
          </div>
        </div>
      </div>

      {/* Storico Audit Cliente */}
      <div className="metrics-section">
        <h4>Storico Audit - {currentAudit.metadata.clientName}</h4>
        <AuditHistory
          clientName={currentAudit.metadata.clientName}
          audits={audits}
          currentAuditId={currentAudit.id}
        />
      </div>
    </div>
  );
}

// === AUDIT HISTORY COMPONENT ===

function AuditHistory({ clientName, audits, currentAuditId }) {
  const clientAudits = audits
    .filter((audit) => audit.metadata.clientName === clientName)
    .sort(
      (a, b) => new Date(b.metadata.auditDate) - new Date(a.metadata.auditDate)
    );

  if (clientAudits.length <= 1) {
    return (
      <div className="history-empty">
        <p>Nessun audit precedente per questo cliente</p>
      </div>
    );
  }

  return (
    <div className="audit-history">
      {clientAudits.map((audit) => {
        const isCurrent = audit.id === currentAuditId;
        const ncCount = audit.nonConformities?.length || 0;
        const completion = audit.metrics?.completionPercentage || 0;

        return (
          <div
            key={audit.id}
            className={`history-item ${isCurrent ? "current" : ""}`}
          >
            <div className="history-header">
              <span className="history-number">
                {audit.metadata.auditNumber}
              </span>
              {isCurrent && <span className="current-badge">Corrente</span>}
            </div>
            <div className="history-date">
              {new Date(audit.metadata.auditDate).toLocaleDateString("it-IT")}
            </div>
            <div className="history-stats">
              <span className="history-stat">
                <strong>{completion}%</strong> completato
              </span>
              <span className="history-stat">
                <strong>{ncCount}</strong> NC
              </span>
            </div>
            <div className="history-norms">
              {audit.metadata.selectedStandards.map((norm) => (
                <span key={norm} className="history-norm-badge">
                  {norm.replace("_", " ")}
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default MetricsDashboard;

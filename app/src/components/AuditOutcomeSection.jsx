/**
 * AuditOutcomeSection - Tab 11 Esito Audit
 * Componente per la gestione dell'esito finale dell'audit
 */

import { useState, useEffect } from "react";
import { useStorage } from "../contexts/StorageContext";
import { calculateFindingsMetrics } from "../utils/metricsCalculator";
import "./AuditOutcomeSection.css";

function AuditOutcomeSection({ auditOutcome, onUpdate }) {
  const { currentAudit } = useStorage();

  // Stato locale per editing
  const [conclusions, setConclusions] = useState(
    auditOutcome?.conclusions || ""
  );
  const [emergingSummary, setEmergingSummary] = useState(
    auditOutcome?.emergingFindings?.summary || ""
  );
  const [attachments, setAttachments] = useState(
    auditOutcome?.attachments || []
  );
  const [distribution, setDistribution] = useState(
    auditOutcome?.distribution || []
  );
  const [newAttachment, setNewAttachment] = useState("");
  const [newDistribution, setNewDistribution] = useState("");

  // Calcola metriche real-time dalla checklist
  const [metrics, setMetrics] = useState({
    totalNC: 0,
    totalOSS: 0,
    totalOM: 0,
  });

  useEffect(() => {
    if (currentAudit?.checklist) {
      const calculatedMetrics = calculateFindingsMetrics(
        currentAudit.checklist
      );
      setMetrics({
        totalNC: calculatedMetrics.totalNC,
        totalOSS: calculatedMetrics.totalOSS,
        totalOM: calculatedMetrics.totalOM,
      });

      // Auto-aggiorna auditOutcome con metriche calcolate
      if (
        calculatedMetrics.totalNC !== auditOutcome?.emergingFindings?.totalNC ||
        calculatedMetrics.totalOSS !==
          auditOutcome?.emergingFindings?.totalOSS ||
        calculatedMetrics.totalOM !== auditOutcome?.emergingFindings?.totalOM
      ) {
        onUpdate({
          ...auditOutcome,
          emergingFindings: {
            ...auditOutcome?.emergingFindings,
            totalNC: calculatedMetrics.totalNC,
            totalOSS: calculatedMetrics.totalOSS,
            totalOM: calculatedMetrics.totalOM,
          },
        });
      }
    }
  }, [currentAudit?.checklist, auditOutcome, onUpdate]);

  // Handler aggiornamento conclusioni
  const handleConclusionsChange = (e) => {
    const value = e.target.value;
    setConclusions(value);
    onUpdate({
      ...auditOutcome,
      conclusions: value,
    });
  };

  // Handler aggiornamento rilievi emergenti
  const handleEmergingSummaryChange = (e) => {
    const value = e.target.value;
    setEmergingSummary(value);
    onUpdate({
      ...auditOutcome,
      emergingFindings: {
        ...auditOutcome?.emergingFindings,
        summary: value,
      },
    });
  };

  // Handler aggiungi allegato
  const handleAddAttachment = () => {
    if (!newAttachment.trim()) return;
    const updatedAttachments = [...attachments, newAttachment.trim()];
    setAttachments(updatedAttachments);
    setNewAttachment("");
    onUpdate({
      ...auditOutcome,
      attachments: updatedAttachments,
    });
  };

  // Handler rimuovi allegato
  const handleRemoveAttachment = (index) => {
    const updatedAttachments = attachments.filter((_, i) => i !== index);
    setAttachments(updatedAttachments);
    onUpdate({
      ...auditOutcome,
      attachments: updatedAttachments,
    });
  };

  // Handler aggiungi destinatario
  const handleAddDistribution = () => {
    if (!newDistribution.trim()) return;
    const updatedDistribution = [...distribution, newDistribution.trim()];
    setDistribution(updatedDistribution);
    setNewDistribution("");
    onUpdate({
      ...auditOutcome,
      distribution: updatedDistribution,
    });
  };

  // Handler rimuovi destinatario
  const handleRemoveDistribution = (index) => {
    const updatedDistribution = distribution.filter((_, i) => i !== index);
    setDistribution(updatedDistribution);
    onUpdate({
      ...auditOutcome,
      distribution: updatedDistribution,
    });
  };

  // Calcola metriche da checklist (passate come prop o calcolate)
  const totalNC = metrics.totalNC;
  const totalOSS = metrics.totalOSS;
  const totalOM = metrics.totalOM;

  return (
    <div className="audit-outcome-section">
      {/* ==================== CONCLUSIONI DELL'AUDIT ==================== */}
      <div className="outcome-block">
        <h3 className="outcome-block-title">
          <span className="block-icon">📝</span>
          Conclusioni dell'Audit
        </h3>
        <div className="form-group">
          <label htmlFor="conclusions">
            Sintesi generale dell'esito dell'audit
          </label>
          <textarea
            id="conclusions"
            className="outcome-textarea"
            rows={6}
            placeholder="Descrivere le conclusioni generali dell'audit, il livello di conformità del sistema di gestione, e il giudizio complessivo sull'efficacia dei processi..."
            value={conclusions}
            onChange={handleConclusionsChange}
          />
          <p className="field-hint">
            Esempio: "Il sistema di gestione per la qualità risulta
            complessivamente efficace e conforme ai requisiti della norma UNI EN
            ISO 9001:2015..."
          </p>
        </div>
      </div>

      {/* ==================== RILIEVI EMERGENTI ==================== */}
      <div className="outcome-block">
        <h3 className="outcome-block-title">
          <span className="block-icon">🔍</span>
          Rilievi Emergenti
        </h3>

        {/* Metriche findings */}
        <div className="findings-metrics">
          <div className="metric-card nc">
            <div className="metric-value">{totalNC}</div>
            <div className="metric-label">Non Conformità (NC)</div>
          </div>
          <div className="metric-card oss">
            <div className="metric-value">{totalOSS}</div>
            <div className="metric-label">Osservazioni (OSS)</div>
          </div>
          <div className="metric-card om">
            <div className="metric-value">{totalOM}</div>
            <div className="metric-label">
              Opportunità di Miglioramento (OM)
            </div>
          </div>
        </div>

        {/* Sommario rilievi */}
        <div className="form-group">
          <label htmlFor="emerging-summary">
            Descrizione sintetica dei rilievi emergenti
          </label>
          <textarea
            id="emerging-summary"
            className="outcome-textarea"
            rows={4}
            placeholder="Descrivere i principali rilievi identificati durante l'audit, con particolare attenzione alle aree di miglioramento..."
            value={emergingSummary}
            onChange={handleEmergingSummaryChange}
          />
          <p className="field-hint">
            Esempio: "Durante l'audit sono stati identificati alcuni spunti di
            miglioramento relativi alla gestione documentale e alla formazione
            del personale."
          </p>
        </div>

        {/* Link ai rilievi dettagliati */}
        <div className="findings-link">
          <p className="info-message">
            ℹ️ I rilievi dettagliati (NC, OSS, OM) sono compilati nella sezione{" "}
            <strong>Checklist</strong> per ogni domanda normativa
          </p>
        </div>
      </div>

      {/* ==================== ALLEGATI ==================== */}
      <div className="outcome-block">
        <h3 className="outcome-block-title">
          <span className="block-icon">📎</span>
          Allegati
        </h3>

        {/* Lista allegati */}
        <div className="items-list">
          {attachments.length === 0 ? (
            <p className="empty-message">Nessun allegato inserito</p>
          ) : (
            <ul className="items-list-ul">
              {attachments.map((attachment, index) => (
                <li key={index} className="list-item">
                  <span className="item-text">{attachment}</span>
                  <button
                    className="btn-remove-item"
                    onClick={() => handleRemoveAttachment(index)}
                    title="Rimuovi allegato"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Aggiungi allegato */}
        <div className="add-item-form">
          <input
            type="text"
            className="add-item-input"
            placeholder="Es: Check-list compilata, Evidenze fotografiche..."
            value={newAttachment}
            onChange={(e) => setNewAttachment(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddAttachment();
              }
            }}
          />
          <button
            className="btn btn-primary btn-add-item"
            onClick={handleAddAttachment}
          >
            + Aggiungi Allegato
          </button>
        </div>
      </div>

      {/* ==================== DISTRIBUZIONE ==================== */}
      <div className="outcome-block">
        <h3 className="outcome-block-title">
          <span className="block-icon">📧</span>
          Distribuzione Report
        </h3>

        {/* Lista destinatari */}
        <div className="items-list">
          {distribution.length === 0 ? (
            <p className="empty-message">Nessun destinatario inserito</p>
          ) : (
            <ul className="items-list-ul">
              {distribution.map((recipient, index) => (
                <li key={index} className="list-item">
                  <span className="item-text">{recipient}</span>
                  <button
                    className="btn-remove-item"
                    onClick={() => handleRemoveDistribution(index)}
                    title="Rimuovi destinatario"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Aggiungi destinatario */}
        <div className="add-item-form">
          <input
            type="text"
            className="add-item-input"
            placeholder="Es: Direzione Generale, Responsabile Qualità..."
            value={newDistribution}
            onChange={(e) => setNewDistribution(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddDistribution();
              }
            }}
          />
          <button
            className="btn btn-primary btn-add-item"
            onClick={handleAddDistribution}
          >
            + Aggiungi Destinatario
          </button>
        </div>
      </div>

      {/* ==================== RIEPILOGO FINALE ==================== */}
      <div className="outcome-summary">
        <div className="summary-header">
          <span className="summary-icon">✅</span>
          <h3>Riepilogo Esito Audit</h3>
        </div>
        <div className="summary-stats">
          <div className="summary-stat">
            <span className="stat-label">Non Conformità:</span>
            <span className="stat-value nc">{totalNC}</span>
          </div>
          <div className="summary-stat">
            <span className="stat-label">Osservazioni:</span>
            <span className="stat-value oss">{totalOSS}</span>
          </div>
          <div className="summary-stat">
            <span className="stat-label">Opportunità Miglioramento:</span>
            <span className="stat-value om">{totalOM}</span>
          </div>
          <div className="summary-stat">
            <span className="stat-label">Allegati:</span>
            <span className="stat-value">{attachments.length}</span>
          </div>
          <div className="summary-stat">
            <span className="stat-label">Destinatari:</span>
            <span className="stat-value">{distribution.length}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AuditOutcomeSection;

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
  // RIMOSSO: emergingSummary (Descrizione sintetica rilievi)
  // RIMOSSO: attachments (allegati ora gestiti per domanda)
  const [distribution, setDistribution] = useState(
    auditOutcome?.distribution || []
  );
  // RIMOSSO: newAttachment
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

  // RIMOSSO: handleEmergingSummaryChange
  // RIMOSSO: handleAddAttachment, handleRemoveAttachment

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

        {/* Metriche findings - COMPATTE SU UNA RIGA */}
        <div className="findings-metrics-compact">
          <span className="metric-compact nc">
            <strong>C:</strong>{" "}
            {currentAudit?.checklist
              ? Object.values(currentAudit.checklist.ISO_9001 || {}).reduce(
                  (total, clause) =>
                    total +
                    (clause.questions || []).filter((q) => q.status === "C")
                      .length,
                  0
                )
              : 0}
          </span>
          <span className="metric-compact oss">
            <strong>OSS:</strong> {totalOSS}
          </span>
          <span className="metric-compact nc-severe">
            <strong>NC:</strong> {totalNC}
          </span>
          <span className="metric-compact om">
            <strong>OM:</strong> {totalOM}
          </span>
          <span className="metric-compact na">
            <strong>NA:</strong>{" "}
            {currentAudit?.checklist
              ? Object.values(currentAudit.checklist.ISO_9001 || {}).reduce(
                  (total, clause) =>
                    total +
                    (clause.questions || []).filter((q) => q.status === "NA")
                      .length,
                  0
                )
              : 0}
          </span>
        </div>

        {/* LEGENDA (spostata da ChecklistModule) */}
        <div className="findings-legend">
          <p className="legend-title">Legenda:</p>
          <div className="legend-items">
            <span className="legend-item">
              <span className="legend-badge c">C</span> Conforme
            </span>
            <span className="legend-item">
              <span className="legend-badge oss">OSS</span> Osservazione
            </span>
            <span className="legend-item">
              <span className="legend-badge nc">NC</span> Non Conformità
            </span>
            <span className="legend-item">
              <span className="legend-badge om">OM</span> Opportunità
              Miglioramento
            </span>
            <span className="legend-item">
              <span className="legend-badge na">NA</span> Non Applicabile
            </span>
          </div>
        </div>

        {/* RIMOSSO: Descrizione sintetica rilievi emergenti */}

        {/* Link ai rilievi dettagliati */}
        <div className="findings-link">
          <p className="info-message">
            ℹ️ I rilievi dettagliati (NC, OSS, OM) sono compilati nella sezione{" "}
            <strong>Checklist</strong> per ogni domanda normativa
          </p>
        </div>
      </div>

      {/* RIMOSSO: Sezione Allegati (ora gestiti per domanda nella checklist) */}

      {/* ==================== DISTRIBUZIONE ==================== */}
      {/* NASCOSTO: Funzionalità futura per invio email automatico */}
      {false && (
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
      )}

      {/* RIMOSSO: Riepilogo Esito Audit (dati già visibili nelle metriche compatte sopra) */}
    </div>
  );
}

export default AuditOutcomeSection;

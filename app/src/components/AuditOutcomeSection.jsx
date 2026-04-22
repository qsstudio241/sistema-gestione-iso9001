/**
 * AuditOutcomeSection - Tab 11 Esito Audit
 * Componente per la gestione dell'esito finale dell'audit
 */

import { useState, useEffect } from "react";
import { useStorage } from "../contexts/StorageContext";
import { calculateFindingsMetrics } from "../utils/metricsCalculator";
import "./AuditOutcomeSection.css";

/**
 * showConclusions: true → mostra solo il campo Conclusioni (sezione 12)
 *                  false (default) → mostra solo i Rilievi/metriche (sezione 11)
 */
function AuditOutcomeSection({ auditOutcome, onUpdate, showConclusions = false }) {
  const { currentAudit } = useStorage();

  // Stato locale per editing
  const [conclusions, setConclusions] = useState(
    auditOutcome?.conclusions || ""
  );
  // RIMOSSO: emergingSummary, attachments, distribution (funzionalità future)

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

  // Calcola metriche da checklist (passate come prop o calcolate)
  const totalNC = metrics.totalNC;
  const totalOSS = metrics.totalOSS;
  const totalOM = metrics.totalOM;

  return (
    <div className="audit-outcome-section">
      {/* ==================== SEZIONE 12: CONCLUSIONI ==================== */}
      {showConclusions && (
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
      )}

      {/* ==================== SEZIONE 11: RILIEVI EMERGENTI (metriche) ==================== */}
      {!showConclusions && (
      <div className="outcome-block">
        <h3 className="outcome-block-title">
          <span className="block-icon">🔍</span>
          Rilievi Emergenti
        </h3>

        {/* Metriche findings - COMPATTE SU UNA RIGA — somma TUTTI gli standard */}
        <div className="findings-metrics-compact">
          <span className="metric-compact nc">
            <strong>C:</strong>{" "}
            {currentAudit?.checklist
              ? Object.values(currentAudit.checklist).flatMap(cl =>
                  Object.values(cl || {})
                ).reduce(
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
              ? Object.values(currentAudit.checklist).flatMap(cl =>
                  Object.values(cl || {})
                ).reduce(
                  (total, clause) =>
                    total +
                    (clause.questions || []).filter((q) => q.status === "NA")
                      .length,
                  0
                )
              : 0}
          </span>
          <span className="metric-compact nv">
            <strong>NV:</strong>{" "}
            {currentAudit?.checklist
              ? Object.values(currentAudit.checklist).flatMap(cl =>
                  Object.values(cl || {})
                ).reduce(
                  (total, clause) =>
                    total +
                    (clause.questions || []).filter((q) => q.status === "NV")
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
            <span className="legend-item">
              <span className="legend-badge nv">NV</span> Non Verificato
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
      )}
    </div>
  );
}

export default AuditOutcomeSection;

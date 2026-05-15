/**
 * AuditOutcomeSection - Tab 11 Esito Audit
 * Componente per la gestione dell'esito finale dell'audit
 */

import { useState, useEffect, useMemo, useCallback } from "react";
import { useStorage } from "../contexts/StorageContext";
import { calculateFindingsMetrics, calculateCustomFindingsMetrics, calculateByStandardMetrics } from "../utils/metricsCalculator";
import { getSelectedStandardEntries } from "../data/standardsRegistry";
import AutoTextarea from "./AutoTextarea";
import AiConclusionsModal from "./AiConclusionsModal";
import "./AuditOutcomeSection.css";

/**
 * showConclusions: true → mostra solo il campo Conclusioni (sezione 12)
 *                  false (default) → mostra solo i Rilievi/metriche (sezione 11)
 */
function AuditOutcomeSection({ auditOutcome, onUpdate, showConclusions = false, readOnly = false, selectedStandards }) {
  const { currentAudit } = useStorage();

  // Conclusione unica (standard singolo)
  const [conclusions, setConclusions] = useState(auditOutcome?.conclusions || "");

  // Conclusioni per norma (multi-standard) — chiave: normKey, valore: testo
  const [conclusionsByKey, setConclusionsByKey] = useState(
    () => Object.fromEntries(
      Object.keys(auditOutcome?.byStandard || {}).map((key) => [
        key, auditOutcome?.byStandard?.[key]?.conclusions || ""
      ])
    )
  );

  // Calcola metriche real-time dalla checklist
  const [metrics, setMetrics] = useState({
    totalNC: 0,
    totalOSS: 0,
    totalOM: 0,
  });

  useEffect(() => {
    if (currentAudit?.checklist || currentAudit?.customStatuses) {
      const standardMetrics = calculateFindingsMetrics(currentAudit.checklist);
      // Se l'audit usa una custom checklist con pulsanti esito, somma quei conteggi
      const customMetrics = currentAudit?.customChecklist?.has_outcome_buttons
        ? calculateCustomFindingsMetrics(currentAudit.customStatuses)
        : { totalNC: 0, totalOSS: 0, totalOM: 0 };
      const calculatedMetrics = {
        totalNC: standardMetrics.totalNC + customMetrics.totalNC,
        totalOSS: standardMetrics.totalOSS + customMetrics.totalOSS,
        totalOM: standardMetrics.totalOM + customMetrics.totalOM,
      };
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
  }, [currentAudit?.checklist, currentAudit?.customStatuses, currentAudit?.customChecklist, auditOutcome, onUpdate]);

  const handleConclusionsChange = (e) => {
    const value = e.target.value;
    setConclusions(value);
    onUpdate({ ...auditOutcome, conclusions: value });
  };

  const handleConclusionsByKeyChange = (key, value) => {
    setConclusionsByKey((prev) => ({ ...prev, [key]: value }));
    onUpdate({
      ...auditOutcome,
      byStandard: {
        ...auditOutcome?.byStandard,
        [key]: { ...auditOutcome?.byStandard?.[key], conclusions: value },
      },
    });
  };

  const totalNC = metrics.totalNC;
  const totalOSS = metrics.totalOSS;
  const totalOM = metrics.totalOM;

  const byStandard = useMemo(
    () => calculateByStandardMetrics(currentAudit?.checklist),
    [currentAudit?.checklist]
  );
  const standardEntries = useMemo(
    () => getSelectedStandardEntries(selectedStandards || []),
    [selectedStandards]
  );
  const isMultiStandard = standardEntries.length > 1;

  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiModalStdKey, setAiModalStdKey] = useState(null);

  const buildAiContext = useCallback(() => {
    const checklist = currentAudit?.checklist || {};
    const findings = [];
    for (const [stdCode, clauseMap] of Object.entries(checklist)) {
      if (!clauseMap || typeof clauseMap !== "object") continue;
      for (const [clauseRef, questions] of Object.entries(clauseMap)) {
        if (!questions || typeof questions !== "object") continue;
        for (const [qId, q] of Object.entries(questions)) {
          if (q && q.status && q.status !== "NOT_ANSWERED") {
            findings.push({
              clauseRef: clauseRef + (qId ? "." + qId : ""),
              status: q.status,
              notes: q.notes || "",
              standardCode: stdCode,
            });
          }
        }
      }
    }

    const total = findings.length + (findings.length > 0 ? 0 :
      Object.values(checklist).reduce((sum, clauses) => {
        if (!clauses || typeof clauses !== "object") return sum;
        return sum + Object.values(clauses).reduce((s2, qs) => {
          if (!qs || typeof qs !== "object") return s2;
          return s2 + Object.keys(qs).length;
        }, 0);
      }, 0));

    return {
      auditMetrics: {
        total,
        nc: totalNC,
        oss: totalOSS,
        om: totalOM,
        nv: 0,
        conformities: Math.max(0, total - totalNC - totalOSS - totalOM),
      },
      standardCodes: standardEntries.map((e) => e.key),
      findings,
      existingConclusions: conclusions || "",
      byStandardConclusions: conclusionsByKey,
      auditObject: currentAudit?.metadata?.generalData?.auditObject || "",
      auditDescription: currentAudit?.metadata?.auditObjective?.description || "",
    };
  }, [currentAudit, conclusions, conclusionsByKey, totalNC, totalOSS, totalOM, standardEntries]);

  const handleAiAccept = useCallback((text) => {
    if (aiModalStdKey) {
      handleConclusionsByKeyChange(aiModalStdKey, text);
    } else {
      setConclusions(text);
      onUpdate({ ...auditOutcome, conclusions: text });
    }
  }, [aiModalStdKey, auditOutcome, onUpdate]);

  return (
    <div className={`audit-outcome-section${readOnly ? ' readonly-mode' : ''}`}>
      {/* ==================== SEZIONE 12: CONCLUSIONI ==================== */}
      {showConclusions && (
      <div className="outcome-block">
        {/* Pulsante AI Assistente */}
        {!readOnly && (
          <div className="ai-conclusions-trigger">
            <button
              className="ai-conclusions-trigger__btn"
              onClick={() => { setAiModalStdKey(null); setAiModalOpen(true); }}
              type="button"
            >
              <span className="ai-conclusions-trigger__icon">🤖</span>
              Assistente AI Conclusioni
            </button>
          </div>
        )}

        {/* Standard singolo: una textarea */}
        {!isMultiStandard && (
          <AutoTextarea
            id="conclusions"
            value={conclusions}
            onChange={handleConclusionsChange}
            placeholder="Sintesi generale dell'esito dell'audit: livello di conformità del sistema di gestione e giudizio complessivo sull'efficacia dei processi..."
            disabled={readOnly}
          />
        )}

        {/* Multi-standard: una textarea per norma con intestazione */}
        {isMultiStandard && standardEntries.map(({ key, shortLabel, label }) => (
          <div key={key} className="findings-per-standard">
            <div className="findings-per-standard__header">
              <span className="findings-per-standard__label">
                {shortLabel} — {label.split(" \u2014 ")[1] || label}
              </span>
              {!readOnly && (
                <button
                  className="ai-conclusions-trigger__btn ai-conclusions-trigger__btn--sm"
                  onClick={() => { setAiModalStdKey(key); setAiModalOpen(true); }}
                  type="button"
                  title="Assistente AI per questa norma"
                >
                  🤖
                </button>
              )}
            </div>
            <AutoTextarea
              id={`conclusions-${key}`}
              value={conclusionsByKey[key] ?? ""}
              onChange={(e) => handleConclusionsByKeyChange(key, e.target.value)}
              placeholder={`Conclusioni per ${label.split(" \u2014 ")[0] || label}…`}
              disabled={readOnly}
            />
          </div>
        ))}

        {/* Modale AI */}
        <AiConclusionsModal
          open={aiModalOpen}
          onClose={() => setAiModalOpen(false)}
          onAccept={handleAiAccept}
          auditContext={buildAiContext()}
          standardKey={aiModalStdKey}
          auditId={currentAudit?.id || null}
        />
      </div>
      )}

      {/* ==================== SEZIONE 11: RILIEVI EMERGENTI (metriche) ==================== */}
      {!showConclusions && (
      <div className="outcome-block">
        <h3 className="outcome-block-title">
          <span className="block-icon">🔍</span>
          Rilievi Emergenti
        </h3>

        {/* Standard singolo: riga totale (è già il dato del report).
            Multi-standard: non ha senso un aggregato — ogni norma ha il suo report. */}
        {!isMultiStandard && (() => {
          const allQuestions = currentAudit?.checklist
            ? Object.values(currentAudit.checklist).flatMap(cl =>
                Object.values(cl || {}).flatMap(clause => clause.questions || [])
              )
            : [];
          const countISO = (s) => allQuestions.filter((q) => q.status === s).length;
          const customSts = currentAudit?.customChecklist?.has_outcome_buttons
            ? Object.values(currentAudit.customStatuses || {})
            : [];
          const countCustom = (s) => customSts.filter((v) => v === s).length;
          return (
            <div className="findings-metrics-compact">
              <span className="metric-compact nc"><strong>C:</strong> {countISO("C") + countCustom("C")}</span>
              <span className="metric-compact oss"><strong>OSS:</strong> {totalOSS}</span>
              <span className="metric-compact nc-severe"><strong>NC:</strong> {totalNC}</span>
              <span className="metric-compact om"><strong>OM:</strong> {totalOM}</span>
              <span className="metric-compact na"><strong>NA:</strong> {countISO("NA") + countCustom("NA")}</span>
              <span className="metric-compact nv"><strong>NV:</strong> {countISO("NV") + countCustom("NV")}</span>
            </div>
          );
        })()}

        {/* Dettaglio per norma — visibile solo per audit multi-standard */}
        {isMultiStandard && standardEntries.map(({ key, shortLabel, label }) => {
          const m = byStandard[key] || {};
          return (
            <div key={key} className="findings-per-standard">
              <span className="findings-per-standard__label">{shortLabel} — {label.split(" \u2014 ")[1] || label}</span>
              <div className="findings-metrics-compact">
                <span className="metric-compact nc"><strong>C:</strong> {m.totalC ?? 0}</span>
                <span className="metric-compact oss"><strong>OSS:</strong> {m.totalOSS ?? 0}</span>
                <span className="metric-compact nc-severe"><strong>NC:</strong> {m.totalNC ?? 0}</span>
                <span className="metric-compact om"><strong>OM:</strong> {m.totalOM ?? 0}</span>
                <span className="metric-compact na"><strong>NA:</strong> {m.totalNA ?? 0}</span>
                <span className="metric-compact nv"><strong>NV:</strong> {m.totalNV ?? 0}</span>
              </div>
            </div>
          );
        })}

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

      </div>
      )}
    </div>
  );
}

export default AuditOutcomeSection;

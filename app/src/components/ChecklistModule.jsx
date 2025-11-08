/**
 * Checklist Module Component
 * Gestione checklist audit con accordion clausole
 * Sistema Gestione ISO 9001 - QS Studio
 */

import React, { useState, useMemo } from "react";
import { useStorage } from "../contexts/StorageContext";
import { CHECKLIST_STATUS } from "../data/auditDataModel";
import { calculateNormCompletion } from "../utils/auditUtils";
import { validateQuestion } from "../utils/checklistValidation";
import "./ChecklistModule.css";

// Nuovi status ISO 9001:2015 (sovrascrivono il legacy format)
const STATUS = {
  C: "C", // Conforme
  NC: "NC", // Non Conforme
  OSS: "OSS", // Osservazione (ex Parzialmente conforme)
  OM: "OM", // Opportunità di Miglioramento
  NA: "NA", // Non Applicabile
  NOT_ANSWERED: "NOT_ANSWERED", // Non risposto (default)
};

function ChecklistModule() {
  const {
    currentAudit,
    updateCurrentAudit,
    auditSaveStatus,
    isSaving,
    initializeChecklist,
  } = useStorage();

  const [expandedClauses, setExpandedClauses] = useState(new Set(["4"]));
  const [selectedNorm, setSelectedNorm] = useState("ISO_9001");
  const [searchTerm, setSearchTerm] = useState("");

  // TUTTI gli hooks devono essere prima degli early returns
  const stats = useMemo(() => {
    if (!currentAudit?.checklist) return null;
    return calculateNormCompletion(currentAudit.checklist, selectedNorm);
  }, [currentAudit, selectedNorm]);

  const filteredClauses = useMemo(() => {
    const checklist = currentAudit?.checklist?.[selectedNorm];
    if (!checklist || !searchTerm.trim()) {
      return checklist;
    }

    const search = searchTerm.toLowerCase();
    const filtered = {};

    Object.entries(checklist).forEach(([clauseId, clause]) => {
      if (!clause.questions) return;
      const matchingQuestions = clause.questions.filter(
        (q) =>
          q.text?.toLowerCase().includes(search) ||
          q.clauseRef?.toLowerCase().includes(search) ||
          q.title?.toLowerCase().includes(search)
      );

      if (matchingQuestions.length > 0) {
        filtered[clauseId] = {
          ...clause,
          questions: matchingQuestions,
        };
      }
    });

    return filtered;
  }, [currentAudit, selectedNorm, searchTerm]);

  // Early returns DOPO tutti gli hooks
  if (!currentAudit) {
    return (
      <div className="checklist-module empty">
        <p>Seleziona un audit per compilare la checklist</p>
      </div>
    );
  }

  // Ottieni norme disponibili per questo audit
  const availableNorms = currentAudit.metadata.selectedStandards || [
    "ISO_9001",
  ];

  // Auto-select prima norma disponibile se quella selezionata non esiste
  if (!availableNorms.includes(selectedNorm) && availableNorms.length > 0) {
    setSelectedNorm(availableNorms[0]);
  }

  const checklist = currentAudit.checklist?.[selectedNorm];

  // Verifica se checklist è vuota (non inizializzata)
  const isChecklistEmpty = !checklist || Object.keys(checklist).length === 0;

  if (isChecklistEmpty) {
    return (
      <div className="checklist-module empty">
        <div className="empty-checklist-card">
          <div className="empty-icon">📋</div>
          <h3>Checklist Non Inizializzata</h3>
          <p>
            Questo audit non ha ancora una checklist compilabile per la norma{" "}
            <strong>{selectedNorm.replace("ISO_", "ISO ")}</strong>.
          </p>
          <p className="hint">
            Clicca il pulsante qui sotto per inizializzare la struttura con le
            26 domande previste dalla norma ISO 9001:2015 (clausole 4-10).
          </p>
          <button
            className="btn btn-primary btn-large"
            onClick={() => initializeChecklist(selectedNorm)}
          >
            ✨ Inizializza Checklist ISO 9001
          </button>
        </div>
      </div>
    );
  }

  // === HANDLERS ===

  const toggleClause = (clauseId) => {
    setExpandedClauses((prev) => {
      const next = new Set(prev);
      if (next.has(clauseId)) {
        next.delete(clauseId);
      } else {
        next.add(clauseId);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpandedClauses(new Set(Object.keys(checklist.clauses)));
  };

  const collapseAll = () => {
    setExpandedClauses(new Set());
  };

  const handleQuestionUpdate = (clauseId, questionId, field, value) => {
    updateCurrentAudit((audit) => {
      const updatedAudit = { ...audit };

      // Accesso corretto alla struttura: checklist[norm][clauseId]
      const clause = updatedAudit.checklist[selectedNorm][clauseId];

      if (!clause || !clause.questions) {
        console.error(`Clausola ${clauseId} non trovata in ${selectedNorm}`);
        return audit; // Ritorna audit non modificato
      }

      const question = clause.questions.find((q) => q.id === questionId);

      if (question) {
        // Sanitizza input prima del salvataggio
        let sanitizedValue = value;

        if (field === "notes" || field === "evidenceRef") {
          // Trim whitespace per campi testo
          sanitizedValue = typeof value === "string" ? value.trim() : value;

          // Limita lunghezza (max 5000 caratteri per notes)
          if (field === "notes" && sanitizedValue.length > 5000) {
            console.warn(
              `Note troppo lunghe (${sanitizedValue.length} caratteri), troncate a 5000`
            );
            sanitizedValue = sanitizedValue.substring(0, 5000);
          }
        }

        if (field === "status") {
          // Verifica che lo status sia valido (supporta nuovo formato + legacy)
          const validStatuses = [
            ...Object.values(CHECKLIST_STATUS), // Legacy: compliant, partial, non_compliant, not_applicable
            ...Object.values(STATUS) // Nuovo: C, NC, OSS, OM, NA, NOT_ANSWERED
          ];
          if (!validStatuses.includes(sanitizedValue)) {
            console.error(`Status non valido: ${sanitizedValue}`);
            return audit; // Non salvare se status invalido
          }
        }

        question[field] = sanitizedValue;

        // Valida domanda dopo modifica (solo warning, non blocca save)
        const validation = validateQuestion(question);
        if (!validation.isValid) {
          console.warn(
            `⚠️ Domanda ${questionId} validazione:`,
            validation.errors
          );
        }

        // Aggiorna timestamp
        updatedAudit.metadata.lastModified = new Date().toISOString();

        // Ricalcola metriche
        const newCompletion = calculateNormCompletion(
          updatedAudit.checklist,
          selectedNorm
        );

        // Aggiorna metriche globali (somma tutte le norme)
        let totalAnswered = 0;
        let totalQuestions = 0;

        currentAudit.metadata.selectedStandards.forEach((norm) => {
          const normStats = calculateNormCompletion(
            updatedAudit.checklist,
            norm
          );
          totalAnswered += normStats.answered;
          totalQuestions += normStats.total;
        });

        updatedAudit.metrics.completionPercentage =
          totalQuestions > 0
            ? Math.round((totalAnswered / totalQuestions) * 100)
            : 0;
      } else {
        console.error(
          `Domanda ${questionId} non trovata nella clausola ${clauseId}`
        );
        return audit; // Ritorna audit non modificato
      }

      return updatedAudit;
    });
  };

  // === RENDER ===

  return (
    <div className="checklist-module">
      {/* Header con statistiche */}
      <div className="checklist-header">
        <div className="checklist-title-section">
          <div className="checklist-stats">
            <span className="stat-badge">
              {stats.answered}/{stats.total} domande
            </span>
            {/* Auto-save indicator */}
            {isSaving && (
              <span className="stat-badge saving">💾 Salvataggio...</span>
            )}
            {auditSaveStatus === "saved" && (
              <span className="stat-badge saved">✓ Salvato</span>
            )}
          </div>
        </div>

        <div className="checklist-controls">
          <input
            type="text"
            placeholder="🔍 Cerca domanda o clausola..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />

          <button
            onClick={expandAll}
            className="btn-control"
            title="Espandi tutto"
          >
            ⬇️
          </button>
          <button
            onClick={collapseAll}
            className="btn-control"
            title="Comprimi tutto"
          >
            ⬆️
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="progress-bar-container">
        <div
          className="progress-bar-fill"
          style={{ width: `${stats.percentage}%` }}
        />
        <span className="progress-bar-label">{stats.percentage}%</span>
      </div>

      {/* Legenda status */}
      <div className="status-legend">
        <span className="legend-item">
          <span className="legend-dot compliant"></span>C - Conforme
        </span>
        <span className="legend-item">
          <span className="legend-dot partial"></span>
          OSS - Osservazione
        </span>
        <span className="legend-item">
          <span className="legend-dot non-compliant"></span>
          NC - Non Conforme
        </span>
        <span className="legend-item">
          <span className="legend-dot om"></span>
          OM - Opportunità Miglioramento
        </span>
        <span className="legend-item">
          <span className="legend-dot not-applicable"></span>
          NA - Non Applicabile
        </span>
      </div>

      {/* Accordion clausole */}
      <div className="checklist-accordion">
        {Object.entries(filteredClauses).length === 0 ? (
          <div className="empty-search">
            <p>Nessuna domanda trovata per "{searchTerm}"</p>
          </div>
        ) : (
          Object.entries(filteredClauses).map(([clauseId, clause]) => (
            <ClauseAccordion
              key={clauseId}
              clauseId={clauseId}
              clause={clause}
              isExpanded={expandedClauses.has(clauseId)}
              onToggle={() => toggleClause(clauseId)}
              onQuestionUpdate={handleQuestionUpdate}
            />
          ))
        )}
      </div>
    </div>
  );
}

// === CLAUSE ACCORDION COMPONENT ===

function ClauseAccordion({
  clauseId,
  clause,
  isExpanded,
  onToggle,
  onQuestionUpdate,
}) {
  // Calcola statistiche clausola
  const clauseStats = useMemo(() => {
    const total = clause.questions.length;
    const answered = clause.questions.filter(
      (q) => q.status !== CHECKLIST_STATUS.NOT_ANSWERED
    ).length;
    const percentage = total > 0 ? Math.round((answered / total) * 100) : 0;

    return { total, answered, percentage };
  }, [clause.questions]);

  return (
    <div className={`clause-accordion ${isExpanded ? "expanded" : ""}`}>
      <div className="clause-header" onClick={onToggle}>
        <div className="clause-title">
          <span className="clause-icon">{isExpanded ? "▼" : "▶"}</span>
          <span className="clause-name">{clause.title}</span>
        </div>

        <div className="clause-progress">
          <span className="clause-stats">
            {clauseStats.answered}/{clauseStats.total}
          </span>
          <div className="mini-progress">
            <div
              className="mini-progress-fill"
              style={{ width: `${clauseStats.percentage}%` }}
            />
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="clause-content">
          {clause.questions.map((question) => (
            <QuestionCard
              key={question.id}
              clauseId={clauseId}
              question={question}
              onUpdate={onQuestionUpdate}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// === QUESTION CARD COMPONENT ===

function QuestionCard({ clauseId, question, onUpdate }) {
  const handleStatusChange = (status) => {
    onUpdate(clauseId, question.id, "status", status);
  };

  const handleNotesChange = (e) => {
    onUpdate(clauseId, question.id, "notes", e.target.value);
  };

  const handleEvidenceChange = (e) => {
    // Supporto backward compatibility: se esiste evidence object, aggiorna quello
    if (question.evidence && typeof question.evidence === "object") {
      onUpdate(clauseId, question.id, "evidence", {
        ...question.evidence,
        mainDocumentRef: e.target.value,
      });
    } else {
      // Fallback al vecchio formato stringa
      onUpdate(clauseId, question.id, "evidenceRef", e.target.value);
    }
  };

  // Helper per ottenere il valore da visualizzare nell'input evidence
  const getEvidenceDisplayValue = () => {
    if (question.evidence && typeof question.evidence === "object") {
      return question.evidence.mainDocumentRef || "";
    }
    return question.evidenceRef || "";
  };

  // Helper per verificare se esiste evidenza
  const hasEvidence = () => {
    if (question.evidence && typeof question.evidence === "object") {
      return (
        question.evidence.mainDocumentRef ||
        (question.evidence.detailedObservations &&
          question.evidence.detailedObservations.length > 0)
      );
    }
    return question.evidenceRef;
  };

  const getStatusClass = (status) => {
    if (question.status === status) return "active";
    return "";
  };

  return (
    <div className={`question-card status-${question.status}`}>
      <div className="question-header">
        <span className="question-reference">{question.clauseRef}</span>
        <span className="question-text">{question.text}</span>
      </div>

      <div className="question-controls">
        <div className="status-buttons">
          <button
            className={`status-btn compliant ${getStatusClass(STATUS.C)}`}
            onClick={() => handleStatusChange(STATUS.C)}
            title="Conforme"
          >
            C
          </button>
          <button
            className={`status-btn non-compliant ${getStatusClass(STATUS.NC)}`}
            onClick={() => handleStatusChange(STATUS.NC)}
            title="Non Conforme"
          >
            NC
          </button>
          <button
            className={`status-btn partial ${getStatusClass(STATUS.OSS)}`}
            onClick={() => handleStatusChange(STATUS.OSS)}
            title="Osservazione"
          >
            OSS
          </button>
          <button
            className={`status-btn om ${getStatusClass(STATUS.OM)}`}
            onClick={() => handleStatusChange(STATUS.OM)}
            title="Opportunità di Miglioramento"
          >
            OM
          </button>
          <button
            className={`status-btn not-applicable ${getStatusClass(STATUS.NA)}`}
            onClick={() => handleStatusChange(STATUS.NA)}
            title="Non Applicabile"
          >
            NA
          </button>
        </div>
      </div>

      {/* Note e Evidenza sempre visibili */}
      <div className="question-details">
        <div className="question-field">
          <label className="field-label">📝 Note</label>
          <textarea
            value={question.notes || ""}
            onChange={handleNotesChange}
            placeholder="Inserisci note, osservazioni, dettagli della verifica..."
            rows={2}
            className="notes-textarea"
          />
        </div>

        <div className="question-field">
          <label className="field-label">📎 Evidenza</label>
          <div className="evidence-field-wrapper">
            <input
              type="text"
              value={getEvidenceDisplayValue()}
              onChange={handleEvidenceChange}
              placeholder="Es: PR02.01 rev.3 del 10/01/2025"
              className="evidence-input"
            />
            <div className="evidence-actions">
              <button
                type="button"
                className="btn-evidence-action add"
                title="Aggiungi/Collega evidenza"
                onClick={() =>
                  alert(
                    "Funzionalità in sviluppo: aprirà modal per selezionare/creare evidenza"
                  )
                }
              >
                ➕
              </button>
              {hasEvidence() && (
                <button
                  type="button"
                  className="btn-evidence-action remove"
                  title="Rimuovi riferimento evidenza"
                  onClick={() =>
                    handleEvidenceChange({ target: { value: "" } })
                  }
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Mostra osservazioni dettagliate se presenti nel nuovo formato */}
        {question.evidence &&
          question.evidence.detailedObservations &&
          question.evidence.detailedObservations.length > 0 && (
            <div className="question-field detailed-observations">
              <label className="field-label">
                🔍 Osservazioni Dettagliate Audit
              </label>
              <div className="observations-list">
                {question.evidence.detailedObservations.map((obs, idx) => (
                  <div key={idx} className="observation-item">
                    <span className="observation-bullet">•</span>
                    <p className="observation-text">{obs}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
      </div>
    </div>
  );
}

export default ChecklistModule;

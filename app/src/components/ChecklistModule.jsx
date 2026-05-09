/**
 * Checklist Module Component
 * Gestione checklist audit con accordion clausole
 * Sistema Gestione ISO 9001 - QS Studio
 */

import React, { useState, useMemo, useEffect } from "react";
import { useStorage } from "../contexts/StorageContext";
import { useAttachmentManager } from "../hooks/useAttachmentManager";
import { CHECKLIST_STATUS } from "../data/auditDataModel";
import { calculateNormCompletion } from "../utils/auditUtils";
import { validateQuestion } from "../utils/checklistValidation";
import apiService from "../services/apiService";
import { syncService } from "../services/syncService";
import { QuestionCard as UniversalQuestionCard } from "./QuestionCard";
import "./ChecklistModule.css";

/**
 * Normalizza il codice norma per l'accesso alla checklist:
 * "ISO_9001_2015" → "ISO_9001", "ISO_14001_2015" → "ISO_14001", ecc.
 * Il dato viene salvato sempre con la chiave breve (es. "ISO_9001").
 */
function normalizeChecklistKey(normCode) {
  const mapping = {
    ISO_9001_2015:  "ISO_9001",
    ISO_14001_2015: "ISO_14001",
    ISO_45001_2018: "ISO_45001",
  };
  return mapping[normCode] || normCode;
}

// Nuovi status ISO 9001:2015 (sovrascrivono il legacy format)
const STATUS = {
  C: "C", // Conforme
  NC: "NC", // Non Conforme
  OSS: "OSS", // Osservazione (ex Parzialmente conforme)
  OM: "OM", // Opportunità di Miglioramento
  NA: "NA", // Non Applicabile
  NV: "NV", // Non Verificato
  NOT_ANSWERED: "NOT_ANSWERED", // Non risposto (default)
};

function ChecklistModule({ defaultNorm = "ISO_9001", readOnly = false }) {
  const {
    currentAudit,
    updateCurrentAudit,
    auditSaveStatus,
    isSaving,
    initializeChecklist,
    hydrateQuestionIds,
  } = useStorage();

  const [expandedClauses, setExpandedClauses] = useState(new Set([])); // Tutti chiusi
  const [selectedNorm, setSelectedNorm] = useState(defaultNorm);
  const [searchTerm, setSearchTerm] = useState("");
  const [responseOptions, setResponseOptions] = useState(null); // Opzioni dal backend
  const [loadingOptions, setLoadingOptions] = useState(true);
  // Mostra il fallback "Checklist Non Inizializzata" SOLO dopo un breve grace period:
  // entro questo tempo l'auto-init di AuditAccordionLayout o l'effect locale (riga 100)
  // popolano la struttura. Evita lampeggi e diagnosi confondenti per l'utente.
  const [showEmptyFallback, setShowEmptyFallback] = useState(false);

  // Hook gestione allegati
  const attachments = useAttachmentManager(currentAudit, updateCurrentAudit);

  // ID audit: numerico (INT) per AttachmentPreview/server, UUID per upload
  const auditId = currentAudit?.metadata?.auditId || null;   // INT per GET /attachments
  const auditUuid = currentAudit?.metadata?.id || currentAudit?.id || null; // UUID per upload

  // Carica opzioni di risposta dal backend (Step 1.6)
  useEffect(() => {
    async function loadResponseOptions() {
      try {
        setLoadingOptions(true);
        const response = await apiService.get("/response-options");

        if (response.success && response.data) {
          setResponseOptions(response.data);
          console.log(
            "✅ [API] Response options caricate:",
            response.data.length,
            "opzioni"
          );
        } else {
          console.warn("⚠️ [API] Response options: risposta senza dati");
          // Fallback a opzioni hardcoded se API fallisce
          setResponseOptions(null);
        }
      } catch (error) {
        console.error("❌ [API] Errore caricamento response options:", error);
        // Fallback a opzioni hardcoded (STATUS locale)
        setResponseOptions(null);
      } finally {
        setLoadingOptions(false);
      }
    }

    loadResponseOptions();
  }, []); // Esegui solo al mount

  // Auto-inizializza checklist per tutti gli standard selezionati sull'audit
  // (es. audit caricato da IndexedDB o server senza checklist già compilata)
  // NOTA: {} è truthy in JS, quindi serve il check su Object.keys().length
  useEffect(() => {
    if (!currentAudit) return;

    const selectedStandards = currentAudit.metadata?.selectedStandards || [];

    // Mappa codice norma → chiave interna normalizzata
    const normKeyMap = {
      ISO_9001:       "ISO_9001",
      ISO_9001_2015:  "ISO_9001",
      ISO_14001:      "ISO_14001",
      ISO_14001_2015: "ISO_14001",
      ISO_45001:      "ISO_45001",
      ISO_45001_2018: "ISO_45001",
      ISO_3834:       "ISO_3834_2",
      ISO_3834_2:     "ISO_3834_2",
      ISO_3834_2_2021: "ISO_3834_2",
      RDP_MSN:        "RDP_MSN",
    };

    selectedStandards.forEach((s) => {
      const key = normKeyMap[s];
      if (!key) return;
      const isoChecklist = currentAudit.checklist?.[key];
      const isEmpty = !isoChecklist || Object.keys(isoChecklist).length === 0;
      if (isEmpty) {
        console.log(`[ChecklistModule] Auto-init checklist ${key} per audit caricato`);
        initializeChecklist(key);
      }
    });
  }, [currentAudit?.id]); // Esegui solo al cambio audit (non ad ogni update)

  // Grace period: se la checklist arriva vuota, attendi 1.5s prima di mostrare il
  // fallback "Non Inizializzata". In quel lasso di tempo l'auto-init (in questo
  // modulo o in AuditAccordionLayout) ha già popolato la struttura nel 99% dei casi.
  // Reset ad ogni cambio audit per non riusare un timer di un'altra sessione.
  useEffect(() => {
    setShowEmptyFallback(false);
    if (!currentAudit) return undefined;
    const t = setTimeout(() => setShowEmptyFallback(true), 1500);
    return () => clearTimeout(t);
  }, [currentAudit?.id, selectedNorm]);

  // Idrata questionId per ISO 3834/RDP quando il modulo è visibile (allegati e risposte)
  useEffect(() => {
    const key = normalizeChecklistKey(selectedNorm);
    if ((key === "ISO_3834_2" || key === "RDP_MSN") && currentAudit?.checklist?.[key]) {
      hydrateQuestionIds(key)?.catch((e) => console.warn("[HYDRATE] questionIds:", e.message));
    }
  }, [currentAudit?.id, selectedNorm, hydrateQuestionIds]);

  // TUTTI gli hooks devono essere prima degli early returns
  const stats = useMemo(() => {
    if (!currentAudit?.checklist) return null;
    return calculateNormCompletion(currentAudit.checklist, normalizeChecklistKey(selectedNorm));
  }, [currentAudit, selectedNorm]);

  const filteredClauses = useMemo(() => {
    const checklist = currentAudit?.checklist?.[normalizeChecklistKey(selectedNorm)];
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

  // Chiave normalizzata per accesso ai dati (ISO_9001_2015 → ISO_9001, ecc.)
  const checklistKey = normalizeChecklistKey(selectedNorm);

  // Auto-select prima norma disponibile se quella selezionata (normalizzata) non ha dati
  if (
    !availableNorms.some((n) => normalizeChecklistKey(n) === checklistKey) &&
    availableNorms.length > 0
  ) {
    setSelectedNorm(availableNorms[0]);
  }

  const checklist = currentAudit.checklist?.[checklistKey];

  // Verifica se checklist è vuota (non inizializzata)
  const isChecklistEmpty = !checklist || Object.keys(checklist).length === 0;

  if (isChecklistEmpty) {
    // Durante il grace period mostra uno stato di caricamento neutro:
    // l'auto-init è in volo (template viene copiato + risposte server idratano).
    if (!showEmptyFallback) {
      return (
        <div className="checklist-module empty">
          <div className="empty-checklist-card">
            <div className="empty-icon">⏳</div>
            <h3>Caricamento checklist…</h3>
            <p>
              Sto preparando la checklist per la norma{" "}
              <strong>{checklistKey.replace("ISO_", "ISO ")}</strong> e
              recupero le risposte dal server.
            </p>
          </div>
        </div>
      );
    }
    // Fallback dopo il grace period: l'auto-init non è scattato per qualche motivo
    // (template assente, standard non riconosciuto, errore React). Diamo all'utente
    // il pulsante per forzare l'inizializzazione manuale.
    return (
      <div className="checklist-module empty">
        <div className="empty-checklist-card">
          <div className="empty-icon">📋</div>
          <h3>Checklist Non Inizializzata</h3>
          <p>
            Questo audit non ha ancora una checklist compilabile per la norma{" "}
            <strong>{checklistKey.replace("ISO_", "ISO ")}</strong>.
          </p>
          <p className="hint">
            Clicca il pulsante qui sotto per inizializzare la struttura con le
            domande previste dalla norma {checklistKey.replace(/_/g, " ")}.
            Le risposte già salvate sul server verranno ripristinate
            automaticamente.
          </p>
          <button
            className="btn btn-primary btn-large"
            onClick={() => initializeChecklist(checklistKey)}
          >
            ✨ Inizializza Checklist {checklistKey.replace(/_/g, " ")}
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
    setExpandedClauses(new Set(Object.keys(checklist)));
  };

  const collapseAll = () => {
    setExpandedClauses(new Set());
  };

  const handleQuestionUpdate = (clauseId, questionId, field, value) => {
    // Percorso event-based (T3): attivo solo con VITE_SYNC_MODE=events.
    // Ogni cambio di status genera un evento atomico inviato a POST /audits/:uuid/events.
    // Il bulk save_responses è disabilitato in StorageContext quando events è attivo.
    if (
      field === 'status' &&
      import.meta.env.VITE_SYNC_MODE === 'events'
    ) {
      const auditUuidForEvent = currentAudit?.metadata?.id || currentAudit?.id;
      // questionId numerico dal dato della domanda (idratato da hydrateQuestionIds)
      const numericQId = currentAudit?.checklist?.[checklistKey]?.[clauseId]
        ?.questions?.find((q) => q.id === questionId)?.questionId ?? null;
      if (auditUuidForEvent && numericQId != null) {
        const currentNotes = currentAudit?.checklist?.[checklistKey]?.[clauseId]
          ?.questions?.find((q) => q.id === questionId)?.notes ?? null;
        const newStatus = value === 'NOT_ANSWERED' ? null : value;
        syncService.enqueueResponseEvent(
          auditUuidForEvent,
          numericQId,
          newStatus,
          currentNotes,
        ).catch(() => {});
      }
    }

    updateCurrentAudit((audit) => {
      const updatedAudit = { ...audit };

      // Accesso corretto alla struttura: checklist[checklistKey][clauseId]
      const clause = updatedAudit.checklist[checklistKey][clauseId];

      if (!clause || !clause.questions) {
        console.error(`Clausola ${clauseId} non trovata in ${checklistKey}`);
        return audit; // Ritorna audit non modificato
      }

      const question = clause.questions.find((q) => q.id === questionId);

      if (question) {
        // Sanitizza input prima del salvataggio
        let sanitizedValue = value;

        if (field === "notes" || field === "evidenceRef") {
          // NON fare trim in tempo reale: causerebbe il bug della barra spaziatrice.
          // Il trim avviene solo al momento del sync (syncService.js).
          // Limita solo la lunghezza massima.
          if (field === "notes" && typeof value === "string" && value.length > 5000) {
            console.warn(
              `Note troppo lunghe (${value.length} caratteri), troncate a 5000`
            );
            sanitizedValue = value.substring(0, 5000);
          }
        }

        if (field === "status") {
          // Verifica che lo status sia valido (supporta nuovo formato + legacy)
          const validStatuses = [
            ...Object.values(CHECKLIST_STATUS), // Legacy: compliant, partial, non_compliant, not_applicable
            ...Object.values(STATUS), // Nuovo: C, NC, OSS, OM, NA, NOT_ANSWERED
          ];

          if (!validStatuses.includes(sanitizedValue)) {
            console.error(`Status non valido: ${sanitizedValue}`, {
              validStatuses,
            });
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
          checklistKey
        );

        // Aggiorna metriche globali (somma tutte le norme)
        let totalAnswered = 0;
        let totalQuestions = 0;

        currentAudit.metadata.selectedStandards.forEach((norm) => {
          const normStats = calculateNormCompletion(
            updatedAudit.checklist,
            normalizeChecklistKey(norm)  // normalizza es. ISO_9001_2015 → ISO_9001
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
    <div className={`checklist-module${readOnly ? ' readonly-mode' : ''}`}>
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

      {/* RIMOSSO: Legenda status (ora visualizzata nella sezione Esito Audit) */}

      {/* Barra floating espandi/comprimi — segue lo scroll (position: fixed) */}
      <div className="checklist-floating-bar" aria-hidden="true">
        <button
          type="button"
          className="btn-floating"
          onClick={expandAll}
          title="Espandi tutte le sezioni"
        >
          ⬇️ Espandi
        </button>
        <button
          type="button"
          className="btn-floating"
          onClick={collapseAll}
          title="Comprimi tutte le sezioni"
        >
          ⬆️ Comprimi
        </button>
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
              checklistKey={checklistKey}
              isExpanded={expandedClauses.has(clauseId)}
              onToggle={() => toggleClause(clauseId)}
              onQuestionUpdate={handleQuestionUpdate}
              attachmentManager={attachments}
              auditId={auditId}
              readOnly={readOnly}
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
  checklistKey,
  isExpanded,
  onToggle,
  onQuestionUpdate,
  attachmentManager,
  auditId,
  readOnly = false,
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

  const standardClass = `standard-${(checklistKey || "").toLowerCase().replace(/_/g, "-")}`;
  return (
    <div className={`clause-accordion ${isExpanded ? "expanded" : ""} ${standardClass}`}>
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
              checklistKey={checklistKey}
              onUpdate={onQuestionUpdate}
              attachmentManager={attachmentManager}
              auditId={auditId}
              readOnly={readOnly}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// === QUESTION CARD — wrapper ISO che delega al componente universale ===
// Mantiene l'interfaccia (clauseId, onUpdate) per compatibilità con ClauseAccordion.

function QuestionCard({ clauseId, question, checklistKey, onUpdate, attachmentManager, auditId, readOnly = false }) {
  // Numerazione: per ISO 3834/RDP solo numero (displayOrder), per 9001/14001 clauseRef (es. 4.1)
  const isSimpleNumbering = ['ISO_3834_2', 'RDP_MSN'].includes(checklistKey);
  const displayRef = isSimpleNumbering && question.displayOrder != null
    ? String(question.displayOrder)
    : (question.clauseRef || '');

  return (
    <UniversalQuestionCard
      question={question}
      displayRef={displayRef}
      checklistKey={checklistKey}
      showStatusButtons
      onStatusChange={(status) => onUpdate(clauseId, question.id, "status", status)}
      onNotesChange={(notes) => onUpdate(clauseId, question.id, "notes", notes)}
      attachmentManager={attachmentManager}
      auditId={auditId}
      readOnly={readOnly}
    />
  );
}

export default ChecklistModule;

/**
 * SalAiSuggestDialog - SAL Fase 5-A
 * Mostra le proposte di stato generate dall'AI dalle evidenze collegate e chiede
 * conferma umana (Accetta / Modifica / Rifiuta). L'AI NON scrive mai lo stato:
 * la scrittura avviene solo su "Accetta" tramite upsertStatus (updateGapStatus).
 *
 * Riuso confidenza adattiva del pattern IngestReviewDialog:
 *  - confidenza alta  -> valore readonly con spunta + pulsante Modifica
 *  - confidenza media/bassa -> select stato subito editabile ed evidenziato
 */

import React, { useEffect, useState } from 'react';
import { ConfidenceBadge } from './IngestReviewDialog';
import AiDisclaimer from './AiDisclaimer';
import {
  SAL_STATUS_OPTIONS,
  SAL_STATUS_LABEL,
  SAL_STANDARD_LABEL,
  salStandardBadgeClass,
} from '../utils/salConstants';
import './SalAiSuggestDialog.css';

/** Etichette IT per la copertura legislativa (asse 2, SAL 5-B). */
const COVERAGE_META = {
  covered: { label: 'Coperto', className: 'sal-ai-coverage--covered' },
  partial: { label: 'Parziale', className: 'sal-ai-coverage--partial' },
  missing: { label: 'Mancante', className: 'sal-ai-coverage--missing' },
};

function CoverageBadge({ level }) {
  const meta = COVERAGE_META[level] || { label: 'N/D', className: 'sal-ai-coverage--unknown' };
  return <span className={`sal-ai-coverage ${meta.className}`}>{meta.label}</span>;
}

function initItemState(suggestions) {
  const state = {};
  for (const s of suggestions) {
    const highConfidence = s.confidence === 'high' && s.suggestedStatus;
    state[s.normRequirementId] = {
      status: s.suggestedStatus || 'discussed',
      editing: !highConfidence, // media/bassa -> subito editabile
      dismissed: false,
    };
  }
  return state;
}

export default function SalAiSuggestDialog({
  open,
  suggestions = [],
  busy = false,
  savingId = null,
  onAccept,
  onReject,
  onClose,
}) {
  const [items, setItems] = useState({});

  useEffect(() => {
    if (open) setItems(initItemState(suggestions));
  }, [open, suggestions]);

  if (!open) return null;

  function patchItem(id, patch) {
    setItems((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  const visible = suggestions.filter((s) => !items[s.normRequirementId]?.dismissed);

  return (
    <div className="sal-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="sal-modal sal-modal-wide sal-ai-dialog"
        role="dialog"
        aria-labelledby="sal-ai-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="sal-ai-title">Suggerimenti stato (AI)</h3>
        <p className="sal-ai-intro">
          L&apos;AI ha analizzato le evidenze documentali collegate e propone uno stato di
          implementazione. Verifica, modifica se necessario e conferma: nulla viene salvato
          senza la tua approvazione.
        </p>

        {visible.length === 0 && (
          <p className="sal-ai-empty">Nessun suggerimento da rivedere.</p>
        )}

        <ul className="sal-ai-list">
          {visible.map((s) => {
            const st = items[s.normRequirementId] || {};
            const highConfidence = s.confidence === 'high' && s.suggestedStatus;
            const showEditable = st.editing || !highConfidence;
            const noProposal = !s.suggestedStatus && !s.aiUsed;
            const rowSaving = savingId === s.normRequirementId;
            const legalArticles = Array.isArray(s.legal?.articles) ? s.legal.articles : [];
            const hasLegal = legalArticles.length > 0;
            return (
              <li
                key={s.normRequirementId}
                className={`sal-ai-item sal-ai-item--${highConfidence && !st.editing ? 'confirmed' : (s.confidence || 'low')}`}
              >
                <div className="sal-ai-item-head">
                  <span className="sal-clause-ref">{s.clauseRef}</span>
                  <span className={`sal-std-badge ${salStandardBadgeClass(s.standardCode)}`}>
                    {SAL_STANDARD_LABEL[s.standardCode] || s.standardCode}
                  </span>
                  <span className="sal-ai-clause-title" title={s.clauseTitle}>{s.clauseTitle}</span>
                  <ConfidenceBadge level={s.confidence} />
                </div>

                <div className="sal-ai-item-body">
                  {hasLegal && (
                    <p className="sal-ai-axis-title">{'Conformit\u00E0 norma tecnica'}</p>
                  )}
                  <div className="sal-ai-status-block">
                    <span className="sal-ai-label">Stato proposto</span>
                    {noProposal ? (
                      <span className="sal-ai-noproposal">Nessuna proposta</span>
                    ) : showEditable ? (
                      <>
                        <select
                          className={`sal-status-select sal-status-select--${st.status || 'discussed'}`}
                          value={st.status || 'discussed'}
                          disabled={rowSaving || busy}
                          onChange={(e) => patchItem(s.normRequirementId, { status: e.target.value })}
                          aria-label={`Stato proposto clausola ${s.clauseRef}`}
                        >
                          {SAL_STATUS_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                        {highConfidence && st.editing && (
                          <button
                            type="button"
                            className="sal-ai-linkbtn"
                            onClick={() => patchItem(s.normRequirementId, { editing: false, status: s.suggestedStatus })}
                          >
                            Annulla modifica (torna al valore AI)
                          </button>
                        )}
                      </>
                    ) : (
                      <span className="sal-ai-confirmed-value">
                        {'\u2713'} {SAL_STATUS_LABEL[st.status] || st.status}
                        <button
                          type="button"
                          className="sal-ai-linkbtn"
                          onClick={() => patchItem(s.normRequirementId, { editing: true })}
                        >
                          Modifica
                        </button>
                      </span>
                    )}
                  </div>

                  {s.rationale && (
                    <p className="sal-ai-rationale">{s.rationale}</p>
                  )}

                  {Array.isArray(s.evidenceRefs) && s.evidenceRefs.length > 0 && (
                    <div className="sal-ai-evidence">
                      <span className="sal-ai-label">Evidenze</span>
                      <ul className="sal-ai-evidence-list">
                        {s.evidenceRefs.map((e) => (
                          <li
                            key={e.documentId}
                            className={`sal-ai-evidence-chip${e.used ? ' sal-ai-evidence-chip--used' : ''}`}
                            title={e.used ? 'Usata dall\u2019AI nella valutazione' : 'Collegata ma non determinante'}
                          >
                            {e.title}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {hasLegal && (
                    <div className="sal-ai-legal">
                      <div className="sal-ai-legal-head">
                        <p className="sal-ai-axis-title">{'Conformit\u00E0 legislativa'}</p>
                        {s.legal.evaluated
                          ? <ConfidenceBadge level={s.legal.confidence} />
                          : (
                            <span className="sal-ai-legal-note">
                              {'Articoli collegati (valutazione AI non disponibile)'}
                            </span>
                          )}
                      </div>
                      <ul className="sal-ai-legal-list">
                        {legalArticles.map((a) => (
                          <li key={a.articleRef} className="sal-ai-legal-item">
                            <div className="sal-ai-legal-item-head">
                              <span className="sal-ai-legal-ref">{a.articleRef}</span>
                              {a.textAvailable && <CoverageBadge level={a.coverage} />}
                              {a.sourceUrl && (
                                <a
                                  className="sal-ai-linkbtn"
                                  href={a.sourceUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  {'Vedi articolo'}
                                </a>
                              )}
                            </div>
                            {a.title && <p className="sal-ai-legal-title">{a.title}</p>}
                            {a.gap && (
                              <p className="sal-ai-legal-gap">
                                <span className="sal-ai-label">Lacuna</span> {a.gap}
                              </p>
                            )}
                            {a.rationale && <p className="sal-ai-rationale">{a.rationale}</p>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                <div className="sal-ai-item-actions">
                  <button
                    type="button"
                    className="sal-btn sal-btn-primary"
                    disabled={rowSaving || busy || noProposal}
                    onClick={() => onAccept?.(s, st.status)}
                  >
                    {rowSaving ? 'Salvataggio\u2026' : 'Accetta'}
                  </button>
                  <button
                    type="button"
                    className="sal-btn sal-btn-secondary"
                    disabled={rowSaving || busy}
                    onClick={() => onReject?.(s)}
                  >
                    Rifiuta
                  </button>
                </div>
              </li>
            );
          })}
        </ul>

        <div className="sal-ai-footer">
          <AiDisclaimer />
          <button
            type="button"
            className="sal-btn sal-btn-secondary"
            onClick={onClose}
            disabled={busy}
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
}

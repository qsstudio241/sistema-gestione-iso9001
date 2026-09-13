/**
 * QuestionAiPanel — Pannello AI inline espandibile per singolo quesito checklist
 * 
 * 5 modalità operative:
 * - conformity_assessment: valuta esito C/NC/OSS/OM
 * - evidence_gap: identifica documenti mancanti
 * - norm_interpretation: spiega §clausola
 * - draft_notes: genera bozza Note audit
 * - om_opportunity: suggerisce miglioramenti
 * 
 * Props:
 * - question: { id, text, clauseRef, standardCode, status, notes }
 * - attachments: Array<{ id, name, type, extractedText? }>
 * - auditContext: { auditId, companyId, companyName }
 * - onNotesChange: (newNotes) => void
 * - onStatusChange: (newStatus) => void
 * - hasLicense: bool (licenza ai_chat attiva)
 */

import React, { useState } from 'react';
import apiService from '../services/apiService';
import './QuestionAiPanel.css';

const MODE_OPTIONS = [
  { mode: 'conformity_assessment', icon: '\u2696\uFE0F', label: 'Valuta' },
  { mode: 'evidence_gap', icon: '\uD83D\uDCCB', label: 'Gap' },
  { mode: 'norm_interpretation', icon: '\uD83D\uDCD6', label: 'Spiega' },
  { mode: 'draft_notes', icon: '\u270D\uFE0F', label: 'Bozza' },
  { mode: 'om_opportunity', icon: '\uD83D\uDCA1', label: 'Opportunità' },
];

export default function QuestionAiPanel({
  question,
  attachments = [],
  auditContext = {},
  onNotesChange,
  onStatusChange,
  hasLicense = false,
}) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [response, setResponse] = useState(null);

  if (!hasLicense) {
    return null; // Nasconde completamente se licenza non attiva
  }

  const handleModeClick = async (mode) => {
    setLoading(true);
    setError(null);
    setResponse(null);

    try {
      const res = await apiService.post(
        '/ai/question-assistant',
        {
          mode,
          question: {
            id: question.id,
            clauseRef: question.clauseRef || '',
            standardCode: question.standardCode || 'ISO_9001_2015',
            text: question.text,
            currentStatus: question.status,
            notes: question.notes || '',
          },
          attachments,
          auditContext,
        }
      );

      if (res && res.success) {
        setResponse(res.data);
      } else {
        setError('Risposta AI non valida');
      }
    } catch (err) {
      const msg = err.message || 'Errore chiamata AI';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyNotes = () => {
    if (response && response.answer && onNotesChange) {
      // Estrai testo utile (rimuovi header **Esito suggerito:** se presente)
      let notesText = response.answer;
      const lines = notesText.split('\n').filter((l) => l.trim());
      
      // Se prima riga è "Esito suggerito:", skippa e prendi solo Motivazione/Gap
      if (lines[0] && lines[0].startsWith('**Esito suggerito:**')) {
        notesText = lines.slice(1).join('\n').trim();
      }

      onNotesChange(notesText);
    }
  };

  const handleApplyStatus = () => {
    if (response && response.suggestedStatus && onStatusChange) {
      onStatusChange(response.suggestedStatus);
    }
  };

  const goToLibrary = () => {
    const stdCode = question.standardCode || 'ISO_9001_2015';
    window.location.href = `/library?standard=${stdCode}`;
  };

  return (
    <div className="question-ai-panel">
      <button
        type="button"
        className="ai-trigger-btn"
        onClick={() => setExpanded(!expanded)}
        title="Assistente AI per questo quesito"
      >
        {String.fromCodePoint(0x1F916)} Chiedi all'AI — §{question.clauseRef || 'X.Y'}
      </button>

      {expanded && (
        <div className="ai-panel-content">
          {/* Banner fonte */}
          {response && (
            <div
              className={`ai-source-banner ${
                response.hasOfficialSource ? 'official' : 'generic'
              }`}
            >
              <span>{response.hasOfficialSource ? '\u2705' : '\u26A0\uFE0F'}</span>
              <span>{response.sourceDisclaimer}</span>
              {!response.hasOfficialSource && (
                <button
                  type="button"
                  className="btn-link"
                  onClick={goToLibrary}
                >
                  Carica norma {String.fromCodePoint(0x2192)}
                </button>
              )}
            </div>
          )}

          {/* Chip azioni rapide */}
          <div className="ai-mode-chips">
            {MODE_OPTIONS.map(({ mode, icon, label }) => (
              <button
                key={mode}
                type="button"
                className="ai-mode-chip"
                onClick={() => handleModeClick(mode)}
                disabled={loading}
                title={label}
              >
                {icon} {label}
              </button>
            ))}
          </div>

          {/* Risposta AI */}
          {loading && (
            <div className="ai-response loading">
              <div className="spinner-sm"></div>
              <span>Elaborazione...</span>
            </div>
          )}

          {error && (
            <div className="ai-response error">
              <strong>Errore:</strong> {error}
            </div>
          )}

          {response && !loading && (
            <>
              <div className="ai-response success">
                {/* Risposta AI formattata */}
                <div
                  className="ai-answer"
                  dangerouslySetInnerHTML={{
                    __html: formatAiAnswer(response.answer),
                  }}
                />

                {/* Citazioni (solo se fonte ufficiale) */}
                {response.citations && response.citations.length > 0 && (
                  <div className="ai-citations">
                    <strong>Citazioni:</strong>
                    <ul>
                      {response.citations.map((cite, idx) => (
                        <li key={idx}>
                          <code>{cite.text}</code> — {cite.source}
                          {cite.page && ` (pag. ${cite.page})`}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Azioni */}
              <div className="ai-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleApplyNotes}
                  disabled={!onNotesChange}
                >
                  Applica a Note
                </button>

                {response.suggestedStatus && (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={handleApplyStatus}
                    disabled={!onStatusChange}
                  >
                    Cambia esito: {response.suggestedStatus}
                  </button>
                )}

                <button
                  type="button"
                  className="btn-link"
                  onClick={() => setResponse(null)}
                >
                  Nuova domanda
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Formatta risposta AI per HTML (bold, liste)
 * @param {string} text
 * @returns {string} HTML
 */
function formatAiAnswer(text) {
  if (!text) return '';

  let html = text
    // Bold **testo**
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    // Liste numerate
    .replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>')
    // Paragrafi
    .replace(/\n\n/g, '</p><p>')
    // Newline singole
    .replace(/\n/g, '<br>');

  // Wrap liste in <ol>
  html = html.replace(/(<li>.*<\/li>)+/gs, (match) => `<ol>${match}</ol>`);

  // Wrap paragrafi
  if (!html.startsWith('<')) {
    html = `<p>${html}</p>`;
  }

  return html;
}

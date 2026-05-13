import React from 'react';
import './AiSuggestionInline.css';

export default function AiSuggestionInline({
  suggestion,
  onAccept,
  onReject,
  onEdit,
  loading,
  error,
}) {
  if (loading) {
    return <div className="ai-suggestion-inline loading">Analisi AI in corso...</div>;
  }
  if (error) {
    return (
      <div className="ai-suggestion-inline error">Errore AI: {error}</div>
    );
  }
  if (!suggestion) return null;

  return (
    <div className="ai-suggestion-inline">
      <div className="ai-suggestion-header">Suggerimento AI</div>
      <div className="ai-suggestion-content">
        {typeof suggestion === 'string'
          ? suggestion
          : JSON.stringify(suggestion, null, 2)}
      </div>
      <div className="ai-suggestion-actions">
        {onAccept && (
          <button type="button" className="ai-btn accept" onClick={() => onAccept(suggestion)}>
            Accetta
          </button>
        )}
        {onEdit && (
          <button type="button" className="ai-btn edit" onClick={() => onEdit(suggestion)}>
            Modifica
          </button>
        )}
        {onReject && (
          <button type="button" className="ai-btn reject" onClick={() => onReject()}>
            Rifiuta
          </button>
        )}
      </div>
    </div>
  );
}

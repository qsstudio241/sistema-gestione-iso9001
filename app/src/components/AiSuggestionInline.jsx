import React from 'react';
import './AiSuggestionInline.css';
import AiDisclaimer from './AiDisclaimer';

/** Rende un oggetto come lista chiave: valore leggibile (no JSON grezzo). */
function ObjectSummary({ obj }) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
  const entries = Object.entries(obj).filter(([, v]) => v !== null && v !== undefined && v !== '');
  if (!entries.length) return null;
  return (
    <dl style={{ margin: 0 }}>
      {entries.map(([k, v]) => (
        <div key={k} style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.2rem', flexWrap: 'wrap' }}>
          <dt style={{ fontWeight: 600, minWidth: 120, color: '#546e7a', fontSize: '0.82rem', textTransform: 'capitalize' }}>
            {k.replace(/_/g, ' ')}:
          </dt>
          <dd style={{ margin: 0, fontSize: '0.82rem' }}>
            {typeof v === 'object' ? JSON.stringify(v) : String(v)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

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

  const isString = typeof suggestion === 'string';

  return (
    <div className="ai-suggestion-inline">
      <div className="ai-suggestion-header">Suggerimento AI</div>
      <div className="ai-suggestion-content">
        {isString ? suggestion : <ObjectSummary obj={suggestion} />}
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
      <AiDisclaimer style={{ marginTop: '0.5rem' }} />
    </div>
  );
}

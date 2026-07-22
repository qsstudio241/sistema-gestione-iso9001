/**
 * DeadlineImportDialog — dialog di conferma import scadenzario (ADR-013 §6.5)
 *
 * Si apre quando il detector rileva confidence alta/media su un file Excel.
 * Permette all'utente di verificare/modificare il mapping colonne e confermare.
 *
 * Props:
 *   detection      { isDeadlineFile, sheets, suggestedMapping, previewStats, fileName }
 *   documentId     number
 *   onConfirm      (mapping) => void
 *   onClose        () => void
 *   loading        boolean
 */

import React, { useState, useEffect } from 'react';
import './DeadlineImportDialog.css';

function DeadlineImportDialog({ detection, documentId, onConfirm, onClose, loading = false }) {
  const sm = detection?.suggestedMapping;
  const firstSheet = detection?.sheets?.[0];

  const [sheetName,      setSheetName]      = useState(sm?.sheetName      || '');
  const [dateColumn,     setDateColumn]     = useState(sm?.dateColumn     || '');
  const [titleColumn,    setTitleColumn]    = useState(sm?.titleColumn    || '');
  const [categoryColumn, setCategoryColumn] = useState('');
  const [referenceColumn,setReferenceColumn]= useState('');
  const [label,          setLabel]          = useState('');
  const [autoRefresh,    setAutoRefresh]    = useState(false);

  // Prendi l'elenco header dal foglio suggerito
  const sampleRow    = firstSheet?.sampleRows?.[0] || [];
  const allColumns   = firstSheet?.sampleRows
    ? (detection.sheets.find(s => s.sheetName === sheetName) || firstSheet).sampleRows[0] || []
    : [];

  const stats = detection?.previewStats;

  useEffect(() => {
    if (sm) {
      setSheetName(sm.sheetName || '');
      setDateColumn(sm.dateColumn || '');
      setTitleColumn(sm.titleColumn || '');
    }
  }, [sm]);

  const handleConfirm = () => {
    if (!dateColumn || !titleColumn) return;
    onConfirm({
      sheetName,
      dateColumn,
      titleColumn,
      categoryColumn: categoryColumn || null,
      referenceColumn: referenceColumn || null,
      label:           label          || null,
      autoRefresh,
    });
  };

  const confidenceBadge = sm?.confidenceLevel === 'alta'
    ? <span className="did-badge did-badge--high">Rilevamento alta affidabilita</span>
    : <span className="did-badge did-badge--medium">Rilevamento media affidabilita</span>;

  return (
    <div className="did-overlay" role="dialog" aria-modal="true" aria-labelledby="did-title">
      <div className="did-modal">
        {/* Header */}
        <div className="did-header">
          <span className="did-header__icon" aria-hidden="true">{'\uD83D\uDCC5'}</span>
          <h2 id="did-title" className="did-header__title">File scadenzario rilevato</h2>
          <button className="did-close" onClick={onClose} aria-label="Chiudi" disabled={loading}>
            {'\u00D7'}
          </button>
        </div>

        {/* Body */}
        <div className="did-body">
          <div className="did-file-info">
            <span className="did-file-name">{detection?.fileName}</span>
            {confidenceBadge}
          </div>

          {stats && (
            <div className="did-stats">
              <span>{'\uD83D\uDCCA'} {stats.total} righe totali</span>
              {stats.expired > 0 && <span className="did-stat--red">{'\uD83D\uDD34'} {stats.expired} scadute</span>}
              {stats.soon    > 0 && <span className="did-stat--orange">{'\uD83D\uDFE0'} {stats.soon} in scadenza (30 gg)</span>}
            </div>
          )}

          <div className="did-form">
            {/* Etichetta scadenzario */}
            <div className="did-field">
              <label className="did-label" htmlFor="did-label-input">
                Etichetta scadenzario <span className="did-optional">(opzionale)</span>
              </label>
              <input
                id="did-label-input"
                type="text"
                className="did-input"
                placeholder="es. Tarature strumenti, Polizze, Qualifiche..."
                value={label}
                onChange={e => setLabel(e.target.value)}
              />
            </div>

            {/* Foglio */}
            {detection?.sheets?.length > 1 && (
              <div className="did-field">
                <label className="did-label" htmlFor="did-sheet">Foglio Excel</label>
                <select
                  id="did-sheet"
                  className="did-select"
                  value={sheetName}
                  onChange={e => setSheetName(e.target.value)}
                >
                  {detection.sheets.map(s => (
                    <option key={s.sheetName} value={s.sheetName}>{s.sheetName}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Colonna scadenza */}
            <div className="did-field did-field--required">
              <label className="did-label" htmlFor="did-date-col">
                Colonna data scadenza <span className="did-required">*</span>
              </label>
              <input
                id="did-date-col"
                type="text"
                className="did-input"
                value={dateColumn}
                onChange={e => setDateColumn(e.target.value)}
                placeholder="Nome esatto della colonna"
              />
            </div>

            {/* Colonna oggetto */}
            <div className="did-field did-field--required">
              <label className="did-label" htmlFor="did-title-col">
                Colonna descrizione <span className="did-required">*</span>
              </label>
              <input
                id="did-title-col"
                type="text"
                className="did-input"
                value={titleColumn}
                onChange={e => setTitleColumn(e.target.value)}
                placeholder="Nome esatto della colonna"
              />
            </div>

            {/* Colonna categoria (opzionale) */}
            <div className="did-field">
              <label className="did-label" htmlFor="did-cat-col">
                Colonna tipo/categoria <span className="did-optional">(opzionale)</span>
              </label>
              <input
                id="did-cat-col"
                type="text"
                className="did-input"
                value={categoryColumn}
                onChange={e => setCategoryColumn(e.target.value)}
                placeholder="lascia vuoto per ignorare"
              />
            </div>

            {/* Colonna codice (opzionale) */}
            <div className="did-field">
              <label className="did-label" htmlFor="did-ref-col">
                Colonna codice/riferimento <span className="did-optional">(opzionale)</span>
              </label>
              <input
                id="did-ref-col"
                type="text"
                className="did-input"
                value={referenceColumn}
                onChange={e => setReferenceColumn(e.target.value)}
                placeholder="es. S/N, Codice, Rif."
              />
            </div>

            {/* Auto-refresh */}
            <label className="did-check-row">
              <input
                type="checkbox"
                className="did-check"
                checked={autoRefresh}
                onChange={e => setAutoRefresh(e.target.checked)}
              />
              <span className="did-check-label">
                Ri-importa automaticamente quando il file viene aggiornato
              </span>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="did-footer">
          <button className="did-btn did-btn--cancel" onClick={onClose} disabled={loading}>
            Annulla
          </button>
          <button
            className="did-btn did-btn--confirm"
            onClick={handleConfirm}
            disabled={loading || !dateColumn || !titleColumn}
          >
            {loading ? 'Importazione...' : 'Importa scadenze'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default DeadlineImportDialog;

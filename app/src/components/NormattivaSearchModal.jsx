/**
 * NormattivaSearchModal.jsx
 * Modal per ricerca e importazione decreti da Normattiva.it.
 * 
 * Pattern: IngestDialogShell + form search + lista risultati
 */

import React, { useState } from 'react';
import apiService from '../services/apiService';
import { LoadingSpinner, Toast } from './SharedComponents';
import './NormattivaSearchModal.css';

function NormattivaSearchModal({ isOpen, onClose, onImportSuccess }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importingUrn, setImportingUrn] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    
    if (!searchQuery.trim()) {
      showToast('Inserisci un termine di ricerca', 'error');
      return;
    }

    setIsSearching(true);
    setResults([]);

    try {
      const response = await apiService.post('/normattiva/search', {
        query: searchQuery.trim(),
      });

      if (response?.success) {
        setResults(response.results || []);
        
        if (response.results.length === 0) {
          showToast('Nessun risultato trovato. Verifica la sintassi (es. "D.Lgs. 81/2008")', 'info');
        }
      } else {
        showToast('Errore nella ricerca', 'error');
      }
    } catch (err) {
      console.error('[NormattivaSearchModal] Errore search:', err);
      
      if (err.response?.status === 401) {
        showToast('Sessione scaduta. Effettua il login e riprova.', 'error');
      } else if (err.response?.status === 503) {
        showToast('Servizio Normattiva temporaneamente non disponibile. Riprova tra qualche minuto.', 'error');
      } else {
        showToast(err.response?.data?.error || 'Errore durante la ricerca', 'error');
      }
    } finally {
      setIsSearching(false);
    }
  };

  const handleImport = async (urn, title) => {
    if (!window.confirm(`Importare il decreto "${title}" nel second brain?\n\nQuesto processo:\n- Scaricherà il testo consolidato da Normattiva\n- Creerà il documento in Libreria\n- Genererà automaticamente i chunks per l'AI Assistant`)) {
      return;
    }

    setIsImporting(true);
    setImportingUrn(urn);

    try {
      const response = await apiService.post('/normattiva/import', { urn });

      if (response?.success) {
        const { title: importedTitle, chunkCount } = response.data;
        showToast(`✅ Decreto importato con successo: ${chunkCount} chunks generati`, 'success');
        
        // Chiudi modal dopo 2 secondi e notifica parent
        setTimeout(() => {
          onClose();
          if (onImportSuccess) {
            onImportSuccess();
          }
        }, 2000);
      } else {
        showToast('Errore durante l\'importazione', 'error');
      }
    } catch (err) {
      console.error('[NormattivaSearchModal] Errore import:', err);
      
      if (err.response?.status === 401) {
        showToast('Sessione scaduta. Effettua il login e riprova.', 'error');
      } else if (err.response?.status === 503) {
        showToast('Servizio Normattiva temporaneamente non disponibile. Riprova tra qualche minuto.', 'error');
      } else {
        showToast(err.response?.data?.error || 'Errore durante l\'importazione', 'error');
      }
    } finally {
      setIsImporting(false);
      setImportingUrn(null);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content normattiva-search-modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h3>🔍 Cerca su Normattiva</h3>
            <button className="close-btn" onClick={onClose} aria-label="Chiudi">
              ✕
            </button>
          </div>

          <div className="modal-body">
            <form onSubmit={handleSearch} className="normattiva-search-form">
              <div className="search-input-group">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="es. D.Lgs. 81/2008 oppure D.L. 119/2018"
                  className="search-input"
                  disabled={isSearching || isImporting}
                />
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSearching || isImporting}
                >
                  {isSearching ? 'Ricerca...' : 'Cerca'}
                </button>
              </div>
              
              <p className="search-hint">
                Supportati: D.Lgs. (Decreto Legislativo), D.L. (Decreto Legge), Legge
              </p>
            </form>

            {isSearching && (
              <div className="search-loading">
                <LoadingSpinner size="medium" />
                <p>Ricerca su Normattiva in corso...</p>
              </div>
            )}

            {!isSearching && results.length > 0 && (
              <div className="search-results">
                <h4>Risultati trovati ({results.length})</h4>
                <ul className="results-list">
                  {results.map((result) => (
                    <li key={result.urn} className="result-item">
                      <div className="result-info">
                        <h5>{result.title}</h5>
                        <div className="result-meta">
                          <span className="result-urn">{result.urn}</span>
                          <span className={`result-vigenza vigenza-${result.vigenza.toLowerCase()}`}>
                            {result.vigenza}
                          </span>
                        </div>
                      </div>
                      <button
                        className="btn btn-primary btn-import"
                        onClick={() => handleImport(result.urn, result.title)}
                        disabled={isImporting}
                      >
                        {importingUrn === result.urn ? (
                          <>
                            <LoadingSpinner size="small" />
                            Importazione...
                          </>
                        ) : (
                          'Importa'
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={onClose} disabled={isImporting}>
              Chiudi
            </button>
          </div>
        </div>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} />}
    </>
  );
}

export default NormattivaSearchModal;

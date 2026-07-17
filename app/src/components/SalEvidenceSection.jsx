/**
 * SalEvidenceSection — collegamento evidenze SAL al Registro Documenti (document_registry)
 * Pattern ADR-009: evidence_document_ids → document_registry.id
 */

import React, { useEffect, useState, useCallback } from 'react';
import { Link } from '../contexts/RouterContext';
import apiService from '../services/apiService';
import { buildDocumentRegistryPath } from '../utils/documentRegistryUrl';

export default function SalEvidenceSection({
  companyId,
  value = [],
  onChange,
  disabled = false,
}) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);

  const selectedIds = Array.isArray(value) ? value.map((id) => Number(id)) : [];

  const loadDocuments = useCallback(async () => {
    if (!companyId) {
      setDocuments([]);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const res = await apiService.getDocuments({
        company_id: companyId,
        status: 'rilasciato',
        limit: 200,
      });
      const list = res?.data?.items ?? res?.data ?? res?.items ?? [];
      setDocuments(Array.isArray(list) ? list.filter((d) => d.doc_type !== 'folder') : []);
    } catch (err) {
      setLoadError(err?.message || 'Errore caricamento registro documenti');
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  function toggleDoc(id) {
    if (disabled) return;
    const numId = Number(id);
    const next = selectedIds.includes(numId)
      ? selectedIds.filter((x) => x !== numId)
      : [...selectedIds, numId];
    onChange?.(next);
  }

  if (!companyId) {
    return (
      <p className="sal-evidence-hint">Seleziona un&apos;ambito azienda per collegare evidenze.</p>
    );
  }

  return (
    <div className="sal-evidence-section">
      <div className="sal-evidence-header">
        <label>Evidenze documentali</label>
        <Link
          to={buildDocumentRegistryPath({ tab: 'catalog', companyId })}
          className="sal-evidence-registry-link"
        >
          Apri registro documenti
        </Link>
      </div>
      <p className="sal-evidence-hint">
        Collega documenti dal Registro Documenti SGQ. Gli ID validati restano in
        {' '}
        <code>evidence_document_ids</code>
        .
      </p>
      {loading && <p className="sal-evidence-loading">Caricamento documenti…</p>}
      {loadError && <p className="sal-evidence-error" role="alert">{loadError}</p>}
      {!loading && !loadError && documents.length === 0 && (
        <p className="sal-evidence-empty">
          Nessun documento rilasciato per questa azienda.
          {' '}
          <Link to={buildDocumentRegistryPath({ tab: 'catalog', companyId })}>
            Aggiungi nel registro
          </Link>
        </p>
      )}
      {!loading && documents.length > 0 && (
        <ul className="sal-evidence-list">
          {documents.slice(0, 80).map((doc) => (
            <li key={doc.id}>
              <label className="sal-evidence-item">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(Number(doc.id))}
                  disabled={disabled}
                  onChange={() => toggleDoc(doc.id)}
                />
                <span className="sal-evidence-item-title" title={doc.title}>
                  {doc.title || `Documento #${doc.id}`}
                </span>
                <Link
                  to={buildDocumentRegistryPath({ selectId: doc.id, companyId })}
                  className="sal-evidence-item-link"
                  title="Apri in registro"
                  onClick={(e) => e.stopPropagation()}
                >
                  ↗
                </Link>
              </label>
            </li>
          ))}
        </ul>
      )}
      {selectedIds.length > 0 && (
        <p className="sal-evidence-count">
          {selectedIds.length}
          {' '}
          evidenza/e selezionata/e
        </p>
      )}
    </div>
  );
}

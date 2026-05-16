/**
 * DocumentDetailPanel - pannello slide-in con dettagli documento selezionato
 *
 * Mostra: informazioni, tag (placeholder WS-5), relazioni (placeholder WS-5),
 * file/versioni, cronologia modifiche, azioni.
 */
import React, { useState, useEffect } from "react";
import { formatDate } from "../utils/dateHelpers";
import apiService from "../services/apiService";
import "./DocumentDetailPanel.css";

const STATUS_CONFIG = {
  rilasciato:   { label: "Rilasciato",   className: "doc-detail__badge--green" },
  vigente:      { label: "Rilasciato",  className: "doc-detail__badge--green" },
  in_revisione: { label: "In revisione", className: "doc-detail__badge--yellow" },
  obsoleto:     { label: "Obsoleto",     className: "doc-detail__badge--grey" },
  bozza:        { label: "Bozza",        className: "doc-detail__badge--blue" },
};

const DOC_TYPE_LABELS = {
  procedure:    "Procedura",
  work_instruction: "Istruzione operativa",
  manual:       "Manuale",
  form:         "Modulo",
  record:       "Registrazione",
  policy:       "Politica",
  plan:         "Piano",
  report:       "Report",
  folder:       "Cartella",
  external:     "Documento esterno",
};

function InfoRow({ label, value }) {
  if (value == null || value === "") return null;
  return (
    <div className="doc-detail__info-row">
      <span className="doc-detail__info-label">{label}</span>
      <span className="doc-detail__info-value">{value}</span>
    </div>
  );
}

function DocumentDetailPanel({ document: doc, history, onEdit, onArchive, onClose }) {
  // Files allegati: l'endpoint dell'albero non li popola, li carichiamo qui
  const [files, setFiles] = useState(doc?.files || []);
  const [filesLoading, setFilesLoading] = useState(false);

  useEffect(() => {
    if (!doc?.id) { setFiles([]); return; }
    if (doc.files && doc.files.length > 0) { setFiles(doc.files); return; }
    let cancelled = false;
    setFilesLoading(true);
    apiService.getDocFiles(doc.id)
      .then(res => { if (!cancelled) setFiles(res?.files || []); })
      .catch(() => { if (!cancelled) setFiles([]); })
      .finally(() => { if (!cancelled) setFilesLoading(false); });
    return () => { cancelled = true; };
  }, [doc?.id]);

  if (!doc) return null;

  const statusCfg = STATUS_CONFIG[doc.status] ?? STATUS_CONFIG.vigente;

  return (
    <div className="doc-detail__overlay" onClick={onClose}>
      <aside
        className="doc-detail"
        onClick={(e) => e.stopPropagation()}
        role="complementary"
        aria-label="Dettagli documento"
      >
        {/* Header */}
        <div className="doc-detail__header">
          <div className="doc-detail__header-top">
            <h2 className="doc-detail__title">{doc.title}</h2>
            <button className="doc-detail__close" onClick={onClose} aria-label="Chiudi">
              {"\u2715"}
            </button>
          </div>
          <span className={"doc-detail__badge " + statusCfg.className}>
            {statusCfg.label}
          </span>
        </div>

        <div className="doc-detail__body">
          {/* Informazioni */}
          <section className="doc-detail__section">
            <h3 className="doc-detail__section-title">Informazioni</h3>
            <InfoRow label="Codice" value={doc.doc_code} />
            <InfoRow label="Tipo" value={DOC_TYPE_LABELS[doc.doc_type] ?? doc.doc_type} />
            <InfoRow label="Revisione" value={doc.revision != null ? `Rev. ${doc.revision}` : null} />
            <InfoRow label="Data emissione" value={formatDate(doc.issue_date)} />
            <InfoRow label="Data scadenza" value={formatDate(doc.expiry_date)} />
            <InfoRow label="Responsabile" value={doc.responsible} />
            <InfoRow label="Azienda" value={doc.company_name} />
            <InfoRow label="Norma" value={doc.standard_reference} />
            <InfoRow label="Clausola" value={doc.clause_reference} />
          </section>

          {/* Tag - placeholder WS-5 */}
          <section className="doc-detail__section">
            <h3 className="doc-detail__section-title">Tag</h3>
            <p className="doc-detail__placeholder">Nessun tag assegnato</p>
          </section>

          {/* Relazioni - placeholder WS-5 */}
          <section className="doc-detail__section">
            <h3 className="doc-detail__section-title">Relazioni</h3>
            <p className="doc-detail__placeholder">Nessuna relazione</p>
          </section>

          {/* File / Versioni */}
          <section className="doc-detail__section">
            <h3 className="doc-detail__section-title">File</h3>
            {filesLoading ? (
              <p className="doc-detail__placeholder">Caricamento...</p>
            ) : files.length > 0 ? (
              <ul className="doc-detail__file-list">
                {files.map((f) => (
                  <li key={f.id ?? f.file_name} className="doc-detail__file-item">
                    <span className="doc-detail__file-name">{f.file_name}</span>
                    <span className="doc-detail__file-meta">
                      {f.version && `v${f.version}`}
                      {(f.uploaded_at || f.created_at) && ` - ${formatDate(f.uploaded_at || f.created_at)}`}
                      {f.file_size_label && ` - ${f.file_size_label}`}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="doc-detail__placeholder">Nessun file allegato</p>
            )}
          </section>

          {/* Cronologia */}
          <section className="doc-detail__section">
            <h3 className="doc-detail__section-title">Cronologia</h3>
            {history?.length > 0 ? (
              <ul className="doc-detail__timeline">
                {history.map((evt, i) => (
                  <li key={i} className="doc-detail__timeline-item">
                    <span className="doc-detail__timeline-dot" />
                    <div className="doc-detail__timeline-content">
                      <span className="doc-detail__timeline-action">{evt.action}</span>
                      <span className="doc-detail__timeline-meta">
                        {evt.user_name && `${evt.user_name} - `}
                        {formatDate(evt.created_at)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="doc-detail__placeholder">{"Nessuna attivit\u00e0 registrata"}</p>
            )}
          </section>
        </div>

        {/* Azioni */}
        <div className="doc-detail__actions">
          <button className="doc-detail__action-btn doc-detail__action-btn--primary" onClick={onEdit}>
            Modifica
          </button>
          <button className="doc-detail__action-btn doc-detail__action-btn--secondary" onClick={onArchive}>
            Archivia
          </button>
        </div>
      </aside>
    </div>
  );
}

export default DocumentDetailPanel;

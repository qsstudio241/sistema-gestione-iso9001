/**
 * DocumentDetailPanel - pannello slide-in con dettagli documento selezionato
 *
 * Mostra: informazioni, tag (placeholder WS-5), relazioni (placeholder WS-5),
 * file/versioni, cronologia modifiche, azioni.
 */
import React, { useState, useEffect, useMemo } from "react";
import { formatDate } from "../utils/dateHelpers";
import { DOC_TYPE_LABELS, DOC_STATUS_LABELS, DOC_STATUS_BADGE_CLASS } from "../data/documentTypes";
import apiService from "../services/apiService";
import useDocDetailPanelWidth, {
  DOC_DETAIL_WIDTH_MIN,
  getDocDetailMaxWidth,
} from "../hooks/useDocDetailPanelWidth";
import "./DocumentDetailPanel.css";

const NORM_VALIDITY_LABELS = {
  vigente: "Vigente",
  superata: "Superata",
  annullata: "Annullata",
  in_revisione: "In revisione",
};

function parseTypeSpecificData(raw) {
  if (!raw) return null;
  if (typeof raw === "object") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Ricava la data di emissione per le norme quando issue_date è null.
 * Priorità: issue_date → edition_year (anno intero) → anno estratto da standard_code.
 */
function resolveIssueDateDisplay(doc, normData) {
  if (doc.issue_date) return formatDate(doc.issue_date);
  if (doc.doc_type === "norma") {
    const yr = normData?.editionYear;
    if (yr != null) return String(yr);
    const code = normData?.standardCode || doc.doc_code || "";
    const years = code.match(/\b(19|20)\d{2}\b/g);
    if (years && years.length > 0) return years[years.length - 1];
  }
  return formatDate(doc.issue_date);
}

/**
 * Costruisce un URL statico al catalogo ufficiale dell'ente emittente.
 *
 * Campi scrapabili (senza autenticazione, per future integrazioni):
 *  - normattiva.it  → testo integrale, data GU, data entrata in vigore, eventuali modifiche
 *  - eur-lex.europa.eu → testo, data pubblicazione GUCE, stato (in vigore/abrogato), sostituita da
 *  - iso.org        → titolo, edition year, status (Published/Withdrawn/Revised), replaced by
 *  - store.uni.com  → titolo, codice, anno, stato
 *  - shop.bsigroup.com → status (Current/Withdrawn/Superseded), superseded by
 *  - asme.org       → limitato (prevalentemente dietro paywall, solo ricerca per codice)
 *  - din.de         → titolo, stato, anno (tedesco/inglese)
 */
function buildStaticCatalogUrl(issuingBody, standardCode) {
  const body = (issuingBody || "").toUpperCase();
  const code = standardCode || "";
  const enc  = encodeURIComponent(code);
  const codeUpper = code.toUpperCase();

  if (body === "IT")  return `https://www.normattiva.it/ricerca/semplice?str=${enc}`;
  if (body === "UE")  return `https://eur-lex.europa.eu/search.html?query=${enc}`;
  if (body === "BSI") return `https://shop.bsigroup.com/search?q=${enc}&type=standard`;
  if (body === "UNI") return `https://store.uni.com/catalogo/ricerca?text=${enc}`;
  if (body === "DIN") return `https://www.din.de/en/search?q=${enc}`;
  if (body === "EN")  return `https://www.cencenelec.eu/search/?q=${enc}`;
  if (body === "ASME" || /\bASME\b/.test(codeUpper))
    return "https://www.asme.org/codes-standards/find-codes-standards";
  return `https://www.iso.org/search.html?q=${enc}`;
}

function InfoRow({ label, value }) {
  if (value == null || value === "") return null;
  return (
    <div className="doc-detail__info-row">
      <span className="doc-detail__info-label">{label}</span>
      <span className="doc-detail__info-value">{value}</span>
    </div>
  );
}

function InfoLinkRow({ label, href, text }) {
  if (!href) return null;
  return (
    <div className="doc-detail__info-row">
      <span className="doc-detail__info-label">{label}</span>
      <a
        className="doc-detail__catalog-link"
        href={href}
        target="_blank"
        rel="noopener noreferrer"
      >
        {text || "Apri catalogo"}
      </a>
    </div>
  );
}

const NORM_VALIDITY_COLORS = {
  vigente:     { bg: '#dcfce7', color: '#15803d' },
  superata:    { bg: '#fef3c7', color: '#b45309' },
  annullata:   { bg: '#fee2e2', color: '#b91c1c' },
  in_revisione:{ bg: '#dbeafe', color: '#1d4ed8' },
};

function DocumentDetailPanel({ document: doc, history, tags, onEdit, onArchive, onClose }) {
  const { width: panelWidth, startResize } = useDocDetailPanelWidth();

  // Files allegati: l'endpoint dell'albero non li popola, li carichiamo qui
  const [files, setFiles] = useState(doc?.files || []);
  const [filesLoading, setFilesLoading] = useState(false);

  // Verifica validità norma sul catalogo ente
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupResult, setLookupResult] = useState(null);

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
  }, [doc?.id, doc?.files]);

  const normData = useMemo(() => {
    if (!doc || doc.doc_type !== "norma") return null;
    const tsd = parseTypeSpecificData(doc.type_specific_data);
    if (!tsd) return null;
    return {
      standardCode: tsd.standard_code || null,
      normTitle: tsd.norm_title || null,
      issuingBody: tsd.issuing_body || null,
      editionYear: tsd.edition_year ?? null,
      validityStatus: tsd.validity_status || doc.norm_validity_status || null,
      lastCheck: tsd.last_validity_check || doc.norm_last_check || null,
      catalogUrl: tsd.validity_check_url || null,
      supersededBy: tsd.superseded_by || null,
      scopeSummary: tsd.scope_summary || null,
    };
  }, [doc]);

  if (!doc) return null;

  const statusLabel = DOC_STATUS_LABELS[doc.status] ?? doc.status;
  const statusClass = DOC_STATUS_BADGE_CLASS[doc.status] ?? "doc-detail__badge--grey";

  return (
    <div className="doc-detail__overlay" onClick={onClose}>
      <aside
        className="doc-detail"
        style={{ width: panelWidth, maxWidth: panelWidth }}
        onClick={(e) => e.stopPropagation()}
        role="complementary"
        aria-label="Dettagli documento"
      >
        <div
          className="doc-detail__resizer"
          role="separator"
          aria-orientation="vertical"
          aria-label="Ridimensiona pannello documento"
          aria-valuenow={panelWidth}
          aria-valuemin={DOC_DETAIL_WIDTH_MIN}
          aria-valuemax={getDocDetailMaxWidth()}
          onMouseDown={startResize}
        />
        {/* Header */}
        <div className="doc-detail__header">
          <div className="doc-detail__header-top">
            <h2 className="doc-detail__title">{doc.title}</h2>
            <button className="doc-detail__close" onClick={onClose} aria-label="Chiudi">
              {"\u2715"}
            </button>
          </div>
          <span className={"doc-detail__badge " + statusClass}>
            {statusLabel}
          </span>
        </div>

        <div className="doc-detail__body">
          {/* Informazioni */}
          <section className="doc-detail__section">
            <h3 className="doc-detail__section-title">Informazioni</h3>
            <InfoRow label="Codice" value={doc.doc_code} />
            <InfoRow label="Tipo" value={DOC_TYPE_LABELS[doc.doc_type] ?? doc.doc_type} />
            <InfoRow label="Revisione" value={doc.revision != null ? `Rev. ${doc.revision}` : null} />
            <InfoRow label="Data emissione" value={resolveIssueDateDisplay(doc, normData)} />
            {doc.doc_type !== 'norma' && (
              <InfoRow label="Data scadenza" value={formatDate(doc.expiry_date)} />
            )}
            <InfoRow label="Responsabile" value={doc.responsible} />
            <InfoRow label="Azienda" value={doc.company_name} />
            <InfoRow label="Norma" value={doc.standard_reference || doc.standard_code} />
            <InfoRow label="Clausola" value={doc.clause_reference || doc.clause_ref} />
          </section>

          {normData && (
            <section className="doc-detail__section">
              <h3 className="doc-detail__section-title">Norma tecnica</h3>
              <InfoRow label="Codice norma" value={normData.standardCode} />
              <InfoRow label="Titolo norma" value={normData.normTitle} />
              <InfoRow label="Ente emittente" value={normData.issuingBody} />
              <InfoRow label="Anno edizione" value={normData.editionYear != null ? String(normData.editionYear) : null} />
              <div className="doc-detail__scope-summary">
                <span className="doc-detail__info-label">Descrizione</span>
                {normData.scopeSummary ? (
                  <p className="doc-detail__scope-text">{normData.scopeSummary}</p>
                ) : (
                  <p className="doc-detail__placeholder doc-detail__scope-placeholder">
                    Nessuna descrizione disponibile — usa Modifica per aggiungerne una
                  </p>
                )}
              </div>
              {(normData.validityStatus || lookupResult?.status) && (() => {
                const statusKey = lookupResult?.status || normData.validityStatus;
                const colors = NORM_VALIDITY_COLORS[statusKey] || {};
                return (
                  <div className="doc-detail__info-row">
                    <span className="doc-detail__info-label">Vigore</span>
                    <span
                      className="doc-detail__validity-badge"
                      style={{ background: colors.bg, color: colors.color }}
                    >
                      {NORM_VALIDITY_LABELS[statusKey] || statusKey}
                    </span>
                  </div>
                );
              })()}
              <InfoRow label="Sostituita da" value={lookupResult?.supersededBy || normData.supersededBy} />
              <InfoRow label="Ultima verifica" value={lookupResult?.checkedAt ? formatDate(lookupResult.checkedAt) : (normData.lastCheck ? formatDate(normData.lastCheck) : null)} />
              <InfoLinkRow label="Catalogo" href={lookupResult?.catalogUrl || normData.catalogUrl} text="Vedi su catalogo ente" />
              {(normData.issuingBody || normData.standardCode) && (
                <InfoLinkRow
                  label="Catalogo ufficiale"
                  href={buildStaticCatalogUrl(normData.issuingBody, normData.standardCode)}
                  text={"\u2192 Apri nel catalogo ufficiale"}
                />
              )}
              {normData.standardCode && (
                <div className="doc-detail__info-row">
                  <span className="doc-detail__info-label">Controllo online</span>
                  <button
                    className="doc-detail__lookup-btn"
                    disabled={lookupLoading}
                    onClick={async () => {
                      setLookupLoading(true);
                      try {
                        const r = await apiService.lookupNormStatus(normData.standardCode, normData.issuingBody, doc.id);
                        setLookupResult(r);
                      } finally {
                        setLookupLoading(false);
                      }
                    }}
                  >
                    {lookupLoading ? 'Verifica…' : 'Verifica validità'}
                  </button>
                  {lookupResult && lookupResult.status === 'unknown' && (
                    <span className="doc-detail__lookup-warn">Catalogo non raggiunto</span>
                  )}
                </div>
              )}
            </section>
          )}

          {/* Tag */}
          <section className="doc-detail__section">
            <h3 className="doc-detail__section-title">Tag</h3>
            {tags && tags.length > 0 ? (
              <div className="doc-detail__tags">
                {tags.map((t) => (
                  <span key={t.id} className="doc-detail__tag">{t.name}</span>
                ))}
              </div>
            ) : (
              <p className="doc-detail__placeholder">Nessun tag assegnato</p>
            )}
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

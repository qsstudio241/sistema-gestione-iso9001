/**
 * PendingIngestQueue — coda dei caricamenti batch già estratti ma non ancora
 * confermati o scartati (ingest_staging con review_status = "pending", non di
 * rielaborazione). Senza questa coda, chiudendo il pannello di upload o
 * ricaricando la pagina i file restano in staging senza nessuna via per
 * rivederli dalla UI.
 *
 * Riusa lo stile del banner di rielaborazione (`reprocess-banner*`) e la stessa
 * finestra di revisione dell'upload (`IngestReviewDialog`): nessuna scrittura
 * sul registro finché l'operatore non conferma esplicitamente.
 */
import React, { useState, useEffect, useCallback } from "react";
import apiService from "../services/apiService";
import IngestReviewDialog from "./IngestReviewDialog";
import "./ReprocessQueueBanner.css";

const DOC_TYPE_LABELS = {
  patentino_saldatore: "Patentino saldatore",
  qualifica_14732: "Operatore 14732",
  cert_ndt: "Certificato NDT",
};

function mimeFromName(name) {
  const n = String(name || "").toLowerCase();
  if (/\.jpe?g$/.test(n)) return "image/jpeg";
  if (/\.png$/.test(n)) return "image/png";
  return "application/pdf";
}

export default function PendingIngestQueue({ module = "qualifiche", onChanged, refreshKey = 0 }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [openingId, setOpeningId] = useState(null);
  const [error, setError] = useState(null);
  const [reviewItem, setReviewItem] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiService.listIngestStaging({ module, reviewStatus: "pending" });
      setItems((res?.items || []).filter((i) => !i.is_reprocess));
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [module]);

  useEffect(() => { load(); }, [load, refreshKey]);

  const removeItem = useCallback((id) => setItems((prev) => prev.filter((i) => i.id !== id)), []);

  const handleOpen = useCallback(async (item) => {
    setOpeningId(item.id);
    setError(null);
    try {
      const detail = await apiService.getIngestStaging(item.id);
      setReviewItem({
        id: item.id,
        fileName: detail.original_name || item.original_name,
        doc_type: detail.doc_type || item.doc_type,
        fields: detail.fields || item.fields || {},
        field_confidence: detail.field_confidence || {},
        warnings: detail.warnings || item.warnings || [],
        qualification_type: detail.qualification_type || item.qualification_type,
      });
    } catch (e) {
      setError(e?.data?.error || e.message || "Impossibile aprire il documento");
    } finally {
      setOpeningId(null);
    }
  }, []);

  const handleConfirm = useCallback(async (fields) => {
    if (!reviewItem) return;
    setBusy(true);
    try {
      await apiService.confirmIngestStaging(reviewItem.id, fields);
      removeItem(reviewItem.id);
      setReviewItem(null);
      if (onChanged) onChanged();
    } catch (e) {
      window.alert(e?.data?.error || e.message || "Conferma fallita");
    } finally {
      setBusy(false);
    }
  }, [reviewItem, removeItem, onChanged]);

  const handleReject = useCallback(async () => {
    if (!reviewItem) return;
    setBusy(true);
    try {
      await apiService.rejectIngestStaging(reviewItem.id);
      removeItem(reviewItem.id);
      setReviewItem(null);
    } catch (e) {
      window.alert(e?.data?.error || e.message || "Scarto fallito");
    } finally {
      setBusy(false);
    }
  }, [reviewItem, removeItem]);

  if (loading || items.length === 0) return null;

  return (
    <div className="reprocess-banner" data-testid="pending-ingest-queue">
      <div className="reprocess-banner__row" onClick={() => setExpanded((v) => !v)}>
        <span className="reprocess-banner__icon">{"\uD83D\uDCC4"}</span>
        <span className="reprocess-banner__text">
          <strong>{items.length}</strong> document{items.length === 1 ? "o" : "i"} caricat{items.length === 1 ? "o" : "i"}{" "}
          in attesa di revisione (non ancora nel registro)
        </span>
        <button type="button" className="reprocess-banner__toggle">{expanded ? "Nascondi" : "Vedi elenco"}</button>
      </div>

      {error && <p className="reprocess-dialog__error" role="alert">{error}</p>}

      {expanded && (
        <ul className="reprocess-banner__list">
          {items.map((item) => (
            <li key={item.id} className="reprocess-banner__item">
              <span className="reprocess-banner__item-name">
                {item.fields?.person_name || item.original_name || `Documento #${item.id}`}
              </span>
              <span className="reprocess-banner__item-field">
                {DOC_TYPE_LABELS[item.doc_type] || item.doc_type}
                {item.original_name ? ` \u00B7 ${item.original_name}` : ""}
              </span>
              <button
                type="button"
                className="reprocess-banner__review-btn"
                onClick={() => handleOpen(item)}
                disabled={openingId === item.id}
              >
                {openingId === item.id ? "Apertura..." : "Rivedi"}
              </button>
            </li>
          ))}
        </ul>
      )}

      <IngestReviewDialog
        open={!!reviewItem}
        docType={reviewItem?.doc_type || ""}
        fileName={reviewItem?.fileName}
        stagingId={reviewItem?.id}
        mimeType={mimeFromName(reviewItem?.fileName)}
        fields={reviewItem?.fields}
        fieldConfidence={reviewItem?.field_confidence}
        warnings={reviewItem?.warnings}
        qualificationType={reviewItem?.qualification_type}
        onConfirm={handleConfirm}
        onReject={handleReject}
        onClose={() => setReviewItem(null)}
        busy={busy}
      />
    </div>
  );
}

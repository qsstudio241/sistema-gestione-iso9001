/**
 * ReprocessQueueBanner — coda di revisione per le proposte di "rielaborazione"
 * generate dal pannello superadmin "Rielaborazioni disponibili"
 * (backend/scripts/reprocess-qualifications.js, migrazione 137).
 *
 * Quando aggiungiamo un campo nuovo all'estrazione AI (es. transfer_mode), i
 * documenti già presenti in DB possono essere rielaborati dal PDF originale
 * già conservato — senza richiedere un nuovo upload. Ogni proposta resta in
 * coda finché un utente autorizzato non la conferma o scarta esplicitamente:
 * nessuna scrittura automatica sul record definitivo (principio di
 * non-invenzione AI / integrità dati, vedi GUIDA_CONSOLIDATA.md).
 *
 * Generalizzato 08/08/2026 (migrazione 143) dalle sole Qualifiche anche alla
 * WPQR — componente parametrizzato con `module` ("qualifiche" | "saldatura"),
 * mai duplicato: ogni pagina monta la stessa banner con il proprio modulo.
 */
import React, { useState, useEffect, useCallback } from "react";
import apiService from "../services/apiService";
import { getSchemaForDocType } from "../data/documentTypeSchemas";
import IngestSourcePreview from "./IngestSourcePreview";
import "./ReprocessQueueBanner.css";

function fieldLabel(docType, fieldKey) {
  const schema = getSchemaForDocType(docType);
  const field = schema?.fields?.find((f) => f.key === fieldKey);
  if (field?.label) return field.label;
  // Fallback per chiavi di registro rielaborazione che non coincidono col
  // nome campo ingest (es. "wpqr_thickness_max_unlimited" -> colonna reale
  // "thickness_max_unlimited" — prefisso usato solo per evitare collisioni
  // nel registro condiviso tra tabelle, vedi reprocessableFields.js backend).
  return fieldKey.replace(/^wpqr_/, "").replace(/_/g, " ");
}

function fieldValueLabel(docType, fieldKey, value) {
  const schema = getSchemaForDocType(docType);
  const field = schema?.fields?.find((f) => f.key === fieldKey);
  if (field?.type === "select" && Array.isArray(field.options)) {
    const opt = field.options.find((o) => String(o.value) === String(value));
    if (opt) return opt.label;
  }
  return String(value ?? "");
}

function ReprocessProposalDialog({ item, onClose, onConfirmed, onRejected }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  if (!item) return null;

  const field = item.field_scope;
  const value = item.fields?.[field];

  const handleConfirm = async () => {
    setBusy(true);
    setErr(null);
    try {
      await apiService.confirmIngestStaging(item.id, { [field]: value });
      onConfirmed(item.id);
    } catch (e) {
      setErr(e?.data?.error || e.message || "Conferma fallita");
    } finally {
      setBusy(false);
    }
  };

  const handleReject = async () => {
    setBusy(true);
    setErr(null);
    try {
      await apiService.rejectIngestStaging(item.id);
      onRejected(item.id);
    } catch (e) {
      setErr(e?.data?.error || e.message || "Scarto fallito");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="reprocess-dialog__overlay" role="dialog" aria-modal="true">
      <div className="reprocess-dialog">
        <header className="reprocess-dialog__header">
          <h3>Rielaborazione: {fieldLabel(item.doc_type, field)}</h3>
          <p>
            <strong>{item.fields?.person_name || item.fields?.wpqr_code || "—"}</strong>
            {item.fields?.certificate_number && <> — cert. {item.fields.certificate_number}</>}
          </p>
        </header>

        <div className="reprocess-dialog__body">
          <div className="reprocess-dialog__preview">
            <IngestSourcePreview stagingId={item.id} fileName={item.original_name} mimeType="application/pdf" />
          </div>
          <div className="reprocess-dialog__proposal">
            <p className="reprocess-dialog__hint">
              Valore estratto ora dal documento originale già caricato — verificalo prima di confermare.
            </p>
            <div className="reprocess-dialog__field">
              <span className="reprocess-dialog__field-label">{fieldLabel(item.doc_type, field)}</span>
              <span className="reprocess-dialog__field-value">{fieldValueLabel(item.doc_type, field, value)}</span>
            </div>
            {item.warnings?.length > 0 && (
              <div className="reprocess-dialog__warnings">
                {item.warnings.map((w, i) => <div key={i}>{"\u26A0\uFE0F"} {w}</div>)}
              </div>
            )}
            {err && <div className="reprocess-dialog__error">{err}</div>}
          </div>
        </div>

        <footer className="reprocess-dialog__actions">
          <button type="button" className="reprocess-dialog__btn reprocess-dialog__btn--primary" onClick={handleConfirm} disabled={busy}>
            {busy ? "Salvataggio..." : "Conferma e salva"}
          </button>
          <button type="button" className="reprocess-dialog__btn reprocess-dialog__btn--danger" onClick={handleReject} disabled={busy}>
            Scarta proposta
          </button>
          <button type="button" className="reprocess-dialog__btn reprocess-dialog__btn--secondary" onClick={onClose} disabled={busy}>
            Chiudi
          </button>
        </footer>
      </div>
    </div>
  );
}

export default function ReprocessQueueBanner({ module = "qualifiche" }) {
  const [items, setItems] = useState([]);
  const [expanded, setExpanded] = useState(false);
  const [reviewItem, setReviewItem] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiService.listIngestStaging({ module, reprocessOnly: true, reviewStatus: "pending" });
      setItems(res?.items || []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [module]);

  useEffect(() => { load(); }, [load]);

  const removeItem = (id) => setItems((prev) => prev.filter((i) => i.id !== id));

  if (loading || items.length === 0) return null;

  return (
    <div className="reprocess-banner">
      <div className="reprocess-banner__row" onClick={() => setExpanded((v) => !v)}>
        <span className="reprocess-banner__icon">{"\uD83D\uDD04"}</span>
        <span className="reprocess-banner__text">
          <strong>{items.length}</strong> document{items.length === 1 ? "o" : "i"} con dati aggiornati da rivedere
          {" "}(rielaborazione automatica dal documento già caricato)
        </span>
        <button type="button" className="reprocess-banner__toggle">{expanded ? "Nascondi" : "Vedi elenco"}</button>
      </div>

      {expanded && (
        <ul className="reprocess-banner__list">
          {items.map((item) => (
            <li key={item.id} className="reprocess-banner__item">
              <span className="reprocess-banner__item-name">{item.fields?.person_name || item.fields?.wpqr_code || item.original_name}</span>
              <span className="reprocess-banner__item-field">{fieldLabel(item.doc_type, item.field_scope)}: <strong>{fieldValueLabel(item.doc_type, item.field_scope, item.fields?.[item.field_scope])}</strong></span>
              <button type="button" className="reprocess-banner__review-btn" onClick={() => setReviewItem(item)}>
                Rivedi
              </button>
            </li>
          ))}
        </ul>
      )}

      <ReprocessProposalDialog
        item={reviewItem}
        onClose={() => setReviewItem(null)}
        onConfirmed={(id) => { removeItem(id); setReviewItem(null); }}
        onRejected={(id) => { removeItem(id); setReviewItem(null); }}
      />
    </div>
  );
}

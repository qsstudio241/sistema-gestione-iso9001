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
 *
 * Rivisto 09/08/2026 (rilievo committente) su tre punti:
 * 1. Anteprima documento non navigabile: pulsante "Ingrandisci affiancato" +
 *    divisore ridimensionabile, stesso hook useIngestReviewSplit già usato
 *    dalla finestra di caricamento (IngestReviewDialog).
 * 2. Il valore proposto era in sola lettura (solo Conferma/Scarta) — ora è
 *    editabile con lo stesso `FieldInput` della finestra di caricamento,
 *    così una correzione alimenta davvero `import_extraction_feedback` /
 *    `ingest_reference_patterns` (IG-4/IG-5), esattamente come una
 *    correzione fatta al primo caricamento.
 * 3. Più campi da rivedere sullo stesso documento (es. due temperature WPQR)
 *    comparivano come righe/sessioni separate — ora sono raggruppati per
 *    documento (`target_qualification_id`/`target_wpqr_id`): un solo
 *    "Rivedi" apre un'unica finestra con tutti i campi di quel documento,
 *    ciascuno confermabile/scartabile singolarmente (endpoint invariati,
 *    nessuna scrittura batch — resta un aggiornamento mirato per campo).
 */
import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import apiService from "../services/apiService";
import { getSchemaForDocType } from "../data/documentTypeSchemas";
import IngestSourcePreview from "./IngestSourcePreview";
import { FieldInput } from "./IngestReviewDialog";
import useIngestReviewSplit from "../hooks/useIngestReviewSplit";
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
  if (typeof value === "boolean") return value ? "Sì" : "No";
  return String(value ?? "");
}

/**
 * Definizione campo per l'input editabile: usa lo schema quando la chiave
 * coincide, altrimenti un fallback testo semplice — una label mancante o un
 * alias di registro diverso dalla chiave AI non deve mai bloccare la
 * correzione (vedi nota fieldLabel sopra sugli alias "wpqr_*").
 */
function resolveFieldDef(docType, fieldKey) {
  const schema = getSchemaForDocType(docType);
  const match = schema?.fields?.find((f) => f.key === fieldKey);
  if (match) return match;
  return { key: fieldKey, label: fieldLabel(docType, fieldKey), type: "text" };
}

/** Una proposta appartiene a un documento tramite l'una o l'altra colonna target (mai entrambe). */
function groupKeyFor(item) {
  return item.target_qualification_id != null
    ? `qual-${item.target_qualification_id}`
    : `wpqr-${item.target_wpqr_id}`;
}

function groupItems(items) {
  const map = new Map();
  for (const item of items) {
    const key = groupKeyFor(item);
    if (!map.has(key)) map.set(key, { key, docType: item.doc_type, items: [] });
    map.get(key).items.push(item);
  }
  return Array.from(map.values());
}

function groupDisplayName(group) {
  const first = group.items[0];
  return first?.fields?.person_name || first?.fields?.wpqr_code || first?.original_name || "Documento";
}

/** Una riga = una proposta (un campo). Conferma/scarto restano per-campo — solo la finestra è condivisa. */
function ReprocessFieldRow({ item, docType, onDone }) {
  const field = item.field_scope;
  const fieldDef = useMemo(() => resolveFieldDef(docType, field), [docType, field]);
  const originalValue = item.fields?.[field];
  const [value, setValue] = useState(originalValue);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const edited = String(value ?? "") !== String(originalValue ?? "");

  const handleConfirm = async () => {
    setBusy(true);
    setErr(null);
    try {
      await apiService.confirmIngestStaging(item.id, { [field]: value });
      onDone(item.id);
    } catch (e) {
      setErr(e?.data?.error || e.message || "Conferma fallita");
      setBusy(false);
    }
  };

  const handleReject = async () => {
    setBusy(true);
    setErr(null);
    try {
      await apiService.rejectIngestStaging(item.id);
      onDone(item.id);
    } catch (e) {
      setErr(e?.data?.error || e.message || "Scarto fallito");
      setBusy(false);
    }
  };

  return (
    <div className="reprocess-dialog__field-row">
      <label className="reprocess-dialog__field-label" htmlFor={`ingest-field-${item.id}`}>
        {fieldLabel(docType, field)}
        {edited && (
          <span className="reprocess-dialog__field-edited-badge" title="Valore corretto rispetto alla proposta AI">
            corretto
          </span>
        )}
      </label>
      <FieldInput field={{ ...fieldDef, key: item.id }} value={value} onChange={(_, v) => setValue(v)} />
      <p className="reprocess-dialog__field-original">
        Valore proposto dal documento: <strong>{fieldValueLabel(docType, field, originalValue)}</strong>
      </p>
      {item.warnings?.length > 0 && (
        <div className="reprocess-dialog__warnings">
          {item.warnings.map((w, i) => <div key={i}>{"\u26A0\uFE0F"} {w}</div>)}
        </div>
      )}
      {err && <div className="reprocess-dialog__error">{err}</div>}
      <div className="reprocess-dialog__field-row-actions">
        <button type="button" className="reprocess-dialog__btn reprocess-dialog__btn--primary" onClick={handleConfirm} disabled={busy}>
          {busy ? "Salvataggio..." : edited ? "Conferma valore corretto" : "Conferma e salva"}
        </button>
        <button type="button" className="reprocess-dialog__btn reprocess-dialog__btn--danger" onClick={handleReject} disabled={busy}>
          Scarta
        </button>
      </div>
    </div>
  );
}

/** Una finestra per documento: tutti i campi pendenti di quel documento, un'unica anteprima condivisa. */
function ReprocessGroupDialog({ group, onClose, onFieldDone }) {
  const [expanded, setExpanded] = useState(false);
  const layoutRef = useRef(null);
  const { gridTemplateColumns, startResize } = useIngestReviewSplit(layoutRef);

  useEffect(() => {
    if (!group) setExpanded(false);
  }, [group]);

  useEffect(() => {
    if (!group || !expanded) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [group, expanded]);

  if (!group) return null;

  const firstItem = group.items[0];
  const count = group.items.length;

  return (
    <div
      className={`reprocess-dialog__overlay ${expanded ? "reprocess-dialog__overlay--expanded" : ""}`}
      role="dialog"
      aria-modal="true"
    >
      <div className={`reprocess-dialog ${expanded ? "reprocess-dialog--expanded" : ""}`}>
        <header className="reprocess-dialog__header">
          <div className="reprocess-dialog__header-top">
            <h3>Rielaborazione: {groupDisplayName(group)}</h3>
            <button
              type="button"
              className="reprocess-dialog__expand-btn"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? "Riduci" : "Ingrandisci affiancato"}
            </button>
          </div>
          <p>
            {count} camp{count === 1 ? "o" : "i"} da rivedere su questo documento — puoi correggere il valore
            prima di confermare.
          </p>
        </header>

        <div ref={layoutRef} className="reprocess-dialog__layout" style={{ gridTemplateColumns }}>
          <div className="reprocess-dialog__preview">
            <IngestSourcePreview
              stagingId={firstItem.id}
              fileName={firstItem.original_name}
              mimeType="application/pdf"
              tall={expanded}
            />
          </div>

          <div
            className="reprocess-dialog__resizer"
            role="separator"
            aria-orientation="vertical"
            aria-label="Ridimensiona anteprima e campi"
            onMouseDown={startResize}
          />

          <div className="reprocess-dialog__proposal">
            <p className="reprocess-dialog__hint">
              Valori estratti ora dal documento originale già caricato — verificali e correggili se serve, poi
              confermali (o scartali) uno per uno.
            </p>
            {group.items.map((item) => (
              <ReprocessFieldRow key={item.id} item={item} docType={group.docType} onDone={onFieldDone} />
            ))}
          </div>
        </div>

        <footer className="reprocess-dialog__actions">
          <button type="button" className="reprocess-dialog__btn reprocess-dialog__btn--secondary" onClick={onClose}>
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
  const [reviewGroupKey, setReviewGroupKey] = useState(null);
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

  const removeItem = useCallback((id) => setItems((prev) => prev.filter((i) => i.id !== id)), []);

  const groups = useMemo(() => groupItems(items), [items]);
  // Il gruppo aperto è derivato dai groups correnti (non uno snapshot): quando
  // l'ultimo campo del documento viene confermato/scartato, il gruppo scompare
  // e la finestra si chiude da sola — nessuna gestione extra di stato "fatto".
  const reviewGroup = groups.find((g) => g.key === reviewGroupKey) || null;

  if (loading || items.length === 0) return null;

  return (
    <div className="reprocess-banner">
      <div className="reprocess-banner__row" onClick={() => setExpanded((v) => !v)}>
        <span className="reprocess-banner__icon">{"\uD83D\uDD04"}</span>
        <span className="reprocess-banner__text">
          <strong>{groups.length}</strong> document{groups.length === 1 ? "o" : "i"} con dati aggiornati da rivedere
          {" "}(rielaborazione automatica dal documento già caricato)
        </span>
        <button type="button" className="reprocess-banner__toggle">{expanded ? "Nascondi" : "Vedi elenco"}</button>
      </div>

      {expanded && (
        <ul className="reprocess-banner__list">
          {groups.map((group) => {
            const single = group.items.length === 1;
            return (
              <li key={group.key} className="reprocess-banner__item">
                <span className="reprocess-banner__item-name">{groupDisplayName(group)}</span>
                <span className="reprocess-banner__item-field">
                  {single ? (
                    <>
                      {fieldLabel(group.docType, group.items[0].field_scope)}:{" "}
                      <strong>{fieldValueLabel(group.docType, group.items[0].field_scope, group.items[0].fields?.[group.items[0].field_scope])}</strong>
                    </>
                  ) : (
                    <>
                      {group.items.length} campi da rivedere:{" "}
                      {group.items.map((i) => fieldLabel(group.docType, i.field_scope)).join(", ")}
                    </>
                  )}
                </span>
                <button type="button" className="reprocess-banner__review-btn" onClick={() => setReviewGroupKey(group.key)}>
                  Rivedi
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <ReprocessGroupDialog
        group={reviewGroup}
        onClose={() => setReviewGroupKey(null)}
        onFieldDone={removeItem}
      />
    </div>
  );
}

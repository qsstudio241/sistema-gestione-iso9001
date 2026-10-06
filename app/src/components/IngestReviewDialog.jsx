/**
 * IngestReviewDialog — revisione campi estratti pre-commit (IG-3)
 */
import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import apiService from "../services/apiService";
import { getSchemaForDocType } from "../data/documentTypeSchemas";
import { getApplicableWelderFields } from "../data/weldingQualificationRules9606";
import { repairTextEncoding } from "../utils/textEncodingRepair";
import IngestDialogShell from "./IngestDialogShell";
import IngestSourcePreview from "./IngestSourcePreview";
import QualificationVerifyPanel from "./QualificationVerifyPanel";
import "./IngestReviewDialog.css";

const CONFIDENCE_LABELS = {
  high: { label: "Alta", className: "ingest-review__confidence--high" },
  medium: { label: "Media", className: "ingest-review__confidence--medium" },
  low: { label: "Bassa", className: "ingest-review__confidence--low" },
};

function formatFieldValue(value) {
  if (value == null || value === "") return "";
  if (typeof value === "boolean") return value ? "Sì" : "No";
  if (Array.isArray(value)) return value.map((v) => repairTextEncoding(String(v))).join(", ");
  return repairTextEncoding(String(value));
}

const CONFIDENCE_TITLES = {
  high: "Confidenza alta: valore estratto con buona affidabilità — verifica comunque sul PDF",
  medium: "Confidenza media: controlla sul PDF prima di confermare",
  low: "Confidenza bassa: il dato è incerto o assente nell'estrazione — compila tu se presente sul PDF",
};

function ConfidenceBadge({ level }) {
  const meta = CONFIDENCE_LABELS[level] || { label: "N/D", className: "ingest-review__confidence--unknown" };
  const title = CONFIDENCE_TITLES[level]
    || "N/D = confidenza non calcolata (non significa obbligo di compilare). Se la didascalia del campo dice che il vuoto è OK e sul PDF non c'è, lascia vuoto.";
  return (
    <span className={`ingest-review__confidence ${meta.className}`} title={title}>
      {meta.label}
    </span>
  );
}

/**
 * Un campo è "confermato dall'AI" (mostrato readonly, minimo intervento umano)
 * solo se la confidenza della pipeline è alta E c'è un valore non vuoto.
 * Altrimenti (media/bassa/assente) l'operatore deve vederlo subito editabile.
 */
function isFieldConfirmedByAi(confidence, value) {
  if (confidence !== "high") return false;
  if (value == null || value === "") return false;
  if (Array.isArray(value) && value.length === 0) return false;
  return true;
}

function optionLabelFor(field, rawValue) {
  if (!Array.isArray(field?.options)) return rawValue;
  const opt = field.options.find((o) => String(o.value) === String(rawValue));
  return opt ? opt.label : rawValue;
}

function formatReadonlyDisplay(field, value) {
  if (value == null || value === "") return "\u2014";
  if (Array.isArray(value)) {
    if (value.length === 0) return "\u2014";
    return value.map((v) => repairTextEncoding(String(optionLabelFor(field, v)))).join(", ");
  }
  if (typeof value === "boolean") return value ? "Sì" : "No";
  if (field?.type === "select") return repairTextEncoding(String(optionLabelFor(field, value)));
  return repairTextEncoding(String(value));
}

/**
 * Un menu a tendina con opzione "altro" ha per definizione un elenco non
 * esaustivo (enti di certificazione, organismi emittenti, ecc. — nuovi ne
 * compaiono nel tempo). Senza questo fallback, un valore estratto dall'AI
 * che non corrisponde a nessuna opzione veniva scartato silenziosamente dal
 * <select> nativo (mostrato vuoto, nessun avviso) — bug reale segnalato dal
 * committente 08/08/2026 (mancava "IIS - ISSCERT" nell'elenco enti WPQR).
 * @param {object} field
 * @returns {boolean}
 */
function hasAltroFallback(field) {
  return Array.isArray(field?.options) && field.options.some((o) => o.value === "altro");
}

function FieldInput({ field, value, onChange }) {
  const common = {
    id: `ingest-field-${field.key}`,
    className: "ingest-review__input",
    value: value ?? "",
    onChange: (e) => onChange(field.key, e.target.value),
  };

  if (field.type === "boolean") {
    // Prima di questo fix il campo booleano ricadeva sull'input di testo
    // generico in fondo alla funzione (l'operatore doveva scrivere "true"/
    // "false" a mano) — un menu Sì/No è coerente con l'esito booleano reale
    // e con la coercizione già applicata in handleConfirm().
    const v = value === true || value === "true" ? "true" : value === false || value === "false" ? "false" : "";
    return (
      <select
        id={common.id}
        className="ingest-review__input"
        value={v}
        onChange={(e) => onChange(field.key, e.target.value)}
      >
        <option value="">— Seleziona —</option>
        <option value="true">Sì</option>
        <option value="false">No</option>
      </select>
    );
  }

  if (field.type === "select" && Array.isArray(field.options)) {
    if (hasAltroFallback(field)) {
      const v = value ?? "";
      const matchesKnownOption = field.options.some(
        (o) => o.value !== "altro" && String(o.value) === String(v)
      );
      // Due casi che devono mostrare il campo testo: (a) l'operatore ha scelto
      // esplicitamente "Altro" dal menu (valore letteralmente "altro", ancora
      // senza testo digitato), (b) il valore arriva da un'estrazione AI che non
      // corrisponde a nessuna opzione nota (es. un ente non ancora catalogato) —
      // in questo caso il valore reale va mostrato, non scartato.
      const isCustomOrphanValue = v !== "" && v !== "altro" && !matchesKnownOption;
      const showOtherInput = v === "altro" || isCustomOrphanValue;
      const selectValue = showOtherInput ? "altro" : v;
      return (
        <div className="ingest-review__select-with-other">
          <select
            id={common.id}
            className="ingest-review__input"
            value={selectValue}
            onChange={(e) => onChange(field.key, e.target.value)}
          >
            <option value="">— Seleziona —</option>
            {field.options.map((opt) => (
              <option
                key={opt.value || opt.label}
                value={opt.disabled ? "" : opt.value}
                disabled={Boolean(opt.disabled)}
              >
                {opt.label}
              </option>
            ))}
          </select>
          {showOtherInput && (
            <input
              type="text"
              className="ingest-review__input ingest-review__input--other"
              placeholder="Specifica (es. IIS - ISSCERT)"
              value={isCustomOrphanValue ? v : ""}
              onChange={(e) => onChange(field.key, e.target.value)}
            />
          )}
        </div>
      );
    }
    return (
      <select {...common}>
        <option value="">— Seleziona —</option>
        {field.options.map((opt) => (
          <option
            key={opt.value || opt.label}
            value={opt.disabled ? "" : opt.value}
            disabled={Boolean(opt.disabled)}
          >
            {opt.label}
          </option>
        ))}
      </select>
    );
  }

  if (field.type === "number") {
    return <input {...common} type="number" step="any" />;
  }

  if (field.type === "date") {
    return <input {...common} type="date" />;
  }

  return <input {...common} type="text" />;
}

/** Tipi documento ingest per cui esiste la verifica vs norma (VQ-9). */
const VERIFIABLE_DOC_TYPES = new Set(["patentino_saldatore", "qualifica_14732"]);

export function isVerifiableDocType(docType) {
  return VERIFIABLE_DOC_TYPES.has(docType);
}

const VERIFY_IDLE = Object.freeze({ status: "idle", result: null, errorMessage: "" });
const VERIFY_MAX_STRING = 5000;
const VERIFY_MAX_ARRAY = 50;

function isVerifyScalar(v) {
  if (typeof v === "string") return v.trim() !== "" && v.length <= VERIFY_MAX_STRING;
  if (typeof v === "number") return Number.isFinite(v);
  return typeof v === "boolean";
}

/**
 * Payload `fields` per `POST /qualifications/verify`: solo scalari (o array di scalari) non vuoti,
 * entro i limiti accettati dal controller. Se `keys` e' passato restringe ai soli campi rilevanti.
 */
export function buildVerifyFields(source, keys = null) {
  const out = {};
  const entries = keys ? keys.map((k) => [k, source?.[k]]) : Object.entries(source || {});
  for (const [k, v] of entries) {
    if (Array.isArray(v)) {
      const items = v.filter(isVerifyScalar);
      if (items.length > 0 && items.length <= VERIFY_MAX_ARRAY) out[k] = items;
    } else if (isVerifyScalar(v)) {
      out[k] = v;
    }
  }
  return out;
}

/**
 * Stato della verifica qualifica vs norma (VQ-9). La verifica NON blocca mai nulla: gli errori
 * diventano stato `error`/`offline` del pannello. Le chiamate partono solo da `run`/`schedule`
 * (blur con debounce o pulsante), mai a ogni tasto; una stessa combinazione gia' verificata non
 * viene richiesta di nuovo e le risposte superate da una richiesta piu' recente sono ignorate.
 * @returns {{status: string, result: object|null, errorMessage: string,
 *   run: Function, schedule: Function, retry: Function, seed: Function, reset: Function}}
 */
export function useQualificationVerify({ debounceMs = 600 } = {}) {
  const [state, setState] = useState(VERIFY_IDLE);
  const seqRef = useRef(0);
  const timerRef = useRef(null);
  const lastSigRef = useRef(null);
  const pendingSigRef = useRef(null);
  const lastArgsRef = useRef(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => () => {
    clearTimer();
    seqRef.current += 1;
  }, [clearTimer]);

  const run = useCallback(async (fields, qualificationType, { force = false } = {}) => {
    clearTimer();
    const payload = buildVerifyFields(fields);
    const type = typeof qualificationType === "string" ? qualificationType.trim() : "";
    if (Object.keys(payload).length === 0) return;
    lastArgsRef.current = { fields, qualificationType };
    const sig = JSON.stringify([payload, type]);
    if (!force && (sig === lastSigRef.current || sig === pendingSigRef.current)) return;

    const seq = ++seqRef.current;
    pendingSigRef.current = sig;
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      pendingSigRef.current = null;
      setState((prev) => ({ ...prev, status: "offline", errorMessage: "" }));
      return;
    }
    setState((prev) => ({ ...prev, status: "loading", errorMessage: "" }));
    try {
      const res = await apiService.verifyQualification(payload, { qualificationType: type || undefined });
      if (seq !== seqRef.current) return;
      pendingSigRef.current = null;
      const verification = res?.verification ?? res?.data?.verification ?? null;
      if (!verification) throw new Error("Risposta di verifica non valida");
      lastSigRef.current = sig;
      setState({ status: "ready", result: verification, errorMessage: "" });
    } catch (err) {
      if (seq !== seqRef.current) return;
      pendingSigRef.current = null;
      if (err?.code === "OFFLINE") {
        setState((prev) => ({ ...prev, status: "offline", errorMessage: "" }));
      } else {
        setState((prev) => ({
          ...prev,
          status: "error",
          errorMessage: err?.message || "Errore durante la verifica",
        }));
      }
    }
  }, [clearTimer]);

  const schedule = useCallback((getArgs) => {
    clearTimer();
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      const args = typeof getArgs === "function" ? getArgs() : null;
      if (args) run(args.fields, args.qualificationType);
    }, debounceMs);
  }, [clearTimer, debounceMs, run]);

  const retry = useCallback(() => {
    const args = lastArgsRef.current;
    if (args) run(args.fields, args.qualificationType, { force: true });
  }, [run]);

  const seed = useCallback((verification, fields, qualificationType) => {
    clearTimer();
    seqRef.current += 1;
    const payload = buildVerifyFields(fields);
    const type = typeof qualificationType === "string" ? qualificationType.trim() : "";
    lastArgsRef.current = { fields, qualificationType };
    lastSigRef.current = JSON.stringify([payload, type]);
    pendingSigRef.current = null;
    setState({ status: "ready", result: verification, errorMessage: "" });
  }, [clearTimer]);

  const reset = useCallback(() => {
    clearTimer();
    seqRef.current += 1;
    lastSigRef.current = null;
    pendingSigRef.current = null;
    lastArgsRef.current = null;
    // Identita' stabile quando e' gia' idle: reset chiamato a ogni render non innesca re-render.
    setState(VERIFY_IDLE);
  }, [clearTimer]);

  return { ...state, run, schedule, retry, seed, reset };
}

export default function IngestReviewDialog({
  open,
  docType,
  fileName,
  stagingId = null,
  previewFile = null,
  mimeType = "application/pdf",
  fields = {},
  fieldConfidence = {},
  warnings = [],
  qualificationType,
  verification = null,
  onVerificationChange,
  onConfirm,
  onReject,
  onClose,
  busy = false,
}) {
  const schema = useMemo(() => getSchemaForDocType(docType), [docType]);
  const [form, setForm] = useState({});
  const verify = useQualificationVerify();
  const verifiable = isVerifiableDocType(docType);
  const formRef = useRef(form);
  formRef.current = form;
  const verifyInitRef = useRef({ verification, qualificationType, verifiable });
  verifyInitRef.current = { verification, qualificationType, verifiable };
  const { seed: seedVerify, run: runVerify, reset: resetVerify } = verify;
  // Campi confermati dall'AI (alta confidenza) che l'operatore ha scelto di modificare a mano.
  const [editingFields, setEditingFields] = useState(() => new Set());

  useEffect(() => {
    if (open) {
      const cleaned = {};
      for (const [k, v] of Object.entries(fields || {})) {
        cleaned[k] = typeof v === "string" ? repairTextEncoding(v) : v;
      }
      setForm(cleaned);
      setEditingFields(new Set());
      const init = verifyInitRef.current;
      if (!init.verifiable) {
        resetVerify();
      } else if (init.verification) {
        seedVerify(init.verification, cleaned, init.qualificationType);
      } else {
        runVerify(cleaned, init.qualificationType);
      }
    } else {
      resetVerify();
    }
  }, [open, fields, seedVerify, runVerify, resetVerify]);

  useEffect(() => {
    if (verify.status === "ready" && verify.result && onVerificationChange) {
      onVerificationChange(verify.result);
    }
    // onVerificationChange e' volutamente fuori dalle dipendenze: notifica solo al cambio di esito.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verify.status, verify.result]);

  const verifiedMessages = useMemo(() => {
    if (verify.status !== "ready" || !verify.result) return null;
    const msgs = (verify.result.findings || []).map((f) => f?.message_it).filter(Boolean);
    return msgs.length > 0 ? new Set(msgs) : null;
  }, [verify.status, verify.result]);
  const visibleWarnings = verifiedMessages
    ? warnings.filter((w) => !verifiedMessages.has(w))
    : warnings;

  // Verifica solo al blur (mai a ogni tasto); stesso insieme di campi gia' verificato = nessuna chiamata.
  function handleFieldsBlur() {
    if (!verifiable) return;
    verify.schedule(() => ({ fields: formRef.current, qualificationType }));
  }

  const isWelderQualification = (schema?.id || docType) === "patentino_saldatore";
  // Diametro tubo (Tabella 7 ISO 9606-1): pertinente solo se il prodotto testato
  // e' un tubo — vedi getApplicableWelderFields per la motivazione normativa.
  const applicableFields = isWelderQualification
    ? getApplicableWelderFields({ productType: form.product_type })
    : null;

  useEffect(() => {
    if (!applicableFields || applicableFields.pipeDiameterApplicable) return;
    setForm((prev) => {
      if (prev.pipe_diameter_mm == null || prev.pipe_diameter_mm === "") return prev;
      return { ...prev, pipe_diameter_mm: "" };
    });
  }, [applicableFields, fields]);

  if (!open) return null;

  const schemaFields = schema?.fields || [];
  const title = schema?.label || docType;

  function isFieldNotApplicable(field) {
    return field.key === "pipe_diameter_mm" && applicableFields != null && !applicableFields.pipeDiameterApplicable;
  }

  function handleChange(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleEditField(key) {
    setEditingFields((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handleConfirm() {
    const payload = { ...form };
    for (const field of schemaFields) {
      if (field.type === "number" && payload[field.key] !== "" && payload[field.key] != null) {
        payload[field.key] = Number(payload[field.key]);
      }
      if (field.type === "boolean") {
        payload[field.key] = payload[field.key] === true || payload[field.key] === "true" || payload[field.key] === "1";
      }
    }
    // Difesa in profondità (client-side): un campo non applicabile non deve mai
    // essere inviato, anche se residuo da un'estrazione AI precedente — il
    // sanitizer backend (numericSanitizer.js) resta comunque la seconda linea.
    if (applicableFields && !applicableFields.pipeDiameterApplicable) {
      payload.pipe_diameter_mm = null;
    }
    await onConfirm(payload);
  }

  return (
    <IngestDialogShell
      overlayClassName="ingest-review__overlay"
      dialogClassName="ingest-review__dialog"
      ariaLabelledBy="ingest-review-title"
      titleSlot={<h2 id="ingest-review-title" className="ingest-review__title">Revisione {title}</h2>}
      headerExtra={(expanded) => (
        <>
          <p className="ingest-review__file">File: <strong>{fileName}</strong></p>
          {qualificationType && (
            <p className="ingest-review__meta">Tipo rilevato: {qualificationType}</p>
          )}
          <p className="ingest-review__meta ingest-review__meta--hint">
            {expanded
              ? "Documento e campi a schermo intero: trascina il divisore centrale per dare più spazio al PDF o ai campi."
              : "Confronta il documento a sinistra con i campi estratti a destra. Trascina il divisore per ridimensionare le aree."}
          </p>
        </>
      )}
      renderPreview={(expanded) => (
        <IngestSourcePreview
          stagingId={stagingId}
          fileName={fileName}
          mimeType={mimeType}
          previewFile={previewFile}
          tall={expanded}
        />
      )}
      contentClassName="ingest-review__form-pane"
      renderContent={() => (
        <>
          {visibleWarnings.length > 0 && (
            <div className="ingest-review__warnings">
              {visibleWarnings.map((w, i) => (
                <div key={i} className="ingest-review__warning">{"\u26A0\uFE0F"} {w}</div>
              ))}
            </div>
          )}

          {verifiable && verify.status !== "idle" && (
            <div style={{ marginBottom: 12 }} data-testid="ingest-verify">
              <QualificationVerifyPanel
                result={verify.result}
                status={verify.status}
                errorMessage={verify.errorMessage}
                onRetry={verify.retry}
              />
            </div>
          )}

          <div className="ingest-review__fields" onBlur={handleFieldsBlur}>
            {schemaFields.map((field) => {
              const notApplicable = isFieldNotApplicable(field);
              const confidence = fieldConfidence[field.key];
              const confirmedByAi = isFieldConfirmedByAi(confidence, form[field.key]);
              const manuallyEditing = editingFields.has(field.key);
              const showEditable = !notApplicable && (!confirmedByAi || manuallyEditing);
              const attentionLevel = notApplicable ? "not-applicable" : confirmedByAi ? "confirmed" : (confidence || "low");

              return (
                <div
                  key={field.key}
                  className={`ingest-review__field ingest-review__field--${attentionLevel}`}
                >
                  <label className="ingest-review__field-label" htmlFor={`ingest-field-${field.key}`}>
                    {field.label}
                    {field.required && <span className="ingest-review__required">*</span>}
                    {!notApplicable && <ConfidenceBadge level={confidence} />}
                  </label>

                  {notApplicable ? (
                    <div className="ingest-review__readonly ingest-review__readonly--na">
                      <span className="ingest-review__readonly-value">
                        Non applicabile — prodotto: Piastra
                      </span>
                    </div>
                  ) : showEditable ? (
                    <>
                      <FieldInput field={field} value={form[field.key]} onChange={handleChange} />
                      {confirmedByAi && manuallyEditing && (
                        <button
                          type="button"
                          className="ingest-review__cancel-edit-btn"
                          onClick={() => toggleEditField(field.key)}
                        >
                          Annulla modifica (torna al valore confermato dall'AI)
                        </button>
                      )}
                    </>
                  ) : (
                    <div className="ingest-review__readonly">
                      <span className="ingest-review__readonly-value">
                        {"\u2713"} {formatReadonlyDisplay(field, form[field.key])}
                      </span>
                      <button
                        type="button"
                        className="ingest-review__edit-btn"
                        onClick={() => toggleEditField(field.key)}
                      >
                        Modifica
                      </button>
                    </div>
                  )}

                  {!notApplicable && field.hint && <span className="ingest-review__hint">{repairTextEncoding(field.hint)}</span>}
                </div>
              );
            })}
          </div>
        </>
      )}
      footer={(
        <>
          <button
            type="button"
            className="ingest-review__btn ingest-review__btn--primary"
            onClick={handleConfirm}
            disabled={busy}
          >
            {busy ? "Salvataggio..." : "Conferma e salva"}
          </button>
          <button
            type="button"
            className="ingest-review__btn ingest-review__btn--danger"
            onClick={onReject}
            disabled={busy}
          >
            Scarta
          </button>
          <button
            type="button"
            className="ingest-review__btn ingest-review__btn--secondary"
            onClick={onClose}
            disabled={busy}
          >
            Chiudi
          </button>
        </>
      )}
    />
  );
}

export { ConfidenceBadge, formatFieldValue, isFieldConfirmedByAi, formatReadonlyDisplay, FieldInput };

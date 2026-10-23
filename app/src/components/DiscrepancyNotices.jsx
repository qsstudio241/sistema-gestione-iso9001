/**
 * Avvisi di discrepanza e elenco Segnalazioni. Presentazionali: niente fetch.
 * Le frasi stanno in backend/src/content/discrepancyNoticeTexts.js.
 */
import React, { useState } from "react";
import texts from "@sgq-notice-texts";
import "./DiscrepancyNotices.css";

function currentOf(notice, values) {
  if (notice.current_value != null && notice.current_value !== "") return String(notice.current_value);
  const fromForm = values && notice.field ? values[notice.field] : "";
  return fromForm == null || fromForm === "" ? "" : String(fromForm);
}

export default function DiscrepancyNotices({
  notices = [],
  history = [],
  values = {},
  canAct = false,
  canCorrect = false,
  lockedTitle = texts.UI.locked,
  busyCode = null,
  onAction,
  onFocusField,
}) {
  const [panel, setPanel] = useState(null);
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [nextValue, setNextValue] = useState("");
  const [localError, setLocalError] = useState("");

  if (!notices.length && !history.length) return null;

  function disabledFor(action) {
    if (busyCode) return true;
    if (!canAct) return true;
    if (action === "correggi") return !canCorrect;
    return false;
  }

  function openPanel(notice, action) {
    if (disabledFor(action)) return;
    setPanel({ code: notice.code, fingerprint: notice.fingerprint, action });
    setNote("");
    setReason("");
    setNextValue(action === "correggi" ? "" : currentOf(notice, values));
    setLocalError("");
    if (action === "correggi") onFocusField?.(notice.field);
  }

  function submit(notice) {
    if (!panel) return;
    const payload = { note, reason, new_value: nextValue };
    const checked = texts.validateNoticeAction(panel.action, payload);
    if (!checked.ok) {
      setLocalError(checked.error);
      return;
    }
    onAction?.(notice, panel.action, payload);
    setPanel(null);
  }

  return (
    <section className="disc-notices" data-testid="discrepancy-notices" aria-label={texts.UI.sectionTitle}>
      <h4 className="disc-notices__title">{texts.UI.sectionTitle}</h4>
      {!canAct && <p className="disc-notice__help">{lockedTitle}</p>}
      {notices.map((notice) => {
        const open = panel && panel.code === notice.code && panel.fingerprint === notice.fingerprint;
        return (
          <article
            key={`${notice.code}:${notice.fingerprint || ""}`}
            className={`disc-notice disc-notice--${notice.status || "aperto"}`}
            data-testid={`notice-${notice.code}`}
          >
            <p className="disc-notice__msg">{notice.message_it}</p>
            <p className="disc-notice__status">{texts.STATUS_LABEL[notice.status] || notice.status || texts.STATUS_LABEL.aperto}</p>
            {notice.status === "confermato" && (
              <p className="disc-notice__history">
                {texts.confirmHistoryLine({ who: notice.acted_by_name, when: notice.acted_at, note: notice.note })}
              </p>
            )}
            {notice.status === "segnalato" && (
              <p className="disc-notice__history">
                {texts.signalOpenLine({
                  who: notice.acted_by_name,
                  when: notice.acted_at,
                  reason: notice.reason,
                  note: notice.note,
                })}
              </p>
            )}
            {notice.request_draft && (
              <p className="disc-notice__history">
                <strong>{texts.UI.draftLabel}</strong> {notice.request_draft}
              </p>
            )}
            <div className="disc-notice__actions">
              <button type="button" className="disc-notice__btn" disabled={disabledFor("conferma")} onClick={() => openPanel(notice, "conferma")}>
                Conferma
              </button>
              <button type="button" className="disc-notice__btn" disabled={disabledFor("correggi")} onClick={() => openPanel(notice, "correggi")}>
                Correggi
              </button>
              <button type="button" className="disc-notice__btn" disabled={disabledFor("segnala")} onClick={() => openPanel(notice, "segnala")}>
                Segnala
              </button>
            </div>
            <p className="disc-notice__help">{texts.HELP.conferma}</p>
            <p className="disc-notice__help">{texts.HELP.correggi}</p>
            <p className="disc-notice__help">{texts.HELP.segnala}</p>
            {open && panel.action === "conferma" && (
              <div className="disc-notice__panel">
                <label className="disc-notice__label">
                  {texts.UI.noteLabel}
                  <textarea className="disc-notice__input" value={note} onChange={(e) => setNote(e.target.value)} placeholder={texts.UI.notePlaceholder} />
                </label>
                {localError && <p className="disc-notice__error">{localError}</p>}
                <button type="button" className="disc-notice__btn" onClick={() => submit(notice)}>{texts.UI.submitConfirm}</button>
              </div>
            )}
            {open && panel.action === "correggi" && (
              <div className="disc-notice__panel">
                <p className="disc-notice__help">
                  {texts.UI.currentValue}: {currentOf(notice, values) || texts.UI.emptyValue}
                </p>
                <label className="disc-notice__label">
                  {texts.UI.valueLabel}
                  <input className="disc-notice__input" value={nextValue} onChange={(e) => setNextValue(e.target.value)} />
                </label>
                {localError && <p className="disc-notice__error">{localError}</p>}
                <button type="button" className="disc-notice__btn" onClick={() => submit(notice)}>{texts.UI.submitCorrect}</button>
              </div>
            )}
            {open && panel.action === "segnala" && (
              <div className="disc-notice__panel">
                {texts.REASONS.map((item) => (
                  <label key={item.id} className="disc-notice__reason">
                    <input
                      type="radio"
                      name={`reason-${notice.code}`}
                      checked={reason === item.id}
                      onChange={() => setReason(item.id)}
                    />
                    <span>
                      <strong>{item.label}</strong>
                      <span className="disc-notice__help">{item.example}</span>
                    </span>
                  </label>
                ))}
                <label className="disc-notice__label">
                  {texts.UI.noteLabel}
                  <textarea className="disc-notice__input" value={note} onChange={(e) => setNote(e.target.value)} placeholder={texts.UI.notePlaceholder} />
                </label>
                {localError && <p className="disc-notice__error">{localError}</p>}
                <button type="button" className="disc-notice__btn" onClick={() => submit(notice)}>{texts.UI.submitSignal}</button>
              </div>
            )}
          </article>
        );
      })}
      {history.length > 0 && (
        <div className="disc-notice__history-list" data-testid="notice-history">
          <h5 className="disc-notices__title">{texts.UI.historyTitle}</h5>
          {history.map((row) => (
            <p key={`${row.rule_code}:${row.fingerprint}`} className="disc-notice__history">
              {row.message_it ? `${row.message_it} ` : ""}
              {row.status === "corretto"
                ? texts.correctHistoryLine({
                  who: row.acted_by_name,
                  when: row.acted_at,
                  previous: row.previous_value,
                  next: row.new_value,
                })
                : texts.confirmHistoryLine({ who: row.acted_by_name, when: row.acted_at, note: row.note })}
            </p>
          ))}
        </div>
      )}
    </section>
  );
}

export function WpqrSignalsList({
  signals = [],
  reason = "",
  status = "",
  onReason,
  onStatus,
  canApprove = false,
  onApprove,
  error = "",
}) {
  const openCount = signals.filter((row) => row.status === "segnalato").length;
  return (
    <section className="disc-signals" data-testid="wpqr-signals" aria-label={texts.UI.signalsTitle}>
      <h3 className="disc-notices__title">{texts.UI.signalsTitle}</h3>
      <p className="disc-notice__help">{texts.UI.inAppOnly}</p>
      <p className="disc-notice__help">{texts.UI.openCount}: {openCount}</p>
      <div className="disc-signals__filters">
        <label className="disc-notice__label">
          {texts.UI.filterReason}
          <select className="disc-notice__input" value={reason} onChange={(e) => onReason?.(e.target.value)}>
            <option value="">{texts.UI.filterAll}</option>
            {texts.REASONS.map((item) => (
              <option key={item.id} value={item.id}>{item.label}</option>
            ))}
          </select>
        </label>
        <label className="disc-notice__label">
          {texts.UI.filterStatus}
          <select className="disc-notice__input" value={status} onChange={(e) => onStatus?.(e.target.value)}>
            <option value="">{texts.UI.filterAll}</option>
            {Object.entries(texts.STATUS_LABEL).map(([id, label]) => (
              <option key={id} value={id}>{label}</option>
            ))}
          </select>
        </label>
      </div>
      {error && <p className="disc-notice__error">{error}</p>}
      {signals.length === 0 && <p className="disc-notice__help">{texts.UI.signalsEmpty}</p>}
      {signals.map((row) => (
        <article key={row.id} className="disc-notice" data-testid={`signal-${row.id}`}>
          <p className="disc-notice__msg">{row.reference_number || row.wpqr_code || "WPQR"}</p>
          {row.message_it && <p className="disc-notice__help">{row.message_it}</p>}
          <p className="disc-notice__history">
            {texts.signalOpenLine({
              who: row.acted_by_name,
              when: row.acted_at,
              reason: row.reason,
              note: row.note,
            })}
          </p>
          <p className="disc-notice__status">{texts.STATUS_LABEL[row.status] || row.status}</p>
          {row.request_draft && (
            <p className="disc-notice__history"><strong>{texts.UI.draftLabel}</strong> {row.request_draft}</p>
          )}
          {texts.pdfPageLine(row.pdf_page) && <p className="disc-notice__help">{texts.pdfPageLine(row.pdf_page)}</p>}
          {row.reason === "lettura_app" && !row.learning_example && (
            <p className="disc-notice__help">{texts.UI.learningPending}</p>
          )}
          {row.learning_example && (
            <p className="disc-notice__history"><strong>{texts.UI.learningLabel}</strong> {row.learning_example}</p>
          )}
          {canApprove && row.reason === "lettura_app" && !row.learning_example && (
            <button type="button" className="disc-notice__btn" onClick={() => onApprove?.(row.id)}>
              {texts.UI.approveLearning}
            </button>
          )}
        </article>
      ))}
    </section>
  );
}

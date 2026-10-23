/**
 * Avvisi di discrepanza. Presentazionale: niente fetch.
 * Le tre azioni restano nel riquadro anche a ~390px.
 */
import React from "react";
import "./DiscrepancyNotices.css";

const STATUS_LABEL = {
  aperto: "Aperto",
  confermato: "Confermato",
  in_correzione: "In correzione",
  segnalato: "Segnalato",
  corretto: "Corretto",
};

const ACTION_TITLE = {
  conferma: "Conferma che il dato sul PDF è quello giusto",
  correggi: "Correggi il campo e ricontrolla",
  segnala: "Segnala l'avviso a chi può correggerlo",
};

export default function DiscrepancyNotices({
  notices = [],
  canAct = false,
  canCorrect = false,
  lockedTitle = "Sola lettura: non puoi confermare, correggere o segnalare l'avviso",
  busyCode = null,
  onAction,
  onFocusField,
}) {
  if (!notices.length) return null;

  function disabledFor(action) {
    if (busyCode) return true;
    if (action === "correggi") return !canCorrect;
    return !canAct;
  }

  function titleFor(action) {
    if (disabledFor(action) && !busyCode) return lockedTitle;
    return ACTION_TITLE[action];
  }

  return (
    <section className="disc-notices" data-testid="discrepancy-notices" aria-label="Avvisi di discrepanza">
      <h4 className="disc-notices__title">Avvisi di discrepanza</h4>
      {notices.map((notice) => (
        <article
          key={`${notice.code}:${notice.fingerprint || ""}`}
          className={`disc-notice disc-notice--${notice.status || "aperto"}`}
          data-testid={`notice-${notice.code}`}
        >
          <p className="disc-notice__msg">{notice.message_it}</p>
          <p className="disc-notice__status">{STATUS_LABEL[notice.status] || notice.status || "Aperto"}</p>
          <div className="disc-notice__actions">
            <button
              type="button"
              className="disc-notice__btn"
              disabled={disabledFor("conferma")}
              title={titleFor("conferma")}
              onClick={() => onAction?.(notice, "conferma")}
            >
              Conferma
            </button>
            <button
              type="button"
              className="disc-notice__btn"
              disabled={disabledFor("correggi")}
              title={titleFor("correggi")}
              onClick={() => {
                onFocusField?.(notice.field);
                onAction?.(notice, "correggi");
              }}
            >
              Correggi
            </button>
            <button
              type="button"
              className="disc-notice__btn"
              disabled={disabledFor("segnala")}
              title={titleFor("segnala")}
              onClick={() => onAction?.(notice, "segnala")}
            >
              Segnala
            </button>
          </div>
        </article>
      ))}
    </section>
  );
}

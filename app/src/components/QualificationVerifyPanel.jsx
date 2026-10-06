/**
 * QualificationVerifyPanel — avvisi di verifica qualifica vs norma (VQ-2).
 * Presentazionale: nessun fetch, nessuna scrittura; mostra `VerifyResult` come arriva dal motore
 * (contratto: docs/agent-tasks/PLAN_VERIFICA_QUALIFICHE_NORMA_SLICES.md § 1.3).
 * DNA: schema `sq-cov-*` di CoverageVerifyPanel (nessun look nuovo). Non è montato in nessuna pagina (VQ-9).
 */

import React, { useId, useState } from "react";
import { LoadingSpinner } from "./SharedComponents";
import "./CoverageVerifyPanel.css";
import "./QualificationVerifyPanel.css";

export const VERIFY_NOTE =
  "Gli avvisi non impediscono il salvataggio. Il campo di validit\u00e0 del certificato resta quello letto.";

export const VERIFY_STATUS_REASON = {
  non_verificabile_fonte_mancante: "Norma o edizione non coperta dalla libreria",
  non_verificabile_dato_mancante: "Dato di prova assente sul certificato",
};

export const VERIFY_TEXT_STATUS_LABEL = {
  estratto: "estratto",
  estratto_ocr: "estratto OCR",
  assente: "testo norma assente",
};

export const VERIFY_DIRECTION_LABEL = {
  missing: "Dato mancante",
  over_claim: "Validit\u00e0 pi\u00f9 ampia della norma",
  under_claim: "Validit\u00e0 pi\u00f9 stretta della norma",
  mismatch: "Valore non coerente con la norma",
};

const OFFLINE_MESSAGE = "Verifica non disponibile offline: il salvataggio non dipende da essa";
const EMPTY_MESSAGE = "Nessun avviso di verifica";

/** Rende un valore del contratto (`any`) come testo; null/vuoto = «—». */
export function formatVerifyValue(value) {
  if (value === null || value === undefined || value === "") return "\u2014";
  if (Array.isArray(value)) return value.length ? value.map(formatVerifyValue).join(", ") : "\u2014";
  if (typeof value === "boolean") return value ? "S\u00ec" : "No";
  if (typeof value === "object") {
    const { min, max } = value;
    if ("min" in value || "max" in value) {
      return `${formatVerifyValue(min)} \u2013 ${formatVerifyValue(max)}`;
    }
    return JSON.stringify(value);
  }
  return String(value);
}

function clauseText(source) {
  if (!source) return "\u2014";
  const parts = [source.norm, source.edition, source.clause].filter(Boolean);
  return parts.length ? parts.join(" \u00b7 ") : "\u2014";
}

export function isVerifiable(finding) {
  return !finding?.status || finding.status === "verificabile";
}

/** Raggruppa i finding mantenendo l'ordine del motore. */
export function groupVerifyFindings(findings) {
  const list = Array.isArray(findings) ? findings : [];
  return {
    warn: list.filter((f) => isVerifiable(f) && f.severity === "warn"),
    info: list.filter((f) => isVerifiable(f) && f.severity !== "warn"),
    unverifiable: list.filter((f) => !isVerifiable(f)),
  };
}

function FindingItem({ finding }) {
  const unverifiable = !isVerifiable(finding);
  const textStatus = VERIFY_TEXT_STATUS_LABEL[finding.source?.text_status];
  const direction = VERIFY_DIRECTION_LABEL[finding.direction];
  const tagCls = unverifiable || finding.severity !== "warn" ? "sq-cov-stub" : "sq-cov-partial";
  const tagLabel = unverifiable ? "Non verificabile" : finding.severity === "warn" ? "Avviso" : "Informazione";

  return (
    <li className="sq-vfy-item" data-testid="vfy-finding" data-code={finding.code}>
      <div className="sq-vfy-item-head">
        <span className={`sq-tag ${tagCls}`}>{tagLabel}</span>
        {direction && !unverifiable && <span className="sq-cov-muted">{direction}</span>}
        {textStatus && (
          <span className="sq-tag sq-cov-stub" data-testid="vfy-text-status">{textStatus}</span>
        )}
      </div>
      <p className="sq-vfy-message">{finding.message_it}</p>
      {unverifiable && (
        <p className="sq-cov-hint sq-vfy-reason" data-testid="vfy-reason">
          {VERIFY_STATUS_REASON[finding.status] || "Verifica non eseguibile"}
        </p>
      )}
      <table className="sq-cov-table sq-vfy-table">
        <thead>
          <tr>
            <th>Letto</th>
            <th>Atteso dalla norma (informativo)</th>
            <th>Clausola</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td data-testid="vfy-read">{formatVerifyValue(finding.read_value)}</td>
            <td data-testid="vfy-expected">
              {finding.expected_value === null || finding.expected_value === undefined
                ? "\u2014"
                : (
                  <>
                    <span className="sq-cov-muted">La norma darebbe: </span>
                    {formatVerifyValue(finding.expected_value)}
                  </>
                )}
            </td>
            <td data-testid="vfy-clause">{clauseText(finding.source)}</td>
          </tr>
        </tbody>
      </table>
    </li>
  );
}

function FindingGroup({ title, findings, testId, collapsible = false, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = useId();
  if (!findings.length) return null;
  const shown = !collapsible || open;
  return (
    <section className="sq-cov-section" data-testid={testId}>
      {collapsible ? (
        <button
          type="button"
          className="sq-cov-toggle"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? "\u25B2" : "\u25BC"} {title} ({findings.length})
        </button>
      ) : (
        <h4 className="sq-cov-section-title">{title} ({findings.length})</h4>
      )}
      {shown && (
        <ul id={bodyId} className="sq-vfy-list">
          {findings.map((f, idx) => (
            <FindingItem key={`${f.code || "f"}-${idx}`} finding={f} />
          ))}
        </ul>
      )}
    </section>
  );
}

function summaryLine(result, groups) {
  const s = result?.summary;
  const warn = s?.warn ?? groups.warn.length;
  const info = s?.info ?? groups.info.length;
  const unverifiable = s?.non_verificabili ?? groups.unverifiable.length;
  return `${warn} avvisi \u00b7 ${info} informazioni \u00b7 ${unverifiable} non verificabili`;
}

/**
 * @param {object} props
 * @param {object|null} [props.result] VerifyResult del contratto
 * @param {'ready'|'loading'|'error'|'offline'} [props.status]
 * @param {string} [props.errorMessage]
 * @param {() => void} [props.onRetry]
 */
export default function QualificationVerifyPanel({
  result = null,
  status = "ready",
  errorMessage = "",
  onRetry,
}) {
  const loading = status === "loading";
  const groups = groupVerifyFindings(result?.findings);
  const hasFindings = groups.warn.length + groups.info.length + groups.unverifiable.length > 0;

  const retryDisabled = loading || typeof onRetry !== "function";
  const retryTitle = loading
    ? "Verifica in corso"
    : typeof onRetry !== "function"
      ? "Ripetizione non disponibile"
      : "";
  const retryButton = (
    <button
      type="button"
      className="sq-btn-new"
      onClick={() => onRetry && onRetry()}
      disabled={retryDisabled}
      title={retryTitle}
      data-testid="vfy-retry"
    >
      Riprova
    </button>
  );

  let content;
  if (status === "offline") {
    content = (
      <div className="sq-vfy-state" data-testid="vfy-offline">
        <p className="sq-cov-hint">{OFFLINE_MESSAGE}</p>
        {retryButton}
      </div>
    );
  } else if (status === "error") {
    content = (
      <div className="sq-vfy-state">
        <div className="sq-error" role="alert" data-testid="vfy-error">
          {errorMessage || "Errore durante la verifica"}
        </div>
        {retryButton}
      </div>
    );
  } else if (loading) {
    content = (
      <div className="sq-vfy-state" data-testid="vfy-loading">
        <LoadingSpinner size="small" message="Verifica in corso..." />
        {retryButton}
      </div>
    );
  } else if (!result || !hasFindings) {
    content = (
      <p className="sq-cov-hint" data-testid="vfy-empty">{EMPTY_MESSAGE}</p>
    );
  } else {
    content = (
      <>
        <p className="sq-cov-summary" data-testid="vfy-summary">{summaryLine(result, groups)}</p>
        <FindingGroup title="Avvisi" findings={groups.warn} testId="vfy-group-warn" />
        <FindingGroup title="Non verificabili" findings={groups.unverifiable} testId="vfy-group-unverifiable" />
        <FindingGroup
          title="Informazioni"
          findings={groups.info}
          testId="vfy-group-info"
          collapsible
          defaultOpen={false}
        />
      </>
    );
  }

  return (
    <div className="sq-cov-panel sq-vfy-panel" aria-busy={loading} data-testid="vfy-panel">
      <div className="sq-cov-body">
        <h3 className="sq-cov-section-title">Verifica rispetto alla norma</h3>
        {content}
        <p className="sq-cov-hint sq-vfy-note" data-testid="vfy-note">{VERIFY_NOTE}</p>
      </div>
    </div>
  );
}

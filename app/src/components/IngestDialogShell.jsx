/**
 * IngestDialogShell — guscio condiviso tra IngestReviewDialog e
 * ReprocessGroupDialog (dentro ReprocessQueueBanner.jsx): overlay fullscreen,
 * header con pulsante "Ingrandisci affiancato"/"Riduci", layout
 * preview+resizer+contenuto, gestione Escape.
 *
 * Estratto 10/08/2026 (DEPUTYTASK3) dopo verifica che i due dialog
 * condividevano solo il guscio visivo (~60-80 righe di markup/CSS duplicate),
 * non la logica di dominio: quella resta nei rispettivi componenti, passata
 * qui come contenuto (titleSlot/headerExtra/renderPreview/renderContent/
 * footer). Le dimensioni/spaziature specifiche di ciascun dialog (larghezza,
 * altezze, padding) restano nei rispettivi file CSS tramite selettori
 * discendenti sulle classi passate in overlayClassName/dialogClassName —
 * questo componente definisce solo la struttura, non i numeri.
 */
import React, { useState, useEffect, useRef } from "react";
import useIngestReviewSplit from "../hooks/useIngestReviewSplit";
import "./IngestDialogShell.css";

function withExpandedVariant(baseClassName, expanded) {
  if (!baseClassName) return expanded ? "ingest-dialog-shell__overlay--expanded" : "";
  return expanded ? `${baseClassName}--expanded` : "";
}

export default function IngestDialogShell({
  overlayClassName = "",
  dialogClassName = "",
  contentClassName = "",
  ariaLabelledBy,
  titleSlot,
  headerExtra,
  renderPreview,
  renderContent,
  footer,
}) {
  const [expanded, setExpanded] = useState(false);
  const layoutRef = useRef(null);
  const { gridTemplateColumns, startResize, ratio } = useIngestReviewSplit(layoutRef);

  useEffect(() => {
    if (!expanded) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded]);

  const toggleExpand = () => setExpanded((v) => !v);

  const overlayClasses = [
    "ingest-dialog-shell__overlay",
    overlayClassName,
    expanded ? "ingest-dialog-shell__overlay--expanded" : "",
    withExpandedVariant(overlayClassName, expanded),
  ].filter(Boolean).join(" ");

  const dialogClasses = [
    "ingest-dialog-shell__dialog",
    dialogClassName,
    expanded ? "ingest-dialog-shell__dialog--expanded" : "",
    withExpandedVariant(dialogClassName, expanded),
  ].filter(Boolean).join(" ");

  return (
    <div
      className={overlayClasses}
      role="dialog"
      aria-modal="true"
      aria-labelledby={ariaLabelledBy}
    >
      <div className={dialogClasses}>
        <header className="ingest-dialog-shell__header">
          <div className="ingest-dialog-shell__header-top">
            {titleSlot}
            <button
              type="button"
              className="ingest-dialog-shell__expand-btn"
              onClick={toggleExpand}
            >
              {expanded ? "Riduci" : "Ingrandisci affiancato"}
            </button>
          </div>
          {typeof headerExtra === "function" ? headerExtra(expanded) : headerExtra}
        </header>

        <div
          ref={layoutRef}
          className="ingest-dialog-shell__layout"
          style={{ gridTemplateColumns }}
        >
          <aside className="ingest-dialog-shell__preview-pane">
            {renderPreview(expanded)}
          </aside>

          <div
            className="ingest-dialog-shell__resizer"
            role="separator"
            aria-orientation="vertical"
            aria-label="Ridimensiona anteprima e campi"
            aria-valuenow={Math.round(ratio * 100)}
            aria-valuemin={28}
            aria-valuemax={72}
            onMouseDown={startResize}
          />

          <div className={["ingest-dialog-shell__content-pane", contentClassName].filter(Boolean).join(" ")}>
            {renderContent(expanded)}
          </div>
        </div>

        <footer className="ingest-dialog-shell__actions">
          {typeof footer === "function" ? footer(expanded) : footer}
        </footer>
      </div>
    </div>
  );
}

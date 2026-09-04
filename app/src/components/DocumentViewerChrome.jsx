/**
 * DocumentViewerChrome — header unico dei visualizzatori in-app (PDF, Word, Excel).
 *
 * Stesso chrome: Chiudi + Scarica (se previsto) + Schermo intero / Riduci.
 * Schermo intero = overlay sul viewport dell'app (classe CSS), non Fullscreen API
 * e non una finestra Windows. Vietato imitare i pulsanti ─ □ ✕ di sistema.
 */
import React from "react";
import "./DocumentPdfViewer.css";

/**
 * Aggiunge `base--fullscreen` a ogni classe di `baseClassName`.
 * In CSS, `--fullscreen` deve vincere anche in @media ≤640px (selettore
 * doppio dopo il compact — DocumentPdfViewer.css / SpreadsheetViewer.css).
 */
export function withFullscreenClass(baseClassName, fullscreen) {
  if (!baseClassName) return "";
  const parts = String(baseClassName).split(/\s+/).filter(Boolean);
  if (!fullscreen) return parts.join(" ");
  return [...parts, ...parts.map((cls) => `${cls}--fullscreen`)].join(" ");
}

export default function DocumentViewerChrome({
  title,
  icon,
  onClose,
  downloadHref,
  onDownload,
  downloadDisabled = false,
  downloadLabel = "Scarica",
  fullscreen = false,
  onToggleFullscreen,
  extraActions = null,
  badge = null,
  overlayClassName = "pdf-viewer-overlay",
  containerClassName = "pdf-viewer-container",
  children,
}) {
  const showDownloadButton = typeof onDownload === "function";
  const showDownloadLink = Boolean(downloadHref) && !showDownloadButton;

  return (
    <div
      className={withFullscreenClass(overlayClassName, fullscreen)}
      onClick={onClose}
      data-testid="document-viewer-overlay"
      data-fullscreen={fullscreen ? "true" : "false"}
      role="dialog"
      aria-modal="true"
      aria-label={title || "Documento"}
    >
      <div
        className={withFullscreenClass(containerClassName, fullscreen)}
        onClick={(e) => e.stopPropagation()}
        data-testid="document-viewer-container"
      >
        <div className="pdf-viewer-header">
          <div className="pdf-viewer-header__info">
            {icon != null && (
              <span className="pdf-viewer-header__icon" aria-hidden>
                {icon}
              </span>
            )}
            <span className="pdf-viewer-header__title">{title}</span>
            {badge}
          </div>
          <div className="pdf-viewer-header__actions">
            {extraActions}
            {typeof onToggleFullscreen === "function" && (
              <button
                type="button"
                className="pdf-viewer-btn pdf-viewer-btn--fullscreen"
                onClick={() => onToggleFullscreen()}
                title={fullscreen ? "Riduci" : "Schermo intero"}
                aria-pressed={fullscreen}
              >
                {fullscreen ? "\u{2922}" : "\u{26F6}"} {fullscreen ? "Riduci" : "Schermo intero"}
              </button>
            )}
            {showDownloadLink && (
              <a
                href={downloadHref}
                className="pdf-viewer-btn pdf-viewer-btn--download"
                download
                title="Scarica file"
              >
                {"\u{1F4BE}"} {downloadLabel}
              </a>
            )}
            {showDownloadButton && (
              <button
                type="button"
                className="pdf-viewer-btn pdf-viewer-btn--download"
                onClick={onDownload}
                disabled={downloadDisabled}
                title="Scarica file"
              >
                {"\u{1F4BE}"} {downloadLabel}
              </button>
            )}
            <button
              type="button"
              className="pdf-viewer-btn pdf-viewer-btn--close"
              onClick={onClose}
              title="Chiudi"
            >
              {"\u{00D7}"}
            </button>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

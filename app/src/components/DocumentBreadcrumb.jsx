/**
 * DocumentBreadcrumb ù barra orizzontale con percorso navigabile
 *
 * Formato: Home / Cartella / Sotto-cartella / Documento attuale
 * Separatori solo ASCII (evita U+FFFD su font stack senza glifo per ù o em dash).
 * Ogni elemento ù cliccabile tranne l'ultimo (posizione corrente).
 */
import React from "react";
import "./DocumentBreadcrumb.css";

/** Rimuove caratteri di sostituzione da stringhe DB/API (mojibake residuo). */
function sanitizeSegment(s) {
  if (s == null || typeof s !== "string") return s;
  return s.replace(/\uFFFD/g, "").trim();
}

function formatItemLabel(item) {
  const title = sanitizeSegment(item.title);
  const code = item.folder_code != null ? sanitizeSegment(String(item.folder_code)) : "";
  if (code) return `${code} - ${title}`;
  return title;
}

function DocumentBreadcrumb({ items, onNavigate }) {
  if (!items?.length) return null;

  return (
    <nav className="doc-breadcrumb" aria-label="Percorso documento">
      <ol className="doc-breadcrumb__list">
        {/* Home */}
        <li className="doc-breadcrumb__item">
          <button
            className="doc-breadcrumb__link"
            onClick={() => onNavigate(null)}
            type="button"
          >
            <span className="doc-breadcrumb__home" aria-label="Home">&#x1F3E0;</span>
          </button>
        </li>

        {items.map((item, idx) => {
          const isLast = idx === items.length - 1;
          return (
            <li key={item.id} className="doc-breadcrumb__item">
              <span className="doc-breadcrumb__separator" aria-hidden="true">
                /
              </span>
              {isLast ? (
                <span className="doc-breadcrumb__current" aria-current="page">
                  {sanitizeSegment(item.title)}
                </span>
              ) : (
                <button
                  className="doc-breadcrumb__link"
                  onClick={() => onNavigate(item.id)}
                  type="button"
                >
                  {formatItemLabel(item)}
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export default DocumentBreadcrumb;

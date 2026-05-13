/**
 * DocumentBreadcrumb — barra orizzontale con percorso navigabile
 *
 * Formato: Home › Cartella 1 › Sotto-cartella › Documento attuale
 * Ogni elemento è cliccabile tranne l'ultimo (posizione corrente).
 */
import React from "react";
import "./DocumentBreadcrumb.css";

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
              <span className="doc-breadcrumb__separator" aria-hidden="true">›</span>
              {isLast ? (
                <span className="doc-breadcrumb__current" aria-current="page">
                  {item.title}
                </span>
              ) : (
                <button
                  className="doc-breadcrumb__link"
                  onClick={() => onNavigate(item.id)}
                  type="button"
                >
                  {item.folder_code ? `${item.folder_code} — ${item.title}` : item.title}
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

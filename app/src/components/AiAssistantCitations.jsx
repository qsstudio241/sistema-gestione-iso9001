import React, { useEffect, useState } from "react";
import { Link } from "../contexts/RouterContext";
import { getCitationPath, buildSourcesFootnote } from "../utils/aiCitations";
import apiService from "../services/apiService";

function formatBbox(bbox) {
  if (!Array.isArray(bbox) || bbox.length < 4) return null;
  return bbox
    .slice(0, 4)
    .map((n) => {
      const num = Number(n);
      if (!Number.isFinite(num)) return String(n);
      return Number.isInteger(num) ? String(num) : num.toFixed(1);
    })
    .join(", ");
}

function formatScore(score) {
  const num = Number(score);
  if (!Number.isFinite(num)) return null;
  return num.toFixed(2);
}

/**
 * Miniatura autenticata: il tag img non invia Authorization, serve fetch + blob.
 * File assente o errore → placeholder, niente crash.
 */
function FigureThumb({ figureId }) {
  const [src, setSrc] = useState(null);

  useEffect(() => {
    if (figureId == null || figureId === "") {
      setSrc(null);
      return undefined;
    }

    let active = true;
    let objectUrl = null;
    const token = apiService.getToken?.() ?? null;
    const base = apiService.baseUrl || "";
    const url = `${base}/ai/figures/${encodeURIComponent(figureId)}/image`;

    (async () => {
      try {
        const response = await fetch(url, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!response.ok) {
          if (active) setSrc(null);
          return;
        }
        const blob = await response.blob();
        const ct = (response.headers?.get?.("content-type") || blob.type || "").toLowerCase();
        if (!ct.startsWith("image/")) {
          if (active) setSrc(null);
          return;
        }
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      } catch {
        if (active) setSrc(null);
      }
    })();

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [figureId]);

  if (src) {
    return (
      <img
        src={src}
        alt=""
        className="ai-citation-figure-thumb"
      />
    );
  }

  return (
    <span className="ai-citation-figure-placeholder" aria-hidden="true">
      Tavola
    </span>
  );
}

/**
 * Footnote + chip citazioni sotto un messaggio assistant.
 * Opzionale: tavole (crop + pagina + bbox) nello stesso pannello, non una galleria.
 */
export default function AiAssistantCitations({
  citations = [],
  sourcesCount = 0,
  contextUsed = 0,
  figures = [],
}) {
  const count = sourcesCount ?? (citations?.length || 0);
  const figureHits = Array.isArray(figures) ? figures : [];

  return (
    <>
      <div
        className={`ai-msg-context-info ${
          count === 0 ? "ai-msg-context-info--empty" : ""
        }`}
      >
        {buildSourcesFootnote(count, contextUsed || 0)}
      </div>
      {citations?.length > 0 && (
        <div className="ai-msg-citations" role="list" aria-label="Fonti SGQ">
          {citations.map((cit) => {
            const path = getCitationPath(cit);
            const key = `${cit.entityType}-${cit.entityId}`;
            const chip = (
              <span className="ai-citation-chip" title={cit.label}>
                {cit.label}
              </span>
            );
            return path ? (
              <Link
                key={key}
                to={path}
                className="ai-citation-link"
                role="listitem"
              >
                {chip}
              </Link>
            ) : (
              <span
                key={key}
                className="ai-citation-link ai-citation-link--static"
                role="listitem"
              >
                {chip}
              </span>
            );
          })}
        </div>
      )}
      {figureHits.length > 0 && (
        <div className="ai-msg-figures" role="list" aria-label="Tavole citate">
          {figureHits.map((fig, idx) => {
            const page = fig.page != null ? String(fig.page) : null;
            const bbox = formatBbox(fig.bbox);
            const score = formatScore(fig.score);
            const caption = fig.caption ? String(fig.caption) : null;
            const key = fig.id != null ? `fig-${fig.id}` : `fig-${idx}`;
            return (
              <div key={key} className="ai-citation-figure" role="listitem">
                <FigureThumb figureId={fig.id} />
                <div className="ai-citation-figure-meta">
                  {page && <span>{`Pagina ${page}`}</span>}
                  {bbox && <span>{`bbox ${bbox}`}</span>}
                  {caption && (
                    <span className="ai-citation-figure-caption" title={caption}>
                      {caption}
                    </span>
                  )}
                  {score && <span>{`score ${score}`}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

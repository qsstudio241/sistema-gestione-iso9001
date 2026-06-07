import React from "react";
import { Link } from "../contexts/RouterContext";
import { getCitationPath, buildSourcesFootnote } from "../utils/aiCitations";

/**
 * Footnote + chip citazioni sotto un messaggio assistant.
 */
export default function AiAssistantCitations({
  citations = [],
  sourcesCount = 0,
  contextUsed = 0,
}) {
  const count = sourcesCount ?? (citations?.length || 0);

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
    </>
  );
}

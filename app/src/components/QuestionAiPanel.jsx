/**
 * QuestionAiPanel — Fase 1: un pulsante sulla domanda, risposta immediata, Chiudi/Esc/Indietro.
 * Non naviga via. Non scrive Note/esito. Non invia allegati né anagrafica cliente.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import apiService from "../services/apiService";
import AiDisclaimer from "./AiDisclaimer";
import {
  buildSuggestQuestionsPayload,
  formatQuestionAiError,
  historyStateHasQuestionAi,
  pushQuestionAiHistory,
} from "../utils/questionAiContext";
import "./AskAiButton.css";
import "./QuestionAiPanel.css";

export default function QuestionAiPanel({
  question,
  standardCode,
  standardLabel,
  hasLicense = false,
  label,
}) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [response, setResponse] = useState(null);
  const pushedRef = useRef(false);
  const closingRef = useRef(false);
  const requestIdRef = useRef(0);

  const questionKey = String(
    question?.id ?? question?.questionId ?? question?.clauseRef ?? "q"
  );
  const clauseRef = question?.clauseRef;
  const buttonLabel =
    label ||
    (clauseRef ? `Chiedi all'AI \u2014 \u00A7${clauseRef}` : "Chiedi all'AI");

  const collapse = useCallback(() => {
    setExpanded(false);
    setLoading(false);
  }, []);

  const closePanel = useCallback(() => {
    if (!expanded) return;
    collapse();
    if (pushedRef.current && typeof window !== "undefined") {
      closingRef.current = true;
      pushedRef.current = false;
      window.history.back();
    }
  }, [expanded, collapse]);

  const fetchSuggestion = useCallback(async () => {
    const reqId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    setResponse(null);
    try {
      const payload = buildSuggestQuestionsPayload(question, {
        standardCode,
        standardLabel,
      });
      const res = await apiService.post("/ai/question-assistant", payload, {
        timeout: 90000,
      });
      if (reqId !== requestIdRef.current) return;
      if (res && res.success && res.data) {
        setResponse(res.data);
      } else {
        setError("L'assistente non è riuscito a rispondere. Riprova.");
      }
    } catch (err) {
      if (reqId !== requestIdRef.current) return;
      setError(formatQuestionAiError(err));
    } finally {
      if (reqId === requestIdRef.current) setLoading(false);
    }
  }, [question, standardCode, standardLabel]);

  const openPanel = useCallback(() => {
    if (expanded) {
      closePanel();
      return;
    }
    if (typeof window !== "undefined") {
      pushedRef.current = pushQuestionAiHistory(questionKey);
    }
    setExpanded(true);
    fetchSuggestion();
  }, [expanded, closePanel, questionKey, fetchSuggestion]);

  useEffect(() => {
    if (!expanded) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closePanel();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded, closePanel]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const onPop = (event) => {
      if (closingRef.current) {
        closingRef.current = false;
        collapse();
        return;
      }
      if (!historyStateHasQuestionAi(event.state, questionKey)) {
        pushedRef.current = false;
        collapse();
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [questionKey, collapse]);

  useEffect(() => {
    return () => {
      requestIdRef.current += 1;
    };
  }, []);

  if (!hasLicense) {
    return null;
  }

  return (
    <div className="question-ai-panel">
      <button
        type="button"
        className="ask-ai-btn"
        onClick={openPanel}
        title={buttonLabel}
        aria-expanded={expanded}
        aria-controls={`question-ai-panel-${questionKey}`}
      >
        <span className="ask-ai-btn__icon" aria-hidden="true">
          {"\uD83E\uDD16"}
        </span>
        <span className="ask-ai-btn__label">{buttonLabel}</span>
      </button>

      {expanded && (
        <div
          id={`question-ai-panel-${questionKey}`}
          className="ai-panel-content"
          role="region"
          aria-label="Suggerimento AI sulla domanda"
        >
          <div className="ai-panel-toolbar">
            <p className="ai-panel-title">Come porre questa domanda</p>
            <button
              type="button"
              className="btn-secondary ai-panel-close"
              onClick={closePanel}
            >
              Chiudi
            </button>
          </div>

          {loading && (
            <div className="ai-response loading">
              <div className="spinner-sm" />
              <span>L&apos;assistente sta preparando i suggerimenti...</span>
            </div>
          )}

          {error && !loading && (
            <div className="ai-response error" role="alert">
              {error}
            </div>
          )}

          {response && !loading && (
            <div className="ai-response success">
              {response.sourceDisclaimer && (
                <div
                  className={`ai-source-banner ${
                    response.hasOfficialSource ? "official" : "generic"
                  }`}
                >
                  <span>{response.sourceDisclaimer}</span>
                </div>
              )}
              <div
                className="ai-answer"
                dangerouslySetInnerHTML={{
                  __html: formatAiAnswer(response.answer),
                }}
              />
            </div>
          )}

          <AiDisclaimer style={{ marginTop: "0.75rem" }} />
        </div>
      )}
    </div>
  );
}

/**
 * @param {string} text
 * @returns {string}
 */
export function formatAiAnswer(text) {
  if (!text) return "";

  let html = String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/^\d+\.\s+(.+)$/gm, "<li>$1</li>")
    .replace(/\n\n/g, "</p><p>")
    .replace(/\n/g, "<br>");

  html = html.replace(/(<li>.*<\/li>)+/gs, (match) => `<ol>${match}</ol>`);

  if (!html.startsWith("<")) {
    html = `<p>${html}</p>`;
  }

  return html;
}

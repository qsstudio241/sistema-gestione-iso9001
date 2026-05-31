import React, { useState, useEffect, useCallback, useRef } from "react";
import { Link, useRouter } from "../contexts/RouterContext";
import { useAuth } from "../contexts/AuthContext";
import apiService from "../services/apiService";
import AiAssistantCitations from "../components/AiAssistantCitations";
import {
  getSearchResultPath,
  SEARCH_GROUP_LABELS,
  SEARCH_GROUP_ORDER,
} from "../utils/searchResultLinks";
import "./SearchPage.css";

const MIN_QUERY_LEN = 2;
const DEBOUNCE_MS = 350;

function readInitialQuery() {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("q") || "";
}

export default function SearchPage() {
  const { user } = useAuth();
  const { replace } = useRouter();
  const [query, setQuery] = useState(readInitialQuery);
  const [mode, setMode] = useState("exact");
  const [companyId, setCompanyId] = useState("");
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [exactResult, setExactResult] = useState(null);
  const [semanticResult, setSemanticResult] = useState(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    apiService.getCompanies().then((res) => {
      if (cancelled) return;
      const list = res?.data || res?.companies || res || [];
      setCompanies(Array.isArray(list) ? list : []);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const syncUrl = useCallback((term) => {
    const trimmed = term.trim();
    const path = trimmed.length >= MIN_QUERY_LEN
      ? `/search?q=${encodeURIComponent(trimmed)}`
      : "/search";
    replace(path);
  }, [replace]);

  const runExactSearch = useCallback(async (term, scopeCompanyId) => {
    const trimmed = term.trim();
    if (trimmed.length < MIN_QUERY_LEN) {
      setExactResult(null);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const params = { q: trimmed, limit: 10 };
      if (scopeCompanyId) params.companyId = scopeCompanyId;
      const res = await apiService.globalSearch(params);
      const data = res?.data || res;
      setExactResult(data);
    } catch (err) {
      setExactResult(null);
      setError(err?.data?.error || err?.message || "Errore durante la ricerca.");
    } finally {
      setLoading(false);
    }
  }, []);

  const runSemanticSearch = useCallback(async (term, scopeCompanyId) => {
    const trimmed = term.trim();
    if (trimmed.length < MIN_QUERY_LEN) {
      setSemanticResult(null);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const opts = {};
      if (scopeCompanyId) opts.companyId = parseInt(scopeCompanyId, 10);
      const res = await apiService.aiChat(trimmed, opts);
      const data = res?.data || res;
      const citations = Array.isArray(data.citations) ? data.citations : [];
      setSemanticResult({
        reply: data.reply || "Nessuna risposta ricevuta.",
        citations,
        sourcesCount: data.sourcesCount ?? citations.length,
        contextUsed: data.contextUsed || 0,
      });
    } catch (err) {
      setSemanticResult(null);
      setError(err?.data?.error || err?.message || "Errore assistente AI.");
    } finally {
      setLoading(false);
    }
  }, []);

  const triggerSearch = useCallback((term, searchMode, scopeCompanyId) => {
    syncUrl(term);
    if (searchMode === "exact") {
      runExactSearch(term, scopeCompanyId);
    } else {
      runSemanticSearch(term, scopeCompanyId);
    }
  }, [syncUrl, runExactSearch, runSemanticSearch]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      triggerSearch(query, mode, companyId);
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, mode, companyId, triggerSearch]);

  const handleModeChange = (nextMode) => {
    setMode(nextMode);
    setExactResult(null);
    setSemanticResult(null);
    setError(null);
  };

  const totalHits = exactResult?.totalCount ?? 0;
  const hasExactGroups = exactResult?.groups && SEARCH_GROUP_ORDER.some(
    (type) => (exactResult.groups[type] || []).length > 0,
  );

  return (
    <div className="search-page">
      <div className="search-page-header">
        <h2>Ricerca SGQ</h2>
        <p>
          {user?.organization_name
            ? `Studio: ${user.organization_name} ù cerca NC, documenti, audit e altro`
            : "Cerca nel registro dello studio"}
        </p>
      </div>

      <div className="search-controls">
        <div className="search-input-wrap">
          <input
            type="search"
            className="search-input"
            placeholder="Es. saldatura, NC-2024, procedura..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Testo ricerca"
            autoFocus
          />
        </div>

        <select
          className="search-scope-select"
          value={companyId}
          onChange={(e) => setCompanyId(e.target.value)}
          aria-label="Ambito ricerca"
        >
          <option value="">Tutto lo studio</option>
          {companies.map((c) => {
            const id = c.id || c.company_id;
            return (
              <option key={id} value={String(id)}>
                {c.name}
              </option>
            );
          })}
        </select>

        <div className="search-mode-tabs" role="tablist" aria-label="Modalitù ricerca">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "exact"}
            className={`search-mode-tab${mode === "exact" ? " active" : ""}`}
            onClick={() => handleModeChange("exact")}
          >
            Esatto
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "semantic"}
            className={`search-mode-tab${mode === "semantic" ? " active" : ""}`}
            onClick={() => handleModeChange("semantic")}
          >
            Significato
          </button>
        </div>
      </div>

      {loading && (
        <p className="search-status">Ricerca in corso...</p>
      )}

      {!loading && error && (
        <p className="search-status search-status--error">{error}</p>
      )}

      {!loading && !error && query.trim().length < MIN_QUERY_LEN && (
        <p className="search-status">Digita almeno {MIN_QUERY_LEN} caratteri.</p>
      )}

      {mode === "exact" && !loading && !error && query.trim().length >= MIN_QUERY_LEN && (
        <>
          <p className="search-status">
            {totalHits === 0
              ? "Nessun risultato per la ricerca esatta."
              : `${totalHits} risultat${totalHits === 1 ? "o" : "i"} trovat${totalHits === 1 ? "o" : "i"}.`}
          </p>

          {!hasExactGroups && (
            <div className="search-results-empty">
              Prova un termine diverso o passa alla scheda Significato per ricerca semantica.
            </div>
          )}

          {SEARCH_GROUP_ORDER.map((type) => {
            const items = exactResult?.groups?.[type] || [];
            if (items.length === 0) return null;
            return (
              <section key={type} className="search-group" aria-label={SEARCH_GROUP_LABELS[type]}>
                <h3 className="search-group-title">
                  {SEARCH_GROUP_LABELS[type]} ({items.length})
                </h3>
                <ul className="search-result-list">
                  {items.map((item) => {
                    const path = getSearchResultPath(item);
                    const key = `${type}-${item.id}`;
                    const inner = (
                      <>
                        <div className="search-result-title">{item.title}</div>
                        {item.snippet && (
                          <div className="search-result-snippet">{item.snippet}</div>
                        )}
                        <div className="search-result-meta">
                          {item.status && <span>Stato: {item.status}</span>}
                          {item.companyName && (
                            <span>{item.status ? " ù " : ""}{item.companyName}</span>
                          )}
                        </div>
                      </>
                    );
                    return (
                      <li key={key}>
                        {path ? (
                          <Link to={path} className="search-result-item">
                            {inner}
                          </Link>
                        ) : (
                          <div className="search-result-item">{inner}</div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </>
      )}

      {mode === "semantic" && !loading && !error && query.trim().length >= MIN_QUERY_LEN && semanticResult && (
        <div className="search-semantic-panel">
          <div className="search-semantic-reply">{semanticResult.reply}</div>
          <AiAssistantCitations
            citations={semanticResult.citations}
            sourcesCount={semanticResult.sourcesCount}
            contextUsed={semanticResult.contextUsed}
          />
        </div>
      )}

      {mode === "semantic" && !loading && !error && query.trim().length >= MIN_QUERY_LEN && !semanticResult && (
        <div className="search-results-empty">
          Nessuna risposta semantica. Verifica che l&apos;indice AI sia aggiornato.
        </div>
      )}
    </div>
  );
}

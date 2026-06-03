import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import apiService from "../services/apiService";
import { useAuth } from "../contexts/AuthContext";
import { useStorage } from "../contexts/StorageContext";
import {
  filterStandardsForUser,
  resolveAutoStandardFromAudit,
  resolveAutoCompanyFromAudit,
  resolveActiveChecklistFocus,
  buildAuditContextSeparatorLabel,
  buildAiChatContextPayload,
} from "../utils/aiAssistantContext";
import AiAssistantCitations from "../components/AiAssistantCitations";
import {
  buildChatStorageKey,
  loadChatMessages,
  saveChatMessages,
  clearChatMessages,
} from "../utils/aiAssistantChatPersist";
import "./AiAssistantPage.css";

const SUGGESTIONS = [
  "Quante NC aperte ci sono?",
  "Quali documenti sono in scadenza?",
  "Riassumi le conclusioni degli ultimi audit",
  "Quali rischi hanno score pi\u00F9 alto?",
  "Stato delle qualifiche in scadenza",
];

function formatTime(date) {
  return date.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
}

/**
 * Formattazione semplice del testo markdown-like dell'AI:
 * - **bold** -> <strong>
 * - Elenchi puntati (- o * a inizio riga) -> <li>
 * - Paragrafi separati da doppio a capo
 */
function formatAiText(text) {
  if (!text) return null;
  const lines = text.split("\n");
  const elements = [];
  let listItems = [];

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`ul-${elements.length}`}>
          {listItems.map((li, i) => (
            <li key={i} dangerouslySetInnerHTML={{ __html: boldify(li) }} />
          ))}
        </ul>
      );
      listItems = [];
    }
  };

  const boldify = (s) => s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === "") {
      flushList();
      continue;
    }
    const listMatch = line.match(/^[-*\u2022]\s+(.+)/);
    if (listMatch) {
      listItems.push(listMatch[1]);
    } else {
      flushList();
      elements.push(
        <p key={`p-${i}`} dangerouslySetInnerHTML={{ __html: boldify(line) }} />
      );
    }
  }
  flushList();
  return elements;
}

function AiAssistantPage() {
  const { user } = useAuth();
  const { currentAudit, currentAuditId } = useStorage();
  const chatStorageKey = useMemo(
    () => buildChatStorageKey(user?.organization_id, user?.id ?? user?.user_id),
    [user?.organization_id, user?.id, user?.user_id]
  );
  const [messages, setMessages] = useState(() => loadChatMessages(chatStorageKey));
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [reindexing, setReindexing] = useState(false);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const prevAuditIdRef = useRef(null);
  const saveTimerRef = useRef(null);
  const isAdmin = user?.role === "admin" || user?.role === "superadmin";

  // --- Contesto azienda ---
  const [companies, setCompanies] = useState([]);
  const [companiesLoaded, setCompaniesLoaded] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // --- Contesto norma ---
  const [standardDropdownOpen, setStandardDropdownOpen] = useState(false);
  const standardDropdownRef = useRef(null);

  // companyContext: { companyId, companyName, source: 'auto'|'manual' }
  const [companyContext, setCompanyContext] = useState({
    companyId: null,
    companyName: null,
    source: "auto",
  });

  // standardContext: { standardId, label, source: 'auto'|'manual' }
  const [standardContext, setStandardContext] = useState({
    standardId: null,
    label: null,
    source: "auto",
  });

  // Indice ultimo separatore di contesto inserito (posizione nei messaggi)
  const [contextSeparatorIndex, setContextSeparatorIndex] = useState(-1);

  // Ricarica messaggi se cambia org/utente (es. switch account)
  useEffect(() => {
    setMessages(loadChatMessages(chatStorageKey));
    setContextSeparatorIndex(-1);
  }, [chatStorageKey]);

  // Persistenza sessionStorage (debounced, esclude stato loading UI)
  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveChatMessages(chatStorageKey, messages);
    }, 400);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [messages, chatStorageKey]);

  // Pulizia chat al logout
  useEffect(() => {
    const onLogout = () => {
      clearChatMessages(chatStorageKey);
      setMessages([]);
      setContextSeparatorIndex(-1);
    };
    window.addEventListener("sgq:userLoggedOut", onLogout);
    return () => window.removeEventListener("sgq:userLoggedOut", onLogout);
  }, [chatStorageKey]);

  // Carica lista aziende una volta
  useEffect(() => {
    let cancelled = false;
    apiService.getCompanies().then((res) => {
      if (cancelled) return;
      const list = res?.data || res?.companies || res || [];
      setCompanies(Array.isArray(list) ? list : []);
      setCompaniesLoaded(true);
    }).catch(() => {
      if (!cancelled) setCompaniesLoaded(true);
    });
    return () => { cancelled = true; };
  }, []);

  // Inferenza automatica dal currentAudit (solo se source === 'auto')
  const autoCompany = useMemo(
    () => resolveAutoCompanyFromAudit(currentAudit, companies),
    [currentAudit, companies]
  );
  const autoCompanyId = autoCompany.companyId;
  const autoCompanyName = autoCompany.companyName;

  useEffect(() => {
    if (companyContext.source === "auto") {
      setCompanyContext({
        companyId: autoCompanyId,
        companyName: autoCompanyName,
        source: "auto",
      });
    }
  }, [autoCompanyId, autoCompanyName, companyContext.source]);

  const standardsForUser = useMemo(
    () => filterStandardsForUser(user?.allowed_standard_ids),
    [user?.allowed_standard_ids]
  );

  const autoStandard = useMemo(
    () => resolveAutoStandardFromAudit(currentAudit?.metadata?.selectedStandards),
    [currentAudit?.metadata?.selectedStandards]
  );

  useEffect(() => {
    if (standardContext.source === "auto") {
      setStandardContext({
        standardId: autoStandard?.standardId ?? null,
        label: autoStandard?.label ?? null,
        source: "auto",
      });
    }
  }, [autoStandard, standardContext.source]);

  const checklistFocus = useMemo(
    () => resolveActiveChecklistFocus(currentAudit),
    [currentAudit]
  );

  // Separatore chat quando cambia audit aperto
  useEffect(() => {
    const auditUuid = currentAudit?.metadata?.id || currentAudit?.id || null;
    if (!auditUuid || !companiesLoaded) return;

    if (prevAuditIdRef.current && prevAuditIdRef.current !== auditUuid) {
      const auditNumber =
        currentAudit?.metadata?.auditNumber ||
        currentAudit?.metadata?.generalData?.auditNumber ||
        auditUuid.slice(0, 8);
      const separatorText = buildAuditContextSeparatorLabel({
        auditLabel: auditNumber,
        companyName: autoCompanyName,
        standardLabel: autoStandard?.label,
        focus: checklistFocus,
      });
      setMessages((prevMsgs) => {
        const separator = {
          role: "context-separator",
          text: separatorText,
          time: new Date(),
        };
        const nextMsgs = [...prevMsgs, separator];
        setContextSeparatorIndex(nextMsgs.length - 1);
        return nextMsgs;
      });
      setCompanyContext({
        companyId: autoCompanyId,
        companyName: autoCompanyName,
        source: "auto",
      });
      setStandardContext({
        standardId: autoStandard?.standardId ?? null,
        label: autoStandard?.label ?? null,
        source: "auto",
      });
    }
    prevAuditIdRef.current = auditUuid;
  }, [
    currentAuditId,
    currentAudit,
    companiesLoaded,
    autoCompanyId,
    autoCompanyName,
    autoStandard,
    checklistFocus,
  ]);

  // Chiudi dropdown al click fuori
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
      if (standardDropdownRef.current && !standardDropdownRef.current.contains(e.target)) {
        setStandardDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const autoResize = useCallback(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = "auto";
      ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
    }
  }, []);

  // Cambio contesto azienda (manuale o reset)
  const handleContextChange = useCallback((newCompanyId, newCompanyName, source) => {
    const prev = companyContext;
    if (prev.companyId === newCompanyId) {
      setDropdownOpen(false);
      return;
    }

    setCompanyContext({ companyId: newCompanyId, companyName: newCompanyName, source });

    // Inserisci separatore visivo nella chat
    const label = newCompanyName || "Vista complessiva";
    setMessages((prevMsgs) => {
      const separator = {
        role: "context-separator",
        text: `Contesto: ${label}`,
        time: new Date(),
      };
      const nextMsgs = [...prevMsgs, separator];
      setContextSeparatorIndex(nextMsgs.length - 1);
      return nextMsgs;
    });
    setDropdownOpen(false);
  }, [companyContext]);

  const handleStandardChange = useCallback((newStandardId, newLabel, source) => {
    if (standardContext.standardId === newStandardId) {
      setStandardDropdownOpen(false);
      return;
    }

    setStandardContext({ standardId: newStandardId, label: newLabel, source });

    const normLabel = newLabel || "Tutte le norme";
    setMessages((prevMsgs) => {
      const separator = {
        role: "context-separator",
        text: `Norma: ${normLabel}`,
        time: new Date(),
      };
      const nextMsgs = [...prevMsgs, separator];
      setContextSeparatorIndex(nextMsgs.length - 1);
      return nextMsgs;
    });
    setStandardDropdownOpen(false);
  }, [standardContext]);

  // Nuova conversazione — reset stato + sessionStorage
  const handleClear = useCallback(() => {
    clearChatMessages(chatStorageKey);
    setMessages([]);
    setContextSeparatorIndex(-1);
    setCompanyContext({
      companyId: autoCompanyId,
      companyName: autoCompanyName,
      source: "auto",
    });
    setStandardContext({
      standardId: autoStandard?.standardId ?? null,
      label: autoStandard?.label ?? null,
      source: "auto",
    });
  }, [chatStorageKey, autoCompanyId, autoCompanyName, autoStandard]);

  const handleSend = useCallback(async (text) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;

    const userMsg = { role: "user", text: msg, time: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    try {
      const chatCtx = buildAiChatContextPayload(currentAudit, companies);
      const res = await apiService.aiChat(msg, {
        companyId: companyContext.companyId,
        standardId: standardContext.standardId,
        auditId: chatCtx.auditId,
        clauseRef: chatCtx.clauseRef,
        questionId: chatCtx.questionId,
        questionText: chatCtx.questionText,
        standardKey: chatCtx.standardKey,
      });
      const data = res.data || res;
      const citations = Array.isArray(data.citations) ? data.citations : [];
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: data.reply || "Nessuna risposta ricevuta.",
          time: new Date(),
          contextUsed: data.contextUsed || 0,
          sourcesCount: data.sourcesCount ?? citations.length,
          citations,
        },
      ]);
    } catch (err) {
      const errMsg =
        err?.data?.error || err?.message || "Errore di comunicazione con il server.";
      setMessages((prev) => [
        ...prev,
        { role: "error", text: errMsg, time: new Date() },
      ]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, companyContext.companyId, standardContext.standardId, currentAudit, companies]);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const handleReindex = useCallback(async () => {
    if (reindexing) return;
    setReindexing(true);
    try {
      const res = await apiService.aiReindex();
      const data = res.data || res;
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: `Re-indicizzazione completata: ${data.totalChunks || 0} chunk generati. Le risposte dell'assistente ora riflettono i dati pi\u00F9 aggiornati.`,
          time: new Date(),
        },
      ]);
    } catch (err) {
      const errMsg =
        err?.data?.error || err?.message || "Errore durante la re-indicizzazione.";
      setMessages((prev) => [
        ...prev,
        { role: "error", text: errMsg, time: new Date() },
      ]);
    } finally {
      setReindexing(false);
    }
  }, [reindexing]);

  const contextLabel = companyContext.companyName
    ? `Ambito: ${companyContext.companyName}`
    : "Ambito: tutto lo studio";
  const contextIsCompany = !!companyContext.companyId;
  const standardLabel = standardContext.label || "Tutte le norme";
  const contextIsStandard = !!standardContext.standardId;
  const activeStandardEntry = standardsForUser.find(
    (s) => s.standardId === standardContext.standardId
  );

  return (
    <div className="ai-assistant-page">
      {/* Header */}
      <div className="ai-assistant-header">
        <div className="ai-assistant-header-left">
          <span className="ai-assistant-header-icon">{"\uD83E\uDD16"}</span>
          <div>
            <h2>Assistente AI</h2>
            <p>
              {user?.organization_name
                ? `Studio: ${user.organization_name} — chiedi qualsiasi cosa sui dati del tuo SGQ`
                : "Chiedi qualsiasi cosa sui dati del tuo SGQ"}
            </p>
          </div>
        </div>
        <div className="ai-assistant-header-actions">
          {/* Chip contesto azienda */}
          <div className="ai-context-chip-wrapper" ref={dropdownRef}>
            <button
              className={`ai-context-chip ${contextIsCompany ? "ai-context-chip--company" : ""}`}
              onClick={() => setDropdownOpen((v) => !v)}
              title="Cambia contesto azienda"
            >
              <svg className="ai-context-chip-icon" viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
                {contextIsCompany ? (
                  <path d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm1 2h10v2H5V5zm0 4h6v2H5V9zm0 4h8v2H5v-2z" />
                ) : (
                  <path d="M10 2a8 8 0 100 16 8 8 0 000-16zm1 11H9v-2h2v2zm0-4H9V5h2v4z" />
                )}
              </svg>
              <span className="ai-context-chip-label">{contextLabel}</span>
              <svg className="ai-context-chip-arrow" viewBox="0 0 12 12" width="10" height="10" fill="currentColor">
                <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
              </svg>
            </button>
            {dropdownOpen && (
              <div className="ai-context-dropdown">
                <button
                  className={`ai-context-dropdown-item ${!companyContext.companyId ? "active" : ""}`}
                  onClick={() => handleContextChange(null, null, "manual")}
                >
                  <span className="ai-context-dropdown-icon">{"\uD83C\uDF10"}</span>
                  Vista complessiva
                </button>
                {companies.map((c) => {
                  const cId = c.id || c.company_id;
                  const cName = c.name;
                  return (
                    <button
                      key={cId}
                      className={`ai-context-dropdown-item ${companyContext.companyId === cId ? "active" : ""}`}
                      onClick={() => handleContextChange(cId, cName, "manual")}
                    >
                      <span className="ai-context-dropdown-icon">{"\uD83C\uDFE2"}</span>
                      {cName}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Chip contesto norma */}
          <div className="ai-context-chip-wrapper" ref={standardDropdownRef}>
            <button
              className={`ai-context-chip ai-context-chip--standard ${contextIsStandard ? "ai-context-chip--standard-active" : ""}`}
              onClick={() => setStandardDropdownOpen((v) => !v)}
              title="Cambia norma di riferimento"
            >
              <span className="ai-context-chip-icon" aria-hidden="true">
                {contextIsStandard
                  ? activeStandardEntry?.icon || "\uD83D\uDCCB"
                  : "\uD83D\uDCDA"}
              </span>
              <span className="ai-context-chip-label">{standardLabel}</span>
              <svg className="ai-context-chip-arrow" viewBox="0 0 12 12" width="10" height="10" fill="currentColor">
                <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
              </svg>
            </button>
            {standardDropdownOpen && (
              <div className="ai-context-dropdown">
                <button
                  className={`ai-context-dropdown-item ${!standardContext.standardId ? "active" : ""}`}
                  onClick={() => handleStandardChange(null, null, "manual")}
                >
                  <span className="ai-context-dropdown-icon">{"\uD83D\uDCDA"}</span>
                  Tutte le norme
                </button>
                {standardsForUser.map((entry) => (
                  <button
                    key={entry.key}
                    className={`ai-context-dropdown-item ${standardContext.standardId === entry.standardId ? "active" : ""}`}
                    onClick={() => handleStandardChange(entry.standardId, entry.shortLabel, "manual")}
                  >
                    <span className="ai-context-dropdown-icon">{entry.icon}</span>
                    {entry.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Nuova conversazione */}
          {messages.length > 0 && (
            <button
              className="ai-assistant-clear-btn"
              onClick={handleClear}
              title="Nuova conversazione"
              aria-label="Nuova conversazione"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </button>
          )}

          {isAdmin && (
            <button
              className="ai-assistant-reindex-btn"
              onClick={handleReindex}
              disabled={reindexing}
              title="Aggiorna l'indice dei dati per risposte pi\u00F9 accurate"
            >
              {reindexing ? "Indicizzazione..." : "Aggiorna indice"}
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="ai-assistant-messages">
        {messages.length === 0 && (
          <div className="ai-assistant-empty">
            <span className="ai-assistant-empty-icon">{"\uD83D\uDCA1"}</span>
            <h3>Come posso aiutarti?</h3>
            <p>
              Fai una domanda su audit, non conformit\u00E0, reclami, rischi,
              qualifiche, documenti o norme del tuo Sistema di Gestione Qualit\u00E0.
            </p>
            {contextIsCompany && (
              <p className="ai-assistant-empty-context">
                Contesto attivo: <strong>{contextLabel}</strong>
                {contextIsStandard && (
                  <> — Norma: <strong>{standardLabel}</strong></>
                )}
              </p>
            )}
            {!contextIsCompany && contextIsStandard && (
              <p className="ai-assistant-empty-context">
                Norma attiva: <strong>{standardLabel}</strong>
              </p>
            )}
            {checklistFocus?.clauseRef && (
              <p className="ai-assistant-empty-context">
                Clausola attiva: <strong>{"\u00A7"}{checklistFocus.clauseRef}</strong>
                {checklistFocus.questionId ? ` \u2014 dom. ${checklistFocus.questionId}` : ""}
              </p>
            )}
            <div className="ai-assistant-suggestions">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  className="ai-assistant-suggestion-chip"
                  onClick={() => handleSend(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, idx) => {
          const isFaded = contextSeparatorIndex >= 0 && idx < contextSeparatorIndex;

          if (msg.role === "context-separator") {
            return (
              <div key={idx} className="ai-context-separator">
                <span className="ai-context-separator-line" />
                <span className="ai-context-separator-text">{msg.text}</span>
                <span className="ai-context-separator-line" />
              </div>
            );
          }
          if (msg.role === "error") {
            return (
              <div key={idx} className={`ai-msg ai-msg--assistant ${isFaded ? "ai-msg--faded" : ""}`}>
                <span className="ai-msg-avatar">{"\u26A0\uFE0F"}</span>
                <div>
                  <div className="ai-msg-error">{msg.text}</div>
                  <div className="ai-msg-time">{formatTime(msg.time)}</div>
                </div>
              </div>
            );
          }
          return (
            <div
              key={idx}
              className={`ai-msg ai-msg--${msg.role} ${isFaded ? "ai-msg--faded" : ""}`}
            >
              <span className="ai-msg-avatar">
                {msg.role === "user" ? "\uD83D\uDC64" : "\uD83E\uDD16"}
              </span>
              <div>
                <div className="ai-msg-content">
                  {msg.role === "assistant"
                    ? formatAiText(msg.text)
                    : msg.text}
                </div>
                <div className="ai-msg-time">{formatTime(msg.time)}</div>
                {msg.role === "assistant" && (
                  <AiAssistantCitations
                    citations={msg.citations}
                    sourcesCount={msg.sourcesCount}
                    contextUsed={msg.contextUsed}
                  />
                )}
              </div>
            </div>
          );
        })}

        {loading && (
          <div className="ai-msg ai-msg--assistant">
            <span className="ai-msg-avatar">{"\uD83E\uDD16"}</span>
            <div className="ai-msg-content">
              <div className="ai-msg-loading">
                <span className="ai-msg-loading-dot" />
                <span className="ai-msg-loading-dot" />
                <span className="ai-msg-loading-dot" />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="ai-assistant-input-area">
        <textarea
          ref={textareaRef}
          className="ai-assistant-textarea"
          placeholder="Scrivi la tua domanda..."
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            autoResize();
          }}
          onKeyDown={handleKeyDown}
          rows={1}
          disabled={loading}
        />
        <button
          className="ai-assistant-send-btn"
          onClick={() => handleSend()}
          disabled={!input.trim() || loading}
          title="Invia"
        >
          {"\u27A4"}
        </button>
      </div>
    </div>
  );
}

export default AiAssistantPage;

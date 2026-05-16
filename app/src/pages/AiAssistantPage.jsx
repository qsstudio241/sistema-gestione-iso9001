import React, { useState, useRef, useEffect, useCallback } from "react";
import apiService from "../services/apiService";
import { useAuth } from "../contexts/AuthContext";
import "./AiAssistantPage.css";

const SUGGESTIONS = [
  "Quante NC aperte ci sono?",
  "Quali documenti sono in scadenza?",
  "Riassumi le conclusioni degli ultimi audit",
  "Quali rischi hanno score più alto?",
  "Stato delle qualifiche in scadenza",
];

function formatTime(date) {
  return date.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
}

/**
 * Formattazione semplice del testo markdown-like dell'AI:
 * - **bold** ? <strong>
 * - Elenchi puntati (- o * a inizio riga) ? <li>
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
    const listMatch = line.match(/^[-*•]\s+(.+)/);
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
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [reindexing, setReindexing] = useState(false);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const isAdmin = user?.role === "admin" || user?.role === "superadmin";

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
      const res = await apiService.aiChat(msg);
      const data = res.data || res;
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: data.reply || "Nessuna risposta ricevuta.",
          time: new Date(),
          contextUsed: data.contextUsed || 0,
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
  }, [input, loading]);

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
          text: `Re-indicizzazione completata: ${data.totalChunks || 0} chunk generati. Le risposte dell'assistente ora riflettono i dati più aggiornati.`,
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

  return (
    <div className="ai-assistant-page">
      {/* Header */}
      <div className="ai-assistant-header">
        <div className="ai-assistant-header-left">
          <span className="ai-assistant-header-icon">??</span>
          <div>
            <h2>Assistente AI</h2>
            <p>Chiedi qualsiasi cosa sui dati del tuo SGQ</p>
          </div>
        </div>
        {isAdmin && (
          <button
            className="ai-assistant-reindex-btn"
            onClick={handleReindex}
            disabled={reindexing}
            title="Aggiorna l'indice dei dati per risposte più accurate"
          >
            {reindexing ? "Indicizzazione..." : "?? Aggiorna indice"}
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="ai-assistant-messages">
        {messages.length === 0 && (
          <div className="ai-assistant-empty">
            <span className="ai-assistant-empty-icon">??</span>
            <h3>Come posso aiutarti?</h3>
            <p>
              Fai una domanda su audit, non conformità, reclami, rischi,
              qualifiche, documenti o norme del tuo Sistema di Gestione Qualità.
            </p>
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
          if (msg.role === "error") {
            return (
              <div key={idx} className="ai-msg ai-msg--assistant">
                <span className="ai-msg-avatar">??</span>
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
              className={`ai-msg ai-msg--${msg.role}`}
            >
              <span className="ai-msg-avatar">
                {msg.role === "user" ? "??" : "??"}
              </span>
              <div>
                <div className="ai-msg-content">
                  {msg.role === "assistant"
                    ? formatAiText(msg.text)
                    : msg.text}
                </div>
                <div className="ai-msg-time">{formatTime(msg.time)}</div>
                {msg.role === "assistant" && msg.contextUsed > 0 && (
                  <div className="ai-msg-context-info">
                    Basato su {msg.contextUsed} fonti dati
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {loading && (
          <div className="ai-msg ai-msg--assistant">
            <span className="ai-msg-avatar">??</span>
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
          ?
        </button>
      </div>
    </div>
  );
}

export default AiAssistantPage;

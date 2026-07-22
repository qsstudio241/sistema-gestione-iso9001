/**
 * Campo testo multilinea standard SGQ: AutoTextarea (dettatura) + bozza locale + storico versioni.
 * Riusa speech e draft guard senza duplicare logica.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import AutoTextarea from "./AutoTextarea";
import {
  clearNcFieldDraft,
  loadNcFieldDraft,
  pickNcFieldValue,
  saveNcFieldDraft,
} from "../utils/ncFieldDraftStorage";
import {
  appendTextFieldHistory,
  getTextFieldHistory,
} from "../utils/textFieldHistory";
import { markDraft, scheduleClearDraft } from "../utils/draftFieldRegistry";
import "./RichTextField.css";

const DRAFT_DEBOUNCE_MS = 800;

function RichTextField({
  id,
  value,
  onChange,
  onBlur,
  placeholder,
  disabled,
  readOnly,
  rows = 3,
  className = "notes-textarea",
  /** Scope draft: audit UUID oppure `nc:123` / `nc-create` */
  draftScopeId = null,
  draftFieldId = null,
  /** @deprecated usare draftScopeId — compat audit */
  auditUuid = null,
  /** Persistenza localStorage bozza NC */
  persistLocalDraft = false,
  organizationId = null,
  showHistory = true,
}) {
  const scopeId = draftScopeId || auditUuid || null;
  const isDisabled = disabled || readOnly;
  const draftTimerRef = useRef(null);
  const lastHistoryRef = useRef(value);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyEntries, setHistoryEntries] = useState([]);

  const refreshHistory = useCallback(() => {
    if (!showHistory || !scopeId || !draftFieldId) {
      setHistoryEntries([]);
      return;
    }
    setHistoryEntries(getTextFieldHistory(scopeId, draftFieldId));
  }, [showHistory, scopeId, draftFieldId]);

  useEffect(() => {
    refreshHistory();
  }, [refreshHistory, value]);

  useEffect(() => {
    return () => {
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    };
  }, []);

  const scheduleLocalDraft = useCallback(
    (nextValue) => {
      if (!persistLocalDraft || !organizationId || !scopeId || !draftFieldId) return;
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
      draftTimerRef.current = setTimeout(() => {
        saveNcFieldDraft(organizationId, scopeId, draftFieldId, nextValue);
      }, DRAFT_DEBOUNCE_MS);
    },
    [persistLocalDraft, organizationId, scopeId, draftFieldId],
  );

  const handleChange = (e) => {
    const next = e.target.value;
    if (scopeId && draftFieldId) markDraft(scopeId, draftFieldId);
    scheduleLocalDraft(next);
    onChange?.(e);
  };

  const handleFocus = () => {
    if (scopeId && draftFieldId) markDraft(scopeId, draftFieldId);
  };

  const handleBlur = (e) => {
    const current = e?.target?.value ?? value;
    if (scopeId && draftFieldId) {
      scheduleClearDraft(scopeId, draftFieldId, 2000);
      if (showHistory && String(current).trim() !== String(lastHistoryRef.current).trim()) {
        appendTextFieldHistory(scopeId, draftFieldId, current);
        lastHistoryRef.current = current;
        refreshHistory();
      }
    }
    if (persistLocalDraft && organizationId && scopeId && draftFieldId) {
      saveNcFieldDraft(organizationId, scopeId, draftFieldId, current);
    }
    onBlur?.(e);
  };

  const applyHistoryEntry = (text) => {
    if (isDisabled) return;
    if (scopeId && draftFieldId) markDraft(scopeId, draftFieldId);
    onChange?.({ target: { value: text } });
    scheduleLocalDraft(text);
    setHistoryOpen(false);
  };

  const hasHistory = showHistory && historyEntries.length > 0;

  return (
    <div className="rich-text-field">
      <AutoTextarea
        id={id}
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        onFocus={handleFocus}
        placeholder={placeholder}
        disabled={isDisabled}
        rows={rows}
        className={className}
        auditUuid={auditUuid}
        draftScopeId={scopeId}
        draftFieldId={draftFieldId}
      />
      {hasHistory && !isDisabled && (
        <div className="rich-text-field-history">
          <button
            type="button"
            className="rich-text-field-history-toggle"
            onClick={() => setHistoryOpen((o) => !o)}
            aria-expanded={historyOpen}
          >
            {historyOpen ? "\u25B2" : "\u25BC"} Storico testo ({historyEntries.length})
          </button>
          {historyOpen && (
            <ul className="rich-text-field-history-list">
              {historyEntries.map((entry) => (
                <li key={entry.savedAt}>
                  <button
                    type="button"
                    className="rich-text-field-history-item"
                    onClick={() => applyHistoryEntry(entry.text)}
                    title={new Date(entry.savedAt).toLocaleString("it-IT")}
                  >
                    <span className="rich-text-field-history-preview">
                      {entry.text.length > 120 ? `${entry.text.slice(0, 120)}\u2026` : entry.text}
                    </span>
                    <span className="rich-text-field-history-date">
                      {new Date(entry.savedAt).toLocaleString("it-IT", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Valore iniziale campo NC: server + eventuale bozza localStorage.
 */
export function resolveNcFieldInitial(serverValue, organizationId, scopeId, fieldId) {
  const draft = loadNcFieldDraft(organizationId, scopeId, fieldId);
  return pickNcFieldValue(serverValue, draft);
}

export function clearNcFieldDraftsForScope(organizationId, scopeId, fieldIds) {
  if (!organizationId || !scopeId || !fieldIds?.length) return;
  fieldIds.forEach((fid) => clearNcFieldDraft(organizationId, scopeId, fid));
}

export default RichTextField;

/**
 * Shared UI Components
 * Componenti riutilizzabili per l'applicazione
 * Sistema Gestione ISO 9001 - QS Studio
 */

import React from "react";
import "./SharedComponents.css";

// === ERROR BOUNDARY ===
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <div className="error-boundary-content">
            <h2>⚠️ Si è verificato un errore</h2>
            <p>L'applicazione ha riscontrato un errore imprevisto.</p>
            {this.state.error && (
              <pre className="error-details">{this.state.error.toString()}</pre>
            )}
            <button
              onClick={() => window.location.reload()}
              className="btn btn-primary"
            >
              Ricarica Applicazione
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// === LOADING SPINNER ===
export function LoadingSpinner({
  size = "medium",
  message = "Caricamento...",
}) {
  return (
    <div className={`loading-spinner ${size}`}>
      <div className="spinner"></div>
      {message && <p className="loading-message">{message}</p>}
    </div>
  );
}

// === TOAST NOTIFICATION ===
export function Toast({ type = "info", message, onClose }) {
  React.useEffect(() => {
    const timer = setTimeout(() => {
      onClose && onClose();
    }, 4000);

    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`toast toast-${type}`}>
      <span className="toast-icon">
        {type === "success" && "✓"}
        {type === "error" && "✕"}
        {type === "warning" && "⚠️"}
        {type === "info" && "ℹ️"}
      </span>
      <span className="toast-message">{message}</span>
      <button onClick={onClose} className="toast-close">
        ✕
      </button>
    </div>
  );
}

// === CONFIRM DIALOG ===
export function ConfirmDialog({ title, message, onConfirm, onCancel }) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div
        className="modal-content modal-small"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3>{title}</h3>
        </div>
        <div className="modal-body">
          <p>{message}</p>
        </div>
        <div className="modal-footer">
          <button onClick={onCancel} className="btn btn-secondary">
            Annulla
          </button>
          <button onClick={onConfirm} className="btn btn-danger">
            Conferma
          </button>
        </div>
      </div>
    </div>
  );
}

// === AUTO SAVE INDICATOR ===
export function AutoSaveIndicator({ isSaving, lastSaved }) {
  return (
    <div className="autosave-indicator">
      {isSaving ? (
        <>
          <span className="saving-spinner"></span>
          <span>Salvataggio...</span>
        </>
      ) : lastSaved ? (
        <>
          <span className="saved-check">✓</span>
          <span>Salvato {lastSaved.toLocaleTimeString("it-IT")}</span>
        </>
      ) : null}
    </div>
  );
}

// === EMPTY STATE ===
export function EmptyState({ icon = "📭", title, message, action }) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">{icon}</div>
      <h3 className="empty-state-title">{title}</h3>
      {message && <p className="empty-state-message">{message}</p>}
      {action && (
        <button onClick={action.onClick} className="btn btn-primary">
          {action.label}
        </button>
      )}
    </div>
  );
}

// === BADGE ===
export function Badge({ children, variant = "default", ...props }) {
  return (
    <span className={`badge badge-${variant}`} {...props}>
      {children}
    </span>
  );
}

// === PROGRESS BAR ===
export function ProgressBar({
  value,
  max = 100,
  showLabel = true,
  variant = "default",
}) {
  const percentage = Math.round((value / max) * 100);

  return (
    <div className="progress-bar-container">
      <div className={`progress-bar progress-bar-${variant}`}>
        <div
          className="progress-bar-fill"
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showLabel && <span className="progress-bar-label">{percentage}%</span>}
    </div>
  );
}

// === CARD ===
export function Card({ title, children, actions, className = "" }) {
  return (
    <div className={`card ${className}`}>
      {title && (
        <div className="card-header">
          <h4 className="card-title">{title}</h4>
          {actions && <div className="card-actions">{actions}</div>}
        </div>
      )}
      <div className="card-body">{children}</div>
    </div>
  );
}

// === TABS ===
export function Tabs({ tabs, activeTab, onChange }) {
  return (
    <div className="tabs-container">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={`tab ${activeTab === tab.id ? "active" : ""}`}
          onClick={() => onChange(tab.id)}
        >
          {tab.icon && <span className="tab-icon">{tab.icon}</span>}
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export default {
  ErrorBoundary,
  LoadingSpinner,
  Toast,
  ConfirmDialog,
  AutoSaveIndicator,
  EmptyState,
  Badge,
  ProgressBar,
  Card,
  Tabs,
};

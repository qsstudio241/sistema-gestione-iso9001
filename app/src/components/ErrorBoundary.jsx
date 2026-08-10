/**
 * ErrorBoundary - Cattura crash React su Android
 *
 * Mostra UI di errore invece di schermata bianca.
 * Log dettagliati salvati in localStorage per debug.
 *
 * Standard: ISO 9001:2015 punto 10.2 (Nonconformity and corrective action)
 */

import React from "react";
import { reloadIfChunkError } from "../utils/chunkReloadGuard";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorHistory: [],
      chunkReloadTriggered: false,
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log errore in console
    console.error("❌ [ErrorBoundary] Crash catturato:", error, errorInfo);

    // Chunk obsoleto dopo un nuovo deploy Netlify (tab aperta durante il rilascio):
    // ricarica automaticamente una volta invece di mostrare un errore tecnico.
    if (reloadIfChunkError(error)) {
      this.setState({ chunkReloadTriggered: true });
    }

    // Salva errore in stato
    this.setState({
      error,
      errorInfo,
    });

    // Salva in localStorage per analisi post-crash
    const errorLog = {
      timestamp: new Date().toISOString(),
      message: error.toString(),
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      userAgent: navigator.userAgent,
      url: window.location.href,
    };

    try {
      const history = JSON.parse(localStorage.getItem("error_history") || "[]");
      history.push(errorLog);
      // Mantieni solo ultimi 10 errori
      const recentErrors = history.slice(-10);
      localStorage.setItem("error_history", JSON.stringify(recentErrors));
    } catch (e) {
      console.error("Impossibile salvare error log:", e);
    }

    // Invia a servizio error tracking (opzionale - Sentry, LogRocket, etc)
    if (window.gtag) {
      window.gtag("event", "exception", {
        description: error.toString(),
        fatal: true,
      });
    }
  }

  handleReload = () => {
    window.location.reload();
  };

  handleClearErrors = () => {
    localStorage.removeItem("error_history");
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  showErrorHistory = () => {
    const history = JSON.parse(localStorage.getItem("error_history") || "[]");
    const formatted = history
      .map(
        (err, i) =>
          `\n--- Error ${i + 1} (${err.timestamp}) ---\n${err.message}\n${
            err.stack
          }`
      )
      .join("\n");

    alert(`Error History (${history.length} errori):\n${formatted}`);
  };

  render() {
    if (this.state.hasError) {
      if (this.state.chunkReloadTriggered) {
        return (
          <div
            style={{
              padding: "20px",
              maxWidth: "600px",
              margin: "50px auto",
              fontFamily: "Arial, sans-serif",
              backgroundColor: "#fff3cd",
              border: "2px solid #ffc107",
              borderRadius: "8px",
            }}
          >
            <h1 style={{ color: "#856404", marginTop: 0 }}>
              🔄 Aggiornamento disponibile
            </h1>
            <p style={{ fontSize: "16px", lineHeight: "1.6" }}>
              È stata pubblicata una nuova versione dell'app. La pagina si ricarica automaticamente...
            </p>
          </div>
        );
      }
      return (
        <div
          style={{
            padding: "20px",
            maxWidth: "600px",
            margin: "50px auto",
            fontFamily: "Arial, sans-serif",
            backgroundColor: "#fff3cd",
            border: "2px solid #ffc107",
            borderRadius: "8px",
          }}
        >
          <h1 style={{ color: "#856404", marginTop: 0 }}>
            ⚠️ Errore Applicazione
          </h1>

          <p style={{ fontSize: "16px", lineHeight: "1.6" }}>
            L'applicazione ha riscontrato un errore imprevisto.
            {/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) && (
              <> Usa il pulsante debug qui sotto per vedere i dettagli.</>
            )}
          </p>

          <details style={{ marginBottom: "20px" }}>
            <summary
              style={{
                cursor: "pointer",
                fontWeight: "bold",
                padding: "10px",
                backgroundColor: "#fff",
                border: "1px solid #ddd",
                borderRadius: "4px",
              }}
            >
              📋 Dettagli Errore (clicca per espandere)
            </summary>
            <pre
              style={{
                backgroundColor: "#f8f9fa",
                padding: "15px",
                borderRadius: "4px",
                overflow: "auto",
                fontSize: "12px",
                marginTop: "10px",
              }}
            >
              <strong>Messaggio:</strong>
              {"\n"}
              {this.state.error?.toString()}
              {"\n\n"}
              <strong>Stack Trace:</strong>
              {"\n"}
              {this.state.error?.stack}
              {"\n\n"}
              <strong>Component Stack:</strong>
              {"\n"}
              {this.state.errorInfo?.componentStack}
            </pre>
          </details>

          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button
              onClick={this.handleReload}
              style={{
                padding: "12px 20px",
                backgroundColor: "#007bff",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: "bold",
              }}
            >
              🔄 Ricarica Applicazione
            </button>

            <button
              onClick={this.showErrorHistory}
              style={{
                padding: "12px 20px",
                backgroundColor: "#6c757d",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "14px",
              }}
            >
              📜 Vedi Cronologia Errori
            </button>

            <button
              onClick={this.handleClearErrors}
              style={{
                padding: "12px 20px",
                backgroundColor: "#28a745",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "14px",
              }}
            >
              ✅ Reset & Continua
            </button>
          </div>

          <p
            style={{
              marginTop: "20px",
              fontSize: "12px",
              color: "#6c757d",
              borderTop: "1px solid #ddd",
              paddingTop: "10px",
            }}
          >
            <strong>Suggerimento:</strong> Se il problema persiste, prova a:
            <ul style={{ marginTop: "5px" }}>
              <li>Cancellare cache browser</li>
              <li>Aggiornare l'app (se installata come PWA)</li>
              <li>Contattare supporto QS Studio con screenshot errore</li>
            </ul>
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

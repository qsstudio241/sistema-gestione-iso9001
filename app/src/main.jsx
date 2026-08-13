import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import ErrorBoundary from "./components/ErrorBoundary";
import { reloadIfChunkError } from "./utils/chunkReloadGuard";
import "./index.css";

// Rete di sicurezza per import() dinamici fuori da React.lazy (es. librerie
// caricate on-demand come docx-preview): quando il rejection non è già stato
// gestito da un try/catch locale, intercettiamo qui il chunk obsoleto dopo
// un deploy Netlify e ricarichiamo la pagina (stessa guardia anti-loop).
window.addEventListener("unhandledrejection", (event) => {
  if (reloadIfChunkError(event.reason)) {
    event.preventDefault();
  }
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);

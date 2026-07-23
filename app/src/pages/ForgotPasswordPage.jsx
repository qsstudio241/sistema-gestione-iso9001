/**
 * ForgotPasswordPage — pagina pubblica "Password dimenticata?" (UAL-4)
 *
 * Raggiunta dal link "Password dimenticata?" nella schermata di login. Nessuna
 * autenticazione richiesta. Mostra sempre lo stesso messaggio generico di
 * conferma dopo l'invio, indipendentemente dal fatto che l'email inserita
 * corrisponda o meno a un account esistente (protezione anti user-enumeration
 * — vedi piano UAL Fase 2). Riusa gli stessi stili di Login.css per coerenza
 * visiva, stesso pattern di AcceptInvitePage.jsx.
 */
import React, { useState } from "react";
import { useNavigate } from "../contexts/RouterContext";
import apiService from "../services/apiService";
import "../components/Login.css";

const GENERIC_MESSAGE = "Se l'indirizzo è registrato, riceverai un'email con le istruzioni per reimpostare la password.";

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");

    if (!email.trim()) {
      setFormError("Inserire un indirizzo email.");
      return;
    }

    setSubmitting(true);
    try {
      await apiService.forgotPassword(email.trim());
    } catch (_err) {
      // Volutamente ignorato: il messaggio mostrato all'utente resta identico
      // in ogni caso (successo, email inesistente, errore di rete), per non
      // rivelare alcuna informazione sull'esistenza dell'account.
    } finally {
      setSubmitting(false);
      setSent(true);
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-header">
          <div className="login-logo">
            <span className="logo-icon">🔒</span>
          </div>
          <h1>Password dimenticata?</h1>
          <p className="login-subtitle">Sistema Gestione ISO</p>
        </div>

        {!sent ? (
          <form onSubmit={handleSubmit} className="login-form">
            <p>Inserisci l'email del tuo account: se è registrata, riceverai un link per reimpostare la password.</p>

            {formError && (
              <div className="login-error">
                <span className="error-icon">⚠️</span>
                {formError}
              </div>
            )}

            <div className="form-group">
              <label htmlFor="forgot-email">
                <span className="field-icon">📧</span>
                Email
              </label>
              <input
                type="email"
                id="forgot-email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Inserisci email"
                autoComplete="email"
                autoFocus
                disabled={submitting}
              />
            </div>

            <button type="submit" className="btn-login" disabled={submitting}>
              {submitting ? "Invio in corso..." : "Invia istruzioni"}
            </button>

            <button
              type="button"
              className="btn-login"
              style={{ marginTop: "0.5rem", background: "transparent", color: "inherit", border: "1px solid currentColor" }}
              onClick={() => navigate("/")}
            >
              Torna al login
            </button>
          </form>
        ) : (
          <div className="login-form">
            <p>✅ {GENERIC_MESSAGE}</p>
            <button type="button" className="btn-login" onClick={() => navigate("/")}>
              Vai al login
            </button>
          </div>
        )}

        <div className="login-footer">
          <p>© {new Date().getFullYear()} QS Studio - Sistema Gestione ISO</p>
        </div>
      </div>
    </div>
  );
}

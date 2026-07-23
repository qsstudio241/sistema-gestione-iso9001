/**
 * AcceptInvitePage — pagina pubblica "Imposta la tua password" (UAL-3)
 *
 * Raggiunta dal link /accept-invite/:token inviato via email quando un admin
 * crea un utente con la modalità "Invia invito" invece di impostare subito la
 * password. Nessuna autenticazione richiesta: l'utente non ha ancora un account
 * attivo. Riusa gli stessi stili di Login.css per coerenza visiva con la
 * schermata di accesso, invece di introdurre un CSS parallelo.
 */
import React, { useState, useEffect } from "react";
import { useNavigate } from "../contexts/RouterContext";
import apiService from "../services/apiService";
import "../components/Login.css";

export default function AcceptInvitePage({ token }) {
  const navigate = useNavigate();
  const [status, setStatus] = useState("checking"); // checking | ready | invalid | success
  const [checkError, setCheckError] = useState("");
  const [inviteInfo, setInviteInfo] = useState(null);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    let cancelled = false;
    if (!token) {
      setStatus("invalid");
      setCheckError("Link di invito non valido.");
      return;
    }
    (async () => {
      try {
        const res = await apiService.checkInviteToken(token);
        if (cancelled) return;
        setInviteInfo(res?.data || null);
        setStatus("ready");
      } catch (err) {
        if (cancelled) return;
        setCheckError(err.message || "Link di invito non valido o scaduto.");
        setStatus("invalid");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");

    if (!password || password.length < 8) {
      setFormError("La password deve avere almeno 8 caratteri.");
      return;
    }
    if (password !== confirmPassword) {
      setFormError("Le due password non coincidono.");
      return;
    }

    setSubmitting(true);
    try {
      await apiService.acceptInvite(token, password);
      setStatus("success");
    } catch (err) {
      setFormError(err.message || "Errore durante l'attivazione dell'account.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-header">
          <div className="login-logo">
            <span className="logo-icon">🔒</span>
          </div>
          <h1>Attiva il tuo account</h1>
          <p className="login-subtitle">Sistema Gestione ISO</p>
        </div>

        {status === "checking" && (
          <div className="login-form">
            <p>Verifica del link di invito in corso...</p>
          </div>
        )}

        {status === "invalid" && (
          <div className="login-form">
            <div className="login-error">
              <span className="error-icon">⚠️</span>
              {checkError}
            </div>
            <button type="button" className="btn-login" onClick={() => navigate("/")}>
              Vai al login
            </button>
          </div>
        )}

        {status === "ready" && (
          <form onSubmit={handleSubmit} className="login-form">
            <p>
              {inviteInfo?.full_name ? `Ciao ${inviteInfo.full_name}, i` : "I"}mposta la
              password per {inviteInfo?.email ? <strong>{inviteInfo.email}</strong> : "il tuo account"}.
            </p>

            {formError && (
              <div className="login-error">
                <span className="error-icon">⚠️</span>
                {formError}
              </div>
            )}

            <div className="form-group">
              <label htmlFor="invite-password">
                <span className="field-icon">🔑</span>
                Nuova password (min. 8 caratteri)
              </label>
              <div className="password-input-wrapper">
                <input
                  type={showPassword ? "text" : "password"}
                  id="invite-password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={submitting}
                  autoFocus
                />
                <button
                  type="button"
                  className="toggle-password"
                  onClick={() => setShowPassword((s) => !s)}
                  tabIndex={-1}
                >
                  {showPassword ? "🙈" : "👁️"}
                </button>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="invite-confirm-password">
                <span className="field-icon">🔑</span>
                Conferma password
              </label>
              <input
                type={showPassword ? "text" : "password"}
                id="invite-confirm-password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={submitting}
              />
            </div>

            <button type="submit" className="btn-login" disabled={submitting}>
              {submitting ? "Attivazione in corso..." : "Attiva account"}
            </button>
          </form>
        )}

        {status === "success" && (
          <div className="login-form">
            <p>✅ Password impostata correttamente. Il tuo account è ora attivo.</p>
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

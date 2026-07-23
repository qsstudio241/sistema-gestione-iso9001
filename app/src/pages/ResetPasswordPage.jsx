/**
 * ResetPasswordPage — pagina pubblica "Imposta una nuova password" (UAL-4)
 *
 * Raggiunta dal link /reset-password/:token inviato via email dopo la richiesta
 * di "password dimenticata". Nessuna autenticazione richiesta. Stesso pattern
 * di AcceptInvitePage.jsx: verifica il token (checking → ready/invalid), poi
 * mostra il form nuova password + conferma (ready → success).
 */
import React, { useState, useEffect } from "react";
import { useNavigate } from "../contexts/RouterContext";
import apiService from "../services/apiService";
import "../components/Login.css";

export default function ResetPasswordPage({ token }) {
  const navigate = useNavigate();
  const [status, setStatus] = useState("checking"); // checking | ready | invalid | success
  const [checkError, setCheckError] = useState("");
  const [resetInfo, setResetInfo] = useState(null);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    let cancelled = false;
    if (!token) {
      setStatus("invalid");
      setCheckError("Link non valido.");
      return;
    }
    (async () => {
      try {
        const res = await apiService.checkResetToken(token);
        if (cancelled) return;
        setResetInfo(res?.data || null);
        setStatus("ready");
      } catch (err) {
        if (cancelled) return;
        setCheckError(err.message || "Link non valido o scaduto.");
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
      await apiService.resetPassword(token, password);
      setStatus("success");
    } catch (err) {
      setFormError(err.message || "Errore durante il reset della password.");
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
          <h1>Reimposta la password</h1>
          <p className="login-subtitle">Sistema Gestione ISO</p>
        </div>

        {status === "checking" && (
          <div className="login-form">
            <p>Verifica del link in corso...</p>
          </div>
        )}

        {status === "invalid" && (
          <div className="login-form">
            <div className="login-error">
              <span className="error-icon">⚠️</span>
              {checkError}
            </div>
            <button type="button" className="btn-login" onClick={() => navigate("/forgot-password")}>
              Richiedi un nuovo link
            </button>
          </div>
        )}

        {status === "ready" && (
          <form onSubmit={handleSubmit} className="login-form">
            <p>
              Imposta una nuova password{resetInfo?.email ? <> per <strong>{resetInfo.email}</strong></> : ""}.
            </p>

            {formError && (
              <div className="login-error">
                <span className="error-icon">⚠️</span>
                {formError}
              </div>
            )}

            <div className="form-group">
              <label htmlFor="reset-password">
                <span className="field-icon">🔑</span>
                Nuova password (min. 8 caratteri)
              </label>
              <div className="password-input-wrapper">
                <input
                  type={showPassword ? "text" : "password"}
                  id="reset-password"
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
              <label htmlFor="reset-confirm-password">
                <span className="field-icon">🔑</span>
                Conferma password
              </label>
              <input
                type={showPassword ? "text" : "password"}
                id="reset-confirm-password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={submitting}
              />
            </div>

            <button type="submit" className="btn-login" disabled={submitting}>
              {submitting ? "Salvataggio in corso..." : "Reimposta password"}
            </button>
          </form>
        )}

        {status === "success" && (
          <div className="login-form">
            <p>✅ Password reimpostata correttamente. Ora puoi accedere.</p>
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

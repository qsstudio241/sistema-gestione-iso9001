/**
 * Login Component - Schermata di autenticazione
 * Sistema Gestione ISO 9001 - QS Studio
 */

import React, { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import "./Login.css";

function Login() {
  const { login, error, isLoading } = useAuth();

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setLocalError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validazione base
    if (!formData.email.trim()) {
      setLocalError("Inserire email");
      return;
    }
    if (!formData.password) {
      setLocalError("Inserire password");
      return;
    }

    const success = await login(formData.email, formData.password);

    if (!success) {
      setFormData((prev) => ({ ...prev, password: "" }));
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        {/* Logo e titolo */}
        <div className="login-header">
          <div className="login-logo">
            <span className="logo-icon">🔒</span>
          </div>
          <h1>Sistema Gestione ISO</h1>
          <p className="login-subtitle">ISO 9001 / ISO 14001 / ISO 45001</p>
        </div>

        {/* Form login */}
        <form onSubmit={handleSubmit} className="login-form">
          {/* Errori */}
          {(error || localError) && (
            <div className="login-error">
              <span className="error-icon">⚠️</span>
              {error || localError}
            </div>
          )}

          {/* Email */}
          <div className="form-group">
            <label htmlFor="email">
              <span className="field-icon">📧</span>
              Email
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="Inserisci email"
              autoComplete="email"
              autoFocus
              disabled={isLoading}
            />
          </div>

          {/* Password */}
          <div className="form-group">
            <label htmlFor="password">
              <span className="field-icon">🔑</span>
              Password
            </label>
            <div className="password-input-wrapper">
              <input
                type={showPassword ? "text" : "password"}
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Inserisci password"
                autoComplete="current-password"
                disabled={isLoading}
              />
              <button
                type="button"
                className="toggle-password"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
              >
                {showPassword ? "🙈" : "👁️"}
              </button>
            </div>
          </div>

          {/* Submit */}
          <button type="submit" className="btn-login" disabled={isLoading}>
            {isLoading ? (
              <>
                <span className="spinner"></span>
                Accesso in corso...
              </>
            ) : (
              <>
                <span className="btn-icon">🚀</span>
                Accedi
              </>
            )}
          </button>
        </form>

        {/* Account di esempio: password solo da amministratore / vault (mai in repository) */}
        <div className="demo-credentials">
          <p className="demo-title">🧪 Account di prova (email)</p>
          <div className="credentials-list">
            <div className="credential-item">
              <span className="role-badge admin">Admin</span>
              <code>admin@sgq.local</code>
            </div>
            <div className="credential-item">
              <span className="role-badge auditor">Test</span>
              <code>test@sgq.local</code>
            </div>
          </div>
          <p className="demo-hint" style={{ fontSize: '0.85rem', marginTop: '0.5rem', opacity: 0.9 }}>
            La password dell’ambiente di test non è pubblicata qui: chiedila al referente o usa il vault aziendale.
          </p>
        </div>

        {/* Footer */}
        <div className="login-footer">
          <p>© {new Date().getFullYear()} QS Studio - Sistema Gestione ISO</p>
        </div>
      </div>
    </div>
  );
}

export default Login;

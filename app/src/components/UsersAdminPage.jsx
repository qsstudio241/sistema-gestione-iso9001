/**
 * Pagina Admin: Gestione utenti (CRUD soft), studio consulenza, standard consentiti.
 * Solo admin / superadmin. Creazione/promozione "admin" org: solo senza auditor_org_id (backend).
 */

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../contexts/AuthContext";
import apiService from "../services/apiService";
import "./UsersAdminPage.css";

const STANDARDS_LIST = [
  { standard_id: 1, label: "ISO 9001:2015 — Qualità" },
  { standard_id: 2, label: "ISO 14001:2015 — Ambiente" },
  { standard_id: 3, label: "ISO 45001:2018 — Salute e Sicurezza" },
  { standard_id: 6, label: "ISO 3834-2 — Audit Fornitori in Campo" },
  { standard_id: 7, label: "RDP Mason — Audit di Sistema Saldatura" },
];

function userIsActive(u) {
  if (!u) return false;
  const v = u.is_active;
  return v === true || v === 1 || v === "1" || v === "true";
}

function emptyEditForm(u) {
  return {
    full_name: u.full_name || "",
    role: u.role || "auditor",
    auditor_org_id:
      u.auditor_org_id != null && u.auditor_org_id !== ""
        ? String(u.auditor_org_id)
        : "",
    newPassword: "",
  };
}

/** Un auditor senza studio assegnato è "orfano" — configurazione incompleta */
function isOrphanAuditor(role, auditor_org_id) {
  return role === "auditor" && (auditor_org_id == null || auditor_org_id === "");
}

export default function UsersAdminPage({ onBack }) {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [auditorOrgs, setAuditorOrgs] = useState([]);
  const [auditorOrgsError, setAuditorOrgsError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [savingId, setSavingId] = useState(null);
  const [dirty, setDirty] = useState({});

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    email: "",
    password: "",
    full_name: "",
    role: "auditor",
    auditor_org_id: "",
  });
  const [createSubmitting, setCreateSubmitting] = useState(false);

  /** Form di modifica per riga (sincronizzati al reload lista) */
  const [editForms, setEditForms] = useState({});

  const isAdmin = user?.role === "admin" || user?.role === "superadmin";
  const elevatedAdmin =
    isAdmin && (user?.auditor_org_id == null || user?.auditor_org_id === "");

  const reloadUsers = useCallback(async () => {
    if (!isAdmin) return;
    setError(null);
    const res = await apiService.getAdminUsers();
    const list = res?.data && Array.isArray(res.data) ? res.data : [];
    setUsers(list);
    setEditForms((prev) => {
      const next = { ...prev };
      for (const u of list) {
        next[u.user_id] = emptyEditForm(u);
      }
      const ids = new Set(list.map((x) => x.user_id));
      Object.keys(next).forEach((k) => {
        if (!ids.has(Number(k))) delete next[k];
      });
      return next;
    });
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const usersRes = await apiService.getAdminUsers();
        if (cancelled) return;
        const list =
          usersRes?.data && Array.isArray(usersRes.data) ? usersRes.data : [];
        setUsers(list);
        const forms = {};
        for (const u of list) {
          forms[u.user_id] = emptyEditForm(u);
        }
        setEditForms(forms);
        try {
          const orgsRes = await apiService.getAuditorOrgs();
          if (cancelled) return;
          const orgs =
            orgsRes?.data && Array.isArray(orgsRes.data) ? orgsRes.data : [];
          setAuditorOrgs(orgs);
          setAuditorOrgsError(null);
        } catch (orgErr) {
          if (!cancelled) {
            setAuditorOrgs([]);
            setAuditorOrgsError(
              orgErr?.message ||
                "Impossibile caricare l'elenco studi (auditor org). Verifica API e backend."
            );
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Errore caricamento utenti");
          setUsers([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  const getEffectiveStandards = (u) => {
    if (dirty[u.user_id]) return Array.from(dirty[u.user_id]);
    return u.allowed_standard_ids ?? [];
  };

  const toggleStandard = (userId, standardId) => {
    const u = users.find((x) => x.user_id === userId);
    const current = getEffectiveStandards(u);
    const next = current.includes(standardId)
      ? current.filter((id) => id !== standardId)
      : [...current, standardId];
    setDirty((prev) => ({ ...prev, [userId]: next }));
  };

  const saveUserStandards = async (u) => {
    const effective = getEffectiveStandards(u);
    setSavingId(u.user_id);
    try {
      await apiService.updateUserStandards(u.user_id, effective);
      setUsers((prev) =>
        prev.map((x) =>
          x.user_id === u.user_id ? { ...x, allowed_standard_ids: effective } : x
        )
      );
      setDirty((prev) => {
        const next = { ...prev };
        delete next[u.user_id];
        return next;
      });
    } catch (err) {
      console.error("Salvataggio standard utente:", err);
      alert(err.message || "Errore durante il salvataggio");
    } finally {
      setSavingId(null);
    }
  };

  const updateEditField = (userId, field, value) => {
    setEditForms((prev) => ({
      ...prev,
      [userId]: { ...prev[userId], [field]: value },
    }));
  };

  const saveUserProfile = async (u) => {
    const ef = editForms[u.user_id];
    if (!ef) return;
    setSavingId(u.user_id);
    try {
      const body = {
        full_name: String(ef.full_name || "").trim(),
        auditor_org_id:
          ef.auditor_org_id === "" || ef.auditor_org_id == null
            ? null
            : parseInt(ef.auditor_org_id, 10),
      };
      if (u.role !== "superadmin") {
        body.role = ef.role;
      }
      const pw = String(ef.newPassword || "").trim();
      if (pw.length > 0) {
        if (pw.length < 8) {
          alert("La nuova password deve avere almeno 8 caratteri.");
          return;
        }
        body.password = pw;
      }
      await apiService.patchAdminUser(u.user_id, body);
      await reloadUsers();
      alert("Utente aggiornato.");
    } catch (err) {
      console.error(err);
      alert(err.message || "Errore aggiornamento utente");
    } finally {
      setSavingId(null);
    }
  };

  const reactivateUser = async (u) => {
    if (!window.confirm(`Riattivare l'account ${u.email}?`)) return;
    setSavingId(u.user_id);
    try {
      await apiService.patchAdminUser(u.user_id, { is_active: true });
      await reloadUsers();
    } catch (err) {
      alert(err.message || "Errore riattivazione");
    } finally {
      setSavingId(null);
    }
  };

  const deactivateUser = async (u) => {
    if (u.user_id === user?.user_id) {
      alert("Non puoi disattivare il tuo stesso account.");
      return;
    }
    if (!window.confirm(`Disattivare l'account ${u.email}? Non potrà più accedere.`))
      return;
    setSavingId(u.user_id);
    try {
      await apiService.deactivateAdminUser(u.user_id);
      await reloadUsers();
    } catch (err) {
      alert(err.message || "Errore disattivazione");
    } finally {
      setSavingId(null);
    }
  };

  const submitCreate = async (e) => {
    e.preventDefault();
    setCreateSubmitting(true);
    try {
      const body = {
        email: createForm.email.trim(),
        password: createForm.password,
        full_name: createForm.full_name.trim(),
        role: createForm.role,
        auditor_org_id:
          createForm.auditor_org_id === ""
            ? null
            : parseInt(createForm.auditor_org_id, 10),
      };
      if (!body.email || !body.password || !body.full_name) {
        alert("Compila email, password e nome.");
        return;
      }
      if (body.password.length < 8) {
        alert("Password: minimo 8 caratteri.");
        return;
      }
      await apiService.createAdminUser(body);
      setCreateForm({
        email: "",
        password: "",
        full_name: "",
        role: "auditor",
        auditor_org_id: "",
      });
      setShowCreate(false);
      await reloadUsers();
      alert("Utente creato.");
    } catch (err) {
      alert(err.message || "Errore creazione utente");
    } finally {
      setCreateSubmitting(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="users-admin-page">
        <div className="admin-access-denied">
          <p>Accesso riservato agli amministratori.</p>
          {onBack && (
            <button type="button" className="btn btn-secondary" onClick={onBack}>
              Indietro
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="users-admin-page">
      <div className="users-admin-header">
        <h1>Gestione utenti e standard</h1>
        <p className="users-admin-desc">
          Assegna gli standard ISO che ogni utente può usare negli audit. Nessuna
          assegnazione = tutti gli standard. Puoi creare utenti, collegarli a uno
          studio (auditor org), aggiornare ruolo e password, disattivare account.
          Gli auditor e i viewer <strong>senza studio</strong> vedono in elenco solo gli
          audit da loro creati, finché non assegni uno studio (evita vedere dati di altri
          studi). L&apos;account si disattiva, non si elimina, per tracciabilità ISO.
        </p>
        <div className="users-admin-actions">
          {onBack && (
            <button type="button" className="btn btn-secondary" onClick={onBack}>
              ← Indietro
            </button>
          )}
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setShowCreate((s) => !s)}
          >
            {showCreate ? "Chiudi form" : "+ Nuovo utente"}
          </button>
        </div>
      </div>

      {showCreate && (
        <form className="user-create-form" onSubmit={submitCreate}>
          <h2 className="user-create-title">Nuovo utente</h2>
          <div className="form-row">
            <label htmlFor="create-email">Email</label>
            <input
              id="create-email"
              type="email"
              autoComplete="off"
              value={createForm.email}
              onChange={(e) =>
                setCreateForm((f) => ({ ...f, email: e.target.value }))
              }
              required
            />
          </div>
          <div className="form-row">
            <label htmlFor="create-password">Password (min. 8)</label>
            <input
              id="create-password"
              type="password"
              autoComplete="new-password"
              value={createForm.password}
              onChange={(e) =>
                setCreateForm((f) => ({ ...f, password: e.target.value }))
              }
              required
            />
          </div>
          <div className="form-row">
            <label htmlFor="create-name">Nome e cognome</label>
            <input
              id="create-name"
              type="text"
              value={createForm.full_name}
              onChange={(e) =>
                setCreateForm((f) => ({ ...f, full_name: e.target.value }))
              }
              required
            />
          </div>
          <div className="form-row">
            <label htmlFor="create-role">Ruolo</label>
            <select
              id="create-role"
              value={createForm.role}
              onChange={(e) =>
                setCreateForm((f) => ({ ...f, role: e.target.value }))
              }
            >
              <option value="auditor">Auditor</option>
              {elevatedAdmin && <option value="admin">Admin Studio</option>}
              <option value="viewer">Viewer (sola lettura)</option>
            </select>
          </div>
          <div className="form-row">
            <label htmlFor="create-ao">
              Studio (auditor org)
              {createForm.role === "auditor" && (
                <span className="field-required"> *obbligatorio per Auditor</span>
              )}
            </label>
            <select
              id="create-ao"
              value={createForm.auditor_org_id}
              onChange={(e) =>
                setCreateForm((f) => ({ ...f, auditor_org_id: e.target.value }))
              }
            >
              <option value="">— Nessuno —</option>
              {auditorOrgs
                .filter((ao) =>
                  !user?.organization_id || ao.organization_id === user.organization_id
                )
                .map((ao) => (
                  <option key={ao.id} value={String(ao.id)}>
                    {ao.name}
                  </option>
                ))}
            </select>
            {isOrphanAuditor(createForm.role, createForm.auditor_org_id) && (
              <p className="form-hint warn">
                Un Auditor deve appartenere a uno studio: seleziona uno studio per continuare.
              </p>
            )}
          </div>
          {!elevatedAdmin && createForm.role === "admin" && (
            <p className="form-hint warn">
              Solo l&apos;amministratore principale (senza studio) può creare altri
              admin: scegli Auditor o Viewer.
            </p>
          )}
          <button
            type="submit"
            className="btn btn-primary"
            disabled={
              createSubmitting ||
              (!elevatedAdmin && createForm.role === "admin") ||
              isOrphanAuditor(createForm.role, createForm.auditor_org_id)
            }
          >
            {createSubmitting ? "Creazione..." : "Crea utente"}
          </button>
        </form>
      )}

      {loading && <p className="loading-message">Caricamento utenti...</p>}
      {error && <p className="error-message">{error}</p>}
      {!loading && auditorOrgsError && (
        <p className="error-message" role="alert">
          {auditorOrgsError}
        </p>
      )}

      {!loading && !error && users.length === 0 && (
        <p className="no-data">Nessun utente trovato.</p>
      )}

      {!loading && !error && users.length > 0 && (
        <div className="users-admin-list">
          {users.map((u) => {
            const active = userIsActive(u);
            const ef = editForms[u.user_id] || emptyEditForm(u);
            const isSelf = u.user_id === user?.user_id;
            return (
              <div
                key={u.user_id}
                className={`user-card ${active ? "" : "user-card-inactive"}`}
              >
                <div className="user-card-header">
                  <strong>{u.full_name || u.email}</strong>
                  <span className="user-email">{u.email}</span>
                  <span className={`user-role-badge role-${u.role}`}>
                    {u.role}
                  </span>
                  {!active && (
                    <span className="user-status-badge inactive">Disattivato</span>
                  )}
                  {u.auditor_org_name ? (
                    <span className="user-studio">
                      Studio: {u.auditor_org_name}
                    </span>
                  ) : (
                    u.role === "auditor" && (
                      <span className="user-status-badge orphan-auditor" title="Auditor senza studio: configurazione incompleta">
                        ⚠ Studio mancante
                      </span>
                    )
                  )}
                </div>

                <div className="user-profile-section">
                  <span className="standards-label">Dati e accesso</span>
                  <div className="form-row compact">
                    <label>Nome visualizzato</label>
                    <input
                      type="text"
                      value={ef.full_name}
                      onChange={(e) =>
                        updateEditField(u.user_id, "full_name", e.target.value)
                      }
                      disabled={!active || savingId === u.user_id}
                    />
                  </div>
                  <div className="form-row compact">
                    <label>Ruolo</label>
                    <select
                      value={ef.role}
                      onChange={(e) =>
                        updateEditField(u.user_id, "role", e.target.value)
                      }
                      disabled={
                        !active ||
                        savingId === u.user_id ||
                        u.role === "superadmin"
                      }
                    >
                      {u.role === "superadmin" ? (
                        <option value="superadmin">Superadmin</option>
                      ) : (
                        <>
                          <option value="auditor">Auditor</option>
                          {(elevatedAdmin ||
                            u.role === "admin" ||
                            u.role === "superadmin") && (
                            <option value="admin">Admin Studio</option>
                          )}
                          <option value="viewer">Viewer</option>
                        </>
                      )}
                    </select>
                  </div>
                  {u.role === "superadmin" && (
                    <p className="form-hint">
                      Il ruolo Superadmin non si modifica da questa schermata.
                    </p>
                  )}
                  <div className="form-row compact">
                    <label>
                      Studio
                      {ef.role === "auditor" && (
                        <span className="field-required"> *obbligatorio</span>
                      )}
                    </label>
                    <select
                      value={ef.auditor_org_id}
                      onChange={(e) =>
                        updateEditField(u.user_id, "auditor_org_id", e.target.value)
                      }
                      disabled={!active || savingId === u.user_id}
                    >
                      <option value="">— Nessuno —</option>
                      {auditorOrgs
                        .filter((ao) =>
                          !u.organization_id || ao.organization_id === u.organization_id
                        )
                        .map((ao) => (
                          <option key={ao.id} value={String(ao.id)}>
                            {ao.name}
                          </option>
                        ))}
                    </select>
                    {isOrphanAuditor(ef.role, ef.auditor_org_id) && (
                      <p className="form-hint warn">
                        Un Auditor deve appartenere a uno studio: assegna uno studio prima di salvare.
                      </p>
                    )}
                  </div>
                  <div className="form-row compact">
                    <label>Nuova password (opzionale)</label>
                    <input
                      type="password"
                      autoComplete="new-password"
                      placeholder="Lascia vuoto per non cambiare"
                      value={ef.newPassword}
                      onChange={(e) =>
                        updateEditField(u.user_id, "newPassword", e.target.value)
                      }
                      disabled={!active || savingId === u.user_id}
                    />
                  </div>
                  <div className="user-profile-actions">
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      disabled={
                        !active ||
                        savingId === u.user_id ||
                        isOrphanAuditor(ef.role, ef.auditor_org_id)
                      }
                      onClick={() => saveUserProfile(u)}
                    >
                      {savingId === u.user_id ? "Salvataggio..." : "Salva dati utente"}
                    </button>
                    {active && !isSelf && (
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        disabled={savingId === u.user_id}
                        onClick={() => deactivateUser(u)}
                      >
                        Disattiva account
                      </button>
                    )}
                    {!active && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        disabled={savingId === u.user_id}
                        onClick={() => reactivateUser(u)}
                      >
                        Riattiva account
                      </button>
                    )}
                  </div>
                  {isSelf && (
                    <p className="form-hint">
                      Stai modificando il tuo account: non puoi disattivarlo da qui.
                    </p>
                  )}
                </div>

                <details className="user-standards-details">
                  <summary className="standards-summary">
                    Standard consentiti (clic per aprire o chiudere)
                  </summary>
                  <div className="user-standards-section-inner">
                    <div className="standards-checkboxes">
                      {STANDARDS_LIST.map((std) => {
                        const effective = getEffectiveStandards(u);
                        const checked = effective.includes(std.standard_id);
                        return (
                          <label key={std.standard_id} className="checkbox-label">
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={!active}
                              onChange={() => toggleStandard(u.user_id, std.standard_id)}
                            />
                            <span>{std.label}</span>
                          </label>
                        );
                      })}
                    </div>
                    {dirty[u.user_id] && (
                      <button
                        type="button"
                        className="btn btn-primary btn-save-standards"
                        disabled={savingId === u.user_id || !active}
                        onClick={() => saveUserStandards(u)}
                      >
                        {savingId === u.user_id ? "Salvataggio..." : "Salva standard"}
                      </button>
                    )}
                  </div>
                </details>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Pagina Admin: Gestione utenti (CRUD soft), studio consulenza, standard consentiti.
 * Solo admin / superadmin. Il ruolo "admin" NON si può creare né promuovere da questa
 * pagina (form Nuovo utente / Modifica utente): solo dalla sezione "Licenze moduli per
 * studio" più sotto (pulsante "+ Invita admin") — singola fonte di verità, applicata
 * anche lato backend in admin.controller.js (createUser/updateUser rifiutano role=admin).
 */

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../contexts/AuthContext";
import apiService from "../services/apiService";
import StatusBadge from "./StatusBadge";
import "./UsersAdminPage.css";

const STANDARDS_LIST = [
  { standard_id: 1, label: "ISO 9001:2015 - Qualità" },
  { standard_id: 2, label: "ISO 14001:2015 - Ambiente" },
  { standard_id: 3, label: "ISO 45001:2018 - Salute e Sicurezza" },
  { standard_id: 6, label: "ISO 3834-2 - Audit Fornitori in Campo" },
  { standard_id: 7, label: "RDP Mason - Audit di Sistema Saldatura" },
];

/** Stesso raggruppamento già usato nel menu laterale (AppLayout.jsx: gruppi
 * SGQ/Saldatura/CND/Gestione) — qui unificato in 4 famiglie per la matrice
 * licenze: "un solo modo di raggruppare i moduli in tutta l'app". */
const MODULE_GROUPS = [
  {
    label: "Qualità (ISO 9001)",
    keys: [
      { key: "documents",  label: "Registro documenti" },
      { key: "qualifiche", label: "Qualifiche personale" },
      { key: "nc",         label: "Non conformità" },
      { key: "rischi",     label: "Rischi, opportunità e obiettivi" },
      { key: "reclami",    label: "Reclami e fornitori" },
      { key: "sal",        label: "SAL" },
    ],
  },
  {
    label: "Saldatura (ISO 3834)",
    keys: [
      { key: "saldatura", label: "Saldatura ISO 3834" },
      { key: "cnd",       label: "CND - Controlli Non Distruttivi" },
    ],
  },
  {
    label: "Intelligenza Artificiale",
    keys: [
      { key: "ai_import", label: "AI Import PDF" },
      { key: "ai_assist", label: "AI Suggerimenti (audit)" },
      { key: "ai_review", label: "AI Riesame Requisiti" },
      { key: "ai_norms",  label: "AI Norme on-demand" },
      { key: "ai_chat",   label: "AI Chat Assistente" },
    ],
  },
  {
    label: "Trasversali",
    keys: [
      { key: "audit",         label: "Audit" },
      { key: "notifications", label: "Notifiche" },
    ],
  },
];

const ALL_MODULE_KEYS = MODULE_GROUPS.flatMap((g) => g.keys);

/** Legge licensed_modules da una riga auditorOrg (può essere null = tutti) */
function parseOrgModules(rawJson) {
  if (!rawJson) return null; // null = tutti i moduli (default)
  try {
    const arr = typeof rawJson === "string" ? JSON.parse(rawJson) : rawJson;
    return Array.isArray(arr) ? arr : null;
  } catch {
    return null;
  }
}

function userIsActive(u) {
  if (!u) return false;
  const v = u.is_active;
  return v === true || v === 1 || v === "1" || v === "true";
}

/** Utente creato via invito email, non ha ancora impostato la propria password (UAL-3). */
function userIsPending(u) {
  if (!u) return false;
  const v = u.pending_activation;
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

/** Un auditor senza studio assegnato è "orfano" - configurazione incompleta */
function isOrphanAuditor(role, auditor_org_id) {
  return role === "auditor" && (auditor_org_id == null || auditor_org_id === "");
}

const ACCESS_PERMISSION_LABELS = {
  read: "Lettura",
  write: "Lettura/Scrittura",
};

const AUDIT_ACTION_LABELS = {
  user_created: "Utente creato",
  role_changed: "Ruolo modificato",
  profile_updated: "Dati profilo modificati",
  auditor_org_changed: "Studio modificato",
  password_reset_by_admin: "Password reimpostata dall'amministratore",
  activated: "Account riattivato",
  deactivated: "Account disattivato",
  standards_updated: "Standard consentiti aggiornati",
  company_access_granted: "Accesso azienda concesso",
  company_access_updated: "Accesso azienda modificato",
  company_access_revoked: "Accesso azienda revocato",
  invite_sent: "Invito inviato via email",
  invite_accepted: "Invito accettato (password impostata)",
  invite_resent: "Invito reinviato",
};

/** Descrizione leggibile di una riga di storico modifiche (best-effort, tollerante a valori mancanti) */
function describeAuditLogEntry(entry) {
  const label = AUDIT_ACTION_LABELS[entry.action_type] || entry.action_type;
  if (entry.field_changed === "company_access") {
    try {
      const parsed = JSON.parse(entry.new_value || entry.old_value || "{}");
      if (parsed?.permission) {
        return `${label} (${ACCESS_PERMISSION_LABELS[parsed.permission] || parsed.permission})`;
      }
    } catch {
      // valore non parsabile: mostra solo l'etichetta
    }
    return label;
  }
  if (entry.field_changed === "role" && entry.new_value) {
    return `${label}: ${entry.old_value || "-"} \u2192 ${entry.new_value}`;
  }
  if (entry.field_changed === "full_name" && entry.new_value) {
    return `${label}: "${entry.new_value}"`;
  }
  return label;
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
  // Modalità creazione: "password" (comportamento attuale, default) oppure
  // "invite" (nuovo, UAL-3 — l'utente riceve un'email e imposta lui la password).
  const [createMode, setCreateMode] = useState("password");
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [resendingInviteId, setResendingInviteId] = useState(null);

  /** Form di modifica per riga (sincronizzati al reload lista) */
  const [editForms, setEditForms] = useState({});

  const isAdmin = user?.role === "admin" || user?.role === "superadmin";
  const isSuperadmin = user?.role === "superadmin";

  // Stato licenze moduli per org (superadmin only) - dirty map: orgId → string[]|null
  const [orgLicensesDirty, setOrgLicensesDirty] = useState({});
  const [savingOrgLicense, setSavingOrgLicense] = useState(null);
  const [orgLicenseMsg, setOrgLicenseMsg] = useState({});

  // Creazione nuovo studio (provisioning tenant, solo superadmin)
  const [showNewStudioForm, setShowNewStudioForm] = useState(false);
  const [newStudioForm, setNewStudioForm] = useState({
    organization_name: "",
    studio_name: "",
    studio_email: "",
  });
  const [newStudioSubmitting, setNewStudioSubmitting] = useState(false);
  const [newStudioError, setNewStudioError] = useState(null);
  const [newStudioMsg, setNewStudioMsg] = useState(null);

  // Invito primo admin di uno studio (per id auditor_org — colma il gap: createUser
  // non può mai assegnare un utente a un nuovo studio, organization_id diverso per
  // costruzione dall'attore superadmin — vedi DEPUTYTASK1 S3)
  const [showInviteAdminForm, setShowInviteAdminForm] = useState({});
  const [inviteAdminForm, setInviteAdminForm] = useState({});
  const [inviteAdminSubmitting, setInviteAdminSubmitting] = useState(null);
  const [inviteAdminMsg, setInviteAdminMsg] = useState({});

  // Accesso aziende clienti per utente (user_company_access) - caricato on-demand
  const [companyAccessByUser, setCompanyAccessByUser] = useState({});
  const [companiesByOrg, setCompaniesByOrg] = useState({});
  const [newAccessForm, setNewAccessForm] = useState({});
  const [savingAccessId, setSavingAccessId] = useState(null);

  // Storico modifiche (audit trail) per utente - caricato on-demand
  const [auditLogByUser, setAuditLogByUser] = useState({});

  /** Ritorna i moduli effettivi per una org (dirty o da auditorOrg.licensed_modules) */
  const getEffectiveOrgModules = (ao) => {
    if (orgLicensesDirty[ao.organization_id] !== undefined)
      return orgLicensesDirty[ao.organization_id];
    return parseOrgModules(ao.licensed_modules);
  };

  const toggleOrgModule = (organizationId, key) => {
    const ao = auditorOrgs.find((x) => x.organization_id === organizationId);
    const current = getEffectiveOrgModules(ao);
    // null = tutti → espandi a lista completa prima di modificare
    const base = current ?? ALL_MODULE_KEYS.map((m) => m.key);
    const next =
      key === "audit"
        ? base // audit non si toglie
        : base.includes(key)
          ? base.filter((k) => k !== key)
          : [...base, key];
    setOrgLicensesDirty((prev) => ({ ...prev, [organizationId]: next }));
  };

  const saveOrgLicenses = async (ao) => {
    setSavingOrgLicense(ao.organization_id);
    setOrgLicenseMsg((prev) => ({ ...prev, [ao.organization_id]: null }));
    try {
      const modules = getEffectiveOrgModules(ao);
      await apiService.patchOrgLicenses(ao.organization_id, { modules: modules ?? [] });
      // Aggiorna il dato locale nell'auditorOrgs list
      setAuditorOrgs((prev) =>
        prev.map((x) =>
          x.organization_id === ao.organization_id
            ? { ...x, licensed_modules: JSON.stringify(modules) }
            : x
        )
      );
      setOrgLicensesDirty((prev) => {
        const next = { ...prev };
        delete next[ao.organization_id];
        return next;
      });
      setOrgLicenseMsg((prev) => ({ ...prev, [ao.organization_id]: "✅ Licenze salvate." }));
      setTimeout(() => setOrgLicenseMsg((prev) => ({ ...prev, [ao.organization_id]: null })), 3000);
    } catch (err) {
      setOrgLicenseMsg((prev) => ({ ...prev, [ao.organization_id]: `❌ ${err.message || "Errore"}` }));
    } finally {
      setSavingOrgLicense(null);
    }
  };

  /** Risolve l'auditor_org_id da usare per elencare le aziende disponibili per l'utente target */
  const resolveOrgIdForCompanyList = (u) => {
    if (u.auditor_org_id != null && u.auditor_org_id !== "") return u.auditor_org_id;
    const match = auditorOrgs.find((ao) => ao.organization_id === u.organization_id);
    return match ? match.id : null;
  };

  const loadCompaniesForOrg = useCallback(async (orgId) => {
    if (orgId == null) return;
    setCompaniesByOrg((prev) => {
      if (prev[orgId]) return prev; // già caricato o in caricamento
      return { ...prev, [orgId]: { loading: true, error: null, list: [] } };
    });
    try {
      const res = await apiService.getCompanies({ auditor_org_id: orgId, limit: 500 });
      const list = res?.data && Array.isArray(res.data) ? res.data : [];
      setCompaniesByOrg((prev) => ({ ...prev, [orgId]: { loading: false, error: null, list } }));
    } catch (err) {
      setCompaniesByOrg((prev) => ({
        ...prev,
        [orgId]: { loading: false, error: err.message || "Errore caricamento aziende", list: [] },
      }));
    }
  }, []);

  const loadCompanyAccessForUser = useCallback(async (userId) => {
    setCompanyAccessByUser((prev) => ({
      ...prev,
      [userId]: { ...(prev[userId] || {}), loading: true, error: null },
    }));
    try {
      const res = await apiService.getUserCompanyAccess(userId);
      const list = res?.data && Array.isArray(res.data) ? res.data : [];
      setCompanyAccessByUser((prev) => ({ ...prev, [userId]: { loading: false, error: null, list } }));
    } catch (err) {
      setCompanyAccessByUser((prev) => ({
        ...prev,
        [userId]: { loading: false, error: err.message || "Errore caricamento accessi azienda", list: [] },
      }));
    }
  }, []);

  const onToggleCompanyAccessDetails = (u) => (e) => {
    if (!e.target.open) return;
    if (!companyAccessByUser[u.user_id]) {
      loadCompanyAccessForUser(u.user_id);
    }
    const orgId = resolveOrgIdForCompanyList(u);
    if (orgId != null && !companiesByOrg[orgId]) {
      loadCompaniesForOrg(orgId);
    }
  };

  const updateNewAccessField = (userId, field, value) => {
    setNewAccessForm((prev) => ({
      ...prev,
      [userId]: { company_id: "", permission: "read", ...(prev[userId] || {}), [field]: value },
    }));
  };

  const addCompanyAccess = async (u) => {
    const form = newAccessForm[u.user_id] || { company_id: "", permission: "read" };
    const companyId = parseInt(form.company_id, 10);
    if (!Number.isFinite(companyId)) {
      alert("Seleziona un'azienda.");
      return;
    }
    setSavingAccessId(u.user_id);
    try {
      await apiService.addUserCompanyAccess(u.user_id, {
        company_id: companyId,
        permission: form.permission === "write" ? "write" : "read",
      });
      setNewAccessForm((prev) => ({ ...prev, [u.user_id]: { company_id: "", permission: "read" } }));
      await loadCompanyAccessForUser(u.user_id);
    } catch (err) {
      alert(err.message || "Errore assegnazione accesso azienda");
    } finally {
      setSavingAccessId(null);
    }
  };

  const loadAuditLogForUser = useCallback(async (userId) => {
    setAuditLogByUser((prev) => ({
      ...prev,
      [userId]: { ...(prev[userId] || {}), loading: true, error: null },
    }));
    try {
      const res = await apiService.getUserAuditLog(userId);
      const list = res?.data && Array.isArray(res.data) ? res.data : [];
      setAuditLogByUser((prev) => ({ ...prev, [userId]: { loading: false, error: null, list } }));
    } catch (err) {
      setAuditLogByUser((prev) => ({
        ...prev,
        [userId]: { loading: false, error: err.message || "Errore caricamento storico modifiche", list: [] },
      }));
    }
  }, []);

  const onToggleAuditLogDetails = (u) => (e) => {
    if (!e.target.open) return;
    if (!auditLogByUser[u.user_id]) {
      loadAuditLogForUser(u.user_id);
    }
  };

  const removeCompanyAccess = async (u, companyId, companyName) => {
    if (!window.confirm(`Revocare l'accesso di ${u.full_name || u.email} a "${companyName}"?`)) return;
    setSavingAccessId(u.user_id);
    try {
      await apiService.removeUserCompanyAccess(u.user_id, companyId);
      await loadCompanyAccessForUser(u.user_id);
    } catch (err) {
      alert(err.message || "Errore rimozione accesso azienda");
    } finally {
      setSavingAccessId(null);
    }
  };

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
    const isInvite = createMode === "invite";
    setCreateSubmitting(true);
    try {
      const body = {
        email: createForm.email.trim(),
        full_name: createForm.full_name.trim(),
        role: createForm.role,
        auditor_org_id:
          createForm.auditor_org_id === ""
            ? null
            : parseInt(createForm.auditor_org_id, 10),
      };
      if (isInvite) {
        body.send_invite = true;
        if (!body.email || !body.full_name) {
          alert("Compila email e nome.");
          return;
        }
      } else {
        body.password = createForm.password;
        if (!body.email || !body.password || !body.full_name) {
          alert("Compila email, password e nome.");
          return;
        }
        if (body.password.length < 8) {
          alert("Password: minimo 8 caratteri.");
          return;
        }
      }
      await apiService.createAdminUser(body);
      setCreateForm({
        email: "",
        password: "",
        full_name: "",
        role: "auditor",
        auditor_org_id: "",
      });
      setCreateMode("password");
      setShowCreate(false);
      await reloadUsers();
      alert(isInvite ? "Utente creato. Invito inviato via email." : "Utente creato.");
    } catch (err) {
      alert(err.message || "Errore creazione utente");
    } finally {
      setCreateSubmitting(false);
    }
  };

  const submitNewStudio = async (e) => {
    e.preventDefault();
    const organizationName = newStudioForm.organization_name.trim();
    const studioName = newStudioForm.studio_name.trim();
    const studioEmail = newStudioForm.studio_email.trim();
    setNewStudioError(null);

    if (!organizationName || !studioName || !studioEmail) {
      setNewStudioError("Compila nome cliente, nome studio ed email referente.");
      return;
    }

    setNewStudioSubmitting(true);
    try {
      const res = await apiService.createAuditorOrg({
        organization_name: organizationName,
        studio_name: studioName,
        studio_email: studioEmail,
      });
      const created = res?.data;
      if (created) {
        setAuditorOrgs((prev) => [...prev, created]);
      }
      setNewStudioForm({
        organization_name: "",
        studio_name: "",
        studio_email: "",
      });
      setShowNewStudioForm(false);
      setNewStudioMsg("✅ Studio creato.");
      setTimeout(() => setNewStudioMsg(null), 8000);
    } catch (err) {
      setNewStudioError(err.message || "Errore creazione studio");
    } finally {
      setNewStudioSubmitting(false);
    }
  };

  const submitInviteAdmin = async (ao) => {
    const form = inviteAdminForm[ao.id] || {};
    const fullName = (form.full_name || "").trim();
    setInviteAdminMsg((prev) => ({ ...prev, [ao.id]: null }));

    if (!fullName) {
      setInviteAdminMsg((prev) => ({ ...prev, [ao.id]: "❌ Nome e cognome obbligatorio." }));
      return;
    }

    setInviteAdminSubmitting(ao.id);
    try {
      await apiService.inviteStudioAdmin(ao.id, {
        full_name: fullName,
        email: (form.email || "").trim() || undefined,
      });
      setInviteAdminForm((prev) => ({ ...prev, [ao.id]: { full_name: "", email: "" } }));
      setShowInviteAdminForm((prev) => ({ ...prev, [ao.id]: false }));
      // Il nuovo admin è cross-tenant (organizzazione del nuovo studio, non quella
      // dell'attore): superadmin vede tutti gli utenti di tutte le org, quindi
      // ricaricare la lista lo mostra subito (pending) senza refresh manuale.
      await reloadUsers();
      setInviteAdminMsg((prev) => ({ ...prev, [ao.id]: "✅ Invito inviato." }));
      setTimeout(() => setInviteAdminMsg((prev) => ({ ...prev, [ao.id]: null })), 8000);
    } catch (err) {
      setInviteAdminMsg((prev) => ({ ...prev, [ao.id]: `❌ ${err.message || "Errore invio invito"}` }));
    } finally {
      setInviteAdminSubmitting(null);
    }
  };

  const resendInvite = async (u) => {
    setResendingInviteId(u.user_id);
    try {
      await apiService.resendUserInvite(u.user_id);
      alert(`Invito reinviato a ${u.email}.`);
    } catch (err) {
      alert(err.message || "Errore reinvio invito");
    } finally {
      setResendingInviteId(null);
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

      {isSuperadmin && (
        <div className="platform-scope-banner" role="status">
          Vista piattaforma — tutte le organizzazioni
        </div>
      )}

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
            <label>Come impostare la password</label>
            <div className="create-mode-choice">
              <label className="radio-label">
                <input
                  type="radio"
                  name="create-mode"
                  value="password"
                  checked={createMode === "password"}
                  onChange={() => setCreateMode("password")}
                />
                <span>Imposta password ora</span>
              </label>
              <label className="radio-label">
                <input
                  type="radio"
                  name="create-mode"
                  value="invite"
                  checked={createMode === "invite"}
                  onChange={() => setCreateMode("invite")}
                />
                <span>Invia invito via email</span>
              </label>
            </div>
            {createMode === "invite" && (
              <p className="form-hint">
                L&apos;utente riceverà un&apos;email con un link per impostare da solo la
                propria password (valido 72 ore).
              </p>
            )}
          </div>
          {createMode === "password" && (
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
          )}
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
              <option value="viewer">Viewer (sola lettura)</option>
            </select>
            <p className="form-hint">
              Il ruolo Admin si assegna solo dalla sezione &quot;Licenze moduli per
              studio&quot; qui sotto (pulsante &quot;+ Invita admin&quot; su ogni studio) —
              non da qui.
            </p>
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
              <option value="">- Nessuno -</option>
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
          <button
            type="submit"
            className="btn btn-primary"
            disabled={
              createSubmitting ||
              isOrphanAuditor(createForm.role, createForm.auditor_org_id)
            }
          >
            {createSubmitting
              ? "Creazione..."
              : createMode === "invite"
                ? "Crea utente e invia invito"
                : "Crea utente"}
          </button>
        </form>
      )}

      {/* ── Licenze moduli per studio (solo superadmin) ─────────────────── */}
      {isSuperadmin && !loading && (
        <section className="org-licenses-section">
          <div className="org-licenses-header">
            <h2 className="org-licenses-title">Licenze moduli per studio</h2>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => {
                setShowNewStudioForm((s) => !s);
                setNewStudioError(null);
              }}
            >
              {showNewStudioForm ? "Chiudi form" : "+ Nuovo studio"}
            </button>
          </div>
          <p className="org-licenses-desc">
            Assegna i moduli funzionali attivi per ogni studio cliente. Il modulo <strong>Audit</strong> è sempre abilitato.
            Nessuna selezione esplicita = tutti i moduli attivi (impostazione predefinita).
            La licenza <strong>Saldatura ISO 3834</strong> include sempre l&apos;accesso a <strong>CND</strong>, anche se non spuntata separatamente.
          </p>

          {showNewStudioForm && (
            <form className="user-create-form new-studio-form" onSubmit={submitNewStudio}>
              <h3 className="user-create-title">Nuovo studio</h3>
              <div className="form-row">
                <label htmlFor="new-studio-org-name">Nome cliente/organizzazione</label>
                <input
                  id="new-studio-org-name"
                  type="text"
                  value={newStudioForm.organization_name}
                  onChange={(e) =>
                    setNewStudioForm((f) => ({ ...f, organization_name: e.target.value }))
                  }
                />
              </div>
              <div className="form-row">
                <label htmlFor="new-studio-name">Nome studio</label>
                <input
                  id="new-studio-name"
                  type="text"
                  value={newStudioForm.studio_name}
                  onChange={(e) =>
                    setNewStudioForm((f) => ({ ...f, studio_name: e.target.value }))
                  }
                />
              </div>
              <div className="form-row">
                <label htmlFor="new-studio-email">Email referente</label>
                <input
                  id="new-studio-email"
                  type="email"
                  value={newStudioForm.studio_email}
                  onChange={(e) =>
                    setNewStudioForm((f) => ({ ...f, studio_email: e.target.value }))
                  }
                />
                <p className="form-hint">
                  Il nuovo studio nasce con tutti i moduli abilitati (badge &quot;Tutti i
                  moduli&quot;); potrai personalizzare le licenze subito dopo, qui sotto.
                </p>
              </div>
              {newStudioError && (
                <p className="form-hint warn" role="alert">
                  {newStudioError}
                </p>
              )}
              <button type="submit" className="btn btn-primary" disabled={newStudioSubmitting}>
                {newStudioSubmitting ? "Creazione..." : "Crea studio"}
              </button>
            </form>
          )}
          {newStudioMsg && <p className="org-license-msg new-studio-success">{newStudioMsg}</p>}

          {auditorOrgs.length === 0 && (
            <p className="form-hint">Nessuno studio presente. Usa &quot;+ Nuovo studio&quot; per crearne uno.</p>
          )}

          {auditorOrgs.map((ao) => {
            const effectiveMods = getEffectiveOrgModules(ao);
            const isDirty = orgLicensesDirty[ao.organization_id] !== undefined;
            const useDefault = effectiveMods === null;
            // Elenco esplicito che contiene comunque tutti i moduli attuali: stesso accesso
            // effettivo di "default", ma salvato come array (non NULL) — mostra lo stesso badge
            // per non far apparire diversi due studi con licenze identiche (DEPUTYTASK2 S1).
            const isFullExplicit =
              !useDefault &&
              effectiveMods.length === ALL_MODULE_KEYS.length &&
              ALL_MODULE_KEYS.every(({ key }) => effectiveMods.includes(key));
            const msg = orgLicenseMsg[ao.organization_id];
            return (
              <details key={ao.organization_id} className="org-license-details">
                <summary className="org-license-summary">
                  <span className="org-license-name">{ao.name}</span>
                  <span className="org-license-orgname">{ao.organization_name}</span>
                  {(useDefault || isFullExplicit) && !isDirty && (
                    <span className="org-license-badge default">Tutti i moduli</span>
                  )}
                  {isDirty && <span className="org-license-badge dirty">● Modifiche non salvate</span>}
                </summary>
                <div className="org-license-body">
                  <div className="module-groups">
                    {MODULE_GROUPS.map((group) => (
                      <div key={group.label} className="module-group">
                        <h4 className="module-group-title">{group.label}</h4>
                        <div className="module-group-checkboxes">
                          {group.keys.map(({ key, label }) => {
                            const checked = useDefault && !isDirty ? true : (effectiveMods ?? []).includes(key);
                            return (
                              <label key={key} className="checkbox-label">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  disabled={key === "audit" || savingOrgLicense === ao.organization_id}
                                  onChange={() => toggleOrgModule(ao.organization_id, key)}
                                />
                                <span>{label}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="org-license-actions">
                    {isDirty && (
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        disabled={savingOrgLicense === ao.organization_id}
                        onClick={() => saveOrgLicenses(ao)}
                      >
                        {savingOrgLicense === ao.organization_id ? "Salvataggio…" : "Salva licenze"}
                      </button>
                    )}
                    {isDirty && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        disabled={savingOrgLicense === ao.organization_id}
                        onClick={() =>
                          setOrgLicensesDirty((prev) => {
                            const next = { ...prev };
                            delete next[ao.organization_id];
                            return next;
                          })
                        }
                      >
                        Annulla
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() =>
                        setShowInviteAdminForm((prev) => ({ ...prev, [ao.id]: !prev[ao.id] }))
                      }
                    >
                      {showInviteAdminForm[ao.id] ? "Chiudi" : "+ Invita admin"}
                    </button>
                    {msg && <span className="org-license-msg">{msg}</span>}
                  </div>

                  {showInviteAdminForm[ao.id] && (
                    <div className="user-create-form invite-admin-form">
                      <p className="form-hint">
                        Invia un invito via email (nessuna password provvisoria): il destinatario
                        imposta la propria password dal link ricevuto.
                      </p>
                      <div className="form-row">
                        <label htmlFor={`invite-admin-name-${ao.id}`}>Nome e cognome</label>
                        <input
                          id={`invite-admin-name-${ao.id}`}
                          type="text"
                          value={inviteAdminForm[ao.id]?.full_name || ""}
                          onChange={(e) =>
                            setInviteAdminForm((prev) => ({
                              ...prev,
                              [ao.id]: { ...prev[ao.id], full_name: e.target.value },
                            }))
                          }
                        />
                      </div>
                      <div className="form-row">
                        <label htmlFor={`invite-admin-email-${ao.id}`}>
                          Email (vuoto = usa &quot;{ao.email}&quot;)
                        </label>
                        <input
                          id={`invite-admin-email-${ao.id}`}
                          type="email"
                          placeholder={ao.email || ""}
                          value={inviteAdminForm[ao.id]?.email || ""}
                          onChange={(e) =>
                            setInviteAdminForm((prev) => ({
                              ...prev,
                              [ao.id]: { ...prev[ao.id], email: e.target.value },
                            }))
                          }
                        />
                      </div>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        disabled={inviteAdminSubmitting === ao.id}
                        onClick={() => submitInviteAdmin(ao)}
                      >
                        {inviteAdminSubmitting === ao.id ? "Invio…" : "Invia invito"}
                      </button>
                    </div>
                  )}
                  {inviteAdminMsg[ao.id] && (
                    <p className="org-license-msg">{inviteAdminMsg[ao.id]}</p>
                  )}
                </div>
              </details>
            );
          })}
        </section>
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
                  {isSuperadmin && u.organization_name && (
                    <span className="user-org-badge" title="Organizzazione (tenant) di appartenenza">
                      {u.organization_name}
                    </span>
                  )}
                  {!active && (
                    <StatusBadge type="user" status="inactive" size="small" />
                  )}
                  {active && userIsPending(u) && (
                    <StatusBadge type="user" status="pending" size="small" />
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
                          {/* "Admin Studio" selezionabile per chi lo è già (demozione da
                              qui) o dal superadmin (unico modo di RI-promuovere un utente
                              demozionato in precedenza — "Licenze moduli per studio" →
                              "+ Invita admin" crea sempre un utente nuovo, non promuove un
                              esistente). Un admin regolare non può promuovere nessuno da qui. */}
                          {(u.role === "admin" || u.role === "superadmin" || isSuperadmin) && (
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
                      <option value="">- Nessuno -</option>
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
                    {active && userIsPending(u) && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        disabled={resendingInviteId === u.user_id}
                        onClick={() => resendInvite(u)}
                      >
                        {resendingInviteId === u.user_id ? "Invio..." : "Reinvia invito"}
                      </button>
                    )}
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

                <details
                  className="user-company-access-details"
                  onToggle={onToggleCompanyAccessDetails(u)}
                >
                  <summary className="standards-summary">
                    Accesso aziende clienti (clic per aprire o chiudere)
                  </summary>
                  <div className="user-standards-section-inner">
                    {(() => {
                      const accessState = companyAccessByUser[u.user_id];
                      const orgId = resolveOrgIdForCompanyList(u);
                      const companiesState = orgId != null ? companiesByOrg[orgId] : null;
                      const form = newAccessForm[u.user_id] || { company_id: "", permission: "read" };
                      const assignedIds = new Set((accessState?.list || []).map((a) => a.company_id));
                      const availableCompanies = (companiesState?.list || []).filter(
                        (c) => !assignedIds.has(c.id)
                      );

                      return (
                        <>
                          {accessState?.loading && (
                            <p className="loading-message">Caricamento accessi...</p>
                          )}
                          {accessState?.error && (
                            <p className="error-message">{accessState.error}</p>
                          )}
                          {!accessState?.loading && (accessState?.list?.length ?? 0) === 0 && !accessState?.error && (
                            <p className="no-data">
                              Nessuna azienda cliente assegnata a questo utente.
                            </p>
                          )}
                          {(accessState?.list?.length ?? 0) > 0 && (
                            <ul className="company-access-list">
                              {accessState.list.map((a) => (
                                <li key={a.company_id} className="company-access-item">
                                  <span className="company-access-name">{a.company_name}</span>
                                  <span
                                    className={`company-access-badge ${a.permission === "write" ? "write" : "read"}`}
                                  >
                                    {ACCESS_PERMISSION_LABELS[a.permission] || a.permission}
                                  </span>
                                  {active && (
                                    <button
                                      type="button"
                                      className="btn btn-danger btn-sm"
                                      disabled={savingAccessId === u.user_id}
                                      onClick={() => removeCompanyAccess(u, a.company_id, a.company_name)}
                                    >
                                      Rimuovi
                                    </button>
                                  )}
                                </li>
                              ))}
                            </ul>
                          )}

                          {active && (
                            <div className="company-access-add-row">
                              {orgId == null && (
                                <p className="form-hint warn">
                                  Assegna prima uno studio a questo utente per poter
                                  concedere accessi ad aziende clienti.
                                </p>
                              )}
                              {orgId != null && companiesState?.error && (
                                <p className="error-message">{companiesState.error}</p>
                              )}
                              {orgId != null && !companiesState?.error && (
                                <>
                                  <select
                                    value={form.company_id}
                                    onChange={(e) =>
                                      updateNewAccessField(u.user_id, "company_id", e.target.value)
                                    }
                                    disabled={savingAccessId === u.user_id || companiesState?.loading}
                                  >
                                    <option value="">
                                      {companiesState?.loading
                                        ? "Caricamento aziende..."
                                        : "- Seleziona azienda -"}
                                    </option>
                                    {availableCompanies.map((c) => (
                                      <option key={c.id} value={String(c.id)}>
                                        {c.name}
                                      </option>
                                    ))}
                                  </select>
                                  <select
                                    value={form.permission}
                                    onChange={(e) =>
                                      updateNewAccessField(u.user_id, "permission", e.target.value)
                                    }
                                    disabled={savingAccessId === u.user_id}
                                  >
                                    <option value="read">Lettura</option>
                                    <option value="write">Lettura/Scrittura</option>
                                  </select>
                                  <button
                                    type="button"
                                    className="btn btn-primary btn-sm"
                                    disabled={savingAccessId === u.user_id || !form.company_id}
                                    onClick={() => addCompanyAccess(u)}
                                  >
                                    {savingAccessId === u.user_id ? "Salvataggio..." : "Aggiungi"}
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </details>

                <details
                  className="user-audit-log-details"
                  onToggle={onToggleAuditLogDetails(u)}
                >
                  <summary className="standards-summary">
                    Storico modifiche (clic per aprire o chiudere)
                  </summary>
                  <div className="user-standards-section-inner">
                    {(() => {
                      const logState = auditLogByUser[u.user_id];
                      return (
                        <>
                          {logState?.loading && (
                            <p className="loading-message">Caricamento storico...</p>
                          )}
                          {logState?.error && (
                            <p className="error-message">{logState.error}</p>
                          )}
                          {!logState?.loading && (logState?.list?.length ?? 0) === 0 && !logState?.error && (
                            <p className="no-data">
                              Nessuna modifica registrata per questo utente.
                            </p>
                          )}
                          {(logState?.list?.length ?? 0) > 0 && (
                            <ul className="audit-log-list">
                              {logState.list.map((entry) => (
                                <li key={entry.id} className="audit-log-item">
                                  <span className="audit-log-date">
                                    {new Date(entry.created_at).toLocaleString("it-IT")}
                                  </span>
                                  <span className="audit-log-actor">
                                    {entry.actor_name || entry.actor_email || "Sistema"}
                                  </span>
                                  <span className="audit-log-action">
                                    {describeAuditLogEntry(entry)}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </>
                      );
                    })()}
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

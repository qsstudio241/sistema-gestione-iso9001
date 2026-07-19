/**
 * AppLayout - Layout principale dell'applicazione
 *
 * Desktop: header top + sidebar sinistra fissa (240px) + area contenuto
 * Mobile:  header compatto + bottom navigation (5 voci)
 *
 * Approccio Apple:
 * - Sidebar sempre visibile su desktop: l'utente sa sempre dove si trova
 * - Bottom nav su mobile: pollice raggiunge tutte le voci principali
 * - Voce attiva evidenziata con colore primario
 * - Sezioni raggruppate con etichetta
 */

import React, { useState, useEffect, useCallback } from "react";
import { NavLink, useRouter, useNavigate } from "../contexts/RouterContext";
import { useAuth } from "../contexts/AuthContext";
import apiService from "../services/apiService";
import { hasCompanyAccess, getPrimaryCompanyId } from "../utils/companyAccess";
import "./AppLayout.css";

// ─── Definizione navigazione ──────────────────────────────────────────────────

function hasLicensedModule(user, key) {
  const m = user?.licensed_modules;
  if (!m || !Array.isArray(m) || m.length === 0) return true;
  return m.includes(key);
}

function buildNavItems(user, alerts = {}) {
  const isCompanyClient = hasCompanyAccess(user);
  const isAdmin = user?.role === "admin" || user?.role === "superadmin";
  const isSuperadmin = user?.role === "superadmin";
  const canManage = !isCompanyClient && ["admin", "auditor", "superadmin"].includes(user?.role);
  const primaryCompanyId = getPrimaryCompanyId(user);
  const companiesNavItem = isCompanyClient && primaryCompanyId
    ? { to: `/companies/${primaryCompanyId}`, icon: "🏢", label: "La mia Azienda" }
    : { to: "/companies", icon: "🏢", label: "Aziende" };

  const filterByLicense = (items) =>
    (items || []).filter((it) => !it.licenseKey || hasLicensedModule(user, it.licenseKey));

  return [
    // Gruppo principale
    {
      group: null,
      items: [
        { to: "/",        icon: "🏠", label: "Home",    exact: true },
        { to: "/audit",   icon: "🔍", label: "Audit" },
        { to: "/search",  icon: "🔎", label: "Ricerca" },
      ],
    },
    // Modulo SGQ
    {
      group: "SGQ",
      items: filterByLicense([
        { to: "/documents",   icon: "📄", label: "Documenti", badge: alerts.documents > 0 ? alerts.documents : null, licenseKey: "documents" },
        { to: "/deadlines",   icon: "\uD83D\uDCC5", label: "Scadenzari", licenseKey: "documents" },
        { to: "/qualifiche",  icon: "🎓", label: "Qualifiche", licenseKey: "qualifiche" },
        { to: "/nc",                  icon: "🚨", label: "Non Conformità",      licenseKey: "nc" },
        { to: "/rischi",              icon: "⚠️",  label: "Rischi, Opportunità e Obiettivi",   licenseKey: "rischi" },
        { to: "/management-reviews",  icon: "📋", label: "Riesame Direzione",     licenseKey: "riesame_direzione" },
        { to: "/reclami",          icon: "📢", label: "Reclami", badge: alerts.complaints > 0 ? alerts.complaints : null, licenseKey: "reclami" },
        { to: "/anagrafiche",      icon: "🗂️",  label: "Anagrafiche",        licenseKey: "reclami" },
        { to: "/contract-reviews", icon: "📑", label: "Riesame Requisiti",   licenseKey: "ai_review" },
        { to: "/gap-analysis",      icon: "📊", label: "Gap Analysis",        licenseKey: "ai_norms" },
        { to: "/ai-assistant",     icon: "🤖", label: "Assistente AI",      licenseKey: "ai_chat" },
        ...(isAdmin ? [{ to: "/ai-knowledge-health", icon: "🩺", label: "Knowledge Health", licenseKey: "ai_chat" }] : []),
        { to: "/sal",              icon: "📊", label: "SAL", licenseKey: "sal" },
      ]),
    },
    // Modulo Saldatura
    {
      group: "Saldatura",
      items: filterByLicense([
        { to: "/saldatura", icon: "\uD83C\uDFED", label: "Dashboard 3834", licenseKey: "saldatura" },
        { to: "/saldatura/commesse", icon: "\uD83D\uDCCB", label: "Commesse", licenseKey: "saldatura" },
        { to: "/saldatura/procedure", icon: "\uD83D\uDD27", label: "Procedure WPS/WPQR", licenseKey: "saldatura" },
        { to: "/saldatura/welding-book", icon: "\uD83D\uDCD6", label: "Welding Book", licenseKey: "saldatura" },
      ]),
    },
    // Modulo CND (Controlli Non Distruttivi)
    {
      group: "CND",
      items: filterByLicense([
        { to: "/cnd/strumenti", icon: "\uD83D\uDD2C", label: "Strumenti e Attrezzature", licenseKey: "cnd" },
        { to: "/cnd/verbali",   icon: "\uD83D\uDCCB", label: "Verbali CND (VT/MT/PT/UT)", licenseKey: "cnd" },
      ]),
    },
    // Gestione (studio admin/auditor o cliente azienda con menu ridotto)
    ...(canManage || isCompanyClient ? [{
      group: "Gestione",
      items: filterByLicense([
        ...(!isCompanyClient ? [{ to: "/settings/studio", icon: "🏢", label: "Il mio Studio" }] : []),
        companiesNavItem,
        ...(isAdmin && !isCompanyClient ? [
          { to: "/settings/users",    icon: "👥", label: "Utenti" },
          { to: "/settings/licenses", icon: "🔑", label: "Licenze moduli" },
          ...(isSuperadmin ? [{ to: "/settings/billing", icon: "💳", label: "Fatturazione" }] : []),
          { to: "/settings/import-jobs", icon: "📥", label: "Import PDF", licenseKey: "ai_import" },
          { to: "/settings/checklist",icon: "📋", label: "Checklist" },
        ] : []),
        { to: "/settings/templates",        icon: "📝", label: "Template report" },
        { to: "/settings/custom-checklists",icon: "📋", label: "Checklist personalizzate" },
        ...(isAdmin ? [
          { to: "/settings/notifications",  icon: "🔔", label: "Notifiche", licenseKey: "notifications" },
        ] : []),
      ]),
    }] : []),
  ];
}

// ─── Bottom navigation (mobile - max 5 voci, allineata a licenze) ────────────

function buildMobileNavItems(user, alerts) {
  const groups = buildNavItems(user, alerts);
  const flat = groups.flatMap((g) => g.items).filter((it) => !it.locked);

  const find = (to) => flat.find((it) => it.to === to);
  const isAdmin = user?.role === "admin" || user?.role === "superadmin";

  const items = [
    { to: "/", icon: "\uD83C\uDFE0", label: "Home", exact: true },
  ];

  const audit = find("/audit");
  if (audit) items.push({ to: audit.to, icon: audit.icon, label: "Audit" });

  const nc = find("/nc");
  if (nc) items.push({ to: nc.to, icon: nc.icon, label: "NC" });

  // CND — priorità sul 4° posto quando il modulo è attivo (ispettori in campo)
  const cnd = find("/cnd/verbali");
  if (cnd) {
    items.push({ to: cnd.to, icon: "\uD83D\uDD2C", label: "CND" });
  } else {
    // Se CND non attivo, usa Documenti al 4° posto
    const docs = find("/documents");
    if (docs) items.push({ to: docs.to, icon: docs.icon, label: "Documenti" });
  }

  // 5° posto: AI (se ai_chat attivo) oppure Documenti/Impostazioni/Aziende come fallback
  const ai = find("/ai-assistant");
  if (ai) {
    items.push({ to: ai.to, icon: "\uD83E\uDD16", label: "AI" });
  } else if (cnd) {
    const docs = find("/documents");
    if (docs) items.push({ to: docs.to, icon: docs.icon, label: "Documenti" });
  } else if (isAdmin) {
    const settings = find("/settings/users");
    if (settings) items.push({ to: settings.to, icon: "\u2699\uFE0F", label: "Impostaz" });
  } else {
    const companies = find("/companies");
    if (companies) items.push({ to: companies.to, icon: companies.icon, label: "Aziende" });
  }

  return items.slice(0, 5);
}

function BottomNav({ user, alerts }) {
  const { path } = useRouter();
  const mobileItems = buildMobileNavItems(user, alerts);

  return (
    <nav className="bottom-nav" role="navigation" aria-label="Navigazione principale">
      {mobileItems.map((item) => {
        const isActive = item.exact ? path === item.to : path.startsWith(item.to) && item.to !== "/";
        return (
          <NavLink
            key={item.to}
            to={item.to}
            exact={item.exact}
            className={`bottom-nav-item${isActive ? " active" : ""}`}
            activeClassName=""
          >
            <span className="bottom-nav-icon">{item.icon}</span>
            <span className="bottom-nav-label">{item.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}

// ─── Sidebar (desktop) ────────────────────────────────────────────────────────

function Sidebar({ navGroups, collapsed, onToggle, orgLogoDataUrl, orgName }) {
  return (
    <aside className={`sidebar${collapsed ? " sidebar-collapsed" : ""}`} aria-label="Menu laterale">
      {/* Logo / titolo */}
      <div className="sidebar-logo">
        {!collapsed && (
          <>
            {orgLogoDataUrl ? (
              <img src={orgLogoDataUrl} alt="" className="sidebar-org-logo" width={32} height={32} />
            ) : (
              <span className="sidebar-logo-icon">⚙️</span>
            )}
            <span className="sidebar-logo-text" title={orgName || ""}>
              {orgName ? orgName : "SGQ Studio"}
            </span>
          </>
        )}
        <button
          className="sidebar-toggle"
          onClick={onToggle}
          title={collapsed ? "Espandi menu" : "Comprimi menu"}
          aria-label={collapsed ? "Espandi menu" : "Comprimi menu"}
        >
          {collapsed ? "▶" : "◀"}
        </button>
      </div>

      {/* Gruppi di navigazione */}
      <nav className="sidebar-nav">
        {navGroups.map((group, gi) => (
          <div key={gi} className="sidebar-group">
            {group.group && !collapsed && (
              <span className="sidebar-group-label">{group.group}</span>
            )}
            {group.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                exact={item.exact}
                className={`sidebar-item${item.locked ? " sidebar-item-locked" : ""}`}
                activeClassName="active"
              >
                <span className="sidebar-item-icon">{item.icon}</span>
                {!collapsed && (
                  <>
                    <span className="sidebar-item-label">{item.label}</span>
                    {item.badge && (
                      <span className="sidebar-badge">{item.badge > 99 ? "99+" : item.badge}</span>
                    )}
                    {item.locked && <span className="sidebar-lock">🔒</span>}
                  </>
                )}
                {collapsed && item.badge && (
                  <span className="sidebar-badge-sm">{item.badge > 9 ? "9+" : item.badge}</span>
                )}
                {collapsed && item.locked && (
                  <span className="sidebar-lock-sm">🔒</span>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
      {collapsed && orgLogoDataUrl ? (
        <div className="sidebar-collapsed-brand" aria-hidden>
          <img src={orgLogoDataUrl} alt="" className="sidebar-org-logo-sm" width={28} height={28} />
        </div>
      ) : null}
    </aside>
  );
}

// ─── Layout principale ────────────────────────────────────────────────────────

function AppLayout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [alerts, setAlerts] = useState({ documents: 0, complaints: 0 });
  const [orgLogoDataUrl, setOrgLogoDataUrl] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadOrgLogo() {
      if (!user?.organization_logo_url || !apiService.getToken()) {
        setOrgLogoDataUrl(null);
        return;
      }
      try {
        const res = await fetch(apiService.getOrganizationLogoUrl(), {
          headers: { Authorization: `Bearer ${apiService.getToken()}` },
        });
        if (!res.ok || cancelled) return;
        const blob = await res.blob();
        const dataUrl = await new Promise((resolve, reject) => {
          const fr = new FileReader();
          fr.onload = () => resolve(fr.result);
          fr.onerror = reject;
          fr.readAsDataURL(blob);
        });
        if (!cancelled) setOrgLogoDataUrl(dataUrl);
      } catch {
        if (!cancelled) setOrgLogoDataUrl(null);
      }
    }

    loadOrgLogo();
    return () => {
      cancelled = true;
    };
  }, [user?.organization_id, user?.organization_logo_url]);

  // Polling badge alert ogni 5 minuti
  const loadAlerts = useCallback(async () => {
    try {
      const modules = user?.licensed_modules;
      const hasReclami =
        !modules || !Array.isArray(modules) || modules.length === 0 || modules.includes("reclami");
      const compPromise = hasReclami
        ? apiService.getComplaintsStats()
        : Promise.resolve({ data: {} });
      const [docsRes, compRes] = await Promise.all([
        apiService.getAlertCount(),
        compPromise,
      ]);
      const overdue =
        compRes?.data?.overdue_30_days ?? compRes?.overdue_30_days ?? 0;
      setAlerts({
        documents: docsRes.total || 0,
        complaints: overdue,
      });
    } catch {
      // non bloccante
    }
  }, [user?.licensed_modules]);

  useEffect(() => {
    loadAlerts();
    const interval = setInterval(loadAlerts, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [loadAlerts]);

  const navGroups = buildNavItems(user, alerts);

  return (
    <div className={`app-layout${sidebarCollapsed ? " sidebar-is-collapsed" : ""}`}>
      {/* Sidebar desktop */}
      <Sidebar
        navGroups={navGroups}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((v) => !v)}
        orgLogoDataUrl={orgLogoDataUrl}
        orgName={user?.organization_name || ""}
      />

      {/* Area destra: header + contenuto + footer */}
      <div className="layout-right">
        {/* Header */}
        <header className="layout-header">
          <div className="layout-header-left">
            {orgLogoDataUrl ? (
              <img src={orgLogoDataUrl} alt="" className="layout-header-org-logo" width={36} height={36} />
            ) : null}
            <h1 className="layout-title" onClick={() => navigate("/")} style={{ cursor: "pointer" }}>
              SGQ - Sistema di Gestione
            </h1>
            <button
              type="button"
              className="layout-search-btn"
              onClick={() => navigate("/search")}
              title="Ricerca globale"
              aria-label="Ricerca globale"
            >
              {"\uD83D\uDD0D"} Ricerca
            </button>
          </div>
          <div className="layout-header-right">
            <div className="user-chip">
              <span className="user-chip-name">👤 {user?.full_name || user?.name || user?.email}</span>
              <span className={`user-chip-role role-${user?.role}`}>{user?.role}</span>
            </div>
            <button onClick={logout} className="btn-logout" title="Esci">
              🚪 Esci
            </button>
          </div>
        </header>

        {user?.organization_name ? (
          <div className="layout-org-banner" role="region" aria-label="Organizzazione attiva">
            {orgLogoDataUrl ? (
              <img src={orgLogoDataUrl} alt="" className="layout-org-banner-logo" width={28} height={28} />
            ) : null}
            <span className="layout-org-banner-name">{user.organization_name}</span>
            {user.organization_vat_number ? (
              <span className="layout-org-banner-vat">P.IVA {user.organization_vat_number}</span>
            ) : null}
          </div>
        ) : null}

        {/* Contenuto principale */}
        <main className="layout-main">
          {children}
        </main>

        {/* Footer */}
        <footer className="layout-footer">
          <p>© {new Date().getFullYear()} QS Studio - Sistema Gestione ISO 9001/14001/45001</p>
        </footer>
      </div>

      {/* Bottom navigation mobile */}
      <BottomNav user={user} alerts={alerts} />
    </div>
  );
}

export default AppLayout;

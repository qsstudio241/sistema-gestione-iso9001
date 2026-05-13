/**
 * AppLayout — Layout principale dell'applicazione
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
import "./AppLayout.css";

// ─── Definizione navigazione ──────────────────────────────────────────────────

function hasLicensedModule(user, key) {
  const m = user?.licensed_modules;
  if (!m || !Array.isArray(m) || m.length === 0) return true;
  return m.includes(key);
}

function buildNavItems(user, alerts = {}) {
  const isAdmin = user?.role === "admin" || user?.role === "superadmin";
  const canManage = ["admin", "auditor", "superadmin"].includes(user?.role);

  const filterByLicense = (items) =>
    (items || []).filter((it) => !it.licenseKey || hasLicensedModule(user, it.licenseKey));

  return [
    // Gruppo principale
    {
      group: null,
      items: [
        { to: "/",        icon: "🏠", label: "Home",    exact: true },
        { to: "/audit",   icon: "🔍", label: "Audit" },
      ],
    },
    // Modulo SGQ
    {
      group: "SGQ",
      items: filterByLicense([
        { to: "/documents",   icon: "📄", label: "Documenti", badge: alerts.documents > 0 ? alerts.documents : null, licenseKey: "documents" },
        { to: "/qualifiche",  icon: "🎓", label: "Qualifiche", licenseKey: "qualifiche" },
        { to: "/nc",          icon: "🚨", label: "Non Conformità", licenseKey: "nc" },
        { to: "/rischi",      icon: "⚠️",  label: "Rischi & Obiettivi", licenseKey: "rischi" },
        { to: "/reclami",     icon: "📢", label: "Reclami & Fornitori", badge: alerts.complaints > 0 ? alerts.complaints : null, licenseKey: "reclami" },
        { to: "/contract-reviews", icon: "📑", label: "Riesame Requisiti", licenseKey: "ai_review" },
        { to: "/sal",         icon: "📊", label: "SAL", locked: true, licenseKey: "sal" },
      ]),
    },
    // Modulo Saldatura
    {
      group: "Saldatura",
      items: filterByLicense([
        { to: "/saldatura", icon: "🔧", label: "ISO 3834", locked: true, licenseKey: "saldatura" },
      ]),
    },
    // Gestione (solo admin/auditor)
    ...(canManage ? [{
      group: "Gestione",
      items: filterByLicense([
        { to: "/settings/studio", icon: "🏢", label: "Il mio Studio" },
        { to: "/companies",   icon: "🏢", label: "Aziende" },
        ...(isAdmin ? [
          { to: "/settings/users",    icon: "👥", label: "Utenti" },
          { to: "/settings/licenses", icon: "🔑", label: "Licenze moduli" },
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

// ─── Bottom navigation (mobile — max 5 voci) ─────────────────────────────────

function BottomNav({ navItems }) {
  const { path } = useRouter();
  // Seleziona le 5 voci più importanti per il mobile
  const mobileItems = [
    { to: "/",          icon: "🏠", label: "Home",     exact: true },
    { to: "/audit",     icon: "🔍", label: "Audit" },
    { to: "/documents", icon: "📄", label: "Documenti" },
    { to: "/companies", icon: "🏢", label: "Aziende" },
    { to: "/settings/users", icon: "⚙️", label: "Impostazioni" },
  ];

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
              SGQ — Sistema di Gestione
            </h1>
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
          <p>© {new Date().getFullYear()} QS Studio — Sistema Gestione ISO 9001/14001/45001</p>
        </footer>
      </div>

      {/* Bottom navigation mobile */}
      <BottomNav navGroups={navGroups} />
    </div>
  );
}

export default AppLayout;

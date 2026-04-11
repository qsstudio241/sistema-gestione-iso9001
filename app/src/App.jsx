/**
 * App.jsx — Entry point principale
 *
 * Architettura Sprint 0:
 * - RouterProvider: URL semantici via History API (zero dipendenze npm)
 * - AuthProvider + StorageProvider: contesti esistenti invariati
 * - AppLayout: sidebar desktop + bottom nav mobile
 * - Routes: mappa URL → componente
 *
 * Il pattern viewMode è stato rimosso. La navigazione avviene
 * tramite URL (navigate('/audit'), navigate('/documents') ecc.)
 */

import React, { useEffect } from "react";
import { RouterProvider, Routes, Route, useNavigate } from "./contexts/RouterContext";
import { StorageProvider } from "./contexts/StorageContext";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { ErrorBoundary } from "./components/SharedComponents";
import AppLayout from "./layouts/AppLayout";

// Pagine e componenti
import HomePage from "./pages/HomePage";
import Dashboard from "./components/Dashboard";
import DocumentRegistry from "./components/DocumentRegistry";
import CompaniesPage from "./components/CompaniesPage";
import ChecklistAdminPage from "./components/ChecklistAdminPage";
import UsersAdminPage from "./components/UsersAdminPage";
import ReportTemplatesAdminPage from "./components/ReportTemplatesAdminPage";
import CustomChecklistsPage from "./components/CustomChecklistsPage";
import NotificationsSettingsPage from "./pages/NotificationsSettingsPage";
import QualificationsPage from "./pages/QualificationsPage";
import NCPage from "./pages/NCPage";
import RisksPage from "./pages/RisksPage";
import ComplaintsPage from "./pages/ComplaintsPage";
import ModuleLocked from "./components/ModuleLocked";
import Login from "./components/Login";
import ConnectionStatus from "./components/ConnectionStatus";
import AuditLockBanner from "./components/AuditLockBanner";

import { useCheckpointSaver } from "./hooks/useCheckpointSaver";
import { checkAndMigrateStorage } from "./utils/storageVersion";
import { useStorage } from "./contexts/StorageContext";
import "./App.css";

// ─── Wrapper per componenti che usano onBack ──────────────────────────────────

function BackWrapper({ children }) {
  const navigate = useNavigate();
  return React.cloneElement(children, { onBack: () => navigate(-1) || navigate("/") });
}

// ─── Contenuto app autenticato ────────────────────────────────────────────────

function AppContent() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { currentAudit, fsProvider } = useStorage();

  // Auto-save checkpoint ogni 30 secondi
  useCheckpointSaver(currentAudit, fsProvider, { intervalMs: 30000, enabled: true });

  // Schermata di caricamento
  if (authLoading) {
    return (
      <div className="app-loading">
        <div className="loading-spinner"></div>
        <p>Caricamento...</p>
      </div>
    );
  }

  // Login
  if (!isAuthenticated) {
    return <Login />;
  }

  // App autenticata con layout e routing
  return (
    <AppLayout>
      <ConnectionStatus />
      <AuditLockBanner />

      <Routes>
        {/* Home dashboard */}
        <Route path="/" element={<HomePage />} />

        {/* Modulo Audit (comportamento invariato) */}
        <Route path="/audit" element={<Dashboard />} />

        {/* Modulo SGQ — Documenti */}
        <Route
          path="/documents"
          element={
            <BackWrapper>
              <DocumentRegistry />
            </BackWrapper>
          }
        />

        {/* Moduli SGQ bloccati (Sprint 2-7) */}
        <Route path="/qualifiche" element={<QualificationsPage />} />
        <Route path="/nc"         element={<NCPage />} />
        <Route path="/rischi"     element={<RisksPage />} />
        <Route path="/reclami"    element={<ComplaintsPage />} />
        <Route path="/sal"        element={<ModuleLocked module="sal" />} />

        {/* Modulo Saldatura bloccato (Sprint 5) */}
        <Route path="/saldatura" element={<ModuleLocked module="saldatura" />} />

        {/* Gestione aziende */}
        <Route
          path="/companies"
          element={
            <BackWrapper>
              <CompaniesPage />
            </BackWrapper>
          }
        />

        {/* Impostazioni admin */}
        <Route
          path="/settings/users"
          element={
            <BackWrapper>
              <UsersAdminPage />
            </BackWrapper>
          }
        />
        <Route
          path="/settings/checklist"
          element={
            <BackWrapper>
              <ChecklistAdminPage />
            </BackWrapper>
          }
        />
        <Route
          path="/settings/templates"
          element={
            <BackWrapper>
              <ReportTemplatesAdminPage />
            </BackWrapper>
          }
        />
        <Route
          path="/settings/custom-checklists"
          element={
            <BackWrapper>
              <CustomChecklistsPage />
            </BackWrapper>
          }
        />
        <Route
          path="/settings/notifications"
          element={
            <BackWrapper>
              <NotificationsSettingsPage />
            </BackWrapper>
          }
        />
      </Routes>
    </AppLayout>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

function App() {
  useEffect(() => {
    checkAndMigrateStorage();
  }, []);

  return (
    <ErrorBoundary>
      <RouterProvider>
        <AuthProvider>
          <StorageProvider>
            <AppContent />
          </StorageProvider>
        </AuthProvider>
      </RouterProvider>
    </ErrorBoundary>
  );
}

export default App;

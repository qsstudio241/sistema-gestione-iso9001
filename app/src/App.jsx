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

import React, { useEffect, Suspense } from "react";
import { RouterProvider, Routes, Route, useNavigate } from "./contexts/RouterContext";
import { StorageProvider } from "./contexts/StorageContext";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { ErrorBoundary } from "./components/SharedComponents";
import AppLayout from "./layouts/AppLayout";

// Route-level lazy loading: riduce il bundle iniziale (code splitting)
const HomePage = React.lazy(() => import("./pages/HomePage"));
const Dashboard = React.lazy(() => import("./components/Dashboard"));
const DocumentRegistry = React.lazy(() => import("./components/DocumentRegistry"));
const CompaniesPage = React.lazy(() => import("./components/CompaniesPage"));
const ChecklistAdminPage = React.lazy(() => import("./components/ChecklistAdminPage"));
const UsersAdminPage = React.lazy(() => import("./components/UsersAdminPage"));
const ReportTemplatesAdminPage = React.lazy(() => import("./components/ReportTemplatesAdminPage"));
const CustomChecklistsPage = React.lazy(() => import("./components/CustomChecklistsPage"));
const NotificationsSettingsPage = React.lazy(() => import("./pages/NotificationsSettingsPage"));
const QualificationsPage = React.lazy(() => import("./pages/QualificationsPage"));
const NCPage = React.lazy(() => import("./pages/NCPage"));
const RisksPage = React.lazy(() => import("./pages/RisksPage"));
const ComplaintsPage = React.lazy(() => import("./pages/ComplaintsPage"));
const LicensesSettingsPage = React.lazy(() => import("./pages/LicensesSettingsPage"));
const StudioSettingsPage = React.lazy(() => import("./pages/StudioSettingsPage"));
const ImportJobsPage = React.lazy(() => import("./pages/ImportJobsPage"));
const AnagrafichePage = React.lazy(() => import("./pages/AnagrafichePage"));
const ContractReviewPage = React.lazy(() => import("./pages/ContractReviewPage"));
const AiAssistantPage = React.lazy(() => import("./pages/AiAssistantPage"));
const KnowledgeHealthPage = React.lazy(() => import("./pages/KnowledgeHealthPage"));
import ModuleLocked from "./components/ModuleLocked";
import LicensedRoute from "./components/LicensedRoute";
import Login from "./components/Login";
import ConnectionStatus from "./components/ConnectionStatus";
import AuditLockBanner from "./components/AuditLockBanner";
import SyncMergeBanner from "./components/SyncMergeBanner";
import LogoutSyncGuard from "./components/LogoutSyncGuard";

import { useCheckpointSaver } from "./hooks/useCheckpointSaver";
import { checkAndMigrateStorage } from "./utils/storageVersion";
import { useStorage } from "./contexts/StorageContext";
import "./App.css";

function RouteLoadingFallback() {
  return (
    <div className="app-loading">
      <div className="loading-spinner"></div>
      <p>Caricamento...</p>
    </div>
  );
}

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
      <SyncMergeBanner />
      <LogoutSyncGuard />

      <Suspense fallback={<RouteLoadingFallback />}>
      <Routes>
        {/* Home dashboard */}
        <Route path="/" element={<HomePage />} />

        {/* Modulo Audit (comportamento invariato) */}
        <Route path="/audit" element={<Dashboard />} />

        {/* Modulo SGQ — Documenti */}
        <Route
          path="/documents"
          element={
            <LicensedRoute moduleKey="documents">
              <BackWrapper>
                <DocumentRegistry />
              </BackWrapper>
            </LicensedRoute>
          }
        />

        {/* Moduli SGQ — gating licenza Sprint 8 */}
        <Route path="/qualifiche" element={<LicensedRoute moduleKey="qualifiche"><QualificationsPage /></LicensedRoute>} />
        <Route path="/nc"         element={<LicensedRoute moduleKey="nc"><NCPage /></LicensedRoute>} />
        <Route path="/rischi"     element={<LicensedRoute moduleKey="rischi"><RisksPage /></LicensedRoute>} />
        <Route path="/reclami"          element={<LicensedRoute moduleKey="reclami"><ComplaintsPage /></LicensedRoute>} />
        <Route path="/anagrafiche"      element={<LicensedRoute moduleKey="reclami"><AnagrafichePage /></LicensedRoute>} />
        <Route path="/contract-reviews" element={<LicensedRoute moduleKey="ai_review"><ContractReviewPage /></LicensedRoute>} />
        <Route path="/ai-assistant"     element={<LicensedRoute moduleKey="ai_assist"><AiAssistantPage /></LicensedRoute>} />
        <Route path="/ai-knowledge-health" element={<LicensedRoute moduleKey="ai_assist"><KnowledgeHealthPage /></LicensedRoute>} />
        <Route path="/sal"              element={<LicensedRoute moduleKey="sal"><ModuleLocked module="sal" /></LicensedRoute>} />

        <Route path="/saldatura" element={<LicensedRoute moduleKey="saldatura"><ModuleLocked module="saldatura" /></LicensedRoute>} />

        {/* Gestione aziende */}
        <Route
          path="/companies"
          element={
            <BackWrapper>
              <CompaniesPage />
            </BackWrapper>
          }
        />

        {/* Impostazioni studio */}
        <Route
          path="/settings/studio"
          element={
            <BackWrapper>
              <StudioSettingsPage />
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
            <LicensedRoute moduleKey="notifications">
              <BackWrapper>
                <NotificationsSettingsPage />
              </BackWrapper>
            </LicensedRoute>
          }
        />
        <Route
          path="/settings/licenses"
          element={
            <BackWrapper>
              <LicensesSettingsPage />
            </BackWrapper>
          }
        />
        <Route
          path="/settings/import-jobs"
          element={
            <LicensedRoute moduleKey="ai_import">
              <BackWrapper>
                <ImportJobsPage />
              </BackWrapper>
            </LicensedRoute>
          }
        />
      </Routes>
      </Suspense>
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

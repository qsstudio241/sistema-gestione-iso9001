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
import { RouterProvider, Routes, Route, useNavigate, useRouter } from "./contexts/RouterContext";
import { StorageProvider } from "./contexts/StorageContext";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { ErrorBoundary } from "./components/SharedComponents";
import AppLayout from "./layouts/AppLayout";

// Route-level lazy loading: riduce il bundle iniziale (code splitting)
const HomePage = React.lazy(() => import("./pages/HomePage"));
const Dashboard = React.lazy(() => import("./components/Dashboard"));
const DocumentRegistry = React.lazy(() => import("./components/DocumentRegistry"));
const CompaniesPage = React.lazy(() => import("./components/CompaniesPage"));
const CompanyDetailPage = React.lazy(() => import("./pages/CompanyDetailPage"));
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
const BillingDashboardPage = React.lazy(() => import("./pages/BillingDashboardPage"));
const StudioSettingsPage = React.lazy(() => import("./pages/StudioSettingsPage"));
const ImportJobsPage = React.lazy(() => import("./pages/ImportJobsPage"));
const AnagrafichePage = React.lazy(() => import("./pages/AnagrafichePage"));
const ContractReviewPage = React.lazy(() => import("./pages/ContractReviewPage"));
const GapAnalysisPage = React.lazy(() => import("./pages/GapAnalysisPage"));
const AiAssistantPage = React.lazy(() => import("./pages/AiAssistantPage"));
const KnowledgeHealthPage = React.lazy(() => import("./pages/KnowledgeHealthPage"));
const SearchPage = React.lazy(() => import("./pages/SearchPage"));
const WeldingProceduresPage = React.lazy(() => import("./pages/WeldingProceduresPage"));
const WeldingDashboardPage = React.lazy(() => import("./pages/WeldingDashboardPage"));
const EquipmentPage  = React.lazy(() => import("./pages/EquipmentPage"));
const NdtReportsPage = React.lazy(() => import("./pages/NdtReportsPage"));
const RDPModule = React.lazy(() => import("./pages/RDPModule"));
const WeldingBooksPage = React.lazy(() => import("./pages/WeldingBooksPage"));
const MaterialCertificatesPage = React.lazy(() => import("./pages/MaterialCertificatesPage"));
const ProjectsPage = React.lazy(() => import("./pages/ProjectsPage"));
const DeadlinesPage = React.lazy(() => import("./pages/DeadlinesPage"));
const ManagementReviewsPage = React.lazy(() => import("./pages/ManagementReviewsPage"));
const SALModule = React.lazy(() => import("./pages/SALModule"));
const DevUiCatalog = import.meta.env.DEV ? React.lazy(() => import("./pages/DevUiCatalog")) : null;
const AcceptInvitePage = React.lazy(() => import("./pages/AcceptInvitePage"));
const ForgotPasswordPage = React.lazy(() => import("./pages/ForgotPasswordPage"));
const ResetPasswordPage = React.lazy(() => import("./pages/ResetPasswordPage"));
import ModuleLocked from "./components/ModuleLocked";
import LicensedRoute from "./components/LicensedRoute";
import { hasMaterialComplianceCapability } from "./utils/licenseUtils";
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
  const { path } = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { currentAudit, fsProvider } = useStorage();

  // Auto-save checkpoint ogni 30 secondi
  useCheckpointSaver(currentAudit, fsProvider, { intervalMs: 30000, enabled: true });

  // Rotta pubblica pre-login (G10, piano UAL Fase 1/8.1): deve essere raggiungibile
  // PRIMA del redirect a <Login/>, indipendentemente dallo stato di autenticazione
  // (es. una sessione admin già attiva in un'altra tab non deve nascondere il link).
  const acceptInviteMatch = path.match(/^\/accept-invite\/([^/]+)/);
  if (acceptInviteMatch) {
    return (
      <Suspense fallback={<RouteLoadingFallback />}>
        <AcceptInvitePage token={decodeURIComponent(acceptInviteMatch[1])} />
      </Suspense>
    );
  }

  // Rotte pubbliche pre-login del reset password self-service (UAL-4, piano
  // Fase 2 / G10): stesso principio di /accept-invite qui sopra — raggiungibili
  // indipendentemente dallo stato di autenticazione.
  if (path === "/forgot-password") {
    return (
      <Suspense fallback={<RouteLoadingFallback />}>
        <ForgotPasswordPage />
      </Suspense>
    );
  }
  const resetPasswordMatch = path.match(/^\/reset-password\/([^/]+)/);
  if (resetPasswordMatch) {
    return (
      <Suspense fallback={<RouteLoadingFallback />}>
        <ResetPasswordPage token={decodeURIComponent(resetPasswordMatch[1])} />
      </Suspense>
    );
  }

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
        {/* Dev-only: catalogo UI */}
        {import.meta.env.DEV && DevUiCatalog && (
          <Route path="/dev/ui-catalog" element={<DevUiCatalog />} />
        )}

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
        <Route path="/deadlines"  element={<LicensedRoute moduleKey="documents"><DeadlinesPage /></LicensedRoute>} />
        <Route path="/management-reviews" element={<LicensedRoute moduleKey="riesame_direzione"><ManagementReviewsPage /></LicensedRoute>} />
        <Route path="/qualifiche" element={<LicensedRoute moduleKey="qualifiche"><QualificationsPage /></LicensedRoute>} />
        <Route path="/nc"         element={<LicensedRoute moduleKey="nc"><NCPage /></LicensedRoute>} />
        <Route path="/rischi"     element={<LicensedRoute moduleKey="rischi"><RisksPage /></LicensedRoute>} />
        <Route path="/reclami"          element={<LicensedRoute moduleKey="reclami"><ComplaintsPage /></LicensedRoute>} />
        <Route path="/anagrafiche"      element={<LicensedRoute moduleKey="reclami"><AnagrafichePage /></LicensedRoute>} />
        <Route path="/contract-reviews" element={<LicensedRoute moduleKey="ai_review"><ContractReviewPage /></LicensedRoute>} />
        <Route path="/gap-analysis" element={<LicensedRoute moduleKey="ai_norms"><GapAnalysisPage /></LicensedRoute>} />
        <Route path="/ai-assistant"     element={<LicensedRoute moduleKey="ai_chat"><AiAssistantPage /></LicensedRoute>} />
        <Route path="/ai-knowledge-health" element={<LicensedRoute moduleKey="ai_chat"><KnowledgeHealthPage /></LicensedRoute>} />
        <Route path="/search"          element={<SearchPage />} />
        <Route path="/sal"              element={<LicensedRoute moduleKey="sal"><SALModule /></LicensedRoute>} />

        <Route path="/saldatura/procedure" element={<LicensedRoute moduleKey="saldatura"><WeldingProceduresPage /></LicensedRoute>} />
        <Route path="/wps" element={<LicensedRoute moduleKey="saldatura"><WeldingProceduresPage /></LicensedRoute>} />
        <Route path="/saldatura/commesse" element={<LicensedRoute moduleKey="saldatura"><ProjectsPage /></LicensedRoute>} />
        <Route path="/saldatura/materiali" element={<LicensedRoute moduleKey="material_compliance" isAllowed={hasMaterialComplianceCapability}><MaterialCertificatesPage /></LicensedRoute>} />
        <Route path="/saldatura/welding-book" element={<LicensedRoute moduleKey="saldatura"><WeldingBooksPage /></LicensedRoute>} />
        <Route path="/saldatura" element={<LicensedRoute moduleKey="saldatura"><WeldingDashboardPage /></LicensedRoute>} />
        <Route path="/cnd/strumenti" element={<LicensedRoute moduleKey="cnd"><EquipmentPage /></LicensedRoute>} />
        <Route path="/cnd/verbali"   element={<LicensedRoute moduleKey="cnd"><NdtReportsPage /></LicensedRoute>} />
        <Route path="/saldatura/rdp" element={<LicensedRoute moduleKey="saldatura"><RDPModule /></LicensedRoute>} />

        {/* Gestione aziende — dettaglio prima della lista (prefix match router) */}
        <Route
          path="/companies/"
          element={
            <BackWrapper>
              <CompanyDetailPage />
            </BackWrapper>
          }
        />
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
          path="/settings/billing"
          element={
            <BackWrapper>
              <BillingDashboardPage />
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

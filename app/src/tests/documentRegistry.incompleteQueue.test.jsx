/**
 * @vitest-environment jsdom
 *
 * Deep link Import → coda: la prima GET catalogo deve già avere company_id
 * dall'URL, non solo dopo applyFromUrl (secondo render).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, waitFor } from "@testing-library/react";

const scopeState = {
  companyId: "",
  setCompanyId: vi.fn(),
  companies: [{ id: 11, name: "Mason Demo" }],
  reloadCompanies: vi.fn(),
  locked: false,
  companyScoped: false,
  isStudioWide: true,
  isStudioPatrimonio: false,
  scopeReady: true,
  scopeCompanyName: "Tutto lo studio",
};

vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { role: "admin", organization_id: 1001 },
    canWriteModule: () => true,
  }),
}));

vi.mock("../contexts/CompanyScopeContext", () => ({
  useCompanyScope: () => scopeState,
}));

vi.mock("../contexts/RouterContext", () => ({
  useRouter: () => ({ replace: vi.fn(), navigate: vi.fn(), path: "/documents" }),
}));

vi.mock("../services/apiService", () => ({
  default: {
    getDocuments: vi.fn(),
    getDocumentStats: vi.fn(),
    getStandards: vi.fn(),
    getOrphanDocuments: vi.fn(),
    getNotificationsConfig: vi.fn(),
    getPriorityDeadlines: vi.fn(),
    getDocumentTree: vi.fn(),
    getDocumentTreeChildren: vi.fn(),
    getDocumentBreadcrumb: vi.fn(),
  },
}));

import apiService from "../services/apiService";
import DocumentRegistry from "../components/DocumentRegistry";

function catalogCalls() {
  return apiService.getDocuments.mock.calls
    .map((args) => args[0] || {})
    .filter((params) => params.incomplete === 1 || params.page != null);
}

describe("DocumentRegistry — deep link coda company_id al primo fetch", () => {
  const originalSearch = window.location.search;

  beforeEach(() => {
    vi.clearAllMocks();
    scopeState.companyId = "";
    scopeState.isStudioWide = true;
    scopeState.isStudioPatrimonio = false;
    scopeState.setCompanyId = vi.fn();
    apiService.getDocuments.mockResolvedValue({
      data: [],
      pagination: { total: 0, totalPages: 1 },
    });
    apiService.getDocumentStats.mockResolvedValue({
      data: { total: 0, vigenti: 0, senza_file: 0, rilasciati_senza_file: 0, da_completare: 3 },
    });
    apiService.getStandards.mockResolvedValue({ data: [] });
    apiService.getOrphanDocuments.mockResolvedValue({ data: [] });
    apiService.getNotificationsConfig.mockResolvedValue({ alert_days_1: 30 });
    apiService.getPriorityDeadlines.mockResolvedValue({ data: [] });
    window.history.replaceState(
      {},
      "",
      "/documents?tab=catalog&company_id=11&incomplete=1"
    );
  });

  afterEach(() => {
    window.history.replaceState({}, "", `/${originalSearch || ""}`);
  });

  it("prima GET catalogo include company_id=11 anche se l'header è Tutto lo studio", async () => {
    render(<DocumentRegistry />);

    await waitFor(() => expect(catalogCalls().length).toBeGreaterThan(0));

    const firstCatalog = catalogCalls()[0];
    expect(String(firstCatalog.company_id)).toBe("11");
    expect(firstCatalog.incomplete).toBe(1);
  });

  it("URL senza company_id valido non inventa lo scope sul primo fetch", async () => {
    window.history.replaceState({}, "", "/documents?tab=catalog&incomplete=1");
    render(<DocumentRegistry />);

    await waitFor(() => expect(catalogCalls().length).toBeGreaterThan(0));

    const firstCatalog = catalogCalls()[0];
    expect(firstCatalog.company_id).toBeUndefined();
    expect(firstCatalog.incomplete).toBe(1);
  });

  it("URL company vince su Patrimonio header al primo fetch", async () => {
    scopeState.companyId = "studio";
    scopeState.isStudioPatrimonio = true;
    scopeState.isStudioWide = false;
    render(<DocumentRegistry />);

    await waitFor(() => expect(catalogCalls().length).toBeGreaterThan(0));

    const firstCatalog = catalogCalls()[0];
    expect(String(firstCatalog.company_id)).toBe("11");
    expect(firstCatalog.content_scope).toBeUndefined();
    expect(firstCatalog.incomplete).toBe(1);
  });
});

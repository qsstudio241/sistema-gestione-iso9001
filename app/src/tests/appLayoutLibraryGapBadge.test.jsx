/**
 * @vitest-environment jsdom
 *
 * LUX-B — badge gap piattaforma sulla voce menu Libreria (solo superadmin).
 */
import React from "react";
import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import apiService from "../services/apiService";
import AppLayout from "../layouts/AppLayout.jsx";

const authState = {
  user: {
    id: 1,
    role: "superadmin",
    organization_id: 1001,
    organization_name: "Al.project",
    licensed_modules: [],
    company_access: [],
  },
};

vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({
    user: authState.user,
    logout: () => {},
  }),
}));

vi.mock("../contexts/RouterContext", () => ({
  NavLink: ({ children, to }) => <a href={to}>{children}</a>,
  useRouter: () => ({ path: "/" }),
  useNavigate: () => () => {},
}));

vi.mock("../services/apiService", () => ({
  default: {
    getToken: () => "test-token",
    getOrganizationLogoUrl: () => "https://example.test/logo.png",
    getAlertCount: () => Promise.resolve({ total: 0 }),
    getComplaintsStats: () => Promise.resolve({ data: {} }),
    getCompanies: () => Promise.resolve({ data: [] }),
    getLibraryPlatformGapCount: vi.fn(() => Promise.resolve({ count: 0 })),
  },
}));

beforeAll(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: false,
      blob: async () => new Blob(),
    })
  );
});

afterAll(() => {
  vi.unstubAllGlobals();
});

beforeEach(() => {
  vi.mocked(apiService.getLibraryPlatformGapCount).mockReset();
  authState.user = {
    id: 1,
    role: "superadmin",
    organization_id: 1001,
    organization_name: "Al.project",
    licensed_modules: [],
    company_access: [],
  };
});

function renderLayout() {
  return render(
    <AppLayout>
      <div>pagina</div>
    </AppLayout>
  );
}

function libreriaLink() {
  return screen.getByRole("link", { name: /Libreria/i });
}

describe("AppLayout — badge gap Libreria (LUX-B)", () => {
  it("superadmin con N>0 vede badge numerico sulla voce Libreria", async () => {
    vi.mocked(apiService.getLibraryPlatformGapCount).mockResolvedValue({ count: 3 });
    renderLayout();
    await waitFor(() => {
      expect(apiService.getLibraryPlatformGapCount).toHaveBeenCalled();
    });
    const link = libreriaLink();
    const badge = within(link).getByText("3");
    expect(badge).toHaveClass("sidebar-badge");
  });

  it("superadmin con N=0 non mostra badge su Libreria", async () => {
    vi.mocked(apiService.getLibraryPlatformGapCount).mockResolvedValue({ count: 0 });
    renderLayout();
    await waitFor(() => {
      expect(apiService.getLibraryPlatformGapCount).toHaveBeenCalled();
    });
    const link = libreriaLink();
    expect(link.querySelector(".sidebar-badge")).toBeNull();
  });

  it("admin non-superadmin non chiama count e non ha badge gap", async () => {
    authState.user = {
      ...authState.user,
      role: "admin",
    };
    vi.mocked(apiService.getLibraryPlatformGapCount).mockResolvedValue({ count: 9 });
    renderLayout();
    await waitFor(() => {
      expect(screen.getByRole("link", { name: /Libreria/i })).toBeInTheDocument();
    });
    // Poll loadAlerts gira; per admin non deve invocare l'endpoint SA
    await waitFor(() => {
      expect(apiService.getLibraryPlatformGapCount).not.toHaveBeenCalled();
    });
    expect(libreriaLink().querySelector(".sidebar-badge")).toBeNull();
  });

  it("cap 99+ come gli altri badge sidebar", async () => {
    vi.mocked(apiService.getLibraryPlatformGapCount).mockResolvedValue({ count: 120 });
    renderLayout();
    await waitFor(() => {
      expect(within(libreriaLink()).getByText("99+")).toBeInTheDocument();
    });
  });
});

/**
 * @vitest-environment jsdom
 *
 * Badge sidebar da GET /alerts/count: Documenti = solo `documents`, Qualifiche = `qualifications`.
 * Regressione PROD: `total` (qualifiche 44, documenti 0) compariva sulla voce Documenti.
 */
import React from "react";
import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import apiService from "../services/apiService";
import AppLayout from "../layouts/AppLayout.jsx";

vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({
    user: {
      id: 1,
      role: "admin",
      organization_id: 1001,
      organization_name: "Studio",
      licensed_modules: [],
      company_access: [],
    },
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
    getAlertCount: vi.fn(),
    getComplaintsStats: () => Promise.resolve({ data: {} }),
    getCompanies: () => Promise.resolve({ data: [] }),
    getLibraryPlatformGapCount: () => Promise.resolve({ count: 0 }),
  },
}));

beforeAll(() => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, blob: async () => new Blob() }));
});

afterAll(() => {
  vi.unstubAllGlobals();
});

beforeEach(() => {
  vi.mocked(apiService.getAlertCount).mockReset();
});

async function renderWithAlerts(payload) {
  vi.mocked(apiService.getAlertCount).mockResolvedValue(payload);
  render(
    <AppLayout>
      <div>pagina</div>
    </AppLayout>
  );
  await waitFor(() => expect(apiService.getAlertCount).toHaveBeenCalled());
  await new Promise((r) => setTimeout(r, 0));
}

const documentiLink = () => screen.getByRole("link", { name: /Documenti/i });
const qualificheLink = () => screen.getByRole("link", { name: /Qualifiche/i });

describe("AppLayout — badge da /alerts/count", () => {
  it("documents 0 e qualifications 44 (total 44): Documenti senza badge, Qualifiche 44", async () => {
    await renderWithAlerts({ total: 44, documents: 0, nc: 0, qualifications: 44 });
    await waitFor(() => {
      expect(within(qualificheLink()).getByText("44")).toHaveClass("sidebar-badge");
    });
    expect(documentiLink().querySelector(".sidebar-badge")).toBeNull();
    expect(within(documentiLink()).queryByText("44")).toBeNull();
  });

  it("documents 3: badge Documenti = 3", async () => {
    await renderWithAlerts({ total: 3, documents: 3, nc: 0, qualifications: 0 });
    await waitFor(() => {
      expect(within(documentiLink()).getByText("3")).toHaveClass("sidebar-badge");
    });
    expect(qualificheLink().querySelector(".sidebar-badge")).toBeNull();
  });

  it("payload senza documents/qualifications (solo total): nessun badge e nessun crash", async () => {
    await renderWithAlerts({ total: 44 });
    expect(documentiLink().querySelector(".sidebar-badge")).toBeNull();
    expect(qualificheLink().querySelector(".sidebar-badge")).toBeNull();
    expect(screen.queryByText("44")).toBeNull();
  });

  it("payload vuoto o null: nessun crash, nessun badge", async () => {
    await renderWithAlerts(null);
    expect(documentiLink().querySelector(".sidebar-badge")).toBeNull();
    expect(qualificheLink().querySelector(".sidebar-badge")).toBeNull();
  });
});

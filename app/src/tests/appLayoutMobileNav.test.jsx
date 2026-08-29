/**
 * @vitest-environment jsdom
 *
 * Su mobile la sidebar era display:none: Gestione → Libreria irraggiungibile.
 * Hamburger apre il drawer con tutte le voci (incluso /settings/libreria).
 */
import React from "react";
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import AppLayout from "../layouts/AppLayout.jsx";

vi.mock("../contexts/AuthContext", () => {
  const user = {
    id: 1,
    role: "admin",
    organization_id: 1001,
    organization_name: "Al.project",
    licensed_modules: [],
    company_access: [],
  };
  return {
    useAuth: () => ({
      user,
      logout: () => {},
    }),
  };
});

vi.mock("../contexts/RouterContext", () => ({
  NavLink: ({ children, to, onClick }) => (
    <a href={to} onClick={onClick}>
      {children}
    </a>
  ),
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

describe("AppLayout — menu mobile Gestione", () => {
  it("hamburger apre il drawer con Gestione → Libreria", async () => {
    render(
      <AppLayout>
        <div>pagina</div>
      </AppLayout>
    );

    const openBtn = screen.getByRole("button", { name: "Apri menu" });
    expect(openBtn).toBeTruthy();

    const sidebar = document.getElementById("app-sidebar");
    expect(sidebar).toBeTruthy();
    expect(sidebar.classList.contains("sidebar-mobile-open")).toBe(false);

    fireEvent.click(openBtn);
    expect(sidebar.classList.contains("sidebar-mobile-open")).toBe(true);
    expect(document.querySelector('a[href="/settings/libreria"]')).toBeTruthy();
    expect(screen.getByText("Libreria")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Chiudi menu" }));
    expect(sidebar.classList.contains("sidebar-mobile-open")).toBe(false);
  });
});

/**
 * @vitest-environment jsdom
 *
 * Il banner sotto l'header deve essere solo Ambito + menu.
 * Non nome studio, non logo, non P.IVA. Il menu resta visibile anche
 * se getCompanies non ha ancora risposto (lista vuota).
 */
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import AppLayout from "../layouts/AppLayout.jsx";

vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({
    user: {
      id: 1,
      role: "admin",
      organization_id: 1001,
      organization_name: "Al.project",
      organization_vat_number: "125852",
      organization_logo_url: "https://example.test/logo.png",
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

const companiesPayload = { data: [] };

vi.mock("../services/apiService", () => ({
  default: {
    getToken: () => "test-token",
    getOrganizationLogoUrl: () => "https://example.test/logo.png",
    getAlertCount: () => Promise.resolve({ total: 0 }),
    getComplaintsStats: () => Promise.resolve({ data: {} }),
    getCompanies: () => Promise.resolve(companiesPayload),
  },
}));

describe("AppLayout — banner Ambito", () => {
  it("nel banner c'e' solo Ambito + tendina, senza nome/P.IVA dello studio", async () => {
    companiesPayload.data = [];
    render(
      <AppLayout>
        <div>pagina</div>
      </AppLayout>
    );

    const banner = await screen.findByRole("region", { name: "Ambito azienda" });
    expect(within(banner).getByText("Ambito")).toBeInTheDocument();
    expect(within(banner).getByRole("combobox", { name: "Ambito azienda" })).toBeInTheDocument();
    expect(within(banner).queryByText("Al.project")).not.toBeInTheDocument();
    expect(within(banner).queryByText(/P\.IVA/)).not.toBeInTheDocument();
    expect(banner.querySelector("img")).toBeNull();
    expect(within(banner).getByRole("option", { name: "Patrimonio dello studio" })).toBeInTheDocument();
  });

  it("con azienda-studio in anagrafica il menu mostra Patrimonio, non il nome tenant", async () => {
    companiesPayload.data = [
      { id: 1, name: "Al.project" },
      { id: 2, name: "ADA Azienda Test Fase 1" },
    ];
    render(
      <AppLayout>
        <div>pagina</div>
      </AppLayout>
    );

    const banner = await screen.findByRole("region", { name: "Ambito azienda" });
    const select = within(banner).getByRole("combobox", { name: "Ambito azienda" });
    expect(await within(select).findByRole("option", { name: "Patrimonio dello studio" })).toBeInTheDocument();
    expect(within(select).getByRole("option", { name: "Tutto lo studio" })).toBeInTheDocument();
    expect(within(select).queryByRole("option", { name: "Al.project" })).not.toBeInTheDocument();
    expect(within(banner).queryByText(/P\.IVA/)).not.toBeInTheDocument();
  });
});

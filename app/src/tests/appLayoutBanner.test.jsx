/**
 * @vitest-environment jsdom
 *
 * Il banner sotto l'header deve essere solo Ambito + menu.
 * Non nome studio, non logo, non P.IVA. Il menu resta visibile anche
 * se getCompanies non ha ancora risposto (lista vuota).
 */
import React from "react";
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import AppLayout from "../layouts/AppLayout.jsx";

vi.mock("../contexts/AuthContext", () => {
  const user = {
    id: 1,
    role: "admin",
    organization_id: 1001,
    organization_name: "Al.project",
    organization_vat_number: "125852",
    organization_logo_url: "https://example.test/logo.png",
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

function openBannerMenu(banner) {
  const combo = within(banner).getByRole("combobox", { name: "Ambito azienda" });
  act(() => {
    fireEvent.focus(combo);
  });
  return combo;
}

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
    openBannerMenu(banner);
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
    openBannerMenu(banner);
    const listbox = within(banner).getByRole("listbox");
    expect(await within(listbox).findByRole("option", { name: "ADA Azienda Test Fase 1" })).toBeInTheDocument();
    expect(within(listbox).getByRole("option", { name: "Patrimonio dello studio" })).toHaveAttribute(
      "data-value",
      "studio"
    );
    expect(within(listbox).getByRole("option", { name: "Tutto lo studio" })).toBeInTheDocument();
    expect(within(listbox).queryByRole("option", { name: "Al.project" })).not.toBeInTheDocument();
    expect(within(banner).queryByText(/P\.IVA/)).not.toBeInTheDocument();
  });

  it("non mostra Saldatura RDP Rapporto di Prova (menu spento 19/08)", async () => {
    companiesPayload.data = [];
    render(
      <AppLayout>
        <div>pagina</div>
      </AppLayout>
    );
    await screen.findByRole("region", { name: "Ambito azienda" });
    expect(screen.queryByText(/RDP - Rapporto di Prova/)).not.toBeInTheDocument();
    expect(document.querySelector('a[href="/saldatura/rdp"]')).toBeNull();
    expect(screen.getByText("Welding Book")).toBeInTheDocument();
    expect(screen.getAllByText("Audit").length).toBeGreaterThan(0);
  });
});

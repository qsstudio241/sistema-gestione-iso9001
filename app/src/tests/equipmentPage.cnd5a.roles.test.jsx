/**
 * @vitest-environment jsdom
 * CND-5a: ruoli strumento non-VT (giogo/sonda/kit PT) selezionabili in anagrafica.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const scopeState = {
  companyId: "48",
  setCompanyId: () => {},
  companies: [{ id: 48, name: "Smoke Ingest Test SRL" }],
  reloadCompanies: vi.fn(),
  locked: false,
  companyScoped: false,
  isStudioWide: false,
  scopeCompanyName: "Smoke Ingest Test SRL",
};

vi.mock("../contexts/CompanyScopeContext", () => ({
  useCompanyScope: () => scopeState,
}));

vi.mock("../services/apiService", () => ({
  default: {
    getEquipmentList: vi.fn().mockResolvedValue({
      data: [
        {
          id: 1,
          name: "Giogo MT-01",
          asset_category: "measuring_instrument",
          asset_subcategory: "yoke",
          serial_number: "Y-1",
          company_name: null,
          applicable_methods: '["MT"]',
          requires_calibration: true,
          status: "active",
          days_to_expiry: 90,
        },
      ],
    }),
    getEquipmentStats: vi.fn().mockResolvedValue({
      data: { total: 1, active: 1, expiring_30d: 0, expired: 0, calibrating: 0 },
    }),
    createEquipment: vi.fn(),
    updateEquipment: vi.fn(),
    deleteEquipment: vi.fn(),
  },
}));

import EquipmentPage from "../pages/EquipmentPage.jsx";
import {
  NDT_INSTRUMENT_ROLE_OPTIONS,
  labelForInstrumentRole,
} from "../utils/ndtInstrumentRoles.js";

describe("ndtInstrumentRoles (CND-5a)", () => {
  it("espone ruoli VT e non-VT con etichette italiane", () => {
    const values = NDT_INSTRUMENT_ROLE_OPTIONS.map((o) => o.value);
    expect(values).toEqual(
      expect.arrayContaining(["gauge", "luxmeter", "lamp", "yoke", "probe", "pt_kit", "other"])
    );
    expect(labelForInstrumentRole("yoke")).toBe("Giogo");
    expect(labelForInstrumentRole("probe")).toBe("Sonda");
    expect(labelForInstrumentRole("pt_kit")).toBe("Kit PT");
  });
});

describe("EquipmentPage — ruoli non-VT (CND-5a)", () => {
  beforeEach(() => {
    scopeState.companies = [{ id: 48, name: "Smoke Ingest Test SRL" }];
  });

  it("nel form Nuovo strumento elenca Giogo, Sonda e Kit PT", async () => {
    const user = userEvent.setup();
    render(<EquipmentPage />);

    await user.click(await screen.findByRole("button", { name: "+ Nuovo strumento" }));
    expect(screen.getByRole("heading", { name: "Nuovo strumento" })).toBeInTheDocument();

    const roleSelect = screen.getByRole("combobox", { name: "Ruolo strumento" });
    const options = within(roleSelect).getAllByRole("option").map((o) => o.textContent);
    expect(options).toEqual(
      expect.arrayContaining(["Calibro", "Luxmetro", "Lampada", "Giogo", "Sonda", "Kit PT", "Altro"])
    );
  });

  it("in lista mostra etichetta ruolo non-VT sotto il nome", async () => {
    render(<EquipmentPage />);
    expect(await screen.findByText("Giogo MT-01")).toBeInTheDocument();
    expect(screen.getByText("Giogo")).toBeInTheDocument();
  });
});

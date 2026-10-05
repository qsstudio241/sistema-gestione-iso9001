/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import CoverageVerifyPanel, { visibleFieldsForDomain } from "../components/CoverageVerifyPanel";

vi.mock("../services/apiService", () => ({
  default: {
    getCoverageDomains: vi.fn(),
    verifyCoverageRequirement: vi.fn(),
  },
}));

import apiService from "../services/apiService";

const DOMAINS = [
  {
    domain: "welder_9606",
    label: "Qualifiche saldatori (ISO 9606)",
    implemented: true,
    requirementFields: [
      { key: "welding_process", label: "Processo", type: "text" },
      { key: "joint_type", label: "Tipo giunto", type: "select", options: [{ value: "BW", label: "BW" }] },
      { key: "thickness_min_mm", label: "Spessore min", type: "number" },
    ],
  },
  {
    domain: "wpqr_procedure",
    label: "Processi / WPQR",
    implemented: false,
    requirementFields: [
      { key: "welding_process", label: "Processo", type: "text" },
      { key: "material_group", label: "Gruppo materiale", type: "text" },
    ],
  },
  {
    domain: "cnd_9712",
    label: "Personale CND",
    implemented: true,
    maturity: "minimal",
    requirementFields: [
      { key: "ndt_method", label: "Metodo NDT", type: "select", options: [{ value: "UT", label: "UT" }] },
      { key: "ndt_level", label: "Livello", type: "select", options: [{ value: "2", label: "2" }] },
    ],
  },
];

describe("visibleFieldsForDomain", () => {
  it("restituisce i campi del dominio scelto", () => {
    expect(visibleFieldsForDomain(DOMAINS, "welder_9606").map((f) => f.key)).toEqual([
      "welding_process",
      "joint_type",
      "thickness_min_mm",
    ]);
    expect(visibleFieldsForDomain(DOMAINS, "cnd_9712").map((f) => f.key)).toEqual([
      "ndt_method",
      "ndt_level",
    ]);
  });
});

describe("CoverageVerifyPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiService.getCoverageDomains.mockResolvedValue({ domains: DOMAINS });
    apiService.verifyCoverageRequirement.mockResolvedValue({
      domain: "welder_9606",
      implemented: true,
      summary: { match: 1, partial: 0, no_match: 0, not_implemented: 0 },
      matches: [{
        status: "match",
        capability_id: 1,
        capability: { person_name: "Rossi" },
        reasons: [],
      }],
    });
  });

  it("mostra/nasconde campi al cambio dominio", async () => {
    render(<CoverageVerifyPanel companyId={10} companyName="ADA" />);
    fireEvent.click(screen.getByRole("button", { name: /Verifica copertura/i }));

    await waitFor(() => {
      expect(screen.getByTestId("cov-field-welding_process")).toBeTruthy();
    });
    expect(screen.getByTestId("cov-field-joint_type")).toBeTruthy();
    expect(screen.queryByTestId("cov-field-ndt_method")).toBeNull();

    fireEvent.change(screen.getByTestId("cov-domain"), { target: { value: "cnd_9712" } });

    await waitFor(() => {
      expect(screen.getByTestId("cov-field-ndt_method")).toBeTruthy();
    });
    expect(screen.getByTestId("cov-field-ndt_level")).toBeTruthy();
    expect(screen.queryByTestId("cov-field-joint_type")).toBeNull();
  });

  it("il pulsante Verifica resta visibile anche senza ambito (gated title)", async () => {
    render(<CoverageVerifyPanel companyId={null} />);
    fireEvent.click(screen.getByRole("button", { name: /Verifica copertura/i }));
    await waitFor(() => expect(screen.getByTestId("cov-verify")).toBeTruthy());
    const btn = screen.getByTestId("cov-verify");
    expect(btn).toBeTruthy();
    expect(btn.disabled).toBe(false);
  });
});

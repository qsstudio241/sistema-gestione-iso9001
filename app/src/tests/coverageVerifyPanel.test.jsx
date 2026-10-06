/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import CoverageVerifyPanel, {
  COVERAGE_STATUS_LABEL,
  filterCoverageDomains,
  visibleFieldsForDomain,
} from "../components/CoverageVerifyPanel";

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
    implemented: true,
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

  it("mostra il messaggio del motore quando non ci sono WPQR", async () => {
    apiService.verifyCoverageRequirement.mockResolvedValue({
      domain: "wpqr_procedure",
      implemented: true,
      summary: { total: 0, match: 0, partial: 0, no_match: 0, not_implemented: 0 },
      matches: [],
      message: "Nessuna WPQR registrata per l'ambito selezionato",
    });
    render(<CoverageVerifyPanel companyId={10} companyName="ADA" />);
    fireEvent.click(screen.getByRole("button", { name: /Verifica copertura/i }));
    await waitFor(() => expect(screen.getByTestId("cov-domain")).toBeTruthy());
    fireEvent.change(screen.getByTestId("cov-domain"), { target: { value: "wpqr_procedure" } });
    fireEvent.click(screen.getByTestId("cov-verify"));
    await waitFor(() => expect(screen.getByTestId("cov-message")).toBeTruthy());
    expect(screen.getByTestId("cov-message").textContent).toMatch(/Nessuna WPQR/);
    expect(screen.queryByText(/match completo in una fetta successiva/)).toBeNull();
  });
});

describe("filterCoverageDomains / COVERAGE_STATUS_LABEL", () => {
  it("senza whitelist restituisce tutti i domini", () => {
    expect(filterCoverageDomains(DOMAINS, undefined)).toHaveLength(3);
    expect(filterCoverageDomains(DOMAINS, [])).toHaveLength(3);
    expect(filterCoverageDomains(null, ["cnd_9712"])).toEqual([]);
  });

  it("con whitelist tiene solo le chiavi ammesse", () => {
    expect(filterCoverageDomains(DOMAINS, ["cnd_9712"]).map((d) => d.domain)).toEqual(["cnd_9712"]);
  });

  it("esporta le etichette di stato in italiano", () => {
    expect(COVERAGE_STATUS_LABEL.match.label).toBe("Coperto");
    expect(COVERAGE_STATUS_LABEL.partial.label).toBe("Parziale");
    expect(COVERAGE_STATUS_LABEL.no_match.label).toBe("Non coperto");
  });
});

describe("CoverageVerifyPanel — allowedDomains / defaultDomain / embedded", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiService.getCoverageDomains.mockResolvedValue({ domains: DOMAINS });
    apiService.verifyCoverageRequirement.mockResolvedValue({
      domain: "cnd_9712",
      implemented: true,
      summary: { match: 0, partial: 0, no_match: 0, not_implemented: 0 },
      matches: [],
    });
  });

  it("allowedDomains limita la tendina ai domini ammessi", async () => {
    render(<CoverageVerifyPanel allowedDomains={["cnd_9712", "wpqr_procedure"]} defaultDomain="cnd_9712" />);
    fireEvent.click(screen.getByRole("button", { name: /Verifica copertura/i }));
    await waitFor(() => expect(screen.getByTestId("cov-field-ndt_method")).toBeTruthy());
    const values = [...screen.getByTestId("cov-domain").options].map((o) => o.value);
    expect(values).toEqual(["wpqr_procedure", "cnd_9712"]);
    expect(screen.getByTestId("cov-domain").value).toBe("cnd_9712");
  });

  it("se il dominio di default non è ammesso passa al primo ammesso", async () => {
    render(<CoverageVerifyPanel allowedDomains={["cnd_9712"]} />);
    fireEvent.click(screen.getByRole("button", { name: /Verifica copertura/i }));
    await waitFor(() => expect(screen.getByTestId("cov-field-ndt_method")).toBeTruthy());
    expect(screen.getByTestId("cov-domain").value).toBe("cnd_9712");
  });

  it("defaultDomain seleziona il dominio iniziale", async () => {
    render(<CoverageVerifyPanel defaultDomain="wpqr_procedure" />);
    fireEvent.click(screen.getByRole("button", { name: /Verifica copertura/i }));
    await waitFor(() => expect(screen.getByTestId("cov-field-material_group")).toBeTruthy());
    expect(screen.getByTestId("cov-domain").value).toBe("wpqr_procedure");
  });

  it("embedded: corpo sempre visibile, nessun toggle, domini caricati subito", async () => {
    render(<CoverageVerifyPanel embedded allowedDomains={["cnd_9712"]} defaultDomain="cnd_9712" companyId={10} companyName="ADA" />);
    expect(screen.queryByRole("button", { name: /Verifica copertura/i })).toBeNull();
    await waitFor(() => expect(screen.getByTestId("cov-field-ndt_method")).toBeTruthy());
    expect(apiService.getCoverageDomains).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("cov-verify").disabled).toBe(false);

    fireEvent.click(screen.getByTestId("cov-verify"));
    await waitFor(() => expect(apiService.verifyCoverageRequirement).toHaveBeenCalledWith({
      domain: "cnd_9712", company_id: 10, criteria: {},
    }));
  });
});

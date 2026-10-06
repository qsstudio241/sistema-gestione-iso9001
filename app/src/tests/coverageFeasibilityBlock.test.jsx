/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import CoverageFeasibilityBlock from "../components/CoverageFeasibilityBlock";

vi.mock("../services/apiService", () => ({
  default: {
    getCoverageDomains: vi.fn(),
    verifyCoverageRequirement: vi.fn(),
  },
}));

import apiService from "../services/apiService";

const DOMAINS = [
  { domain: "welder_9606", label: "Qualifiche saldatori (ISO 9606)", implemented: true, requirementFields: [] },
  {
    domain: "wpqr_procedure",
    label: "Processi / WPQR",
    implemented: true,
    requirementFields: [{ key: "welding_process", label: "Processo", type: "text" }],
  },
  {
    domain: "cnd_9712",
    label: "Personale CND",
    implemented: true,
    maturity: "minimal",
    requirementFields: [
      { key: "ndt_method", label: "Metodo NDT", type: "select", options: [{ value: "UT", label: "UT" }] },
    ],
  },
  { domain: "future_domain", label: "Dominio futuro", implemented: false, requirementFields: [] },
];

const ROWS = [
  {
    wps_id: 1, wps_code: "WPS-001", welding_process: "135", material_group: "1.1",
    thickness_range_min: 3, thickness_range_max: 12, esito: "verde",
  },
  {
    wps_id: 2, wps_code: "WPS-002", welding_process: "141", material_group: null,
    thickness_range_min: "6", thickness_range_max: "6", esito: "rosso",
  },
];
const SUMMARY = { total: 2, covered: 1, partial: 0, uncovered: 1 };

function verifyResponse(status, reasons, extra = {}) {
  return {
    domain: "wpqr_procedure",
    implemented: true,
    summary: { total: 1 },
    matches: [{
      status,
      capability_id: 5,
      capability: { wpqr_code: "WPQR-77" },
      reasons,
    }],
    ...extra,
  };
}

async function openBlock() {
  fireEvent.click(screen.getByRole("button", { name: /Fattibilità multi-dominio/ }));
  await waitFor(() => expect(apiService.getCoverageDomains).toHaveBeenCalled());
}

describe("CoverageFeasibilityBlock", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiService.getCoverageDomains.mockResolvedValue({ domains: DOMAINS });
    apiService.verifyCoverageRequirement.mockResolvedValue(verifyResponse("match", ["Requisito coperto"]));
  });

  it("mostra solo le sezioni dei domini implementati e carica i domini al primo expand", async () => {
    render(<CoverageFeasibilityBlock rows={ROWS} welderSummary={SUMMARY} companyId={10} companyName="ADA" />);
    expect(apiService.getCoverageDomains).not.toHaveBeenCalled();
    await openBlock();

    await waitFor(() => expect(screen.getByTestId("cov-procedures")).toBeTruthy());
    expect(screen.getByTestId("cov-cnd")).toBeTruthy();
    expect(screen.getByTestId("cov-welders")).toBeTruthy();
    expect(screen.queryByText(/Dominio futuro/)).toBeNull();
    expect(screen.getAllByText(/Ambito:/)[0].textContent).toMatch(/ADA/);
  });

  it("non mostra WPQR e CND se il dominio non è nel registry o non implementato", async () => {
    apiService.getCoverageDomains.mockResolvedValue({
      domains: [
        { domain: "wpqr_procedure", implemented: false, requirementFields: [] },
        { domain: "welder_9606", implemented: true, requirementFields: [] },
      ],
    });
    render(<CoverageFeasibilityBlock rows={ROWS} welderSummary={SUMMARY} companyId={10} />);
    await openBlock();
    await waitFor(() => expect(screen.getByTestId("cov-welders")).toBeTruthy());
    expect(screen.queryByTestId("cov-procedures")).toBeNull();
    expect(screen.queryByTestId("cov-cnd")).toBeNull();
  });

  it("se getCoverageDomains fallisce mostra un alert e lascia il riepilogo saldatori", async () => {
    apiService.getCoverageDomains.mockRejectedValue(new Error("Rete non disponibile"));
    render(<CoverageFeasibilityBlock rows={ROWS} welderSummary={SUMMARY} companyId={10} />);
    await openBlock();
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/Rete non disponibile/);
    expect(screen.queryByTestId("cov-procedures")).toBeNull();
    expect(screen.queryByTestId("cov-cnd")).toBeNull();
    expect(screen.getByTestId("cov-welders").textContent).toMatch(/1 coperte/);
  });

  it("riga saldatori letta da welderSummary, senza alcuna verify welder_9606", async () => {
    render(<CoverageFeasibilityBlock rows={ROWS} welderSummary={{ total: 5, covered: 2, partial: 1, uncovered: 2 }} />);
    await openBlock();
    const welders = await screen.findByTestId("cov-welders");
    expect(welders.textContent).toMatch(/2 coperte/);
    expect(welders.textContent).toMatch(/1 parziali/);
    expect(welders.textContent).toMatch(/2 non coperte su 5 WPS/);
    expect(welders.textContent).toMatch(/non ricalcolato qui/);

    await screen.findByTestId("cov-procedures");
    fireEvent.click(screen.getByTestId("cov-verify-procedures"));
    await waitFor(() => expect(apiService.verifyCoverageRequirement).toHaveBeenCalledTimes(2));
    const domainsCalled = apiService.verifyCoverageRequirement.mock.calls.map((c) => c[0].domain);
    expect(domainsCalled.every((d) => d === "wpqr_procedure")).toBe(true);
    expect(domainsCalled).not.toContain("welder_9606");
  });

  it("una verify wpqr_procedure per WPS con company_id e criteri attesi", async () => {
    render(<CoverageFeasibilityBlock rows={ROWS} welderSummary={SUMMARY} companyId={10} />);
    await openBlock();
    await screen.findByTestId("cov-procedures");
    expect(within(screen.getByTestId("cov-wps-1")).getByText(/Spessore 3–12 mm/)).toBeTruthy();

    fireEvent.click(screen.getByTestId("cov-verify-procedures"));
    await waitFor(() => expect(apiService.verifyCoverageRequirement).toHaveBeenCalledTimes(2));

    expect(apiService.verifyCoverageRequirement).toHaveBeenCalledWith({
      domain: "wpqr_procedure",
      company_id: 10,
      criteria: { welding_process: "135", thickness_mm: 3, thickness_b_mm: 12, material_group: "1.1" },
    });
    expect(apiService.verifyCoverageRequirement).toHaveBeenCalledWith({
      domain: "wpqr_procedure",
      company_id: 10,
      criteria: { welding_process: "141", thickness_mm: 6 },
    });
  });

  it("mostra badge Coperto/Parziale/Non coperto, WPQR migliore e motivi verbatim", async () => {
    const rows = [
      { wps_id: 1, wps_code: "WPS-A", welding_process: "135" },
      { wps_id: 2, wps_code: "WPS-B", welding_process: "136" },
      { wps_id: 3, wps_code: "WPS-C", welding_process: "141" },
    ];
    apiService.verifyCoverageRequirement.mockImplementation(async ({ criteria }) => {
      if (criteria.welding_process === "135") return verifyResponse("match", ["Requisito coperto dalla WPQR WPQR-77 (ISO 15614-1)"]);
      if (criteria.welding_process === "136") return verifyResponse("partial", ["Spessore: verifica manuale sul verbale", "Materiale non indicato"]);
      return verifyResponse("no_match", ["Processo non coperto: WPQR 111"]);
    });
    render(<CoverageFeasibilityBlock rows={rows} welderSummary={SUMMARY} companyId={10} />);
    await openBlock();
    await screen.findByTestId("cov-procedures");
    fireEvent.click(screen.getByTestId("cov-verify-procedures"));

    await waitFor(() => expect(within(screen.getByTestId("cov-wps-3")).getByText("Non coperto")).toBeTruthy());
    expect(within(screen.getByTestId("cov-wps-1")).getByText("Coperto")).toBeTruthy();
    expect(within(screen.getByTestId("cov-wps-2")).getByText("Parziale")).toBeTruthy();
    expect(within(screen.getByTestId("cov-wps-1")).getByText(/^WPQR-77/)).toBeTruthy();
    expect(within(screen.getByTestId("cov-wps-1")).getByText(/1 valutate/)).toBeTruthy();
    expect(within(screen.getByTestId("cov-wps-1")).getByText("Requisito coperto dalla WPQR WPQR-77 (ISO 15614-1)")).toBeTruthy();
    expect(within(screen.getByTestId("cov-wps-2")).getByText("Spessore: verifica manuale sul verbale; Materiale non indicato")).toBeTruthy();
    expect(within(screen.getByTestId("cov-wps-3")).getByText("Processo non coperto: WPQR 111")).toBeTruthy();
  });

  it("sceglie la WPQR migliore tra più capacità (match > partial > no_match)", async () => {
    apiService.verifyCoverageRequirement.mockResolvedValue({
      domain: "wpqr_procedure",
      matches: [
        { status: "no_match", capability_id: 1, capability: { wpqr_code: "WPQR-NO" }, reasons: ["x"] },
        { status: "match", capability_id: 2, capability: { wpqr_code: "WPQR-OK" }, reasons: ["ok"] },
        { status: "partial", capability_id: 3, capability: { wpqr_code: "WPQR-PA" }, reasons: ["p"] },
      ],
    });
    render(<CoverageFeasibilityBlock rows={[ROWS[0]]} welderSummary={SUMMARY} companyId={10} />);
    await openBlock();
    await screen.findByTestId("cov-procedures");
    fireEvent.click(screen.getByTestId("cov-verify-procedures"));
    const row = screen.getByTestId("cov-wps-1");
    await waitFor(() => expect(within(row).getByText("Coperto")).toBeTruthy());
    expect(within(row).getByText(/WPQR-OK/)).toBeTruthy();
    expect(within(row).getByText(/3 valutate/)).toBeTruthy();
  });

  it("non chiama mai verify con criteri vuoti: riga neutra «insufficienti»", async () => {
    const rows = [
      { wps_id: 9, wps_code: "WPS-VUOTA", welding_process: "", material_group: null, thickness_range_min: null, thickness_range_max: null },
      ROWS[0],
    ];
    render(<CoverageFeasibilityBlock rows={rows} welderSummary={SUMMARY} companyId={10} />);
    await openBlock();
    await screen.findByTestId("cov-procedures");
    fireEvent.click(screen.getByTestId("cov-verify-procedures"));

    await waitFor(() => expect(within(screen.getByTestId("cov-wps-9")).getByText("Requisiti WPS insufficienti per la verifica")).toBeTruthy());
    await waitFor(() => expect(apiService.verifyCoverageRequirement).toHaveBeenCalledTimes(1));
    for (const [arg] of apiService.verifyCoverageRequirement.mock.calls) {
      expect(Object.keys(arg.criteria).length).toBeGreaterThan(0);
    }
  });

  it("se tutte le WPS sono insufficienti non esegue nessuna chiamata", async () => {
    const rows = [{ wps_id: 1, wps_code: "WPS-VUOTA" }];
    render(<CoverageFeasibilityBlock rows={rows} welderSummary={SUMMARY} companyId={10} />);
    await openBlock();
    await screen.findByTestId("cov-procedures");
    fireEvent.click(screen.getByTestId("cov-verify-procedures"));
    await waitFor(() => expect(screen.getByText("Requisiti WPS insufficienti per la verifica")).toBeTruthy());
    expect(apiService.verifyCoverageRequirement).not.toHaveBeenCalled();
  });

  it("l'errore di una WPS non blocca le altre", async () => {
    apiService.verifyCoverageRequirement.mockImplementation(async ({ criteria }) => {
      if (criteria.welding_process === "141") throw new Error("Timeout server");
      return verifyResponse("match", ["Requisito coperto"]);
    });
    render(<CoverageFeasibilityBlock rows={ROWS} welderSummary={SUMMARY} companyId={10} />);
    await openBlock();
    await screen.findByTestId("cov-procedures");
    fireEvent.click(screen.getByTestId("cov-verify-procedures"));

    await waitFor(() => expect(within(screen.getByTestId("cov-wps-2")).getByText("Errore verifica")).toBeTruthy());
    expect(within(screen.getByTestId("cov-wps-2")).getByText("Timeout server")).toBeTruthy();
    expect(within(screen.getByTestId("cov-wps-1")).getByText("Coperto")).toBeTruthy();
  });

  it("mostra il messaggio del motore quando non ci sono WPQR", async () => {
    const msg = "Nessuna WPQR registrata per l'ambito selezionato: nulla da confrontare con il requisito.";
    apiService.verifyCoverageRequirement.mockResolvedValue({
      domain: "wpqr_procedure", matches: [], summary: { total: 0 }, message: msg,
    });
    render(<CoverageFeasibilityBlock rows={[ROWS[0]]} welderSummary={SUMMARY} companyId={10} />);
    await openBlock();
    await screen.findByTestId("cov-procedures");
    fireEvent.click(screen.getByTestId("cov-verify-procedures"));
    await waitFor(() => expect(within(screen.getByTestId("cov-wps-1")).getByText(msg)).toBeTruthy());
    expect(within(screen.getByTestId("cov-wps-1")).getByText("Nessuna WPQR")).toBeTruthy();
  });

  it("stato vuoto senza WPS: pulsante visibile, disabled con title, nessuna chiamata", async () => {
    render(<CoverageFeasibilityBlock rows={[]} welderSummary={{ total: 0, covered: 0, partial: 0, uncovered: 0 }} companyId={10} />);
    await openBlock();
    const btn = await screen.findByTestId("cov-verify-procedures");
    expect(btn.disabled).toBe(true);
    expect(btn.title).toBe("Nessuna WPS associata alla commessa: nessun requisito da verificare");
    expect(screen.getAllByText("Nessuna WPS associata alla commessa: nessun requisito da verificare").length).toBeGreaterThan(0);
    fireEvent.click(btn);
    expect(apiService.verifyCoverageRequirement).not.toHaveBeenCalled();
  });

  it("durante il calcolo il pulsante resta visibile, disabled con title e aria-busy", async () => {
    let resolveVerify;
    apiService.verifyCoverageRequirement.mockImplementation(
      () => new Promise((resolve) => { resolveVerify = resolve; })
    );
    const { container } = render(<CoverageFeasibilityBlock rows={[ROWS[0]]} welderSummary={SUMMARY} companyId={10} />);
    await openBlock();
    await screen.findByTestId("cov-procedures");
    fireEvent.click(screen.getByTestId("cov-verify-procedures"));

    const btn = await screen.findByRole("button", { name: /Calcolo/ });
    expect(btn.disabled).toBe(true);
    expect(btn.title).toBe("Calcolo in corso");
    expect(container.querySelector(".sq-cov-body").getAttribute("aria-busy")).toBe("true");

    resolveVerify(verifyResponse("match", ["ok"]));
    await waitFor(() => expect(screen.getByTestId("cov-verify-procedures").disabled).toBe(false));
    expect(screen.getByTestId("cov-verify-procedures").textContent).toBe("Verifica procedure");
  });

  it("tronca oltre 20 WPS con nota e verifica solo le prime 20", async () => {
    const many = Array.from({ length: 23 }, (_, i) => ({
      wps_id: i + 1, wps_code: `WPS-${i + 1}`, welding_process: "135", thickness_range_min: 3,
    }));
    render(<CoverageFeasibilityBlock rows={many} welderSummary={{ total: 23, covered: 0, partial: 0, uncovered: 23 }} companyId={10} />);
    await openBlock();
    await screen.findByTestId("cov-procedures");
    expect(screen.getByTestId("cov-truncated").textContent).toBe("Verificate le prime 20 WPS su 23");
    fireEvent.click(screen.getByTestId("cov-verify-procedures"));
    await waitFor(() => expect(apiService.verifyCoverageRequirement).toHaveBeenCalledTimes(20));
    await waitFor(() => expect(screen.getByTestId("cov-verify-procedures").disabled).toBe(false));
    expect(screen.queryByTestId("cov-wps-21")).toBeNull();
  });

  it("esegue le verify a batch da 4 in parallelo", async () => {
    const many = Array.from({ length: 9 }, (_, i) => ({
      wps_id: i + 1, wps_code: `WPS-${i + 1}`, welding_process: "135",
    }));
    let inFlight = 0;
    let maxInFlight = 0;
    apiService.verifyCoverageRequirement.mockImplementation(async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight -= 1;
      return verifyResponse("match", ["ok"]);
    });
    render(<CoverageFeasibilityBlock rows={many} welderSummary={SUMMARY} companyId={10} />);
    await openBlock();
    await screen.findByTestId("cov-procedures");
    fireEvent.click(screen.getByTestId("cov-verify-procedures"));
    await waitFor(() => expect(apiService.verifyCoverageRequirement).toHaveBeenCalledTimes(9));
    await waitFor(() => expect(screen.getByTestId("cov-verify-procedures").disabled).toBe(false));
    expect(maxInFlight).toBe(4);
  });

  it("azzera i risultati quando cambiano le righe", async () => {
    const { rerender } = render(<CoverageFeasibilityBlock rows={[ROWS[0]]} welderSummary={SUMMARY} companyId={10} />);
    await openBlock();
    await screen.findByTestId("cov-procedures");
    fireEvent.click(screen.getByTestId("cov-verify-procedures"));
    await waitFor(() => expect(within(screen.getByTestId("cov-wps-1")).getByText("Coperto")).toBeTruthy());

    rerender(<CoverageFeasibilityBlock rows={[ROWS[1]]} welderSummary={SUMMARY} companyId={10} />);
    await waitFor(() => expect(screen.getByTestId("cov-wps-2")).toBeTruthy());
    expect(within(screen.getByTestId("cov-wps-2")).getByText("Non verificato")).toBeTruthy();
    expect(screen.queryByText("Coperto")).toBeNull();
  });

  it("CND: pannello embedded limitato a cnd_9712 con ambito azienda e hint italiano", async () => {
    render(<CoverageFeasibilityBlock rows={ROWS} welderSummary={SUMMARY} companyId={10} companyName="ADA" />);
    await openBlock();
    const cnd = await screen.findByTestId("cov-cnd");
    expect(cnd.textContent).toMatch(/I requisiti CND non sono nei documenti\/WPS: inserirli a mano\./);
    await waitFor(() => expect(within(cnd).getByTestId("cov-field-ndt_method")).toBeTruthy());
    const select = within(cnd).getByTestId("cov-domain");
    expect([...select.options].map((o) => o.value)).toEqual(["cnd_9712"]);
    expect(within(cnd).queryByRole("button", { name: /Verifica copertura/ })).toBeNull();

    apiService.verifyCoverageRequirement.mockResolvedValue({
      domain: "cnd_9712", implemented: true, summary: { match: 0, partial: 0, no_match: 0 }, matches: [],
    });
    fireEvent.click(within(cnd).getByTestId("cov-verify"));
    await waitFor(() => expect(apiService.verifyCoverageRequirement).toHaveBeenCalledWith({
      domain: "cnd_9712", company_id: 10, criteria: {},
    }));
  });

  it("senza azienda l'ambito è tutta l'organizzazione e company_id è omesso", async () => {
    render(<CoverageFeasibilityBlock rows={[ROWS[0]]} welderSummary={SUMMARY} companyId={null} />);
    await openBlock();
    await screen.findByTestId("cov-procedures");
    expect(screen.getAllByText(/tutta l'organizzazione/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByTestId("cov-verify-procedures"));
    await waitFor(() => expect(apiService.verifyCoverageRequirement).toHaveBeenCalled());
    expect(apiService.verifyCoverageRequirement.mock.calls[0][0].company_id).toBeUndefined();
  });

  it("testi italiani con accenti corretti, senza escape o caratteri corrotti", async () => {
    const { container } = render(<CoverageFeasibilityBlock rows={ROWS} welderSummary={SUMMARY} companyId={10} />);
    expect(screen.getByRole("button", { name: /Fattibilità multi-dominio/ })).toBeTruthy();
    await openBlock();
    await screen.findByTestId("cov-cnd");
    const text = container.textContent;
    expect(text).not.toMatch(/\\u[0-9a-fA-F]{4}/);
    expect(text).not.toMatch(/\uFFFD|Ã|â€/);
    expect(text).toMatch(/capacità/);
  });
});

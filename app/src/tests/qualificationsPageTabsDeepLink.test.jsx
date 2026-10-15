/**
 * Test L1 — QualificationsPage: intestazioni coerenti con le celle per ogni tab
 * e deep link (?qualification_type, ?company_id, ?highlight&section).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import React from "react";
import { render, screen, waitFor, cleanup } from "@testing-library/react";

const scopeState = {
  companyId: "10",
  setCompanyId: vi.fn(),
  companies: [{ id: 10, name: "Mason Demo" }, { id: 11, name: "Altra Srl" }],
  reloadCompanies: vi.fn(),
  locked: false,
  companyScoped: false,
  isStudioWide: false,
  isStudioPatrimonio: false,
  scopeReady: true,
  scopeCompanyName: "Mason Demo",
};

vi.mock("../contexts/CompanyScopeContext", () => ({
  useCompanyScope: () => scopeState,
}));
vi.mock("../components/QualificationUploadButton", () => ({ default: () => null }));
vi.mock("../components/ReprocessQueueBanner", () => ({ default: () => null }));
vi.mock("../components/PendingIngestQueue", () => ({ default: () => null }));
vi.mock("../components/AskAiButton", () => ({ default: () => null }));
vi.mock("../components/CoverageVerifyPanel", () => ({ default: () => null }));
vi.mock("../pages/QualificationForm", () => ({
  default: ({ qualification, openSection }) => (
    <div data-testid="qual-form" data-id={qualification?.id} data-section={openSection || ""} />
  ),
}));

vi.mock("../services/apiService", () => ({
  default: {
    getQualifications: vi.fn(),
    getQualificationsStats: vi.fn(),
    getQualification: vi.fn(),
    getVisionFitnessGaps: vi.fn(),
    baseUrl: "https://example.test",
  },
}));

import apiService from "../services/apiService";
import QualificationsPage, { TAB_COLUMNS, parseDeepLink, QualRow } from "../pages/QualificationsPage";

beforeEach(() => {
  scopeState.companies = [{ id: 10, name: "Mason Demo" }, { id: 11, name: "Altra Srl" }];
  scopeState.setCompanyId.mockClear();
  scopeState.locked = false;
  apiService.getQualifications.mockResolvedValue({ qualifications: [], total: 0 });
  apiService.getQualificationsStats.mockResolvedValue({
    total: 0, valide: 0, in_scadenza_60: 0, in_scadenza_30: 0, scadute: 0, non_attive: 0,
  });
  apiService.getVisionFitnessGaps.mockResolvedValue(null);
  apiService.getQualification.mockReset();
});

afterEach(() => {
  cleanup();
  window.history.replaceState({}, "", "/");
});

describe("TAB_COLUMNS: una intestazione per ogni cella di QualRow", () => {
  const SAMPLE = {
    id: 1, person_name: "ZZ_Test", semaforo: "verde", qualification_type: "x",
    expiry_date: "2030-01-01",
  };
  for (const tabKey of Object.keys(TAB_COLUMNS)) {
    it(`tab ${tabKey}`, () => {
      const { container } = render(
        <table>
          <tbody>
            <QualRow
              q={SAMPLE}
              tabKey={tabKey}
              onEdit={() => {}}
              onHardDelete={() => {}}
              onRenew={() => {}}
              onHistory={() => {}}
              hardDeleteId={null}
              setHardDeleteId={() => {}}
            />
          </tbody>
        </table>
      );
      expect(container.querySelectorAll("tr > td").length).toBe(TAB_COLUMNS[tabKey].length);
    });
  }

  it("9606-2 espone la colonna Posizioni, salute mansione Riferimento", () => {
    expect(TAB_COLUMNS.iso9606_2).toContain("Posizioni");
    expect(TAB_COLUMNS.salute_mansione).toContain("Riferimento");
  });
});

describe("parseDeepLink", () => {
  it("accetta solo tab note, id numerici e sezioni sicure", () => {
    expect(parseDeepLink("?qualification_type=iso9606_1")).toMatchObject({ tab: "iso9606_1" });
    expect(parseDeepLink("?qualification_type=ndt&company_id=10&highlight=5&section=conferma"))
      .toEqual({ tab: "ndt", companyId: "10", highlightId: "5", section: "conferma" });
    expect(parseDeepLink("?qualification_type=zzz&company_id=abc&highlight=1;DROP&section=<x>"))
      .toEqual({ tab: "tutti", companyId: "", highlightId: "", section: "" });
    expect(parseDeepLink("?company_id=&highlight=")).toEqual({ tab: "tutti", companyId: "", highlightId: "", section: "" });
    expect(parseDeepLink("")).toMatchObject({ tab: "tutti" });
    expect(parseDeepLink("?company_id=99999999999999")).toMatchObject({ companyId: "" });
  });
});

describe("QualificationsPage: deep link", () => {
  it("qualification_type apre la tab corrispondente e filtra la lista", async () => {
    window.history.replaceState({}, "", "/qualifiche?qualification_type=iso9606_1");
    render(<QualificationsPage />);
    await waitFor(() => expect(apiService.getQualifications).toHaveBeenCalled());
    expect(apiService.getQualifications.mock.calls[0][0]).toMatchObject({ qualification_type: "iso9606_1" });
    expect(screen.getByRole("button", { name: "Saldatori 9606-1" }).className).toContain("sq-tab-active");
  });

  it("tab sconosciuta: ricade su Tutti senza errori", async () => {
    window.history.replaceState({}, "", "/qualifiche?qualification_type=zzz");
    render(<QualificationsPage />);
    await waitFor(() => expect(apiService.getQualifications).toHaveBeenCalled());
    expect(apiService.getQualifications.mock.calls[0][0].qualification_type).toBeUndefined();
  });

  it("company_id noto imposta l'Ambito; sconosciuto o utente bloccato no", async () => {
    window.history.replaceState({}, "", "/qualifiche?company_id=11");
    render(<QualificationsPage />);
    await waitFor(() => expect(scopeState.setCompanyId).toHaveBeenCalledWith("11"));
    cleanup();

    scopeState.setCompanyId.mockClear();
    window.history.replaceState({}, "", "/qualifiche?company_id=999");
    render(<QualificationsPage />);
    await waitFor(() => expect(apiService.getQualifications).toHaveBeenCalled());
    expect(scopeState.setCompanyId).not.toHaveBeenCalled();
    cleanup();

    scopeState.locked = true;
    window.history.replaceState({}, "", "/qualifiche?company_id=11");
    render(<QualificationsPage />);
    await waitFor(() => expect(apiService.getQualifications).toHaveBeenCalled());
    expect(scopeState.setCompanyId).not.toHaveBeenCalled();
  });

  it("company_id: con le aziende non ancora caricate attende l'elenco e poi imposta l'Ambito (Bugbot a2be23cf)", async () => {
    const loaded = scopeState.companies;
    scopeState.companies = [];
    window.history.replaceState({}, "", "/qualifiche?company_id=11");
    const { rerender } = render(<QualificationsPage />);
    await waitFor(() => expect(apiService.getQualifications).toHaveBeenCalled());
    expect(scopeState.setCompanyId).not.toHaveBeenCalled();

    scopeState.companies = loaded;
    rerender(<QualificationsPage />);
    await waitFor(() => expect(scopeState.setCompanyId).toHaveBeenCalledTimes(1));
    expect(scopeState.setCompanyId).toHaveBeenCalledWith("11");
    rerender(<QualificationsPage />);
    expect(scopeState.setCompanyId).toHaveBeenCalledTimes(1);
  });

  it("highlight + section=conferma apre la scheda con la sezione richiesta", async () => {
    apiService.getQualification.mockResolvedValue({ id: 42, person_name: "ZZ_Test", company_id: 10 });
    window.history.replaceState({}, "", "/qualifiche?company_id=10&highlight=42&section=conferma");
    render(<QualificationsPage />);
    const form = await screen.findByTestId("qual-form");
    expect(apiService.getQualification).toHaveBeenCalledWith("42");
    expect(form.getAttribute("data-id")).toBe("42");
    expect(form.getAttribute("data-section")).toBe("conferma");
  });

  it("highlight inesistente: nessuna scheda, messaggio d'errore", async () => {
    apiService.getQualification.mockRejectedValue(new Error("404"));
    window.history.replaceState({}, "", "/qualifiche?highlight=999999");
    render(<QualificationsPage />);
    await screen.findByText(/non trovata o non accessibile/i);
    expect(screen.queryByTestId("qual-form")).toBeNull();
  });

  it("highlight non numerico viene ignorato (nessuna chiamata API)", async () => {
    window.history.replaceState({}, "", "/qualifiche?highlight=1%27%20OR%201%3D1--");
    render(<QualificationsPage />);
    await waitFor(() => expect(apiService.getQualifications).toHaveBeenCalled());
    expect(apiService.getQualification).not.toHaveBeenCalled();
  });
});

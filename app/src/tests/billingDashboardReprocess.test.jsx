/**
 * Test — sezione "Rielaborazioni disponibili" in BillingDashboardPage (28/07/2026).
 * Pannello superadmin per lanciare manualmente il backfill di campi
 * AI-estraibili sulle qualifiche esistenti (registro reprocessableFields.js).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BillingDashboardPage from "../pages/BillingDashboardPage";

const mockGetBillingOverview = vi.fn();
const mockGetBillingCompanies = vi.fn();
const mockGetBillingEvents = vi.fn();
const mockGetReprocessTasks = vi.fn();
const mockRunReprocessTask = vi.fn();

vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({ user: { role: "superadmin", organization_name: "QS Studio" } }),
}));

vi.mock("../services/apiService", () => ({
  default: {
    getBillingOverview: (...args) => mockGetBillingOverview(...args),
    getBillingCompanies: (...args) => mockGetBillingCompanies(...args),
    getBillingEvents: (...args) => mockGetBillingEvents(...args),
    getReprocessTasks: (...args) => mockGetReprocessTasks(...args),
    runReprocessTask: (...args) => mockRunReprocessTask(...args),
  },
}));

const BASE_TASKS = [
  { key: "transfer_mode", label: "Metodo di trasferimento", candidate_count: 15 },
  { key: "shielding_gas", label: "Gas di protezione", candidate_count: 0 },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockGetBillingOverview.mockResolvedValue({ success: true, data: { totals: {}, tenants: [], period: "2026-07" } });
  mockGetBillingCompanies.mockResolvedValue({ data: [] });
  mockGetBillingEvents.mockResolvedValue({ data: [] });
  mockGetReprocessTasks.mockResolvedValue({ success: true, tasks: BASE_TASKS, total_candidates: 15 });
});

describe("BillingDashboardPage — Rielaborazioni disponibili", () => {
  it("mostra l'elenco dei task con il conteggio candidati", async () => {
    render(<BillingDashboardPage />);

    await waitFor(() => expect(screen.getByText("Metodo di trasferimento")).toBeInTheDocument());
    expect(screen.getByText("Gas di protezione")).toBeInTheDocument();
    const row = screen.getByText("Metodo di trasferimento").closest("tr");
    expect(row).toHaveTextContent("15");
  });

  it("mostra l'alert quando esistono candidati disponibili", async () => {
    render(<BillingDashboardPage />);

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(screen.getByRole("alert")).toHaveTextContent("15");
    expect(screen.getByRole("alert")).toHaveTextContent("Rielaborazioni disponibili");
  });

  it("non mostra l'alert quando non ci sono candidati", async () => {
    mockGetReprocessTasks.mockResolvedValue({
      success: true,
      tasks: [{ key: "transfer_mode", label: "Metodo di trasferimento", candidate_count: 0 }],
      total_candidates: 0,
    });
    render(<BillingDashboardPage />);

    await waitFor(() => expect(screen.getByText("Metodo di trasferimento")).toBeInTheDocument());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("disabilita il pulsante quando i candidati sono 0", async () => {
    render(<BillingDashboardPage />);

    await waitFor(() => expect(screen.getByText("Gas di protezione")).toBeInTheDocument());
    const row = screen.getByText("Gas di protezione").closest("tr");
    const button = row.querySelector("button");
    expect(button).toBeDisabled();
  });

  it("click su 'Lancia rielaborazione' chiama l'API, mostra lo stato di caricamento e poi il risultato", async () => {
    const user = userEvent.setup();
    let resolveRun;
    mockRunReprocessTask.mockReturnValue(
      new Promise((resolve) => { resolveRun = resolve; }),
    );

    render(<BillingDashboardPage />);

    await waitFor(() => expect(screen.getByText("Metodo di trasferimento")).toBeInTheDocument());
    const row = screen.getByText("Metodo di trasferimento").closest("tr");
    const button = row.querySelector("button");
    expect(button).not.toBeDisabled();

    await user.click(button);

    expect(mockRunReprocessTask).toHaveBeenCalledWith("transfer_mode");
    expect(screen.getByText("Rielaborazione in corso…")).toBeInTheDocument();

    resolveRun({ success: true, proposalsCreated: 12, candidatesFound: 15, hasMore: false });

    await waitFor(() =>
      expect(screen.getByText(/12 proposte create, disponibili in Qualifiche/)).toBeInTheDocument(),
    );
  });

  it("mostra un messaggio di errore se la rielaborazione fallisce", async () => {
    const user = userEvent.setup();
    mockRunReprocessTask.mockResolvedValue({ success: false, error: "Pipeline AI non disponibile" });

    render(<BillingDashboardPage />);

    await waitFor(() => expect(screen.getByText("Metodo di trasferimento")).toBeInTheDocument());
    const row = screen.getByText("Metodo di trasferimento").closest("tr");
    await user.click(row.querySelector("button"));

    await waitFor(() => expect(screen.getByText("Pipeline AI non disponibile")).toBeInTheDocument());
  });
});

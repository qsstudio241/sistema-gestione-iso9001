/**
 * Test — sezione "Rielaborazioni disponibili" in BillingDashboardPage (28/07/2026).
 * Pannello superadmin: solo voci con candidati > 0 (backlog post-schema, non catalogo).
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
  { key: "transfer_mode", label: "Metodo di trasferimento", module: "qualifiche", candidate_count: 15 },
  { key: "shielding_gas", label: "Gas di protezione", module: "qualifiche", candidate_count: 0 },
  { key: "preheat_temp", label: "Temperatura di preriscaldo", module: "saldatura", candidate_count: 3 },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockGetBillingOverview.mockResolvedValue({ success: true, data: { totals: {}, tenants: [], period: "2026-07" } });
  mockGetBillingCompanies.mockResolvedValue({ data: [] });
  mockGetBillingEvents.mockResolvedValue({ data: [] });
  mockGetReprocessTasks.mockResolvedValue({ success: true, tasks: BASE_TASKS, total_candidates: 18 });
});

describe("BillingDashboardPage — Rielaborazioni disponibili", () => {
  it("mostra solo i task con candidati > 0 (non il catalogo completo)", async () => {
    render(<BillingDashboardPage />);

    await waitFor(() => expect(screen.getByText("Metodo di trasferimento")).toBeInTheDocument());
    expect(screen.getByText("Temperatura di preriscaldo")).toBeInTheDocument();
    expect(screen.queryByText("Gas di protezione")).not.toBeInTheDocument();
    const row = screen.getByText("Metodo di trasferimento").closest("tr");
    expect(row).toHaveTextContent("15");
  });

  it("mostra l'hint su candidati dopo Lancia e dopo conferma", async () => {
    render(<BillingDashboardPage />);

    await waitFor(() => expect(screen.getByText("Metodo di trasferimento")).toBeInTheDocument());
    expect(screen.getByText(/candidati scendono/i)).toBeInTheDocument();
  });

  it("mostra l'alert quando esistono candidati disponibili", async () => {
    render(<BillingDashboardPage />);

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(screen.getByRole("alert")).toHaveTextContent("18");
    expect(screen.getByRole("alert")).toHaveTextContent("Rielaborazioni disponibili");
  });

  it("senza candidati: nessun alert e messaggio «Nessuna rielaborazione in sospeso»", async () => {
    mockGetReprocessTasks.mockResolvedValue({
      success: true,
      tasks: [
        { key: "transfer_mode", label: "Metodo di trasferimento", module: "qualifiche", candidate_count: 0 },
        { key: "shielding_gas", label: "Gas di protezione", module: "qualifiche", candidate_count: 0 },
      ],
      total_candidates: 0,
    });
    render(<BillingDashboardPage />);

    await waitFor(() =>
      expect(screen.getByText("Nessuna rielaborazione in sospeso.")).toBeInTheDocument(),
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByText("Metodo di trasferimento")).not.toBeInTheDocument();
    expect(screen.queryByText("Gas di protezione")).not.toBeInTheDocument();
  });

  it("durante un lancio disabilita tutti i pulsanti Lancia (non solo quello in corso)", async () => {
    const user = userEvent.setup();
    let resolveRun;
    mockRunReprocessTask.mockReturnValue(
      new Promise((resolve) => { resolveRun = resolve; }),
    );

    render(<BillingDashboardPage />);

    await waitFor(() => expect(screen.getByText("Metodo di trasferimento")).toBeInTheDocument());
    const transferBtn = screen.getByText("Metodo di trasferimento").closest("tr").querySelector("button");
    const saldaturaBtn = screen.getByText("Temperatura di preriscaldo").closest("tr").querySelector("button");
    expect(transferBtn).not.toBeDisabled();
    expect(saldaturaBtn).not.toBeDisabled();

    await user.click(transferBtn);

    expect(screen.getByText("Rielaborazione in corso…")).toBeInTheDocument();
    expect(saldaturaBtn).toBeDisabled();

    resolveRun({ success: true, proposalsCreated: 1, candidatesFound: 1, hasMore: false });
    await waitFor(() => expect(screen.queryByText("Rielaborazione in corso…")).not.toBeInTheDocument());
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

  it("per task saldatura il messaggio esito punta a Saldatura (non Qualifiche)", async () => {
    const user = userEvent.setup();
    mockRunReprocessTask.mockResolvedValue({
      success: true,
      proposalsCreated: 2,
      candidatesFound: 3,
      hasMore: false,
    });

    render(<BillingDashboardPage />);

    await waitFor(() => expect(screen.getByText("Temperatura di preriscaldo")).toBeInTheDocument());
    const row = screen.getByText("Temperatura di preriscaldo").closest("tr");
    await user.click(row.querySelector("button"));

    await waitFor(() =>
      expect(screen.getByText(/2 proposte create, disponibili in Saldatura/)).toBeInTheDocument(),
    );
    expect(screen.queryByText(/disponibili in Qualifiche → Rielaborazioni in coda/)).not.toBeInTheDocument();
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

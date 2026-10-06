/**
 * Test — sezione "Rielaborazioni disponibili" in BillingDashboardPage (28/07/2026).
 * Pannello superadmin: solo voci con candidati > 0 (backlog post-schema, non catalogo).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BillingDashboardPage, { buildVerifyCsv } from "../pages/BillingDashboardPage";

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

const VERIFY_TASK = {
  key: "verify_9606_1",
  label: "Verifica ISO 9606-1",
  module: "qualifiche",
  kind: "verify",
  candidate_count: 4,
};

const VERIFY_REPORT = {
  success: true,
  kind: "verify",
  field: "verify_9606_1",
  recordsChecked: 20,
  recordsWithWarnings: 4,
  findingsByCode: { "WQ9606_1.CORR.THK_BW": 3, "WQ9606_1.COMP.POSITION": 1 },
  notVerifiable: { dato_mancante: 12, fonte_mancante: 1 },
  items: [
    {
      id: 7,
      organization_id: 1001,
      person_name: "Mario Rossi",
      certificate_number: "CERT-1",
      findings: [
        {
          code: "WQ9606_1.CORR.THK_BW",
          severity: "warn",
          status: "verificabile",
          read_value: "3-30 mm",
          expected_value: "3-24 mm",
          source: { norm: "ISO 9606-1", clause: "§5.7 Tab. 6" },
          message_it: "Spessore dichiarato oltre il campo qualificato (§5.7 Tab. 6).",
        },
      ],
    },
    {
      id: 9,
      organization_id: 1001,
      person_name: 'Anna "Bianchi"; Neri',
      certificate_number: "CERT-2",
      findings: [
        {
          code: "WQ9606_1.COMP.POSITION",
          severity: "warn",
          status: "verificabile",
          read_value: null,
          expected_value: "PA",
          source: { norm: "ISO 9606-1", clause: "§5.4" },
          message_it: "Posizione mancante (§5.4).",
        },
      ],
    },
  ],
  hasMore: false,
};

describe("BillingDashboardPage — Verifica qualifiche vs norma (kind: verify)", () => {
  beforeEach(() => {
    mockGetReprocessTasks.mockResolvedValue({
      success: true,
      tasks: [...BASE_TASKS, VERIFY_TASK],
      total_candidates: 22,
    });
  });

  it("la voce verify compare nella sotto-sezione propria e non entra nel totale «dati AI mancanti»", async () => {
    render(<BillingDashboardPage />);

    const heading = await screen.findByRole("heading", { name: "Verifica qualifiche vs norma" });
    const section = heading.closest("section");
    expect(within(section).getByText("Verifica ISO 9606-1")).toBeInTheDocument();
    expect(within(section).getByText("Record con avvisi norma")).toBeInTheDocument();
    expect(within(section).getByText("4")).toBeInTheDocument();
    expect(section).toHaveTextContent(/sola lettura: nessuna modifica ai record, nessuna AI/i);
    expect(section).toHaveTextContent(/prima i backfill dei dati di prova/i);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("18");
    expect(alert).not.toHaveTextContent("22");

    const backfillHeading = screen.getByRole("heading", { name: "Rielaborazioni disponibili" });
    expect(within(backfillHeading.closest("section")).queryByText("Verifica ISO 9606-1")).not.toBeInTheDocument();
  });

  it("senza candidati la voce verify non compare e senza kind nulla cambia", async () => {
    mockGetReprocessTasks.mockResolvedValue({
      success: true,
      tasks: [...BASE_TASKS, { ...VERIFY_TASK, candidate_count: 0 }],
      total_candidates: 18,
    });
    render(<BillingDashboardPage />);

    await waitFor(() => expect(screen.getByText("Metodo di trasferimento")).toBeInTheDocument());
    expect(screen.queryByRole("heading", { name: "Verifica qualifiche vs norma" })).not.toBeInTheDocument();
    expect(screen.queryByText("Verifica ISO 9606-1")).not.toBeInTheDocument();
  });

  it("solo voci verify: nessun alert «dati AI mancanti» e backfill vuoto", async () => {
    mockGetReprocessTasks.mockResolvedValue({ success: true, tasks: [VERIFY_TASK], total_candidates: 4 });
    render(<BillingDashboardPage />);

    await screen.findByRole("heading", { name: "Verifica qualifiche vs norma" });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByText("Nessuna rielaborazione in sospeso.")).toBeInTheDocument();
  });

  it("«Esegui verifica» chiama l'API con la chiave giusta, è in corso (disabled/aria-busy) e mostra esiti e clausola", async () => {
    const user = userEvent.setup();
    let resolveRun;
    mockRunReprocessTask.mockReturnValue(new Promise((resolve) => { resolveRun = resolve; }));
    render(<BillingDashboardPage />);

    const btn = await screen.findByRole("button", { name: "Esegui verifica" });
    expect(btn).not.toBeDisabled();
    await user.click(btn);

    expect(mockRunReprocessTask).toHaveBeenCalledWith("verify_9606_1");
    const busy = screen.getByRole("button", { name: "Verifica in corso…" });
    expect(busy).toBeDisabled();
    expect(busy).toHaveAttribute("aria-busy", "true");
    expect(busy).toHaveAttribute("title");

    resolveRun(VERIFY_REPORT);
    const result = await screen.findByLabelText("Esito verifica Verifica ISO 9606-1");
    expect(result).toHaveTextContent("20 record controllati");
    expect(result).toHaveTextContent("12 per dato mancante");
    expect(result).toHaveTextContent("WQ9606_1.CORR.THK_BW (3)");
    expect(result).toHaveTextContent("Mario Rossi");
    expect(result).toHaveTextContent("3-30 mm");
    expect(result).toHaveTextContent("3-24 mm");
    expect(result).toHaveTextContent("§5.7 Tab. 6");
    expect(result).not.toHaveTextContent(/Mostrati i primi/);
    expect(screen.getByRole("button", { name: "Esegui verifica" })).not.toBeDisabled();
  });

  it("dopo la verifica il conteggio non scende, non ricarica i task e lo dichiara", async () => {
    const user = userEvent.setup();
    mockRunReprocessTask.mockResolvedValue(VERIFY_REPORT);
    render(<BillingDashboardPage />);

    await user.click(await screen.findByRole("button", { name: "Esegui verifica" }));
    const result = await screen.findByLabelText("Esito verifica Verifica ISO 9606-1");

    expect(result).toHaveTextContent(/non scende dopo la verifica/i);
    expect(mockGetReprocessTasks).toHaveBeenCalledTimes(1);
    const row = screen.getByText("Verifica ISO 9606-1", { selector: "td" }).closest("tr");
    expect(row).toHaveTextContent("4");
  });

  it("hasMore mostra la nota sui primi N record", async () => {
    const user = userEvent.setup();
    mockRunReprocessTask.mockResolvedValue({ ...VERIFY_REPORT, hasMore: true });
    render(<BillingDashboardPage />);

    await user.click(await screen.findByRole("button", { name: "Esegui verifica" }));
    expect(await screen.findByText(/Mostrati i primi 2 record/)).toBeInTheDocument();
  });

  it("«Scarica CSV» genera un blob con BOM, separatore ; ed escape delle virgolette", async () => {
    const user = userEvent.setup();
    mockRunReprocessTask.mockResolvedValue(VERIFY_REPORT);
    let captured;
    const createUrl = vi.fn((blob) => { captured = blob; return "blob:test"; });
    const revokeUrl = vi.fn();
    const original = { create: URL.createObjectURL, revoke: URL.revokeObjectURL };
    URL.createObjectURL = createUrl;
    URL.revokeObjectURL = revokeUrl;
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    try {
      render(<BillingDashboardPage />);
      await user.click(await screen.findByRole("button", { name: "Esegui verifica" }));
      const result = await screen.findByLabelText("Esito verifica Verifica ISO 9606-1");
      await user.click(within(result).getByRole("button", { name: "Scarica CSV" }));

      expect(createUrl).toHaveBeenCalledTimes(1);
      expect(clickSpy).toHaveBeenCalledTimes(1);
      expect(revokeUrl).toHaveBeenCalledWith("blob:test");
      const bytes = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(new Uint8Array(reader.result));
        reader.readAsArrayBuffer(captured);
      });
      expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
      const text = new TextDecoder("utf-8", { ignoreBOM: true }).decode(bytes).slice(1);
      expect(text.startsWith('"Persona";"Certificato"')).toBe(true);
      expect(captured.type).toContain("text/csv");
    } finally {
      URL.createObjectURL = original.create;
      URL.revokeObjectURL = original.revoke;
      clickSpy.mockRestore();
    }
  });

  it("buildVerifyCsv: intestazione, separatore ;, virgolette raddoppiate, valori nulli vuoti, formule neutralizzate", () => {
    const csv = buildVerifyCsv([
      ...VERIFY_REPORT.items,
      {
        id: 11,
        person_name: "=CMD()",
        certificate_number: "C-3",
        findings: [
          {
            code: "X",
            message_it: "Valore negativo",
            read_value: -3,
            expected_value: ["PA", "PB"],
            source: { clause: "§1" },
          },
        ],
      },
    ]);
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe(
      '"Persona";"Certificato";"Codice avviso";"Avviso";"Letto";"Atteso dalla norma";"Clausola"',
    );
    expect(lines[1]).toBe(
      '"Mario Rossi";"CERT-1";"WQ9606_1.CORR.THK_BW";"Spessore dichiarato oltre il campo qualificato (§5.7 Tab. 6).";"3-30 mm";"3-24 mm";"§5.7 Tab. 6"',
    );
    expect(lines[2]).toBe(
      '"Anna ""Bianchi""; Neri";"CERT-2";"WQ9606_1.COMP.POSITION";"Posizione mancante (§5.4).";"";"PA";"§5.4"',
    );
    expect(lines[3]).toBe('"\'=CMD()";"C-3";"X";"Valore negativo";"-3";"PA, PB";"§1"');
  });

  it("errore: role=alert col messaggio e pulsante di nuovo utilizzabile", async () => {
    const user = userEvent.setup();
    mockRunReprocessTask.mockRejectedValue(new Error("Verifica non disponibile"));
    render(<BillingDashboardPage />);

    await user.click(await screen.findByRole("button", { name: "Esegui verifica" }));
    const section = screen.getByRole("heading", { name: "Verifica qualifiche vs norma" }).closest("section");
    expect(await within(section).findByRole("alert")).toHaveTextContent("Verifica non disponibile");
    expect(screen.getByRole("button", { name: "Esegui verifica" })).not.toBeDisabled();
  });

  it("durante una verifica i pulsanti backfill sono disabilitati", async () => {
    const user = userEvent.setup();
    mockRunReprocessTask.mockReturnValue(new Promise(() => {}));
    render(<BillingDashboardPage />);

    await user.click(await screen.findByRole("button", { name: "Esegui verifica" }));
    const backfillBtn = screen.getByText("Metodo di trasferimento").closest("tr").querySelector("button");
    expect(backfillBtn).toBeDisabled();
  });
});

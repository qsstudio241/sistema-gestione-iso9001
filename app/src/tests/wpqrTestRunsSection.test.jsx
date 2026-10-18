/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";

vi.mock("../services/apiService", () => ({
  default: {
    getWpqrTestRuns: vi.fn(),
    saveWpqrTestRuns: vi.fn(),
  },
}));

import apiService from "../services/apiService";
import WpqrTestRunsSection, {
  MSG_NEEDS_SAVE,
  MSG_UNAVAILABLE,
  MSG_LOAD_ERROR,
  standardFamilyFrom,
} from "../components/WpqrTestRunsSection";

const RUN = { id: 5, run_no: 1, run_label: "1", welding_process: "135", current_a: 220, voltage_v: 24 };

beforeEach(() => {
  vi.clearAllMocks();
  apiService.getWpqrTestRuns.mockResolvedValue({ runs: [RUN], available: true });
  apiService.saveWpqrTestRuns.mockResolvedValue({ runs: [], available: true });
});
afterEach(() => cleanup());

describe("standardFamilyFrom", () => {
  it("mappa le norme del form alla famiglia dell'editor", () => {
    expect(standardFamilyFrom("UNI EN ISO 15614-1:2017")).toBe("15614-1");
    expect(standardFamilyFrom("UNI EN ISO 15614-2:2025")).toBe("15614-2");
    expect(standardFamilyFrom("UNI EN ISO 14555:2025")).toBe("14555");
    expect(standardFamilyFrom("ISO 15613:2004")).toBe("15613");
    expect(standardFamilyFrom("")).toBe("15614-1");
    expect(standardFamilyFrom(undefined)).toBe("15614-1");
  });
});

describe("WpqrTestRunsSection", () => {
  it("senza wpqrId: avviso, nessuna chiamata, editor visibile ma disabilitato", () => {
    render(<WpqrTestRunsSection wpqrId={null} />);
    expect(screen.getByTestId("wtrs-needs-save")).toHaveTextContent(MSG_NEEDS_SAVE);
    expect(apiService.getWpqrTestRuns).not.toHaveBeenCalled();
    expect(screen.getByTestId("wtr-add")).toBeDisabled();
  });

  it("con wpqrId: carica le passate dal server e le mostra", async () => {
    render(<WpqrTestRunsSection wpqrId={42} standardReference="UNI EN ISO 15614-1:2017" />);
    await waitFor(() => expect(screen.getByTestId("wtr-table")).toBeInTheDocument());
    expect(apiService.getWpqrTestRuns).toHaveBeenCalledWith(42);
    expect(screen.getByLabelText("Corrente (A) — riga 1")).toHaveValue("220");
    expect(screen.getByTestId("wtr-add")).toBeEnabled();
  });

  it("modifica confermata (blur): PUT replace-set con le passate, stato «Salvato»", async () => {
    render(<WpqrTestRunsSection wpqrId={42} />);
    const input = await screen.findByLabelText("Corrente (A) — riga 1");
    fireEvent.change(input, { target: { value: "235" } });
    fireEvent.blur(input);
    await waitFor(() => expect(apiService.saveWpqrTestRuns).toHaveBeenCalledTimes(1));
    const [id, payload] = apiService.saveWpqrTestRuns.mock.calls[0];
    expect(id).toBe(42);
    expect(payload).toHaveLength(1);
    expect(payload[0]).toEqual(expect.objectContaining({ id: 5, current_a: 235, voltage_v: 24 }));
    await waitFor(() => expect(screen.getByTestId("wtrs-status")).toHaveTextContent("Salvato"));
  });

  it("aggiungi passata salva subito la nuova riga", async () => {
    apiService.getWpqrTestRuns.mockResolvedValue({ runs: [], available: true });
    render(<WpqrTestRunsSection wpqrId={9} />);
    fireEvent.click(await screen.findByTestId("wtr-add"));
    await waitFor(() => expect(apiService.saveWpqrTestRuns).toHaveBeenCalled());
    expect(apiService.saveWpqrTestRuns.mock.calls[0][1]).toEqual([
      expect.objectContaining({ run_label: "1", run_no: 1 }),
    ]);
  });

  it("available:false → avviso e editor bloccato, nessun salvataggio possibile", async () => {
    apiService.getWpqrTestRuns.mockResolvedValue({ runs: [], available: false });
    render(<WpqrTestRunsSection wpqrId={42} />);
    expect(await screen.findByTestId("wtrs-unavailable")).toHaveTextContent(MSG_UNAVAILABLE);
    expect(screen.getByTestId("wtr-add")).toBeDisabled();
    expect(apiService.saveWpqrTestRuns).not.toHaveBeenCalled();
  });

  it("errore 400 con details: mostra riga e messaggio del server", async () => {
    apiService.saveWpqrTestRuns.mockRejectedValue(Object.assign(new Error("Passate non valide."), {
      status: 400,
      code: "VALIDATION_ERROR",
      data: { details: [{ row: 1, field: "current_a", message: "Valore fuori intervallo (0–5000)." }] },
    }));
    render(<WpqrTestRunsSection wpqrId={42} />);
    const input = await screen.findByLabelText("Corrente (A) — riga 1");
    fireEvent.change(input, { target: { value: "99999" } });
    fireEvent.blur(input);
    const box = await screen.findByTestId("wtrs-error");
    expect(box).toHaveTextContent("riga 1: Valore fuori intervallo (0–5000).");
  });

  it("errore 503 (migrazione non applicata): passa a non disponibile", async () => {
    apiService.saveWpqrTestRuns.mockRejectedValue(Object.assign(new Error("x"), {
      status: 503, code: "WPQR_TEST_RUNS_UNAVAILABLE",
    }));
    render(<WpqrTestRunsSection wpqrId={42} />);
    const input = await screen.findByLabelText("Corrente (A) — riga 1");
    fireEvent.change(input, { target: { value: "230" } });
    fireEvent.blur(input);
    expect(await screen.findByTestId("wtrs-unavailable")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId("wtr-add")).toBeDisabled());
  });

  it("errore di caricamento: messaggio, nessun crash", async () => {
    apiService.getWpqrTestRuns.mockRejectedValue(new Error("rete"));
    render(<WpqrTestRunsSection wpqrId={42} />);
    expect(await screen.findByTestId("wtrs-error")).toHaveTextContent(MSG_LOAD_ERROR);
  });

  it("salvataggi in coda: un solo PUT alla volta, l'ultimo stato vince", async () => {
    let release;
    apiService.saveWpqrTestRuns.mockImplementationOnce(() => new Promise((r) => { release = r; }));
    apiService.saveWpqrTestRuns.mockResolvedValue({ runs: [], available: true });
    render(<WpqrTestRunsSection wpqrId={42} />);
    const input = await screen.findByLabelText("Corrente (A) — riga 1");
    fireEvent.change(input, { target: { value: "230" } });
    fireEvent.blur(input);
    fireEvent.change(input, { target: { value: "240" } });
    fireEvent.blur(input);
    expect(apiService.saveWpqrTestRuns).toHaveBeenCalledTimes(1);
    release({ runs: [], available: true });
    await waitFor(() => expect(apiService.saveWpqrTestRuns).toHaveBeenCalledTimes(2));
    expect(apiService.saveWpqrTestRuns.mock.calls[1][1][0].current_a).toBe(240);
  });

  it("norma 14555: l'editor passa alla variante stud", async () => {
    apiService.getWpqrTestRuns.mockResolvedValue({ runs: [], available: true });
    render(<WpqrTestRunsSection wpqrId={42} standardReference="UNI EN ISO 14555:2025" />);
    const editor = await screen.findByTestId("wtr-editor");
    expect(editor).toHaveAttribute("data-variant", "stud");
  });
});

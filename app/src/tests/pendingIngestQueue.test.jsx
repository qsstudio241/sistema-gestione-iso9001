/**
 * Test L1 — PendingIngestQueue: coda dei caricamenti estratti ma non confermati.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";

vi.mock("../services/apiService", () => ({
  default: {
    listIngestStaging: vi.fn(),
    getIngestStaging: vi.fn(),
    getIngestStagingFileBlob: vi.fn().mockRejectedValue(new Error("no preview in test")),
    confirmIngestStaging: vi.fn(),
    rejectIngestStaging: vi.fn(),
  },
}));
vi.mock("../components/IngestReviewDialog", () => ({
  default: ({ open, fileName, fields, onConfirm, onReject }) => (open ? (
    <div data-testid="review-dialog">
      <span>{fileName}</span>
      <span data-testid="review-person">{fields?.person_name}</span>
      <button onClick={() => onConfirm({ person_name: "ZZ_Corretto" })}>conferma</button>
      <button onClick={onReject}>scarta</button>
    </div>
  ) : null),
}));

import apiService from "../services/apiService";
import PendingIngestQueue from "../components/PendingIngestQueue";

const PENDING = {
  id: 5, doc_type: "patentino_saldatore", original_name: "ZZ_a.pdf", is_reprocess: false,
  fields: { person_name: "ZZ_Persona" }, warnings: [],
};
const REPROCESS = { id: 6, doc_type: "patentino_saldatore", original_name: "ZZ_b.pdf", is_reprocess: true, fields: {} };

beforeEach(() => {
  vi.clearAllMocks();
  apiService.listIngestStaging.mockResolvedValue({ items: [PENDING, REPROCESS] });
  apiService.getIngestStaging.mockResolvedValue({
    id: 5, doc_type: "patentino_saldatore", original_name: "ZZ_a.pdf", fields: { person_name: "ZZ_Persona" },
    field_confidence: {}, warnings: [],
  });
});

describe("PendingIngestQueue", () => {
  it("elenca solo i pending non di rielaborazione, con modulo qualifiche", async () => {
    render(<PendingIngestQueue />);
    await screen.findByTestId("pending-ingest-queue");
    expect(apiService.listIngestStaging).toHaveBeenCalledWith({ module: "qualifiche", reviewStatus: "pending" });
    expect(screen.getByText(/in attesa di revisione/i)).toBeTruthy();
    fireEvent.click(screen.getByText("Vedi elenco"));
    expect(screen.getByText("ZZ_Persona")).toBeTruthy();
    expect(screen.queryByText("ZZ_b.pdf")).toBeNull();
  });

  it("coda vuota o errore API: non mostra nulla", async () => {
    apiService.listIngestStaging.mockResolvedValueOnce({ items: [] });
    const { container, rerender } = render(<PendingIngestQueue />);
    await waitFor(() => expect(apiService.listIngestStaging).toHaveBeenCalledTimes(1));
    expect(container.firstChild).toBeNull();

    apiService.listIngestStaging.mockRejectedValueOnce(new Error("500"));
    rerender(<PendingIngestQueue refreshKey={1} />);
    await waitFor(() => expect(apiService.listIngestStaging).toHaveBeenCalledTimes(2));
    expect(container.firstChild).toBeNull();
  });

  it("Rivedi apre la finestra, Conferma salva e rimuove la voce", async () => {
    const onChanged = vi.fn();
    apiService.confirmIngestStaging.mockResolvedValue({ success: true });
    render(<PendingIngestQueue onChanged={onChanged} />);
    fireEvent.click(await screen.findByText("Vedi elenco"));
    fireEvent.click(screen.getByText("Rivedi"));
    await screen.findByTestId("review-dialog");
    expect(apiService.getIngestStaging).toHaveBeenCalledWith(5);
    expect(screen.getByTestId("review-person").textContent).toBe("ZZ_Persona");
    fireEvent.click(screen.getByText("conferma"));
    await waitFor(() => expect(apiService.confirmIngestStaging).toHaveBeenCalledWith(5, { person_name: "ZZ_Corretto" }));
    await waitFor(() => expect(screen.queryByTestId("pending-ingest-queue")).toBeNull());
    expect(onChanged).toHaveBeenCalled();
  });

  it("Conferma fallita (409): la voce resta e l'errore e' mostrato sopra la finestra", async () => {
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    apiService.confirmIngestStaging.mockRejectedValue({ message: "x", data: { error: "Record duplicato" } });
    render(<PendingIngestQueue />);
    fireEvent.click(await screen.findByText("Vedi elenco"));
    fireEvent.click(screen.getByText("Rivedi"));
    await screen.findByTestId("review-dialog");
    fireEvent.click(screen.getByText("conferma"));
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith("Record duplicato"));
    expect(screen.getByTestId("pending-ingest-queue")).toBeTruthy();
    expect(screen.getByTestId("review-dialog")).toBeTruthy();
    alertSpy.mockRestore();
  });

  it("Scarta chiama reject e rimuove la voce", async () => {
    const onChanged = vi.fn();
    apiService.rejectIngestStaging.mockResolvedValue({ success: true });
    render(<PendingIngestQueue onChanged={onChanged} />);
    fireEvent.click(await screen.findByText("Vedi elenco"));
    fireEvent.click(screen.getByText("Rivedi"));
    await screen.findByTestId("review-dialog");
    fireEvent.click(screen.getByText("scarta"));
    await waitFor(() => expect(apiService.rejectIngestStaging).toHaveBeenCalledWith(5));
    await waitFor(() => expect(screen.queryByTestId("pending-ingest-queue")).toBeNull());
    expect(onChanged).toHaveBeenCalled();
  });
});

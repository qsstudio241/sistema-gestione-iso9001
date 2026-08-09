/**
 * Test — ReprocessQueueBanner (generalizzato 08/08/2026 dalle sole Qualifiche
 * anche alla WPQR, migrazione 143). Verifica il parametro `module` e il
 * fallback di etichetta/titolo per le proposte WPQR (nessun `person_name`,
 * chiave di registro `wpqr_thickness_max_unlimited` diversa dal campo ingest
 * reale `thickness_max_unlimited`).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";

vi.mock("../services/apiService", () => ({
  default: {
    listIngestStaging: vi.fn(),
    getIngestStagingFileBlob: vi.fn().mockRejectedValue(new Error("no preview in test")),
    confirmIngestStaging: vi.fn(),
    rejectIngestStaging: vi.fn(),
  },
}));

import apiService from "../services/apiService";
import ReprocessQueueBanner from "../components/ReprocessQueueBanner";

describe("ReprocessQueueBanner — parametro module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("default (nessuna prop): interroga il modulo 'qualifiche'", async () => {
    apiService.listIngestStaging.mockResolvedValue({ items: [] });
    render(<ReprocessQueueBanner />);

    await waitFor(() => {
      expect(apiService.listIngestStaging).toHaveBeenCalledWith(
        expect.objectContaining({ module: "qualifiche", reprocessOnly: true })
      );
    });
  });

  it("module='saldatura': interroga il modulo saldatura (coda rielaborazione WPQR)", async () => {
    apiService.listIngestStaging.mockResolvedValue({ items: [] });
    render(<ReprocessQueueBanner module="saldatura" />);

    await waitFor(() => {
      expect(apiService.listIngestStaging).toHaveBeenCalledWith(
        expect.objectContaining({ module: "saldatura", reprocessOnly: true })
      );
    });
  });

  it("mostra il wpqr_code come titolo quando manca person_name (proposta WPQR)", async () => {
    apiService.listIngestStaging.mockResolvedValue({
      items: [{
        id: 1, doc_type: "wpqr", original_name: "wpqr.pdf", field_scope: "preheat_temp",
        fields: { wpqr_code: "WPQR-01", preheat_temp: "min 100 C" },
      }],
    });
    const { container } = render(<ReprocessQueueBanner module="saldatura" />);

    await waitFor(() => expect(container.textContent).toMatch(/1\s*document/));
  });
});

describe("ReprocessProposalDialog — Ingrandisci affiancato (rilievo committente 09/08/2026)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiService.getIngestStagingFileBlob.mockRejectedValue(new Error("no preview in test"));
    // vitest.config.mjs ha mockReset/restoreMocks globali: il mock di
    // window.matchMedia impostato in tests/setup.js va ripristinato qui,
    // stesso pattern di ingestReviewDialog.test.jsx.
    window.matchMedia = vi.fn(() => ({
      matches: false,
      media: "",
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
  });

  it("Rivedi apre il dialog e il pulsante attiva/disattiva la modalità a schermo intero", async () => {
    apiService.listIngestStaging.mockResolvedValue({
      items: [{
        id: 42, doc_type: "wpqr", original_name: "wpqr.pdf", field_scope: "product_type",
        fields: { wpqr_code: "WPQR-09", product_type: "P - Piastra" },
      }],
    });

    render(<ReprocessQueueBanner module="saldatura" />);

    fireEvent.click(await screen.findByText(/Vedi elenco/i));
    fireEvent.click(await screen.findByText("Rivedi"));

    const expandBtn = await screen.findByText("Ingrandisci affiancato");
    const overlay = document.querySelector(".reprocess-dialog__overlay");
    expect(overlay).not.toHaveClass("reprocess-dialog__overlay--expanded");

    fireEvent.click(expandBtn);
    expect(overlay).toHaveClass("reprocess-dialog__overlay--expanded");
    expect(screen.getByText("Riduci")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Riduci"));
    expect(overlay).not.toHaveClass("reprocess-dialog__overlay--expanded");
  });
});

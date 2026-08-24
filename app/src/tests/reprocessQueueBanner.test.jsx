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
    const dialog = document.querySelector(".reprocess-dialog");
    expect(overlay).not.toHaveClass("reprocess-dialog__overlay--expanded");
    expect(dialog).not.toHaveClass("reprocess-dialog--expanded");

    fireEvent.click(expandBtn);
    expect(overlay).toHaveClass("reprocess-dialog__overlay--expanded");
    expect(overlay).toHaveClass("ingest-dialog-shell__overlay--expanded");
    expect(dialog).toHaveClass("reprocess-dialog--expanded");
    expect(dialog).toHaveClass("ingest-dialog-shell__dialog--expanded");
    expect(screen.getByText("Riduci")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Riduci"));
    expect(overlay).not.toHaveClass("reprocess-dialog__overlay--expanded");
    expect(dialog).not.toHaveClass("reprocess-dialog--expanded");
  });
});

describe("ReprocessQueueBanner — correzione manuale e raggruppamento per documento (rilievo committente 09/08/2026)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiService.getIngestStagingFileBlob.mockRejectedValue(new Error("no preview in test"));
    window.matchMedia = vi.fn(() => ({
      matches: false,
      media: "",
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
  });

  it("il valore è editabile e la conferma invia la correzione dell'utente, non il valore AI originale", async () => {
    apiService.listIngestStaging.mockResolvedValue({
      items: [{
        id: 55, doc_type: "wpqr", original_name: "wpqr.pdf", field_scope: "product_type",
        target_wpqr_id: 20,
        fields: { wpqr_code: "WPQR-20", product_type: "P" },
      }],
    });
    apiService.confirmIngestStaging.mockResolvedValue({ success: true });

    render(<ReprocessQueueBanner module="saldatura" />);
    fireEvent.click(await screen.findByText(/Vedi elenco/i));
    fireEvent.click(await screen.findByText("Rivedi"));

    const input = await screen.findByLabelText(/Tipo prodotto testato/i);
    fireEvent.change(input, { target: { value: "T" } });

    expect(screen.getByText("Conferma valore corretto")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Conferma valore corretto"));

    await waitFor(() => {
      expect(apiService.confirmIngestStaging).toHaveBeenCalledWith(55, { product_type: "T" });
    });
  });

  it("due campi sullo stesso documento (stesso target_wpqr_id) compaiono in un'unica riga e in un'unica sessione", async () => {
    apiService.listIngestStaging.mockResolvedValue({
      items: [
        {
          id: 61, doc_type: "wpqr", original_name: "wpqr.pdf", field_scope: "preheat_temp",
          target_wpqr_id: 30, fields: { wpqr_code: "WPQR-30", preheat_temp: "min 100 C" },
        },
        {
          id: 62, doc_type: "wpqr", original_name: "wpqr.pdf", field_scope: "interpass_temp",
          target_wpqr_id: 30, fields: { wpqr_code: "WPQR-30", interpass_temp: "max 250 C" },
        },
      ],
    });
    apiService.confirmIngestStaging.mockResolvedValue({ success: true });

    render(<ReprocessQueueBanner module="saldatura" />);
    fireEvent.click(await screen.findByText(/Vedi elenco/i));

    // Una sola riga "Rivedi" per il documento, non due
    expect(screen.getAllByText("Rivedi")).toHaveLength(1);
    expect(screen.getByText(/2 campi da rivedere/)).toBeInTheDocument();

    fireEvent.click(screen.getByText("Rivedi"));

    expect(await screen.findByText(/2 campi da rivedere su questo documento/)).toBeInTheDocument();
    expect(screen.getAllByText("Conferma e salva")).toHaveLength(2);

    // Confermo solo il primo campo: la finestra resta aperta con l'altro campo residuo
    fireEvent.click(screen.getAllByText("Conferma e salva")[0]);
    await waitFor(() => {
      expect(apiService.confirmIngestStaging).toHaveBeenCalledWith(61, { preheat_temp: "min 100 C" });
    });
    await waitFor(() => expect(screen.getAllByText("Conferma e salva")).toHaveLength(1));

    // Confermo anche il secondo campo: nessun campo residuo, la finestra si chiude da sola
    fireEvent.click(screen.getByText("Conferma e salva"));
    await waitFor(() => {
      expect(apiService.confirmIngestStaging).toHaveBeenCalledWith(62, { interpass_temp: "max 250 C" });
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});

describe("ReprocessQueueBanner — fix rilievi Bugbot 09/08/2026 (campo vuoto, alias wpqr_, coercizione tipi)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiService.getIngestStagingFileBlob.mockRejectedValue(new Error("no preview in test"));
    window.matchMedia = vi.fn(() => ({
      matches: false,
      media: "",
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
  });

  it("svuotare il campo disabilita 'Conferma' (nessuna chiusura silenziosa della proposta senza scrivere nulla)", async () => {
    apiService.listIngestStaging.mockResolvedValue({
      items: [{
        id: 70, doc_type: "wpqr", original_name: "wpqr.pdf", field_scope: "preheat_temp",
        target_wpqr_id: 40, fields: { wpqr_code: "WPQR-40", preheat_temp: "min 100 C" },
      }],
    });

    render(<ReprocessQueueBanner module="saldatura" />);
    fireEvent.click(await screen.findByText(/Vedi elenco/i));
    fireEvent.click(await screen.findByText("Rivedi"));

    const input = await screen.findByLabelText(/Temperatura preriscaldo/i);
    fireEvent.change(input, { target: { value: "" } });

    const confirmBtn = screen.getByRole("button", { name: /Conferma/ });
    expect(confirmBtn).toBeDisabled();
    expect(screen.getByText(/Il campo è vuoto/)).toBeInTheDocument();

    fireEvent.click(confirmBtn);
    expect(apiService.confirmIngestStaging).not.toHaveBeenCalled();
  });

  it("un campo booleano con alias di registro 'wpqr_' usa il select Sì/No, non un input di testo libero", async () => {
    apiService.listIngestStaging.mockResolvedValue({
      items: [{
        id: 71, doc_type: "wpqr", original_name: "wpqr.pdf", field_scope: "wpqr_thickness_max_unlimited",
        target_wpqr_id: 41, fields: { wpqr_code: "WPQR-41", wpqr_thickness_max_unlimited: true },
      }],
    });
    apiService.confirmIngestStaging.mockResolvedValue({ success: true });

    render(<ReprocessQueueBanner module="saldatura" />);
    fireEvent.click(await screen.findByText(/Vedi elenco/i));
    fireEvent.click(await screen.findByText("Rivedi"));

    const select = await screen.findByLabelText(/Spessore massimo/i);
    expect(select.tagName).toBe("SELECT");
    expect(select.value).toBe("true");

    fireEvent.change(select, { target: { value: "false" } });
    fireEvent.click(screen.getByText("Conferma valore corretto"));

    await waitFor(() => {
      // Coercizione a booleano reale, non la stringa "false"
      expect(apiService.confirmIngestStaging).toHaveBeenCalledWith(71, { wpqr_thickness_max_unlimited: false });
    });
  });

  it("un campo numerico invia un Number alla conferma, non la stringa dell'input", async () => {
    apiService.listIngestStaging.mockResolvedValue({
      items: [{
        id: 72, doc_type: "wpqr", original_name: "wpqr.pdf", field_scope: "throat_test_mm",
        target_wpqr_id: 42, fields: { wpqr_code: "WPQR-42", throat_test_mm: 5 },
      }],
    });
    apiService.confirmIngestStaging.mockResolvedValue({ success: true });

    render(<ReprocessQueueBanner module="saldatura" />);
    fireEvent.click(await screen.findByText(/Vedi elenco/i));
    fireEvent.click(await screen.findByText("Rivedi"));

    const input = await screen.findByLabelText(/Spessore gola provino/i);
    fireEvent.change(input, { target: { value: "7.5" } });
    fireEvent.click(screen.getByText("Conferma valore corretto"));

    await waitFor(() => {
      expect(apiService.confirmIngestStaging).toHaveBeenCalledWith(72, { throat_test_mm: 7.5 });
    });
  });
});

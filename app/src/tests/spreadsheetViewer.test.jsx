/**
 * Test suite – SpreadsheetViewer component
 *
 * Verifica: rendering overlay, fogli multipli, gestione errori, pulsante download.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import SpreadsheetViewer from "../components/SpreadsheetViewer";

// Mock xlsx module
vi.mock("xlsx", () => {
  const sheetData = [
    ["Nome", "Cognome", "Età"],
    ["Mario", "Rossi", 42],
    ["Anna", "Verdi", 35],
  ];

  const sheet2Data = [
    ["Prodotto", "Prezzo"],
    ["Widget", 10],
  ];

  const mockSheet1 = { "!ref": "A1:C3" };
  const mockSheet2 = { "!ref": "A1:B2" };

  return {
    read: vi.fn(() => ({
      SheetNames: ["Dipendenti", "Prodotti"],
      Sheets: {
        Dipendenti: mockSheet1,
        Prodotti: mockSheet2,
      },
    })),
    utils: {
      sheet_to_json: vi.fn((sheet, opts) => {
        if (sheet === mockSheet1) return sheetData;
        if (sheet === mockSheet2) return sheet2Data;
        return [];
      }),
    },
  };
});

// Mock apiService
vi.mock("../services/apiService", () => ({
  default: {
    getDocFileDownloadUrl: vi.fn((docId, attId, inline) =>
      `http://localhost/api/v1/documents/${docId}/file/download?token=test${inline ? "&inline=1" : ""}`
    ),
    getToken: vi.fn(() => "fake-token"),
  },
}));

function mockFetchSuccess() {
  global.fetch = vi.fn(() =>
    Promise.resolve({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(100)),
    })
  );
}

function mockFetchError(status = 500) {
  global.fetch = vi.fn(() =>
    Promise.resolve({
      ok: false,
      status,
    })
  );
}

describe("SpreadsheetViewer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchSuccess();
  });

  it("mostra spinner durante il caricamento", () => {
    // Non risolvere mai la promise fetch per mantenere lo stato loading
    global.fetch = vi.fn(() => new Promise(() => {}));

    render(
      <SpreadsheetViewer docId={1} fileName="test.xlsx" onClose={() => {}} />
    );

    expect(screen.getByText("Lettura file in corso...")).toBeInTheDocument();
  });

  it("renderizza la tabella con i dati del primo foglio", async () => {
    render(
      <SpreadsheetViewer docId={1} fileName="report.xlsx" onClose={() => {}} />
    );

    await waitFor(() => {
      expect(screen.getByText("Nome")).toBeInTheDocument();
    });

    expect(screen.getByText("Cognome")).toBeInTheDocument();
    expect(screen.getByText("Età")).toBeInTheDocument();
    expect(screen.getByText("Mario")).toBeInTheDocument();
    expect(screen.getByText("Rossi")).toBeInTheDocument();
  });

  it("mostra tab per fogli multipli", async () => {
    render(
      <SpreadsheetViewer docId={1} fileName="multi.xlsx" onClose={() => {}} />
    );

    await waitFor(() => {
      expect(screen.getByText("Dipendenti")).toBeInTheDocument();
    });

    expect(screen.getByText("Prodotti")).toBeInTheDocument();
  });

  it("switch tra fogli al click sulla tab", async () => {
    render(
      <SpreadsheetViewer docId={1} fileName="multi.xlsx" onClose={() => {}} />
    );

    await waitFor(() => {
      expect(screen.getByText("Dipendenti")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Prodotti"));

    await waitFor(() => {
      expect(screen.getByText("Prodotto")).toBeInTheDocument();
    });
    expect(screen.getByText("Prezzo")).toBeInTheDocument();
  });

  it("mostra errore se il fetch fallisce", async () => {
    mockFetchError(500);

    render(
      <SpreadsheetViewer docId={1} fileName="broken.xlsx" onClose={() => {}} />
    );

    await waitFor(() => {
      expect(screen.getByText(/Errore download/)).toBeInTheDocument();
    });

    expect(
      screen.getByText(/corrotto o in un formato non supportato/)
    ).toBeInTheDocument();
  });

  it("mostra il pulsante Scarica come fallback su errore", async () => {
    mockFetchError(404);

    render(
      <SpreadsheetViewer docId={1} fileName="missing.xlsx" onClose={() => {}} />
    );

    await waitFor(() => {
      expect(screen.getByText(/Scarica il file per aprirlo in Excel/)).toBeInTheDocument();
    });
  });

  it("chiude l'overlay al click sul pulsante chiudi", async () => {
    const onClose = vi.fn();
    render(
      <SpreadsheetViewer docId={1} fileName="test.xlsx" onClose={onClose} />
    );

    await waitFor(() => {
      expect(screen.getByTitle("Chiudi")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTitle("Chiudi"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("chiude al click sull'overlay esterno", async () => {
    const onClose = vi.fn();
    const { container } = render(
      <SpreadsheetViewer docId={1} fileName="test.xlsx" onClose={onClose} />
    );

    await waitFor(() => {
      expect(container.querySelector(".spreadsheet-viewer-overlay")).toBeInTheDocument();
    });

    fireEvent.click(container.querySelector(".spreadsheet-viewer-overlay"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("mostra il nome file nell'header", async () => {
    render(
      <SpreadsheetViewer docId={1} fileName="Budget_2025.xlsx" onClose={() => {}} />
    );

    await waitFor(() => {
      expect(screen.getByText("Budget_2025.xlsx")).toBeInTheDocument();
    });
  });

  it("non renderizza nulla se docId è null", () => {
    const { container } = render(
      <SpreadsheetViewer docId={null} fileName="test.xlsx" onClose={() => {}} />
    );
    expect(container.innerHTML).toBe("");
  });
});

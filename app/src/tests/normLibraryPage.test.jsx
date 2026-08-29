/**
 * Test L1 — NormLibraryPage (LN-1 + LN-2 Libreria)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import NormLibraryPage, {
  LIBRARY_REFERENCE_DOC_TYPES,
  LIBRARY_DOC_TYPE_LABELS,
  resolveValidityStatus,
  resolvePublicationDate,
  resolveTextQuality,
  resolveHasChunks,
  resolveLastValidityCheck,
  libraryDocTypeLabel,
} from "../pages/NormLibraryPage";

const mockGetDocuments = vi.fn();

vi.mock("../services/apiService", () => ({
  default: {
    getDocuments: (...args) => mockGetDocuments(...args),
  },
}));

vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({ user: { role: "admin", organization_id: 1001 } }),
}));

vi.mock("../contexts/RouterContext", () => ({
  Link: ({ to, children, className, title }) => (
    <a href={to} className={className} title={title}>
      {children}
    </a>
  ),
}));

vi.mock("../components/NormUploadButton", () => ({
  default: ({ onUploadComplete }) => (
    <button type="button" data-testid="norm-upload-btn" onClick={() => onUploadComplete?.()}>
      Carica norme PDF
    </button>
  ),
}));

vi.mock("../components/StatusBadge", () => ({
  default: ({ type, status }) => (
    <span data-testid="status-badge" data-type={type} data-status={status}>
      {status}
    </span>
  ),
}));

describe("resolveValidityStatus / resolvePublicationDate", () => {
  it("legge vigore solo su norma (validity_status o norm_validity_status)", () => {
    expect(
      resolveValidityStatus({
        doc_type: "norma",
        norm_validity_status: "vigente",
      })
    ).toBe("vigente");
    expect(
      resolveValidityStatus({
        doc_type: "manuale",
        validity_status: "vigente",
      })
    ).toBeNull();
  });

  it("legge issue_date per non-norma, non inventa publication_date obbligatorio", () => {
    expect(
      resolvePublicationDate({ doc_type: "manuale", issue_date: "2020-05-01" })
    ).toBe("2020-05-01");
    expect(resolvePublicationDate({ doc_type: "altro" })).toBeNull();
    expect(resolvePublicationDate({ doc_type: "norma", issue_date: "2020-01-01" })).toBeNull();
  });
});

describe("NormLibraryPage", () => {
  beforeEach(() => {
    localStorage.clear();
    mockGetDocuments.mockReset();
    mockGetDocuments.mockImplementation(({ doc_type }) => {
      if (doc_type === "norma") {
        return Promise.resolve({
          data: [
            {
              id: 11,
              doc_type: "norma",
              doc_code: "ISO-9001",
              title: "ISO 9001:2015",
              norm_validity_status: "vigente",
              norm_text_quality: "good",
              has_chunks: 1,
              norm_last_check: "2026-08-01T10:00:00.000Z",
            },
          ],
        });
      }
      if (doc_type === "manuale") {
        return Promise.resolve({
          data: [
            {
              id: 22,
              doc_type: "manuale",
              doc_code: "MAN-01",
              title: "Manuale qualità",
              issue_date: "2019-03-15",
            },
          ],
        });
      }
      return Promise.resolve({ data: [] });
    });
  });

  it("renderizza le due sezioni Catalogo e Richieste", async () => {
    render(<NormLibraryPage />);
    expect(screen.getByRole("heading", { name: "Libreria" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /1\. Catalogo ingerito/ })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /2\. Richieste mancanti/ })).toBeTruthy();
    expect(
      screen.getByText(/non inventare soglie/i)
    ).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByText("ISO 9001:2015")).toBeTruthy();
    });
    expect(screen.getByText("Vigente")).toBeTruthy();
    expect(screen.getByText("Manuale qualità")).toBeTruthy();
    expect(screen.getByText("15/03/2019")).toBeTruthy();
    expect(screen.getByText("Manuale / libro")).toBeTruthy();
    expect(screen.getAllByText("Apri in Documenti").length).toBeGreaterThan(0);

    // backlog snapshot presente
    expect(screen.getByText(/ISO 14555/)).toBeTruthy();
    expect(LIBRARY_REFERENCE_DOC_TYPES).toEqual(["norma", "manuale", "altro"]);
    expect(mockGetDocuments).toHaveBeenCalled();
  });

  it("LN-2: deep-link titolo/codice e CTA NormUpload + Apri Documenti", async () => {
    render(<NormLibraryPage />);
    await waitFor(() => {
      expect(screen.getByText("ISO 9001:2015")).toBeTruthy();
    });

    const titleLink = screen.getByText("ISO 9001:2015").closest("a");
    expect(titleLink).toBeTruthy();
    expect(titleLink.getAttribute("href")).toBe("/documents?tab=tree&select=11");

    const codeLink = screen.getByText("ISO-9001").closest("a");
    expect(codeLink.getAttribute("href")).toBe("/documents?tab=tree&select=11");

    const manualLink = screen.getByText("Manuale qualità").closest("a");
    expect(manualLink.getAttribute("href")).toBe("/documents?tab=tree&select=22");

    expect(screen.getByTestId("norm-upload-btn")).toBeTruthy();
    const ctaDocs = screen.getByRole("link", { name: "Apri Documenti" });
    expect(ctaDocs.getAttribute("href")).toContain("/documents");
  });

  it("LN-3: qualità testo, chunk RAG e ultimo check", async () => {
    expect(resolveTextQuality({ norm_text_quality: "partial" })).toBe("partial");
    expect(resolveHasChunks({ has_chunks: 1 })).toBe(true);
    expect(resolveHasChunks({ has_chunks: 0 })).toBe(false);
    expect(resolveLastValidityCheck({ norm_last_check: "2026-08-01" })).toBe("2026-08-01");

    render(<NormLibraryPage />);
    await waitFor(() => {
      expect(screen.getByText("ISO 9001:2015")).toBeTruthy();
    });
    const badge = screen.getByTestId("status-badge");
    expect(badge.getAttribute("data-type")).toBe("norm_quality");
    expect(badge.getAttribute("data-status")).toBe("good");
    expect(screen.getByText("Sì")).toBeTruthy();
    expect(screen.getByText("01/08/2026")).toBeTruthy();
  });

  it("LN-4: label Libreria Manuale/libro e Altro/quaderno senza nuovi doc_type", () => {
    expect(LIBRARY_DOC_TYPE_LABELS.manuale).toBe("Manuale / libro");
    expect(LIBRARY_DOC_TYPE_LABELS.altro).toBe("Altro / quaderno");
    expect(libraryDocTypeLabel("manuale")).toBe("Manuale / libro");
    expect(libraryDocTypeLabel("altro")).toBe("Altro / quaderno");
    expect(LIBRARY_REFERENCE_DOC_TYPES).toEqual(["norma", "manuale", "altro"]);
  });

  it("LN-5: form aggiunge richiesta studio al backlog", async () => {
    render(<NormLibraryPage />);
    await waitFor(() => {
      expect(screen.getByText("ISO 9001:2015")).toBeTruthy();
    });
    const codeInput = screen.getByPlaceholderText(/ISO 17660-1/i);
    fireEvent.change(codeInput, { target: { value: "ISO TEST-LN5" } });
    fireEvent.change(screen.getByPlaceholderText(/WPQR \/ MC/i), {
      target: { value: "Test modulo" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Aggiungi richiesta studio/i }));
    await waitFor(() => {
      expect(screen.getByText("ISO TEST-LN5")).toBeTruthy();
    });
    expect(screen.getByText("Studio")).toBeTruthy();
    expect(screen.getByText("Test modulo")).toBeTruthy();
  });

  it("mostra empty state catalogo se API senza righe", async () => {
    mockGetDocuments.mockResolvedValue({ data: [] });
    render(<NormLibraryPage />);
    await waitFor(() => {
      expect(
        screen.getByText(/Nessuna fonte di riferimento nel Registro/i)
      ).toBeTruthy();
    });
  });
});

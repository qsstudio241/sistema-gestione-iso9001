/**
 * Test L1 — NormLibraryPage (LN-1 + LN-2 Libreria)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import NormLibraryPage, {
  LIBRARY_REFERENCE_DOC_TYPES,
  resolveValidityStatus,
  resolvePublicationDate,
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

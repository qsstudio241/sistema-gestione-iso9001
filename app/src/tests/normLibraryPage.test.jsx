/**
 * Test L1 — NormLibraryPage (LN-1 + LN-2 Libreria + LG-3 coda superadmin)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { readFileSync } from "fs";
import { resolve } from "path";
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
const mockGetLibrarySourceRequests = vi.fn();
const mockGetLibraryPlatformQueue = vi.fn();
const mockAcknowledgeLibrarySourceRequest = vi.fn();
const mockMarkLibrarySourceDigitized = vi.fn();

vi.mock("../services/apiService", () => ({
  default: {
    getDocuments: (...args) => mockGetDocuments(...args),
    getLibrarySourceRequests: (...args) => mockGetLibrarySourceRequests(...args),
    getLibraryPlatformQueue: (...args) => mockGetLibraryPlatformQueue(...args),
    acknowledgeLibrarySourceRequest: (...args) =>
      mockAcknowledgeLibrarySourceRequest(...args),
    markLibrarySourceDigitized: (...args) =>
      mockMarkLibrarySourceDigitized(...args),
  },
}));

let mockAuthUser = { role: "admin", organization_id: 1001 };

vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({ user: mockAuthUser }),
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
    mockAuthUser = { role: "admin", organization_id: 1001 };
    mockGetDocuments.mockReset();
    mockGetLibrarySourceRequests.mockReset();
    mockGetLibraryPlatformQueue.mockReset();
    mockAcknowledgeLibrarySourceRequest.mockReset();
    mockMarkLibrarySourceDigitized.mockReset();
    mockGetLibrarySourceRequests.mockResolvedValue({ items: [] });
    mockGetLibraryPlatformQueue.mockResolvedValue({ items: [] });
    mockMarkLibrarySourceDigitized.mockResolvedValue({
      item: { id: 1, status: "digitized" },
      changed: true,
      tenantEmailed: false,
    });
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
      screen.getByText(/solo dall/i)
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

  it("niente form Aggiungi richiesta studio (solo AI)", async () => {
    render(<NormLibraryPage />);
    await waitFor(() => {
      expect(screen.getByText("ISO 9001:2015")).toBeTruthy();
    });
    expect(
      screen.queryByRole("button", { name: /Aggiungi richiesta studio/i })
    ).toBeNull();
    expect(screen.queryByPlaceholderText(/ISO 17660-1/i)).toBeNull();
  });

  it("nasconde gap Assistente 15614 se snapshot già digitalizzata", async () => {
    mockGetLibrarySourceRequests.mockResolvedValue({
      items: [
        {
          id: 99,
          source_code: "ISO 15614-1:2017",
          reason: "range S355",
          closure_path: "platform",
          status: "open",
        },
      ],
    });
    render(<NormLibraryPage />);
    await waitFor(() => {
      expect(screen.getByText(/ISO 15614-1:2017\+A1/i)).toBeTruthy();
    });
    expect(screen.queryByText("Assistente")).toBeNull();
    const daRichiedere = screen.queryAllByText("Da richiedere");
    expect(daRichiedere).toHaveLength(0);
  });

  it("LG-2: deep-link highlight da query (niente prefill form)", async () => {
    const prev = window.location.search;
    window.history.pushState(
      {},
      "",
      "/settings/libreria?highlight=ISO%2014555%3A2025&path=platform"
    );
    mockGetLibrarySourceRequests.mockResolvedValue({
      items: [
        {
          id: 42,
          source_code: "ISO 99999:2099 UNIQUE-GAP",
          reason: "range stud",
          quality_notes: "OCR",
          closure_path: "platform",
          status: "open",
        },
      ],
    });
    render(<NormLibraryPage />);
    await waitFor(() => {
      expect(screen.getByText(/Arrivi dall/i)).toBeTruthy();
    });
    expect(screen.getByText(/richiesta piattaforma/i)).toBeTruthy();
    expect(screen.queryByPlaceholderText(/ISO 17660-1/i)).toBeNull();
    await waitFor(() => {
      expect(screen.getByText("Assistente")).toBeTruthy();
    });
    window.history.pushState({}, "", prev || "/");
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

  it("admin: non mostra coda gap piattaforma", async () => {
    render(<NormLibraryPage />);
    await waitFor(() => {
      expect(screen.getByText("ISO 9001:2015")).toBeTruthy();
    });
    expect(screen.queryByText(/Coda gap piattaforma/i)).toBeNull();
    expect(mockGetLibraryPlatformQueue).not.toHaveBeenCalled();
  });

  it("LG-4: richiesta tenant closed mostra label Chiusa (ingest tenant)", async () => {
    mockGetLibrarySourceRequests.mockResolvedValue({
      items: [
        {
          id: 88,
          source_code: "ISO TENANT-CLOSE",
          reason: "coprire con ingest",
          closure_path: "tenant",
          status: "closed",
        },
      ],
    });
    render(<NormLibraryPage />);
    await waitFor(() => {
      expect(screen.getByText("ISO TENANT-CLOSE")).toBeTruthy();
    });
    expect(screen.getByText(/Chiusa \(ingest tenant\)/i)).toBeTruthy();
  });
});

describe("NormLibraryPage — LG-3 coda superadmin", () => {
  beforeEach(() => {
    localStorage.clear();
    mockAuthUser = { role: "superadmin", organization_id: 1001 };
    mockGetDocuments.mockReset();
    mockGetLibrarySourceRequests.mockReset();
    mockGetLibraryPlatformQueue.mockReset();
    mockAcknowledgeLibrarySourceRequest.mockReset();
    mockMarkLibrarySourceDigitized.mockReset();
    mockGetLibrarySourceRequests.mockResolvedValue({ items: [] });
    mockGetDocuments.mockResolvedValue({ data: [] });
    mockGetLibraryPlatformQueue.mockResolvedValue({
      items: [
        {
          id: 77,
          source_code: "ISO 14555:2025",
          reason: "range stud",
          quality_notes: "OCR",
          closure_path: "platform",
          status: "open",
          requesting_organization_id: 1002,
          requesting_organization_name: "Studio Beta",
          created_at: "2026-08-30T10:00:00Z",
        },
      ],
    });
    mockAcknowledgeLibrarySourceRequest.mockResolvedValue({
      item: { id: 77, status: "in_progress" },
      changed: true,
    });
    mockMarkLibrarySourceDigitized.mockResolvedValue({
      item: { id: 77, status: "digitized" },
      changed: true,
      tenantEmailed: true,
    });
  });

  it("mostra coda cross-tenant con link Libreria e Segna in corso", async () => {
    render(<NormLibraryPage />);
    await waitFor(() => {
      expect(screen.getByText(/Coda gap piattaforma/i)).toBeTruthy();
    });
    expect(mockGetLibraryPlatformQueue).toHaveBeenCalled();
    expect(screen.getByText("ISO 14555:2025")).toBeTruthy();
    expect(screen.getByText("Studio Beta")).toBeTruthy();
    const link = screen.getByRole("link", { name: /Apri in Libreria/i });
    expect(link.getAttribute("href")).toContain("highlight=ISO");
    expect(link.getAttribute("href")).toContain("path=platform");
    fireEvent.click(screen.getByRole("button", { name: /Segna in corso/i }));
    await waitFor(() => {
      expect(mockAcknowledgeLibrarySourceRequest).toHaveBeenCalledWith(77);
    });
  });

  it("LG-5: Segna digitalizzata apre form e invia mark-digitized", async () => {
    render(<NormLibraryPage />);
    await waitFor(() => {
      expect(screen.getByText(/Coda gap piattaforma/i)).toBeTruthy();
    });
    fireEvent.click(screen.getByRole("button", { name: /Segna digitalizzata/i }));
    await waitFor(() => {
      expect(
        screen.getByLabelText(/Segna digitalizzata piattaforma/i)
      ).toBeTruthy();
    });
    fireEvent.change(screen.getByPlaceholderText(/MD ok/i), {
      target: { value: "MD ok, chunk allineati" },
    });
    fireEvent.click(screen.getByLabelText(/Invia ack email al tenant/i));
    fireEvent.click(screen.getByRole("button", { name: /Conferma digitalizzata/i }));
    await waitFor(() => {
      expect(mockMarkLibrarySourceDigitized).toHaveBeenCalledWith(77, {
        qualityNotes: "MD ok, chunk allineati",
        notifyTenant: true,
      });
    });
  });
});

describe("NormLibraryPage mobile layout contract", () => {
  it("CSS ha media ≤768px con stack colonna (header, digitize form, azioni)", () => {
    const text = readFileSync(
      resolve("src/pages/NormLibraryPage.css"),
      "utf8"
    );
    expect(text).toMatch(/@media\s*\(max-width:\s*768px\)/);
    expect(text).toMatch(/\.nl-header\s*\{[^}]*flex-direction:\s*column/s);
    expect(text).toMatch(
      /\.nl-request-form__row\s*\{[^}]*grid-template-columns:\s*1fr/s
    );
    expect(text).toMatch(
      /\.nl-digitize-form__actions\s*\{[^}]*flex-direction:\s*column/s
    );
    expect(text).toMatch(/-webkit-overflow-scrolling:\s*touch/);
  });

  it("niente form Aggiungi richiesta; header actions presenti", async () => {
    mockAuthUser = { role: "admin", organization_id: 1001 };
    mockGetDocuments.mockResolvedValue({ documents: [] });
    mockGetLibrarySourceRequests.mockResolvedValue({ items: [] });
    render(<NormLibraryPage />);
    await waitFor(() => {
      expect(screen.getByText(/Richieste mancanti/i)).toBeTruthy();
    });
    expect(document.querySelector("form.nl-request-form")).toBeNull();
    expect(
      screen.queryByRole("button", { name: /Aggiungi richiesta studio/i })
    ).toBeNull();
    expect(document.querySelector(".nl-header-actions")).toBeTruthy();
  });
});

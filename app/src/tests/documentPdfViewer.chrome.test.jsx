/**
 * Test L1 — DocumentPdfViewer usa il chrome condiviso (Schermo intero).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import DocumentPdfViewer from "../components/DocumentPdfViewer";

const mockGetDocFileBlob = vi.fn();

vi.mock("../services/apiService", () => ({
  default: {
    getDocFileBlob: (...args) => mockGetDocFileBlob(...args),
    getDocFileDownloadUrl: () => "http://localhost/api/v1/documents/1/file",
  },
}));

describe("DocumentPdfViewer chrome", () => {
  beforeEach(() => {
    window.matchMedia = vi.fn(() => ({
      matches: false,
      media: "",
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    mockGetDocFileBlob.mockReset();
    mockGetDocFileBlob.mockResolvedValue(new Blob(["%PDF"], { type: "application/pdf" }));
  });

  it("toggla Schermo intero sul viewport in-app", async () => {
    const { container } = render(
      <DocumentPdfViewer docId={1} fileName="verbale.pdf" onClose={() => {}} />
    );

    await waitFor(() => {
      expect(screen.getByTitle("Schermo intero")).toBeInTheDocument();
    });

    const overlay = container.querySelector(".pdf-viewer-overlay");
    expect(overlay.classList.contains("pdf-viewer-overlay--fullscreen")).toBe(false);

    fireEvent.click(screen.getByTitle("Schermo intero"));
    expect(overlay.classList.contains("pdf-viewer-overlay--fullscreen")).toBe(true);
    expect(screen.getByTitle("Riduci")).toBeInTheDocument();
    expect(screen.getByTitle("Scarica file")).toBeInTheDocument();
    expect(screen.getByTitle("Chiudi")).toBeInTheDocument();
  });
});

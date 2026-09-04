/**
 * Test L1 — DocumentDocxViewer riusa il chrome condiviso (Schermo intero).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import DocumentDocxViewer from "../components/DocumentDocxViewer";

const mockGetDocFileBlob = vi.fn();

vi.mock("../services/apiService", () => ({
  default: {
    getDocFileBlob: (...args) => mockGetDocFileBlob(...args),
    getDocFileDownloadUrl: () => "http://localhost/api/v1/documents/1/file",
  },
}));

vi.mock("docx-preview", () => ({
  renderAsync: vi.fn().mockResolvedValue(undefined),
}));

describe("DocumentDocxViewer chrome", () => {
  beforeEach(() => {
    mockGetDocFileBlob.mockReset();
    mockGetDocFileBlob.mockResolvedValue(new Blob(["PK"], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }));
  });

  it("toggla Schermo intero sul viewport in-app", async () => {
    const { container } = render(
      <DocumentDocxViewer docId={1} fileName="verbale.docx" onClose={() => {}} />
    );

    await waitFor(() => {
      expect(screen.getByTitle("Schermo intero")).toBeInTheDocument();
    });

    expect(screen.getByText("Sola lettura")).toBeInTheDocument();
    const overlay = container.querySelector(".pdf-viewer-overlay");
    expect(overlay.classList.contains("pdf-viewer-overlay--fullscreen")).toBe(false);

    fireEvent.click(screen.getByTitle("Schermo intero"));
    expect(overlay.classList.contains("pdf-viewer-overlay--fullscreen")).toBe(true);
    expect(screen.getByTitle("Riduci")).toBeInTheDocument();
    expect(screen.getByTitle("Scarica file")).toBeInTheDocument();
    expect(screen.getByTitle("Chiudi")).toBeInTheDocument();
  });
});

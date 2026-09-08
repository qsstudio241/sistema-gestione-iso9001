/**
 * L1 — WbWeldAttachments (ISO-5b foto cordone)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import WbWeldAttachments, { isAcceptedImage } from "../components/WbWeldAttachments.jsx";

vi.mock("../services/apiService", () => ({
  default: {
    get: vi.fn(),
    delete: vi.fn(),
    getToken: vi.fn(() => null),
    baseUrl: "https://example.test/api/v1",
  },
}));

vi.mock("../hooks/useAttachmentManager", () => ({
  compressImageFile: vi.fn(async (f) => f),
}));

vi.mock("../components/RdpTestAttachments.css", () => ({}));

import apiService from "../services/apiService";

describe("isAcceptedImage", () => {
  it("accetta jpeg/png e rifiuta pdf", () => {
    expect(isAcceptedImage({ type: "image/jpeg", name: "a.jpg" })).toBe(true);
    expect(isAcceptedImage({ type: "application/pdf", name: "a.pdf" })).toBe(false);
  });
});

describe("WbWeldAttachments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiService.get.mockResolvedValue({ data: [{ attachment_id: 1, file_name: "c.jpg" }] });
  });

  it("carica lista con welding_book_weld_id e mostra galleria", async () => {
    render(<WbWeldAttachments weldId={42} />);
    await waitFor(() => {
      expect(apiService.get).toHaveBeenCalledWith("/attachments?welding_book_weld_id=42");
    });
    expect(await screen.findByTestId("wb-weld-attachments")).toBeTruthy();
    expect(screen.getByAltText("c.jpg")).toBeTruthy();
  });

  it("senza weldId non monta root", () => {
    const { container } = render(<WbWeldAttachments weldId={null} />);
    expect(container.querySelector("[data-testid=wb-weld-attachments]")).toBeNull();
  });
});

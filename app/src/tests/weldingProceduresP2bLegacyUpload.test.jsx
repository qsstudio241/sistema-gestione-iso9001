/**
 * P2b — upload WPS non e' piu' nel flusso primario (nascosto dietro "Import PDF (legacy)").
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("../services/apiService", () => ({
  default: {
    getCompanies: vi.fn().mockResolvedValue({ data: [{ id: 10, name: "Mason Demo" }] }),
    getWPSList: vi.fn().mockResolvedValue({ data: [], total: 0 }),
    getWPQRList: vi.fn().mockResolvedValue({ data: [], total: 0 }),
    getWPQRStats: vi.fn().mockResolvedValue({ data: {} }),
  },
}));

vi.mock("../components/AskAiButton", () => ({
  default: () => null,
}));

vi.mock("../components/WpsUploadButton", () => ({
  default: () => <div data-testid="wps-upload-mock">upload-mock</div>,
}));

vi.mock("../components/WpqrUploadButton", () => ({
  default: () => null,
}));

vi.mock("../utils/aiAssistantContext", async (importOriginal) => {
  const mod = await importOriginal();
  return {
    ...mod,
    consumeWpsGenerateIntent: () => null,
  };
});

vi.mock("../utils/wordExportWps", () => ({
  exportWpsAnnexADocx: vi.fn(),
}));

import WeldingProceduresPage from "../pages/WeldingProceduresPage";

describe("WeldingProceduresPage P2b legacy upload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("non mostra upload WPS finche' non si apre Import PDF (legacy)", async () => {
    render(<WeldingProceduresPage />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Genera WPS" })).toBeInTheDocument();
    });
    expect(screen.queryByTestId("wps-legacy-upload")).not.toBeInTheDocument();
    expect(screen.queryByTestId("wps-upload-mock")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Import PDF (legacy)" }));
    expect(screen.getByTestId("wps-legacy-upload")).toBeInTheDocument();
    expect(screen.getByTestId("wps-upload-mock")).toBeInTheDocument();
  });
});

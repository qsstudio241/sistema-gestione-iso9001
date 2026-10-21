/**
 * Test L1 — dopo un caricamento in blocco, QualificationsPage incrementa
 * refreshKey così PendingIngestQueue rilegge ingest_staging pending
 * senza ricaricare la pagina.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import React from "react";
import { render, screen, waitFor, fireEvent, cleanup } from "@testing-library/react";

const scopeState = {
  companyId: "10",
  setCompanyId: vi.fn(),
  companies: [{ id: 10, name: "Mason Demo" }],
  reloadCompanies: vi.fn(),
  locked: false,
  companyScoped: false,
  isStudioWide: false,
  isStudioPatrimonio: false,
  scopeReady: true,
  scopeCompanyName: "Mason Demo",
};

vi.mock("../contexts/CompanyScopeContext", () => ({
  useCompanyScope: () => scopeState,
}));
vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({ user: { role: "auditor" }, canWriteModule: () => true }),
}));
vi.mock("../components/QualificationUploadButton", () => ({
  default: ({ onUploadComplete }) => (
    <button type="button" data-testid="simula-fine-batch" onClick={() => onUploadComplete?.()}>
      Simula fine batch
    </button>
  ),
}));
vi.mock("../components/ReprocessQueueBanner", () => ({ default: () => null }));
vi.mock("../components/AskAiButton", () => ({ default: () => null }));
vi.mock("../components/CoverageVerifyPanel", () => ({ default: () => null }));
vi.mock("../pages/QualificationForm", () => ({ default: () => null }));
vi.mock("../components/IngestReviewDialog", () => ({ default: () => null }));

vi.mock("../services/apiService", () => ({
  default: {
    getQualifications: vi.fn(),
    getQualificationsStats: vi.fn(),
    getQualification: vi.fn(),
    getVisionFitnessGaps: vi.fn(),
    listIngestStaging: vi.fn(),
    baseUrl: "https://example.test",
  },
}));

import apiService from "../services/apiService";
import QualificationsPage from "../pages/QualificationsPage";

const PENDING_ITEM = {
  id: 9,
  doc_type: "patentino_saldatore",
  original_name: "ZZ_batch.pdf",
  is_reprocess: false,
  fields: { person_name: "ZZ_Nuovo" },
  warnings: [],
};

beforeEach(() => {
  apiService.getQualifications.mockResolvedValue({ qualifications: [], total: 0 });
  apiService.getQualificationsStats.mockResolvedValue({
    total: 0, valide: 0, in_scadenza_60: 0, in_scadenza_30: 0, scadute: 0, non_attive: 0,
  });
  apiService.getVisionFitnessGaps.mockResolvedValue(null);
  apiService.listIngestStaging.mockResolvedValue({ items: [] });
});

afterEach(() => {
  cleanup();
});

describe("QualificationsPage — refresh coda pending dopo batch", () => {
  it("al termine dell'upload/ingest la coda rilegge i pending restati in staging", async () => {
    render(<QualificationsPage />);
    await waitFor(() => expect(apiService.listIngestStaging).toHaveBeenCalledTimes(1));
    expect(screen.queryByTestId("pending-ingest-queue")).toBeNull();

    apiService.listIngestStaging.mockResolvedValueOnce({ items: [PENDING_ITEM] });
    fireEvent.click(screen.getByTestId("simula-fine-batch"));

    expect(await screen.findByTestId("pending-ingest-queue")).toBeTruthy();
    expect(apiService.listIngestStaging).toHaveBeenCalledTimes(2);
    expect(apiService.listIngestStaging).toHaveBeenLastCalledWith({
      module: "qualifiche",
      reviewStatus: "pending",
      company_id: "10",
    });
    expect(screen.getByText(/in attesa di revisione/i)).toBeTruthy();
    fireEvent.click(screen.getByText("Vedi elenco"));
    expect(screen.getByText("ZZ_Nuovo")).toBeTruthy();
  });
});

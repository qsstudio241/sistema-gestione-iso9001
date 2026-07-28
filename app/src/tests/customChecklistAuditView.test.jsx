/**
 * CustomChecklistAuditView — reference_text sezione + legal_check (ADR-019 D2/D3)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup, within } from "@testing-library/react";

const { mockUpdateCurrentAudit } = vi.hoisted(() => ({
  mockUpdateCurrentAudit: vi.fn(),
}));

vi.mock("../services/apiService", () => ({
  default: {
    getCustomChecklist: vi.fn(),
    getCustomChecklistResponses: vi.fn(),
    saveCustomChecklistResponses: vi.fn(),
    getAttachments: vi.fn().mockResolvedValue({ data: [] }),
  },
}));

vi.mock("../contexts/StorageContext", () => ({
  useStorage: () => ({ updateCurrentAudit: mockUpdateCurrentAudit }),
}));

vi.mock("../hooks/useAttachmentManager", () => ({
  useAttachmentManager: () => null,
}));

vi.mock("../services/syncService", () => ({
  syncService: {
    enqueue: vi.fn(),
    enqueueCustomResponseEvent: vi.fn(),
  },
}));

vi.mock("../components/AskAiButton", () => ({
  default: () => null,
}));

import apiService from "../services/apiService";
import CustomChecklistAuditView from "../components/CustomChecklistAuditView";

const mockChecklist = {
  id: 1,
  has_outcome_buttons: true,
  sections: [
    {
      id: 1,
      code: "5",
      title: "IMPIANTI TERMICI",
      reference_text: null,
      items: [
        { id: 10, code: "a", title: "Domanda verbale", response_type: "verbale" },
        { id: 11, code: "b", title: "Domanda legale", response_type: "legal_check" },
      ],
    },
    {
      id: 2,
      code: "6",
      title: "RIFIUTI",
      reference_text: "D.Lgs. 152/2006 art. 29; art. 30",
      items: [
        { id: 20, code: "a", title: "Verifica rifiuti", response_type: "verbale" },
      ],
    },
  ],
};

const audit = {
  metadata: { customChecklistId: 1, auditId: 99, id: "audit-uuid" },
  customResponses: {},
};

function countStatusButtons() {
  return screen.getAllByRole("button").filter((btn) =>
    ["C", "NC", "NA", "OSS", "OM", "NV"].includes(btn.textContent)
  );
}

describe("CustomChecklistAuditView — registro legale (ADR-019)", () => {
  beforeEach(() => {
    mockUpdateCurrentAudit.mockClear();
    apiService.getCustomChecklist.mockResolvedValue({ data: mockChecklist });
    apiService.getCustomChecklistResponses.mockResolvedValue({ data: [] });
    apiService.getAttachments.mockResolvedValue({ data: [] });
  });

  afterEach(() => {
    cleanup();
  });

  it("sezione senza reference_text: nessun blocco riferimenti normativi", async () => {
    render(<CustomChecklistAuditView audit={audit} />);
    await waitFor(() => {
      expect(screen.getByText("5 - IMPIANTI TERMICI")).toBeInTheDocument();
    });
    const section5 = screen.getByText("5 - IMPIANTI TERMICI").closest(".custom-checklist-section");
    expect(within(section5).queryByText("Riferimenti normativi")).not.toBeInTheDocument();
  });

  it("sezione con reference_text: mostra blocco collassabile", async () => {
    render(<CustomChecklistAuditView audit={audit} />);
    await waitFor(() => {
      expect(screen.getByText("6 - RIFIUTI")).toBeInTheDocument();
    });
    expect(screen.getByText("Riferimenti normativi")).toBeInTheDocument();
    expect(screen.getByText("D.Lgs. 152/2006 art. 29; art. 30")).toBeInTheDocument();
  });

  it("item legal_check: mostra 3 pulsanti esito (C/NC/NA)", async () => {
    render(<CustomChecklistAuditView audit={audit} />);
    await waitFor(() => {
      expect(screen.getByText(/b - Domanda legale/)).toBeInTheDocument();
    });
    const legalCard = screen.getByText(/b - Domanda legale/).closest(".question-card");
    const buttonsInCard = legalCard.querySelectorAll(".status-btn");
    expect(buttonsInCard).toHaveLength(3);
    expect(legalCard.querySelector(".status-btn.compliant")).toBeTruthy();
    expect(legalCard.querySelector(".status-btn.non-compliant")).toBeTruthy();
    expect(legalCard.querySelector(".status-btn.not-applicable")).toBeTruthy();
  });

  it("item verbale: mantiene 6 pulsanti esito standard", async () => {
    render(<CustomChecklistAuditView audit={audit} />);
    await waitFor(() => {
      expect(screen.getByText(/a - Domanda verbale/)).toBeInTheDocument();
    });
    const verbaleCard = screen.getByText(/a - Domanda verbale/).closest(".question-card");
    const buttonsInCard = verbaleCard.querySelectorAll(".status-btn");
    expect(buttonsInCard).toHaveLength(6);
    expect(countStatusButtons().length).toBeGreaterThanOrEqual(9);
  });
});

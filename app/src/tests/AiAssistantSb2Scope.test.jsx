/**
 * SB-2: chat Assistente usa CompanyScopeContext (header Ambito), non un secondo selettore.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import React from "react";

const mockAiChat = vi.fn();
const scopeState = {
  companyId: "11",
  scopeCompanyName: "Mason",
  companies: [{ id: 11, name: "Mason" }, { id: 22, name: "Camellini" }],
  scopeReady: true,
  locked: false,
};

vi.mock("../services/apiService", () => ({
  default: {
    aiChat: (...args) => mockAiChat(...args),
    getCompanies: vi.fn().mockResolvedValue({ data: [] }),
    getAmbitoFacts: vi.fn().mockResolvedValue({ data: { ready: false } }),
    generateWPS: vi.fn(),
    get: vi.fn().mockResolvedValue({ figures: [] }),
    searchFiguresByImage: vi.fn(),
  },
}));

vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({
    user: {
      id: 1,
      organization_id: 1001,
      organization_name: "Studio",
      role: "admin",
      allowed_standard_ids: null,
    },
  }),
}));

vi.mock("../contexts/StorageContext", () => ({
  useStorage: () => ({
    currentAudit: null,
    currentAuditId: null,
  }),
}));

vi.mock("../contexts/CompanyScopeContext", () => ({
  useCompanyScope: () => scopeState,
}));

vi.mock("../components/AmbitoFactsBar", () => ({
  default: () => <div data-testid="ambito-facts-bar">facts</div>,
}));

vi.mock("../components/AiDisclaimer", () => ({
  default: () => null,
}));

vi.mock("../components/FileDropzone", () => ({
  default: () => null,
}));

vi.mock("../components/AiAssistantCitations", () => ({
  default: () => null,
}));

vi.mock("../components/AiAssistantSourceGaps", () => ({
  default: () => null,
}));

import AiAssistantPage from "../pages/AiAssistantPage";

describe("AiAssistantPage SB-2 Ambito header unico", () => {
  beforeEach(() => {
    mockAiChat.mockReset();
    mockAiChat.mockResolvedValue({
      data: { reply: "ok", citations: [], contextUsed: 0 },
    });
    scopeState.companyId = "11";
    scopeState.scopeCompanyName = "Mason";
    scopeState.locked = false;
    scopeState.scopeReady = true;
    sessionStorage.clear();
    Element.prototype.scrollIntoView = vi.fn();
  });

  it("mostra Ambito dal CompanyScope senza dropdown aziende locale", () => {
    render(<AiAssistantPage />);
    expect(screen.getByLabelText("Ambito: Mason")).toBeTruthy();
    expect(screen.queryByText("Vista complessiva")).toBeNull();
    expect(screen.queryByRole("button", { name: /Ambito: Mason/ })).toBeNull();
  });

  it("invia companyId dello scope in aiChat", async () => {
    render(<AiAssistantPage />);
    const input = screen.getByPlaceholderText(/Scrivi la tua domanda/i);
    await act(async () => {
      fireEvent.change(input, { target: { value: "Quante NC?" } });
      fireEvent.keyDown(input, { key: "Enter", code: "Enter" });
    });
    await waitFor(() => expect(mockAiChat).toHaveBeenCalled());
    const [, opts] = mockAiChat.mock.calls[0];
    expect(opts.companyId).toBe(11);
  });

  it("con Ambito studio-wide invia companyId null", async () => {
    scopeState.companyId = "";
    scopeState.scopeCompanyName = "Tutto lo studio";
    render(<AiAssistantPage />);
    expect(screen.getByLabelText("Ambito: tutto lo studio")).toBeTruthy();
    const input = screen.getByPlaceholderText(/Scrivi la tua domanda/i);
    await act(async () => {
      fireEvent.change(input, { target: { value: "Riepilogo" } });
      fireEvent.keyDown(input, { key: "Enter", code: "Enter" });
    });
    await waitFor(() => expect(mockAiChat).toHaveBeenCalled());
    const [, opts] = mockAiChat.mock.calls[0];
    expect(opts.companyId).toBeNull();
  });
});

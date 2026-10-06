/**
 * Test L1 — WeldingProceduresPage (tab WPQR), card statistiche vs tendina
 * "approval_status" (fix 10/08/2026 — DEPUTYTASK4, quarta applicazione della
 * regola "Filtri: singola fonte di verità" dopo Qualifiche PR #368,
 * Scadenzari PR #371/#375, NC PR #374 — v. sgq-operating-memory.mdc § Filtri).
 *
 * Mappatura: le card sono calcolate SOLO su wpqr_records (getWPQRStats) — non
 * hanno alcun significato nel tab WPS, quindi sono mostrate solo quando
 * activeTab === "wpqr". 3 card cliccabili (Da approvare/Approvate/Rifiutate),
 * tendina approval_status rimossa. Le card semaforo scadenza (Valide/Scad.60/
 * Scad.30/Scadute) sono state tolte: WPQR non ha expiry_date (ISO 15614/15613/14555).
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("../services/apiService", () => ({
  default: {
    getCompanies: vi.fn(),
    getWPSList: vi.fn(),
    getWPQRList: vi.fn(),
    getWPQRStats: vi.fn(),
    baseUrl: "",
  },
}));

vi.mock("../components/AskAiButton", () => ({ default: () => null }));
vi.mock("../components/WpsUploadButton", () => ({ default: () => null }));
vi.mock("../components/WpqrUploadButton", () => ({ default: () => null }));
vi.mock("../components/ReprocessQueueBanner", () => ({ default: () => null }));

import apiService from "../services/apiService";
import WeldingProceduresPage from "../pages/WeldingProceduresPage";

const STATS = {
  totale: 10, da_approvare: 2, rifiutate: 1, approvate: 7,
};

describe("WeldingProceduresPage — card statistiche WPQR sostituiscono la tendina approval_status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiService.getCompanies.mockResolvedValue({ data: [{ id: 10, name: "Mason Demo" }] });
    apiService.getWPSList.mockResolvedValue({ data: [], pagination: { total: 0 } });
    apiService.getWPQRList.mockResolvedValue({
      data: [{ id: 1, wpqr_code: "WPQR-001", approval_status: "bozza" }],
      pagination: { total: 1 },
    });
    apiService.getWPQRStats.mockResolvedValue({ data: STATS });
  });

  it("non mostra la barra statistiche nel tab WPS (le card sono solo WPQR)", async () => {
    render(<WeldingProceduresPage />);
    await waitFor(() => expect(apiService.getWPQRStats).toHaveBeenCalled());

    expect(screen.queryByText("Da approvare")).toBeNull();
    expect(screen.queryByText("Approvate")).toBeNull();
  });

  it("mostra la barra statistiche con le card cliccabili nel tab WPQR", async () => {
    const user = userEvent.setup();
    render(<WeldingProceduresPage />);
    await waitFor(() => expect(apiService.getWPQRStats).toHaveBeenCalled());

    await user.click(screen.getByRole("button", { name: /^WPQR/i }));
    await waitFor(() => expect(apiService.getWPQRList).toHaveBeenCalled());

    expect(screen.queryByText("Valide")).toBeNull();
    expect(screen.queryByText("Scadute")).toBeNull();
    expect(screen.getByRole("button", { name: /Da approvare/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Approvate/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Rifiutate/i })).toBeTruthy();
  });

  it("non mostra più la tendina 'Tutti gli stati' (approval_status, rimossa, ridondante con le card)", async () => {
    const user = userEvent.setup();
    render(<WeldingProceduresPage />);
    await waitFor(() => expect(apiService.getWPQRStats).toHaveBeenCalled());
    await user.click(screen.getByRole("button", { name: /^WPQR/i }));
    await waitFor(() => expect(apiService.getWPQRList).toHaveBeenCalled());

    expect(screen.queryByText("Tutti gli stati")).toBeNull();
    expect(screen.queryByRole("option", { name: "Bozza" })).toBeNull();
    expect(screen.queryByRole("option", { name: "Rifiutata" })).toBeNull();
  });

  it("cliccando la card 'Rifiutate' filtra con approval_status=rifiutata (valore prima raggiungibile solo dalla tendina)", async () => {
    const user = userEvent.setup();
    render(<WeldingProceduresPage />);
    await waitFor(() => expect(apiService.getWPQRStats).toHaveBeenCalled());
    await user.click(screen.getByRole("button", { name: /^WPQR/i }));
    await waitFor(() => expect(apiService.getWPQRList).toHaveBeenCalled());

    apiService.getWPQRList.mockClear();
    await user.click(screen.getByRole("button", { name: /Rifiutate/i }));

    await waitFor(() => {
      expect(apiService.getWPQRList).toHaveBeenCalledWith(
        expect.objectContaining({ approval_status: "rifiutata" })
      );
    });
    expect(screen.getByRole("button", { name: /Rifiutate/i })).toHaveClass("wp-stat-active");
  });

  it("cliccando di nuovo la card attiva la deseleziona (toggle, nessun filtro perso)", async () => {
    const user = userEvent.setup();
    render(<WeldingProceduresPage />);
    await waitFor(() => expect(apiService.getWPQRStats).toHaveBeenCalled());
    await user.click(screen.getByRole("button", { name: /^WPQR/i }));
    await waitFor(() => expect(apiService.getWPQRList).toHaveBeenCalled());

    const daApprovareCard = screen.getByRole("button", { name: /Da approvare/i });
    await user.click(daApprovareCard);
    await waitFor(() => expect(daApprovareCard).toHaveClass("wp-stat-active"));

    apiService.getWPQRList.mockClear();
    await user.click(daApprovareCard);
    await waitFor(() => expect(daApprovareCard).not.toHaveClass("wp-stat-active"));
    await waitFor(() => {
      expect(apiService.getWPQRList).toHaveBeenCalledWith(
        expect.not.objectContaining({ approval_status: expect.anything() })
      );
    });
  });
});

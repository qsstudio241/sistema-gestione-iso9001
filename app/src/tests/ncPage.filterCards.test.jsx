/**
 * Test L1 — NCPage, card statistiche vs tendine "Stato"/"Tutte le scadenze"
 * (fix 10/08/2026 — terza applicazione della regola "Filtri: singola fonte
 * di verità" dopo Qualifiche PR #368 e Scadenzari PR #371, v.
 * sgq-operating-memory.mdc § Filtri).
 *
 * Le due tendine duplicavano le card statistiche (Aperte/Scadute/In scadenza)
 * tranne per il valore "Chiuse" (raggiungibile solo dalla tendina "Stato"):
 * consolidato ora nella nuova card "Chiuse", tendine rimosse. La card
 * "In scadenza" (prima gated da dueSoonCount > 0) è ora sempre visibile per
 * non perdere l'unico accesso UI al filtro due_within_days quando la
 * tendina non esiste più.
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("../contexts/RouterContext", () => ({
  useRouter: () => ({ replace: vi.fn(), navigate: vi.fn(), path: "/nc" }),
}));

vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({ user: { role: "admin", full_name: "Mario Rossi" } }),
}));

vi.mock("../services/apiService", () => ({
  default: {
    getCompanies: vi.fn(),
    getAllNonConformities: vi.fn(),
    getNcStats: vi.fn(),
    getAggregateDueNcActions: vi.fn(),
  },
}));

import apiService from "../services/apiService";
import NCPage from "../pages/NCPage";

const NC_LIST = [
  { nc_id: 1, nc_number: "NC-2026-001", status: "open",   severity: "major", due_date: "2026-09-01", source_type: "audit", is_overdue: 0 },
  { nc_id: 2, nc_number: "NC-2026-002", status: "closed", severity: "minor", due_date: "2026-07-01", source_type: "audit", is_overdue: 0 },
];

const STATS = {
  open: 1, open_like: 1, closed: 3, total: 4,
  overdue: 2, due_soon: 0,
};

async function renderNcWithStats() {
  render(<NCPage />);
  // waitFor(apiCalled) non equivale a "la UI ha i dati" (lezione GUIDA 13/08/2026).
  return screen.findByRole("button", { name: /Chiuse/i });
}

describe("NCPage — card statistiche sostituiscono le tendine Stato/Scadenze", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiService.getCompanies.mockResolvedValue({ data: [] });
    apiService.getAllNonConformities.mockResolvedValue({ data: NC_LIST, pagination: { totalPages: 1 } });
    apiService.getNcStats.mockResolvedValue({ data: STATS });
    apiService.getAggregateDueNcActions.mockResolvedValue({ data: [] });
  });

  it("non mostra più la tendina 'Tutti gli stati' (rimossa, ridondante con le card Aperte/Chiuse)", async () => {
    await renderNcWithStats();

    expect(screen.queryByText("Tutti gli stati")).toBeNull();
    expect(screen.queryByRole("option", { name: "Chiuse" })).toBeNull();
  });

  it("non mostra più la tendina 'Tutte le scadenze' (rimossa, ridondante con le card Scadute/In scadenza)", async () => {
    await renderNcWithStats();

    expect(screen.queryByText("Tutte le scadenze")).toBeNull();
    expect(screen.queryByText("Solo scadute")).toBeNull();
    expect(screen.queryByText("In scadenza (7 gg)")).toBeNull();
  });

  it("mostra la card 'Chiuse' con il conteggio da stats.closed", async () => {
    const closedCard = await renderNcWithStats();
    expect(closedCard.textContent).toContain("3");
    expect(closedCard.textContent).toContain("Chiuse");
  });

  it("cliccando la card 'Chiuse' filtra con status=closed", async () => {
    const user = userEvent.setup();
    const closedCard = await renderNcWithStats();

    apiService.getAllNonConformities.mockClear();
    await user.click(closedCard);

    await waitFor(() => {
      expect(apiService.getAllNonConformities).toHaveBeenCalledWith(
        expect.objectContaining({ status: "closed" })
      );
    });
    expect(closedCard).toHaveClass("nc-stat-active");
  });

  it("la card 'In scadenza' è visibile anche quando il conteggio due_soon è 0 (nessuna gating condizionale)", async () => {
    await renderNcWithStats();

    // getByTitle (non getByRole name): il pulsante header "Azioni in scadenza"
    // collide con la regex /In scadenza/i sul nome accessibile.
    const soonCard = screen.getByTitle("Filtra: NC in scadenza entro 7 giorni");
    expect(soonCard.textContent).toContain("0");
    expect(soonCard.textContent).toContain("In scadenza");
  });

  it("cliccando la card 'In scadenza' filtra con due_within_days=7 (valore prima raggiungibile solo dalla tendina)", async () => {
    const user = userEvent.setup();
    await renderNcWithStats();

    apiService.getAllNonConformities.mockClear();
    await user.click(screen.getByTitle("Filtra: NC in scadenza entro 7 giorni"));

    await waitFor(() => {
      expect(apiService.getAllNonConformities).toHaveBeenCalledWith(
        expect.objectContaining({ due_within_days: "7" })
      );
    });
  });

  it("la card 'Aperte' continua a funzionare con toggle attivo/disattivo (clic di nuovo per deselezionare)", async () => {
    const user = userEvent.setup();
    await renderNcWithStats();

    const openCard = screen.getByRole("button", { name: /Aperte/i });
    await user.click(openCard);
    await waitFor(() => expect(openCard).toHaveClass("nc-stat-active"));

    await user.click(openCard);
    await waitFor(() => expect(openCard).not.toHaveClass("nc-stat-active"));
  });

  it("la card 'Scadute' continua a filtrare con overdue=true", async () => {
    const user = userEvent.setup();
    await renderNcWithStats();

    apiService.getAllNonConformities.mockClear();
    await user.click(screen.getByRole("button", { name: /Scadute/i }));

    await waitFor(() => {
      expect(apiService.getAllNonConformities).toHaveBeenCalledWith(
        expect.objectContaining({ overdue: "true" })
      );
    });
  });

  it("la card 'Totale' continua a resettare i filtri di stato/scadenza", async () => {
    const user = userEvent.setup();
    await renderNcWithStats();

    await user.click(screen.getByRole("button", { name: /Scadute/i }));
    await waitFor(() => expect(screen.getByRole("button", { name: /Scadute/i })).toHaveClass("nc-stat-active"));

    await user.click(screen.getByRole("button", { name: /Totale/i }));
    await waitFor(() => expect(screen.getByRole("button", { name: /Totale/i })).toHaveClass("nc-stat-active"));
    expect(screen.getByRole("button", { name: /Scadute/i })).not.toHaveClass("nc-stat-active");
  });
});

/**
 * Test L1 — DeadlinesPage, card statistiche vs tendina "Stato" (fix 10/08/2026)
 *
 * Segue lo stesso principio applicato in Qualifiche (PR #368, v.
 * sgq-operating-memory.mdc § Filtri: singola fonte di verità): la tendina
 * "Stato" duplicava le card statistiche (Attive/Completate) e per le due
 * opzioni residue (Archiviati/Presi in carico) non esisteva nessuna card —
 * consolidate ora in "Archiviate"/"Prese in carico", tendina rimossa.
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("../contexts/RouterContext", () => ({
  useRouter: () => ({ navigate: vi.fn(), path: "/deadlines" }),
}));

vi.mock("../services/apiService", () => ({
  default: {
    getDeadlineItems: vi.fn(),
    getCompanies: vi.fn(),
    completeDeadlineItem: vi.fn(),
  },
}));

import apiService from "../services/apiService";
import DeadlinesPage from "../pages/DeadlinesPage";

const ITEMS = [
  { id: 1, title: "Doc attivo", status: "active",               days_until_due: 10,  company_id: 1, company_name: "ACME" },
  { id: 2, title: "Doc scaduto", status: "active",               days_until_due: -5,  company_id: 1, company_name: "ACME" },
  { id: 3, title: "Doc completato", status: "completed",         days_until_due: 3,   company_id: 1, company_name: "ACME" },
  { id: 4, title: "Doc archiviato", status: "dismissed",         days_until_due: -40, company_id: 1, company_name: "ACME" },
  { id: 5, title: "Doc preso in carico", status: "expired_acknowledged", days_until_due: -20, company_id: 1, company_name: "ACME" },
];

describe("DeadlinesPage — card statistiche sostituiscono la tendina Stato", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiService.getDeadlineItems.mockResolvedValue({ data: ITEMS });
    apiService.getCompanies.mockResolvedValue({ data: [{ id: 1, name: "ACME" }] });
  });

  it("non mostra più la tendina 'Filtra per Stato' (rimossa, ridondante con le card)", async () => {
    render(<DeadlinesPage />);
    await waitFor(() => expect(apiService.getDeadlineItems).toHaveBeenCalled());

    expect(screen.queryByLabelText("Stato")).toBeNull();
  });

  it("mostra le card Archiviate e Prese in carico con i conteggi corretti", async () => {
    render(<DeadlinesPage />);
    await waitFor(() => expect(apiService.getDeadlineItems).toHaveBeenCalled());

    const dismissedCard = screen.getByRole("button", { name: /Archiviate/i });
    const ackCard = screen.getByRole("button", { name: /Prese in carico/i });
    expect(dismissedCard.textContent).toContain("1");
    expect(dismissedCard.textContent).toContain("Archiviate");
    expect(ackCard.textContent).toContain("1");
    expect(ackCard.textContent).toContain("Prese in carico");
  });

  it("cliccando la card 'Archiviate' filtra la lista alla sola riga dismissed", async () => {
    const user = userEvent.setup();
    render(<DeadlinesPage />);
    await waitFor(() => expect(apiService.getDeadlineItems).toHaveBeenCalled());

    expect(screen.getByText("Doc attivo")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: /Archiviate/i }));

    expect(screen.getByText("Doc archiviato")).toBeTruthy();
    expect(screen.queryByText("Doc attivo")).toBeNull();
    expect(screen.queryByText("Doc completato")).toBeNull();
  });
});

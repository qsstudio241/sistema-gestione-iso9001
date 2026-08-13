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
    updateDeadlineItem: vi.fn(),
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
    apiService.updateDeadlineItem.mockResolvedValue({ success: true });
  });

  it("non mostra più la tendina 'Filtra per Stato' (rimossa, ridondante con le card)", async () => {
    render(<DeadlinesPage />);
    await waitFor(() => expect(apiService.getDeadlineItems).toHaveBeenCalled());

    expect(screen.queryByLabelText("Stato")).toBeNull();
  });

  it("mostra le card Archiviate e Prese in carico con i conteggi corretti", async () => {
    render(<DeadlinesPage />);
    await waitFor(() => {
      const dismissedCard = screen.getByRole("button", { name: /Archiviate/i });
      expect(dismissedCard.textContent).toContain("1");
    });

    const dismissedCard = screen.getByRole("button", { name: /Archiviate/i });
    const ackCard = screen.getByRole("button", { name: /Prese in carico/i });
    expect(dismissedCard.textContent).toContain("Archiviate");
    expect(ackCard.textContent).toContain("1");
    expect(ackCard.textContent).toContain("Prese in carico");
  });

  // Regressione (rilievo Bugbot 10/08/2026): le righe virtuali tarature
  // (item_type='equipment', id tipo "equipment_N") non sono record reali di
  // deadline_items — il pulsante "Segna completato" chiamerebbe
  // completeDeadlineItem con un id non numerico e fallirebbe. Prima del fix
  // mapEquipmentDeadlineRows usava status:'expired' per le tarature scadute,
  // che nascondeva il bug per coincidenza (row.status !== 'active' → null);
  // portando lo status sempre a 'active' il pulsante sarebbe tornato visibile
  // senza l'esclusione esplicita per item_type.
  it("non mostra 'Segna completato' per le righe virtuali tarature (item_type='equipment')", async () => {
    apiService.getDeadlineItems.mockResolvedValue({
      data: [
        { id: "equipment_1", item_type: "equipment", title: "Termometro", status: "active", days_until_due: -3, company_id: 1, company_name: "ACME" },
      ],
    });

    render(<DeadlinesPage />);
    // Attendere la riga, non solo la chiamata API: getDeadlineItems() puo'
    // risultare called mentre la griglia e' ancora in "Caricamento..." (flake CI).
    await waitFor(() => expect(screen.getByText("Termometro")).toBeTruthy());
    expect(screen.queryByTitle("Segna completato")).toBeNull();
  });

  it("cliccando la card 'Archiviate' filtra la lista alla sola riga dismissed", async () => {
    const user = userEvent.setup();
    render(<DeadlinesPage />);
    await waitFor(() => expect(screen.getByText("Doc attivo")).toBeTruthy());

    await user.click(screen.getByRole("button", { name: /Archiviate/i }));

    expect(screen.getByText("Doc archiviato")).toBeTruthy();
    expect(screen.queryByText("Doc attivo")).toBeNull();
    expect(screen.queryByText("Doc completato")).toBeNull();
  });
});

/**
 * Test L1 — DeadlinesPage, azioni "Archivia"/"Prendi in carico" (audit
 * follow-up PR #371, 10/08/2026): le card "Archiviate"/"Prese in carico"
 * filtravano correttamente ma nessuna azione UI permetteva di portare un item
 * in quegli stati — l'unica azione era "OK" (→ completed). Aggiunte due
 * azioni per generalizzare handleComplete su tutti gli stati lifecycle.
 */
describe("DeadlinesPage — azioni Archivia / Prendi in carico", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiService.getCompanies.mockResolvedValue({ data: [{ id: 1, name: "ACME" }] });
    apiService.updateDeadlineItem.mockResolvedValue({ success: true });
  });

  it("mostra 'Prendi in carico' solo per righe attive già scadute (days_until_due < 0)", async () => {
    apiService.getDeadlineItems.mockResolvedValue({ data: ITEMS });
    render(<DeadlinesPage />);
    await waitFor(() => expect(screen.getByText("Doc attivo")).toBeTruthy());

    // Filtro default 'active': solo "Doc attivo" (+10gg) e "Doc scaduto" (-5gg) visibili.
    expect(screen.getByText("Doc scaduto")).toBeTruthy();

    const ackButtons = screen.getAllByRole("button", { name: "Prendi in carico" });
    expect(ackButtons).toHaveLength(1);

    const dismissButtons = screen.getAllByRole("button", { name: "Archivia" });
    expect(dismissButtons).toHaveLength(2);
  });

  it("cliccando 'Archivia' chiama updateDeadlineItem con status 'dismissed' e rimuove la riga dal filtro attivo", async () => {
    const user = userEvent.setup();
    apiService.getDeadlineItems.mockResolvedValue({
      data: [{ id: 10, title: "Riga da archiviare", status: "active", days_until_due: 5, company_id: 1, company_name: "ACME" }],
    });
    render(<DeadlinesPage />);
    await waitFor(() => expect(screen.getByText("Riga da archiviare")).toBeTruthy());

    await user.click(screen.getByRole("button", { name: "Archivia" }));

    await waitFor(() => expect(apiService.updateDeadlineItem).toHaveBeenCalledWith(10, { status: "dismissed" }));
    // Il filtro default resta 'active': la riga ora 'dismissed' sparisce dalla vista.
    await waitFor(() => expect(screen.queryByText("Riga da archiviare")).toBeNull());
  });

  it("cliccando 'Prendi in carico' chiama updateDeadlineItem con status 'expired_acknowledged'", async () => {
    const user = userEvent.setup();
    apiService.getDeadlineItems.mockResolvedValue({
      data: [{ id: 11, title: "Riga scaduta da gestire", status: "active", days_until_due: -3, company_id: 1, company_name: "ACME" }],
    });
    render(<DeadlinesPage />);
    await waitFor(() => expect(screen.getByText("Riga scaduta da gestire")).toBeTruthy());

    await user.click(screen.getByRole("button", { name: "Prendi in carico" }));

    await waitFor(() => expect(apiService.updateDeadlineItem).toHaveBeenCalledWith(11, { status: "expired_acknowledged" }));
    await waitFor(() => expect(screen.queryByText("Riga scaduta da gestire")).toBeNull());
  });

  it("non mostra 'Archivia'/'Prendi in carico' per le righe già non-attive (es. completed)", async () => {
    apiService.getDeadlineItems.mockResolvedValue({
      data: [{ id: 12, title: "Riga completata", status: "completed", days_until_due: -3, company_id: 1, company_name: "ACME" }],
    });
    render(<DeadlinesPage />);
    await waitFor(() => {
      const card = screen.getByRole("button", { name: /Completate/i });
      expect(card.textContent).toContain("1");
    });

    // Filtro default 'active' non mostra la riga completata; forziamo la card "Completate".
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Completate/i }));
    await waitFor(() => expect(screen.getByText("Riga completata")).toBeTruthy());

    expect(screen.queryByRole("button", { name: "Archivia" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Prendi in carico" })).toBeNull();
  });
});

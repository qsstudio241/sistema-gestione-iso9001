/**
 * Test L1 — SemiannualConfirmationSection
 * Copre: pulsante Modifica su conferma già registrata + salvataggio via API
 * (rilievo Mason 24/08/2026: date non editabili dopo insert).
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";

vi.mock("../services/apiService", () => ({
  default: {
    getQualificationConfirmations: vi.fn(),
    updateQualificationConfirmation: vi.fn(),
    confirmQualificationSemiannual: vi.fn(),
    downloadQualificationConfirmationsExport: vi.fn(),
  },
}));

import apiService from "../services/apiService";
import SemiannualConfirmationSection from "../components/SemiannualConfirmationSection";

describe("SemiannualConfirmationSection — modifica conferma esistente", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiService.getQualificationConfirmations.mockResolvedValue({
      confirmations: [
        {
          id: 77,
          confirmed_at: "2026-01-10",
          confirmer_name: "Mario Rossi",
          confirmer_title: "IWE",
          notes: "Prima conferma",
        },
      ],
      can_confirm: true,
      last_confirmation_date: "2026-01-10",
      next_confirmation_due: "2026-07-10",
    });
    apiService.updateQualificationConfirmation.mockResolvedValue({
      success: true,
      confirmation: { id: 77, confirmed_at: "2026-03-15", notes: "Corretto" },
      last_confirmation_date: "2026-03-15",
      next_confirmation_due: "2026-09-15",
    });
  });

  it("mostra Modifica e salva la nuova data via updateQualificationConfirmation", async () => {
    await act(async () => {
      render(
        <SemiannualConfirmationSection
          qualificationId={10}
          qualificationType="Saldatore ISO 9606-1"
          approvalStatus="approvata"
          lastConfirmationDate="2026-01-10"
          nextConfirmationDue="2026-07-10"
          openByDefault
        />,
      );
    });

    await waitFor(() => {
      expect(screen.getByText("Modifica")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Modifica"));
    const dateInput = screen.getByLabelText("Data conferma da correggere");
    fireEvent.change(dateInput, { target: { value: "2026-03-15" } });
    fireEvent.click(screen.getByText("Salva"));

    await waitFor(() => {
      expect(apiService.updateQualificationConfirmation).toHaveBeenCalledWith(10, 77, {
        confirmed_at: "2026-03-15",
        notes: "Prima conferma",
      });
    });
  });

  it("senza can_confirm non mostra il pulsante Modifica", async () => {
    apiService.getQualificationConfirmations.mockResolvedValue({
      confirmations: [
        { id: 77, confirmed_at: "2026-01-10", confirmer_name: "Mario Rossi", notes: null },
      ],
      can_confirm: false,
      last_confirmation_date: "2026-01-10",
      next_confirmation_due: "2026-07-10",
    });

    await act(async () => {
      render(
        <SemiannualConfirmationSection
          qualificationId={10}
          qualificationType="Saldatore ISO 9606-1"
          approvalStatus="approvata"
          openByDefault
        />,
      );
    });

    await waitFor(() => {
      expect(apiService.getQualificationConfirmations).toHaveBeenCalled();
    });
    expect(screen.queryByText("Modifica")).not.toBeInTheDocument();
  });
});

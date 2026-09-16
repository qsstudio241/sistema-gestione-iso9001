/**
 * Test L1 — QualificationForm auto-save: aprire modifica NON deve salvare
 * né notificare onSaved. Mason 16/09/2026: la finestra si apriva e si
 * richiudeva in pochi secondi perché l'idratazione del form sparava
 * update + onSaved={handleSaved} (chiudeva il modal).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";

vi.mock("../services/apiService", () => ({
  default: {
    getCompanies: vi.fn(),
    getCompanyPersonnel: vi.fn(),
    getQualificationConfirmations: vi.fn(),
    updateQualification: vi.fn(),
    createQualification: vi.fn(),
    renewQualification: vi.fn(),
  },
}));

import apiService from "../services/apiService";
import QualificationForm from "../pages/QualificationForm";

const WELDER = {
  id: 7,
  person_name: "Mario Rossi",
  qualification_type: "Saldatore ISO 9606-1",
  company_id: 10,
  company_name: "Mason Demo",
  certificate_number: "ISO-001",
  expiry_date: "2027-01-15",
  notes: "",
  approval_status: "bozza",
};

beforeEach(() => {
  vi.useFakeTimers();
  apiService.getCompanies.mockResolvedValue({ data: [{ id: 10, name: "Mason Demo" }] });
  apiService.getCompanyPersonnel.mockResolvedValue({ data: [] });
  apiService.getQualificationConfirmations.mockResolvedValue({
    confirmations: [],
    can_confirm: false,
  });
  apiService.updateQualification.mockResolvedValue({ id: 7 });
  apiService.createQualification.mockResolvedValue({ id: 99 });
});

afterEach(() => {
  vi.useRealTimers();
});

async function flushAutosaveWindow() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1600);
  });
}

describe("QualificationForm — auto-save non chiude all'apertura", () => {
  it("aprire modifica: nessun PUT e nessun onSaved dopo il debounce", async () => {
    const onSaved = vi.fn();
    const onClose = vi.fn();

    await act(async () => {
      render(
        <QualificationForm
          qualification={WELDER}
          onSaved={onSaved}
          onClose={onClose}
        />
      );
    });

    expect(screen.getByText(/Modifica qualifica/)).toBeInTheDocument();
    await flushAutosaveWindow();

    expect(apiService.updateQualification).not.toHaveBeenCalled();
    expect(apiService.createQualification).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText(/Modifica qualifica/)).toBeInTheDocument();
  });

  it("dopo una modifica utente: auto-save chiama update + onSaved, la finestra resta", async () => {
    const onSaved = vi.fn();
    const onClose = vi.fn();

    await act(async () => {
      render(
        <QualificationForm
          qualification={WELDER}
          onSaved={onSaved}
          onClose={onClose}
        />
      );
    });

    fireEvent.change(screen.getByPlaceholderText("Note aggiuntive..."), {
      target: { value: "Nota Mason" },
    });
    await flushAutosaveWindow();

    expect(apiService.updateQualification).toHaveBeenCalledTimes(1);
    expect(apiService.updateQualification.mock.calls[0][0]).toBe(7);
    expect(apiService.updateQualification.mock.calls[0][1]).toEqual(
      expect.objectContaining({ notes: "Nota Mason", person_name: "Mario Rossi" })
    );
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText(/Modifica qualifica/)).toBeInTheDocument();
    expect(screen.getByText(/Salvato/)).toBeInTheDocument();
  });
});

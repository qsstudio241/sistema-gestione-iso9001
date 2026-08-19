/**
 * Test L1 — QualificationForm: azienda fissata (Ambito / riga), non select tenant.
 *
 * Ambito (CompanyScopeSelect) sceglie il tenant PRIMA di aprire il form.
 * Nel dettaglio l'azienda è testo bloccato. Resta il picker persona
 * «Da anagrafica azienda» (personnel_id), filtrato su quell'unica azienda.
 */
import { describe, it, expect, beforeEach } from "vitest";
import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";

vi.mock("../services/apiService", () => ({
  default: {
    getCompanies: vi.fn(),
    getCompanyPersonnel: vi.fn(),
    getQualificationConfirmations: vi.fn(),
  },
}));

import apiService from "../services/apiService";
import QualificationForm from "../pages/QualificationForm";

beforeEach(() => {
  apiService.getCompanies.mockResolvedValue({
    data: [
      { id: 10, name: "Mason Demo" },
      { id: 20, name: "Altra Azienda SRL" },
    ],
  });
  apiService.getCompanyPersonnel.mockResolvedValue({
    data: [{ id: 55, name: "Mario Rossi", person_code: "MAT-001" }],
  });
  apiService.getQualificationConfirmations.mockResolvedValue({
    confirmations: [],
    can_confirm: false,
  });
});

async function renderForm(props) {
  await act(async () => {
    render(
      <QualificationForm
        onSave={() => {}}
        onClose={() => {}}
        {...props}
      />
    );
  });
}

describe("QualificationForm — azienda fissata, picker persona resta", () => {
  it("con Ambito azienda: nessun option «seleziona azienda», nome bloccato, picker persona presente", async () => {
    await renderForm({
      defaultCompanyId: 10,
      companyName: "Mason Demo",
    });

    expect(screen.queryByRole("option", { name: /seleziona azienda/i })).toBeNull();
    expect(screen.queryByRole("combobox", { name: /azienda/i })).toBeNull();
    expect(screen.getByLabelText("Azienda non modificabile")).toHaveTextContent("Mason Demo");
    expect(screen.getByLabelText("Da anagrafica azienda")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /testo libero/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(apiService.getCompanyPersonnel).toHaveBeenCalledWith(10, { active: "true" });
    });
    expect(screen.getByRole("option", { name: /Mario Rossi/ })).toBeInTheDocument();
  });

  it("in modifica (anche da Tutto lo studio): azienda della riga, non è un select", async () => {
    await renderForm({
      qualification: {
        id: 3,
        person_name: "Luigi Verdi",
        qualification_type: "Saldatore ISO 9606-1",
        company_id: 20,
        company_name: "Altra Azienda SRL",
        approval_status: "bozza",
      },
    });

    expect(screen.getByText(/Modifica qualifica/)).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /seleziona azienda/i })).toBeNull();
    const locked = screen.getByLabelText("Azienda non modificabile");
    expect(locked.tagName).toBe("SPAN");
    expect(locked).toHaveTextContent("Altra Azienda SRL");
    expect(screen.getByLabelText("Da anagrafica azienda")).toBeEnabled();

    await waitFor(() => {
      expect(apiService.getCompanyPersonnel).toHaveBeenCalledWith(20, { active: "true" });
    });
  });
});

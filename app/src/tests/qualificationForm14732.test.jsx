/**
 * Test L1 — QualificationForm (integrazione qualifica_14732)
 *
 * Copre:
 *   - campi specifici ISO 14732 (tipo saldatura, unità/macchina, tecnica passata, metodo qualificazione)
 *     visibili solo per qualification_type che contiene "14732"
 *   - label di revalidazione dinamica: "(3 anni)" per 9606, "(6 anni)" per 14732
 *   - sezione "Conferma semestrale" visibile per operatori 14732 approvati (non solo saldatori 9606)
 */
import { describe, it, expect, beforeEach } from "vitest";
import React from "react";
import { render, screen, act } from "@testing-library/react";

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
  apiService.getCompanies.mockResolvedValue({ data: [{ id: 1, name: "Acme Srl" }] });
  apiService.getCompanyPersonnel.mockResolvedValue({ data: [] });
  apiService.getQualificationConfirmations.mockResolvedValue({ confirmations: [], can_confirm: false });
});

async function renderForm(qualification) {
  await act(async () => {
    render(
      <QualificationForm
        qualification={qualification}
        onSave={() => {}}
        onClose={() => {}}
      />
    );
  });
}

describe("QualificationForm — qualifica_14732", () => {
  it("mostra i campi specifici ISO 14732 e la label di revalidazione a 6 anni", async () => {
    await renderForm({
      id: 1,
      qualification_type: "Operatore ISO 14732",
      person_name: "Luigi Verdi",
      company_id: 1,
      approval_status: "bozza",
    });

    expect(screen.getByText(/Tipo saldatura \(ISO 14732\)/)).toBeTruthy();
    expect(screen.getByText(/Tipo unità\/macchina di saldatura/)).toBeTruthy();
    expect(screen.getByText(/Tecnica passata/)).toBeTruthy();
    expect(screen.getByText(/Metodo di qualificazione/)).toBeTruthy();
    expect(screen.getByText(/Revalidazione \(6 anni\)/)).toBeTruthy();
  });

  it("mostra la label di revalidazione a 3 anni per i saldatori ISO 9606-1 (nessun campo 14732)", async () => {
    await renderForm({
      id: 2,
      qualification_type: "Saldatore ISO 9606-1",
      person_name: "Mario Rossi",
      company_id: 1,
      approval_status: "bozza",
    });

    expect(screen.getByText(/Revalidazione \(3 anni\)/)).toBeTruthy();
    expect(screen.queryByText(/Tipo saldatura \(ISO 14732\)/)).toBeNull();
  });

  it("mostra la sezione Conferma semestrale per un operatore 14732 approvato", async () => {
    await renderForm({
      id: 3,
      qualification_type: "Operatore ISO 14732",
      person_name: "Luigi Verdi",
      company_id: 1,
      approval_status: "approvata",
    });

    expect(screen.getByText(/Conferma semestrale \(ISO 14732\)/)).toBeTruthy();
  });
});

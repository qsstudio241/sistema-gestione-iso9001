/**
 * Test L1 — QualificationForm profili BW/FW (fetta 1) e date in coda.
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

describe("QualificationForm — profili BW/FW e date in fondo", () => {
  it("FW mostra t prova e nasconde s depositato", async () => {
    await renderForm({
      id: 1,
      qualification_type: "Saldatore ISO 9606-1",
      person_name: "Mario Rossi",
      company_id: 1,
      joint_type: "FW",
      product_type: "P",
      approval_status: "bozza",
    });
    expect(screen.getByText(/Spessore materiale t del provino/)).toBeInTheDocument();
    expect(screen.queryByText(/Spessore depositato s/)).not.toBeInTheDocument();
  });

  it("BW mostra s depositato e nasconde t materiale", async () => {
    await renderForm({
      id: 2,
      qualification_type: "Saldatore ISO 9606-1",
      person_name: "Mario Rossi",
      company_id: 1,
      joint_type: "BW",
      product_type: "P",
      approval_status: "bozza",
    });
    expect(screen.getByText(/Spessore depositato s/)).toBeInTheDocument();
    expect(screen.queryByText(/Spessore materiale t del provino/)).not.toBeInTheDocument();
  });

  it("la sezione Date è dopo i dettagli saldatura (sempre in coda al form operativo)", async () => {
    await renderForm({
      id: 3,
      qualification_type: "Saldatore ISO 9606-1",
      person_name: "Mario Rossi",
      company_id: 1,
      joint_type: "FW",
      approval_status: "bozza",
    });
    const details = screen.getByText("Dettagli saldatura");
    const dates = screen.getByTestId("qf-dates-section");
    expect(details.compareDocumentPosition(dates) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText("Data esame")).toBeInTheDocument();
    expect(screen.getByText("Data emissione")).toBeInTheDocument();
    expect(screen.getByText(/Ultima conferma semestrale/)).toBeInTheDocument();
  });
});

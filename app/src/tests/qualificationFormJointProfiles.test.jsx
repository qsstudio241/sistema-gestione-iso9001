/**
 * Test L1 — QualificationForm profili BW/FW (fetta 1) e date in coda.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import React from "react";
import { render, screen, act, fireEvent } from "@testing-library/react";

vi.mock("../services/apiService", () => ({
  default: {
    getCompanies: vi.fn(),
    getCompanyPersonnel: vi.fn(),
    getQualificationConfirmations: vi.fn(),
    updateQualification: vi.fn(),
    createQualification: vi.fn(),
  },
}));

import apiService from "../services/apiService";
import QualificationForm from "../pages/QualificationForm";

beforeEach(() => {
  apiService.getCompanies.mockResolvedValue({ data: [{ id: 1, name: "Acme Srl" }] });
  apiService.getCompanyPersonnel.mockResolvedValue({ data: [] });
  apiService.getQualificationConfirmations.mockResolvedValue({ confirmations: [], can_confirm: false });
  apiService.updateQualification.mockResolvedValue({ id: 1 });
  apiService.createQualification.mockResolvedValue({ id: 99 });
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

  it("non copia i processi di validità dal processo prova se il campo è vuoto", async () => {
    await renderForm({
      id: 4,
      qualification_type: "Saldatore ISO 9606-1",
      person_name: "Mario Rossi",
      company_id: 1,
      joint_type: "FW",
      welding_process: "135",
      welding_process_test: "135",
      approval_status: "bozza",
    });
    const validity = screen.getByPlaceholderText("es. 135, 138");
    expect(validity.value).toBe("");
  });

  it("non copia welding_process legacy (138) su welding_process_test", async () => {
    await renderForm({
      id: 6,
      qualification_type: "Saldatore ISO 9606-1",
      person_name: "Mario Rossi",
      company_id: 1,
      joint_type: "FW",
      welding_process: "138",
      welding_processes_validity: "135, 138",
      approval_status: "bozza",
    });
    const processSelect = screen.getByTestId("qf-welding-process-test");
    expect(processSelect.value).toBe("");
    expect(screen.getByPlaceholderText("es. 135, 138").value).toBe("135, 138");
  });

  it("scelta processo scrive welding_process_test e welding_process legacy", async () => {
    await renderForm({
      id: 10,
      qualification_type: "Saldatore ISO 9606-1",
      person_name: "Mario Rossi",
      company_id: 1,
      joint_type: "FW",
      product_type: "P",
      approval_status: "bozza",
    });
    vi.useFakeTimers();
    fireEvent.change(screen.getByTestId("qf-welding-process-test"), { target: { value: "135" } });
    expect(screen.getByTestId("qf-welding-process-test").value).toBe("135");
    fireEvent.blur(screen.getByTestId("qf-welding-process-test"));
    expect(screen.queryByText(/processo di saldatura/i)).not.toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1600);
    });
    expect(apiService.updateQualification).toHaveBeenCalled();
    const payload = apiService.updateQualification.mock.calls.at(-1)[1];
    expect(payload.welding_process_test).toBe("135");
    expect(payload.welding_process).toBe("135");
    vi.useRealTimers();
  });

  it("scelta 135 non copia 138 di validità sulla colonna prova", async () => {
    await renderForm({
      id: 11,
      qualification_type: "Saldatore ISO 9606-1",
      person_name: "Mario Rossi",
      company_id: 1,
      joint_type: "FW",
      welding_process: "138",
      welding_processes_validity: "135, 138",
      approval_status: "bozza",
    });
    vi.useFakeTimers();
    expect(screen.getByTestId("qf-welding-process-test").value).toBe("");
    fireEvent.change(screen.getByTestId("qf-welding-process-test"), { target: { value: "135" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1600);
    });
    const payload = apiService.updateQualification.mock.calls.at(-1)[1];
    expect(payload.welding_process_test).toBe("135");
    expect(payload.welding_process).toBe("135");
    expect(payload.welding_processes_validity).toBe("135, 138");
    vi.useRealTimers();
  });

  it("riempie welding_process_test solo dalla designazione stampata", async () => {
    await renderForm({
      id: 7,
      qualification_type: "Saldatore ISO 9606-1",
      person_name: "Mario Rossi",
      company_id: 1,
      joint_type: "FW",
      welding_process: "138",
      qualification_designation: "ISO 9606-1: 135 P FW FM1 t8 PB ss mb",
      approval_status: "bozza",
    });
    expect(screen.getByTestId("qf-welding-process-test").value).toBe("135");
  });

  it("su approvata non rende editabili le date conferma §9.2 nel form", async () => {
    await renderForm({
      id: 8,
      qualification_type: "Saldatore ISO 9606-1",
      person_name: "Mario Rossi",
      company_id: 1,
      joint_type: "FW",
      approval_status: "approvata",
      last_confirmation_date: "2026-01-10",
      next_confirmation_due: "2026-07-10",
    });
    expect(screen.queryByText(/Ultima conferma semestrale/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Prossima conferma entro/)).not.toBeInTheDocument();
    expect(screen.getByText(/Revalidazione/)).toBeInTheDocument();
  });

  it("EN 15614 con prodotto T mostra diametro tubo min/max", async () => {
    await renderForm({
      id: 5,
      qualification_type: "Saldatore EN 15614",
      person_name: "Mario Rossi",
      company_id: 1,
      product_type: "T",
      pipe_diameter_min_mm: 40,
      pipe_diameter_max_mm: 80,
      approval_status: "bozza",
    });
    expect(screen.getByText("Spessore min (mm)")).toBeInTheDocument();
    const pipeInputs = screen.getAllByPlaceholderText("vuoto = solo lamiera");
    expect(pipeInputs).toHaveLength(2);
    expect(pipeInputs[0].value).toBe("40");
    expect(pipeInputs[1].value).toBe("80");
  });
});

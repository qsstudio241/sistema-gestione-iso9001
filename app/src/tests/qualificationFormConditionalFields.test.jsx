/**
 * Test L1 — QualificationForm (campo diametro tubo condizionato al tipo prodotto)
 *
 * Contesto (27/07/2026): miglioramento UX conseguente al fix del crash SQL su
 * campi numerici lasciati "N.A."/vuoti quando non applicabili — il diametro
 * tubo (Tabella 7 ISO 9606-1) ha senso solo se il prodotto testato è un tubo.
 * Vedi getApplicableWelderFields in data/weldingQualificationRules9606.js.
 */
import { describe, it, expect, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, act, within } from "@testing-library/react";

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

function findSelectByOptionText(text) {
  return screen.getAllByRole("combobox").find((s) => within(s).queryByText(text));
}

describe("QualificationForm — diametro tubo condizionato al tipo prodotto", () => {
  it("prodotto = Piastra: i campi diametro tubo non sono presenti, mostra 'Non applicabile'", async () => {
    await renderForm({
      id: 1,
      qualification_type: "Saldatore ISO 9606-1",
      person_name: "Mario Rossi",
      company_id: 1,
      product_type: "P",
      approval_status: "bozza",
    });

    expect(screen.queryAllByPlaceholderText("vuoto = solo lamiera")).toHaveLength(0);
    expect(screen.getByText(/Non applicabile — prodotto: Piastra/)).toBeInTheDocument();
  });

  it("prodotto = Tubo: i campi diametro tubo min/max restano editabili", async () => {
    await renderForm({
      id: 2,
      qualification_type: "Saldatore ISO 9606-1",
      person_name: "Mario Rossi",
      company_id: 1,
      product_type: "T",
      approval_status: "bozza",
    });

    expect(screen.queryAllByPlaceholderText("vuoto = solo lamiera")).toHaveLength(2);
    expect(screen.queryByText(/Non applicabile/)).not.toBeInTheDocument();
  });

  it("prodotto non ancora scelto: i campi diametro tubo restano visibili (permissivo)", async () => {
    await renderForm({
      id: 4,
      qualification_type: "Saldatore ISO 9606-1",
      person_name: "Mario Rossi",
      company_id: 1,
      approval_status: "bozza",
    });

    expect(screen.queryAllByPlaceholderText("vuoto = solo lamiera")).toHaveLength(2);
  });

  it("cambiando il tipo prodotto da Tubo a Piastra il campo si nasconde e i valori residui vengono azzerati", async () => {
    await renderForm({
      id: 3,
      qualification_type: "Saldatore ISO 9606-1",
      person_name: "Mario Rossi",
      company_id: 1,
      product_type: "T",
      pipe_diameter_min_mm: 10,
      pipe_diameter_max_mm: 20,
      approval_status: "bozza",
    });

    const inputsBefore = screen.getAllByPlaceholderText("vuoto = solo lamiera");
    expect(inputsBefore).toHaveLength(2);
    expect(inputsBefore[0].value).toBe("10");

    const productTypeSelect = findSelectByOptionText("P — Lamiera / piastra");
    await act(async () => {
      fireEvent.change(productTypeSelect, { target: { value: "P" } });
    });

    expect(screen.queryAllByPlaceholderText("vuoto = solo lamiera")).toHaveLength(0);
    expect(screen.getByText(/Non applicabile — prodotto: Piastra/)).toBeInTheDocument();

    // Torna a Tubo: il campo riappare vuoto (valore residuo azzerato in precedenza, non rispunta il vecchio "10")
    await act(async () => {
      fireEvent.change(productTypeSelect, { target: { value: "T" } });
    });
    const inputsAfter = screen.getAllByPlaceholderText("vuoto = solo lamiera");
    expect(inputsAfter).toHaveLength(2);
    expect(inputsAfter[0].value).toBe("");
  });
});

describe("QualificationForm — metodo di trasferimento condizionato al processo (28/07/2026, richiesta committente)", () => {
  it("processo MAG (135): il campo metodo di trasferimento è visibile", async () => {
    await renderForm({
      id: 10,
      qualification_type: "Saldatore ISO 9606-1",
      person_name: "Mario Rossi",
      company_id: 1,
      welding_process: "135",
      approval_status: "bozza",
    });

    expect(screen.getByText("Metodo di trasferimento")).toBeInTheDocument();
    expect(findSelectByOptionText("Spray arc (arco spray)")).toBeTruthy();
  });

  it("processo TIG (141): il campo metodo di trasferimento non è presente", async () => {
    await renderForm({
      id: 11,
      qualification_type: "Saldatore ISO 9606-1",
      person_name: "Mario Rossi",
      company_id: 1,
      welding_process: "141",
      approval_status: "bozza",
    });

    expect(screen.queryByText("Metodo di trasferimento")).not.toBeInTheDocument();
  });

  it("cambiando processo da MAG a TIG il campo si nasconde e il valore residuo viene azzerato", async () => {
    await renderForm({
      id: 12,
      qualification_type: "Saldatore ISO 9606-1",
      person_name: "Mario Rossi",
      company_id: 1,
      welding_process: "135",
      transfer_mode: "spray_arc",
      approval_status: "bozza",
    });

    expect(screen.getByText("Metodo di trasferimento")).toBeInTheDocument();

    const processSelect = findSelectByOptionText("141 — TIG");
    await act(async () => {
      fireEvent.change(processSelect, { target: { value: "141" } });
    });

    expect(screen.queryByText("Metodo di trasferimento")).not.toBeInTheDocument();

    await act(async () => {
      fireEvent.change(processSelect, { target: { value: "135" } });
    });
    const select = findSelectByOptionText("Spray arc (arco spray)");
    expect(select.value).toBe("");
  });
});

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
import { VISION_FITNESS_TYPE } from "../data/occupationalQualificationTypes";

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

describe("QualificationForm — auto-save: tri-stato (#782) + canonicalizzazione processi (#778)", () => {
  const NA_ALL_EDITIONS = [
    "material_group", "joint_type", "product_type", "filler_material", "filler_material_group",
    "shielding_gas", "weld_details", "transfer_mode", "thickness_range", "pipe_diameter",
    "qualification_designation", "welding_position_test",
  ];
  const POSITIONS = ["position_range", "welding_positions", "welding_position"];
  const LEGACY_VALUES = {
    material_group: "1.1", joint_type: "BW", product_type: "P", filler_material: "FM1",
    filler_material_group: "FM1", shielding_gas: "M21", weld_details: "ss nb", transfer_mode: "spray",
    thickness_range: "3-12", pipe_diameter: "> 25", qualification_designation: "ISO 14732 P",
    welding_position_test: "PA", position_range: "PA", welding_positions: "PA", welding_position: "PA",
  };

  async function editNoteAndSave(qualification) {
    await act(async () => {
      render(<QualificationForm qualification={qualification} onSaved={vi.fn()} onClose={vi.fn()} />);
    });
    fireEvent.change(screen.getByPlaceholderText("Note aggiuntive..."), { target: { value: "Nota smoke" } });
    await flushAutosaveWindow();
    expect(apiService.updateQualification).toHaveBeenCalledTimes(1);
    return apiService.updateQualification.mock.calls[0][1];
  }

  function base(extra) {
    return {
      id: 7, person_name: "Operatore Test", company_id: 10, company_name: "Mason Demo",
      certificate_number: "CERT-1", expiry_date: "2027-01-15", notes: "", approval_status: "bozza",
      ...extra,
    };
  }

  it("14732:2025: campi N.A. e posizioni salvati NULL, processo canonico, resto del payload intatto", async () => {
    const payload = await editNoteAndSave(base({
      qualification_type: "Operatore ISO 14732",
      standard_ref: "ISO 14732:2025",
      welding_process: "783-STUD WELDING",
      ...LEGACY_VALUES,
    }));
    for (const k of [...NA_ALL_EDITIONS, ...POSITIONS]) expect(payload[k], k).toBeNull();
    expect(payload.welding_process).toBe("783");
    expect(payload).toEqual(expect.objectContaining({
      notes: "Nota smoke", person_name: "Operatore Test", certificate_number: "CERT-1",
      expiry_date: "2027-01-15", company_id: 10,
    }));
  });

  it("14732:2013: N.A. comuni NULL, posizioni facoltative conservate", async () => {
    const payload = await editNoteAndSave(base({
      qualification_type: "Operatore ISO 14732",
      standard_ref: "ISO 14732:2013",
      welding_process: "135, 138",
      ...LEGACY_VALUES,
    }));
    for (const k of NA_ALL_EDITIONS) expect(payload[k], k).toBeNull();
    for (const k of POSITIONS) expect(payload[k], k).toBe("PA");
    expect(payload.welding_process).toBe("135, 138");
  });

  it("9606-1: nessun campo azzerato, solo il processo viene canonicalizzato", async () => {
    const payload = await editNoteAndSave(base({
      qualification_type: "Saldatore ISO 9606-1",
      standard_ref: "ISO 9606-1:2017",
      welding_process: "783-STUD WELDING",
      welding_process_test: "135",
      ...LEGACY_VALUES,
    }));
    for (const [k, v] of Object.entries(LEGACY_VALUES)) expect(payload[k], k).toBe(v);
    expect(payload.welding_process).toBe("783");
    expect(payload.welding_process_test).toBe("135");
    expect(payload.notes).toBe("Nota smoke");
  });
});

describe("QualificationForm — date del certificato oculistico", () => {
  it("mostra visita e test dei colori solo sul certificato visivo", async () => {
    await act(async () => {
      render(
        <QualificationForm
          qualification={{
            id: 4,
            person_name: "ZZ Ispettore",
            qualification_type: VISION_FITNESS_TYPE,
            company_id: 10,
            expiry_date: "2028-01-01",
            near_vision_expiry_date: "2027-06-01",
            colour_vision_expiry_date: "2030-06-01",
          }}
          onSaved={vi.fn()}
          onClose={vi.fn()}
        />
      );
    });
    expect(screen.getByLabelText(/Scadenza visita acuit/)).toHaveValue("2027-06-01");
    expect(screen.getByLabelText("Scadenza test dei colori")).toHaveValue("2030-06-01");
  });

  it("non mostra le due date su un patentino saldatore", async () => {
    await act(async () => {
      render(<QualificationForm qualification={WELDER} onSaved={vi.fn()} onClose={vi.fn()} />);
    });
    expect(screen.queryByLabelText("Scadenza test dei colori")).not.toBeInTheDocument();
  });
});

/**
 * Test L1 — applicabilità campi per famiglia+edizione (ISO 14732 Annex C) in revisione ingest e form manuale.
 * 14732:2025 senza posizione/campi 9606; 14732:2013 e edizione ignota con posizione facoltativa (mai rossa);
 * 9606-1 invariato.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, act, cleanup, waitFor } from "@testing-library/react";

vi.mock("../services/apiService", () => ({
  default: {
    verifyQualification: vi.fn(),
    getCompanies: vi.fn(),
    getCompanyPersonnel: vi.fn(),
    getQualificationConfirmations: vi.fn(),
    createQualification: vi.fn(),
    updateQualification: vi.fn(),
  },
}));
import apiService from "../services/apiService";
import IngestReviewDialog from "../components/IngestReviewDialog.jsx";
import QualificationForm from "../pages/QualificationForm";

beforeEach(() => {
  apiService.verifyQualification.mockReset();
  apiService.verifyQualification.mockReturnValue(new Promise(() => {}));
  apiService.getCompanies.mockResolvedValue({ data: [{ id: 1, name: "Acme Srl" }] });
  apiService.getCompanyPersonnel.mockResolvedValue({ data: [] });
  apiService.getQualificationConfirmations.mockResolvedValue({ confirmations: [], can_confirm: false });
  window.matchMedia = vi.fn(() => ({
    matches: false,
    media: "",
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
});

afterEach(() => cleanup());

const reviewProps = (over = {}) => ({
  open: true,
  docType: "qualifica_14732",
  fileName: "operatore.pdf",
  qualificationType: "Operatore ISO 14732",
  onConfirm: vi.fn(),
  onReject: vi.fn(),
  onClose: vi.fn(),
  ...over,
});

const positionsField = () => document.getElementById("ingest-field-welding_positions");
const positionsWrapper = () => positionsField()?.closest(".ingest-review__field");

describe("IngestReviewDialog — 14732 per edizione", () => {
  it("14732:2025: nessun campo posizione, nota neutra, nessun campo rosso per i N.A.", () => {
    render(
      <IngestReviewDialog
        {...reviewProps()}
        fields={{ operator_name: "Mario Test", standard_reference: "ISO 14732:2025", welding_positions: ["PA"] }}
        fieldConfidence={{ operator_name: "high", standard_reference: "high" }}
      />,
    );
    expect(positionsField()).toBeNull();
    expect(screen.queryByText("Posizioni qualificate")).toBeNull();
    expect(screen.getByTestId("ingest-na-note").textContent).toContain("ISO 14732:2025");
    expect(screen.getByTestId("ingest-na-note").textContent).toContain("Posizioni qualificate");
  });

  it("14732:2025: l'invio azzera la posizione residua dell'estrazione", async () => {
    const onConfirm = vi.fn();
    render(
      <IngestReviewDialog
        {...reviewProps({ onConfirm })}
        fields={{ operator_name: "Mario Test", standard_reference: "ISO 14732:2025", welding_positions: ["PA", "PB"], material_group: "1.1" }}
      />,
    );
    await act(async () => {
      fireEvent.click(screen.getByText("Conferma e salva"));
    });
    expect(onConfirm).toHaveBeenCalledTimes(1);
    const payload = onConfirm.mock.calls[0][0];
    expect(payload.welding_positions).toBeNull();
    expect(payload.material_group).toBeNull();
    expect(payload.operator_name).toBe("Mario Test");
  });

  it("14732:2013: posizione presente, facoltativa e vuota senza attenzione rossa", () => {
    render(
      <IngestReviewDialog
        {...reviewProps()}
        fields={{ operator_name: "Mario Test", standard_reference: "ISO 14732:2013" }}
        fieldConfidence={{ welding_positions: "low", operator_name: "high" }}
      />,
    );
    expect(positionsField()).not.toBeNull();
    const wrapper = positionsWrapper();
    expect(wrapper.className).toContain("ingest-review__field--optional");
    expect(wrapper.className).not.toContain("--low");
    expect(wrapper.textContent).toContain("Facoltativo");
    expect(wrapper.querySelector(".ingest-review__confidence--low")).toBeNull();
    expect(screen.queryByTestId("ingest-na-note")).toBeNull();
  });

  it("edizione ignota: posizione facoltativa; una obbligatoria vuota resta rossa come prima", () => {
    render(
      <IngestReviewDialog
        {...reviewProps()}
        fields={{ operator_name: "Mario Test" }}
        fieldConfidence={{ welding_positions: "low", certificate_number: "low" }}
      />,
    );
    expect(positionsWrapper().className).toContain("ingest-review__field--optional");
    const cert = document.getElementById("ingest-field-certificate_number").closest(".ingest-review__field");
    expect(cert.className).toContain("ingest-review__field--low");
  });

  it("posizione facoltativa con valore a confidenza bassa: attenzione invariata (valore da controllare)", () => {
    render(
      <IngestReviewDialog
        {...reviewProps()}
        fields={{ standard_reference: "ISO 14732:2013", welding_positions: ["PA"] }}
        fieldConfidence={{ welding_positions: "low" }}
      />,
    );
    expect(positionsWrapper().className).toContain("ingest-review__field--low");
  });

  it("cambiando l'edizione a mano la posizione compare/scompare", () => {
    render(
      <IngestReviewDialog
        {...reviewProps()}
        fields={{ standard_reference: "ISO 14732:2013" }}
        fieldConfidence={{}}
      />,
    );
    expect(positionsField()).not.toBeNull();
    fireEvent.change(document.getElementById("ingest-field-standard_reference"), { target: { value: "ISO 14732:2025" } });
    expect(positionsField()).toBeNull();
  });

  it("9606-1: nessuna mappa applicata, diametro con prodotto P invariato", () => {
    render(
      <IngestReviewDialog
        open
        docType="patentino_saldatore"
        fileName="c.pdf"
        qualificationType="Saldatore ISO 9606-1"
        fields={{ standard_reference: "ISO 9606-1:2017", product_type: "P", pipe_diameter_mm: 60 }}
        onConfirm={vi.fn()}
        onReject={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.queryByTestId("ingest-na-note")).toBeNull();
    expect(document.getElementById("ingest-field-pipe_diameter_mm")).toBeNull();
    expect(screen.getByText(/Non applicabile — prodotto: Piastra/)).toBeTruthy();
    expect(document.getElementById("ingest-field-material_group") || document.getElementById("ingest-field-welding_positions")).not.toBeNull();
  });
});

async function renderForm(qualification) {
  await act(async () => {
    render(<QualificationForm qualification={qualification} onSave={() => {}} onClose={() => {}} />);
  });
}

const base = { company_id: 1, person_name: "Mario Test", approval_status: "bozza" };

describe("QualificationForm — applicabilità per famiglia+edizione", () => {
  it("14732:2025: nascosti gruppo materiale, giunto, prodotto, apporto, gas, dettagli, posizioni", async () => {
    await renderForm({ id: 1, ...base, qualification_type: "Operatore ISO 14732", standard_ref: "ISO 14732:2025" });
    expect(screen.queryByText(/Gruppo materiale \(ISO\/TR 15608\)/)).toBeNull();
    expect(screen.queryByText(/Posizioni qualificate/)).toBeNull();
    expect(screen.queryByText("Tipo giunto")).toBeNull();
    expect(screen.queryByText("Tipo prodotto")).toBeNull();
    expect(screen.queryByText(/Gruppo materiale d'apporto/)).toBeNull();
    expect(screen.queryByText("Gas di protezione")).toBeNull();
    expect(screen.queryByText(/Dettagli saldatura – campo di validità/)).toBeNull();
    expect(screen.getByTestId("qf-na-note").textContent).toContain("ISO 14732:2025");
    expect(screen.getByText(/Tipo saldatura \(ISO 14732\)/)).toBeTruthy();
    expect(screen.getByText("Organismo esaminatore")).toBeTruthy();
  });

  it("14732:2013: posizione facoltativa visibile, gli altri campi 9606 nascosti", async () => {
    await renderForm({ id: 2, ...base, qualification_type: "Operatore ISO 14732", standard_ref: "ISO 14732:2013" });
    expect(screen.getByText(/Posizioni qualificate/).textContent).toContain("(facoltativo)");
    expect(screen.queryByText(/Gruppo materiale \(ISO\/TR 15608\)/)).toBeNull();
    expect(screen.queryByText("Tipo giunto")).toBeNull();
  });

  it("14732 senza edizione: posizione facoltativa", async () => {
    await renderForm({ id: 3, ...base, qualification_type: "Operatore ISO 14732" });
    expect(screen.getByText(/Posizioni qualificate/).textContent).toContain("(facoltativo)");
  });

  it("9606-1: tutti i campi presenti e posizione obbligatoria come prima", async () => {
    await renderForm({ id: 4, ...base, qualification_type: "Saldatore ISO 9606-1", standard_ref: "ISO 9606-1:2017" });
    expect(screen.getByText(/Gruppo materiale \(ISO\/TR 15608\)/)).toBeTruthy();
    expect(screen.getByText("Tipo giunto")).toBeTruthy();
    expect(screen.getByText("Tipo prodotto")).toBeTruthy();
    expect(screen.getByText("Gas di protezione")).toBeTruthy();
    expect(screen.getByText(/Posizioni validità/).textContent).not.toContain("facoltativo");
    expect(screen.queryByTestId("qf-na-note")).toBeNull();
  });

  it("14732:2025: l'auto-save invia i campi N.A. a null", async () => {
    apiService.updateQualification.mockResolvedValue({});
    await renderForm({
      id: 5, ...base, qualification_type: "Operatore ISO 14732", standard_ref: "ISO 14732:2025",
      position_range: "PA", material_group: "1.1", certificate_number: "C1",
    });
    const notes = screen.getAllByRole("textbox")[0];
    fireEvent.change(notes, { target: { value: notes.value + "x" } });
    await waitFor(() => expect(apiService.updateQualification).toHaveBeenCalled(), { timeout: 3000 });
    const payload = apiService.updateQualification.mock.calls[0][1];
    expect(payload.position_range).toBeNull();
    expect(payload.material_group).toBeNull();
    expect(payload.certificate_number).toBe("C1");
  });
});

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CompanyProfileImportDialog from "../components/CompanyProfileImportDialog";

const FIELD_LABELS = {
  vat_number: "Partita IVA",
  ateco_primary: "ATECO primario",
  registered_city: "Comune",
  has_dvr: "DVR presente",
};

function detectionFixture(overrides = {}) {
  return {
    fileName: "visura.xlsx",
    sheetName: "ProfiloAzienda",
    confidence: "alta",
    canImport: true,
    mapping: {
      vat_number: "P.IVA",
      ateco_primary: "ATECO",
      registered_city: "Comune",
      has_dvr: "ha_dvr",
    },
    preview: {
      vat_number: "01234567890",
      ateco_primary: "25.11.00",
      registered_city: "Modena",
      has_dvr: 1,
    },
    ...overrides,
  };
}

describe("CompanyProfileImportDialog", () => {
  it("mostra preview dry-run dei campi riconosciuti", () => {
    render(
      <CompanyProfileImportDialog
        detection={detectionFixture()}
        fieldLabels={FIELD_LABELS}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("visura.xlsx")).toBeInTheDocument();
    expect(screen.getByText(/alta affidabilit/i)).toBeInTheDocument();
    expect(screen.getByTestId("cpid-preview")).toBeInTheDocument();
    expect(screen.getByText("Partita IVA")).toBeInTheDocument();
    expect(screen.getByText("01234567890")).toBeInTheDocument();
    expect(screen.getByText("ATECO primario")).toBeInTheDocument();
    expect(screen.getByText("25.11.00")).toBeInTheDocument();
    expect(screen.getByText("DVR presente")).toBeInTheDocument();
    expect(screen.getByText("Sì")).toBeInTheDocument();
  });

  it("conferma passa i campi preview al callback", async () => {
    const onConfirm = vi.fn();
    const detection = detectionFixture();
    render(
      <CompanyProfileImportDialog
        detection={detection}
        fieldLabels={FIELD_LABELS}
        onConfirm={onConfirm}
        onClose={vi.fn()}
      />
    );
    await userEvent.click(screen.getByRole("button", { name: /Conferma import/i }));
    expect(onConfirm).toHaveBeenCalledWith(detection.preview);
  });

  it("disabilita conferma se nessun campo", () => {
    render(
      <CompanyProfileImportDialog
        detection={detectionFixture({ canImport: false, preview: {} })}
        fieldLabels={FIELD_LABELS}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: /Conferma import/i })).toBeDisabled();
    expect(screen.getByText(/Nessun campo profilo riconosciuto/i)).toBeInTheDocument();
  });
});

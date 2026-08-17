import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import RiskM03ImportDialog from "../components/RiskM03ImportDialog.jsx";

vi.mock("../components/SpreadsheetViewer", () => ({
  default: ({ fileName, sheetName }) => (
    <div data-testid="spreadsheet-embedded">anteprima {fileName} {sheetName}</div>
  ),
}));

beforeEach(() => {
  window.matchMedia = vi.fn(() => ({
    matches: false,
    media: "",
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
});

const detection = {
  fileName: "ANALISI RISCHI 2026.xlsx",
  sheetName: "Foglio1",
  confidence: "alta",
  canImport: true,
  pgMax: 3,
  observedPgMax: 3,
  stats: { create: 2, skip: 0 },
  sheets: [{ name: "Foglio1", columns: [{ key: "A", header: "Elemento" }], suggestedMapping: { evaluated_element: "A" } }],
  columns: [{ key: "A", header: "Elemento" }],
  mapping: { evaluated_element: "A" },
  rows: [
    { excelRow: 3, nature: "risk", title: "Rischio prova", probability: 2, impact: 2, action: "create" },
    { excelRow: 4, nature: "opportunity", title: "Opportunità prova", probability: 1, impact: 1, action: "create" },
  ],
};

describe("RiskM03ImportDialog", () => {
  it("usa la shell ingest: file a sinistra e mapping a destra", () => {
    const file = new File([new Uint8Array([1])], "ANALISI RISCHI 2026.xlsx");
    render(
      <RiskM03ImportDialog
        detection={detection}
        previewFile={file}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole("dialog", { name: "Importa analisi Excel" })).toBeInTheDocument();
    expect(screen.getByText("Ingrandisci affiancato")).toBeInTheDocument();
    expect(screen.getByTestId("spreadsheet-embedded")).toHaveTextContent("ANALISI RISCHI 2026.xlsx");
    expect(screen.getByTestId("rm03-mapping")).toBeInTheDocument();
    expect(screen.getByTestId("rm03-preview")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Conferma 2 righe" })).toBeEnabled();
  });

  it("conferma le righe rilevate", () => {
    const onConfirm = vi.fn();
    render(
      <RiskM03ImportDialog
        detection={detection}
        previewFile={new File([new Uint8Array([1])], "a.xlsx")}
        onConfirm={onConfirm}
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Conferma 2 righe" }));
    expect(onConfirm).toHaveBeenCalledWith(detection.rows);
  });
});

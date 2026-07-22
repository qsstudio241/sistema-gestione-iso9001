import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";

import IngestReviewDialog, {
  isFieldConfirmedByAi,
  formatReadonlyDisplay,
} from "../components/IngestReviewDialog.jsx";

beforeEach(() => {
  window.matchMedia = vi.fn(() => ({
    matches: false,
    media: "",
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
});

const SELECT_FIELD = {
  key: "welding_process",
  label: "Processo di saldatura",
  type: "select",
  required: true,
  options: [
    { value: "111", label: "111 - SMAW" },
    { value: "141", label: "141 - TIG" },
  ],
};

describe("isFieldConfirmedByAi", () => {
  it("è confermato solo con confidenza alta e valore presente", () => {
    expect(isFieldConfirmedByAi("high", "141")).toBe(true);
    expect(isFieldConfirmedByAi("high", "")).toBe(false);
    expect(isFieldConfirmedByAi("high", null)).toBe(false);
    expect(isFieldConfirmedByAi("high", [])).toBe(false);
    expect(isFieldConfirmedByAi("medium", "141")).toBe(false);
    expect(isFieldConfirmedByAi("low", "141")).toBe(false);
    expect(isFieldConfirmedByAi(undefined, "141")).toBe(false);
  });
});

describe("formatReadonlyDisplay", () => {
  it("mostra la label dell'opzione select, non il codice grezzo", () => {
    expect(formatReadonlyDisplay(SELECT_FIELD, "141")).toBe("141 - TIG");
  });

  it("gestisce array (multiselect) e valori mancanti", () => {
    expect(formatReadonlyDisplay({ type: "multiselect" }, ["PA", "PB"])).toBe("PA, PB");
    expect(formatReadonlyDisplay(SELECT_FIELD, "")).toBe("\u2014");
  });
});

describe("IngestReviewDialog — revisione adattiva per confidenza", () => {
  const baseProps = {
    open: true,
    docType: "patentino_saldatore",
    fileName: "certificato.pdf",
    onConfirm: vi.fn(),
    onReject: vi.fn(),
    onClose: vi.fn(),
  };

  it("campo con confidenza alta è mostrato come confermato (readonly + pulsante Modifica), non come select", () => {
    render(
      <IngestReviewDialog
        {...baseProps}
        fields={{ welding_process: "141" }}
        fieldConfidence={{ welding_process: "high" }}
      />,
    );

    expect(screen.getByText(/141 - TIG/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Processo di saldatura/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Modifica" })).toBeInTheDocument();
  });

  it("cliccando Modifica il campo confermato diventa editabile e può tornare readonly", () => {
    render(
      <IngestReviewDialog
        {...baseProps}
        fields={{ welding_process: "141" }}
        fieldConfidence={{ welding_process: "high" }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Modifica" }));
    expect(document.getElementById("ingest-field-welding_process").tagName).toBe("SELECT");

    fireEvent.click(screen.getByRole("button", { name: /Annulla modifica/ }));
    expect(document.getElementById("ingest-field-welding_process")).toBeNull();
    expect(screen.getByText(/141 - TIG/)).toBeInTheDocument();
  });

  it("campo con confidenza bassa/assente è mostrato subito editabile (select aperto)", () => {
    render(
      <IngestReviewDialog
        {...baseProps}
        fields={{ welding_process: "" }}
        fieldConfidence={{ welding_process: "low" }}
      />,
    );

    expect(document.getElementById("ingest-field-welding_process").tagName).toBe("SELECT");
    expect(screen.queryByRole("button", { name: "Modifica" })).not.toBeInTheDocument();
  });

  it("campo con confidenza media è mostrato editabile ed evidenziato", () => {
    render(
      <IngestReviewDialog
        {...baseProps}
        fields={{ welding_process: "141" }}
        fieldConfidence={{ welding_process: "medium" }}
      />,
    );

    const select = document.getElementById("ingest-field-welding_process");
    expect(select.tagName).toBe("SELECT");
    expect(select.closest(".ingest-review__field--medium")).not.toBeNull();
  });
});

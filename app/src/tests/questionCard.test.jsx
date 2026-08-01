/**
 * QuestionCard — prop statusOptions (ADR-019 D3)
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QuestionCard, STATUS_BUTTONS } from "../components/QuestionCard";

const baseQuestion = {
  id: 1,
  text: "Domanda di prova",
  status: null,
  notes: "",
};

function renderCard(props = {}) {
  return render(
    <QuestionCard
      question={baseQuestion}
      onStatusChange={vi.fn()}
      onNotesChange={vi.fn()}
      showStatusButtons
      {...props}
    />
  );
}

describe("QuestionCard — statusOptions", () => {
  it("senza statusOptions renderizza i 6 pulsanti standard (non-regressione)", () => {
    renderCard();
    const buttons = screen.getAllByRole("button").filter((btn) =>
      STATUS_BUTTONS.some(({ code }) => btn.textContent === code)
    );
    expect(buttons).toHaveLength(6);
    STATUS_BUTTONS.forEach(({ code }) => {
      expect(screen.getByRole("button", { name: code })).toBeInTheDocument();
    });
  });

  it("con statusOptions custom renderizza solo i pulsanti passati", () => {
    const customOptions = [
      { code: "C", className: "compliant", label: "Sì" },
      { code: "NC", className: "non-compliant", label: "No" },
      { code: "NA", className: "not-applicable", label: "Non applicabile" },
    ];
    renderCard({ statusOptions: customOptions });
    const statusButtons = screen.getAllByRole("button").filter((btn) =>
      ["C", "NC", "NA", "OSS", "OM", "NV"].includes(btn.textContent)
    );
    expect(statusButtons).toHaveLength(3);
    expect(screen.getByRole("button", { name: "C" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "NC" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "NA" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "OSS" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "OM" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "NV" })).not.toBeInTheDocument();
  });
});

/**
 * Test L1 — Assistente AI Conclusioni: testo proposto editabile prima di Accetta.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const mockSuggest = vi.fn();
const mockClear = vi.fn();
const mockAiFeedback = vi.fn().mockResolvedValue({});

vi.mock("../hooks/useAiAssist", () => ({
  useAiAssist: () => ({
    suggest: mockSuggest,
    loading: false,
    error: null,
    clear: mockClear,
  }),
}));

vi.mock("../services/apiService", () => ({
  default: {
    aiFeedback: (...args) => mockAiFeedback(...args),
  },
}));

import AiConclusionsModal from "../components/AiConclusionsModal";

const SAMPLE = {
  conclusion_text: "Proposta originale dell'AI.",
  recommendation: "non_conforme",
  key_findings_summary: "1 NC, 3 OSS",
};

describe("AiConclusionsModal testo editabile", () => {
  beforeEach(() => {
    mockSuggest.mockReset();
    mockClear.mockReset();
    mockAiFeedback.mockClear();
    mockSuggest.mockResolvedValue(SAMPLE);
  });

  it("mostra il testo AI in un campo modificabile", async () => {
    render(
      <AiConclusionsModal
        open
        onClose={vi.fn()}
        onAccept={vi.fn()}
        auditContext={{}}
        standardKey={null}
        auditId="a1"
      />,
    );

    const ta = await screen.findByLabelText(/Testo proposto dall'assistente AI/i);
    expect(ta.tagName).toBe("TEXTAREA");
    expect(ta).not.toHaveAttribute("readOnly");
    expect(ta.value).toBe(SAMPLE.conclusion_text);
  });

  it("Accetta invia il testo modificato (non l'originale AI)", async () => {
    const onAccept = vi.fn();
    const onClose = vi.fn();
    render(
      <AiConclusionsModal
        open
        onClose={onClose}
        onAccept={onAccept}
        auditContext={{}}
        standardKey={null}
        auditId="a1"
      />,
    );

    const ta = await screen.findByLabelText(/Testo proposto dall'assistente AI/i);
    fireEvent.change(ta, { target: { value: "Testo corretto dal revisore." } });
    fireEvent.click(screen.getByRole("button", { name: "Accetta" }));

    expect(onAccept).toHaveBeenCalledWith("Testo corretto dal revisore.");
    expect(onClose).toHaveBeenCalled();
    expect(mockAiFeedback).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "accepted",
        aiText: SAMPLE.conclusion_text,
        finalText: "Testo corretto dal revisore.",
      }),
    );
  });

  it("disabilita Accetta se il testo è vuoto", async () => {
    render(
      <AiConclusionsModal
        open
        onClose={vi.fn()}
        onAccept={vi.fn()}
        auditContext={{}}
        standardKey={null}
        auditId="a1"
      />,
    );

    const ta = await screen.findByLabelText(/Testo proposto dall'assistente AI/i);
    fireEvent.change(ta, { target: { value: "   " } });
    expect(screen.getByRole("button", { name: "Accetta" })).toBeDisabled();
  });
});

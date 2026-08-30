import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import AiAssistantSourceGaps from "../components/AiAssistantSourceGaps";
import { mapServerRequestToBacklogRow } from "../pages/NormLibraryPage";

vi.mock("../contexts/RouterContext", () => ({
  Link: ({ to, children, ...rest }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
}));

describe("LG-1 AiAssistantSourceGaps", () => {
  it("non renderizza se gaps vuoti", () => {
    const { container } = render(<AiAssistantSourceGaps gaps={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("mostra codice, note qualità e link Libreria", () => {
    render(
      <AiAssistantSourceGaps
        gaps={[
          {
            id: 1,
            code: "ISO 14555:2025",
            title: "Stud",
            reason: "range piega",
            qualityNotes: "verificare Tabella 2",
            closurePath: "platform",
          },
        ]}
      />
    );
    expect(screen.getByText(/ISO 14555:2025/)).toBeTruthy();
    expect(screen.getByText(/verificare Tabella 2/)).toBeTruthy();
    expect(screen.getByRole("link", { name: /Apri Libreria/i })).toHaveAttribute(
      "href",
      "/settings/libreria"
    );
  });
});

describe("mapServerRequestToBacklogRow", () => {
  it("unisce reason e quality_notes in notes leggibili", () => {
    const row = mapServerRequestToBacklogRow({
      id: 9,
      source_code: "ISO 14555:2025",
      reason: "Serve per range stud",
      quality_notes: "OCR tabella incerto",
      closure_path: "platform",
      status: "open",
    });
    expect(row.source).toBe("assistente");
    expect(row.notes).toContain("Serve per range stud");
    expect(row.notes).toContain("Qualità: OCR tabella incerto");
    expect(row.impact).toMatch(/piattaforma/i);
  });
});

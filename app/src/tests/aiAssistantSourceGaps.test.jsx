import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import AiAssistantSourceGaps from "../components/AiAssistantSourceGaps";
import { mapServerRequestToBacklogRow } from "../pages/NormLibraryPage";
import {
  buildLibraryGapPath,
  parseLibraryGapSearch,
  libraryGapCodesMatch,
} from "../utils/libraryGapDeepLink";

vi.mock("../contexts/RouterContext", () => ({
  Link: ({ to, children, ...rest }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
}));

describe("libraryGapDeepLink", () => {
  it("buildLibraryGapPath include highlight, path e prefill", () => {
    expect(
      buildLibraryGapPath({
        code: "ISO 14555:2025",
        closurePath: "platform",
        prefill: true,
      })
    ).toBe(
      "/settings/libreria?highlight=ISO+14555%3A2025&path=platform&prefill=1"
    );
    expect(
      buildLibraryGapPath({ code: "X", closurePath: "tenant" })
    ).toContain("path=tenant");
  });

  it("parseLibraryGapSearch legge query", () => {
    const p = parseLibraryGapSearch(
      "?highlight=ISO%2014555&path=tenant&prefill=1"
    );
    expect(p.highlight).toBe("ISO 14555");
    expect(p.path).toBe("tenant");
    expect(p.prefill).toBe(true);
  });

  it("libraryGapCodesMatch è case-insensitive e accetta prefisso", () => {
    expect(libraryGapCodesMatch("ISO 1", "iso 1")).toBe(true);
    expect(
      libraryGapCodesMatch("ISO 14555:2025", "ISO 14555:2025 (arc stud)")
    ).toBe(true);
    expect(libraryGapCodesMatch("a", "b")).toBe(false);
  });
});

describe("LG-2 AiAssistantSourceGaps", () => {
  it("non renderizza se gaps vuoti", () => {
    const { container } = render(<AiAssistantSourceGaps gaps={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("distingue piattaforma vs tenant e CTA Vai in Libreria con deep-link", () => {
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
          {
            id: 2,
            code: "MAN-CLIENTE",
            title: "Manuale cliente",
            closurePath: "tenant",
          },
        ]}
      />
    );
    expect(screen.getByText(/ISO 14555:2025/)).toBeTruthy();
    expect(screen.getByText(/Via piattaforma/)).toBeTruthy();
    expect(screen.getByText(/Via tenant \(ingest\)/)).toBeTruthy();
    expect(screen.getByText(/Richiesta registrata/)).toBeTruthy();

    const platformCta = screen.getByRole("link", {
      name: /Vai in Libreria — vedi richiesta/i,
    });
    expect(platformCta.getAttribute("href")).toContain("highlight=ISO");
    expect(platformCta.getAttribute("href")).toContain("path=platform");
    expect(platformCta.getAttribute("href")).toContain("prefill=1");

    const tenantCta = screen.getByRole("link", {
      name: /Vai in Libreria — carica documento/i,
    });
    expect(tenantCta.getAttribute("href")).toContain("path=tenant");
    expect(tenantCta.getAttribute("href")).toContain("MAN-CLIENTE");
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

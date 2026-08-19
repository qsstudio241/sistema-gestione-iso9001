import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import AiAssistantCitations from "../components/AiAssistantCitations";

vi.mock("../contexts/RouterContext", () => ({
  Link: ({ to, children, className, ...props }) => (
    <a href={to} className={className} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("../services/apiService", () => ({
  default: {
    baseUrl: "http://test/api/v1",
    getToken: () => "tok",
  },
}));

describe("AiAssistantCitations", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        blob: async () => new Blob(),
        headers: { get: () => "" },
      }),
    );
  });

  it("renders footnote and linked chips when citations exist", () => {
    render(
      <AiAssistantCitations
        sourcesCount={2}
        contextUsed={4}
        citations={[
          {
            entityType: "non_conformity",
            entityId: "42",
            label: "NC 2024-01 saldatura",
          },
          {
            entityType: "unknown_type",
            entityId: "1",
            label: "Record generico",
          },
        ]}
      />,
    );

    expect(screen.getByText(/Basato su 2 record del SGQ/)).toBeTruthy();
    expect(screen.getByText(/4 estratti/)).toBeTruthy();
    expect(screen.getByRole("list", { name: "Fonti SGQ" })).toBeTruthy();
    expect(screen.getByTitle("NC 2024-01 saldatura").closest("a")).toHaveAttribute(
      "href",
      "/nc?select=42",
    );
    expect(screen.getByTitle("Record generico").closest("span.ai-citation-link--static")).toBeTruthy();
  });

  it("shows empty-state footnote without citation list", () => {
    render(
      <AiAssistantCitations sourcesCount={0} contextUsed={0} citations={[]} />,
    );

    expect(screen.getByText(/senza fonti verificabili/)).toBeTruthy();
    expect(screen.queryByRole("list", { name: "Fonti SGQ" })).toBeNull();
  });

  it("lista figure vuota: non crasha e non mostra card", () => {
    render(
      <AiAssistantCitations
        sourcesCount={0}
        contextUsed={0}
        citations={[]}
        figures={[]}
      />,
    );

    expect(screen.getByText(/senza fonti verificabili/)).toBeTruthy();
    expect(screen.queryByRole("list", { name: "Tavole citate" })).toBeNull();
  });

  it("con 1 hit figura mostra pagina, bbox, caption e score", () => {
    render(
      <AiAssistantCitations
        sourcesCount={0}
        contextUsed={0}
        citations={[]}
        figures={[
          {
            id: 12,
            page: 3,
            bbox: [10, 20, 110, 80],
            caption: "Simbolo saldatura d'angolo",
            score: 0.91,
          },
        ]}
      />,
    );

    expect(screen.getByRole("list", { name: "Tavole citate" })).toBeTruthy();
    expect(screen.getByText("Pagina 3")).toBeTruthy();
    expect(screen.getByText("bbox 10, 20, 110, 80")).toBeTruthy();
    expect(screen.getByText("Simbolo saldatura d'angolo")).toBeTruthy();
    expect(screen.getByText("score 0.91")).toBeTruthy();
    expect(screen.getByText("Tavola")).toBeTruthy();
  });
});

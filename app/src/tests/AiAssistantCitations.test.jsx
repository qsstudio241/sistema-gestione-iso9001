import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import AiAssistantCitations from "../components/AiAssistantCitations";

vi.mock("../contexts/RouterContext", () => ({
  Link: ({ to, children, className, ...props }) => (
    <a href={to} className={className} {...props}>
      {children}
    </a>
  ),
}));

describe("AiAssistantCitations", () => {
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
});

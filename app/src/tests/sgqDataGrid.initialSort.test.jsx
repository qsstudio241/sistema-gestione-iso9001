import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import SgqDataGrid from "../components/SgqDataGrid";

const COLUMNS = [
  { id: "evaluated_element", label: "Elemento", sortable: true },
  { id: "score", label: "R", sortable: true },
];

const ROWS = [
  { id: 1, evaluated_element: "Alfa", score: 2 },
  { id: 2, evaluated_element: "Zeta", score: 9 },
];

describe("SgqDataGrid — sort iniziale", () => {
  it("senza override ordina la prima colonna sortable A→Z", () => {
    render(<SgqDataGrid rows={ROWS} columns={COLUMNS} getRowKey={(r) => r.id} />);
    const cells = screen.getAllByRole("cell");
    expect(cells[0]).toHaveTextContent("Alfa");
  });

  it("con initialSortCol=score desc mette prima il R più alto", () => {
    render(
      <SgqDataGrid
        rows={ROWS}
        columns={COLUMNS}
        getRowKey={(r) => r.id}
        initialSortCol="score"
        initialSortDir="desc"
      />
    );
    const cells = screen.getAllByRole("cell");
    expect(cells[0]).toHaveTextContent("Zeta");
    expect(cells[1]).toHaveTextContent("9");
  });
});

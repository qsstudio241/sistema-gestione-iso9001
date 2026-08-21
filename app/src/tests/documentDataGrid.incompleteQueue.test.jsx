/**
 * @vitest-environment jsdom
 *
 * IA-5b: chip motivi «da completare» in griglia catalogo.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import DocumentDataGrid from "../components/DocumentDataGrid";

describe("DocumentDataGrid — coda da completare", () => {
  it("mostra i motivi tipo / cartella / campi / bozza", () => {
    render(
      <DocumentDataGrid
        documents={[
          {
            id: 1,
            doc_type: "altro",
            title: "",
            parent_id: null,
            import_status: "ai_draft",
            status: "in_approvazione",
          },
        ]}
        loading={false}
      />
    );
    expect(screen.getAllByText("Tipo incerto").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Cartella mancante").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Campi vuoti").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Bozza AI").length).toBeGreaterThan(0);
  });

  it("non mostra chip su un documento completo", () => {
    render(
      <DocumentDataGrid
        documents={[
          {
            id: 2,
            doc_type: "procedura",
            title: "PG-04",
            parent_id: 9,
            import_status: "verified",
            status: "rilasciato",
          },
        ]}
        loading={false}
      />
    );
    expect(screen.queryByText("Bozza AI")).toBeNull();
    expect(screen.queryByText("Tipo incerto")).toBeNull();
  });
});

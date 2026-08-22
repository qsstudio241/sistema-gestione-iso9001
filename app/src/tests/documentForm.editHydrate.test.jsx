/**
 * @vitest-environment jsdom
 *
 * Modifica idrata da GET /documents/:id: la riga elenco omette type_specific_data.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("../services/apiService", () => ({
  default: {
    getDocTypeConfig: vi.fn().mockResolvedValue([]),
    getDocument: vi.fn(),
    lookupNormStatus: vi.fn().mockResolvedValue({
      status: "unknown",
      supersededBy: null,
      catalogUrl: null,
    }),
    getDocuments: vi.fn().mockResolvedValue({ data: [] }),
    getFolderSuggestion: vi.fn().mockResolvedValue(null),
  },
}));

import apiService from "../services/apiService";
import DocumentForm, { parseTypeSpecificData } from "../components/DocumentForm";

describe("parseTypeSpecificData", () => {
  it("accetta oggetto e JSON string", () => {
    expect(parseTypeSpecificData({ standard_code: "ISO 1" })).toEqual({
      standard_code: "ISO 1",
    });
    expect(parseTypeSpecificData('{"norm_title":"Titolo"}')).toEqual({
      norm_title: "Titolo",
    });
    expect(parseTypeSpecificData(null)).toEqual({});
  });
});

describe("DocumentForm — Modifica idrata TSD da GET dettaglio", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiService.getDocTypeConfig.mockResolvedValue([]);
    apiService.lookupNormStatus.mockResolvedValue({
      status: "unknown",
      supersededBy: null,
      catalogUrl: null,
    });
  });

  it("riga elenco senza TSD: dopo GET i campi norma sono compilati", async () => {
    apiService.getDocument.mockResolvedValue({
      data: {
        id: 42,
        title: "ISO 9001",
        doc_type: "norma",
        notes: "",
        type_specific_data: {
          standard_code: "ISO 9001:2015",
          norm_title: "Quality management systems — Requirements",
          issuing_body: "ISO",
          edition_year: 2015,
        },
      },
    });

    const listRow = {
      id: 42,
      title: "ISO 9001",
      doc_type: "norma",
    };

    render(
      <DocumentForm
        doc={listRow}
        companies={[]}
        standards={[]}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.queryByDisplayValue("ISO 9001:2015")).toBeNull();

    await waitFor(() => {
      expect(apiService.getDocument).toHaveBeenCalledWith(42);
    });

    expect(await screen.findByDisplayValue("ISO 9001:2015")).toBeInTheDocument();
    expect(
      screen.getByDisplayValue("Quality management systems — Requirements")
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue("2015")).toBeInTheDocument();
    expect(screen.getByDisplayValue("ISO")).toBeInTheDocument();
  });
});

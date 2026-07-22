import { describe, it, expect } from "vitest";
import {
  isPdfFile,
  buildDocumentUpdateFromAiMetadata,
} from "../utils/documentMetadataExtraction";

describe("documentMetadataExtraction", () => {
  it("isPdfFile riconosce PDF", () => {
    expect(isPdfFile({ name: "a.PDF", type: "" })).toBe(true);
    expect(isPdfFile({ name: "a.docx", type: "application/pdf" })).toBe(true);
    expect(isPdfFile({ name: "a.docx", type: "" })).toBe(false);
  });

  it("mappa titolo e codice solo se campi vuoti", () => {
    const { payload, labels } = buildDocumentUpdateFromAiMetadata({
      metadata: { titolo: "Procedura X", codice: "PG-01" },
      existingDoc: { title: "", doc_code: null },
      onlyEmpty: true,
    });
    expect(payload.title).toBe("Procedura X");
    expect(payload.doc_code).toBe("PG-01");
    expect(labels).toContain("Titolo");
  });

  it("non sovrascrive titolo esistente con onlyEmpty", () => {
    const { payload } = buildDocumentUpdateFromAiMetadata({
      metadata: { titolo: "Nuovo" },
      existingDoc: { title: "Vecchio" },
      onlyEmpty: true,
    });
    expect(payload.title).toBeUndefined();
  });
});

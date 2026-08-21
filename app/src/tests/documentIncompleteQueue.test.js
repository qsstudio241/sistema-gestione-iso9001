import { describe, it, expect } from "vitest";
import {
  getIncompleteReasons,
  isIncompleteRegistryDoc,
  isHighPriorityIncomplete,
} from "../utils/documentIncompleteQueue";

describe("documentIncompleteQueue", () => {
  it("esclude cartelle e obsoleti", () => {
    expect(isIncompleteRegistryDoc({ doc_type: "folder", title: "", parent_id: null })).toBe(false);
    expect(isIncompleteRegistryDoc({
      doc_type: "altro",
      status: "obsoleto",
      title: "",
      parent_id: null,
      import_status: "ai_draft",
    })).toBe(false);
  });

  it("segnala tipo incerto, cartella mancante, titolo vuoto e bozza AI", () => {
    const keys = getIncompleteReasons({
      doc_type: "altro",
      title: "  ",
      parent_id: 0,
      import_status: "ai_draft",
      status: "in_approvazione",
    }).map((r) => r.key);
    expect(keys).toEqual(["tipo", "cartella", "campi", "bozza"]);
    expect(isHighPriorityIncomplete({
      doc_type: "altro",
      title: "x",
      parent_id: 1,
      import_status: "active",
    })).toBe(true);
  });

  it("capitolato posato con titolo e cartella resta solo bozza (priorità bassa)", () => {
    const doc = {
      doc_type: "capitolato",
      title: "RFQ-12",
      parent_id: 88,
      import_status: "ai_draft",
      status: "in_approvazione",
    };
    const reasons = getIncompleteReasons(doc);
    expect(reasons).toHaveLength(1);
    expect(reasons[0].key).toBe("bozza");
    expect(isHighPriorityIncomplete(doc)).toBe(false);
    expect(isIncompleteRegistryDoc(doc)).toBe(true);
  });

  it("documento verificato con tipo, cartella e titolo non è in coda", () => {
    expect(isIncompleteRegistryDoc({
      doc_type: "procedura",
      title: "PG-04",
      parent_id: 12,
      import_status: "verified",
      status: "rilasciato",
    })).toBe(false);
  });
});

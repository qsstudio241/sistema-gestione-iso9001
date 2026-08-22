import { describe, it, expect } from "vitest";
import {
  getIncompleteReasons,
  isIncompleteRegistryDoc,
  isHighPriorityIncomplete,
  applyIncompleteQueueFilters,
  catalogQueryFromFilters,
  incompleteQueueBadgeCount,
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

  it("aprendo la coda resetta status e gli altri filtri che nascondono gli incompleti", () => {
    const opened = applyIncompleteQueueFilters({
      search: "PG",
      doc_type: "procedura",
      status: "rilasciato",
      standard_id: "3",
      expiring_days: 30,
      without_file: true,
      incomplete: false,
    }, true);
    expect(opened).toMatchObject({
      search: "",
      doc_type: "",
      status: "",
      standard_id: "",
      expiring_days: null,
      without_file: false,
      incomplete: true,
    });
    expect(catalogQueryFromFilters(opened)).toEqual({ incomplete: 1 });
  });

  it("chiudendo la coda spegne solo incomplete", () => {
    const closed = applyIncompleteQueueFilters({
      status: "in_approvazione",
      incomplete: true,
    }, false);
    expect(closed.incomplete).toBe(false);
    expect(closed.status).toBe("in_approvazione");
  });

  it("badge e lista: stessa fonte quando la coda è aperta (non stats org-wide)", () => {
    expect(incompleteQueueBadgeCount({
      incomplete: true,
      catalogTotal: 3,
      statsCount: 4,
      catalogIsIncompleteQueue: true,
    })).toBe(3);
    expect(incompleteQueueBadgeCount({
      incomplete: false,
      catalogTotal: 3,
      statsCount: 4,
      catalogIsIncompleteQueue: true,
    })).toBe(4);
    expect(incompleteQueueBadgeCount({
      incomplete: true,
      catalogTotal: 0,
      statsCount: 4,
      catalogIsIncompleteQueue: true,
    })).toBe(0);
  });

  it("aprendo la coda non usa il totale catalogo precedente", () => {
    expect(incompleteQueueBadgeCount({
      incomplete: true,
      catalogTotal: 100,
      statsCount: 4,
      catalogIsIncompleteQueue: false,
    })).toBe(4);
    expect(incompleteQueueBadgeCount({
      incomplete: true,
      catalogTotal: 100,
      statsCount: 4,
    })).toBe(4);
  });

  it("badge e lista: dopo apertura la query coincide col predicato incomplete", () => {
    const stale = { status: "rilasciato", doc_type: "altro", incomplete: false };
    const inApprovazione = {
      doc_type: "altro",
      title: "",
      parent_id: null,
      import_status: "ai_draft",
      status: "in_approvazione",
    };
    expect(isIncompleteRegistryDoc(inApprovazione)).toBe(true);
    const query = catalogQueryFromFilters(applyIncompleteQueueFilters(stale, true));
    expect(query.status).toBeUndefined();
    expect(query).toEqual({ incomplete: 1 });
  });
});

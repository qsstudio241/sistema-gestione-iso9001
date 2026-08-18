import { describe, it, expect } from "vitest";
import { buildRisksListParams } from "../utils/risksListParams";

describe("buildRisksListParams", () => {
  it("di default non chiede i chiusi (il BE li esclude)", () => {
    expect(buildRisksListParams({})).toEqual({});
  });

  it("Totale non passa status", () => {
    expect(buildRisksListParams({ statFilter: "total", filterCompany: "48" }))
      .toEqual({ company_id: "48" });
  });

  it("card stato passa status", () => {
    expect(buildRisksListParams({ statFilter: "open" })).toEqual({ status: "open" });
    expect(buildRisksListParams({ statFilter: "closed" })).toEqual({ status: "closed" });
  });

  it("card alta priorità passa high_priority", () => {
    expect(buildRisksListParams({ statFilter: "high_priority", filterCompany: "48" }))
      .toEqual({ company_id: "48", high_priority: "1" });
  });

  it("mostra chiusi solo se non c'è filtro stato (retrocompat)", () => {
    expect(buildRisksListParams({ showClosed: true })).toEqual({ include_closed: "1" });
    expect(buildRisksListParams({ filterStatus: "closed", showClosed: false }))
      .toEqual({ status: "closed" });
  });

  it("passa azienda", () => {
    expect(buildRisksListParams({ filterCompany: "48" })).toEqual({ company_id: "48" });
  });
});

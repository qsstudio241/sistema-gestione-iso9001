import { describe, it, expect } from "vitest";
import { buildRisksListParams } from "../utils/risksListParams";

describe("buildRisksListParams", () => {
  it("di default non chiede i chiusi (il BE li esclude)", () => {
    expect(buildRisksListParams({})).toEqual({});
  });

  it("mostra chiusi solo se non c'è filtro stato", () => {
    expect(buildRisksListParams({ showClosed: true })).toEqual({ include_closed: "1" });
    expect(buildRisksListParams({ filterStatus: "closed", showClosed: false }))
      .toEqual({ status: "closed" });
  });

  it("passa azienda", () => {
    expect(buildRisksListParams({ filterCompany: "48" })).toEqual({ company_id: "48" });
  });
});

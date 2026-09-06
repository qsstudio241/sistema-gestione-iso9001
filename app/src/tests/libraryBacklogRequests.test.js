/**
 * Test L1 — libraryBacklogRequests (merge AI + piattaforma)
 */
import { describe, it, expect } from "vitest";
import {
  isSatisfiedByPlatformDigitized,
  mergeAiAndPlatformBacklog,
  mergeBacklogRows,
} from "../utils/libraryBacklogRequests";

describe("libraryBacklogRequests", () => {
  it("riconosce digitalizzata piattaforma con codice correlato (15614)", () => {
    const platform = [
      {
        code: "ISO 15614-1:2017+A1:2019 (WPQR acciaio/nichel)",
        status: "digitalizzata",
      },
    ];
    expect(
      isSatisfiedByPlatformDigitized(platform, "ISO 15614-1:2017")
    ).toBe(true);
    expect(isSatisfiedByPlatformDigitized(platform, "ISO 14555:2025")).toBe(
      false
    );
  });

  it("nasconde gap Assistente aperti già coperti da digitalizzata", () => {
    const platform = [
      {
        code: "ISO 15614-1:2017+A1:2019 (WPQR)",
        status: "digitalizzata",
        priority: "P0",
        notes: "NORMA_00043",
      },
      {
        code: "EN 10025-3",
        status: "parcheggio",
        priority: "P2",
      },
    ];
    const server = [
      {
        id: "srv-1",
        code: "ISO 15614-1:2017",
        status: "da_richiedere",
        source: "assistente",
        notes: "gap AI",
      },
    ];
    const merged = mergeAiAndPlatformBacklog(platform, server);
    expect(merged.some((r) => /15614-1:2017$/.test(String(r.code)))).toBe(
      false
    );
    expect(
      merged.some(
        (r) =>
          String(r.code).includes("15614-1:2017+A1") &&
          r.status === "digitalizzata"
      )
    ).toBe(true);
    expect(merged.some((r) => r.code === "EN 10025-3")).toBe(true);
  });

  it("mergeBacklogRows legacy resta solo piattaforma", () => {
    const merged = mergeBacklogRows(
      [{ code: "PLAT", status: "parcheggio" }],
      [{ code: "ignored-studio" }]
    );
    expect(merged).toHaveLength(1);
    expect(merged[0].source).toBe("piattaforma");
  });
});

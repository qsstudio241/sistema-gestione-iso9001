/**
 * Test L1 — libraryBacklogRequests (LN-5)
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  addLibraryRequest,
  formatLibraryRequestMarkdownRow,
  libraryRequestsStorageKey,
  loadLibraryRequests,
  mergeBacklogRows,
  normalizeLibraryRequestDraft,
  removeLibraryRequest,
  saveLibraryRequests,
} from "../utils/libraryBacklogRequests";

describe("libraryBacklogRequests", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("normalizza draft e rifiuta codice vuoto", () => {
    expect(() => normalizeLibraryRequestDraft({ code: "  " })).toThrow(/obbligatorio/i);
    const row = normalizeLibraryRequestDraft({
      code: " ISO X ",
      impact: "MC",
      priority: "P1",
    });
    expect(row.code).toBe("ISO X");
    expect(row.impact).toBe("MC");
    expect(row.status).toBe("da_richiedere");
    expect(row.source).toBe("studio");
  });

  it("persiste su localStorage per organization_id", () => {
    expect(libraryRequestsStorageKey(1001)).toBe("sgq_library_requests_v1_1001");
    addLibraryRequest(1001, { code: "ISO 999", notes: "serve" });
    const loaded = loadLibraryRequests(1001);
    expect(loaded).toHaveLength(1);
    expect(loaded[0].code).toBe("ISO 999");
    expect(loadLibraryRequests(1002)).toHaveLength(0);
  });

  it("formatta riga Markdown e fa merge piattaforma+studio", () => {
    const studio = addLibraryRequest(7, { code: "Q-1", impact: "CND", priority: "P0" });
    const md = formatLibraryRequestMarkdownRow(studio);
    expect(md).toContain("| Q-1 |");
    expect(md).toContain("`da_richiedere`");
    const merged = mergeBacklogRows([{ code: "PLAT", status: "parcheggio" }], [studio]);
    expect(merged[0].source).toBe("studio");
    expect(merged[1].source).toBe("piattaforma");
    removeLibraryRequest(7, studio.id);
    expect(loadLibraryRequests(7)).toHaveLength(0);
    saveLibraryRequests(7, []);
  });
});

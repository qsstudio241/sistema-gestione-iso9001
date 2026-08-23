/**
 * CND-4: export VT risolve il template VPS (scope cnd) e cade sul file locale.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { loadVtTemplate } from "../utils/vtWordExport.js";

describe("loadVtTemplate — resolve CND", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("scarica il .docx dal VPS se resolve restituisce un id", async () => {
    const buf = new ArrayBuffer(8);
    const api = {
      resolveCndReportTemplate: vi.fn().mockResolvedValue({ id: 4, name: "VT sistema" }),
      getReportTemplateArrayBuffer: vi.fn().mockResolvedValue(buf),
    };
    const result = await loadVtTemplate("/templates/VT-verbale.docx", { api, reportType: "VT" });
    expect(result).toBe(buf);
    expect(api.resolveCndReportTemplate).toHaveBeenCalledWith("VT");
    expect(api.getReportTemplateArrayBuffer).toHaveBeenCalledWith(4);
  });

  it("usa il file locale se resolve fallisce (offline)", async () => {
    const buf = new ArrayBuffer(4);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => buf }),
    );
    const api = {
      resolveCndReportTemplate: vi.fn().mockRejectedValue(new Error("network")),
      getReportTemplateArrayBuffer: vi.fn(),
    };
    const result = await loadVtTemplate("/templates/VT-verbale.docx", { api, reportType: "VT" });
    expect(result).toBe(buf);
    expect(fetch).toHaveBeenCalled();
    expect(api.getReportTemplateArrayBuffer).not.toHaveBeenCalled();
  });
});

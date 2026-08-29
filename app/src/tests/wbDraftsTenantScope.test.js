/**
 * @vitest-environment jsdom
 * Isolamento multi-tenant bozze Welding Book in localStorage (Passo 1 audit persistenza).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../services/apiService.js", () => ({
  default: {
    getStoredUser: vi.fn(() => null),
  },
}));

import apiService from "../services/apiService.js";
import {
  loadWeldingBookDraft,
  wbDraftKey,
  wbDraftMatchesOrganization,
  WB_DRAFT_KEY_PREFIX,
} from "../hooks/useWeldingBookAutoSave.js";

describe("Bozze Welding Book localStorage — scope organization_id", () => {
  beforeEach(() => {
    localStorage.clear();
    apiService.getStoredUser.mockReset();
    apiService.getStoredUser.mockReturnValue(null);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("org A non vede bozza org B (chiave new)", () => {
    const key = wbDraftKey(null);
    expect(key).toBe(`${WB_DRAFT_KEY_PREFIX}new`);
    localStorage.setItem(
      key,
      JSON.stringify({
        formData: { product_code: "SEGRETO-ORG-A" },
        equipment: [],
        welds: [],
        organization_id: 1002,
        savedAt: new Date().toISOString(),
      }),
    );

    apiService.getStoredUser.mockReturnValue({ organization_id: 1003 });
    expect(loadWeldingBookDraft(null)).toBeNull();
    expect(loadWeldingBookDraft(null, 1002)?.formData?.product_code).toBe(
      "SEGRETO-ORG-A",
    );
  });

  it("bozza legacy senza organization_id non viene ripristinata se org noto", () => {
    localStorage.setItem(
      wbDraftKey("new"),
      JSON.stringify({
        formData: { product_code: "LEGACY" },
        organization_id: null,
      }),
    );
    apiService.getStoredUser.mockReturnValue({ organization_id: 1002 });
    expect(loadWeldingBookDraft(null, 1002)).toBeNull();
    expect(wbDraftMatchesOrganization({ organization_id: null }, 1002)).toBe(
      false,
    );
    expect(wbDraftMatchesOrganization({ organization_id: 1002 }, 1002)).toBe(
      true,
    );
  });
});

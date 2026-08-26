/**
 * @vitest-environment jsdom
 * Isolamento multi-tenant bozze CND in localStorage (hotfix post CND-8).
 * Leak: bozza lasciata da login studio A appariva in lista studio B sullo stesso browser.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../services/apiService.js", () => ({
  default: {
    getStoredUser: vi.fn(() => null),
  },
}));

import apiService from "../services/apiService.js";
import {
  seedNdtLocalDraft,
  listNdtDrafts,
  ndtDraftMatchesOrganization,
  resolveNdtDraftOrganizationId,
  NDT_DRAFT_KEY_PREFIX,
} from "../hooks/useNdtAutoSave.js";

describe("Bozze NDT localStorage — scope organization_id", () => {
  beforeEach(() => {
    localStorage.clear();
    apiService.getStoredUser.mockReset();
    apiService.getStoredUser.mockReturnValue(null);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("seed persiste organization_id dallo user corrente", () => {
    apiService.getStoredUser.mockReturnValue({
      full_name: "Marco Camellini",
      organization_id: 1002,
    });
    const seeded = seedNdtLocalDraft({ inspector: "Marco Camellini" });
    expect(seeded.organization_id).toBe(1002);
    const raw = JSON.parse(localStorage.getItem(seeded.draftKey));
    expect(raw.organization_id).toBe(1002);
  });

  it("bozza org A NON compare quando user ha organization_id B", () => {
    seedNdtLocalDraft({
      inspector: "Marco Camellini",
      organizationId: 1002,
    });
    apiService.getStoredUser.mockReturnValue({
      full_name: "Admin Mason",
      organization_id: 1003,
    });
    const drafts = listNdtDrafts();
    expect(drafts).toHaveLength(0);
  });

  it("bozza org A compare solo con user della stessa org", () => {
    const seeded = seedNdtLocalDraft({
      inspector: "Marco Camellini",
      organizationId: 1002,
    });
    apiService.getStoredUser.mockReturnValue({
      full_name: "Altro Camellini",
      organization_id: 1002,
    });
    const drafts = listNdtDrafts();
    expect(drafts).toHaveLength(1);
    expect(drafts[0].client_uuid).toBe(seeded.uuid);
    expect(drafts[0].organization_id).toBe(1002);
  });

  it("bozza legacy senza organization_id NON compare se c'è org loggata (no leak)", () => {
    const uuid = "legacy-uuid-no-org";
    const key = `${NDT_DRAFT_KEY_PREFIX}${uuid}`;
    localStorage.setItem(
      key,
      JSON.stringify({
        savedAt: new Date().toISOString(),
        formData: { inspector: "Marco Camellini", status: "draft", report_type: "VT" },
        items: [],
        client_uuid: uuid,
        queued: false,
        // niente organization_id — bozza CND-8 pre-hotfix
      })
    );
    localStorage.setItem(
      "sgq:ndt_draft_index",
      JSON.stringify([key])
    );

    apiService.getStoredUser.mockReturnValue({
      full_name: "Admin Mason",
      organization_id: 1003,
    });
    expect(listNdtDrafts()).toHaveLength(0);
    expect(listNdtDrafts(1003)).toHaveLength(0);
  });

  it("ndtDraftMatchesOrganization esclude legacy e mismatch", () => {
    expect(ndtDraftMatchesOrganization({ organization_id: 1002 }, 1002)).toBe(true);
    expect(ndtDraftMatchesOrganization({ organization_id: 1002 }, 1003)).toBe(false);
    expect(ndtDraftMatchesOrganization({ formData: {} }, 1003)).toBe(false);
    expect(ndtDraftMatchesOrganization({ organization_id: 1002 }, null)).toBe(false);
  });

  it("resolveNdtDraftOrganizationId preferisce argomento esplicito", () => {
    apiService.getStoredUser.mockReturnValue({ organization_id: 1002 });
    expect(resolveNdtDraftOrganizationId(1003)).toBe(1003);
    expect(resolveNdtDraftOrganizationId(null)).toBe(1002);
  });
});

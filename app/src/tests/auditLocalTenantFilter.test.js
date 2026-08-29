/**
 * Isolamento tenant bozze/cache audit locali (Passo 1).
 */
import { describe, it, expect } from "vitest";
import {
  auditMatchesOrganization,
  filterAuditsByOrganization,
  getAuditOrganizationId,
  resolveAuditOrganizationId,
} from "../utils/auditLocalTenantFilter.js";

describe("auditLocalTenantFilter", () => {
  it("resolveAuditOrganizationId preferisce esplicito poi user", () => {
    expect(resolveAuditOrganizationId(1002, { organization_id: 1001 })).toBe(
      1002,
    );
    expect(resolveAuditOrganizationId(null, { organization_id: 1001 })).toBe(
      1001,
    );
    expect(resolveAuditOrganizationId(null, null)).toBeNull();
  });

  it("org A non vede bozza intenzionale org B", () => {
    const draftA = {
      metadata: {
        id: "uuid-a",
        isIntentionalDraft: true,
        organizationId: 1002,
      },
    };
    const draftB = {
      metadata: {
        id: "uuid-b",
        isIntentionalDraft: true,
        organizationId: 1003,
      },
    };
    expect(auditMatchesOrganization(draftA, 1003)).toBe(false);
    expect(auditMatchesOrganization(draftB, 1003)).toBe(true);
    const filtered = filterAuditsByOrganization([draftA, draftB], 1003);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].metadata.id).toBe("uuid-b");
  });

  it("legacy senza organization_id esclusa se org corrente noto", () => {
    const legacy = {
      metadata: { id: "legacy", isIntentionalDraft: true },
    };
    expect(getAuditOrganizationId(legacy)).toBeNull();
    expect(auditMatchesOrganization(legacy, 1002)).toBe(false);
    expect(filterAuditsByOrganization([legacy], 1002)).toEqual([]);
  });
});

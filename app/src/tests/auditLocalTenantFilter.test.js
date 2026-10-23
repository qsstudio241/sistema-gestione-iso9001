/**
 * Isolamento tenant bozze/cache audit locali (Passo 1).
 */
import { describe, it, expect } from "vitest";
import {
  auditMatchesOrganization,
  filterAuditsByOrganization,
  getAuditOrganizationId,
  resolveAuditOrganizationId,
  selectAuditsForOfflineReopen,
  stampMissingOrganization,
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

  it("offline riapre il recente senza studio e nasconde l'altro studio", () => {
    const legacy = { metadata: { id: "aperto-qui", clientName: "Locale" } };
    const other = { metadata: { id: "altro", organizationId: 1003 } };
    const stamped = stampMissingOrganization(legacy, 1002);
    expect(stamped.metadata.organizationId).toBe(1002);
    expect(stampMissingOrganization(other, 1002)).toBe(other);
    const visible = selectAuditsForOfflineReopen(
      [legacy, other],
      1002,
      ["aperto-qui"],
    );
    expect(visible.map((audit) => audit.metadata.id)).toEqual(["aperto-qui"]);
    expect(visible[0].metadata.organizationId).toBe(1002);
  });
});

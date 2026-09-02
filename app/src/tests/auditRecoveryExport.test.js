/**
 * L1 CONS-6 — export di recupero: filtro UUID, coda vuota, niente token.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  AUDIT_RECOVERY_EXPORT_VERSION,
  buildAuditRecoveryFilename,
  buildAuditRecoveryPackage,
  stripSecrets,
  triggerJsonDownload,
} from "../utils/auditRecoveryExport";

const AUDIT_UUID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

function sampleAudit(overrides = {}) {
  return {
    id: AUDIT_UUID,
    metadata: {
      id: AUDIT_UUID,
      auditNumber: "AUD-1",
      clientName: "Camellini",
      organizationId: 1001,
      auditId: 42,
      status: "draft",
      ...overrides.metadata,
    },
    checklist: { ISO_9001: {} },
    token: "MUST-NOT-APPEAR",
    ...overrides,
  };
}

describe("buildAuditRecoveryPackage", () => {
  it("filtra la coda per UUID dell'audit aperto", () => {
    const audit = sampleAudit();
    const queueItems = [
      { id: "q1", type: "save_responses", payload: { auditId: AUDIT_UUID, responses: [{ q: 1 }] } },
      { id: "q2", type: "update_audit", payload: { audit_uuid: AUDIT_UUID, client_name: "Camellini" } },
      { id: "q3", type: "save_responses", payload: { auditId: "altro-uuid-0000", responses: [] } },
      { id: "q4", type: "send_audit_event", payload: { auditUuid: AUDIT_UUID, event: { event_type: "response_set" } } },
      { id: "q5", type: "create_audit", payload: { audit_uuid: "ffff-altro" } },
    ];

    const pkg = buildAuditRecoveryPackage(audit, queueItems, {
      exportedAt: "2026-09-02T10:00:00.000Z",
    });

    expect(pkg.version).toBe(AUDIT_RECOVERY_EXPORT_VERSION);
    expect(pkg.exportedAt).toBe("2026-09-02T10:00:00.000Z");
    expect(pkg.auditUuid).toBe(AUDIT_UUID);
    expect(pkg.audit.metadata.auditNumber).toBe("AUD-1");
    expect(pkg.queueItems.map((i) => i.id)).toEqual(["q1", "q2", "q4"]);
  });

  it("senza coda (undefined o array vuoto) restituisce queueItems vuoto", () => {
    const audit = sampleAudit();
    const empty = buildAuditRecoveryPackage(audit, [], {
      exportedAt: "2026-09-02T12:00:00.000Z",
    });
    expect(empty.queueItems).toEqual([]);
    expect(empty.auditUuid).toBe(AUDIT_UUID);

    const missing = buildAuditRecoveryPackage(audit, undefined, {
      exportedAt: "2026-09-02T12:00:00.000Z",
    });
    expect(missing.queueItems).toEqual([]);
  });

  it("non include token né chiavi jwt/authorization/password", () => {
    const audit = sampleAudit({
      metadata: {
        id: AUDIT_UUID,
        auditNumber: "AUD-1",
        clientName: "Camellini",
        organizationId: 1001,
        jwt: "eyJhbGciOiJIUzI1NiJ9.aaa.bbb",
      },
    });
    const queueItems = [
      {
        id: "q-tok",
        type: "update_audit",
        token: "queue-token",
        payload: {
          audit_uuid: AUDIT_UUID,
          authorization: "Bearer abc",
          password: "segreto",
          access_token: "xyz",
          client_name: "Camellini",
        },
      },
    ];

    const pkg = buildAuditRecoveryPackage(audit, queueItems, {
      exportedAt: "2026-09-02T15:00:00.000Z",
    });
    const json = JSON.stringify(pkg);

    expect(pkg.audit.token).toBeUndefined();
    expect(pkg.audit.metadata.jwt).toBeUndefined();
    expect(pkg.queueItems).toHaveLength(1);
    expect(pkg.queueItems[0].token).toBeUndefined();
    expect(pkg.queueItems[0].payload.authorization).toBeUndefined();
    expect(pkg.queueItems[0].payload.password).toBeUndefined();
    expect(pkg.queueItems[0].payload.access_token).toBeUndefined();
    expect(pkg.queueItems[0].payload.client_name).toBe("Camellini");
    expect(json).not.toMatch(/MUST-NOT-APPEAR/);
    expect(json).not.toMatch(/queue-token/);
    expect(json).not.toMatch(/Bearer abc/);
    expect(json).not.toMatch(/eyJhbGciOiJIUzI1NiJ9/);
  });

  it("rispetta lo scope organization_id se presente sull'item coda", () => {
    const audit = sampleAudit();
    const queueItems = [
      {
        id: "same-org",
        type: "update_audit",
        payload: { audit_uuid: AUDIT_UUID, organization_id: 1001 },
      },
      {
        id: "other-org",
        type: "update_audit",
        payload: { audit_uuid: AUDIT_UUID, organization_id: 1002 },
      },
      {
        id: "no-org",
        type: "save_responses",
        payload: { auditId: AUDIT_UUID },
      },
    ];
    const pkg = buildAuditRecoveryPackage(audit, queueItems);
    expect(pkg.queueItems.map((i) => i.id)).toEqual(["same-org", "no-org"]);
  });

  it("senza audit restituisce null", () => {
    expect(buildAuditRecoveryPackage(null, [])).toBeNull();
  });
});

describe("buildAuditRecoveryFilename", () => {
  it("usa uuid corto e data ISO", () => {
    expect(buildAuditRecoveryFilename(AUDIT_UUID, "2026-09-02T18:00:00.000Z")).toBe(
      "sgq-audit-recupero-a1b2c3d4-2026-09-02.json",
    );
  });
});

describe("stripSecrets", () => {
  it("lascia i campi operativi", () => {
    const clean = stripSecrets({ notes: "ok", token: "x", nested: { password: "p", n: 1 } });
    expect(clean).toEqual({ notes: "ok", nested: { n: 1 } });
  });
});

describe("triggerJsonDownload", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("usa Blob e a[download] con il nome file", () => {
    const createUrl = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:recupero");
    const revokeUrl = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const clicks = [];
    const origCreate = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag) => {
      const el = origCreate(tag);
      if (tag === "a") {
        el.click = () => {
          clicks.push({ download: el.download, href: el.href });
        };
      }
      return el;
    });

    triggerJsonDownload({ version: 1, auditUuid: AUDIT_UUID }, "sgq-audit-recupero-a1b2c3d4-2026-09-02.json");

    expect(createUrl).toHaveBeenCalledTimes(1);
    expect(createUrl.mock.calls[0][0]).toBeInstanceOf(Blob);
    expect(clicks).toEqual([
      { download: "sgq-audit-recupero-a1b2c3d4-2026-09-02.json", href: "blob:recupero" },
    ]);
    expect(revokeUrl).toHaveBeenCalledWith("blob:recupero");
  });
});

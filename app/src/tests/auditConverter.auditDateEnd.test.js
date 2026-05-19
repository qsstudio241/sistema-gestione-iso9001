import { describe, it, expect } from "vitest";
import { backendToFrontend, frontendToBackend } from "../utils/auditConverter";

describe("auditConverter audit_date_end", () => {
  it("backendToFrontend mappa audit_date_end", () => {
    const fe = backendToFrontend({
      audit_id: 1,
      audit_uuid: "uuid-1",
      audit_date: "2026-05-10",
      audit_date_end: "2026-05-12",
      client_name: "Cliente",
    });
    expect(fe.metadata.auditDate).toBe("2026-05-10");
    expect(fe.metadata.auditDateEnd).toBe("2026-05-12");
  });

  it("frontendToBackend mappa auditDateEnd", () => {
    const be = frontendToBackend({
      id: "uuid-1",
      metadata: {
        id: "uuid-1",
        auditDate: "2026-05-10",
        auditDateEnd: "2026-05-12",
        clientName: "Cliente",
      },
    });
    expect(be.audit_date).toBe("2026-05-10");
    expect(be.audit_date_end).toBe("2026-05-12");
  });
});

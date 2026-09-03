/**
 * L1 CONS-4 — skip hydrate server-wins se la coda di quell’audit è attiva.
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  PENDING_AUDIT_HYDRATE_TYPES,
  collectQueueItemAuditRefs,
  isActivePendingHydrateItem,
  shouldSkipServerHydrate,
  resolveChecklistHydrateWithPendingQueue,
} from "../utils/pendingAuditQueue";
import { _resetDraftRegistryForTests } from "../utils/draftFieldRegistry";

const AUDIT_UUID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const OTHER_UUID = "bbbbbbbb-0000-0000-0000-000000000001";

function item(type, payload, extras = {}) {
  return { id: `q-${type}`, type, payload, isStalled: false, ...extras };
}

describe("shouldSkipServerHydrate (CONS-4)", () => {
  beforeEach(() => {
    _resetDraftRegistryForTests();
  });

  it("coda vuota o assente → non skip (si può hydratare)", () => {
    expect(shouldSkipServerHydrate([], AUDIT_UUID)).toBe(false);
    expect(shouldSkipServerHydrate(undefined, AUDIT_UUID)).toBe(false);
    expect(shouldSkipServerHydrate(null, AUDIT_UUID)).toBe(false);
  });

  it("senza UUID né extraRefs → non skip", () => {
    const queue = [item("save_responses", { auditId: AUDIT_UUID })];
    expect(shouldSkipServerHydrate(queue, null)).toBe(false);
    expect(shouldSkipServerHydrate(queue, "")).toBe(false);
  });

  it.each([
    ["save_responses", { auditId: AUDIT_UUID }],
    ["save_custom_checklist_responses", { auditId: AUDIT_UUID }],
    ["update_audit", { audit_uuid: AUDIT_UUID }],
    ["send_audit_event", { auditUuid: AUDIT_UUID, event: { event_type: "response_set" } }],
  ])("%s attivo per lo stesso UUID → skip", (type, payload) => {
    expect(PENDING_AUDIT_HYDRATE_TYPES).toContain(type);
    expect(shouldSkipServerHydrate([item(type, payload)], AUDIT_UUID)).toBe(true);
  });

  it("item stalled (stesso UUID) → non skip", () => {
    const queue = [
      item("save_responses", { auditId: AUDIT_UUID }, { isStalled: true }),
    ];
    expect(isActivePendingHydrateItem(queue[0])).toBe(false);
    expect(shouldSkipServerHydrate(queue, AUDIT_UUID)).toBe(false);
  });

  it("item di un altro audit → non skip", () => {
    const queue = [
      item("save_responses", { auditId: OTHER_UUID }),
      item("update_audit", { audit_uuid: OTHER_UUID }),
    ];
    expect(shouldSkipServerHydrate(queue, AUDIT_UUID)).toBe(false);
  });

  it("create_audit / upload non bloccano l’hydrate esiti", () => {
    const queue = [
      item("create_audit", { audit_uuid: AUDIT_UUID }),
      item("upload_attachment", { auditUuid: AUDIT_UUID, auditId: AUDIT_UUID }),
    ];
    expect(shouldSkipServerHydrate(queue, AUDIT_UUID)).toBe(false);
  });

  it("match case-insensitive sull’UUID", () => {
    const queue = [item("update_audit", { audit_uuid: AUDIT_UUID.toUpperCase() })];
    expect(shouldSkipServerHydrate(queue, AUDIT_UUID)).toBe(true);
  });

  it("save_responses con solo auditId numerico: extraRefs fa match", () => {
    const queue = [item("save_responses", { auditId: 77, responses: [{ q: 1 }] })];
    expect(shouldSkipServerHydrate(queue, AUDIT_UUID)).toBe(false);
    expect(shouldSkipServerHydrate(queue, AUDIT_UUID, [77])).toBe(true);
    expect(shouldSkipServerHydrate(queue, AUDIT_UUID, ["77"])).toBe(true);
  });

  it("dopo processQueue ok (nessun item attivo) → non skip", () => {
    const remaining = [item("save_responses", { auditId: OTHER_UUID }, { isStalled: true })];
    expect(shouldSkipServerHydrate(remaining, AUDIT_UUID)).toBe(false);
  });

  it("send_audit_event: UUID anche in payload.event", () => {
    const queue = [
      item("send_audit_event", { event: { auditUuid: AUDIT_UUID, type: "response_set" } }),
    ];
    expect(collectQueueItemAuditRefs(queue[0])).toContain(AUDIT_UUID);
    expect(shouldSkipServerHydrate(queue, AUDIT_UUID)).toBe(true);
  });
});

describe("resolveChecklistHydrateWithPendingQueue", () => {
  const localChecklist = {
    ISO_9001_2015: {
      "4.1": {
        questions: [{ questionId: "q1", status: "NC", notes: "Lavoro telefono" }],
      },
    },
  };
  const serverChecklist = {
    ISO_9001_2015: {
      "4.1": {
        questions: [{ questionId: "q1", status: "C", notes: "Vecchio server" }],
      },
    },
  };

  it("coda attiva → tiene gli esiti locali (non server-wins)", () => {
    const queue = [item("save_responses", { auditId: AUDIT_UUID })];
    const result = resolveChecklistHydrateWithPendingQueue(
      localChecklist,
      serverChecklist,
      queue,
      AUDIT_UUID,
    );
    expect(result).toBe(localChecklist);
    expect(result.ISO_9001_2015["4.1"].questions[0].status).toBe("NC");
  });

  it("coda vuota → riusa resolveMergedChecklistForReconcile (locale più ricco)", () => {
    const localRicher = {
      ISO_9001_2015: {
        "4.1": {
          questions: [
            { questionId: "q1", status: "NC", notes: "Lavoro telefono" },
            { questionId: "q2", status: "OSS", notes: "Seconda" },
          ],
        },
      },
    };
    const result = resolveChecklistHydrateWithPendingQueue(
      localRicher,
      serverChecklist,
      [],
      AUDIT_UUID,
    );
    expect(result).not.toBe(localRicher);
    expect(result.ISO_9001_2015["4.1"].questions[0].status).toBe("NC");
    expect(result.ISO_9001_2015["4.1"].questions[0].notes).toBe("Lavoro telefono");
    expect(result.ISO_9001_2015["4.1"].questions.some((q) => q.questionId === "q2")).toBe(true);
  });

  it("coda attiva ma senza checklist locale → lascia il server", () => {
    const queue = [item("update_audit", { audit_uuid: AUDIT_UUID })];
    const result = resolveChecklistHydrateWithPendingQueue(
      null,
      serverChecklist,
      queue,
      AUDIT_UUID,
    );
    expect(result).toBe(serverChecklist);
  });
});

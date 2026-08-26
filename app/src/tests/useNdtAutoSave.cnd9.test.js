/**
 * @vitest-environment jsdom
 * CND-9: rete di salvataggio officina — helper + enqueue verso syncQueue.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const enqueueMock = vi.fn();

vi.mock("../services/syncService.js", () => ({
  syncService: {
    enqueue: (...args) => enqueueMock(...args),
  },
}));

import {
  isNdtNetworkSaveError,
  ndtDraftKey,
  clearNdtDraftByKey,
  enqueueNdtReportSync,
  NDT_DRAFT_KEY_PREFIX,
} from "../hooks/useNdtAutoSave.js";

describe("CND-9 useNdtAutoSave helpers", () => {
  beforeEach(() => {
    localStorage.clear();
    enqueueMock.mockReset();
    enqueueMock.mockResolvedValue("queue-item-1");
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      writable: true,
      value: true,
    });
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("ndtDraftKey usa prefisso stabile", () => {
    expect(ndtDraftKey(null)).toBe(NDT_DRAFT_KEY_PREFIX + "new");
    expect(ndtDraftKey(42)).toBe(NDT_DRAFT_KEY_PREFIX + "42");
  });

  it("isNdtNetworkSaveError riconosce OFFLINE / NETWORK / status 0", () => {
    expect(isNdtNetworkSaveError({ code: "OFFLINE", status: 0 })).toBe(true);
    expect(isNdtNetworkSaveError({ code: "NETWORK_ERROR", status: 0 })).toBe(true);
    expect(isNdtNetworkSaveError({ code: "TIMEOUT", status: 408 })).toBe(true);
    expect(isNdtNetworkSaveError({ status: 0 })).toBe(true);
    expect(isNdtNetworkSaveError({ code: "NDT_INSPECTOR_GATE", status: 409 })).toBe(false);
    expect(isNdtNetworkSaveError({ message: "validation", status: 400 })).toBe(false);
  });

  it("isNdtNetworkSaveError è true se navigator.onLine === false", () => {
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      writable: true,
      value: false,
    });
    expect(isNdtNetworkSaveError({ message: "whatever", status: 500 })).toBe(true);
  });

  it("clearNdtDraftByKey rimuove la bozza", () => {
    const key = ndtDraftKey("new");
    localStorage.setItem(key, JSON.stringify({ formData: {} }));
    clearNdtDraftByKey(key);
    expect(localStorage.getItem(key)).toBeNull();
  });

  it("enqueueNdtReportSync chiama syncService.enqueue con uuid e emette evento", async () => {
    const events = [];
    const onEnq = (e) => events.push(e.detail);
    window.addEventListener("sgq:ndtReportEnqueued", onEnq);

    const draftKey = ndtDraftKey("new");
    const id = await enqueueNdtReportSync("create_ndt_report", {
      report_type: "VT",
      client: "Officina",
      draftKey,
      uuid: "fixed-uuid-cnd9",
    });

    expect(id).toBe("queue-item-1");
    expect(enqueueMock).toHaveBeenCalledTimes(1);
    const [type, payload] = enqueueMock.mock.calls[0];
    expect(type).toBe("create_ndt_report");
    expect(payload.uuid).toBe("fixed-uuid-cnd9");
    expect(payload.draftKey).toBe(draftKey);
    expect(payload.client).toBe("Officina");
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("create_ndt_report");
    expect(events[0].uuid).toBe("fixed-uuid-cnd9");

    window.removeEventListener("sgq:ndtReportEnqueued", onEnq);
  });

  it("enqueueNdtReportSync ritorna null se la coda non accetta (quota)", async () => {
    enqueueMock.mockResolvedValueOnce(null);
    const id = await enqueueNdtReportSync("create_ndt_report", {
      report_type: "VT",
      draftKey: ndtDraftKey("new"),
    });
    expect(id).toBeNull();
  });

  it("getOrCreateOfflineCreateUuid è stabile dopo refresh", async () => {
    const { getOrCreateOfflineCreateUuid, clearOfflineCreateUuid } = await import(
      "../hooks/useNdtAutoSave.js"
    );
    const key = ndtDraftKey("new");
    clearOfflineCreateUuid(key);
    const a = getOrCreateOfflineCreateUuid(key);
    const b = getOrCreateOfflineCreateUuid(key);
    expect(a).toBe(b);
    expect(a).toBeTruthy();
  });

  it("enqueueNdtReportSync per update include id verbale", async () => {
    await enqueueNdtReportSync("update_ndt_report", {
      id: 77,
      report_type: "PT",
      draftKey: ndtDraftKey(77),
    });
    const [type, payload] = enqueueMock.mock.calls[0];
    expect(type).toBe("update_ndt_report");
    expect(payload.id).toBe(77);
    expect(payload.uuid).toBeTruthy();
  });
});

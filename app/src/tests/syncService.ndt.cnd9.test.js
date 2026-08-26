/**
 * @vitest-environment jsdom
 * CND-9: syncService processa tipi NDT e emette sgq:ndtReportSynced + clear draft.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SyncService } from "../services/syncService.js";

const createNdtReport = vi.fn();
const updateNdtReport = vi.fn();

vi.mock("../services/apiService", () => ({
  default: {
    createNdtReport: (...a) => createNdtReport(...a),
    updateNdtReport: (...a) => updateNdtReport(...a),
    deleteNdtReport: vi.fn(),
  },
  hasAuditLockToken: () => false,
}));

class FakeStore {
  constructor() {
    this._data = new Map();
  }
  get(id) {
    return this._req(this._data.get(id));
  }
  put(item) {
    this._data.set(item.id, item);
    return this._req(undefined);
  }
  delete(id) {
    this._data.delete(id);
    return this._req(undefined);
  }
  getAll() {
    return this._req([...this._data.values()]);
  }
  index() {
    return { getAll: () => this.getAll() };
  }
  _req(val) {
    const req = { result: val, _os: null, _oe: null };
    Object.defineProperty(req, "onsuccess", {
      get() {
        return this._os;
      },
      set(fn) {
        this._os = fn;
        if (fn) Promise.resolve().then(() => fn());
      },
    });
    Object.defineProperty(req, "onerror", {
      get() {
        return this._oe;
      },
      set(fn) {
        this._oe = fn;
      },
    });
    return req;
  }
}

function makeFakeDb(storeData = {}) {
  const stores = {};
  const makeStore = (name) => {
    const s = new FakeStore();
    if (storeData[name]) {
      for (const item of storeData[name]) s._data.set(item.id, item);
    }
    return s;
  };
  return {
    transaction(storeNames) {
      const names = Array.isArray(storeNames) ? storeNames : [storeNames];
      for (const n of names) {
        if (!stores[n]) stores[n] = makeStore(n);
      }
      return {
        objectStore: (name) => stores[name] || makeStore(name),
      };
    },
    _stores: stores,
  };
}

function makeService(initialQueue = []) {
  const db = makeFakeDb({ syncQueue: initialQueue });
  const svc = new SyncService("/api/v1");
  svc.init = async () => db;
  svc.isOnline = true;
  svc.isSyncing = false;
  svc._globalRateLimitUntil = 0;
  return { svc, db };
}

describe("CND-9 syncService tipi NDT", () => {
  beforeEach(() => {
    localStorage.clear();
    createNdtReport.mockReset();
    updateNdtReport.mockReset();
    createNdtReport.mockResolvedValue({ data: { id: 10, report_number: "VT-2026-010" } });
    updateNdtReport.mockResolvedValue({ data: { id: 10 } });
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("processQueue create_ndt_report chiama API, clear draft e emette evento", async () => {
    const draftKey = "sgq:ndt_draft:new";
    localStorage.setItem(draftKey, JSON.stringify({ formData: { client: "x" } }));

    const events = [];
    const onSynced = (e) => events.push(e.detail);
    window.addEventListener("sgq:ndtReportSynced", onSynced);

    const item = {
      id: "q1",
      type: "create_ndt_report",
      payload: { report_type: "VT", client: "Officina", uuid: "u1", draftKey },
      timestamp: Date.now(),
      retryCount: 0,
      lastError: null,
    };
    const { svc, db } = makeService([item]);

    await svc.processQueue();

    expect(createNdtReport).toHaveBeenCalled();
    expect(localStorage.getItem(draftKey)).toBeNull();
    expect(events.some((d) => d.type === "create_ndt_report" && d.result?.id === 10)).toBe(true);
    const store = db.transaction(["syncQueue"]).objectStore("syncQueue");
    expect(store._data.has("q1")).toBe(false);

    window.removeEventListener("sgq:ndtReportSynced", onSynced);
  });

  it("processQueue update_ndt_report chiama API con id", async () => {
    const draftKey = "sgq:ndt_draft:55";
    localStorage.setItem(draftKey, "{}");
    const { svc } = makeService([
      {
        id: "q2",
        type: "update_ndt_report",
        payload: { id: 55, report_type: "MT", notes: "n", draftKey },
        timestamp: Date.now(),
        retryCount: 0,
        lastError: null,
      },
    ]);

    await svc.processQueue();

    expect(updateNdtReport).toHaveBeenCalledWith(55, expect.objectContaining({ report_type: "MT" }));
    expect(localStorage.getItem(draftKey)).toBeNull();
  });
});

/**
 * Regressione ADR-007 / passo correttivo storico:
 * al logout `clearSessionStoresOnLogout` deve svuotare queue, sync_metadata e allegati offline
 * così un altro account sulla stessa macchina non eredita mapping/operazioni del tenant precedente.
 *
 * @vitest-environment jsdom
 */

import { describe, test, expect } from 'vitest';
import { SyncService } from '../services/syncService.js';

class FakeStore {
  constructor() {
    this._data = new Map();
  }
  get(id) {
    return this._req(this._data.get(id));
  }
  put(item) {
    const key = item?.id ?? item?.blobKey ?? item?.key;
    this._data.set(key, item);
    return this._req(undefined);
  }
  delete(id) {
    this._data.delete(id);
    return this._req(undefined);
  }
  getAll() {
    return this._req([...this._data.values()]);
  }
  clear() {
    this._data.clear();
    return this._req(undefined);
  }
  _req(val) {
    return {
      result: val,
      get onsuccess() {
        return this._os;
      },
      set onsuccess(fn) {
        this._os = fn;
        if (fn) Promise.resolve().then(() => fn());
      },
      get onerror() {
        return this._oe;
      },
      set onerror(fn) {
        this._oe = fn;
      },
    };
  }
}

function makeFakeDb(storeData = {}) {
  const stores = {};
  const ensure = (name) => {
    if (!stores[name]) {
      stores[name] = new FakeStore();
      const seed = storeData[name] || [];
      for (const item of seed) {
        const key = item?.id ?? item?.blobKey ?? item?.key;
        stores[name]._data.set(key, item);
      }
    }
    return stores[name];
  };
  const known = Object.keys(storeData);
  for (const n of known) ensure(n);

  return {
    objectStoreNames: {
      contains: (name) => known.includes(name) || Boolean(stores[name]),
    },
    transaction(storeNames) {
      const names = Array.isArray(storeNames) ? storeNames : [storeNames];
      for (const n of names) ensure(n);
      return {
        objectStore: (name) => ensure(name),
      };
    },
    _stores: stores,
  };
}

function makeService(storeData) {
  const db = makeFakeDb(storeData);
  const svc = new SyncService('/api/v1');
  svc.init = async () => db;
  return { svc, db };
}

describe('SyncService.clearSessionStoresOnLogout (ADR-007)', () => {
  test('svuota syncQueue, sync_metadata e attachments_offline', async () => {
    const { svc, db } = makeService({
      syncQueue: [
        {
          id: 'q1',
          type: 'create_audit',
          payload: { audit_uuid: 'a1' },
          timestamp: Date.now(),
          retryCount: 0,
        },
      ],
      sync_metadata: [{ id: 'meta-a1', audit_id: 42 }],
      attachments_offline: [{ blobKey: 'blob-1', fileName: 'x.pdf' }],
    });

    expect(db._stores.syncQueue._data.size).toBe(1);
    expect(db._stores.sync_metadata._data.size).toBe(1);
    expect(db._stores.attachments_offline._data.size).toBe(1);

    await svc.clearSessionStoresOnLogout();

    expect(db._stores.syncQueue._data.size).toBe(0);
    expect(db._stores.sync_metadata._data.size).toBe(0);
    expect(db._stores.attachments_offline._data.size).toBe(0);
  });

  test('no-op se gli store sessione non esistono ancora', async () => {
    const { svc } = makeService({});
    await expect(svc.clearSessionStoresOnLogout()).resolves.toBeUndefined();
  });
});

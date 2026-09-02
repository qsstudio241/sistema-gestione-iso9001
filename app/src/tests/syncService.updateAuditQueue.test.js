/**
 * CONS-5 — update_audit in coda: si invia senza lock token;
 * clearQueueForServerAudits non cancella item mai partiti.
 */

import { describe, test, expect, vi, afterEach } from 'vitest';
import { SyncService } from '../services/syncService.js';
import { hasAuditLockToken } from '../services/apiService.js';

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
        return this;
    }
    _req(val) {
        return {
            result: val,
            _os: null,
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
    const makeStore = (name) => {
        const s = new FakeStore();
        if (storeData[name]) {
            for (const item of storeData[name]) s._data.set(item.id, item);
        }
        return s;
    };

    return {
        transaction(storeNames) {
            const tx = {};
            for (const n of storeNames) {
                if (!stores[n]) stores[n] = makeStore(n);
                tx.objectStore = (name) => stores[name] || makeStore(name);
            }
            return tx;
        },
    };
}

function makeService(initialQueue = []) {
    const db = makeFakeDb({ syncQueue: initialQueue });
    const svc = new SyncService('/api/v1');
    svc.init = async () => db;
    svc._db = db;
    svc.isOnline = true;
    svc.isSyncing = false;
    svc._globalRateLimitUntil = 0;
    return { svc, db };
}

function makeQueueItem(overrides = {}) {
    return {
        id: overrides.id ?? 'item-uuid-1',
        type: overrides.type ?? 'update_audit',
        payload: overrides.payload ?? {
            audit_uuid: 'uuid-header',
            auditObjective: 'Obiettivo locale',
            generalData: { conclusions: 'Conclusioni locali' },
        },
        timestamp: Date.now(),
        retryCount: overrides.retryCount ?? 0,
        lastError: overrides.lastError ?? null,
        isStalled: overrides.isStalled ?? false,
    };
}

describe('CONS-5 processQueue update_audit senza lock', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    test('invia update_audit anche se hasAuditLockToken è false', async () => {
        const item = makeQueueItem({ id: 'upd-1' });
        const { svc, db } = makeService([item]);
        const store = db.transaction(['syncQueue'], 'readwrite').objectStore('syncQueue');

        expect(hasAuditLockToken(item.payload.audit_uuid)).toBe(false);

        const syncSpy = vi.spyOn(svc, 'syncItem').mockResolvedValue({ ok: true });
        svc.removeFromQueue = async (id) => {
            store._data.delete(id);
        };

        await svc.processQueue();

        expect(syncSpy).toHaveBeenCalledTimes(1);
        expect(syncSpy.mock.calls[0][0].type).toBe('update_audit');
        expect(syncSpy.mock.calls[0][0].id).toBe('upd-1');
        expect(store._data.has('upd-1')).toBe(false);
    });

    test('non invia update_audit già stalled (max-retry / lock storico)', async () => {
        const stalled = makeQueueItem({
            id: 'upd-stalled',
            isStalled: true,
            lastError: 'AUDIT_LOCK_REQUIRED',
        });
        const { svc } = makeService([stalled]);

        const syncSpy = vi.spyOn(svc, 'syncItem').mockResolvedValue({ ok: true });

        await svc.processQueue();

        expect(syncSpy).not.toHaveBeenCalled();
    });
});

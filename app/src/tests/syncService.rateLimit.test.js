/**
 * Test L1 — gestione HTTP 429 nella sync queue (stress / rate limit server).
 */
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { SyncService } from '../services/syncService.js';

class FakeStore {
    constructor() {
        this._data = new Map();
    }
    add(item) {
        this._data.set(item.id, item);
        return this._req(item.id);
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
    return { svc, db };
}

function makeQueueItem(overrides = {}) {
    return {
        id: overrides.id ?? 'item-uuid-1',
        type: overrides.type ?? 'send_audit_event',
        payload: overrides.payload ?? { auditUuid: 'audit-1', event: { event_type: 'field_updated' } },
        timestamp: Date.now(),
        retryCount: overrides.retryCount ?? 0,
        lastError: overrides.lastError ?? null,
        isStalled: overrides.isStalled ?? false,
    };
}

describe('SyncService rate limit (429)', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-05-06T12:00:00.000Z'));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    test('429: non consuma retry, imposta pausa globale, emette sgq:syncRateLimited', async () => {
        const item = makeQueueItem({ id: 'q-429', retryCount: 0 });
        const { svc, db } = makeService([item]);
        const store = db.transaction(['syncQueue'], 'readwrite').objectStore('syncQueue');

        const syncSpy = vi.spyOn(svc, 'syncItem').mockRejectedValue({
            status: 429,
            code: 'RATE_LIMIT_API',
            data: { retryAfterMs: 8000 },
            message: 'Troppe richieste',
        });

        const rateEvents = [];
        const h = (e) => rateEvents.push(e.detail);
        window.addEventListener('sgq:syncRateLimited', h);

        await svc.processQueue();

        window.removeEventListener('sgq:syncRateLimited', h);

        const after = store._data.get('q-429');
        expect(after.retryCount).toBe(0);
        expect(syncSpy).toHaveBeenCalledTimes(1);
        expect(svc._globalRateLimitUntil).toBe(Date.now() + 8000);
        expect(rateEvents.length).toBe(1);
        expect(rateEvents[0].resumeAt).toBe(svc._globalRateLimitUntil);

        syncSpy.mockRestore();
        if (svc._rateLimitTimer) {
            clearTimeout(svc._rateLimitTimer);
            svc._rateLimitTimer = null;
        }
        svc._globalRateLimitUntil = 0;
    });

    test('429: secondo processQueue immediato non richiama syncItem (early exit)', async () => {
        const item = makeQueueItem({ id: 'q-429b' });
        const { svc } = makeService([item]);

        const syncSpy = vi.spyOn(svc, 'syncItem').mockRejectedValue({
            status: 429,
            code: 'RATE_LIMIT_API',
            data: { retryAfterMs: 60000 },
            message: 'Troppe richieste',
        });

        await svc.processQueue();
        expect(syncSpy).toHaveBeenCalledTimes(1);

        await svc.processQueue();
        expect(syncSpy).toHaveBeenCalledTimes(1);

        syncSpy.mockRestore();
        if (svc._rateLimitTimer) {
            clearTimeout(svc._rateLimitTimer);
            svc._rateLimitTimer = null;
        }
        svc._globalRateLimitUntil = 0;
    });
});

describe('SyncService enqueueOrReplace — deduplicazione update_audit', () => {
    test('primo enqueueOrReplace: crea nuovo item', async () => {
        const { svc, db } = makeService([]);
        svc.isOnline = false; // non triggerare processQueue

        const id = await svc.enqueueOrReplace('update_audit', 'uuid-audit-1', {
            audit_uuid: 'uuid-audit-1',
            audit_number: 'AU-001',
            client_name: 'Camellini',
        });

        const store = db.transaction(['syncQueue'], 'readonly').objectStore('syncQueue');
        const all = [...store._data.values()];
        expect(all).toHaveLength(1);
        expect(all[0].id).toBe(id);
        expect(all[0].payload.client_name).toBe('Camellini');
    });

    test('secondo enqueueOrReplace: sostituisce in-place (coda resta a 1 item)', async () => {
        const existing = makeQueueItem({
            id: 'item-upd-1',
            type: 'update_audit',
            payload: { audit_uuid: 'uuid-audit-1', audit_number: 'AU-001', client_name: 'Vecchio' },
        });
        const { svc, db } = makeService([existing]);
        svc.isOnline = false;

        const id = await svc.enqueueOrReplace('update_audit', 'uuid-audit-1', {
            audit_uuid: 'uuid-audit-1',
            audit_number: 'AU-001',
            client_name: 'Nuovo',
        });

        const store = db.transaction(['syncQueue'], 'readonly').objectStore('syncQueue');
        const all = [...store._data.values()];
        // deve restare 1 solo item (non aggiunto nuovo)
        expect(all).toHaveLength(1);
        // stesso id dell'item originale
        expect(id).toBe('item-upd-1');
        // payload aggiornato
        expect(all[0].payload.client_name).toBe('Nuovo');
    });

    test('item stalled non viene sostituito: crea nuovo item', async () => {
        const stalled = makeQueueItem({
            id: 'item-stalled',
            type: 'update_audit',
            payload: { audit_uuid: 'uuid-audit-1', audit_number: 'AU-001', client_name: 'Stalled' },
            isStalled: true,
        });
        const { svc, db } = makeService([stalled]);
        svc.isOnline = false;

        await svc.enqueueOrReplace('update_audit', 'uuid-audit-1', {
            audit_uuid: 'uuid-audit-1',
            audit_number: 'AU-001',
            client_name: 'Nuovo',
        });

        const store = db.transaction(['syncQueue'], 'readonly').objectStore('syncQueue');
        const all = [...store._data.values()];
        // lo stalled è rimasto + uno nuovo è stato aggiunto
        expect(all).toHaveLength(2);
        const newItem = all.find((i) => !i.isStalled);
        expect(newItem.payload.client_name).toBe('Nuovo');
    });

    test('N modifiche rapide allo stesso audit → 1 solo item in coda (simulazione click multipli)', async () => {
        const { svc, db } = makeService([]);
        svc.isOnline = false;

        // Simula 10 update_audit consecutivi (un click per domanda)
        for (let i = 1; i <= 10; i++) {
            await svc.enqueueOrReplace('update_audit', 'uuid-audit-1', {
                audit_uuid: 'uuid-audit-1',
                audit_number: 'AU-001',
                client_name: 'Camellini',
                non_conformities_count: i,
            });
        }

        const store = db.transaction(['syncQueue'], 'readonly').objectStore('syncQueue');
        const all = [...store._data.values()];
        expect(all).toHaveLength(1);
        expect(all[0].payload.non_conformities_count).toBe(10); // payload più recente
    });
});

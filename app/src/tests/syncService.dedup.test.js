/**
 * Test unitari per la deduplicazione della sync queue.
 *
 * Verifica che enqueue() con save_responses, save_custom_checklist_responses
 * e update_audit rimuova gli item precedenti per lo stesso auditId/audit_uuid,
 * tenendo solo l'ultimo (coalescenza anti-storm).
 */

import { SyncService } from '../services/syncService.js';

// ── FakeStore con supporto oncomplete per transaction ────────────────────────
function makeFakeTxDb(storeData = {}) {
    const stores = {};

    const getDataMap = (name) => {
        if (!stores[name]) {
            stores[name] = new Map();
            if (storeData[name]) {
                for (const item of storeData[name]) stores[name].set(item.id, item);
            }
        }
        return stores[name];
    };

    const makeRequest = (value) => ({
        result: value,
        get onsuccess() { return this._os; },
        set onsuccess(fn) {
            this._os = fn;
            if (fn) Promise.resolve().then(() => fn());
        },
        get onerror() { return this._oe; },
        set onerror(fn) { this._oe = fn; },
    });

    return {
        objectStoreNames: { contains: () => true },
        transaction(storeNames, _mode) {
            const storeMap = {};
            for (const n of (Array.isArray(storeNames) ? storeNames : [storeNames])) {
                const data = getDataMap(n);
                storeMap[n] = {
                    getAll()       { return makeRequest([...data.values()]); },
                    delete(id)     { data.delete(id); return makeRequest(undefined); },
                    add(item)      { data.set(item.id, item); return makeRequest(item.id); },
                    put(item)      { data.set(item.id, item); return makeRequest(undefined); },
                    get(id)        { return makeRequest(data.get(id)); },
                    count()        { return makeRequest(data.size); },
                    index(_name)   {
                        return {
                            get: (key) => makeRequest([...data.values()].find(v =>
                                Array.isArray(key) ? JSON.stringify([v.entityType, v.localId]) === JSON.stringify(key) : v.id === key
                            )),
                            getAll: () => makeRequest([...data.values()]),
                        };
                    },
                };
            }

            const tx = {
                objectStore: (name) => storeMap[name],
                oncomplete: null,
                onerror: null,
                error: null,
            };

            // Simula auto-commit: oncomplete scatta dopo 2 microtask
            // (dopo che req.onsuccess (1° microtask) ha già eseguito le delete)
            Promise.resolve()
                .then(() => Promise.resolve())
                .then(() => { if (tx.oncomplete) tx.oncomplete(); });

            return tx;
        },
        _stores: stores,
    };
}

function makeService(initialQueue = []) {
    const db = makeFakeTxDb({ syncQueue: initialQueue, sync_metadata: [] });
    const svc = new SyncService('/api/v1');
    svc.init = async () => db;
    svc.isOnline = false; // Evita processQueue durante il test
    return { svc, db };
}

function makeQueueItem(overrides = {}) {
    return {
        id: overrides.id ?? crypto.randomUUID(),
        type: overrides.type ?? 'save_responses',
        payload: overrides.payload ?? { auditId: 'uuid-audit-A' },
        timestamp: Date.now(),
        retryCount: overrides.retryCount ?? 0,
        lastError: overrides.lastError ?? null,
        isStalled: overrides.isStalled ?? false,
    };
}

const getQueueItems = (db) => [...db._stores.syncQueue?.values() ?? []];

// ── Test _deduplicateQueueItem ────────────────────────────────────────────────

describe('SyncService._deduplicateQueueItem', () => {
    test('rimuove item esistenti non-stalled dello stesso tipo e auditId', async () => {
        const old1 = makeQueueItem({ id: 'old-1', type: 'save_responses', payload: { auditId: 'uuid-A' } });
        const old2 = makeQueueItem({ id: 'old-2', type: 'save_responses', payload: { auditId: 'uuid-A' } });
        const other = makeQueueItem({ id: 'other', type: 'save_responses', payload: { auditId: 'uuid-B' } });
        const { svc, db } = makeService([old1, old2, other]);

        await svc._deduplicateQueueItem('save_responses', 'auditId', 'uuid-A');

        const remaining = getQueueItems(db).map(i => i.id);
        expect(remaining).not.toContain('old-1');
        expect(remaining).not.toContain('old-2');
        expect(remaining).toContain('other');
    });

    test('non rimuove item stalled per lo stesso tipo+auditId', async () => {
        const stalled = makeQueueItem({ id: 'stalled-1', isStalled: true, payload: { auditId: 'uuid-A' } });
        const { svc, db } = makeService([stalled]);

        await svc._deduplicateQueueItem('save_responses', 'auditId', 'uuid-A');

        expect(getQueueItems(db).map(i => i.id)).toContain('stalled-1');
    });

    test('non rimuove item di tipo diverso per lo stesso auditId', async () => {
        const event = makeQueueItem({ id: 'event-1', type: 'send_audit_event', payload: { auditId: 'uuid-A' } });
        const { svc, db } = makeService([event]);

        await svc._deduplicateQueueItem('save_responses', 'auditId', 'uuid-A');

        expect(getQueueItems(db).map(i => i.id)).toContain('event-1');
    });

    test('matching UUID case-insensitive', async () => {
        const old = makeQueueItem({ id: 'old-upper', payload: { auditId: 'ABCD-1234' } });
        const { svc, db } = makeService([old]);

        await svc._deduplicateQueueItem('save_responses', 'auditId', 'abcd-1234');

        expect(getQueueItems(db).map(i => i.id)).not.toContain('old-upper');
    });
});

// ── Test enqueue con deduplicazione ──────────────────────────────────────────

describe('SyncService.enqueue — deduplicazione', () => {
    test('save_responses: mantiene solo il più recente per lo stesso auditId', async () => {
        const old1 = makeQueueItem({ id: 'sr-old-1', type: 'save_responses', payload: { auditId: 'UUID-X', responses: [{ q: 1 }] } });
        const old2 = makeQueueItem({ id: 'sr-old-2', type: 'save_responses', payload: { auditId: 'UUID-X', responses: [{ q: 1 }, { q: 2 }] } });
        const { svc, db } = makeService([old1, old2]);

        await svc.enqueue('save_responses', { auditId: 'UUID-X', responses: [{ q: 1 }, { q: 2 }, { q: 3 }] });

        const items = getQueueItems(db).filter(i => i.type === 'save_responses' && i.payload?.auditId === 'UUID-X');
        expect(items).toHaveLength(1);
        expect(items[0].payload.responses).toHaveLength(3);
    });

    test('save_responses: non tocca item di altri audit', async () => {
        const otherAudit = makeQueueItem({ id: 'sr-other', type: 'save_responses', payload: { auditId: 'UUID-Y', responses: [] } });
        const { svc, db } = makeService([otherAudit]);

        await svc.enqueue('save_responses', { auditId: 'UUID-X', responses: [{ q: 1 }] });

        expect(getQueueItems(db).map(i => i.id)).toContain('sr-other');
    });

    test('update_audit: rimuove versioni precedenti per lo stesso audit_uuid', async () => {
        const old = makeQueueItem({
            id: 'ua-old',
            type: 'update_audit',
            payload: { audit_uuid: 'uuid-Z', audit_number: '2026-01', client_name: 'Test' },
        });
        const { svc, db } = makeService([old]);

        await svc.enqueue('update_audit', { audit_uuid: 'uuid-Z', audit_number: '2026-01', client_name: 'Test Updated' });

        const items = getQueueItems(db).filter(i => i.type === 'update_audit' && i.payload?.audit_uuid === 'uuid-Z');
        expect(items).toHaveLength(1);
        expect(items[0].payload.client_name).toBe('Test Updated');
    });

    test('save_custom_checklist_responses: deduplica per auditId', async () => {
        const old = makeQueueItem({ id: 'scr-old', type: 'save_custom_checklist_responses', payload: { auditId: 'uuid-C', responses: [] } });
        const { svc, db } = makeService([old]);

        await svc.enqueue('save_custom_checklist_responses', { auditId: 'uuid-C', responses: [{ id: 1 }] });

        const items = getQueueItems(db).filter(i => i.type === 'save_custom_checklist_responses');
        expect(items).toHaveLength(1);
        expect(items[0].payload.responses).toHaveLength(1);
    });

    test('send_audit_event: NON deduplica (ogni evento è atomico)', async () => {
        const ev1 = makeQueueItem({ id: 'ev-1', type: 'send_audit_event', payload: { auditUuid: 'uuid-E', event: { type: 'response_set' } } });
        const ev2 = makeQueueItem({ id: 'ev-2', type: 'send_audit_event', payload: { auditUuid: 'uuid-E', event: { type: 'response_set' } } });
        const { svc, db } = makeService([ev1, ev2]);

        await svc.enqueue('send_audit_event', { auditUuid: 'uuid-E', event: { type: 'response_set' } });

        const items = getQueueItems(db).filter(i => i.type === 'send_audit_event');
        // Tutti e 3 devono essere presenti (ev1, ev2, nuovo)
        expect(items).toHaveLength(3);
    });

    test('create_audit: NON deduplica', async () => {
        const old = makeQueueItem({
            id: 'ca-old',
            type: 'create_audit',
            payload: { audit_uuid: 'uuid-W', audit_number: '2026-01', client_name: 'Test' },
        });
        const { svc, db } = makeService([old]);

        await svc.enqueue('create_audit', { audit_uuid: 'uuid-W', audit_number: '2026-01', client_name: 'Test' });

        const items = getQueueItems(db).filter(i => i.type === 'create_audit');
        expect(items).toHaveLength(2);
    });
});

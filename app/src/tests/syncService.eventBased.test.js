/**
 * Test L1 — T3: percorso event-based per save_responses.
 *
 * Verifica:
 *  - generateResponseEventKey produce chiavi diverse per input diversi
 *  - stessa coppia (auditUuid, questionId) entro 1 minuto → stessa chiave
 *  - enqueueResponseEvent con status non null → event_type 'response_set'
 *  - enqueueResponseEvent con status null    → event_type 'response_cleared'
 *  - new_value ha il formato JSON corretto
 *  - il tipo accodato è 'send_audit_event'
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SyncService } from '../services/syncService.js';

// ── Minimal mocks ────────────────────────────────────────────────────────────

// Mock apiService (non chiamato in questi test, solo importato da syncService)
vi.mock('../services/apiService.js', () => ({
    default: { baseUrl: '/api/v1', post: vi.fn() },
    hasAuditLockToken: vi.fn(() => false),
}));

// FakeStore leggera (usata da enqueue → init() → getDatabase override)
class FakeStore {
    constructor() { this._data = new Map(); }
    get(id)    { return this._fakeReq(this._data.get(id)); }
    put(item)  { this._data.set(item.id, item); return this._fakeReq(); }
    delete(id) { this._data.delete(id); return this._fakeReq(); }
    getAll()   { return this._fakeReq([...this._data.values()]); }
    add(item)  { this._data.set(item.id, item); return this._fakeReq(item.id); }
    count()    { return this._fakeReq(this._data.size); }
    index()    { return { get: () => this._fakeReq(undefined) }; }
    _fakeReq(val) {
        const r = { result: val };
        // Trigger onsuccess asynchronously
        Object.defineProperty(r, 'onsuccess', {
            set(fn) { if (fn) Promise.resolve().then(() => fn()); },
            get() { return undefined; },
        });
        Object.defineProperty(r, 'onerror', {
            set() {},
            get() { return undefined; },
        });
        return r;
    }
}

function makeFakeDb() {
    const store = new FakeStore();
    return {
        objectStoreNames: { contains: () => false },
        transaction: (_names, _mode) => ({
            objectStore: (_name) => store,
        }),
        _store: store,
    };
}

// ─────────────────────────────────────────────────────────────────────────────

describe('SyncService — T3 event-based', () => {
    let service;

    beforeEach(() => {
        service = new SyncService('/api/v1');
        // Inietta fake DB in modo che init() non chiami IndexedDB reale
        const db = makeFakeDb();
        service.init = async () => db;
        // Blocca processQueue (non vogliamo che processi in questi test unitari)
        vi.spyOn(service, 'processQueue').mockResolvedValue();
    });

    // ── generateResponseEventKey ─────────────────────────────────────────────

    describe('generateResponseEventKey', () => {
        it('produce chiavi diverse per auditUuid diversi', () => {
            const k1 = service.generateResponseEventKey('uuid-A', 42);
            const k2 = service.generateResponseEventKey('uuid-B', 42);
            expect(k1).not.toBe(k2);
        });

        it('produce chiavi diverse per questionId diversi', () => {
            const k1 = service.generateResponseEventKey('uuid-X', 1);
            const k2 = service.generateResponseEventKey('uuid-X', 2);
            expect(k1).not.toBe(k2);
        });

        it('stessa coppia entro lo stesso minuto → stessa chiave', () => {
            // Fissa il tempo a metà minuto per evitare instabilità al confine del minuto
            const fixedTs = Math.floor(Date.now() / 60000) * 60000 + 30000;
            vi.setSystemTime(fixedTs);
            const k1 = service.generateResponseEventKey('uuid-Y', 99);
            const k2 = service.generateResponseEventKey('uuid-Y', 99);
            vi.useRealTimers();
            expect(k1).toBe(k2);
        });

        it('produce una stringa di 36 caratteri', () => {
            const k = service.generateResponseEventKey('uuid-Z', 10);
            expect(typeof k).toBe('string');
            expect(k).toHaveLength(36);
        });
    });

    // ── enqueueResponseEvent ─────────────────────────────────────────────────

    describe('enqueueResponseEvent', () => {
        it('con status "C" → event_type response_set, tipo send_audit_event', async () => {
            const enqueueSpy = vi.spyOn(service, 'enqueue');
            await service.enqueueResponseEvent('audit-uuid-1', 10, 'C', 'nota test');

            expect(enqueueSpy).toHaveBeenCalledWith(
                'send_audit_event',
                expect.objectContaining({
                    auditUuid: 'audit-uuid-1',
                    event: expect.objectContaining({
                        event_type: 'response_set',
                        field_path: 'responses.10',
                    }),
                }),
            );
        });

        it('new_value contiene conformity_status e notes serializzati', async () => {
            const enqueueSpy = vi.spyOn(service, 'enqueue');
            await service.enqueueResponseEvent('audit-uuid-2', 20, 'NC', 'evidenza NC');

            const { event } = enqueueSpy.mock.calls[0][1];
            const parsed = JSON.parse(event.new_value);
            expect(parsed).toEqual({ conformity_status: 'NC', notes: 'evidenza NC' });
        });

        it('con status null → event_type response_cleared, new_value null', async () => {
            const enqueueSpy = vi.spyOn(service, 'enqueue');
            await service.enqueueResponseEvent('audit-uuid-3', 30, null);

            const { event } = enqueueSpy.mock.calls[0][1];
            expect(event.event_type).toBe('response_cleared');
            expect(event.new_value).toBeNull();
        });

        it('event ha idempotency_key, client_ts, device_type', async () => {
            const enqueueSpy = vi.spyOn(service, 'enqueue');
            await service.enqueueResponseEvent('audit-uuid-4', 5, 'OSS');

            const { event } = enqueueSpy.mock.calls[0][1];
            expect(event.idempotency_key).toBeTruthy();
            expect(event.client_ts).toBeTruthy();
            expect(event.device_type).toBe('desktop');
        });

        it('coppie diverse → idempotency_key diverse', async () => {
            const enqueueSpy = vi.spyOn(service, 'enqueue');
            await service.enqueueResponseEvent('uuid-A', 1, 'C');
            await service.enqueueResponseEvent('uuid-B', 1, 'C');
            const key1 = enqueueSpy.mock.calls[0][1].event.idempotency_key;
            const key2 = enqueueSpy.mock.calls[1][1].event.idempotency_key;
            expect(key1).not.toBe(key2);
        });
    });
});

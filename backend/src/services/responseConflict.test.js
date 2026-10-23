const { decideResponseProjection } = require('./responseConflict');

describe('decideResponseProjection', () => {
    const existing = {
        question_id: 12,
        conformity_status: 'NC',
        notes: 'dal pc',
        updated_at: '2026-10-23T10:05:00.000Z',
    };

    test('prima risposta: si scrive', () => {
        const decision = decideResponseProjection({
            incomingClientTs: '2026-10-23T10:00:00.000Z',
            incomingStatus: 'C',
            incomingNotes: '',
            existing: null,
        });
        expect(decision.apply).toBe(true);
        expect(decision.conflict).toBeNull();
    });

    test('stesso contenuto: ritento, non è conflitto', () => {
        const decision = decideResponseProjection({
            incomingClientTs: '2026-10-23T09:00:00.000Z',
            incomingStatus: 'NC',
            incomingNotes: 'dal pc',
            existing,
        });
        expect(decision.apply).toBe(true);
        expect(decision.idempotent).toBe(true);
    });

    test('modifica più vecchia e diversa: non sovrascrive e segnala', () => {
        const decision = decideResponseProjection({
            incomingClientTs: '2026-10-23T10:00:00.000Z',
            incomingStatus: 'C',
            incomingNotes: 'dal telefono',
            incomingDeviceId: 'phone-1',
            existing,
        });
        expect(decision.apply).toBe(false);
        expect(decision.conflict.reason).toBe('server_newer');
        expect(decision.conflict.question_id).toBe(12);
        expect(decision.conflict.server.conformity_status).toBe('NC');
        expect(decision.conflict.client.conformity_status).toBe('C');
        expect(decision.conflict.client.device_id).toBe('phone-1');
    });

    test('modifica più recente: vince e sostituisce', () => {
        const decision = decideResponseProjection({
            incomingClientTs: '2026-10-23T10:06:00.000Z',
            incomingStatus: 'C',
            incomingNotes: 'dal telefono dopo',
            existing,
        });
        expect(decision.apply).toBe(true);
        expect(decision.conflict).toBeNull();
    });
});

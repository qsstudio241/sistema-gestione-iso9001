/**
 * @jest-environment node
 */
const {
    extractActionLinesFromDescription,
    materializeNcActionsFromDescription,
} = require('./ncDescriptionActions.service');

describe('ncDescriptionActions.service', () => {
    describe('extractActionLinesFromDescription', () => {
        it('estrae OM singolo da descrizione audit', () => {
            const desc = `OSSERVAZIONE: testo lungo...
OM: Valutare potenziali rischi associati a rete idrica e depuratore`;
            const lines = extractActionLinesFromDescription(desc);
            expect(lines).toHaveLength(1);
            expect(lines[0].label).toBe('OM');
            expect(lines[0].description).toMatch(/rete idrica/);
        });

        it('estrae OM1 OM2 OM3 multipli', () => {
            const desc = `OSS1: problema appello
OM1: simulare differenti eventi
OM2: Pianificare emergenza sversamenti
OM3: Migliorare identificazione zone`;
            const lines = extractActionLinesFromDescription(desc);
            expect(lines).toHaveLength(3);
            expect(lines.map((l) => l.label)).toEqual(['OM1', 'OM2', 'OM3']);
        });

        it('ignora duplicati identici', () => {
            const desc = 'OM: stessa azione\nOM: stessa azione';
            expect(extractActionLinesFromDescription(desc)).toHaveLength(1);
        });

        it('ritorna array vuoto se nessun pattern OM/NC', () => {
            expect(extractActionLinesFromDescription('Solo testo descrittivo')).toEqual([]);
            expect(extractActionLinesFromDescription('')).toEqual([]);
        });
    });

    describe('materializeNcActionsFromDescription', () => {
        it('non inserisce se nc_actions già popolata', async () => {
            const queryFn = jest.fn()
                .mockResolvedValueOnce({ recordset: [{ cnt: 2 }] });
            const created = await materializeNcActionsFromDescription(queryFn, {
                ncId: 1036,
                description: 'OM: azione test',
            });
            expect(created).toBe(0);
            expect(queryFn).toHaveBeenCalledTimes(1);
        });

        it('inserisce righe OM se tabella vuota', async () => {
            const queryFn = jest.fn()
                .mockResolvedValueOnce({ recordset: [{ cnt: 0 }] })
                .mockResolvedValue({ recordset: [] });
            const created = await materializeNcActionsFromDescription(queryFn, {
                ncId: 1036,
                description: 'OM1: prima\nOM2: seconda',
                createdBy: 1005,
            });
            expect(created).toBe(2);
            expect(queryFn).toHaveBeenCalledTimes(3);
            expect(queryFn.mock.calls[1][1]).toMatchObject({
                nc_id: 1036,
                description: 'prima',
                created_by: 1005,
            });
        });
    });
});

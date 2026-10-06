'use strict';

jest.mock('../../../config/database', () => ({
    query: jest.fn(),
    getPool: jest.fn(),
}));

const adapter = require('./cnd9712.adapter');
const gate = require('../../ndtInspectorGate.service');
const { MATCH_STATUS, publicDomainMeta } = require('../coverageTypes');
const { VISION_FITNESS_TYPE } = require('../../../constants/occupationalQualificationTypes');

const { matchCndCapability } = adapter;
const TODAY = '2026-10-05';

const baseQual = {
    id: 1,
    person_name: 'Bianchi Luca',
    personnel_id: 7,
    qualification_type: 'ISO 9712',
    status: 'attiva',
    expiry_date: '2028-01-01',
    ndt_method: 'UT',
    ndt_level: 2,
    ndt_sector: 'w',
    certification_scheme: 'CICPND',
    scope_detail: 'PA, TOFD',
    certificate_number: 'CND-001',
    company_id: 10,
};

const visionOk = {
    id: 90,
    person_name: 'Bianchi Luca',
    personnel_id: 7,
    qualification_type: VISION_FITNESS_TYPE,
    status: 'attiva',
    expiry_date: '2027-06-30',
    company_id: 10,
};

function run(qualOverrides, criteria, visionRows = [visionOk]) {
    return matchCndCapability({ ...baseQual, ...qualOverrides }, criteria, {
        todayIso: TODAY,
        visionRows,
    });
}

const fullCriteria = {
    ndt_method: 'UT',
    ndt_level: 2,
    ndt_sector: 'w',
    certification_scheme: 'cicpnd',
    scope_detail: 'tofd',
};

describe('cnd_9712 adapter (COV-3)', () => {
    it('metadati: maturita full, campi COV-1 invariati + settore/schema/tecnica', () => {
        const meta = publicDomainMeta(adapter);
        expect(meta.implemented).toBe(true);
        expect(meta.maturity).toBe('full');
        const keys = meta.requirementFields.map((f) => f.key);
        expect(keys).toEqual(['ndt_method', 'ndt_level', 'ndt_sector', 'certification_scheme', 'scope_detail']);
        expect(meta.requirementFields[0].required).toBe(true);
    });

    it('riusa visionStateForPerson del gate (nessuna copia)', () => {
        expect(typeof gate.visionStateForPerson).toBe('function');
    });

    it('match pieno: metodo, livello, settore, schema, tecnica e visione ok', () => {
        const m = run({}, fullCriteria);
        expect(m.status).toBe(MATCH_STATUS.MATCH);
        expect(m.detail).toMatchObject({
            operational: 'ok',
            ndt_method: 'ok',
            ndt_level: 'ok',
            ndt_sector: 'ok',
            certification_scheme: 'ok',
            scope_detail: 'ok',
            vision: 'ok',
        });
        expect(m.capability).toMatchObject({
            ndt_sector: 'w',
            certification_scheme: 'CICPND',
            scope_detail: 'PA, TOFD',
            certificate_number: 'CND-001',
            vision_state: 'ok',
            vision_expiry_date: '2027-06-30',
        });
        expect(m.reasons).toEqual([]);
    });

    it('no_match con visione mancante', () => {
        const m = run({}, { ndt_method: 'UT' }, []);
        expect(m.status).toBe(MATCH_STATUS.NO_MATCH);
        expect(m.detail.vision).toBe('mismatch');
        expect(m.capability.vision_state).toBe('missing');
        expect(m.reasons.join(' ')).toMatch(/Idoneit\u00e0 visiva assente/);
    });

    it('no_match con visione scaduta', () => {
        const m = run({}, { ndt_method: 'UT' }, [{ ...visionOk, expiry_date: '2026-01-01' }]);
        expect(m.status).toBe(MATCH_STATUS.NO_MATCH);
        expect(m.detail.vision).toBe('mismatch');
        expect(m.capability.vision_state).toBe('expired');
        expect(m.reasons.join(' ')).toMatch(/scaduta il 2026-01-01/);
    });

    it('visione di un\'altra persona non vale (match per personnel_id)', () => {
        const m = run({}, { ndt_method: 'UT' }, [{ ...visionOk, personnel_id: 99, person_name: 'Altro Nome' }]);
        expect(m.status).toBe(MATCH_STATUS.NO_MATCH);
        expect(m.capability.vision_state).toBe('missing');
    });

    it('visione abbinata per nome normalizzato senza personnel_id', () => {
        const m = run(
            { personnel_id: null, person_name: '  bianchi   LUCA ' },
            { ndt_method: 'UT' },
            [{ ...visionOk, personnel_id: null }],
        );
        expect(m.status).toBe(MATCH_STATUS.MATCH);
    });

    it('certificato visivo senza scadenza: match con vision_note', () => {
        const m = run({}, { ndt_method: 'UT' }, [{ ...visionOk, expiry_date: null }]);
        expect(m.status).toBe(MATCH_STATUS.MATCH);
        expect(m.detail.vision).toBe('ok');
        expect(m.detail.vision_note).toBe('senza_scadenza');
        expect(m.capability.vision_expiry_date).toBeNull();
    });

    it('senza visionRows la visione non e valutata (skipped, contratto COV-1)', () => {
        const m = matchCndCapability({ ...baseQual }, { ndt_method: 'UT', ndt_level: 2 }, { todayIso: TODAY });
        expect(m.status).toBe(MATCH_STATUS.MATCH);
        expect(m.detail.vision).toBe('skipped');
        expect(m.capability.vision_state).toBeNull();
    });

    describe('settore', () => {
        it('requisito vuoto = skipped', () => {
            const m = run({ ndt_sector: null }, { ndt_method: 'UT' });
            expect(m.detail.ndt_sector).toBe('skipped');
            expect(m.status).toBe(MATCH_STATUS.MATCH);
        });

        it('prodotto diverso = no_match', () => {
            const m = run({ ndt_sector: 'c' }, { ndt_method: 'UT', ndt_sector: 'w' });
            expect(m.status).toBe(MATCH_STATUS.NO_MATCH);
            expect(m.detail.ndt_sector).toBe('mismatch');
        });

        it('requisito industriale con qualifica di solo prodotto = no_match', () => {
            const m = run({ ndt_sector: 'w' }, { ndt_method: 'UT', ndt_sector: 's' });
            expect(m.status).toBe(MATCH_STATUS.NO_MATCH);
            expect(m.detail.ndt_sector).toBe('mismatch');
        });

        it('industriale diverso = no_match (r vs s)', () => {
            const m = run({ ndt_sector: 's' }, { ndt_method: 'UT', ndt_sector: 'r' });
            expect(m.status).toBe(MATCH_STATUS.NO_MATCH);
        });

        it('requisito m con qualifica s = match (A.3: s include la fabbricazione)', () => {
            const m = run({ ndt_sector: 's' }, { ndt_method: 'UT', ndt_sector: 'm' });
            expect(m.status).toBe(MATCH_STATUS.MATCH);
            expect(m.detail.ndt_sector).toBe('ok');
        });

        it('requisito s con qualifica m = no_match (non reciproco)', () => {
            const m = run({ ndt_sector: 'm' }, { ndt_method: 'UT', ndt_sector: 's' });
            expect(m.status).toBe(MATCH_STATUS.NO_MATCH);
        });

        it.each(['s', 'm'])('requisito w con qualifica industriale %s = partial', (sector) => {
            const m = run({ ndt_sector: sector }, { ndt_method: 'UT', ndt_sector: 'w' });
            expect(m.status).toBe(MATCH_STATUS.PARTIAL);
            expect(m.detail.ndt_sector).toBe('unverifiable');
            expect(m.reasons.join(' ')).toMatch(/scope definito dall'ente/);
        });

        it('settore assente in anagrafica = partial', () => {
            const m = run({ ndt_sector: null }, { ndt_method: 'UT', ndt_sector: 'w' });
            expect(m.status).toBe(MATCH_STATUS.PARTIAL);
            expect(m.reasons.join(' ')).toMatch(/Settore assente/);
        });

        it('testo non riconosciuto in anagrafica = partial (mai mismatch inventato)', () => {
            const m = run({ ndt_sector: 'saldature e fabbricati' }, { ndt_method: 'UT', ndt_sector: 'w' });
            expect(m.status).toBe(MATCH_STATUS.PARTIAL);
        });

        it('qualifica plurisettoriale con il settore richiesto = match', () => {
            const m = run({ ndt_sector: 'w, t' }, { ndt_method: 'UT', ndt_sector: 't' });
            expect(m.status).toBe(MATCH_STATUS.MATCH);
        });
    });

    describe('schema di certificazione', () => {
        it('uguale (case-insensitive) = ok', () => {
            const m = run({ certification_scheme: ' TEC  Eurolab ' }, { ndt_method: 'UT', certification_scheme: 'tec eurolab' });
            expect(m.detail.certification_scheme).toBe('ok');
            expect(m.status).toBe(MATCH_STATUS.MATCH);
        });

        it('diverso = partial, mai no_match', () => {
            const m = run({ certification_scheme: 'PCN' }, { ndt_method: 'UT', certification_scheme: 'CICPND' });
            expect(m.status).toBe(MATCH_STATUS.PARTIAL);
            expect(m.detail.certification_scheme).toBe('unverifiable');
            expect(m.reasons.join(' ')).toMatch(/schema diverso/i);
            expect(m.reasons.join(' ')).toMatch(/9\.4/);
        });

        it('assente in anagrafica = partial', () => {
            const m = run({ certification_scheme: null }, { ndt_method: 'UT', certification_scheme: 'CICPND' });
            expect(m.status).toBe(MATCH_STATUS.PARTIAL);
        });
    });

    describe('tecnica', () => {
        it('token case-insensitive su , ; / e spazi = ok', () => {
            const m = run({ scope_detail: 'PA; TOFD / DR' }, { ndt_method: 'UT', scope_detail: 'dr tofd' });
            expect(m.detail.scope_detail).toBe('ok');
            expect(m.status).toBe(MATCH_STATUS.MATCH);
        });

        it('nessuna intersezione = partial, mai no_match', () => {
            const m = run({ scope_detail: 'PA' }, { ndt_method: 'UT', scope_detail: 'TOFD' });
            expect(m.status).toBe(MATCH_STATUS.PARTIAL);
            expect(m.detail.scope_detail).toBe('unverifiable');
        });

        it('copertura solo parziale delle tecniche richieste = partial', () => {
            const m = run({ scope_detail: 'PA' }, { ndt_method: 'UT', scope_detail: 'PA TOFD' });
            expect(m.status).toBe(MATCH_STATUS.PARTIAL);
            expect(m.reasons.join(' ')).toMatch(/TOFD/i);
        });

        it('scope_detail assente in anagrafica = partial', () => {
            const m = run({ scope_detail: null }, { ndt_method: 'UT', scope_detail: 'PA' });
            expect(m.status).toBe(MATCH_STATUS.PARTIAL);
        });
    });

    describe('aggregazione', () => {
        it('un mismatch prevale su un unverifiable', () => {
            const m = run(
                { certification_scheme: 'PCN', ndt_sector: 'c' },
                { ndt_method: 'UT', certification_scheme: 'CICPND', ndt_sector: 'w' },
            );
            expect(m.status).toBe(MATCH_STATUS.NO_MATCH);
        });

        it('qualifica scaduta = no_match senza valutare le altre dimensioni', () => {
            const m = run({ expiry_date: '2020-01-01' }, fullCriteria);
            expect(m.status).toBe(MATCH_STATUS.NO_MATCH);
            expect(m.detail).toEqual({ operational: 'mismatch' });
        });

        it('livello inferiore = no_match (COV-1 invariato)', () => {
            const m = run({ ndt_level: 1 }, { ndt_method: 'UT', ndt_level: 2 });
            expect(m.status).toBe(MATCH_STATUS.NO_MATCH);
        });

        it('metodo richiesto assente = partial (COV-1 invariato)', () => {
            const m = run({}, {});
            expect(m.status).toBe(MATCH_STATUS.PARTIAL);
        });
    });

    describe('match() con DB mockato', () => {
        function makePool({ quals, visions }) {
            const calls = [];
            const pool = {
                calls,
                request() {
                    const inputs = {};
                    const req = {
                        input(name, value) {
                            inputs[name] = value;
                            return req;
                        },
                        async query(sql) {
                            calls.push({ sql, inputs: { ...inputs } });
                            return { recordset: /FROM qualifications q\s+LEFT JOIN/.test(sql) ? quals : visions };
                        },
                    };
                    return req;
                },
            };
            return pool;
        }

        const ctx = (pool) => ({ organizationId: 5, pool, todayIso: TODAY });

        it('nessuna qualifica NDT: lista vuota senza seconda query e emptyMessage definito', async () => {
            const pool = makePool({ quals: [], visions: [] });
            const res = await adapter.match({ domain: 'cnd_9712', criteria: { ndt_method: 'UT' } }, ctx(pool));
            expect(res).toEqual([]);
            expect(pool.calls).toHaveLength(1);
            expect(adapter.emptyMessage).toMatch(/Nessuna qualifica NDT/);
        });

        it('il certificato visivo non compare tra le capacita', async () => {
            const pool = makePool({
                quals: [
                    baseQual,
                    { ...baseQual, id: 2, qualification_type: VISION_FITNESS_TYPE, ndt_method: null },
                ],
                visions: [visionOk],
            });
            const res = await adapter.match({ domain: 'cnd_9712', criteria: { ndt_method: 'UT' } }, ctx(pool));
            expect(res.map((m) => m.capability_id)).toEqual([1]);
        });

        it('ordina match -> partial -> no_match (stabile)', async () => {
            const pool = makePool({
                quals: [
                    { ...baseQual, id: 1, person_name: 'A', personnel_id: 7, ndt_method: 'MT' },
                    { ...baseQual, id: 2, person_name: 'B', personnel_id: 8, scope_detail: null },
                    { ...baseQual, id: 3, person_name: 'C', personnel_id: 9 },
                    { ...baseQual, id: 4, person_name: 'D', personnel_id: 10, certification_scheme: 'PCN' },
                ],
                visions: [
                    { ...visionOk, personnel_id: 7, person_name: 'A' },
                    { ...visionOk, personnel_id: 8, person_name: 'B' },
                    { ...visionOk, personnel_id: 9, person_name: 'C' },
                    { ...visionOk, personnel_id: 10, person_name: 'D' },
                ],
            });
            const res = await adapter.match({
                domain: 'cnd_9712',
                criteria: { ndt_method: 'UT', certification_scheme: 'CICPND', scope_detail: 'PA' },
            }, ctx(pool));
            expect(res.map((m) => [m.capability_id, m.status])).toEqual([
                [3, MATCH_STATUS.MATCH],
                [2, MATCH_STATUS.PARTIAL],
                [4, MATCH_STATUS.PARTIAL],
                [1, MATCH_STATUS.NO_MATCH],
            ]);
        });

        it('scope azienda applicato anche alla query visione e SQL con elenco tipi visivi', async () => {
            const pool = makePool({ quals: [baseQual], visions: [visionOk] });
            await adapter.match({ domain: 'cnd_9712', company_id: 10, criteria: { ndt_method: 'UT' } }, ctx(pool));
            expect(pool.calls).toHaveLength(2);
            expect(pool.calls[0].inputs).toMatchObject({ orgId: 5, compId: 10 });
            expect(pool.calls[1].inputs).toMatchObject({ orgId: 5, compId: 10 });
            expect(pool.calls[1].sql).toContain('q.company_id = @compId');
            expect(pool.calls[1].sql).toContain(VISION_FITNESS_TYPE);
        });

        it('pool assente: errore esplicito', async () => {
            await expect(adapter.match({ domain: 'cnd_9712', criteria: {} }, { organizationId: 1 }))
                .rejects.toThrow(/pool SQL richiesto/);
        });
    });
});

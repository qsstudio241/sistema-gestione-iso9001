/**
 * @jest-environment node
 *
 * Test L1 — getWPQRStats (DEPUTYTASK4, 10/08/2026 — regola "Filtri: singola
 * fonte di verità", quarta applicazione dopo Qualifiche/Scadenzari/NC, v.
 * sgq-operating-memory.mdc § Filtri).
 *
 * Bug trovato nell'analisi: il bucket "scadute" contava QUALSIASI WPQR con
 * expiry_date passata, indipendentemente da approval_status — a differenza
 * di valide/in_scadenza_30/in_scadenza_60 che richiedono approval_status =
 * 'approvata'. Un WPQR 'bozza' o 'rifiutata' con expiry_date nel passato
 * finiva conteggiato nella card "Scadute" (rosso) mentre a riga il semaforo
 * (SemaforoDot) lo mostra grigio "Non approvata" — card e riga in
 * contraddizione, stesso pattern di bug già corretto in deadlines.controller
 * (tarature scadute con status 'expired' invece di active+days<0).
 *
 * Aggiunti anche i bucket "rifiutate" e "approvate", prima assenti dalle
 * stats: "rifiutata" era un valore raggiungibile dalla tendina
 * approval_status ma invisibile in ogni card (stesso gap di "Sospesa"/
 * "Revocata" in Qualifiche prima del fix PR #368).
 */

jest.mock('../config/database', () => ({ query: jest.fn() }));
jest.mock('../utils/logger', () => ({ info: jest.fn(), error: jest.fn(), warn: jest.fn() }));

const { query } = require('../config/database');
const { getWPQRStats } = require('./welding.controller');

function createRes() {
    const res = { statusCode: 200, body: null };
    res.status = jest.fn(function status(code) { this.statusCode = code; return this; });
    res.json = jest.fn(function json(payload) { this.body = payload; return this; });
    return res;
}

describe('getWPQRStats — coerenza bucket "scadute" con approval_status e nuovi bucket', () => {
    afterEach(() => jest.clearAllMocks());

    it('la query SQL richiede approval_status = \'approvata\' anche per il bucket "scadute" (coerenza con SemaforoDot)', async () => {
        query.mockResolvedValueOnce({ recordset: [{ totale: 0, da_approvare: 0, rifiutate: 0, approvate: 0, valide: 0, in_scadenza_30: 0, in_scadenza_60: 0, scadute: 0 }] });

        const req = { user: { organization_id: 1001 }, query: {} };
        const res = createRes();
        await getWPQRStats(req, res);

        expect(res.statusCode).toBe(200);
        const [sql] = query.mock.calls[0];
        // Isola il blocco "AS scadute" e verifica che includa il filtro approval_status.
        const scaduteBlock = sql.slice(sql.lastIndexOf('SUM(CASE WHEN', sql.indexOf('AS scadute')), sql.indexOf('AS scadute'));
        expect(scaduteBlock).toMatch(/approval_status = 'approvata'/);
    });

    it('include i bucket "rifiutate" e "approvate" nella query (prima assenti)', async () => {
        query.mockResolvedValueOnce({ recordset: [{}] });

        const req = { user: { organization_id: 1001 }, query: {} };
        const res = createRes();
        await getWPQRStats(req, res);

        const [sql] = query.mock.calls[0];
        expect(sql).toMatch(/approval_status = 'rifiutata'\s+THEN 1 ELSE 0 END\) AS rifiutate/);
        expect(sql).toMatch(/approval_status = 'approvata'\s+THEN 1 ELSE 0 END\) AS approvate/);
    });

    it('restituisce i dati aggregati dal DB così come sono (nessuna trasformazione aggiuntiva)', async () => {
        const row = { totale: 10, da_approvare: 2, rifiutate: 1, approvate: 7, valide: 5, in_scadenza_30: 1, in_scadenza_60: 1, scadute: 0 };
        query.mockResolvedValueOnce({ recordset: [row] });

        const req = { user: { organization_id: 1001 }, query: {} };
        const res = createRes();
        await getWPQRStats(req, res);

        expect(res.body).toEqual({ success: true, data: row });
    });

    it('applica il filtro company_id quando presente in query', async () => {
        query.mockResolvedValueOnce({ recordset: [{}] });

        const req = { user: { organization_id: 1001 }, query: { company_id: '5' } };
        const res = createRes();
        await getWPQRStats(req, res);

        const [sql, params] = query.mock.calls[0];
        expect(sql).toMatch(/company_id/);
        expect(params.company_id).toBe(5);
    });
});

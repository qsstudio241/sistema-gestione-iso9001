/**
 * @jest-environment node
 */
const helpers = require('../src/utils/applicableWpsIds');
const {
  parseArgs,
  buildPlan,
  applyPlan,
  runRepair,
  SELECT_SQL,
  UPDATE_SQL,
} = require('./repair-projects-applicable-wps-ids-vps');

const NESTED = '["[1,2]"]';

function makeDeps(rows, { affected = 1, afterRows } = {}) {
  const tx = {
    query: jest.fn().mockResolvedValue({ recordset: [{ affected }] }),
    commit: jest.fn().mockResolvedValue(),
    rollback: jest.fn().mockResolvedValue(),
  };
  return {
    tx,
    deps: {
      helpers,
      log: jest.fn(),
      selectRows: jest.fn().mockResolvedValue(rows),
      selectOne: jest.fn().mockResolvedValue(afterRows || [{ id: 3, organization_id: 1003, applicable_wps_ids: '[1,2]' }]),
      beginTransaction: jest.fn().mockResolvedValue(tx),
    },
  };
}

const ROW = { id: 3, organization_id: 1003, applicable_wps_ids: NESTED };

describe('parseArgs', () => {
  test('dry-run di default, filtri letti', () => {
    const a = parseArgs(['--organization-id', '12', '--project-code', 'X-1']);
    expect(a).toMatchObject({ apply: false, organizationId: 12, projectCode: 'X-1', errors: [] });
  });

  test('--apply esplicito', () => {
    expect(parseArgs(['--organization-id', '12', '--apply']).apply).toBe(true);
  });

  test('senza filtri o con valori non validi -> errori', () => {
    expect(parseArgs([]).errors.length).toBeGreaterThan(0);
    expect(parseArgs(['--organization-id', 'abc']).errors.length).toBeGreaterThan(0);
    expect(parseArgs(['--organization-id', '1', '--boh']).errors.length).toBeGreaterThan(0);
  });

  test('--project-code da solo viene rifiutato', () => {
    const a = parseArgs(['--project-code', 'X-1']);
    expect(a.errors).toEqual(expect.arrayContaining([
      expect.stringMatching(/--organization-id/),
    ]));
    expect(a.organizationId).toBe(null);
    expect(a.projectCode).toBe('X-1');
  });
});

describe('buildPlan', () => {
  test('annidato -> canonico, changed; canonico/null/vuoto -> invariati', () => {
    const plan = buildPlan([
      ROW,
      { id: 4, organization_id: 1003, applicable_wps_ids: '[1,2]' },
      { id: 5, organization_id: 1003, applicable_wps_ids: null },
      { id: 6, organization_id: 1003, applicable_wps_ids: '' },
      { id: 7, organization_id: 1003, applicable_wps_ids: '["[\\"x\\"]"]' },
    ], helpers);
    expect(plan.map((p) => p.changed)).toEqual([true, false, false, false, true]);
    expect(plan[0]).toMatchObject({ canonical: '[1,2]', ids_count: 2, raw_length: NESTED.length });
    expect(plan[4]).toMatchObject({ canonical: '[]', ids_count: 0, loses_unreadable_data: true });
  });

  test('anteprima del valore grezzo troncata', () => {
    const long = JSON.stringify([`[${Array.from({ length: 80 }, (_, i) => i + 1).join(',')}]`]);
    const [item] = buildPlan([{ id: 1, organization_id: 1, applicable_wps_ids: long }], helpers);
    expect(item.raw_preview.endsWith('...')).toBe(true);
    expect(item.raw_length).toBe(long.length);
  });
});

describe('runRepair', () => {
  test('dry-run (default): nessuna transazione, nessuna scrittura', async () => {
    const { deps, tx } = makeDeps([ROW]);
    const out = await runRepair({ apply: false, organizationId: 1003, projectCode: 'X' }, deps);
    expect(deps.beginTransaction).not.toHaveBeenCalled();
    expect(tx.query).not.toHaveBeenCalled();
    expect(out.updated).toBe(0);
    expect(deps.selectRows).toHaveBeenCalledWith({ project_code: 'X', organization_id: 1003 });
  });

  test('apply: UPDATE mirato per id + organization_id, commit, verifica DOPO', async () => {
    const { deps, tx } = makeDeps([ROW]);
    const out = await runRepair({ apply: true, organizationId: 1003, projectCode: null }, deps);
    expect(tx.query).toHaveBeenCalledTimes(1);
    const [sqlText, params] = tx.query.mock.calls[0];
    expect(sqlText).toBe(UPDATE_SQL);
    expect(sqlText).toMatch(/WHERE id = @id AND organization_id = @organization_id/);
    expect(sqlText).toMatch(/@@ROWCOUNT/);
    expect(params).toEqual({ id: 3, organization_id: 1003, canonical: '[1,2]', raw: NESTED });
    expect(tx.commit).toHaveBeenCalledTimes(1);
    expect(tx.rollback).not.toHaveBeenCalled();
    expect(deps.selectOne).toHaveBeenCalledWith(3, 1003);
    expect(out.updated).toBe(1);
    expect(out.after[0].changed).toBe(false);
  });

  test('apply con valore già canonico: nessuna scrittura', async () => {
    const { deps, tx } = makeDeps([{ id: 3, organization_id: 1003, applicable_wps_ids: '[1,2]' }]);
    const out = await runRepair({ apply: true, organizationId: 1003, projectCode: null }, deps);
    expect(deps.beginTransaction).not.toHaveBeenCalled();
    expect(tx.query).not.toHaveBeenCalled();
    expect(out.updated).toBe(0);
  });

  test('log senza dati personali: solo id, lunghezze e valori id WPS', async () => {
    const { deps } = makeDeps([ROW]);
    await runRepair({ apply: false, organizationId: 1003, projectCode: 'COD-SEGRETO' }, deps);
    const logged = deps.log.mock.calls.flat().join('\n');
    expect(logged).not.toContain('COD-SEGRETO');
  });
});

describe('applyPlan', () => {
  test('@@ROWCOUNT <> 1 -> rollback e errore, nessun commit', async () => {
    for (const affected of [0, 2]) {
      const { deps, tx } = makeDeps([ROW], { affected });
      const plan = buildPlan([ROW], helpers);
      await expect(applyPlan(plan, deps)).rejects.toThrow(/ROWCOUNT/);
      expect(tx.rollback).toHaveBeenCalledTimes(1);
      expect(tx.commit).not.toHaveBeenCalled();
    }
  });

  test('errore SQL -> rollback', async () => {
    const { deps, tx } = makeDeps([ROW]);
    tx.query.mockRejectedValueOnce(new Error('boom'));
    await expect(applyPlan(buildPlan([ROW], helpers), deps)).rejects.toThrow('boom');
    expect(tx.rollback).toHaveBeenCalledTimes(1);
    expect(tx.commit).not.toHaveBeenCalled();
  });

  test('piu righe in una sola transazione: la seconda fallita annulla tutto', async () => {
    const rows = [ROW, { id: 4, organization_id: 1003, applicable_wps_ids: '["[3]"]' }];
    const { deps, tx } = makeDeps(rows);
    tx.query
      .mockResolvedValueOnce({ recordset: [{ affected: 1 }] })
      .mockResolvedValueOnce({ recordset: [{ affected: 0 }] });
    await expect(applyPlan(buildPlan(rows, helpers), deps)).rejects.toThrow(/id=4/);
    expect(deps.beginTransaction).toHaveBeenCalledTimes(1);
    expect(tx.rollback).toHaveBeenCalledTimes(1);
    expect(tx.commit).not.toHaveBeenCalled();
  });
});

describe('modulo', () => {
  test('SELECT sempre scoped su organization_id (niente IS NULL OR)', () => {
    expect(SELECT_SQL).toMatch(/WHERE organization_id = @organization_id/);
    expect(SELECT_SQL).not.toMatch(/@organization_id IS NULL OR/);
  });

  test('il require non apre connessioni al DB (nessun accesso a database.js)', () => {
    jest.isolateModules(() => {
      jest.doMock('../src/config/database', () => { throw new Error('DB caricato al require'); });
      expect(() => require('./repair-projects-applicable-wps-ids-vps')).not.toThrow();
    });
  });
});

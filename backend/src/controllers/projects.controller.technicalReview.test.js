/**
 * @jest-environment node
 */

jest.mock('../config/database', () => ({ query: jest.fn() }));
jest.mock('../utils/logger', () => ({
  info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(),
}));

const { query } = require('../config/database');
const { createProject, updateProject } = require('./projects.controller');
const { TECHNICAL_REVIEW_KEYS } = require('../utils/technicalReviewChecklist');

function allChecked() {
  const checklist = {};
  for (const key of TECHNICAL_REVIEW_KEYS) {
    checklist[key] = { checked: true };
  }
  return checklist;
}

function mockRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
}

afterEach(() => jest.clearAllMocks());

describe('createProject — timbro §5.3', () => {
  it('scrive _completion nel JSON se la checklist è completa', async () => {
    query.mockResolvedValueOnce({ recordset: [{ id: 70 }] });
    const res = mockRes();
    await createProject({
      user: { organization_id: 1004, user_id: 9, full_name: 'Mario Rossi' },
      body: {
        project_code: 'CM-ISO2',
        company_id: 47,
        client_name: 'Mason',
        technical_review_checklist: allChecked(),
      },
    }, res);

    expect(res.status).toHaveBeenCalledWith(201);
    const params = query.mock.calls[0][1];
    const parsed = JSON.parse(params.technical_review_checklist);
    expect(parsed._completion.by_user_id).toBe(9);
    expect(parsed._completion.by_name).toBe('Mario Rossi');
  });

  it('se JWT non ha full_name, legge il nome da users', async () => {
    query
      .mockResolvedValueOnce({ recordset: [{ full_name: 'Mario Rossi' }] })
      .mockResolvedValueOnce({ recordset: [{ id: 71 }] });
    const res = mockRes();
    await createProject({
      user: { organization_id: 1004, user_id: 9, email: 'mario@studio.it' },
      body: {
        project_code: 'CM-ISO2b',
        company_id: 47,
        client_name: 'Mason',
        technical_review_checklist: allChecked(),
      },
    }, res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(query.mock.calls[0][0]).toMatch(/full_name FROM users/);
    const parsed = JSON.parse(query.mock.calls[1][1].technical_review_checklist);
    expect(parsed._completion.by_name).toBe('Mario Rossi');
  });

  it('in update conserva il timbro già in DB, non quello del client', async () => {
    const persisted = JSON.stringify({
      ...allChecked(),
      _completion: { at: '2026-02-01T00:00:00.000Z', by_user_id: 1, by_name: 'Anna' },
    });
    query
      .mockResolvedValueOnce({
        recordset: [{
          id: 1,
          company_id: 47,
          end_customer_id: null,
          client_name: 'Mason',
          technical_review_checklist: persisted,
        }],
      })
      .mockResolvedValueOnce({ recordset: [] });

    const forged = {
      ...allChecked(),
      _completion: { at: '2099-01-01T00:00:00.000Z', by_user_id: 99, by_name: 'Falso' },
    };
    const res = mockRes();
    await updateProject({
      params: { id: '1' },
      user: { organization_id: 1004, user_id: 9, full_name: 'Mario Rossi' },
      body: { technical_review_checklist: forged },
    }, res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    const params = query.mock.calls[1][1];
    const parsed = JSON.parse(params.technical_review_checklist);
    expect(parsed._completion.by_name).toBe('Anna');
    expect(parsed._completion.by_user_id).toBe(1);
  });
});

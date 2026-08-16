/**
 * @jest-environment node
 */

jest.mock('../config/database', () => ({ query: jest.fn() }));
jest.mock('../utils/logger', () => ({
  info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(),
}));

const { query } = require('../config/database');
const { createProject } = require('./projects.controller');
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
});

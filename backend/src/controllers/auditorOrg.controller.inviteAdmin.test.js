/**
 * @jest-environment node
 */

/**
 * Test L1 — auditorOrg.controller: inviteFirstStudioAdmin
 * Copre il gap segnalato dal committente (11/08/2026): creare un nuovo studio
 * (DEPUTYTASK1 S1/S2) non genera alcun modo di accedervi, perché
 * admin.controller.js::createUser scopa sempre organization_id all'attore
 * (documentato "FIX NON APPLICABILE" in DEPUTYTASK1 S3). Questo endpoint
 * dedicato (POST /auditor-orgs/:id/invite-admin, solo superadmin) riusa il
 * flusso invito esistente (userInviteService) senza toccare createUser.
 */
jest.mock('../config/database', () => ({ query: jest.fn(), getPool: jest.fn(), sql: {} }));
jest.mock('../utils/logger', () => ({
  info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(),
}));
jest.mock('../services/userAudit.service', () => ({ logUserAuditEvent: jest.fn() }));
jest.mock('../services/userInvite.service', () => ({
  generatePlaceholderPasswordHash: jest.fn(),
  sendInviteEmail: jest.fn(),
}));
jest.mock('../services/documentTreeProvisioner.service', () => ({ provisionTree: jest.fn() }));

const { query } = require('../config/database');
const userAuditService = require('../services/userAudit.service');
const userInviteService = require('../services/userInvite.service');
const documentTreeProvisioner = require('../services/documentTreeProvisioner.service');
const ctrl = require('./auditorOrg.controller');

const ACTOR_ID = 1;
const AUDITOR_ORG_ID = 5;
const NEW_ORG_ID = 1005;

function mockReq(overrides = {}) {
  return {
    params: { id: String(AUDITOR_ORG_ID) },
    query: {},
    body: {},
    ...overrides,
    user: { role: 'superadmin', user_id: ACTOR_ID, ...(overrides.user || {}) },
  };
}
function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

const AO_ROW = { id: AUDITOR_ORG_ID, organization_id: NEW_ORG_ID, name: 'Studio Nuovo', email: 'referente@nuovostudio.it' };

afterEach(() => jest.clearAllMocks());

describe('inviteFirstStudioAdmin', () => {
  it('400 se :id non è un numero', async () => {
    const req = mockReq({ params: { id: 'abc' }, body: { full_name: 'Mario Rossi' } });
    const res = mockRes();
    await ctrl.inviteFirstStudioAdmin(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(query).not.toHaveBeenCalled();
  });

  it('400 se full_name manca', async () => {
    const req = mockReq({ body: {} });
    const res = mockRes();
    await ctrl.inviteFirstStudioAdmin(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'VALIDATION_ERROR' }));
    expect(query).not.toHaveBeenCalled();
  });

  it('404 se lo studio non esiste', async () => {
    query.mockResolvedValueOnce({ recordset: [] }); // SELECT auditor_orgs
    const req = mockReq({ body: { full_name: 'Mario Rossi' } });
    const res = mockRes();
    await ctrl.inviteFirstStudioAdmin(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'NOT_FOUND' }));
  });

  it('400 se manca email (né fornita né salvata sullo studio)', async () => {
    query.mockResolvedValueOnce({ recordset: [{ ...AO_ROW, email: null }] });
    const req = mockReq({ body: { full_name: 'Mario Rossi' } });
    const res = mockRes();
    await ctrl.inviteFirstStudioAdmin(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'VALIDATION_ERROR' }));
  });

  it('400 se l\'email fornita non è valida', async () => {
    query.mockResolvedValueOnce({ recordset: [AO_ROW] });
    const req = mockReq({ body: { full_name: 'Mario Rossi', email: 'non-una-email' } });
    const res = mockRes();
    await ctrl.inviteFirstStudioAdmin(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'VALIDATION_ERROR' }));
  });

  it('409 se esiste già un utente con questa email in questa organizzazione', async () => {
    query.mockResolvedValueOnce({ recordset: [AO_ROW] });
    query.mockResolvedValueOnce({ recordset: [{ user_id: 99 }] }); // duplicate check
    const req = mockReq({ body: { full_name: 'Mario Rossi' } });
    const res = mockRes();
    await ctrl.inviteFirstStudioAdmin(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'EMAIL_DUPLICATE' }));
  });

  it('201: crea l\'utente admin pending nell\'organizzazione del NUOVO studio (non dell\'attore) e invia l\'invito', async () => {
    query.mockResolvedValueOnce({ recordset: [AO_ROW] }); // SELECT auditor_orgs
    query.mockResolvedValueOnce({ recordset: [] }); // duplicate check
    userInviteService.generatePlaceholderPasswordHash.mockResolvedValueOnce('$2a$10$placeholderHash');
    query.mockResolvedValueOnce({ recordset: [{ user_id: 777 }] }); // INSERT users
    userInviteService.sendInviteEmail.mockResolvedValueOnce({ sent: true });
    query.mockResolvedValueOnce({ recordset: [{ id: 1 }] }); // document tree già presente

    const req = mockReq({ body: { full_name: 'Mario Rossi' } });
    const res = mockRes();
    await ctrl.inviteFirstStudioAdmin(req, res);

    const insertCall = query.mock.calls.find(([sql]) => sql.includes('INSERT INTO users'));
    expect(insertCall[1]).toEqual(expect.objectContaining({
      email: 'referente@nuovostudio.it',
      full_name: 'Mario Rossi',
      organization_id: NEW_ORG_ID,
      password_hash: '$2a$10$placeholderHash',
    }));
    // Nessun auditor_org_id nel binding parametri: l'INSERT lo fissa a NULL via SQL
    // letterale (org-wide admin, non "Admin Studio" scoped — fix Bugbot PR #384).
    expect(insertCall[1]).not.toHaveProperty('auditor_org_id');
    expect(insertCall[0]).toMatch(/'admin'/);
    expect(insertCall[0]).toMatch(/NULL/);

    expect(userAuditService.logUserAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
      organizationId: NEW_ORG_ID, targetUserId: 777, actorUserId: ACTOR_ID, action: 'user_created',
      newValue: expect.objectContaining({ auditor_org_id: null }),
    }));
    expect(userInviteService.sendInviteEmail).toHaveBeenCalledWith(expect.objectContaining({
      userId: 777, email: 'referente@nuovostudio.it', fullName: 'Mario Rossi',
      organizationId: NEW_ORG_ID, actorUserId: ACTOR_ID,
    }));

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      data: expect.objectContaining({
        user_id: 777, role: 'admin', organization_id: NEW_ORG_ID, auditor_org_id: null, pending_activation: true,
      }),
    }));
  });

  it('usa l\'email fornita nel body invece di quella salvata sullo studio, se presente', async () => {
    query.mockResolvedValueOnce({ recordset: [AO_ROW] });
    query.mockResolvedValueOnce({ recordset: [] });
    userInviteService.generatePlaceholderPasswordHash.mockResolvedValueOnce('$2a$10$hash');
    query.mockResolvedValueOnce({ recordset: [{ user_id: 778 }] });
    userInviteService.sendInviteEmail.mockResolvedValueOnce({ sent: true });
    query.mockResolvedValueOnce({ recordset: [{ id: 1 }] });

    const req = mockReq({ body: { full_name: 'Altro Admin', email: 'altro@dominio.it' } });
    const res = mockRes();
    await ctrl.inviteFirstStudioAdmin(req, res);

    const insertCall = query.mock.calls.find(([sql]) => sql.includes('INSERT INTO users'));
    expect(insertCall[1].email).toBe('altro@dominio.it');
  });

  it('201 anche se l\'invio email fallisce (non bloccante, stesso pattern di createUser)', async () => {
    query.mockResolvedValueOnce({ recordset: [AO_ROW] });
    query.mockResolvedValueOnce({ recordset: [] });
    userInviteService.generatePlaceholderPasswordHash.mockResolvedValueOnce('$2a$10$hash');
    query.mockResolvedValueOnce({ recordset: [{ user_id: 779 }] });
    userInviteService.sendInviteEmail.mockRejectedValueOnce(new Error('SMTP down'));
    query.mockResolvedValueOnce({ recordset: [{ id: 1 }] });

    const req = mockReq({ body: { full_name: 'Mario Rossi' } });
    const res = mockRes();
    await ctrl.inviteFirstStudioAdmin(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('provisiona l\'albero documentale se il nuovo studio non ha ancora una radice', async () => {
    query.mockResolvedValueOnce({ recordset: [AO_ROW] });
    query.mockResolvedValueOnce({ recordset: [] }); // duplicate check
    userInviteService.generatePlaceholderPasswordHash.mockResolvedValueOnce('$2a$10$hash');
    query.mockResolvedValueOnce({ recordset: [{ user_id: 780 }] });
    userInviteService.sendInviteEmail.mockResolvedValueOnce({ sent: true });
    query.mockResolvedValueOnce({ recordset: [] }); // rootCheck: nessuna radice
    query.mockResolvedValueOnce({ recordset: [{ standard_code: 'ISO9001' }] }); // standards attivi

    const req = mockReq({ body: { full_name: 'Mario Rossi' } });
    const res = mockRes();
    await ctrl.inviteFirstStudioAdmin(req, res);

    expect(documentTreeProvisioner.provisionTree).toHaveBeenCalledWith(NEW_ORG_ID, null, null, ['ISO9001']);
    expect(res.status).toHaveBeenCalledWith(201);
  });
});

const BASE = 'https://busato.selfip.com:8443/api/v1';
const ADMIN_EMAIL = process.env.SGQ_APP_EMAIL || 'admin@sgq.local';
const ADMIN_PASS = process.env.SGQ_APP_PASSWORD;
const CLIENT_EMAIL = process.env.SGQ_CLIENT_COMPANY_EMAIL || 'cliente.azienda11@alproject.sgq.local';
const CLIENT_PASS = process.env.SGQ_CLIENT_COMPANY_PASSWORD;
const VIEWER_EMAIL = process.env.SGQ_CLIENT_VIEWER_EMAIL || 'viewer.azienda11@alproject.sgq.local';
const VIEWER_PASS = process.env.SGQ_CLIENT_VIEWER_PASSWORD;
const AUDITOR_ORG_ID = 1;

if (!ADMIN_PASS || !CLIENT_PASS || !VIEWER_PASS) {
  console.error('Imposta SGQ_APP_PASSWORD, SGQ_CLIENT_COMPANY_PASSWORD e SGQ_CLIENT_VIEWER_PASSWORD in .cursor/mcp.env');
  process.exit(1);
}

async function req(path, opts = {}) {
  const url = BASE + path;
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  const res = await fetch(url, { ...opts, headers });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: res.status, body };
}

const out = {};

(async () => {
  const login = await req('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASS }),
  });
  const token = login.body?.token || login.body?.data?.token;
  const auth = { Authorization: 'Bearer ' + token };

  const users = await req('/admin/users', { headers: auth });
  const existing = (users.body?.data || []).find((u) => u.email === CLIENT_EMAIL);
  if (existing) {
    out.userAction = 'updated';
    out.userId = existing.user_id;
    await req(`/admin/users/${existing.user_id}`, {
      method: 'PATCH',
      headers: auth,
      body: JSON.stringify({
        role: 'auditor',
        auditor_org_id: AUDITOR_ORG_ID,
        password: CLIENT_PASS,
        is_active: true,
        full_name: 'Cliente Azienda Test Fase 1',
      }),
    });
  } else {
    const created = await req('/admin/users', {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({
        email: CLIENT_EMAIL,
        password: CLIENT_PASS,
        full_name: 'Cliente Azienda Test Fase 1',
        role: 'auditor',
        auditor_org_id: AUDITOR_ORG_ID,
      }),
    });
    out.userAction = 'created';
    out.userCreated = created.body?.data;
  }

  const companies = await req(`/companies?auditor_org_id=${AUDITOR_ORG_ID}`, { headers: auth });
  out.studioCompanies = (companies.body?.data || []).map((c) => ({ id: c.id, name: c.name }));

  const cl = await req('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: CLIENT_EMAIL, password: CLIENT_PASS }),
  });
  out.clientLogin = cl.status;
  const ct = cl.body?.token || cl.body?.data?.token;
  const cauth = { Authorization: 'Bearer ' + ct };

  const me = await req('/auth/me', { headers: cauth });
  out.clientMe = me.body?.user;

  const clCompanies = await req('/companies', { headers: cauth });
  out.clientCompanies = {
    status: clCompanies.status,
    list: (clCompanies.body?.data || []).map((c) => ({ id: c.id, name: c.name })),
  };

  const c11 = await req('/companies/11', { headers: cauth });
  out.clientCompany11 = { status: c11.status, name: c11.body?.data?.name };

  const personnel = await req('/companies/11/personnel', { headers: cauth });
  out.clientPersonnelGet = { status: personnel.status, count: (personnel.body?.data || []).length };

  const postP = await req('/companies/11/personnel', {
    method: 'POST',
    headers: cauth,
    body: JSON.stringify({
      name: `Smoke Test ${Date.now()}`,
      job_title: 'Tester',
      email: null,
      active: true,
    }),
  });
  out.clientPersonnelPost = {
    status: postP.status,
    id: postP.body?.data?.id,
    error: postP.body?.error,
  };

  const adminUsers = await req('/admin/users', { headers: cauth });
  out.clientAdminUsers = { status: adminUsers.status, error: adminUsers.body?.error, code: adminUsers.body?.code };

  const audits = await req('/audits?limit=5', { headers: cauth });
  out.clientAudits = {
    status: audits.status,
    count: (audits.body?.data || audits.body?.audits || []).length,
  };

  const nc = await req('/nc?limit=5', { headers: cauth });
  out.clientNc = { status: nc.status };

  const docs = await req('/documents?limit=5', { headers: cauth });
  out.clientDocs = { status: docs.status };

  // Also test viewer workaround
  const VIEWER_EMAIL_LOCAL = VIEWER_EMAIL;
  const VIEWER_PASS_LOCAL = VIEWER_PASS;
  let vex = (users.body?.data || []).find((u) => u.email === VIEWER_EMAIL_LOCAL);
  if (!vex) {
    await req('/admin/users', {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({
        email: VIEWER_EMAIL_LOCAL,
        password: VIEWER_PASS_LOCAL,
        full_name: 'Viewer Azienda Test Fase 1',
        role: 'viewer',
        auditor_org_id: AUDITOR_ORG_ID,
      }),
    });
  }
  const vl = await req('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: VIEWER_EMAIL_LOCAL, password: VIEWER_PASS_LOCAL }),
  });
  const vt = vl.body?.token || vl.body?.data?.token;
  const vauth = { Authorization: 'Bearer ' + vt };
  const vme = await req('/auth/me', { headers: vauth });
  const vcomp = await req('/companies', { headers: vauth });
  const vpost = await req('/companies/11/personnel', {
    method: 'POST',
    headers: vauth,
    body: JSON.stringify({ name: 'Viewer should fail', active: true }),
  });
  out.viewer = {
    email: VIEWER_EMAIL_LOCAL,
    me: { role: vme.body?.user?.role, auditor_org_id: vme.body?.user?.auditor_org_id },
    companies: (vcomp.body?.data || []).map((c) => ({ id: c.id, name: c.name })),
    personnelPost: { status: vpost.status, error: vpost.body?.error },
  };

  console.log(JSON.stringify(out, null, 2));
})();

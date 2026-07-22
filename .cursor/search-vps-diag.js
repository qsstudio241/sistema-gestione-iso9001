require('/var/www/sgq-backend/node_modules/dotenv').config({ path: '/var/www/sgq-backend/.env' });
const { unifiedSearch } = require('/var/www/sgq-backend/src/services/unifiedSearch.service');
const { query } = require('/var/www/sgq-backend/src/config/database');

const ORG_ID = 1001;
const USER = { organization_id: ORG_ID, user_id: 1, role: 'superadmin', auditor_org_id: null };

async function main() {
  const out = { scenarios: [] };

  async function run(name, fn) {
    try {
      const data = await fn();
      out.scenarios.push({ name, ok: true, ...data });
    } catch (e) {
      out.scenarios.push({ name, ok: false, error: e.message });
    }
  }

  await run('search_saldatura_nc', async () => {
    const r = await unifiedSearch({ organizationId: ORG_ID, reqUser: USER, q: 'saldatura', entityTypes: ['non_conformity'], limit: 5 });
    return { hits: r.groups.non_conformity.length, totalCount: r.totalCount, sample: r.groups.non_conformity[0]?.title || null };
  });

  await run('search_procedura_doc', async () => {
    const r = await unifiedSearch({ organizationId: ORG_ID, reqUser: USER, q: 'procedura', entityTypes: ['document'], limit: 5 });
    return { hits: r.groups.document.length, totalCount: r.totalCount, sample: r.groups.document[0]?.title || null };
  });

  await run('search_nc_code', async () => {
    const r = await unifiedSearch({ organizationId: ORG_ID, reqUser: USER, q: 'NC-2024', entityTypes: ['non_conformity'], limit: 3 });
    return { hits: r.groups.non_conformity.length, sample: r.groups.non_conformity[0]?.title || null };
  });

  await run('company_filter_rigid', async () => {
    const co = await query('SELECT TOP 1 id, name FROM companies ORDER BY id', {});
    const row = co.recordset?.[0];
    if (!row) return { skipped: true };
    const cid = row.id;
    const rAll = await unifiedSearch({ organizationId: ORG_ID, reqUser: USER, q: 'NC', limit: 10 });
    const rCo = await unifiedSearch({ organizationId: ORG_ID, reqUser: USER, q: 'NC', companyId: cid, limit: 10 });
    const leak = [...(rCo.groups.non_conformity || []), ...(rCo.groups.document || [])]
      .some((item) => item.companyId != null && item.companyId !== cid);
    return { companyId: cid, companyName: row.name, allHits: rAll.totalCount, coHits: rCo.totalCount, leak };
  });

  await run('broad_terms', async () => {
    const terms = ['NC', 'audit', 'ISO', '2024', '2025', 'test'];
    const summary = {};
    for (const q of terms) {
      const r = await unifiedSearch({ organizationId: ORG_ID, reqUser: USER, q, limit: 3 });
      summary[q] = r.totalCount;
    }
    return { summary };
  });

  await run('route_mounted', async () => {
    const fs = require('fs');
    const server = fs.readFileSync('/var/www/sgq-backend/src/server.js', 'utf8');
    const hasSearch = server.includes('searchRoutes');
    const hasFile = fs.existsSync('/var/www/sgq-backend/src/routes/search.routes.js');
    return { hasSearch, hasFile };
  });

  console.log(JSON.stringify(out, null, 2));
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });

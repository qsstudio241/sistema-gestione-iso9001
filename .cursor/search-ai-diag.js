require('/var/www/sgq-backend/node_modules/dotenv').config({ path: '/var/www/sgq-backend/.env' });
const aiChat = require('/var/www/sgq-backend/src/controllers/aiChat.controller');

async function main() {
  const req = {
    user: { organization_id: 1001, user_id: 1, role: 'superadmin', auditor_org_id: null },
    body: { message: 'Quali NC simili abbiamo visto su saldatura?' },
  };
  let payload = null;
  const res = {
    status(code) { this._code = code; return this; },
    json(data) { payload = data; return this; },
  };
  await aiChat.aiChat(req, res);
  const citations = payload?.citations || [];
  console.log(JSON.stringify({
    ok: !!payload?.reply,
    replyPreview: (payload?.reply || '').slice(0, 200),
    sourcesCount: payload?.sourcesCount ?? citations.length,
    citationsCount: citations.length,
    citationSample: citations.slice(0, 3),
  }, null, 2));
}

main().catch((e) => { console.error(e.message); process.exit(1); });

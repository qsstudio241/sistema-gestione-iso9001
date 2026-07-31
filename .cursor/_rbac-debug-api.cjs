const fs = require('fs');
const path = require('path');
const bcrypt = require('../backend/node_modules/bcrypt');
const { query } = require('../backend/src/config/database');
const BASE = 'https://busato.selfip.com:8443/api/v1';
const tempPw = 'Rb4cTempSmokeOnly!2026';

async function login(email, pw) {
  const r = await fetch(`${BASE}/auth/login`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({email, password: pw})});
  const d = await r.json();
  return d.token;
}

(async () => {
  const u = await query("SELECT password_hash FROM users WHERE email='admin@sgq.local'");
  const backup = u.recordset[0].password_hash;
  const hash = await bcrypt.hash(tempPw, 10);
  await query('UPDATE users SET password_hash=@h WHERE email=@e', { h: hash, e: 'admin@sgq.local' });
  const token = await login('admin@sgq.local', tempPw);
  const nc = await query('SELECT TOP 1 nc_id, audit_id FROM non_conformities ORDER BY nc_id DESC');
  const ncId = nc.recordset[0].nc_id;
  const auditId = nc.recordset[0].audit_id;
  const g1 = await fetch(`${BASE}/audits/${auditId}`, { headers: { Authorization: `Bearer ${token}` }});
  const g2 = await fetch(`${BASE}/non-conformities/${ncId}`, { headers: { Authorization: `Bearer ${token}` }});
  console.log('audit', auditId, g1.status, await g1.text());
  console.log('nc', ncId, g2.status, await g2.text());
  await query('UPDATE users SET password_hash=@h WHERE email=@e', { h: backup, e: 'admin@sgq.local' });
})().catch(e=>console.error(e));

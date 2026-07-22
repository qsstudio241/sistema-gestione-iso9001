const bcrypt = require('../backend/node_modules/bcrypt');
const { query } = require('../backend/src/config/database');
const fs = require('fs');
const path = require('path');

const TEMP = process.argv[2] || 'Rb4cTempSmokeOnly!';
const email = 'admin@sgq.local';
const backupPath = path.join(__dirname, '_rbac_smoke_pw_backup.json');

(async () => {
  const u = await query('SELECT user_id, password_hash FROM users WHERE email=@email', { email });
  if (!u.recordset.length) throw new Error('user missing');
  const row = u.recordset[0];
  if (!fs.existsSync(backupPath)) {
    fs.writeFileSync(backupPath, JSON.stringify({ user_id: row.user_id, password_hash: row.password_hash }));
  }
  const hash = await bcrypt.hash(TEMP, 10);
  await query('UPDATE users SET password_hash=@hash WHERE user_id=@id', { hash, id: row.user_id });
  console.log('TEMP_PW_SET');
  process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1); });

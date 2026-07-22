const fs = require('fs');
const path = require('path');
const { query } = require('../backend/src/config/database');
const backupPath = path.join(__dirname, '_rbac_smoke_pw_backup.json');
(async () => {
  if (!fs.existsSync(backupPath)) { console.log('NO_BACKUP'); process.exit(0); }
  const b = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
  await query('UPDATE users SET password_hash=@hash WHERE user_id=@id', { hash: b.password_hash, id: b.user_id });
  fs.unlinkSync(backupPath);
  console.log('PW_RESTORED');
  process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1); });

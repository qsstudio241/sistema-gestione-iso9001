const p = require('/var/www/sgq-backend/config/database.json');
const prod = p.production || p.development || p;
console.log(JSON.stringify({ server: prod.server, port: prod.port, database: prod.database, user: prod.user }));

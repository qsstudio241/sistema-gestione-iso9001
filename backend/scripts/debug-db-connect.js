require('/var/www/sgq-backend/node_modules/dotenv').config({ path: '/var/www/sgq-backend/.env' });
console.log('DB_SERVER:', process.env.DB_SERVER);
console.log('DB_PORT:', process.env.DB_PORT);
console.log('DB_USER:', process.env.DB_USER);
console.log('DB_PASSWORD len:', process.env.DB_PASSWORD ? process.env.DB_PASSWORD.length : 'UNDEFINED');

// Legge database.json (ha credenziali complete) e override server?localhost
const sql = require('/var/www/sgq-backend/node_modules/mssql');
const fs = require('fs');
const path = require('path');

const dbJsonPath = '/var/www/sgq-backend/config/database.json';
const configs = JSON.parse(fs.readFileSync(dbJsonPath, 'utf8'));
const env = process.env.NODE_ENV || 'production';
const dbConf = configs[env] || configs.production;

// Il VPS raggiunge SQL Server su localhost, non sull'hostname pubblico
const config = {
    server: 'localhost',
    port: dbConf.port || 11043,
    database: dbConf.database,
    user: dbConf.user,
    password: dbConf.password,
    options: {
        encrypt: false,
        trustServerCertificate: true,
        enableArithAbort: true,
        connectTimeout: 30000,
        requestTimeout: 60000,
    }
};

console.log(`Connessione a ${config.server}:${config.port}/${config.database} come ${config.user}`);

async function run() {
    const pool = await sql.connect(config);
    const migrationsDir = '/var/www/sgq-backend/database/migrations';
    const files = [
        '056_document_tags.sql',
        '057_document_tree_and_relations.sql',
        '058_document_history.sql',
        '059_document_tree_templates.sql',
    ];

    for (const file of files) {
        console.log(`\n=== Esecuzione ${file} ===`);
        const sqlText = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
        const batches = sqlText.split(/^\s*GO\s*$/gim).filter(b => b.trim());
        for (const batch of batches) {
            try {
                await pool.request().query(batch);
            } catch (err) {
                if (err.message.includes('already') || err.message.includes('There is already') || err.message.includes('Duplicate')) {
                    console.log(`  (già presente, skip): ${err.message.substring(0, 100)}`);
                } else {
                    console.error(`  ERRORE: ${err.message}`);
                }
            }
        }
        console.log(`  ${file} completato`);
    }
    console.log('\nTutte le migration completate.');
    await pool.close();
    process.exit(0);
}

run().catch(err => { console.error('FATAL:', err.message); process.exit(1); });

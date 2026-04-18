/**
 * Script per eseguire migration audit_responses
 * Eseguire con: node run-migration.js
 */

require('dotenv').config();
const path = require('path');
const sql = require('mssql');

const configs = require(path.join(__dirname, 'config', 'database.json'));
let c = configs.production || configs.development;
if (process.env.DB_SERVER) {
    c = {
        ...c,
        server: process.env.DB_SERVER,
        port: parseInt(process.env.DB_PORT || c.port, 10),
        database: process.env.DB_DATABASE || c.database,
        user: process.env.DB_USER || c.user,
        password: process.env.DB_PASSWORD || c.password
    };
}
if (!c?.user || !c?.password) {
    console.error('Configurare backend/config/database.json (gitignored) o variabili DB_* . Nessuna password in repository.');
    process.exit(1);
}

const config = {
    user: c.user,
    password: c.password,
    server: c.server,
    port: c.port || 1433,
    database: c.database,
    options: {
        encrypt: true,
        trustServerCertificate: true,
        enableArithAbort: true
    },
    requestTimeout: 60000
};

console.log('📋 Configurazione DB:', {
    server: config.server,
    port: config.port,
    database: config.database,
    user: config.user
});

async function runMigration() {
    let pool;

    try {
        console.log('🔌 Connessione al database...');
        pool = await sql.connect(config);
        console.log('✅ Connesso a', config.database);

        // Aggiungi colonna evidence
        console.log('\n📝 Aggiunta colonne mancanti a audit_responses...');

        const columns = [
            { name: 'evidence', type: 'NVARCHAR(MAX)', nullable: true },
            { name: 'answered_at', type: 'DATETIME2', nullable: true },
            { name: 'created_by', type: 'INT', nullable: true },
            { name: 'updated_by', type: 'INT', nullable: true }
        ];

        for (const col of columns) {
            try {
                const checkResult = await pool.request().query(`
                    SELECT 1 FROM sys.columns 
                    WHERE object_id = OBJECT_ID('audit_responses') AND name = '${col.name}'
                `);

                if (checkResult.recordset.length === 0) {
                    await pool.request().query(`
                        ALTER TABLE [dbo].[audit_responses] 
                        ADD [${col.name}] ${col.type} ${col.nullable ? 'NULL' : 'NOT NULL'}
                    `);
                    console.log(`  ✅ Colonna ${col.name} aggiunta`);
                } else {
                    console.log(`  ⏭️ Colonna ${col.name} già esistente`);
                }
            } catch (err) {
                console.error(`  ❌ Errore colonna ${col.name}:`, err.message);
            }
        }

        // Aggiorna CHECK constraint per includere OSS
        console.log('\n📝 Aggiornamento constraint conformity_status...');
        try {
            // Trova e rimuovi constraint esistente
            const constraintResult = await pool.request().query(`
                SELECT name FROM sys.check_constraints 
                WHERE parent_object_id = OBJECT_ID('audit_responses') 
                AND definition LIKE '%conformity_status%'
            `);

            for (const row of constraintResult.recordset) {
                await pool.request().query(`
                    ALTER TABLE [dbo].[audit_responses] DROP CONSTRAINT [${row.name}]
                `);
                console.log(`  ✅ Constraint ${row.name} rimosso`);
            }

            // Aggiungi nuovo constraint
            await pool.request().query(`
                ALTER TABLE [dbo].[audit_responses] 
                ADD CONSTRAINT [CK_audit_responses_conformity_status] 
                CHECK ([conformity_status] IN ('C', 'NC', 'OSS', 'OM', 'NA', NULL))
            `);
            console.log(`  ✅ Nuovo constraint aggiunto (C, NC, OSS, OM, NA)`);

        } catch (err) {
            if (err.message.includes('already exists')) {
                console.log(`  ⏭️ Constraint già configurato correttamente`);
            } else {
                console.error(`  ❌ Errore constraint:`, err.message);
            }
        }

        console.log('\n✅ Migration completata!');

    } catch (error) {
        console.error('❌ Errore connessione:', error.message);
        process.exit(1);
    } finally {
        if (pool) {
            await pool.close();
        }
    }
}

runMigration();

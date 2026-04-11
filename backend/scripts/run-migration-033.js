/**
 * run-migration-033.js
 * Esegue la migrazione 033: creazione tabella nc_actions
 */
const sql = require('mssql');
const path = require('path');

const dbConfigAll = require(path.join(__dirname, '../config/database.json'));
const dbConfig = dbConfigAll.production || dbConfigAll;

const SQL = `
IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_NAME = 'nc_actions'
)
BEGIN
    CREATE TABLE nc_actions (
        action_id         INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_nc_actions PRIMARY KEY,
        nc_id             INT NOT NULL
                          CONSTRAINT FK_nc_actions_nc REFERENCES non_conformities(nc_id) ON DELETE CASCADE,
        action_type       NVARCHAR(20) NOT NULL DEFAULT 'corrective'
                          CONSTRAINT CHK_nc_actions_type
                          CHECK (action_type IN ('immediate','corrective','preventive')),
        description       NVARCHAR(MAX) NOT NULL,
        responsible       NVARCHAR(200) NULL,
        due_date          DATE NULL,
        status            NVARCHAR(20) NOT NULL DEFAULT 'open'
                          CONSTRAINT CHK_nc_actions_status
                          CHECK (status IN ('open','in_progress','completed','verified')),
        completed_at      DATETIME2 NULL,
        verification_note NVARCHAR(MAX) NULL,
        created_by        INT NULL,
        created_at        DATETIME2 NOT NULL DEFAULT GETDATE(),
        updated_at        DATETIME2 NOT NULL DEFAULT GETDATE()
    );
    CREATE INDEX IX_nc_actions_nc_id ON nc_actions(nc_id);
    PRINT 'Tabella nc_actions creata con successo.';
END
ELSE
BEGIN
    PRINT 'Tabella nc_actions gia esistente - skip.';
END
`;

async function runMigration() {
    console.log('Connessione al DB...');
    const pool = await sql.connect({
        server: dbConfig.server,
        database: dbConfig.database,
        user: dbConfig.user,
        password: dbConfig.password,
        port: dbConfig.port || 1433,
        options: {
            encrypt: dbConfig.options?.encrypt !== false,
            trustServerCertificate: dbConfig.options?.trustServerCertificate !== false,
        }
    });

    console.log('Esecuzione migration 033...');
    await pool.request().query(SQL);
    console.log('Migration 033 completata con successo.');
    await pool.close();
}

runMigration().catch(err => {
    console.error('Errore migration 033:', err.message);
    process.exit(1);
});

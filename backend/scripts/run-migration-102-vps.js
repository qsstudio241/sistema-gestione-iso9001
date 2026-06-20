/**
 * Migration 102 — equipment_calibrations
 * Prerequisito: migration 101 (equipment_assets) deve essere applicata.
 */

require('/var/www/sgq-backend/node_modules/dotenv').config({ path: '/var/www/sgq-backend/.env' });
const { getPool } = require('/var/www/sgq-backend/src/config/database');

const SQL_TABLE = `
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'equipment_calibrations')
BEGIN
    CREATE TABLE equipment_calibrations (
        id                      INT IDENTITY(1,1) PRIMARY KEY,
        asset_id                INT           NOT NULL,
        calibration_date        DATE          NOT NULL,
        next_calibration_date   DATE          NOT NULL,
        calibrated_by           NVARCHAR(200) NULL,
        certificate_number      NVARCHAR(100) NULL,
        result                  NVARCHAR(20)  NOT NULL DEFAULT 'pass',
        attachment_id           INT           NULL,
        notes                   NVARCHAR(MAX) NULL,
        created_at              DATETIME2     NOT NULL DEFAULT GETDATE(),
        created_by              INT           NULL
    );
    CREATE INDEX IX_equipment_calibrations_asset ON equipment_calibrations (asset_id);
    CREATE INDEX IX_equipment_calibrations_date ON equipment_calibrations (calibration_date DESC);
    PRINT 'equipment_calibrations creata.';
END
ELSE
    PRINT 'equipment_calibrations gia esistente — skip.';
`;

const SQL_FK = `
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_equipment_calibrations_asset')
BEGIN
    ALTER TABLE equipment_calibrations
        ADD CONSTRAINT FK_equipment_calibrations_asset
        FOREIGN KEY (asset_id) REFERENCES equipment_assets (id);
    PRINT 'FK_equipment_calibrations_asset aggiunta.';
END
`;

async function run() {
    const pool = await getPool();
    try {
        await pool.request().query(SQL_TABLE);
        await pool.request().query(SQL_FK);
        console.log('[102] Migration equipment_calibrations completata.');
    } catch (e) {
        console.error('[102] ERRORE:', e.message);
        process.exit(1);
    } finally {
        await pool.close().catch(() => {});
        process.exit(0);
    }
}

run();

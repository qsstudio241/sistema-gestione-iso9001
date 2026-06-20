/**
 * Migration 101 — equipment_assets
 * Eseguire su VPS (DB test o produzione):
 *   node /tmp/run-migration-101-vps.js
 *
 * Da Cloud Agent:
 *   scp -i /tmp/sgq_key -P 1122 backend/scripts/run-migration-101-vps.js spascarella@www.fr-busato.it:/tmp/
 *   ssh -i /tmp/sgq_key -p 1122 spascarella@www.fr-busato.it "node /tmp/run-migration-101-vps.js"
 */

require('/var/www/sgq-backend/node_modules/dotenv').config({ path: '/var/www/sgq-backend/.env' });
const { getPool } = require('/var/www/sgq-backend/src/config/database');

const SQL = `
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'equipment_assets')
BEGIN
    CREATE TABLE equipment_assets (
        id                          INT IDENTITY(1,1) PRIMARY KEY,
        uuid                        UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
        organization_id             INT NOT NULL,
        company_id                  INT NULL,
        asset_category              NVARCHAR(50)  NOT NULL DEFAULT 'measuring_instrument',
        asset_subcategory           NVARCHAR(100) NULL,
        name                        NVARCHAR(200) NOT NULL,
        manufacturer                NVARCHAR(200) NULL,
        model                       NVARCHAR(200) NULL,
        serial_number               NVARCHAR(100) NULL,
        internal_code               NVARCHAR(100) NULL,
        applicable_systems          NVARCHAR(500) NULL,
        applicable_methods          NVARCHAR(200) NULL,
        location                    NVARCHAR(200) NULL,
        status                      NVARCHAR(20)  NOT NULL DEFAULT 'active',
        requires_calibration        BIT           NOT NULL DEFAULT 1,
        calibration_frequency_months INT          NULL,
        last_calibration_date       DATE          NULL,
        next_calibration_date       DATE          NULL,
        purchase_date               DATE          NULL,
        purchase_price              DECIMAL(10,2) NULL,
        notes                       NVARCHAR(MAX) NULL,
        is_deleted                  BIT           NOT NULL DEFAULT 0,
        created_at                  DATETIME2     NOT NULL DEFAULT GETDATE(),
        updated_at                  DATETIME2     NOT NULL DEFAULT GETDATE(),
        created_by                  INT           NULL
    );
    CREATE INDEX IX_equipment_assets_org ON equipment_assets (organization_id);
    CREATE INDEX IX_equipment_assets_company ON equipment_assets (company_id);
    CREATE INDEX IX_equipment_assets_status ON equipment_assets (status, is_deleted);
    CREATE INDEX IX_equipment_assets_calibration ON equipment_assets (next_calibration_date) WHERE requires_calibration = 1 AND is_deleted = 0;
    CREATE UNIQUE INDEX UX_equipment_assets_uuid ON equipment_assets (uuid);
    PRINT 'equipment_assets creata.';
END
ELSE
    PRINT 'equipment_assets gia esistente — skip.';
`;

async function run() {
    const pool = await getPool();
    try {
        await pool.request().query(SQL);
        console.log('[101] Migration equipment_assets completata.');
    } catch (e) {
        console.error('[101] ERRORE:', e.message);
        process.exit(1);
    } finally {
        await pool.close().catch(() => {});
        process.exit(0);
    }
}

run();

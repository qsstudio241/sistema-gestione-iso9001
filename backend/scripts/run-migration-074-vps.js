'use strict';

process.chdir('/var/www/sgq-backend');
require('/var/www/sgq-backend/node_modules/dotenv').config({ path: '/var/www/sgq-backend/.env' });

const { query } = require('/var/www/sgq-backend/src/config/database');

const STEPS = [
    `IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'commercial_case_notifications')
    BEGIN
        CREATE TABLE commercial_case_notifications (
            id              INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
            organization_id INT NOT NULL,
            case_id         INT NOT NULL,
            event_type      NVARCHAR(50) NOT NULL,
            target_user_id  INT NULL,
            title           NVARCHAR(200) NULL,
            payload_json    NVARCHAR(MAX) NULL,
            email_sent_at   DATETIME2 NULL,
            read_at         DATETIME2 NULL,
            created_at      DATETIME2 NOT NULL CONSTRAINT DF_ccn_created DEFAULT SYSUTCDATETIME()
        );
    END`,
    `IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_ccn_case')
    BEGIN
        ALTER TABLE commercial_case_notifications
        ADD CONSTRAINT FK_ccn_case FOREIGN KEY (case_id) REFERENCES commercial_cases(id);
    END`,
    `IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_ccn_org')
    BEGIN
        ALTER TABLE commercial_case_notifications
        ADD CONSTRAINT FK_ccn_org FOREIGN KEY (organization_id) REFERENCES organizations(organization_id);
    END`,
    `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ccn_org_case_created')
    BEGIN
        CREATE INDEX IX_ccn_org_case_created
        ON commercial_case_notifications (organization_id, case_id, created_at DESC);
    END`,
    `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ccn_target_unread')
    BEGIN
        CREATE INDEX IX_ccn_target_unread
        ON commercial_case_notifications (organization_id, target_user_id, read_at)
        WHERE read_at IS NULL;
    END`,
];

(async () => {
    console.log('Migration 074 — commercial_case_notifications');
    try {
        for (let i = 0; i < STEPS.length; i++) {
            await query(STEPS[i]);
            console.log(`Step ${i + 1}/${STEPS.length} OK`);
        }
        const verify = await query(`
            SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
            WHERE TABLE_NAME = 'commercial_case_notifications'
        `);
        if (!verify.recordset.length) {
            console.error('ERRORE: tabella commercial_case_notifications assente');
            process.exit(1);
        }
        console.log('Migration 074 completata.');
        process.exit(0);
    } catch (e) {
        console.error('ERRORE migration 074:', e.message);
        process.exit(1);
    }
})();

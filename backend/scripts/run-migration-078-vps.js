'use strict';

process.chdir('/var/www/sgq-backend');
require('/var/www/sgq-backend/node_modules/dotenv').config({ path: '/var/www/sgq-backend/.env' });

const { query } = require('/var/www/sgq-backend/src/config/database');

const STEPS = [
    `IF NOT EXISTS (
        SELECT 1 FROM sys.objects
        WHERE name = 'company_personnel' AND type = 'U'
    )
    BEGIN
        CREATE TABLE company_personnel (
            id                      INT IDENTITY(1,1) NOT NULL,
            organization_id         INT            NOT NULL,
            company_id              INT            NOT NULL,
            name                    NVARCHAR(200)  NOT NULL,
            job_title               NVARCHAR(200)  NULL,
            email                   NVARCHAR(320)  NULL,
            active                  BIT            NOT NULL DEFAULT 1,
            can_actuation           BIT            NOT NULL DEFAULT 0,
            can_verify              BIT            NOT NULL DEFAULT 0,
            notification_contact_id INT            NULL,
            created_at              DATETIME2      NOT NULL DEFAULT GETDATE(),
            updated_at              DATETIME2      NOT NULL DEFAULT GETDATE(),
            CONSTRAINT PK_company_personnel PRIMARY KEY (id)
        );
        CREATE INDEX IX_company_personnel_org_company
            ON company_personnel (organization_id, company_id);
        CREATE INDEX IX_company_personnel_company_active
            ON company_personnel (company_id, active);
    END`,
    `IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_company_personnel_org')
        ALTER TABLE company_personnel
        ADD CONSTRAINT FK_company_personnel_org
            FOREIGN KEY (organization_id) REFERENCES organizations(organization_id)`,
    `IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_company_personnel_company')
        ALTER TABLE company_personnel
        ADD CONSTRAINT FK_company_personnel_company
            FOREIGN KEY (company_id) REFERENCES companies(id)`,
    `IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_company_personnel_notification_contact')
        ALTER TABLE company_personnel
        ADD CONSTRAINT FK_company_personnel_notification_contact
            FOREIGN KEY (notification_contact_id) REFERENCES notification_contacts(id)`,
    `IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'notification_contacts' AND COLUMN_NAME = 'company_id'
    )
        ALTER TABLE notification_contacts ADD company_id INT NULL`,
    `IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'notification_contacts' AND COLUMN_NAME = 'personnel_id'
    )
        ALTER TABLE notification_contacts ADD personnel_id INT NULL`,
    `IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_notification_contacts_company')
        ALTER TABLE notification_contacts
        ADD CONSTRAINT FK_notification_contacts_company
            FOREIGN KEY (company_id) REFERENCES companies(id)`,
    `IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_notification_contacts_personnel')
        ALTER TABLE notification_contacts
        ADD CONSTRAINT FK_notification_contacts_personnel
            FOREIGN KEY (personnel_id) REFERENCES company_personnel(id)`,
];

(async () => {
    console.log('Migration 078 � company_personnel + bridge notification_contacts');
    try {
        for (let i = 0; i < STEPS.length; i++) {
            await query(STEPS[i]);
            console.log(`Step ${i + 1}/${STEPS.length} OK`);
        }
        const verify = await query(`
            SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'company_personnel'
        `);
        if (!verify.recordset.length) {
            console.error('ERRORE: tabella company_personnel assente');
            process.exit(1);
        }
        console.log('Migration 078 completata.');
        process.exit(0);
    } catch (e) {
        console.error('ERRORE migration 078:', e.message);
        process.exit(1);
    }
})();

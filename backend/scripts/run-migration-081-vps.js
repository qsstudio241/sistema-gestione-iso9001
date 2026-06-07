'use strict';

process.chdir('/var/www/sgq-backend');
require('/var/www/sgq-backend/node_modules/dotenv').config({ path: '/var/www/sgq-backend/.env' });

const { query } = require('/var/www/sgq-backend/src/config/database');

const STEPS = [
    `IF NOT EXISTS (
        SELECT 1 FROM sys.objects
        WHERE name = 'user_company_access' AND type = 'U'
    )
    BEGIN
        CREATE TABLE user_company_access (
            id              INT IDENTITY(1,1) NOT NULL,
            user_id         INT            NOT NULL,
            company_id      INT            NOT NULL,
            permission      NVARCHAR(20)   NOT NULL,
            organization_id INT            NOT NULL,
            created_at      DATETIME2      NOT NULL DEFAULT GETDATE(),
            CONSTRAINT PK_user_company_access PRIMARY KEY (id),
            CONSTRAINT UQ_user_company_access_user_company UNIQUE (user_id, company_id),
            CONSTRAINT CK_user_company_access_permission CHECK (permission IN ('read', 'write'))
        );
        CREATE INDEX IX_user_company_access_user ON user_company_access (user_id);
        CREATE INDEX IX_user_company_access_company ON user_company_access (company_id);
    END`,
    `IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_user_company_access_user')
        ALTER TABLE user_company_access
        ADD CONSTRAINT FK_user_company_access_user
            FOREIGN KEY (user_id) REFERENCES users(user_id)`,
    `IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_user_company_access_company')
        ALTER TABLE user_company_access
        ADD CONSTRAINT FK_user_company_access_company
            FOREIGN KEY (company_id) REFERENCES companies(id)`,
    `IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_user_company_access_org')
        ALTER TABLE user_company_access
        ADD CONSTRAINT FK_user_company_access_org
            FOREIGN KEY (organization_id) REFERENCES organizations(organization_id)`,
];

(async () => {
    console.log('Migration 081 � user_company_access (RBAC Fase 4)');
    try {
        for (let i = 0; i < STEPS.length; i++) {
            await query(STEPS[i]);
            console.log(`Step ${i + 1}/${STEPS.length} OK`);
        }
        const verify = await query(`
            SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'user_company_access'
        `);
        if (!verify.recordset.length) {
            console.error('ERRORE: tabella user_company_access assente');
            process.exit(1);
        }
        console.log('Migration 081 completata.');
        process.exit(0);
    } catch (e) {
        console.error('ERRORE migration 081:', e.message);
        process.exit(1);
    }
})();

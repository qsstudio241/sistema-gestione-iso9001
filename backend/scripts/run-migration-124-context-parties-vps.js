require('/var/www/sgq-backend/node_modules/dotenv').config({ path: '/var/www/sgq-backend/.env' });
const { query } = require('/var/www/sgq-backend/src/config/database');

const SQL_CF = `
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'context_factors')
BEGIN
  CREATE TABLE context_factors (
    id             INT IDENTITY(1,1) PRIMARY KEY,
    organization_id INT NOT NULL,
    company_id     INT NULL,
    type           NVARCHAR(20) NOT NULL DEFAULT 'external'
                   CONSTRAINT CK_cf_type CHECK (type IN ('internal', 'external')),
    category       NVARCHAR(50) NULL,
    description    NVARCHAR(MAX) NOT NULL,
    impact         NVARCHAR(20) NOT NULL DEFAULT 'neutral'
                   CONSTRAINT CK_cf_impact CHECK (impact IN ('positive', 'negative', 'neutral')),
    is_active      BIT NOT NULL DEFAULT 1,
    created_at     DATETIME NOT NULL DEFAULT GETDATE(),
    updated_at     DATETIME NOT NULL DEFAULT GETDATE()
  );
  CREATE INDEX IX_context_factors_org ON context_factors(organization_id);
END
`;

const SQL_IP = `
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'interested_parties')
BEGIN
  CREATE TABLE interested_parties (
    id             INT IDENTITY(1,1) PRIMARY KEY,
    organization_id INT NOT NULL,
    company_id     INT NULL,
    name           NVARCHAR(200) NOT NULL,
    relationship   NVARCHAR(100) NULL,
    requirements   NVARCHAR(MAX) NULL,
    is_active      BIT NOT NULL DEFAULT 1,
    created_at     DATETIME NOT NULL DEFAULT GETDATE(),
    updated_at     DATETIME NOT NULL DEFAULT GETDATE()
  );
  CREATE INDEX IX_interested_parties_org ON interested_parties(organization_id);
END
`;

async function main() {
  try {
    await query(SQL_CF);
    console.log('context_factors OK');
    await query(SQL_IP);
    console.log('interested_parties OK');
    console.log('Migration 124 OK');
  } catch (e) {
    console.error('Migration 124 ERRORE:', e.message);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}
main();

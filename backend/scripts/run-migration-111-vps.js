/**
 * Migration 111 (VPS runner) - document_registry.content_scope + Patrimonio Studio
 *
 * Esegue, in modo IDEMPOTENTE e ADDITIVO:
 *   1. ALTER TABLE document_registry ADD content_scope NVARCHAR(20) NULL
 *   2. CHECK constraint (NULL | 'client' | 'studio' | 'reference')
 *   3. DEFAULT 'client'
 *   4. Indice (organization_id, content_scope)
 *   5. Backfill content_scope sui record esistenti (solo dove NULL)
 *   6. Seed template albero 'studio_patrimonio_v1' in document_tree_templates
 *   7. (opzionale) Provisioning radice Patrimonio Studio per ogni organizzazione
 *      -> lanciare con argomento "--provision" per crearla subito.
 *
 * Uso sul VPS:
 *   node /tmp/run-migration-111-vps.js            # solo schema + backfill + template
 *   node /tmp/run-migration-111-vps.js --provision  # anche provisioning per org
 *
 * NON esegue automaticamente in produzione: va lanciato esplicitamente.
 */
require('/var/www/sgq-backend/node_modules/dotenv').config({ path: '/var/www/sgq-backend/.env' });
const { getPool, query } = require('/var/www/sgq-backend/src/config/database');

const STUDIO_TEMPLATE = JSON.stringify([
    {
        code: 'STD', title: 'PATRIMONIO STUDIO', children: [
            { code: 'STD.1', title: 'MODELLI E TEMPLATE' },
            { code: 'STD.2', title: 'PROCEDURE INTERNE STUDIO' },
            { code: 'STD.3', title: 'KNOW-HOW E LINEE GUIDA' },
            { code: 'STD.4', title: 'NORME E RIFERIMENTI' },
            { code: 'STD.5', title: 'FORMAZIONE E COMPETENZE' },
        ],
    },
]);

async function run() {
    const pool = await getPool();
    const doProvision = process.argv.includes('--provision');
    try {
        // 1. Colonna
        await pool.request().query(`
            IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('document_registry') AND name = 'content_scope')
            BEGIN
                ALTER TABLE dbo.document_registry ADD content_scope NVARCHAR(20) NULL;
                PRINT 'content_scope aggiunto';
            END ELSE PRINT 'content_scope gia presente';
        `);
        console.log('[111] (1) colonna content_scope OK');

        // 2. CHECK
        await pool.request().query(`
            IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_doc_registry_content_scope')
            BEGIN
                ALTER TABLE dbo.document_registry WITH NOCHECK
                    ADD CONSTRAINT CK_doc_registry_content_scope
                    CHECK (content_scope IS NULL OR content_scope IN ('client','studio','reference'));
            END
        `);
        console.log('[111] (2) CHECK OK');

        // 3. DEFAULT
        await pool.request().query(`
            IF NOT EXISTS (SELECT 1 FROM sys.default_constraints WHERE name = 'DF_doc_registry_content_scope')
            BEGIN
                ALTER TABLE dbo.document_registry
                    ADD CONSTRAINT DF_doc_registry_content_scope DEFAULT 'client' FOR content_scope;
            END
        `);
        console.log('[111] (3) DEFAULT OK');

        // 4. Indice
        await pool.request().query(`
            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_doc_registry_content_scope' AND object_id = OBJECT_ID('document_registry'))
            BEGIN
                CREATE INDEX IX_doc_registry_content_scope ON dbo.document_registry(organization_id, content_scope);
            END
        `);
        console.log('[111] (4) indice OK');

        // 5. Backfill (solo content_scope NULL)
        const r1 = await pool.request().query(`UPDATE dbo.document_registry SET content_scope = 'client' WHERE content_scope IS NULL AND company_id IS NOT NULL;`);
        const r2 = await pool.request().query(`UPDATE dbo.document_registry SET content_scope = 'reference' WHERE content_scope IS NULL AND company_id IS NULL AND doc_type = 'norma';`);
        const r3 = await pool.request().query(`UPDATE dbo.document_registry SET content_scope = 'reference' WHERE content_scope IS NULL AND company_id IS NULL AND ISNULL(is_system_folder, 0) = 1;`);
        const r4 = await pool.request().query(`UPDATE dbo.document_registry SET content_scope = 'studio' WHERE content_scope IS NULL AND company_id IS NULL;`);
        console.log(`[111] (5) backfill OK -> client=${r1.rowsAffected[0]} reference(norma)=${r2.rowsAffected[0]} reference(sysfolder)=${r3.rowsAffected[0]} studio=${r4.rowsAffected[0]}`);

        // 6. Seed template
        await pool.request()
            .input('structure', STUDIO_TEMPLATE)
            .query(`
                IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'document_tree_templates' AND schema_id = SCHEMA_ID('dbo'))
                BEGIN
                    IF NOT EXISTS (SELECT 1 FROM dbo.document_tree_templates WHERE template_code = 'studio_patrimonio_v1')
                    BEGIN
                        INSERT INTO dbo.document_tree_templates (template_code, name, description, structure, applicable_standards, is_default)
                        VALUES ('studio_patrimonio_v1', 'Patrimonio Studio',
                            'Contenitore documentale del know-how dello studio. Mai visibile nelle viste delle aziende clienti.',
                            @structure, NULL, 0);
                    END
                END
            `);
        console.log('[111] (6) template studio_patrimonio_v1 OK');

        // 7. Provisioning opzionale
        if (doProvision) {
            const provisioner = require('/var/www/sgq-backend/src/services/documentTreeProvisioner.service');
            const orgs = await query(`SELECT DISTINCT organization_id FROM organizations`);
            for (const row of (orgs.recordset || [])) {
                try {
                    await provisioner.provisionStudioPatrimony(row.organization_id);
                    console.log(`[111] (7) Patrimonio Studio provisionato per org ${row.organization_id}`);
                } catch (e) {
                    console.error(`[111] (7) provisioning org ${row.organization_id} fallito: ${e.message}`);
                }
            }
        } else {
            console.log('[111] (7) provisioning saltato (lancia con --provision per crearlo)');
        }

        console.log('[111] Migration completata.');
    } catch (e) {
        console.error('[111] ERRORE:', e.message);
        process.exit(1);
    } finally {
        await pool.close().catch(() => {});
        process.exit(0);
    }
}
run();

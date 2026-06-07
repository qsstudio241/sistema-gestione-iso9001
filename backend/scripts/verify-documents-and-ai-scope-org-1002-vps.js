/**
 * Verifica coerenza documenti + knowledge_chunks (ambito AI) org 1002.
 */
require('/var/www/sgq-backend/node_modules/dotenv').config({ path: '/var/www/sgq-backend/.env' });
const { query, getPool } = require('/var/www/sgq-backend/src/config/database');

const ORG_ID = 1002;

async function main() {
    await getPool();
    console.log('=== Documenti + ambito AI — org', ORG_ID, '===\n');

    const docSummary = await query(
        `
        SELECT
          CASE WHEN dr.company_id IS NULL THEN 'NULL' ELSE CAST(dr.company_id AS VARCHAR(12)) END AS company_key,
          COUNT(*) AS n
        FROM document_registry dr
        WHERE dr.organization_id = @org_id AND dr.doc_type <> 'folder'
          AND ISNULL(dr.status, 'rilasciato') <> 'obsoleto'
        GROUP BY dr.company_id
        ORDER BY n DESC
        `,
        { org_id: ORG_ID }
    );
    console.log('1. Documenti attivi per company_id:');
    for (const r of docSummary.recordset) {
        console.log(`   company_id=${r.company_key}: ${r.n}`);
    }

    const parentMismatch = await query(
        `
        SELECT COUNT(*) AS n
        FROM document_registry d
        INNER JOIN document_registry p ON p.id = d.parent_id
        WHERE d.organization_id = @org_id AND d.doc_type <> 'folder'
          AND ISNULL(d.status, 'rilasciato') <> 'obsoleto'
          AND d.company_id IS NOT NULL AND p.company_id IS NOT NULL
          AND d.company_id <> p.company_id
        `,
        { org_id: ORG_ID }
    );
    console.log('\n2. Documento con cartella padre di altra azienda (atteso 0):', parentMismatch.recordset[0].n);

    const parentObsoleto = await query(
        `
        SELECT COUNT(*) AS n
        FROM document_registry d
        INNER JOIN document_registry p ON p.id = d.parent_id
        WHERE d.organization_id = @org_id AND d.doc_type <> 'folder'
          AND ISNULL(d.status, 'rilasciato') <> 'obsoleto'
          AND (p.status = 'obsoleto' OR (p.company_id IS NULL AND p.doc_type = 'folder'))
        `,
        { org_id: ORG_ID }
    );
    console.log('3. Documenti attivi sotto parent obsoleto o condiviso (atteso 0):', parentObsoleto.recordset[0].n);

    const docNullParentOk = await query(
        `
        SELECT COUNT(*) AS n FROM document_registry
        WHERE organization_id = @org_id AND doc_type <> 'folder'
          AND ISNULL(status, 'rilasciato') <> 'obsoleto' AND parent_id IS NULL
        `,
        { org_id: ORG_ID }
    );
    console.log('4. Documenti attivi senza cartella (parent_id NULL):', docNullParentOk.recordset[0].n);

    console.log('\n5. knowledge_chunks (indice AI) — documenti:');
    const kcDocs = await query(
        `
        SELECT
          CASE WHEN kc.company_id IS NULL THEN 'NULL' ELSE CAST(kc.company_id AS VARCHAR(12)) END AS company_key,
          COUNT(*) AS chunks,
          SUM(CASE WHEN kc.is_stale = 1 THEN 1 ELSE 0 END) AS stale
        FROM knowledge_chunks kc
        WHERE kc.organization_id = @org_id AND kc.entity_type = 'document'
        GROUP BY kc.company_id
        ORDER BY chunks DESC
        `,
        { org_id: ORG_ID }
    );
    for (const r of kcDocs.recordset) {
        console.log(`   company_id=${r.company_key}: chunks=${r.chunks}, stale=${r.stale}`);
    }

    const kcNullLeak = await query(
        `
        SELECT COUNT(*) AS n FROM knowledge_chunks kc
        WHERE kc.organization_id = @org_id AND kc.entity_type = 'document'
          AND kc.company_id IS NULL AND (kc.is_stale = 0 OR kc.is_stale IS NULL)
        `,
        { org_id: ORG_ID }
    );
    console.log('\n6. Chunk documento attivi con company_id NULL (visibili all\'AI con filtro azienda via OR NULL):', kcNullLeak.recordset[0].n);

    const kcMismatchDoc = await query(
        `
        SELECT COUNT(*) AS n
        FROM knowledge_chunks kc
        INNER JOIN document_registry dr ON dr.id = kc.entity_id AND kc.entity_type = 'document'
        WHERE kc.organization_id = @org_id
          AND kc.company_id IS NOT NULL AND dr.company_id IS NOT NULL
          AND kc.company_id <> dr.company_id
          AND (kc.is_stale = 0 OR kc.is_stale IS NULL)
        `,
        { org_id: ORG_ID }
    );
    console.log('7. Chunk company_id diverso dal documento sorgente (atteso 0):', kcMismatchDoc.recordset[0].n);

    const sampleNullChunks = await query(
        `
        SELECT TOP 5 kc.id, kc.entity_id, dr.title, dr.company_id AS doc_company
        FROM knowledge_chunks kc
        LEFT JOIN document_registry dr ON dr.id = kc.entity_id
        WHERE kc.organization_id = @org_id AND kc.entity_type = 'document'
          AND kc.company_id IS NULL AND (kc.is_stale = 0 OR kc.is_stale IS NULL)
        `,
        { org_id: ORG_ID }
    );
    if (sampleNullChunks.recordset.length) {
        console.log('\n   Campione chunk NULL (da rivalutare):');
        for (const r of sampleNullChunks.recordset) {
            console.log(`   chunk ${r.id} doc ${r.entity_id} "${r.title}" doc_co=${r.doc_company}`);
        }
    }

    console.log('\n8. Altri entity_type in knowledge_chunks (NC, audit, ...):');
    const kcOther = await query(
        `
        SELECT entity_type,
          SUM(CASE WHEN company_id IS NULL THEN 1 ELSE 0 END) AS null_co,
          COUNT(*) AS total
        FROM knowledge_chunks
        WHERE organization_id = @org_id AND (is_stale = 0 OR is_stale IS NULL)
        GROUP BY entity_type
        ORDER BY total DESC
        `,
        { org_id: ORG_ID }
    );
    for (const r of kcOther.recordset) {
        console.log(`   ${r.entity_type}: total=${r.total}, company_id NULL=${r.null_co}`);
    }

    const ok =
        parentMismatch.recordset[0].n === 0 &&
        parentObsoleto.recordset[0].n === 0 &&
        kcMismatchDoc.recordset[0].n === 0;

    console.log('\n=== Esito documenti+AI:', ok ? 'COERENTE' : 'REVIEW ===');
    if (kcNullLeak.recordset[0].n > 0) {
        console.log('NOTA: chunk documento con company_id NULL entrano nel contesto AI quando si filtra per azienda (OR NULL nel codice).');
    }
    process.exit(ok ? 0 : 1);
}

main().catch((e) => {
    console.error(e.message);
    process.exit(1);
});

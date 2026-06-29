process.chdir('/var/www/sgq-backend-test');
require('/var/www/sgq-backend-test/node_modules/dotenv').config({ path: '/var/www/sgq-backend-test/.env' });
const db = require('/var/www/sgq-backend-test/src/config/database');
const { indexAllEntities, INDEXABLE_ENTITIES } = require('/var/www/sgq-backend-test/src/services/knowledgeIndexer.service');

(async () => {
  try {
    // Verifica quante note ci sono nel DB test
    const notesCount = await db.query(
      "SELECT COUNT(*) AS cnt FROM audit_responses WHERE notes IS NOT NULL AND LEN(notes) > 20"
    );
    console.log('Note audit significative nel DB test: ' + notesCount.recordset[0].cnt);

    // Verifica che l'entity sia registrata
    const entity = INDEXABLE_ENTITIES.find(e => e.entity_type === 'audit_response_note');
    console.log('Entity audit_response_note registrata: ' + (entity ? 'SI' : 'NO'));

    // Esegui query SQL dell'entity per org 1001 (test)
    const testResult = await db.query(entity.sql, { orgId: 1001 });
    const rows = testResult.recordset || [];
    console.log('Righe trovate per org 1001: ' + rows.length);
    if (rows.length > 0) {
      console.log('Esempio buildText: ' + entity.buildText(rows[0]).substring(0, 200));
    }

    // Esegui indexAllEntities per org 1001 (senza embedding - la quota potrebbe essere esaurita)
    console.log('\nAvvio indicizzazione org 1001...');
    const totalChunks = await indexAllEntities(1001);
    console.log('INDEXING_DONE: ' + totalChunks + ' chunk totali per org 1001');

    // Verifica i chunk audit_response_note creati
    const chunkCount = await db.query(
      "SELECT COUNT(*) AS cnt FROM knowledge_chunks WHERE entity_type = 'audit_response_note' AND organization_id = 1001"
    );
    console.log('Chunk audit_response_note creati: ' + chunkCount.recordset[0].cnt);
  } catch (e) {
    console.error('ERROR: ' + e.message);
    console.error(e.stack);
  }
  process.exit(0);
})();

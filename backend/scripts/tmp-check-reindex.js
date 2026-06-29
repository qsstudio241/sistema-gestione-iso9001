const db = require('/var/www/sgq-backend/src/config/database');
(async () => {
  try {
    const r1 = await db.query('SELECT entity_type, COUNT(*) AS cnt FROM knowledge_chunks GROUP BY entity_type ORDER BY cnt DESC');
    console.log('=== CHUNK PER ENTITY_TYPE ===');
    r1.recordset.forEach(r => console.log(r.entity_type + ': ' + r.cnt));

    const r2 = await db.query("SELECT COUNT(*) AS total FROM knowledge_chunks WHERE entity_type = 'document_content'");
    console.log('=== DOCUMENT_CONTENT TOTALE: ' + r2.recordset[0].total);

    const r3 = await db.query("SELECT COUNT(*) AS with_emb FROM knowledge_chunks WHERE entity_type = 'document_content' AND embedding IS NOT NULL");
    console.log('=== DOCUMENT_CONTENT CON EMBEDDING: ' + r3.recordset[0].with_emb);

    const r4 = await db.query("SELECT TOP 5 entity_id, LEFT(chunk_text, 200) AS preview FROM knowledge_chunks WHERE entity_type = 'document_content' AND embedding IS NOT NULL ORDER BY last_indexed_at DESC");
    console.log('=== ULTIMI 5 CHUNK DOCUMENT_CONTENT ===');
    r4.recordset.forEach(r => console.log('DocID=' + r.entity_id + ' | ' + r.preview));

    const r5 = await db.query("SELECT TOP 1 last_indexed_at FROM knowledge_chunks WHERE entity_type = 'document_content' ORDER BY last_indexed_at DESC");
    if (r5.recordset.length > 0) console.log('=== ULTIMA INDICIZZAZIONE: ' + r5.recordset[0].last_indexed_at);
    else console.log('=== NESSUN CHUNK document_content TROVATO');
  } catch(e) { console.error('ERR:', e.message); }
  process.exit(0);
})();

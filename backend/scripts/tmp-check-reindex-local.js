const sql = require('mssql');
const path = require('path');
const dbConfig = require(path.join(__dirname, '..', 'config', 'database.json'));
const cfg = dbConfig.production;

(async () => {
  let pool;
  try {
    pool = await sql.connect({
      server: cfg.server,
      port: cfg.port,
      database: cfg.database,
      user: cfg.user,
      password: cfg.password,
      options: cfg.options,
    });

    const r1 = await pool.request().query('SELECT entity_type, COUNT(*) AS cnt FROM knowledge_chunks GROUP BY entity_type ORDER BY cnt DESC');
    console.log('=== CHUNK PER ENTITY_TYPE ===');
    r1.recordset.forEach(r => console.log(r.entity_type + ': ' + r.cnt));

    const r2 = await pool.request().query("SELECT COUNT(*) AS total FROM knowledge_chunks WHERE entity_type = 'document_content'");
    console.log('\n=== DOCUMENT_CONTENT TOTALE: ' + r2.recordset[0].total);

    const r3 = await pool.request().query("SELECT COUNT(*) AS with_emb FROM knowledge_chunks WHERE entity_type = 'document_content' AND embedding IS NOT NULL");
    console.log('=== DOCUMENT_CONTENT CON EMBEDDING: ' + r3.recordset[0].with_emb);

    const r4 = await pool.request().query("SELECT TOP 5 entity_id, LEFT(chunk_text, 200) AS preview FROM knowledge_chunks WHERE entity_type = 'document_content' AND embedding IS NOT NULL ORDER BY last_indexed_at DESC");
    console.log('\n=== ULTIMI 5 CHUNK DOCUMENT_CONTENT ===');
    r4.recordset.forEach(r => console.log('DocID=' + r.entity_id + ' | ' + r.preview));

    const r5 = await pool.request().query("SELECT TOP 1 last_indexed_at FROM knowledge_chunks WHERE entity_type = 'document_content' ORDER BY last_indexed_at DESC");
    if (r5.recordset.length > 0) console.log('\n=== ULTIMA INDICIZZAZIONE: ' + r5.recordset[0].last_indexed_at);
    else console.log('\n=== NESSUN CHUNK document_content TROVATO');

    const r6 = await pool.request().query("SELECT COUNT(*) AS no_emb FROM knowledge_chunks WHERE entity_type = 'document_content' AND embedding IS NULL");
    console.log('=== DOCUMENT_CONTENT SENZA EMBEDDING: ' + r6.recordset[0].no_emb);
  } catch(e) { console.error('ERR:', e.message); }
  finally { if (pool) await pool.close(); }
  process.exit(0);
})();

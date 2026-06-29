const sql = require('mssql');
const path = require('path');
const dbConfig = require(path.join(__dirname, '..', 'config', 'database.json'));
const cfg = dbConfig.production;

(async () => {
  let pool;
  try {
    pool = await sql.connect({
      server: cfg.server, port: cfg.port, database: cfg.database,
      user: cfg.user, password: cfg.password, options: cfg.options,
    });

    const r1 = await pool.request().query(`
      SELECT entity_type,
             COUNT(*) AS total,
             SUM(CASE WHEN embedding IS NOT NULL THEN 1 ELSE 0 END) AS with_emb,
             SUM(CASE WHEN embedding IS NULL THEN 1 ELSE 0 END) AS no_emb
      FROM knowledge_chunks
      GROUP BY entity_type
      ORDER BY total DESC
    `);
    console.log('=== STATO EMBEDDING PER ENTITY_TYPE ===');
    r1.recordset.forEach(r => console.log(
      r.entity_type.padEnd(25) + ' total=' + String(r.total).padStart(5) +
      ' emb=' + String(r.with_emb).padStart(5) + ' no_emb=' + String(r.no_emb).padStart(5)
    ));

    // Mostra i document_content con embedding per capire se possiamo testare
    const r2 = await pool.request().query(`
      SELECT TOP 3 kc.entity_id, LEFT(kc.chunk_text, 150) AS preview,
             dr.title AS doc_title
      FROM knowledge_chunks kc
      LEFT JOIN document_registry dr ON kc.entity_id = dr.id
      WHERE kc.entity_type = 'document_content' AND kc.embedding IS NOT NULL
      ORDER BY kc.last_indexed_at DESC
    `);
    console.log('\n=== DOCUMENT_CONTENT CON EMBEDDING (campione) ===');
    r2.recordset.forEach(r => {
      console.log('DocID=' + r.entity_id + ' | Doc: ' + (r.doc_title || '?'));
      console.log('  -> ' + r.preview);
    });
  } catch(e) { console.error('ERR:', e.message); }
  finally { if (pool) await pool.close(); }
  process.exit(0);
})();

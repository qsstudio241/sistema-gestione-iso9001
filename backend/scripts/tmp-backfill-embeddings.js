process.chdir('/var/www/sgq-backend');
require('/var/www/sgq-backend/node_modules/dotenv').config({ path: '/var/www/sgq-backend/.env' });
const db = require('/var/www/sgq-backend/src/config/database');
const { embed } = require('/var/www/sgq-backend/src/services/aiProviderAdapter');

const BATCH_SIZE = 20;
const DELAY_MS = 1500;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => {
  try {
    const countRes = await db.query(
      "SELECT COUNT(*) AS cnt FROM knowledge_chunks WHERE embedding IS NULL AND chunk_text IS NOT NULL AND LEN(chunk_text) > 10"
    );
    const total = countRes.recordset[0].cnt;
    console.log('Chunk senza embedding da processare: ' + total);
    if (total === 0) { console.log('Nulla da fare.'); process.exit(0); }

    let done = 0;
    let errors = 0;
    while (true) {
      const batch = await db.query(
        `SELECT TOP ${BATCH_SIZE} id, chunk_text FROM knowledge_chunks WHERE embedding IS NULL AND chunk_text IS NOT NULL AND LEN(chunk_text) > 10 ORDER BY id`
      );
      const rows = batch.recordset || [];
      if (rows.length === 0) break;

      let vectors;
      try {
        vectors = await embed(rows.map(r => r.chunk_text));
      } catch (e) {
        console.error('Embed error: ' + e.message);
        errors++;
        if (errors > 5) { console.error('Troppi errori, esco.'); break; }
        await sleep(10000);
        continue;
      }

      for (let i = 0; i < rows.length; i++) {
        const vec = vectors[i];
        if (!vec) continue;
        await db.query(
          'UPDATE knowledge_chunks SET embedding = @emb WHERE id = @id',
          { emb: JSON.stringify(vec), id: rows[i].id }
        );
      }

      done += rows.length;
      console.log('Processed ' + done + '/' + total + ' (' + Math.round(done*100/total) + '%)');
      await sleep(DELAY_MS);
    }

    console.log('BACKFILL_DONE: ' + done + ' chunk aggiornati, ' + errors + ' errori');
  } catch (e) {
    console.error('FATAL: ' + e.message);
  }
  process.exit(0);
})();

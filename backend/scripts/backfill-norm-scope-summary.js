/**
 * Backfill scope_summary per norme già presenti in document_registry.
 *
 * Per ogni norma senza scope_summary in type_specific_data:
 *   A) Se ha testo estratto in norm_document_sources ? AI genera scope_summary dal testo
 *   B) Se non ha testo ? AI genera scope_summary da codice + titolo (fallback)
 *
 * Uso:
 *   node scripts/backfill-norm-scope-summary.js --dry-run   # solo mostra cosa farebbe
 *   node scripts/backfill-norm-scope-summary.js             # esegue l'aggiornamento
 *
 * Rieseguibile: salta le norme che hanno già scope_summary.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { query, getPool, closePool } = require('../src/config/database');
const { chat, getActiveProvider } = require('../src/services/aiProviderAdapter');
const { parseNormTypeSpecificData } = require('../src/services/documentRegistryNorm.service');

const dryRun = process.argv.includes('--dry-run');

function stripCodeFences(raw) {
  let s = String(raw || '').trim();
  if (s.startsWith('```')) s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '');
  return s.trim();
}

/**
 * Chiede all'AI di generare scope_summary dal testo estratto del PDF.
 */
async function generateFromText(standardCode, normTitle, extractedText) {
  const snippet = (extractedText || '').substring(0, 4000);
  const messages = [
    {
      role: 'system',
      content: `Sei un esperto di normazione tecnica (ISO, UNI, CEN, IEC).
Analizza il testo estratto da un documento normativo e scrivi una descrizione dell'ambito di applicazione.

Rispondi SOLO con JSON valido:
{
  "scope_summary": "descrizione dell'ambito di applicazione in 2-4 frasi, nella lingua originale del documento"
}

Regole:
- Estrai preferibilmente dal campo "Scopo" / "Scope" / "Campo di applicazione" del documento
- Se non disponibile, sintetizza in 2-4 frasi di cosa tratta la norma
- Non inventare dati: basa tutto esclusivamente sul testo fornito
- Se non puoi determinare l'ambito, restituisci null per scope_summary`,
    },
    {
      role: 'user',
      content: `Norma: ${standardCode || 'N/D'} — ${normTitle || 'N/D'}

Testo estratto (prime 4000 caratteri):
---
${snippet}
---

Genera scope_summary in JSON.`,
    },
  ];

  const result = await chat(messages, { temperature: 0.1, responseFormat: 'json' });
  const cleaned = stripCodeFences(result.content);
  const parsed = JSON.parse(cleaned);
  return parsed.scope_summary ? String(parsed.scope_summary).trim().substring(0, 500) : null;
}

/**
 * Chiede all'AI di generare scope_summary solo da codice + titolo (nessun testo PDF).
 */
async function generateFromCodeOnly(standardCode, normTitle, issuingBody) {
  const messages = [
    {
      role: 'system',
      content: `Sei un esperto di normazione tecnica (ISO, UNI, CEN, IEC).
Descrivi brevemente l'ambito di applicazione di una norma tecnica basandoti sul suo codice e titolo.

Rispondi SOLO con JSON valido:
{
  "scope_summary": "descrizione dell'ambito di applicazione in 2-3 frasi"
}

Regole:
- Descrivi cosa copre la norma, a chi si applica e quale aspetto regola
- Usa italiano se la norma è italiana (UNI), inglese se è internazionale (ISO/IEC)
- Sii accurato: se non conosci la norma, indica genericamente cosa implica il titolo
- Non inventare dettagli specifici non deducibili dal codice e dal titolo`,
    },
    {
      role: 'user',
      content: `Codice: ${standardCode || 'N/D'}
Titolo: ${normTitle || 'N/D'}
Ente: ${issuingBody || 'N/D'}

Genera scope_summary in JSON.`,
    },
  ];

  const result = await chat(messages, { temperature: 0.2, responseFormat: 'json' });
  const cleaned = stripCodeFences(result.content);
  const parsed = JSON.parse(cleaned);
  return parsed.scope_summary ? String(parsed.scope_summary).trim().substring(0, 500) : null;
}

async function main() {
  await getPool();
  console.log(`=== Backfill scope_summary norme${dryRun ? ' (DRY-RUN)' : ''} ===\n`);

  const provider = getActiveProvider();
  if (!provider) {
    console.error('ERRORE: Nessun provider AI configurato (GEMINI_API_KEY, AZURE_OPENAI_*, OPENAI_API_KEY).');
    await closePool();
    process.exit(1);
  }
  console.log(`Provider AI attivo: ${provider}`);

  // Carica tutte le norme con relativi testi estratti (LEFT JOIN su norm_document_sources)
  const normsResult = await query(`
    SELECT
      dr.id,
      dr.title,
      dr.organization_id,
      dr.type_specific_data,
      nds.standard_code  AS nds_standard_code,
      nds.norm_title     AS nds_norm_title,
      nds.issuing_body   AS nds_issuing_body,
      nds.extracted_text AS extracted_text,
      nds.text_quality   AS text_quality
    FROM document_registry dr
    LEFT JOIN norm_document_sources nds ON nds.document_id = dr.id
    WHERE dr.doc_type = 'norma'
      AND dr.status != 'obsoleto'
    ORDER BY dr.id
  `);

  const allNorms = normsResult.recordset;
  console.log(`Totale norme trovate: ${allNorms.length}`);

  const toProcess = [];
  const alreadyHave = [];

  for (const row of allNorms) {
    const tsd = parseNormTypeSpecificData(row.type_specific_data);
    if (tsd.scope_summary && String(tsd.scope_summary).trim()) {
      alreadyHave.push(row.id);
    } else {
      toProcess.push({ ...row, tsd });
    }
  }

  console.log(`  Già con scope_summary: ${alreadyHave.length}`);
  console.log(`  Da aggiornare:         ${toProcess.length}\n`);

  if (toProcess.length === 0) {
    console.log('Nessuna norma da aggiornare. Uscita.');
    await closePool();
    return;
  }

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const norm of toProcess) {
    const standardCode = norm.tsd.standard_code || norm.nds_standard_code || null;
    const normTitle    = norm.tsd.norm_title    || norm.nds_norm_title    || norm.title || null;
    const issuingBody  = norm.tsd.issuing_body  || norm.nds_issuing_body  || null;
    const hasText      = norm.extracted_text && norm.extracted_text.length > 200;

    console.log(`[#${norm.id}] "${norm.title}" — ${standardCode || '(no code)'} — testo: ${hasText ? `${norm.extracted_text.length} char (${norm.text_quality})` : 'assente'}`);

    if (dryRun) {
      console.log(`  ? DRY-RUN: salterebbe, genererebbe via ${hasText ? 'testo PDF' : 'codice/titolo'}`);
      continue;
    }

    try {
      let scopeSummary = null;

      if (hasText) {
        scopeSummary = await generateFromText(standardCode, normTitle, norm.extracted_text);
        console.log(`  ? [AI dal testo] ${scopeSummary ? scopeSummary.substring(0, 100) + '…' : 'null (AI non ha risposto)'}`);
      } else {
        scopeSummary = await generateFromCodeOnly(standardCode, normTitle, issuingBody);
        console.log(`  ? [AI da codice] ${scopeSummary ? scopeSummary.substring(0, 100) + '…' : 'null (AI non ha risposto)'}`);
      }

      if (!scopeSummary) {
        console.log(`  ? SKIP: AI non ha generato scope_summary`);
        skipped++;
        continue;
      }

      // Merge idempotente: aggiunge scope_summary senza sovrascrivere altri campi
      const updatedTsd = { ...norm.tsd, scope_summary: scopeSummary };
      // Assicura che standard_code sia presente per serializzare correttamente
      if (!updatedTsd.standard_code && standardCode) {
        updatedTsd.standard_code = standardCode;
      }

      await query(
        `UPDATE document_registry
         SET type_specific_data = @tsd, updated_at = GETDATE()
         WHERE id = @id`,
        { tsd: JSON.stringify(updatedTsd), id: norm.id }
      );

      updated++;
      console.log(`  ? AGGIORNATO`);

      // Piccola pausa per non saturare l'API
      await new Promise(r => setTimeout(r, 500));

    } catch (err) {
      console.error(`  ? ERRORE: ${err.message}`);
      errors++;
    }
  }

  console.log('\n--- Riepilogo ---');
  if (dryRun) {
    console.log(`DRY-RUN: ${toProcess.length} norme da aggiornare (nessuna modifica applicata)`);
  } else {
    console.log(`Aggiornate: ${updated}`);
    console.log(`Saltate (AI null): ${skipped}`);
    console.log(`Errori: ${errors}`);
    console.log(`Già avevano scope_summary: ${alreadyHave.length}`);
  }

  await closePool();
}

main().catch(async (e) => {
  console.error('ERRORE FATALE:', e.message);
  try { await closePool(); } catch (_) {}
  process.exit(1);
});

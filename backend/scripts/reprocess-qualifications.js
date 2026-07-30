/**
 * reprocess-qualifications.js — CLI di rielaborazione/backfill su qualifiche
 * già presenti in DB.
 *
 * Motivazione (richiesta committente 28/07/2026): ogni volta che aggiungiamo un
 * nuovo campo all'estrazione AI (es. transfer_mode) i patentini già ingestiti
 * PRIMA di quella modifica restano con il campo NULL. Il PDF originale è però
 * conservato su disco (certificate_file_url, mai cancellato dopo il commit —
 * vedi ingestStaging.service.js) quindi si può rilanciare l'estrazione AI sullo
 * stesso file, SENZA richiedere all'utente di ricaricarlo.
 *
 * Dalla sessione 28/07/2026 la logica vera e propria (selezione candidati,
 * conteggio, esecuzione) vive in `../src/services/qualificationReprocess.service.js`
 * — riusata anche dall'endpoint superadmin `GET/POST /admin/reprocess-tasks`
 * (`reprocessTasks.controller.js`), così il pannello "Rielaborazioni
 * disponibili" della dashboard superadmin può lanciare lo stesso identico
 * codice di questo script, senza duplicazione. Questo file resta solo come
 * wrapper CLI (utile per lanci manuali via SSH/VPS senza passare dalla UI).
 *
 * Generico e riusabile: per aggiungere un nuovo campo rielaborabile, basta
 * aggiungere una voce a `../src/data/reprocessableFields.js` (registro
 * centralizzato) — nessuno script dedicato per campo.
 *
 * Uso (da backend/, con DB_* in env o .ssh-deploy.local.ps1 in locale, oppure
 * deployato in /var/www/sgq-backend/scripts/ ed eseguito lì per accedere ai
 * file caricati su quel filesystem):
 *   node scripts/reprocess-qualifications.js --field=transfer_mode --dry-run
 *   node scripts/reprocess-qualifications.js --field=transfer_mode
 *   node scripts/reprocess-qualifications.js --field=transfer_mode --org-id=1001 --limit=5
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { getPool, closePool } = require('../src/config/database');
const { REPROCESSABLE_FIELD_REGISTRY } = require('../src/data/reprocessableFields');
const {
    selectReprocessCandidates,
    runReprocessForField,
    guessDocType,
    resolveCertificateFilePath,
} = require('../src/services/qualificationReprocess.service');

// Alias storico: FIELD_CONFIGS === registro centralizzato (stessa forma
// {qualTypeLike, processWhitelist} richiesta da selectReprocessCandidates).
const FIELD_CONFIGS = REPROCESSABLE_FIELD_REGISTRY;

function parseArgs(argv) {
    const out = { field: null, dryRun: false, limit: null, orgId: null };
    for (const arg of argv) {
        if (arg === '--dry-run') out.dryRun = true;
        else if (arg.startsWith('--field=')) out.field = arg.slice('--field='.length).trim();
        else if (arg.startsWith('--limit=')) out.limit = parseInt(arg.slice('--limit='.length), 10);
        else if (arg.startsWith('--org-id=')) out.orgId = parseInt(arg.slice('--org-id='.length), 10);
    }
    return out;
}

async function main() {
    const { field, dryRun, limit, orgId } = parseArgs(process.argv.slice(2));
    if (!field) {
        console.error('Uso: node scripts/reprocess-qualifications.js --field=<nome_campo> [--dry-run] [--limit=N] [--org-id=N]');
        console.error(`Campi disponibili: ${Object.keys(FIELD_CONFIGS).join(', ')}`);
        process.exit(1);
    }
    if (!FIELD_CONFIGS[field]) {
        console.error(`Campo non configurato: ${field}. Disponibili: ${Object.keys(FIELD_CONFIGS).join(', ')}`);
        process.exit(1);
    }

    await getPool();
    console.log(`=== Rielaborazione campo "${field}"${dryRun ? ' (DRY-RUN, nessuna scrittura)' : ''} ===`);

    const summary = await runReprocessForField(field, {
        orgId,
        limit: limit || Infinity, // CLI: nessun cap implicito (a differenza dell'endpoint HTTP)
        dryRun,
    });

    console.log(`Candidati trovati (${field} NULL + pertinenti + con certificato): ${summary.candidatesFound}`);
    console.log('\n--- Riepilogo ---');
    console.log(`Candidati esaminati:        ${summary.candidatesProcessed}`);
    console.log(`Proposte create in coda:    ${summary.proposalsCreated}`);
    console.log(`Già in coda (dedup):        ${summary.skippedAlreadyProposed}`);
    console.log(`File non trovato su disco:  ${summary.skippedNoFile}`);
    console.log(`Nessun valore estratto:     ${summary.skippedNoValueExtracted}`);
    console.log(`Errori:                     ${summary.errors}`);
    summary.errorDetails.forEach((msg) => console.log(`  [ERRORE] ${msg}`));
    if (dryRun) console.log('\n(DRY-RUN: nessuna proposta scritta — rilanciare senza --dry-run per generarle davvero)');

    await closePool();
}

module.exports = { selectReprocessCandidates, guessDocType, resolveCertificateFilePath, FIELD_CONFIGS };

if (require.main === module) {
    main().catch(async (e) => {
        console.error('ERRORE FATALE:', e.message);
        try { await closePool(); } catch (_) {}
        process.exit(1);
    });
}

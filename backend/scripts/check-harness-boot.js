#!/usr/bin/env node
'use strict';

/**
 * Dieta harness: peso avvio + path bussola + scenario Deputy company_profile.
 * Exit 1 se la bussola ha path morti, se AGENTS.md obbliga GUIDA intera,
 * o se lo scenario non centra i file del modulo.
 *
 *   node backend/scripts/check-harness-boot.js
 *
 * Logica pura esportata per test di mutazione (check-harness-boot.test.js):
 * ogni funzione qui sotto non tocca il filesystem — prende testo, ritorna errori.
 * Verifica che il checker INTERCETTI una rottura, non solo che passi sul repo sano.
 */

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');
const human = process.argv.includes('--human') || !process.argv.includes('--quiet');

/** Peso avvio OBBLIGATORIO prima della dieta (misura 13/08/2026): AGENTS+CONTEXT+roadmap intera+GUIDA */
const BASELINE_MANDATORY_BYTES = 5380 + 18697 + 87789 + 336867;
const TARGET_MANDATORY_BYTES = 50 * 1024;

const ALWAYS_APPLY_RULES = [
  '.cursor/rules/sgq-operating-memory.mdc',
  '.cursor/rules/sgq-git-autonomy.mdc',
  '.cursor/rules/sgq-encoding-quality.mdc',
  '.cursor/rules/sgq-cloud-agent-env.mdc',
];

const SCENARIOS = [
  {
    id: 'company_profile',
    brief: 'docs/agent-tasks/DEPUTYTASK.md',
    compassRe: /profilo azienda|company_profile/i,
    mustOpen: [
      'docs/adr/ADR-018-company-profile-conformita-legislativa.md',
      'docs/specs/COMPANY_PROFILE_CAMPI_E_TEMPLATE_EXCEL.md',
      'backend/src/controllers/company.controller.js',
    ],
    mustNotBeFirst: ['docs/GUIDA_CONSOLIDATA.md'],
  },
];

// ---------------------------------------------------------------------------
// Logica pura (nessun fs) — testata da check-harness-boot.test.js
// ---------------------------------------------------------------------------

function extractCompass(contextMd) {
  const begin = contextMd.indexOf('<!-- MODULE_COMPASS_BEGIN -->');
  const end = contextMd.indexOf('<!-- MODULE_COMPASS_END -->');
  if (begin < 0 || end < 0 || end <= begin) {
    throw new Error('Marcatori MODULE_COMPASS_BEGIN/END mancanti in PROJECT_CONTEXT.md');
  }
  return contextMd.slice(begin, end);
}

function parseCompassPaths(compassBlock) {
  const paths = [];
  const re = /`([^`]+)`/g;
  let m;
  while ((m = re.exec(compassBlock))) {
    const p = m[1].trim();
    if (!p) continue;
    if (!/[\\/]/.test(p) && !/\.(js|jsx|md|sql|json|sh|ps1|css)$/i.test(p)) continue;
    paths.push(p);
  }
  return [...new Set(paths)];
}

function parseCompassRows(compassBlock) {
  const rows = [];
  for (const line of compassBlock.split(/\r?\n/)) {
    if (!line.startsWith('|')) continue;
    if (/^\|\s*-+\s*\|/.test(line)) continue;
    if (/Se lavori su/.test(line)) continue;
    const cells = line.split('|').map((c) => c.trim()).filter(Boolean);
    if (cells.length < 2) continue;
    rows.push({ topic: cells[0], files: cells[1] });
  }
  return rows;
}

/** @param {string} text intero contenuto di PROJECT_ROADMAP.md */
function roadmapStatoSliceFromText(text) {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((l) => /^## Stato attuale e priorità/.test(l));
  if (start < 0) throw new Error('Sezione Stato attuale non trovata in PROJECT_ROADMAP.md');
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^## /.test(lines[i]) && !/^## Stato attuale/.test(lines[i])) {
      end = i;
      break;
    }
    if (/^<details>/.test(lines[i])) {
      end = i;
      break;
    }
  }
  const slice = lines.slice(0, end).join('\n');
  return { text: slice, lines: end, bytes: Buffer.byteLength(slice, 'utf8') };
}

function checkAgentsDiet(agentsMd) {
  const avvioMatch = agentsMd.match(/## Avvio sessione[\s\S]*?(?=\n## )/);
  if (!avvioMatch) throw new Error('Sezione Avvio sessione mancante in AGENTS.md');
  const avvio = avvioMatch[0];
  const errors = [];
  if (!/solo se/i.test(avvio) || !/GUIDA_CONSOLIDATA/.test(avvio)) {
    errors.push('AGENTS.md avvio deve citare GUIDA_CONSOLIDATA con condizione «solo se»');
  }
  const numbered = avvio.split(/\r?\n/).filter((l) => /^\d+\./.test(l.trim()));
  for (const line of numbered) {
    if (/GUIDA_CONSOLIDATA/.test(line) && !/solo se/i.test(line)) {
      errors.push(`Passo avvio obbliga GUIDA senza «solo se»: ${line.trim()}`);
    }
    if (/PROJECT_ROADMAP\.md/.test(line)) {
      if (!/solo/i.test(line)) {
        errors.push(`Passo avvio legge roadmap intera senza «solo»: ${line.trim()}`);
      }
      // Lezione 13/08/2026 (test empirico su sub-agente): "solo la sezione" senza
      // indicazione meccanica non basta — un agente reale ha letto il file intero
      // (927 righe) comunque. Serve l'istruzione esplicita sullo strumento (limit/offset).
      if (!/\blimit\b/i.test(line)) {
        errors.push(
          `Passo avvio roadmap non specifica "limit" per lo strumento Read (regressione nota 13/08/2026): ${line.trim()}`
        );
      }
    }
  }
  if (/leggi `docs\/GUIDA_CONSOLIDATA\.md`/i.test(avvio) && !/solo se/i.test(avvio)) {
    errors.push('AGENTS.md avvio richiede ancora GUIDA per intero');
  }
  return errors;
}

/** @param {string} raw contenuto di sgq-self-learning.mdc */
function checkSelfLearningNotAlwaysOn(raw) {
  if (/alwaysApply:\s*true/.test(raw)) {
    return ['sgq-self-learning.mdc è ancora alwaysApply: true — deve essere false (solo chiusura)'];
  }
  return [];
}

/**
 * @param {string[]} compassPaths
 * @param {(p: string) => boolean} existsFn
 */
function checkCompassPathsExist(compassPaths, existsFn) {
  const errors = [];
  if (compassPaths.length < 10) {
    errors.push(`Bussola troppo corta (${compassPaths.length} path) — attesi almeno 10`);
  }
  if (compassPaths.length > 80) {
    errors.push(`Bussola troppo lunga (${compassPaths.length} path) — sta diventando un inventario`);
  }
  const missing = compassPaths.filter((p) => !existsFn(p));
  if (missing.length) {
    errors.push(`Path bussola inesistenti:\n  - ${missing.join('\n  - ')}`);
  }
  return errors;
}

/**
 * @param {object} scenario
 * @param {{topic: string, files: string}[]} rows
 * @param {string} briefText
 */
function runScenarioPure(scenario, rows, briefText) {
  const errors = [];
  if (briefText == null) {
    errors.push(`Brief mancante: ${scenario.brief}`);
    return { errors, firstFiles: [] };
  }
  if (!/company_profile|ADR-018|profilo azienda/i.test(briefText)) {
    errors.push(`Scenario ${scenario.id}: ${scenario.brief} non parla più di company_profile/ADR-018`);
  }
  const row = rows.find((r) => scenario.compassRe.test(r.topic) || scenario.compassRe.test(r.files));
  if (!row) {
    errors.push(`Scenario ${scenario.id}: nessuna riga bussola per ${scenario.compassRe}`);
    return { errors, firstFiles: [] };
  }
  for (const need of scenario.mustOpen) {
    if (!row.files.includes(need)) {
      errors.push(`Scenario ${scenario.id}: la bussola non elenca ${need}`);
    }
  }
  const compassFiles = parseCompassPaths(row.files);
  const firstFiles = [scenario.brief, ...compassFiles].slice(0, 5);
  for (const forbidden of scenario.mustNotBeFirst) {
    if (firstFiles.includes(forbidden)) {
      errors.push(`Scenario ${scenario.id}: ${forbidden} compare nei primi 5 file`);
    }
  }
  const moduleHits = firstFiles.filter((f) => scenario.mustOpen.includes(f) || f === scenario.brief);
  if (moduleHits.length < 4) {
    errors.push(
      `Scenario ${scenario.id}: nei primi 5 attesi troppi file fuori modulo (${firstFiles.join(', ')})`
    );
  }
  return { errors, firstFiles, row: row.topic };
}

function checkMandatoryBytes(mandatoryBytes) {
  if (mandatoryBytes > TARGET_MANDATORY_BYTES) {
    return [`Peso avvio obbligatorio ${mandatoryBytes} B > tetto ${TARGET_MANDATORY_BYTES} B (50 KB)`];
  }
  return [];
}

// ---------------------------------------------------------------------------
// I/O reale (fs) — solo qui si legge il repo
// ---------------------------------------------------------------------------

function readRepoFile(relPath) {
  return fs.readFileSync(path.join(repoRoot, relPath), 'utf8');
}

function repoFileBytes(relPath) {
  return fs.statSync(path.join(repoRoot, relPath)).size;
}

function existsInRepo(relPath) {
  return fs.existsSync(path.join(repoRoot, relPath));
}

function main() {
  const errors = [];
  const contextMd = readRepoFile('PROJECT_CONTEXT.md');
  const agentsMd = readRepoFile('AGENTS.md');
  const compass = extractCompass(contextMd);
  const compassPaths = parseCompassPaths(compass);
  const rows = parseCompassRows(compass);

  errors.push(...checkCompassPathsExist(compassPaths, existsInRepo));
  errors.push(...checkAgentsDiet(agentsMd));
  errors.push(...checkSelfLearningNotAlwaysOn(readRepoFile('.cursor/rules/sgq-self-learning.mdc')));

  const stato = roadmapStatoSliceFromText(readRepoFile('docs/PROJECT_ROADMAP.md'));
  let mandatoryBytes = stato.bytes + repoFileBytes('AGENTS.md') + repoFileBytes('PROJECT_CONTEXT.md');
  errors.push(...checkMandatoryBytes(mandatoryBytes));

  let alwaysBytes = 0;
  for (const f of ALWAYS_APPLY_RULES) alwaysBytes += repoFileBytes(f);

  const scenarioReports = [];
  for (const sc of SCENARIOS) {
    const briefPath = path.join(repoRoot, sc.brief);
    const briefText = fs.existsSync(briefPath) ? fs.readFileSync(briefPath, 'utf8') : null;
    const r = runScenarioPure(sc, rows, briefText);
    errors.push(...r.errors);
    scenarioReports.push(r);
  }

  if (human) {
    const saved = BASELINE_MANDATORY_BYTES - mandatoryBytes;
    const pct = ((saved / BASELINE_MANDATORY_BYTES) * 100).toFixed(0);
    console.log('--- Harness boot ---');
    console.log(`Avvio obbligatorio: ${mandatoryBytes} B (AGENTS + PROJECT_CONTEXT + roadmap § Stato, ${stato.lines} righe)`);
    console.log(`Baseline pre-dieta: ${BASELINE_MANDATORY_BYTES} B (includeva GUIDA+roadmap intere)`);
    console.log(`Risparmio: ${saved} B (~${pct}%)`);
    console.log(`Regole alwaysApply kernel: ${alwaysBytes} B (${ALWAYS_APPLY_RULES.length} file)`);
    console.log(`Bussola: ${rows.length} moduli, ${compassPaths.length} path`);
    for (const r of scenarioReports) {
      console.log(`Scenario company_profile — riga: «${r.row || '?'}»`);
      console.log(`  Primi file attesi: ${(r.firstFiles || []).join(', ')}`);
    }
  }

  if (errors.length) {
    console.error('\nFAIL check-harness-boot:');
    for (const e of errors) console.error(`- ${e}`);
    process.exit(1);
  }
  if (human) console.log('\nOK check-harness-boot');
}

module.exports = {
  extractCompass,
  parseCompassPaths,
  parseCompassRows,
  roadmapStatoSliceFromText,
  checkAgentsDiet,
  checkSelfLearningNotAlwaysOn,
  checkCompassPathsExist,
  runScenarioPure,
  checkMandatoryBytes,
  TARGET_MANDATORY_BYTES,
  SCENARIOS,
};

if (require.main === module) {
  main();
}

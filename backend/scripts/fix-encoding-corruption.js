#!/usr/bin/env node
'use strict';

/**
 * Corregge danni da conversione CP1252 troppo aggressiva (` - ` al posto di accenti).
 * Uso: node backend/scripts/fix-encoding-corruption.js --write
 */

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');
const writeMode = process.argv.includes('--write');

const roots = [
  path.join(repoRoot, 'app', 'src'),
  path.join(repoRoot, 'backend', 'src', 'controllers'),
  path.join(repoRoot, 'backend', 'src', 'services'),
];

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (/\.(jsx?|css)$/i.test(entry.name)) files.push(full);
  }
  return files;
}

/** Ordine importante: pattern più lunghi prima */
const REPLACEMENTS = [
  [/Non conformit - /g, 'Non conformit\u00E0 '],
  [/non conformit - /gi, 'non conformit\u00E0 '],
  [/conformit - /gi, 'conformit\u00E0 '],
  [/qualit - /gi, 'qualit\u00E0 '],
  [/verit - /gi, 'verit\u00E0 '],
  [/Gi - /g, 'Gi\u00E0'],
  [/Et - /g, 'Et\u00E0'],
  [/gi - /gi, 'gi\u00E0 '],
  [/pi - /gi, 'pi\u00F9 '],
  [/pu - /gi, 'pu\u00F2 '],
  [/nodes  -  vuoto/g, 'nodes \u00E8 vuoto'],
  [/nodo  -  espanso/g, 'nodo \u00E8 espanso'],
  [/nodo NON  -  espanso/g, 'nodo NON \u00E8 espanso'],
  [/docId  -  null/g, 'docId \u00E8 null'],
  [/quando  -  selezionata/g, 'quando \u00E8 selezionata'],
  [/parent_id  -  considerato/g, 'parent_id \u00E8 considerato'],
  [/parent_id=0  -  considerato/g, 'parent_id=0 \u00E8 considerato'],
  [/valido NON  -  orfano/g, 'valido NON \u00E8 orfano'],
  [/is_harmonized  -  di tipo/g, 'is_harmonized \u00E8 di tipo'],
  [/selezionato  -  vuoto/g, 'selezionato \u00E8 vuoto'],
  [/`  -  \$\{/g, '` \u2014 ${'],
  [/Sistema Gestione Qualit - /g, 'Sistema Gestione Qualit\u00E0 '],
  [/Piano qualit - /g, 'Piano qualit\u00E0 '],
  [/Attrezzature e conformit - /g, 'Attrezzature e conformit\u00E0 '],
  [/Dichiarazione di conformit - /g, 'Dichiarazione di conformit\u00E0 '],
  [/Conformit -  \+ NBSP/g, 'Conformit\u00E0 + NBSP'],
  [/Conformit - /g, 'Conformit\u00E0 '],
  [/\(qualifiche,  - \)/g, '(qualifiche, ecc.)'],
  [/\/\/ \?\?\? Test/g, '// Test'],
  [/\?\?\?/g, ''],
];

const changed = [];

for (const root of roots) {
  for (const file of walk(root)) {
    const rel = path.relative(repoRoot, file).replace(/\\/g, '/');
    const before = fs.readFileSync(file, 'utf8');
    let after = before;
    for (const [re, rep] of REPLACEMENTS) {
      after = after.replace(re, rep);
    }
    if (after !== before) {
      changed.push(rel);
      if (writeMode) fs.writeFileSync(file, after, 'utf8');
    }
  }
}

console.log(JSON.stringify({ mode: writeMode ? 'write' : 'dry-run', changed: changed.length, files: changed }, null, 2));

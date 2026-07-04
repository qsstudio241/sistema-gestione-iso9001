#!/usr/bin/env node
'use strict';

/**
 * Verifica encoding UTF-8 e testi italiani corrotti in sorgenti app/backend.
 * Exit 1 se trova problemi. Uso CI: node backend/scripts/check-utf8-encoding.js
 * Riparazione batch: node backend/scripts/repair-utf8-encoding.js --write
 */

const fs = require('fs');
const path = require('path');
const { TextDecoder } = require('util');

const repoRoot = path.resolve(__dirname, '..', '..');
const decoder = new TextDecoder('utf-8', { fatal: true });
const human = process.argv.includes('--human');

const roots = [
  { root: path.join(repoRoot, 'app', 'src'), include: /\.(jsx|js|css)$/i, label: 'frontend' },
  { root: path.join(repoRoot, 'backend', 'src', 'controllers'), include: /\.js$/i, label: 'backend-controller' },
  { root: path.join(repoRoot, 'backend', 'src', 'services'), include: /\.js$/i, label: 'backend-service' },
];

const ignoredParts = new Set(['node_modules', 'dist']);

/** File che contengono intenzionalmente sequenze mojibake da correggere a runtime */
const MOJIBAKE_ALLOWLIST = new Set([
  'app/src/utils/textEncodingRepair.js',
]);

const patterns = [
  { name: 'U+FFFD replacement char', regex: /\uFFFD/ },
  {
    name: 'mojibake A-tilde/A-circumflex',
    regex: /[\u00C3\u00C2]/,
    allowLine: (line) => MOJIBAKE_ALLOWLIST.has(line._file)
      || /\.replace\s*\(/.test(line.text)
      || /latin1Utf8PairToChar|mojibake|Conformit/i.test(line.text),
  },
  { name: 'broken qualita', regex: /\b[Qq]ualit(?:\uFFFD|\?)(?!\\u)/ },
  { name: 'broken piu', regex: /\bpi\?(?=[\s'"(,;.\]])/i },
  { name: 'broken pagina', regex: /\bpagina\s+\?(?=\s)/i },
  { name: 'broken gia', regex: /\bgi\?(?=\s)/i },
  { name: 'broken estratti dash', regex: /estrattti\s+\?(?=\s)/i },
  { name: 'broken scartato dash', regex: /Scartato\s+\?(?=\s)/i },
];

function walk(directory, include, files = []) {
  if (!fs.existsSync(directory)) return files;

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (ignoredParts.has(entry.name)) continue;

    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, include, files);
    } else if (include.test(entry.name)) {
      files.push(fullPath);
    }
  }

  return files;
}

function lineAndColumn(text, index) {
  const before = text.slice(0, index);
  const lines = before.split(/\r\n|\r|\n/);
  return { line: lines.length, column: lines[lines.length - 1].length + 1 };
}

function contextLine(text, lineNumber) {
  return text.split(/\r\n|\r|\n/)[lineNumber - 1]?.trim() || '';
}

const results = [];
let scanned = 0;

for (const scope of roots) {
  for (const file of walk(scope.root, scope.include)) {
    scanned += 1;
    const buffer = fs.readFileSync(file);
    const relativePath = path.relative(repoRoot, file).replace(/\\/g, '/');

    if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
      results.push({ file: relativePath, scope: scope.label, issue: 'UTF-8 BOM', line: 1, column: 1, sample: '' });
    }

    let text;
    try {
      text = decoder.decode(buffer);
    } catch (error) {
      results.push({
        file: relativePath,
        scope: scope.label,
        issue: 'Invalid UTF-8 sequence',
        line: 1,
        column: 1,
        sample: error.message,
      });
      continue;
    }

    for (const pattern of patterns) {
      pattern.regex.lastIndex = 0;
      let match = pattern.regex.exec(text);
      while (match) {
        const position = lineAndColumn(text, match.index);
        const lineText = contextLine(text, position.line);
        const lineCtx = { text: lineText, _file: relativePath };
        if (!pattern.allowLine || !pattern.allowLine(lineCtx)) {
          results.push({
            file: relativePath,
            scope: scope.label,
            issue: pattern.name,
            line: position.line,
            column: position.column,
            sample: lineText,
          });
        }
        match = pattern.regex.exec(text);
      }
    }
  }
}

if (human) {
  if (results.length === 0) {
    console.log(`OK: ${scanned} file verificati, nessun problema encoding.`);
  } else {
    console.error(`FAIL: ${results.length} problemi encoding su ${scanned} file:\n`);
    for (const r of results) {
      console.error(`  [${r.issue}] ${r.file}:${r.line}:${r.column}`);
      if (r.sample) console.error(`    ${r.sample.slice(0, 120)}`);
    }
  }
} else {
  console.log(JSON.stringify({ scanned, issues: results.length, results }, null, 2));
}

if (results.length > 0) {
  process.exitCode = 1;
}

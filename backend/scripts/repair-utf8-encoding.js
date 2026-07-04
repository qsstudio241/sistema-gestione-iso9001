#!/usr/bin/env node
'use strict';

/**
 * Ripara sorgenti con byte Windows-1252 / Latin-1 non validi come UTF-8.
 * Uso: node backend/scripts/repair-utf8-encoding.js [--write]
 * Senza --write: dry-run (stampa file che verrebbero modificati).
 */

const fs = require('fs');
const path = require('path');
const { TextDecoder } = require('util');

const repoRoot = path.resolve(__dirname, '..', '..');
const decoder = new TextDecoder('utf-8', { fatal: true });
const writeMode = process.argv.includes('--write');

const roots = [
  { root: path.join(repoRoot, 'app', 'src'), include: /\.(jsx|js|css)$/i },
  { root: path.join(repoRoot, 'backend', 'src', 'controllers'), include: /\.js$/i },
  { root: path.join(repoRoot, 'backend', 'src', 'services'), include: /\.js$/i },
];

const ignoredParts = new Set(['node_modules', 'dist']);

/** Windows-1252 → Unicode (byte 0x80–0xFF) */
const CP1252 = (() => {
  const map = new Array(256);
  for (let i = 0; i < 256; i += 1) map[i] = i;
  const pairs = [
    [0x80, 0x20AC], [0x82, 0x201A], [0x83, 0x0192], [0x84, 0x201E], [0x85, 0x2026],
    [0x86, 0x2020], [0x87, 0x2021], [0x88, 0x02C6], [0x89, 0x2030], [0x8A, 0x0160],
    [0x8B, 0x2039], [0x8C, 0x0152], [0x8E, 0x017D], [0x91, 0x2018], [0x92, 0x2019],
    [0x93, 0x201C], [0x94, 0x201D], [0x95, 0x2022], [0x96, 0x2013], [0x97, 0x2014],
    [0x98, 0x02DC], [0x99, 0x2122], [0x9A, 0x0161], [0x9B, 0x203A], [0x9C, 0x0153],
    [0x9E, 0x017E], [0x9F, 0x0178],
  ];
  for (const [b, cp] of pairs) map[b] = cp;
  return map;
})();

function walk(directory, include, files = []) {
  if (!fs.existsSync(directory)) return files;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (ignoredParts.has(entry.name)) continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(fullPath, include, files);
    else if (include.test(entry.name)) files.push(fullPath);
  }
  return files;
}

function isValidUtf8(buffer) {
  try {
    decoder.decode(buffer);
    return true;
  } catch {
    return false;
  }
}

function decodeCp1252(buffer) {
  let out = '';
  for (let i = 0; i < buffer.length; i += 1) {
    const b = buffer[i];
    if (b < 0x80) out += String.fromCharCode(b);
    else if (b >= 0x80 && b <= 0x9F && CP1252[b] === b) {
      // Byte C1 non definito in CP1252: ometti (evita " - " spurii negli accenti)
    } else {
      out += String.fromCodePoint(CP1252[b]);
    }
  }
  return out;
}

function stripBom(text) {
  return text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;
}

function repairText(text) {
  let next = stripBom(text);
  next = next.replace(/\uFFFD/g, '');
  next = next.replace(/\bqualit\?\b/gi, (m) => (m[0] === 'Q' ? 'Qualit\u00E0' : 'qualit\u00E0'));
  next = next.replace(/\bpi\?(?=[\s'"(,;.\]])/gi, 'pi\u00F9');
  next = next.replace(/\bpagina\s+\?(?=\s)/gi, 'pagina \u00E8');
  return next;
}

function repairBuffer(buffer) {
  let text;
  if (isValidUtf8(buffer)) {
    text = buffer.toString('utf8');
  } else {
    text = decodeCp1252(buffer);
  }
  return repairText(text);
}

const changed = [];

for (const scope of roots) {
  for (const file of walk(scope.root, scope.include)) {
    const buffer = fs.readFileSync(file);
    const relative = path.relative(repoRoot, file).replace(/\\/g, '/');
    const hasBom = buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf;
    const valid = isValidUtf8(buffer);
    const repaired = repairBuffer(buffer);
    const current = valid ? stripBom(buffer.toString('utf8')) : null;
    const needsWrite = !valid || hasBom || (current !== null && repaired !== current);

    if (needsWrite) {
      changed.push({ file: relative, wasInvalid: !valid, hadBom: hasBom });
      if (writeMode) {
        fs.writeFileSync(file, repaired, 'utf8');
      }
    }
  }
}

console.log(JSON.stringify({
  mode: writeMode ? 'write' : 'dry-run',
  changed: changed.length,
  files: changed,
}, null, 2));

if (!writeMode && changed.length > 0) {
  console.error('\nEseguire con --write per applicare le correzioni.');
  process.exitCode = 0;
}

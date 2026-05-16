const fs = require('fs');
const path = require('path');
const { TextDecoder } = require('util');

const repoRoot = path.resolve(__dirname, '..', '..');
const decoder = new TextDecoder('utf-8', { fatal: true });

const roots = [
  { root: path.join(repoRoot, 'app', 'src'), include: /\.(jsx|js|css)$/i, label: 'frontend' },
  { root: path.join(repoRoot, 'backend', 'src', 'controllers'), include: /\.js$/i, label: 'backend-controller' },
  { root: path.join(repoRoot, 'backend', 'src', 'services'), include: /\.js$/i, label: 'backend-service' },
];

const ignoredParts = new Set(['node_modules', 'dist']);

const patterns = [
  { name: 'U+FFFD replacement char', regex: /\uFFFD/ },
  { name: 'mojibake A-tilde/A-circumflex', regex: /[\u00C3\u00C2]/ },
  { name: 'broken qualita', regex: /\b[Qq]ualit(?:\uFFFD|\\uFFFD|\?)/ },
  { name: 'broken piu', regex: /\bpi(?:\uFFFD|\\uFFFD|\?)/i },
  { name: 'broken pagina', regex: /\bpagina\s+(?:\uFFFD|\\uFFFD|\?)/i },
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
      results.push({ file: relativePath, scope: scope.label, issue: 'Invalid UTF-8 sequence', line: 1, column: 1, sample: error.message });
      continue;
    }

    for (const pattern of patterns) {
      pattern.regex.lastIndex = 0;
      const match = pattern.regex.exec(text);
      if (!match) continue;

      const position = lineAndColumn(text, match.index);
      results.push({
        file: relativePath,
        scope: scope.label,
        issue: pattern.name,
        line: position.line,
        column: position.column,
        sample: contextLine(text, position.line),
      });
    }
  }
}

console.log(JSON.stringify({ scanned, issues: results.length, results }, null, 2));

if (results.length > 0) {
  process.exitCode = 1;
}

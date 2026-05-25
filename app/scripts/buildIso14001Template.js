/**
 * Genera snippet ISO_14001_TEMPLATE da export JSON (VPS / migration 049).
 * Uso: node scripts/buildIso14001Template.js < export.json
 */
'use strict';
const fs = require('fs');

const raw = fs.readFileSync(0, 'utf8');
const start = raw.indexOf('{');
const data = JSON.parse(raw.slice(start));

function escJs(str) {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r?\n/g, ' ');
}

let out = `/**
 * Template ISO 14001:2015 — Audit SGA (clausole 4-10, 53 domande)
 * Fonte: DB produzione post-migration 049 + UNI EN ISO 14001:2015
 * questionId: allineati a checklist_questions (standard_id=2)
 */
export const ISO_14001_TEMPLATE = {
  standardId: 2,
  standardCode: "ISO_14001_2015",
  standardName: "ISO 14001:2015",
  sections: [
`;

for (const sec of data.sections) {
  const title = escJs(sec.sectionTitle);
  out += `    {
      sectionCode: "${sec.sectionCode}",
      sectionTitle: "${title}",
      displayOrder: ${sec.displayOrder},
      questions: [
`;
  for (const q of sec.questions) {
    out += `        { questionId: ${q.questionId}, clauseRef: "${q.clauseRef}", questionText: "${escJs(q.questionText)}", questionType: "conformity", isMandatory: true, displayOrder: ${q.displayOrder} },\n`;
  }
  out += `      ]
    },
`;
}

out += `  ]
};
`;

process.stdout.write(out);

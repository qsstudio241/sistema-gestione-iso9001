/**
 * Rigenera backend/src/data/legislativoSicurezzaTemplate.js
 * dal registro ISO_45001_LEGISLATIVO_TEMPLATE in app/src/data/checklistTemplates.js
 *
 * Uso: node backend/scripts/buildLegislativoSicurezzaTemplate.js
 */
const fs = require('fs');
const path = require('path');

const srcPath = path.join(__dirname, '../../app/src/data/checklistTemplates.js');
const outPath = path.join(__dirname, '../src/data/legislativoSicurezzaTemplate.js');

const src = fs.readFileSync(srcPath, 'utf8');
const match = src.match(/export const ISO_45001_LEGISLATIVO_TEMPLATE = (\{[\s\S]*?\n\});\n\n\/\*\*/);
if (!match) {
  console.error('ISO_45001_LEGISLATIVO_TEMPLATE non trovato in', srcPath);
  process.exit(1);
}

const template = eval(`(${match[1]})`);
const marker = '[SGQ_TEMPLATE:LEG_SICUREZZA_81]';
const payload = {
  name: 'Conformità legislativa sicurezza (D.Lgs. 81/08)',
  description:
    `${marker} Registro degli obblighi legali per salute e sicurezza sul lavoro. Non è audit ISO 45001 SGSSL.`,
  hasOutcomeButtons: true,
  sections: template.sections.map((section) => ({
    code: section.sectionCode,
    title: section.sectionTitle,
    displayOrder: section.displayOrder,
    referenceText: section.referenceText ?? null,
    linkedLegislation: section.linkedLegislation ?? null,
    items: section.questions.map((question) => ({
      code: String(question.clauseRef),
      title: question.questionText,
      displayOrder: question.displayOrder,
      responseType: question.responseType ?? 'legal_check',
    })),
  })),
};

const fileContent = `/**
 * Registro obblighi legali sicurezza — seed checklist custom
 * Fonte: app/src/data/checklistTemplates.js (ISO_45001_LEGISLATIVO_TEMPLATE)
 * Rigenerare: node backend/scripts/buildLegislativoSicurezzaTemplate.js
 */

const TEMPLATE_MARKER = ${JSON.stringify(marker)};

const LEGISLATIVO_SICUREZZA_TEMPLATE = ${JSON.stringify(payload, null, 2)};

function isLegislativoSicurezzaDescription(description) {
  return typeof description === 'string' && description.includes(TEMPLATE_MARKER);
}

module.exports = { TEMPLATE_MARKER, LEGISLATIVO_SICUREZZA_TEMPLATE, isLegislativoSicurezzaDescription };
`;

fs.writeFileSync(outPath, fileContent, 'utf8');
const itemCount = payload.sections.reduce((n, s) => n + s.items.length, 0);
console.log(`Scritto ${outPath} (${payload.sections.length} sezioni, ${itemCount} voci)`);

/**
 * Rigenera backend/src/data/legislativoAmbientaleTemplate.js
 * dalla matrice ISO_14001_LEGISLATIVO_TEMPLATE in app/src/data/checklistTemplates.js
 *
 * Uso: node backend/scripts/buildLegislativoAmbientaleTemplate.js
 */
const fs = require('fs');
const path = require('path');

const srcPath = path.join(__dirname, '../../app/src/data/checklistTemplates.js');
const outPath = path.join(__dirname, '../src/data/legislativoAmbientaleTemplate.js');

const src = fs.readFileSync(srcPath, 'utf8');
const match = src.match(/export const ISO_14001_LEGISLATIVO_TEMPLATE = (\{[\s\S]*?\n\});\n\n\/\*\*/);
if (!match) {
  console.error('ISO_14001_LEGISLATIVO_TEMPLATE non trovato in', srcPath);
  process.exit(1);
}

const template = eval(`(${match[1]})`);
const marker = '[SGQ_TEMPLATE:LEG_AMBIENTE_152]';
const payload = {
  name: 'Conformità legislativa ambientale (D.Lgs. 152/06)',
  description:
    `${marker} Matrice verifica adempimenti legali ambientali (VIA, AIA, rifiuti…). Non è audit ISO 14001 SGA.`,
  hasOutcomeButtons: true,
  sections: template.sections.map((section) => ({
    code: section.sectionCode,
    title: section.sectionTitle,
    displayOrder: section.displayOrder,
    items: section.questions.map((question) => ({
      code: String(question.clauseRef),
      title: question.questionText,
      displayOrder: question.displayOrder,
      responseType: 'verbale',
    })),
  })),
};

const fileContent = `/**
 * Matrice conformità legislativa ambientale — seed checklist custom
 * Fonte: app/src/data/checklistTemplates.js (ISO_14001_LEGISLATIVO_TEMPLATE)
 * Rigenerare: node backend/scripts/buildLegislativoAmbientaleTemplate.js
 */

const TEMPLATE_MARKER = ${JSON.stringify(marker)};

const LEGISLATIVO_AMBIENTALE_TEMPLATE = ${JSON.stringify(payload, null, 2)};

function isLegislativoAmbientaleDescription(description) {
  return typeof description === 'string' && description.includes(TEMPLATE_MARKER);
}

module.exports = { TEMPLATE_MARKER, LEGISLATIVO_AMBIENTALE_TEMPLATE, isLegislativoAmbientaleDescription };
`;

fs.writeFileSync(outPath, fileContent, 'utf8');
const itemCount = payload.sections.reduce((n, s) => n + s.items.length, 0);
console.log(`Scritto ${outPath} (${payload.sections.length} sezioni, ${itemCount} voci)`);

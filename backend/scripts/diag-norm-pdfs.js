#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

process.chdir(path.join(__dirname, '..'));

const { extractPdfText } = require('../src/utils/importPdfText');
const { extractFieldsByRules } = require('../src/utils/ruleFieldExtractors');
const { guessStandardCodeFromFilename } = require('../src/services/documentRegistryNorm.service');
const { normalizeStandardCodeForStorage, buildCatalogSearchVariants } = require('../src/services/standardCodeNormalizer.service');
const uniStore = require('../src/services/uniStoreConnector.service');
const normCatalog = require('../src/services/normCatalogLookup.service');

const FILES = [
  {
    label: 'ISO-TR-15608',
    path: '/home/ubuntu/.cursor/projects/workspace/uploads/ISO-TR-15608-2013-Testo_Inglese_6e0c.pdf',
    fileName: 'ISO-TR-15608-2013-Testo Inglese.pdf',
  },
  {
    label: 'UNI-15614',
    path: '/home/ubuntu/.cursor/projects/workspace/uploads/UNI_EN_ISO_15614-1_2019_2d94.pdf',
    fileName: 'UNI EN ISO 15614-1_2019.pdf',
  },
];

async function main() {
  for (const f of FILES) {
    console.log('\n' + '='.repeat(72));
    console.log('FILE:', f.fileName);
    const buf = fs.readFileSync(f.path);
    console.log('Size KB:', Math.round(buf.length / 1024));

    let text = '';
    try {
      text = await extractPdfText(buf);
    } catch (e) {
      console.log('PDF text error:', e.message);
    }
    console.log('Text length:', text.length);
    console.log('Text sample (first 500):', JSON.stringify(text.slice(0, 500)));

    const fromName = guessStandardCodeFromFilename(f.fileName);
    const rules = extractFieldsByRules(text, 'norma', f.fileName);
    console.log('\n--- Filename guess ---');
    console.log(fromName);
    console.log('\n--- Rule extraction ---');
    console.log(JSON.stringify(rules, null, 2));

    const code = rules.standard_code || fromName;
    const year = rules.edition_year;
    const normalized = normalizeStandardCodeForStorage(code, year);
    const variants = buildCatalogSearchVariants(code, year, rules.issuing_body);
    console.log('\n--- Normalized ---');
    console.log(normalized);
    console.log('Variants:', variants.slice(0, 8));

    console.log('\n--- UNI Store lookup ---');
    try {
      const uni = await uniStore.lookupNormOnUniStore(code, year, null);
      console.log(JSON.stringify(uni, null, 2));
    } catch (e) {
      console.log('UNI error:', e.message);
    }

    console.log('\n--- Full catalog lookup ---');
    try {
      const cat = await normCatalog.lookupNormStatus(code, rules.issuing_body, year);
      console.log(JSON.stringify(cat, null, 2));
    } catch (e) {
      console.log('Catalog error:', e.message);
    }

    // Cerca riferimenti 9606 e 15614 nel testo
    const refs9606 = (text.match(/9606[\s-]?\d*/gi) || []).slice(0, 5);
    const refs15614 = (text.match(/15614[\s-]?\d*/gi) || []).slice(0, 5);
    const refs15608 = (text.match(/15608[\s-]?\d*/gi) || []).slice(0, 5);
    console.log('\n--- Refs in text ---');
    console.log('9606:', refs9606);
    console.log('15614:', refs15614);
    console.log('15608:', refs15608);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

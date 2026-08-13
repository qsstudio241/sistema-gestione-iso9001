/**
 * @jest-environment node
 *
 * Test di mutazione per check-harness-boot.js: non basta che il checker passi
 * sullo stato sano del repo (già verificato da `node check-harness-boot.js` in CI).
 * Qui si rompe deliberatamente ogni cosa che deve intercettare, e si verifica che
 * il checker fallisca — altrimenti un controllo "verde per sempre" non protegge nulla.
 */
const {
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
} = require('./check-harness-boot');

const HEALTHY_COMPASS = `
| Se lavori su… | Apri prima |
|---|---|
${Array.from({ length: 11 }, (_, i) => `| Modulo ${i} | \`docs/fake/modulo-${i}.md\` |`).join('\n')}
`;

const HEALTHY_CONTEXT_MD = `# PROJECT CONTEXT\n\n<!-- MODULE_COMPASS_BEGIN -->\n${HEALTHY_COMPASS}\n<!-- MODULE_COMPASS_END -->\n`;

const HEALTHY_AGENTS_MD = `# AGENTS.md

## Avvio sessione (ordine obbligatorio)

0. Allinea Git.
1. \`PROJECT_CONTEXT.md\` — bussola moduli.
2. \`docs/PROJECT_ROADMAP.md\`: usa Read con \`limit: 45\` — **solo** la sezione Stato attuale.
3. Brief attivo.
4. Bussola: apri i file del modulo.
5. \`docs/GUIDA_CONSOLIDATA.md\` **solo se** deploy/Word/sync/encoding.

## Workflow Lead / Deputy
`;

const HEALTHY_ROADMAP_MD = `# Roadmap

## Stato attuale e priorità (fonte unica)

Contenuto breve dello stato attuale.

<details>
<summary>Banner storico</summary>

Testo lunghissimo storico che non deve entrare nel peso avvio... ${'x'.repeat(500)}

</details>
`;

describe('check-harness-boot — logica pura (mutazione)', () => {
  describe('extractCompass', () => {
    it('estrae il blocco tra i marcatori sul contesto sano', () => {
      const block = extractCompass(HEALTHY_CONTEXT_MD);
      expect(block).toContain('Modulo 0');
    });

    it('FALLISCE se i marcatori MODULE_COMPASS sono stati rimossi (rottura reale)', () => {
      const broken = HEALTHY_CONTEXT_MD.replace('<!-- MODULE_COMPASS_BEGIN -->', '').replace(
        '<!-- MODULE_COMPASS_END -->',
        ''
      );
      expect(() => extractCompass(broken)).toThrow(/MODULE_COMPASS_BEGIN\/END/);
    });
  });

  describe('checkCompassPathsExist', () => {
    it('passa (nessun errore) quando tutti i path esistono e la bussola ha lunghezza sana', () => {
      const paths = parseCompassPaths(HEALTHY_COMPASS);
      const errors = checkCompassPathsExist(paths, () => true);
      expect(errors).toEqual([]);
    });

    it('FALLISCE quando un path della bussola punta a un file inesistente', () => {
      const paths = parseCompassPaths(HEALTHY_COMPASS);
      const existsFn = (p) => p !== 'docs/fake/modulo-0.md';
      const errors = checkCompassPathsExist(paths, existsFn);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.join('\n')).toContain('docs/fake/modulo-0.md');
    });

    it('FALLISCE se la bussola torna a essere un inventario (>80 path)', () => {
      const hugeCompass = `| Se lavori su… | Apri prima |\n|---|---|\n${Array.from(
        { length: 90 },
        (_, i) => `| M${i} | \`docs/fake/f-${i}.md\` |`
      ).join('\n')}`;
      const paths = parseCompassPaths(hugeCompass);
      const errors = checkCompassPathsExist(paths, () => true);
      expect(errors.some((e) => /troppo lunga/.test(e))).toBe(true);
    });

    it('FALLISCE se la bussola è troppo corta (<10 path, sta per svuotarsi)', () => {
      const tinyCompass = '| Se lavori su… | Apri prima |\n|---|---|\n| M0 | `docs/fake/f-0.md` |';
      const paths = parseCompassPaths(tinyCompass);
      const errors = checkCompassPathsExist(paths, () => true);
      expect(errors.some((e) => /troppo corta/.test(e))).toBe(true);
    });
  });

  describe('checkAgentsDiet', () => {
    it('passa sull\'AGENTS.md sano (GUIDA condizionata a "solo se")', () => {
      expect(checkAgentsDiet(HEALTHY_AGENTS_MD)).toEqual([]);
    });

    it('FALLISCE se qualcuno reintroduce la lettura di GUIDA per intero senza condizione', () => {
      const regressed = HEALTHY_AGENTS_MD.replace(
        '5. `docs/GUIDA_CONSOLIDATA.md` **solo se** deploy/Word/sync/encoding.',
        '5. `docs/GUIDA_CONSOLIDATA.md`.'
      );
      const errors = checkAgentsDiet(regressed);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('FALLISCE se la roadmap torna a essere letta per intero (niente "solo")', () => {
      const regressed = HEALTHY_AGENTS_MD.replace(
        '2. `docs/PROJECT_ROADMAP.md`: usa Read con `limit: 45` — **solo** la sezione Stato attuale.',
        '2. `docs/PROJECT_ROADMAP.md`.'
      );
      const errors = checkAgentsDiet(regressed);
      expect(errors.some((e) => /roadmap intera/.test(e))).toBe(true);
    });

    it('FALLISCE se "solo la sezione" non è accompagnato da un limite meccanico (regressione empirica 13/08/2026: un sub-agente reale ha letto il file intero nonostante "solo")', () => {
      const weakInstruction = HEALTHY_AGENTS_MD.replace(
        '2. `docs/PROJECT_ROADMAP.md`: usa Read con `limit: 45` — **solo** la sezione Stato attuale.',
        '2. `docs/PROJECT_ROADMAP.md` **solo** la sezione Stato attuale.'
      );
      const errors = checkAgentsDiet(weakInstruction);
      expect(errors.some((e) => /non specifica "limit"/.test(e))).toBe(true);
    });
  });

  describe('checkSelfLearningNotAlwaysOn', () => {
    it('passa quando alwaysApply è false', () => {
      expect(checkSelfLearningNotAlwaysOn('alwaysApply: false')).toEqual([]);
    });

    it('FALLISCE se sgq-self-learning torna alwaysApply: true (regressione peso avvio)', () => {
      const errors = checkSelfLearningNotAlwaysOn('description: x\nalwaysApply: true');
      expect(errors.length).toBe(1);
    });
  });

  describe('roadmapStatoSliceFromText', () => {
    it('esclude il banner storico dentro <details> dal peso avvio', () => {
      const slice = roadmapStatoSliceFromText(HEALTHY_ROADMAP_MD);
      expect(slice.text).not.toContain('Banner storico');
      expect(slice.bytes).toBeLessThan(Buffer.byteLength(HEALTHY_ROADMAP_MD, 'utf8'));
    });

    it('FALLISCE (throw) se la sezione Stato attuale viene rinominata/rimossa', () => {
      const broken = HEALTHY_ROADMAP_MD.replace('## Stato attuale e priorità (fonte unica)', '## Altro titolo');
      expect(() => roadmapStatoSliceFromText(broken)).toThrow(/Stato attuale non trovata/);
    });
  });

  describe('checkMandatoryBytes', () => {
    it('passa sotto il tetto', () => {
      expect(checkMandatoryBytes(TARGET_MANDATORY_BYTES - 1)).toEqual([]);
    });

    it('FALLISCE se il peso avvio torna a superare il tetto (regressione dieta)', () => {
      const errors = checkMandatoryBytes(TARGET_MANDATORY_BYTES + 1);
      expect(errors.length).toBe(1);
      expect(errors[0]).toMatch(/50 KB/);
    });
  });

  describe('runScenarioPure — scenario company_profile', () => {
    const scenario = SCENARIOS[0];
    const healthyRow = {
      topic: 'Profilo azienda / company_profile',
      files:
        '`docs/adr/ADR-018-company-profile-conformita-legislativa.md`, `docs/specs/COMPANY_PROFILE_CAMPI_E_TEMPLATE_EXCEL.md`, `backend/src/controllers/company.controller.js`',
    };
    const briefText = 'Brief: profilo azienda, ADR-018, company_profile S1-S3.';

    it('passa e riporta i primi file centrati sul modulo', () => {
      const result = runScenarioPure(scenario, [healthyRow], briefText);
      expect(result.errors).toEqual([]);
      expect(result.firstFiles[0]).toBe(scenario.brief);
      expect(result.firstFiles).not.toContain('docs/GUIDA_CONSOLIDATA.md');
    });

    it('FALLISCE se il brief non parla più di company_profile/ADR-018 (brief cambiato senza aggiornare bussola)', () => {
      const result = runScenarioPure(scenario, [healthyRow], 'Brief: tutt\'altro argomento.');
      expect(result.errors.some((e) => /non parla più/.test(e))).toBe(true);
    });

    it('FALLISCE se manca la riga bussola per il modulo (rinominata senza aggiornare lo scenario)', () => {
      const result = runScenarioPure(scenario, [{ topic: 'Altro modulo', files: '`x.js`' }], briefText);
      expect(result.errors.some((e) => /nessuna riga bussola/.test(e))).toBe(true);
    });

    it('FALLISCE se la bussola smette di elencare un file chiave del modulo (es. ADR-018 rimosso)', () => {
      const degradedRow = {
        topic: 'Profilo azienda / company_profile',
        files: '`backend/src/controllers/company.controller.js`',
      };
      const result = runScenarioPure(scenario, [degradedRow], briefText);
      expect(result.errors.some((e) => /non elenca/.test(e))).toBe(true);
    });

    it('FALLISCE se GUIDA_CONSOLIDATA.md finisce tra i primi file (regressione: la bussola rimanda di nuovo a GUIDA intera)', () => {
      const rowWithGuida = {
        topic: 'Profilo azienda / company_profile',
        files: '`docs/GUIDA_CONSOLIDATA.md`, `docs/adr/ADR-018-company-profile-conformita-legislativa.md`',
      };
      const result = runScenarioPure(scenario, [rowWithGuida], briefText);
      expect(result.errors.some((e) => /GUIDA_CONSOLIDATA\.md.*primi 5/.test(e))).toBe(true);
    });
  });
});

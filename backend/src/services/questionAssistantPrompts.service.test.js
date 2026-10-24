const {
  buildPromptForMode,
  sanitizeQuestionContext,
  normalizeAssistantStandardCode,
  QUESTION_ASSISTANT_MODES,
} = require('./questionAssistantPrompts.service');

describe('questionAssistantPrompts — suggest_questions', () => {
  it('include suggest_questions tra le mode', () => {
    expect(QUESTION_ASSISTANT_MODES).toContain('suggest_questions');
  });

  it('sanitize toglie campi anagrafici e tiene solo domanda/clausola/esito/note', () => {
    const safe = sanitizeQuestionContext({
      text: 'Ci sono risorse sufficienti?',
      clauseRef: '7.1.2',
      currentStatus: 'C',
      notes: 'Organigramma visto',
      vat_number: 'IT12345678901',
      companyName: 'Rossi Srl',
      address: 'Via Roma 1',
    });
    expect(safe.text).toContain('risorse');
    expect(safe.clauseRef).toBe('7.1.2');
    expect(safe.currentStatus).toBe('C');
    expect(safe.notes).toBe('Organigramma visto');
    expect(safe).not.toHaveProperty('vat_number');
    expect(safe).not.toHaveProperty('companyName');
    expect(JSON.stringify(safe)).not.toContain('IT12345678901');
    expect(JSON.stringify(safe)).not.toContain('Rossi');
  });

  it('il prompt Fase 1 ha contesto e non cita allegati o P.IVA', () => {
    const messages = buildPromptForMode('suggest_questions', {
      question: {
        text: 'Come gestite le risorse?',
        clauseRef: '7.1.2',
        currentStatus: 'NC',
        notes: 'Manca il piano',
        standardLabel: '9001',
        vat_number: 'IT999',
      },
      attachments: [{ name: 'contratto-cliente.pdf' }],
      ragContext: '',
      hasOfficialSource: false,
    });
    const blob = JSON.stringify(messages);
    expect(blob).toContain('7.1.2');
    expect(blob).toContain('Come gestite le risorse?');
    expect(blob).toContain('NC');
    expect(blob).toContain('Manca il piano');
    expect(blob).toContain('9001');
    expect(blob).not.toContain('IT999');
    expect(blob).not.toContain('contratto-cliente.pdf');
    expect(blob).toMatch(/NON certificare/i);
  });

  it('standard custom o vuoto diventa assente e il prompt dice non indicata', () => {
    expect(normalizeAssistantStandardCode('custom')).toBe('');
    expect(normalizeAssistantStandardCode('CUSTOM')).toBe('');
    expect(normalizeAssistantStandardCode('')).toBe('');
    expect(normalizeAssistantStandardCode('ISO_9001_2015')).toBe('ISO_9001_2015');
    const safe = sanitizeQuestionContext({
      text: 'Registro?',
      clauseRef: 'A.1',
      standardCode: 'custom',
    });
    expect(safe.standardCode).toBe('');
    const messages = buildPromptForMode('suggest_questions', {
      question: { text: 'Registro?', clauseRef: 'A.1', standardCode: 'custom' },
    });
    expect(JSON.stringify(messages)).toMatch(/non indicata/i);
    expect(JSON.stringify(messages)).not.toContain('custom');
  });
});

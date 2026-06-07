'use strict';

const {
  ruleLabel,
  matchDocAlertRule,
  parseEmailFromResponsible,
  buildDocAlertHtml,
} = require('./docAlertEscalation.service');
const { buildDocEscalationThresholds } = require('./alertSchedulerHelpers');

describe('docAlertEscalation.service', () => {
  describe('parseEmailFromResponsible', () => {
    it('estrae email valida dal campo responsabile', () => {
      expect(parseEmailFromResponsible('Mario Rossi <mario@studio.it>')).toBeNull();
      expect(parseEmailFromResponsible('mario@studio.it')).toBe('mario@studio.it');
    });

    it('ritorna null senza @', () => {
      expect(parseEmailFromResponsible('Mario Rossi')).toBeNull();
    });
  });

  describe('ruleLabel', () => {
    it('etichetta overdue', () => {
      expect(ruleLabel({ kind: 'overdue' })).toMatch(/Scaduto/i);
    });

    it('etichetta threshold', () => {
      expect(ruleLabel({ kind: 'threshold', thresholdDays: 7 })).toBe('Scadenza tra 7 giorni');
    });
  });

  describe('buildDocAlertHtml', () => {
    it('include titolo documento', () => {
      const html = buildDocAlertHtml('Studio Test', 'Mario', [{
        title: 'Manuale Qualità',
        doc_code: 'MQ-001',
        company_name: 'Acme',
        expiry_date: '2026-06-01',
        ruleLabel: 'Scadenza tra 7 giorni',
        rule: { kind: 'threshold', thresholdDays: 7 },
      }]);
      expect(html).toContain('Manuale Qualit');
      expect(html).toContain('MQ-001');
    });
  });

  describe('integrazione regole escalation', () => {
    it('curva default include soglia 14 giorni', () => {
      const thresholds = buildDocEscalationThresholds(30, 7);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const due = new Date(today);
      due.setDate(due.getDate() + 14);
      const iso = `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, '0')}-${String(due.getDate()).padStart(2, '0')}`;
      expect(matchDocAlertRule({ expiryDate: iso, status: 'rilasciato', thresholds }))
        .toEqual({ kind: 'threshold', thresholdDays: 14 });
    });
  });
});

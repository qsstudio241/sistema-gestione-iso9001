/**
 * Test unitari alertSchedulerHelpers (Slice 1)
 */

const {
  parseSendTime,
  sendTimeToCron,
  addMinutesToSendTime,
  buildEscalationThresholds,
  buildDocEscalationThresholds,
  daysUntilDue,
  matchNcAlertRule,
  matchActionAlertRule,
  matchDocAlertRule,
  parseRecipientList,
} = require('./alertSchedulerHelpers');

describe('parseSendTime', () => {
  it('parsa HH:MM valido', () => {
    expect(parseSendTime('08:30')).toEqual({ hour: 8, minute: 30 });
  });

  it('fallback su valore invalido', () => {
    expect(parseSendTime('invalid')).toEqual({ hour: 8, minute: 0 });
  });
});

describe('sendTimeToCron', () => {
  it('genera cron node-schedule', () => {
    expect(sendTimeToCron('08:05')).toBe('5 8 * * *');
  });
});

describe('addMinutesToSendTime', () => {
  it('aggiunge 5 minuti con wrap 24h', () => {
    const r = addMinutesToSendTime('23:58', 5);
    expect(r.hour).toBe(0);
    expect(r.minute).toBe(3);
  });
});

describe('buildEscalationThresholds', () => {
  it('deduplica e ordina desc', () => {
    expect(buildEscalationThresholds(30, 7)).toEqual([30, 14, 7, 1]);
  });
});

describe('buildDocEscalationThresholds', () => {
  it('include curve default documenti', () => {
    const t = buildDocEscalationThresholds(30, 7);
    expect(t).toContain(35);
    expect(t).toContain(30);
    expect(t).toContain(1);
    expect(t[0]).toBeGreaterThan(t[t.length - 1]);
  });

  it('accetta override rules_json', () => {
    expect(buildDocEscalationThresholds(30, 7, '{"thresholds":[60,45]}')).toEqual([60, 45, 30, 14, 7, 1]);
  });
});

describe('matchDocAlertRule', () => {
  const thresholds = [30, 14, 7, 1];

  it('match soglia pre-scadenza', () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(today);
    due.setDate(due.getDate() + 7);
    const iso = `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, '0')}-${String(due.getDate()).padStart(2, '0')}`;
    expect(matchDocAlertRule({ expiryDate: iso, status: 'rilasciato', thresholds }))
      .toEqual({ kind: 'threshold', thresholdDays: 7 });
  });

  it('match overdue', () => {
    expect(matchDocAlertRule({ expiryDate: '2020-01-01', status: 'vigente', thresholds }))
      .toEqual({ kind: 'overdue', thresholdDays: null });
  });

  it('ignora obsoleti', () => {
    expect(matchDocAlertRule({ expiryDate: '2020-01-01', status: 'obsoleto', thresholds })).toBeNull();
  });

  // Regressione 10/08/2026: con expiry_date come oggetto Date nativo (formato
  // reale mssql per document_registry.expiry_date), la soglia deve continuare
  // a scattare — prima del fix daysUntilDue tornava sempre null qui.
  it('match soglia pre-scadenza con expiry_date come oggetto Date nativo (mssql)', () => {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const due = new Date(today);
    due.setUTCDate(due.getUTCDate() + 7);
    expect(matchDocAlertRule({ expiryDate: due, status: 'rilasciato', thresholds }))
      .toEqual({ kind: 'threshold', thresholdDays: 7 });
  });
});

describe('daysUntilDue', () => {
  it('calcola giorni futuri (stringa ISO)', () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const future = new Date(today);
    future.setDate(future.getDate() + 7);
    const iso = `${future.getFullYear()}-${String(future.getMonth() + 1).padStart(2, '0')}-${String(future.getDate()).padStart(2, '0')}`;
    expect(daysUntilDue(iso)).toBe(7);
  });

  /**
   * Regressione bug critico 10/08/2026: mssql/tedious restituisce le colonne
   * DATE come oggetti `Date` nativi a mezzanotte UTC, non come stringhe
   * "YYYY-MM-DD". La versione precedente faceva `String(dueDate)` e testava
   * la regex ISO — su un Date nativo produce "Thu Aug 31 2028 00:00:00
   * GMT+0000 (...)" che non combacia mai, quindi restituiva sempre `null`.
   * Verificato in produzione: qual_notification_log e doc_notification_log
   * erano a 0 righe nonostante qualifiche/documenti realmente scaduti — né un
   * alert email né una riga virtuale in Scadenzario sono mai scattati.
   */
  it('calcola giorni futuri da un oggetto Date nativo (formato reale restituito da mssql)', () => {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const future = new Date(today);
    future.setUTCDate(future.getUTCDate() + 10);
    expect(daysUntilDue(future)).toBe(10);
  });

  it('calcola giorni passati da un oggetto Date nativo (scaduta)', () => {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const past = new Date(today);
    past.setUTCDate(past.getUTCDate() - 5);
    expect(daysUntilDue(past)).toBe(-5);
  });

  it('ignora un oggetto Date non valido', () => {
    expect(daysUntilDue(new Date('not-a-date'))).toBeNull();
  });

  it('ignora valori senza formato riconoscibile', () => {
    expect(daysUntilDue('non una data')).toBeNull();
    expect(daysUntilDue(undefined)).toBeNull();
  });
});

describe('matchNcAlertRule', () => {
  const thresholds = [30, 14, 7, 1];

  it('match soglia due_date', () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(today);
    due.setDate(due.getDate() + 7);
    const iso = `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, '0')}-${String(due.getDate()).padStart(2, '0')}`;
    const rule = matchNcAlertRule({
      dueDate: iso,
      createdAt: today.toISOString(),
      status: 'open',
      alertDays1: 30,
      thresholds,
    });
    expect(rule).toEqual({ kind: 'threshold', thresholdDays: 7 });
  });

  it('match NC aperta stale senza due_date', () => {
    const created = new Date();
    created.setDate(created.getDate() - 35);
    const rule = matchNcAlertRule({
      dueDate: null,
      createdAt: created.toISOString(),
      status: 'open',
      alertDays1: 30,
      thresholds,
    });
    expect(rule).toEqual({ kind: 'open_stale', thresholdDays: 30 });
  });

  it('ignora NC chiuse', () => {
    expect(matchNcAlertRule({
      dueDate: '2099-01-01',
      status: 'closed',
      alertDays1: 30,
      thresholds,
    })).toBeNull();
  });

  // Regressione 10/08/2026: con due_date come oggetto Date nativo (formato
  // reale mssql per non_conformities.due_date), la soglia deve continuare a
  // scattare — prima del fix daysUntilDue tornava sempre null qui.
  it('match soglia due_date come oggetto Date nativo (mssql)', () => {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const due = new Date(today);
    due.setUTCDate(due.getUTCDate() + 7);
    const rule = matchNcAlertRule({
      dueDate: due,
      createdAt: today.toISOString(),
      status: 'open',
      alertDays1: 30,
      thresholds,
    });
    expect(rule).toEqual({ kind: 'threshold', thresholdDays: 7 });
  });
});

describe('matchActionAlertRule', () => {
  it('match overdue', () => {
    const rule = matchActionAlertRule({
      dueDate: '2020-01-01',
      status: 'open',
      thresholds: [7, 1],
    });
    expect(rule).toEqual({ kind: 'overdue', thresholdDays: null });
  });
});

describe('parseRecipientList', () => {
  it('splitta email con virgola e punto e virgola', () => {
    expect(parseRecipientList('A@x.it, B@y.it;C@z.it')).toEqual(['a@x.it', 'b@y.it', 'c@z.it']);
  });
});

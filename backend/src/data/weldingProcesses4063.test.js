'use strict';

const {
  inferWeldingProcessFromText,
  normalizeWeldingProcessCode,
} = require('./weldingProcesses4063');

describe('weldingProcesses4063', () => {
  test('normalizza 136', () => {
    expect(normalizeWeldingProcessCode('136')).toBe('136');
  });

  test('inferisce MMA', () => {
    expect(inferWeldingProcessFromText('Saldatura ad elettrodo MMA')).toBe('111');
  });
});

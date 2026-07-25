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

  test('DEPUTYTASK1 25/07/2026 — codice esplicito 135 vince su alias "elettrodo" (diametro filo/elettrodo apporto)', () => {
    const text = `WELDING PROCEDURE QUALIFICATION RECORD
Welding process: 135
Diametro elettrodo/filo d'apporto: 1.2 mm`;
    expect(inferWeldingProcessFromText(text)).toBe('135');
  });

  test('codice nudo isolato ha priorità sull\'alias quando non c\'è etichetta esplicita', () => {
    const text = `Verbale di prova - processo 135 - diametro elettrodo 1.2 mm`;
    expect(inferWeldingProcessFromText(text)).toBe('135');
  });
});

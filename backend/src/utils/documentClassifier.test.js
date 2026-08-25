'use strict';

const { classifyDocument } = require('./documentClassifier');

describe('classifyDocument — ISO 14732 vs WPQR (falso positivo §4.1)', () => {
    // Testo OCR reale (TEC-Eurolab, ADA / DEDIC ADIL, 25/08/2026): certificato
    // operatore 14732 che cita WPQR/15614 come base della qualifica (§4.1 a).
    const dedic14732Ocr = `
A) TEC-Eurolab
CERTIFICATO DI QUALIFICA DI OPERATORE
DISALDATURA IN ACCORDO ALLA
UNI EN ISO 14732: 2013
ACCREDIA
CERTIFICATION BODY
APROVAL TEST CERTIFICATE FOR WELDING
OPERATOR ACCORDING TO
UNI EN ISO 14732: 2013
Datore di lavoro / Employer: ADA S.R.L. UNIPERSONALE Icert. n: 25-01341-02-001
Saldatore Cognome / Sumame: DEDIC
Welder Nome / Name: ADIL
Procedimento saldatura / Welding process: 121
Variabili in accordo al par. 4.2 UNI EN ISO 14732: 2013
Qualificazione basata su: / Qualification based on:
4.1 a) WPQR in accordo con le parti rilevanti della ISO 15614 / Welding procedure test in accordance with the relevant part of ISO 15614: -
4.1 b) Prove di saldatura di pre-produzione o produzione in accordo con la ISO 15613
4.1 c) Prove di saldatura in accordo con le parti rilevanti della ISO 9606 / test pieces in accordance with the relevant
`;

    it('classifica come operator_qual un certificato 14732 che cita WPQR/15614 come base', () => {
        const result = classifyDocument(dedic14732Ocr);
        expect(result.detected_type).toBe('operator_qual');
        expect(result.confidence).toBe('high');
        expect(result.all_scores.operator_qual).toBeGreaterThan(result.all_scores.wpqr);
    });

    it('continua a riconoscere una WPQR vera (ISO 15614 senza 14732)', () => {
        const wpqrText = `
PROCEDURE QUALIFICATION RECORD (WPQR)
ISO 15614-1
Test piece / Provino di saldatura
Trazione, bending, hardness, macro, Charpy
Examiner / Esaminatore: Mario Rossi
Notified body / Organismo notificato
`;
        const result = classifyDocument(wpqrText);
        expect(result.detected_type).toBe('wpqr');
        expect(result.confidence).toBe('high');
    });

    it('riconosce un patentino ISO 9606-1', () => {
        const text = `
CERTIFICATO DI QUALIFICAZIONE DEL SALDATORE
UNI EN ISO 9606-1
Welder: Mario Rossi
Validity / Validità
Renewal / Rinnovo
`;
        const result = classifyDocument(text);
        expect(result.detected_type).toBe('welder_qual');
        expect(result.confidence).toBe('high');
    });
});

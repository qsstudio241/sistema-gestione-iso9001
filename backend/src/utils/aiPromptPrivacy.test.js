/**
 * @jest-environment node
 */

const {
    PLACEHOLDERS,
    placeholderForFieldKey,
    scrubFreeTextForAi,
    redactPayloadForAi,
    redactFieldDiffsForAi,
    redactFeedbackExampleForAi,
    redactFileNameForAi,
    redactReferencePatternsForAi,
    dropPlaceholderValues,
} = require('./aiPromptPrivacy');

describe('aiPromptPrivacy', () => {
    it('redactFileNameForAi restituisce sempre il segnaposto, mai il nome', () => {
        expect(redactFileNameForAi('25-01341_ROSSI MARIO_9606-1.pdf')).toBe('[FILE]');
        expect(redactFileNameForAi(null)).toBe('[FILE]');
    });

    it('placeholderForFieldKey: chiavi personali per tipo documento', () => {
        expect(placeholderForFieldKey('welder_name', 'patentino_saldatore')).toBe(PLACEHOLDERS.NOME);
        expect(placeholderForFieldKey('operator_name', 'qualifica_14732')).toBe(PLACEHOLDERS.NOME);
        expect(placeholderForFieldKey('certificate_number', 'patentino_saldatore')).toBe(PLACEHOLDERS.NUMERO_CERTIFICATO);
        expect(placeholderForFieldKey('employer', 'cert_ndt')).toBe(PLACEHOLDERS.DATORE);
        expect(placeholderForFieldKey('birth_date', 'qualifica_14732')).toBe(PLACEHOLDERS.DATA_NASCITA);
        expect(placeholderForFieldKey('codice_fiscale', 'material_certificate')).toBe(PLACEHOLDERS.CODICE_FISCALE);
        expect(placeholderForFieldKey('wps_number', 'patentino_saldatore')).toBe(PLACEHOLDERS.NUMERO_WPS_WPQR);
        expect(placeholderForFieldKey('matricola', 'patentino_saldatore')).toBe(PLACEHOLDERS.ID_PERSONALE);
        // Campi tecnici e di norma non sono personali.
        for (const k of ['welding_process', 'thickness_min_mm', 'standard_reference', 'material_group', 'issuing_body', 'exam_date']) {
            expect(placeholderForFieldKey(k, 'patentino_saldatore')).toBeNull();
        }
        // Fuori dai documenti di qualifica i numeri non sono toccati (WPQR/MC: fuori scope).
        expect(placeholderForFieldKey('certificate_number', 'wpqr')).toBeNull();
        expect(placeholderForFieldKey('wpqr_number', 'wpqr')).toBeNull();
    });

    it('scrubFreeTextForAi toglie email, codice fiscale, telefono e valori noti', () => {
        const txt = 'Contatto mario.rossi@example.test, CF RSSMRA80A01H501U, tel +39 333 1234567, '
            + 'saldatore Mario Rossi (cert. 25-01341-02) data 2024-05-10 ISO 9606-1';
        const out = scrubFreeTextForAi(txt, [
            { value: 'Rossi', placeholder: '[NOME]' },
            { value: 'Mario', placeholder: '[NOME]' },
            { value: '25-01341-02', placeholder: '[NUMERO_CERTIFICATO]' },
        ]);
        expect(out).not.toMatch(/@example|RSSMRA|333 1234567|Rossi|Mario|25-01341/);
        expect(out).toContain('[EMAIL]');
        expect(out).toContain('[CODICE_FISCALE]');
        expect(out).toContain('[TELEFONO]');
        expect(out).toContain('[NUMERO_CERTIFICATO]');
        expect(out).toContain('2024-05-10');
        expect(out).toContain('ISO 9606-1');
    });

    it('scrubFreeTextForAi non tocca non-stringhe e testi vuoti', () => {
        expect(scrubFreeTextForAi(12)).toBe(12);
        expect(scrubFreeTextForAi('')).toBe('');
        expect(scrubFreeTextForAi(null)).toBeNull();
    });

    it('scrubFreeTextForAi redige telefoni solo con +39/0039 o contesto tel', () => {
        expect(scrubFreeTextForAi('+39 333 1234567')).toBe('[TELEFONO]');
        expect(scrubFreeTextForAi('0039 333 1234567')).toBe('[TELEFONO]');
        expect(scrubFreeTextForAi('tel. 0521 123456')).toBe('tel. [TELEFONO]');
        expect(scrubFreeTextForAi('tel. 02/12345678')).toBe('tel. [TELEFONO]');
        expect(scrubFreeTextForAi('telefono 02-1234-5678')).toBe('telefono [TELEFONO]');
        expect(scrubFreeTextForAi('24-03390-01 +39 333 1234567')).toBe('24-03390-01 [TELEFONO]');
        expect(scrubFreeTextForAi('+39 333 1234567, 24-03390-01')).toBe('[TELEFONO], 24-03390-01');

        expect(scrubFreeTextForAi('24-03390-01')).toBe('24-03390-01');
        expect(scrubFreeTextForAi('135-138-141')).toBe('135-138-141');
        expect(scrubFreeTextForAi('111/135')).toBe('111/135');
        expect(scrubFreeTextForAi('WPS 24-03390-01')).toBe('WPS 24-03390-01');
        expect(scrubFreeTextForAi('WPQR 24-03390-01')).toBe('WPQR 24-03390-01');
        expect(scrubFreeTextForAi('02 12345678')).toBe('02 12345678');
        expect(scrubFreeTextForAi('02/12345678')).toBe('02/12345678');
        expect(scrubFreeTextForAi('02-1234-5678')).toBe('02-1234-5678');
        expect(scrubFreeTextForAi('32-03390-01')).toBe('32-03390-01');
        expect(scrubFreeTextForAi('31-12345-67')).toBe('31-12345-67');
        expect(scrubFreeTextForAi('0123456789012345')).toBe('0123456789012345');
        expect(scrubFreeTextForAi('3331234567890123')).toBe('3331234567890123');
        expect(scrubFreeTextForAi('24-03390-01 333 1234567')).toBe('24-03390-01 333 1234567');
        expect(scrubFreeTextForAi('02 12345678 135-138-141')).toBe('02 12345678 135-138-141');
        expect(scrubFreeTextForAi('PQR 24-03390-01 processi 135-138-141 e 111/135')).toBe(
            'PQR 24-03390-01 processi 135-138-141 e 111/135'
        );

        expect(scrubFreeTextForAi('+39 333 1234567, WPS 135-138-141')).toBe(
            '[TELEFONO], WPS 135-138-141'
        );
        expect(scrubFreeTextForAi('tel. 02 1234 5678 cert. 24-03390-01')).toBe(
            'tel. [TELEFONO] cert. 24-03390-01'
        );
        expect(scrubFreeTextForAi('ABC-0039-12345-67')).toBe('ABC-0039-12345-67');
        expect(scrubFreeTextForAi('tel 12 34 56 78 135')).toBe('tel [TELEFONO] 135');
        expect(scrubFreeTextForAi('tel 333 12 34 56 135')).toBe('tel [TELEFONO] 135');
        expect(scrubFreeTextForAi('tel. 0123456789012345')).toBe('tel. 0123456789012345');

        const mixed = scrubFreeTextForAi(
            'WPQR 24-03390-01, processi 135-138-141 e 111/135. '
            + 'Contatti +39 333 1234567, 02 12345678, tel. 0521 123456'
        );
        expect(mixed).toContain('24-03390-01');
        expect(mixed).toContain('135-138-141');
        expect(mixed).toContain('111/135');
        expect(mixed).toContain('02 12345678');
        expect(mixed).not.toMatch(/\+39|333 1234567|0521 123456/);
        expect(mixed.match(/\[TELEFONO\]/g)).toHaveLength(2);
    });

    it('telefono valido seguito da gruppi extra: redatto, il codice adiacente resta (Bugbot 184efec3 #1)', () => {
        expect(scrubFreeTextForAi('+39 333 1234567 135-138-141')).toBe('[TELEFONO] 135-138-141');
        expect(scrubFreeTextForAi('+39 333 1234567 135 138 141')).toBe('[TELEFONO] 135 138 141');
        expect(scrubFreeTextForAi('tel. 333 1234567 135-138-141')).toBe('tel. [TELEFONO] 135-138-141');
        expect(scrubFreeTextForAi('tel. 0521 123456 135-138-141')).toBe('tel. [TELEFONO] 135-138-141');
        expect(scrubFreeTextForAi('0039 333 1234567 111/135')).toBe('[TELEFONO] 111/135');
        expect(scrubFreeTextForAi('+39 333 1234567 24-03390-01')).toMatch(/^\[TELEFONO\]/);
        expect(scrubFreeTextForAi('+39 333 1234567 24-03390-01')).not.toMatch(/333|1234567/);
        expect(scrubFreeTextForAi('tel 12 34 56 78 90 12 34')).not.toMatch(/12 34 56 78/);
    });

    it('prefisso +39/0039: confine con punteggiatura ammesso, attaccato a lettere/cifre no (Bugbot 184efec3 #2)', () => {
        expect(scrubFreeTextForAi('Tel:+39 333 1234567')).toBe('Tel:[TELEFONO]');
        expect(scrubFreeTextForAi('fax:+39 333 1234567')).toBe('fax:[TELEFONO]');
        expect(scrubFreeTextForAi('tel.+39 333 1234567')).toBe('tel.[TELEFONO]');
        expect(scrubFreeTextForAi('x;+39 333 1234567')).toBe('x;[TELEFONO]');
        expect(scrubFreeTextForAi('x,+39 333 1234567')).toBe('x,[TELEFONO]');
        expect(scrubFreeTextForAi('"+39 333 1234567"')).toBe('"[TELEFONO]"');
        expect(scrubFreeTextForAi('(+39 333 1234567)')).toBe('([TELEFONO])');
        expect(scrubFreeTextForAi('[0039 333 1234567]')).toBe('[[TELEFONO]]');
        expect(scrubFreeTextForAi('Tel:0039 333 1234567')).toBe('Tel:[TELEFONO]');
        expect(scrubFreeTextForAi('\n+39 333 1234567')).toBe('\n[TELEFONO]');

        expect(scrubFreeTextForAi('ABC+39 333 1234567')).toBe('ABC+39 333 1234567');
        expect(scrubFreeTextForAi('12+39 333 1234567')).toBe('12+39 333 1234567');
        expect(scrubFreeTextForAi('X0039 333 1234567')).toBe('X0039 333 1234567');
        expect(scrubFreeTextForAi('10390039 333 1234567')).toBe('10390039 333 1234567');
        expect(scrubFreeTextForAi('ABC_0039 333 1234567')).toBe('ABC_0039 333 1234567');
        expect(scrubFreeTextForAi('ABC-0039-12345-67')).toBe('ABC-0039-12345-67');
        expect(scrubFreeTextForAi('A/0039 333 1234567')).toBe('A/0039 333 1234567');
        expect(scrubFreeTextForAi('24.0039 333 1234567')).toBe('24.0039 333 1234567');
        expect(scrubFreeTextForAi('+39')).toBe('+39');
        expect(scrubFreeTextForAi('+39 12345')).toBe('+39 12345');
    });

    it('telefono: sequenze di cifre molto lunghe, input vuoto/non stringa, stringhe enormi senza blocchi', () => {
        expect(scrubFreeTextForAi('+39 ' + '1'.repeat(14))).toBe('+39 ' + '1'.repeat(14));
        expect(scrubFreeTextForAi('tel. ' + '1'.repeat(50))).toBe('tel. ' + '1'.repeat(50));
        expect(scrubFreeTextForAi('+39 333 1234567' + '8'.repeat(20))).toBe('+39 333 1234567' + '8'.repeat(20));
        expect(scrubFreeTextForAi('')).toBe('');
        expect(scrubFreeTextForAi(null)).toBeNull();
        expect(scrubFreeTextForAi(undefined)).toBeUndefined();
        expect(scrubFreeTextForAi(12345)).toBe(12345);

        const t0 = Date.now();
        const big = 1_000_000;
        const inputs = [
            '1'.repeat(big),
            'tel ' + '1'.repeat(big),
            '+39 ' + '1'.repeat(big),
            '+39'.repeat(big / 3),
            'tel 1 '.repeat(big / 6),
            '+39 333 1234567 '.repeat(big / 16),
            'a'.repeat(big),
            '1-'.repeat(big / 2),
        ];
        for (const s of inputs) expect(typeof scrubFreeTextForAi(s)).toBe('string');
        expect(scrubFreeTextForAi('+39 333 1234567 '.repeat(1000)).match(/\[TELEFONO\]/g)).toHaveLength(1000);
        expect(Date.now() - t0).toBeLessThan(5000);
    });

    it('redactPayloadForAi: valori personali -> segnaposto, struttura e campi tecnici invariati', () => {
        const payload = {
            welder_name: 'Bianchi Luca',
            person_name: 'Bianchi Luca',
            certificate_number: 'ZZ-777/2024',
            employer: 'Officine Fittizie Srl',
            welding_process: '135',
            thickness_min_mm: 3,
            welding_positions: ['PA', 'PB'],
            standard_reference: 'ISO 9606-1:2017',
            weld_details: 'Prova di Luca Bianchi su ZZ-777/2024',
            examiner_body: null,
            operator_name: '',
        };
        const out = redactPayloadForAi(payload, { docType: 'patentino_saldatore' });
        expect(Object.keys(out)).toEqual(Object.keys(payload));
        expect(out.welder_name).toBe('[NOME]');
        expect(out.person_name).toBe('[NOME]');
        expect(out.certificate_number).toBe('[NUMERO_CERTIFICATO]');
        expect(out.employer).toBe('[DATORE]');
        expect(out.welding_process).toBe('135');
        expect(out.thickness_min_mm).toBe(3);
        expect(out.welding_positions).toEqual(['PA', 'PB']);
        expect(out.standard_reference).toBe('ISO 9606-1:2017');
        expect(out.examiner_body).toBeNull();
        expect(out.operator_name).toBe('');
        expect(out.weld_details).toBe('Prova di [NOME] [NOME] su [NUMERO_CERTIFICATO]');
        // L'input non e' mutato.
        expect(payload.welder_name).toBe('Bianchi Luca');
    });

    it('nomi di ispettore/esaminatore: segnaposto come gli altri nomi di persona (Bugbot bcc270fd)', () => {
        for (const k of ['inspector_name', 'examiner_name', 'tester_name', 'signatory_name']) {
            expect(placeholderForFieldKey(k, 'cert_ndt')).toBe(PLACEHOLDERS.NOME);
            expect(placeholderForFieldKey(k, 'wpqr')).toBe(PLACEHOLDERS.NOME);
        }
        expect(placeholderForFieldKey('examiner_body', 'cert_ndt')).toBeNull();
        const out = redactPayloadForAi(
            { inspector_name: 'Verdi Paolo', notes: 'Controllo di Paolo Verdi' },
            { docType: 'cert_ndt' }
        );
        expect(out.inspector_name).toBe('[NOME]');
        expect(out.notes).toBe('Controllo di [NOME] [NOME]');
    });

    it('frammenti di nome non sovrascrivono i campi tecnici; il nome completo si (Bugbot bcc270fd)', () => {
        const payload = {
            welder_name: 'Tig Marco',
            welding_process: 'Tig 141',
            standard_reference: 'ISO Tig 9606-1',
            issuing_body: 'Ente Marco',
            nested: { material_group: 'Tig', remarks: 'Marco ha usato il Tig' },
            notes: 'Provino di Tig Marco, saldato da Marco',
        };
        const out = redactPayloadForAi(payload, { docType: 'patentino_saldatore' });
        expect(out.welding_process).toBe('Tig 141');
        expect(out.standard_reference).toBe('ISO Tig 9606-1');
        expect(out.issuing_body).toBe('Ente Marco');
        expect(out.nested.material_group).toBe('Tig');
        expect(out.nested.remarks).toBe('[NOME] ha usato il [NOME]');
        expect(out.notes).toBe('Provino di [NOME], saldato da [NOME]');

        const full = redactPayloadForAi(
            { welder_name: 'Tig Marco', issuing_body: 'Verifica di Tig Marco' },
            { docType: 'patentino_saldatore' }
        );
        expect(full.issuing_body).toBe('Verifica di [NOME]');

        const diffs = redactFieldDiffsForAi(
            { welding_process: { ai: 'Tig 141', human: 'Tig 135' } },
            { docType: 'patentino_saldatore', known: [{ value: 'Tig', placeholder: '[NOME]', token: true }] }
        );
        expect(diffs.welding_process).toEqual({ ai: 'Tig 141', human: 'Tig 135' });
    });

    it('redactFieldDiffsForAi: tiene le correzioni informative, omette quelle ridotte a segnaposto identico', () => {
        const out = redactFieldDiffsForAi({
            welder_name: { ai: 'Bianchi', human: 'Bianchi Luca' },
            certificate_number: { ai: null, human: 'ZZ-777/2024' },
            welding_process: { ai: '141', human: '135' },
        }, { docType: 'patentino_saldatore' });
        expect(out.welder_name).toBeUndefined();
        expect(out.certificate_number).toEqual({ ai: null, human: '[NUMERO_CERTIFICATO]' });
        expect(out.welding_process).toEqual({ ai: '141', human: '135' });
    });

    it('redactFeedbackExampleForAi: nome file, nomi e numeri non compaiono in alcuna forma', () => {
        const ex = redactFeedbackExampleForAi({
            file_name: '25-01341_Bianchi Luca_14732.pdf',
            action: 'corrected',
            ai_payload: { operator_name: 'Bianchi', certificate_number: 'ZZ-777/2024', welding_process: '141' },
            human_payload: {
                operator_name: 'Bianchi Luca',
                certificate_number: 'ZZ-777/2024',
                welding_process: '135',
                notes: 'Operatore Luca Bianchi, mail luca@example.test',
            },
            field_diffs: {
                operator_name: { ai: 'Bianchi', human: 'Bianchi Luca' },
                welding_process: { ai: '141', human: '135' },
            },
        }, 'qualifica_14732');
        const blob = JSON.stringify(ex);
        expect(blob).not.toMatch(/Bianchi|Luca|ZZ-777|example\.test|25-01341/);
        expect(ex.file_name).toBe('[FILE]');
        expect(ex.action).toBe('corrected');
        expect(ex.human_payload.welding_process).toBe('135');
        expect(ex.field_diffs.welding_process).toEqual({ ai: '141', human: '135' });
        expect(ex.human_payload.notes).toBe('Operatore [NOME] [NOME], mail [EMAIL]');
    });

    it('redactReferencePatternsForAi scarta i pattern numerici/personali delle qualifiche e ripulisce il resto', () => {
        const patterns = [
            { field_key: 'reference_number', from_pattern: 'ZZ-1', to_pattern: 'ZZ-2', hit_count: 9 },
            { field_key: 'wpqr_number', from_pattern: 'W1', to_pattern: 'W2', hit_count: 8 },
            { field_key: 'welding_process', from_pattern: '141', to_pattern: '135', hit_count: 7 },
            { field_key: 'issuing_body', from_pattern: 'ente x', to_pattern: 'ente x contatto a@b.test', hit_count: 3 },
        ];
        const qual = redactReferencePatternsForAi(patterns, 'patentino_saldatore');
        expect(qual.map((p) => p.field_key)).toEqual(['welding_process', 'issuing_body']);
        expect(qual[1].to_pattern).toBe('ente x contatto [EMAIL]');
        const wpqr = redactReferencePatternsForAi(patterns, 'wpqr');
        expect(wpqr).toHaveLength(4);
        expect(redactReferencePatternsForAi(null)).toEqual([]);
    });

    it('dropPlaceholderValues azzera i segnaposto ricopiati dall\'AI e lascia il resto', () => {
        const out = dropPlaceholderValues({
            welder_name: '[NOME]',
            certificate_number: ' [NUMERO_CERTIFICATO] ',
            welding_process: '135',
            thickness_min_mm: 3,
            welding_positions: ['PA'],
            notes: 'testo [NOME] dentro',
        });
        expect(out).toEqual({
            welder_name: null,
            certificate_number: null,
            welding_process: '135',
            thickness_min_mm: 3,
            welding_positions: ['PA'],
            notes: 'testo [NOME] dentro',
        });
    });
});

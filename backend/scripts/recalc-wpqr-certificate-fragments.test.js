'use strict';

const {
    planCertificateRecalc,
    buildReportCodeStaging,
    shouldReadCertificatePdf,
    planCompanyBackfill,
    assertApplyAllowed,
    resolveRuntime,
    resolveUploadDir,
    EXCLUDED_CERTIFICATE_IDS,
    TEST_DB,
    PROD_DB,
    REPORT_CODE_WARNING,
} = require('./recalc-wpqr-certificate-fragments');

describe('planCertificateRecalc', () => {
    it('lascia vuoto e numeri veri invariati', () => {
        expect(planCertificateRecalc({ id: 1, before: null, extracted: '24-1', hasFile: true }).action).toBe('unchanged');
        expect(planCertificateRecalc({ id: 2, before: '', extracted: '24-1', hasFile: true }).action).toBe('unchanged');
        expect(planCertificateRecalc({
            id: 4, before: null, extracted: '24-03390-01', hasFile: true,
        })).toMatchObject({ action: 'update', after: '24-03390-01', source: 'PDF' });
        expect(planCertificateRecalc({ id: 3, before: 'VB0377/23 rev.0', extracted: null, hasFile: false })).toMatchObject({
            action: 'unchanged', after: 'VB0377/23 rev.0',
        });
    });

    it('propone il numero estratto e azzera un frammento senza numero', () => {
        expect(planCertificateRecalc({
            id: 10, before: 'ifica', extracted: '24-03390-01', hasFile: true,
        })).toMatchObject({ action: 'update', after: '24-03390-01', reason: 'extracted', source: 'PDF' });
        expect(planCertificateRecalc({
            id: 11, before: 'o.', extracted: null, hasFile: true,
        })).toMatchObject({ action: 'clear', after: null, reason: 'cleared_no_number', source: 'vuoto' });
        expect(planCertificateRecalc({
            id: 12, before: 'o. Risultati', extracted: null, hasFile: false,
        })).toMatchObject({ action: 'clear', after: null, reason: 'no_file', source: 'vuoto' });
    });

    it('tiene il numero già presente e non legge il PDF se la pulizia basta', () => {
        expect(planCertificateRecalc({
            id: 22, before: 'o. 16VE01735PO1/A', extracted: null, hasFile: false,
        })).toMatchObject({
            action: 'update', after: '16VE01735PO1/A', proposed: '16VE01735PO1/A', source: 'pulizia',
        });
        expect(planCertificateRecalc({
            id: 23, before: 'o. 16VE01735PO2/A Page 2/4', extracted: null, hasFile: false,
        })).toMatchObject({ action: 'update', after: '16VE01735PO2/A', source: 'pulizia' });
        expect(planCertificateRecalc({
            id: 24, before: 'o. 16 VE01735PO3/A', extracted: null, hasFile: false,
        })).toMatchObject({ action: 'update', after: '16VE01735PO3/A', source: 'pulizia' });
        expect(shouldReadCertificatePdf('o. 16VE01735PO1/A')).toBe(false);
        expect(shouldReadCertificatePdf('VB0377/23 rev.0')).toBe(false);
        expect(shouldReadCertificatePdf('o.')).toBe(true);
        expect(shouldReadCertificatePdf(null)).toBe(true);
    });

    it('non azzera un valore con una cifra e propone il codice rapporto solo da confermare', () => {
        expect(planCertificateRecalc({
            id: 30, before: 'o. 12', extracted: null, hasFile: true, wpqrCode: 'VB0387/23 rev.0',
        })).toMatchObject({ action: 'unchanged', after: 'o. 12', reason: 'kept_has_digit' });
        expect(planCertificateRecalc({
            id: 31, before: 'Risultati', extracted: null, hasFile: true, wpqrCode: '25-03776-01',
        })).toMatchObject({
            action: 'propose_confirm',
            after: 'Risultati',
            proposed: '25-03776-01',
            source: 'codice rapporto da confermare',
        });
        expect(planCertificateRecalc({
            id: 32, before: null, extracted: null, hasFile: false, referenceNumber: '002p_24/24-03390-01',
        })).toMatchObject({
            action: 'propose_confirm',
            after: null,
            proposed: '002p_24/24-03390-01',
            source: 'codice rapporto da confermare',
        });
        expect(planCertificateRecalc({
            id: 33, before: 'o.', extracted: null, hasFile: true, wpqrCode: 'VB0387/23 rev.0',
        })).toMatchObject({ action: 'clear', after: null, source: 'vuoto' });
        const staging = buildReportCodeStaging(
            { id: 31, organization_id: 1005, company_id: 49, wpqr_code: '25-03776-01', certificate_file_url: 'uploads/a.pdf' },
            planCertificateRecalc({ id: 31, before: 'Risultati', extracted: null, hasFile: true, wpqrCode: '25-03776-01' }),
        );
        expect(staging.fieldScope).toBe('wpqr_certificate_number');
        expect(staging.fields.wpqr_certificate_number).toBe('25-03776-01');
        expect(staging.warnings).toEqual([REPORT_CODE_WARNING]);
        expect(staging.aiModel).toBeNull();
        expect(buildReportCodeStaging(
            { id: 38, organization_id: 1005, wpqr_code: '25-03776-01' },
            { action: 'propose_confirm', proposed: '25-03776-01' },
        )).toBeNull();
    });

    it('elenca 38 e 39 ma non li scrive', () => {
        expect(EXCLUDED_CERTIFICATE_IDS).toEqual([38, 39]);
        const plan = planCertificateRecalc({
            id: 38, before: 'o. 16VE01735PO1/A', extracted: '16VE01735PO1/A', hasFile: true,
        });
        expect(plan).toMatchObject({
            action: 'skip_excluded', proposed: '16VE01735PO1/A', after: 'o. 16VE01735PO1/A', source: 'pulizia',
        });
    });

    it('un PDF illeggibile non cancella il frammento', () => {
        expect(planCertificateRecalc({
            id: 14, before: 'ifica', extracted: null, hasFile: true, readError: true,
        })).toMatchObject({ action: 'unchanged', after: 'ifica', reason: 'read_error' });
    });
});

describe('apply e backfill azienda', () => {
    it('rifiuta la scrittura fuori dal database di TEST', () => {
        expect(() => assertApplyAllowed({ nodeEnv: 'production', dbName: PROD_DB, apply: true }))
            .toThrow(/TEST/);
        expect(() => assertApplyAllowed({ nodeEnv: 'test', dbName: 'SGQ_ISO9001', apply: true }))
            .toThrow(/TEST/);
        expect(() => assertApplyAllowed({ nodeEnv: 'test', dbName: TEST_DB, apply: true })).not.toThrow();
        expect(() => assertApplyAllowed({ nodeEnv: 'production', dbName: PROD_DB, apply: false })).not.toThrow();
    });

    it('resolveRuntime non consente --apply su PROD', () => {
        expect(() => resolveRuntime({ apply: true, backfillCompany: false, target: 'prod' })).toThrow(/PROD/);
        const prod = resolveRuntime({ apply: false, backfillCompany: false, target: 'prod' });
        expect(prod.apply).toBe(false);
        expect(prod.expectedDb).toBe(PROD_DB);
        const test = resolveRuntime({ apply: true, backfillCompany: true, target: 'test' });
        expect(test.apply).toBe(true);
        expect(test.expectedDb).toBe(TEST_DB);
        expect(test.nodeEnv).toBe('test');
    });

    it('cerca gli upload nella cartella del bersaglio, non in quella da cui parte il comando', () => {
        const path = require('path');
        expect(resolveUploadDir(undefined, '/var/www/sgq-backend'))
            .toBe(path.resolve('/var/www/sgq-backend', 'uploads'));
        expect(resolveUploadDir('uploads', '/var/www/sgq-backend'))
            .toBe(path.resolve('/var/www/sgq-backend', 'uploads'));
        expect(resolveUploadDir('/data/uploads', '/var/www/sgq-backend')).toBe('/data/uploads');
    });

    it('copia company_id solo se manca e la WPS ne ha uno', () => {
        expect(planCompanyBackfill({ id: 1, companyId: null, wpsCompanyId: 49 })).toMatchObject({
            action: 'update', company_id: 49,
        });
        expect(planCompanyBackfill({ id: 2, companyId: 50, wpsCompanyId: 49 }).action).toBe('unchanged');
        expect(planCompanyBackfill({ id: 3, companyId: null, wpsCompanyId: null }).action).toBe('unchanged');
    });
});

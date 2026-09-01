/**
 * @jest-environment node
 */

jest.mock('../config/database', () => ({
  query: jest.fn(),
}));

jest.mock('../utils/logger', () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
}));

jest.mock('./caseExtractedCoverage.service', () => ({
  loadExtractedRequirements: jest.fn(),
  computeCaseProjectCoverage: jest.fn(),
}));

jest.mock('./caseCoverageAdvisory.service', () => ({
  buildCaseCoverageAdvisory: jest.fn(),
}));

jest.mock('../utils/extractedRequirementsProfile', () => ({
  buildTechnicalProfile: jest.fn(),
  profileHasTechnicalData: jest.fn(),
}));

const { query } = require('../config/database');
const {
  loadExtractedRequirements,
  computeCaseProjectCoverage,
} = require('./caseExtractedCoverage.service');
const { buildCaseCoverageAdvisory } = require('./caseCoverageAdvisory.service');
const {
  buildTechnicalProfile,
  profileHasTechnicalData,
} = require('../utils/extractedRequirementsProfile');
const {
  COMPANY_ID_REQUIRED_MSG,
  deriveReportStatus,
  buildGapsList,
  buildCapabilityGapReport,
  getPersistedCapabilityGapReport,
  regenerateAndPersistCapabilityGapReport,
  maybeRefreshCapabilityGapReport,
} = require('./caseCapabilityGapReport.service');

describe('caseCapabilityGapReport.service (VC-1)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('deriveReportStatus: need_input senza profilo né coverage', () => {
    expect(
      deriveReportStatus({
        profileActive: false,
        coverageSummary: null,
        wpqrSummary: null,
        visionSummary: null,
        gaps: [],
      }),
    ).toBe('need_input');
  });

  test('deriveReportStatus: gap se WPS uncovered', () => {
    expect(
      deriveReportStatus({
        profileActive: true,
        coverageSummary: { total: 1, covered: 0, partial: 0, uncovered: 1 },
        wpqrSummary: { need_input: 0, not_possible: 0, partial: 0 },
        visionSummary: { missing: 0, expired: 0 },
        gaps: [{ severity: 'gap' }],
      }),
    ).toBe('gap');
  });

  test('deriveReportStatus: ok se nessun gap', () => {
    expect(
      deriveReportStatus({
        profileActive: true,
        coverageSummary: { total: 1, covered: 1, partial: 0, uncovered: 0 },
        wpqrSummary: { need_input: 0, not_possible: 0, partial: 0, ok: 1 },
        visionSummary: { missing: 0, expired: 0, ok: 1 },
        gaps: [],
      }),
    ).toBe('ok');
  });

  test('buildGapsList include WPS e visione', () => {
    const gaps = buildGapsList({
      profileActive: true,
      coverage: {
        has_wps: true,
        coverage: [
          { wps_id: 1, wps_code: 'WPS-A', esito: 'rosso' },
          { wps_id: 2, wps_code: 'WPS-B', esito: 'verde' },
        ],
      },
      advisory: {
        wpqr_joints: { joints: [] },
        vision_fitness: {
          gaps: [{ person_name: 'ROSSI', vision_state: 'missing' }],
        },
      },
    });
    expect(gaps.some((g) => g.code === 'WPS_UNCOVERED')).toBe(true);
    expect(gaps.some((g) => g.code === 'VISION_MISSING')).toBe(true);
  });

  test('buildCapabilityGapReport: senza company_id → 400 COMPANY_ID_REQUIRED', async () => {
    query.mockResolvedValueOnce({
      recordset: [{ id: 9, organization_id: 1, company_id: null, title: 'X' }],
    });

    await expect(
      buildCapabilityGapReport({ caseId: 9, organizationId: 1 }),
    ).rejects.toMatchObject({
      code: 'COMPANY_ID_REQUIRED',
      httpStatus: 400,
      message: COMPANY_ID_REQUIRED_MSG,
    });
  });

  test('buildCapabilityGapReport: aggrega advisory senza duplicare motore (no project)', async () => {
    query
      .mockResolvedValueOnce({
        recordset: [{ id: 9, organization_id: 42, company_id: 178, title: 'Caso' }],
      })
      .mockResolvedValueOnce({ recordset: [] }); // linked project none

    loadExtractedRequirements.mockResolvedValue([
      { field_key: 'material_group', value_text: '1.2', review_status: 'confirmed' },
    ]);
    buildTechnicalProfile.mockReturnValue({
      base_material_group: '1.2',
      thickness_range_min: 5,
      thickness_range_max: 8,
    });
    profileHasTechnicalData.mockReturnValue(true);
    buildCaseCoverageAdvisory.mockResolvedValue({
      blocking: false,
      wpqr_joints: {
        source: 'extracted_requirements',
        joints: [{ joint_key: 'extracted-1', label: 'Giunto', status: 'ok', questions: [] }],
        summary: { total: 1, ok: 1, partial: 0, not_possible: 0, need_input: 0, skipped: 0 },
      },
      vision_fitness: {
        company_id: 178,
        gaps: [],
        summary: { persons_requiring: 0, missing: 0, expired: 0, ok: 0 },
      },
    });

    const report = await buildCapabilityGapReport({ caseId: 9, organizationId: 42 });

    expect(computeCaseProjectCoverage).not.toHaveBeenCalled();
    expect(buildCaseCoverageAdvisory).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: 42, companyId: 178 }),
    );
    expect(report.summary.status).toBe('ok');
    expect(report.company_id).toBe(178);
    expect(report.gaps).toEqual([]);
    expect(report.version).toBe(1);
  });

  test('getPersistedCapabilityGapReport: null se assente', async () => {
    query.mockResolvedValueOnce({
      recordset: [{
        id: 1,
        organization_id: 1,
        company_id: 2,
        title: 'T',
        capability_gap_report_json: null,
        capability_gap_report_at: null,
      }],
    });
    const report = await getPersistedCapabilityGapReport({ caseId: 1, organizationId: 1 });
    expect(report).toBeNull();
  });

  test('regenerateAndPersistCapabilityGapReport: scrive JSON e ritorna report', async () => {
    query
      .mockResolvedValueOnce({
        recordset: [{ id: 9, organization_id: 42, company_id: 178, title: 'Caso' }],
      })
      .mockResolvedValueOnce({ recordset: [] })
      .mockResolvedValueOnce({
        recordset: [{ id: 9, capability_gap_report_at: new Date('2026-09-01T10:00:00Z') }],
      });

    loadExtractedRequirements.mockResolvedValue([]);
    buildTechnicalProfile.mockReturnValue({});
    profileHasTechnicalData.mockReturnValue(false);
    buildCaseCoverageAdvisory.mockResolvedValue({
      blocking: false,
      wpqr_joints: { joints: [], summary: { total: 0, ok: 0, partial: 0, not_possible: 0, need_input: 0, skipped: 0 } },
      vision_fitness: { gaps: [], summary: { persons_requiring: 0, missing: 0, expired: 0, ok: 0 } },
    });

    const report = await regenerateAndPersistCapabilityGapReport({
      caseId: 9,
      organizationId: 42,
    });

    expect(report.summary.status).toBe('need_input');
    expect(query).toHaveBeenCalledTimes(3);
    const updateCall = query.mock.calls[2];
    expect(updateCall[0]).toMatch(/capability_gap_report_json/);
    expect(JSON.parse(updateCall[1].json).summary.status).toBe('need_input');
  });
});

describe('maybeRefreshCapabilityGapReport (VC-3)', () => {
  beforeEach(() => jest.clearAllMocks());

  test('skip no_company senza lanciare', async () => {
    query.mockResolvedValueOnce({
      recordset: [{ id: 9, organization_id: 42, company_id: null, title: 'Caso' }],
    });
    const out = await maybeRefreshCapabilityGapReport({ caseId: 9, organizationId: 42 });
    expect(out).toEqual({ refreshed: false, skipped: true, reason: 'no_company' });
  });

  test('skip not_found', async () => {
    query.mockResolvedValueOnce({ recordset: [] });
    const out = await maybeRefreshCapabilityGapReport({ caseId: 99, organizationId: 1 });
    expect(out).toEqual({ refreshed: false, skipped: true, reason: 'not_found' });
  });

  test('refreshed true quando company presente', async () => {
    query
      .mockResolvedValueOnce({
        recordset: [{ id: 9, organization_id: 42, company_id: 178, title: 'Caso' }],
      })
      .mockResolvedValueOnce({ recordset: [] })
      .mockResolvedValueOnce({
        recordset: [{ id: 9, capability_gap_report_at: new Date('2026-09-01T12:00:00Z') }],
      });
    loadExtractedRequirements.mockResolvedValue([]);
    buildTechnicalProfile.mockReturnValue({});
    profileHasTechnicalData.mockReturnValue(false);
    buildCaseCoverageAdvisory.mockResolvedValue({
      blocking: false,
      wpqr_joints: { joints: [], summary: { total: 0, ok: 0, partial: 0, not_possible: 0, need_input: 0, skipped: 0 } },
      vision_fitness: { gaps: [], summary: { persons_requiring: 0, missing: 0, expired: 0, ok: 0 } },
    });

    const out = await maybeRefreshCapabilityGapReport({ caseId: 9, organizationId: 42 });
    expect(out.refreshed).toBe(true);
    expect(out.report?.summary?.status).toBe('need_input');
  });
});

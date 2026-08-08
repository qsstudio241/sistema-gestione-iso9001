/**
 * @jest-environment node
 */

jest.mock('./wpsGenerator.service', () => ({
  generateWpsFromWpqr: jest.fn(),
}));

jest.mock('./visionFitness.service', () => ({
  findVisionFitnessGaps: jest.fn(),
}));

const { generateWpsFromWpqr } = require('./wpsGenerator.service');
const { findVisionFitnessGaps } = require('./visionFitness.service');
const {
  buildJointRequestsFromSources,
  buildCaseCoverageAdvisory,
} = require('./caseCoverageAdvisory.service');

describe('caseCoverageAdvisory.service (P5)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('buildJointRequestsFromSources preferisce profilo estratto', () => {
    const { source, requests } = buildJointRequestsFromSources(
      {
        base_material_group: '1.2',
        thickness_range_min: 5,
        thickness_range_max: 10,
        welding_process: '135',
      },
      [{ id: 1, wps_code: 'WPS-1', base_material_group: '8.1' }],
    );
    expect(source).toBe('extracted_requirements');
    expect(requests).toHaveLength(1);
    expect(requests[0].request.parent_material_a).toBe('1.2');
    expect(requests[0].request.thickness_a_mm).toBe(5);
  });

  test('buildJointRequestsFromSources cade sulle WPS se profilo vuoto', () => {
    const { source, requests } = buildJointRequestsFromSources(
      {},
      [{
        id: 9,
        wps_code: 'WPS-9',
        welding_process: '135',
        base_material_group: '1.1',
        thickness_range_min: 3,
        thickness_range_max: 12,
      }],
    );
    expect(source).toBe('project_wps');
    expect(requests).toHaveLength(1);
    expect(requests[0].label).toContain('WPS-9');
  });

  test('buildCaseCoverageAdvisory aggrega WPQR + visione senza blocking', async () => {
    generateWpsFromWpqr.mockResolvedValue({
      status: 'need_input',
      questions: [{ field: 'joint_type', question: 'Tipo giunto?' }],
      extensions_needed: [],
      warnings: [],
      wpqr_used: null,
    });
    findVisionFitnessGaps.mockResolvedValue({
      gaps: [{
        person_name: 'LUIGI LA FORGIA',
        vision_state: 'missing',
        requiring_quals: [{ id: 1 }],
      }],
      summary: { persons_requiring: 1, missing: 1, expired: 0, ok: 0 },
    });

    const advisory = await buildCaseCoverageAdvisory({
      organizationId: 1004,
      companyId: 178,
      extractedProfile: {
        base_material_group: '1.2',
        thickness_range_min: 10,
        thickness_range_max: 10,
      },
      wpsRows: [],
    });

    expect(advisory.blocking).toBe(false);
    expect(advisory.wpqr_joints.joints[0].status).toBe('need_input');
    expect(advisory.vision_fitness.gaps).toHaveLength(1);
    expect(advisory.vision_fitness.gaps[0].person_name).toMatch(/FORGIA/);
  });
});

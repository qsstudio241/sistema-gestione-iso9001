const {
    JOINT_TYPE_PROFILES,
    getJointTypeProfile,
    listJointTypeProfileKeys,
    uses9606DimensionalBlock,
    getVisibleFieldKeys,
} = require('./jointTypeProfiles');

describe('jointTypeProfiles', () => {
    it('espone BW e FW; un terzo tipo si aggiunge come nuova chiave', () => {
        expect(listJointTypeProfileKeys()).toEqual(['BW', 'FW']);
        expect(getJointTypeProfile('fw').thicknessKind).toBe('material_t');
        expect(getJointTypeProfile('BW').testThicknessKey).toBe('thickness_s_test_mm');
        expect(JOINT_TYPE_PROFILES.STUD).toBeUndefined();
    });

    it('BW mostra s e nasconde t; FW il contrario', () => {
        const bw = getVisibleFieldKeys({ jointType: 'BW', productType: 'P', qualificationType: 'Saldatore ISO 9606-1' });
        expect(bw.keys).toContain('thickness_s_test_mm');
        expect(bw.keys).not.toContain('thickness_t_test_mm');
        expect(bw.keys).not.toContain('pipe_diameter_test_mm');
        const fw = getVisibleFieldKeys({ jointType: 'FW', productType: 'T', qualificationType: 'Saldatore ISO 9606-1' });
        expect(fw.keys).toContain('thickness_t_test_mm');
        expect(fw.keys).not.toContain('thickness_s_test_mm');
        expect(fw.keys).toContain('pipe_diameter_test_mm');
    });

    it('14732 non usa il blocco dimensionale 9606', () => {
        expect(uses9606DimensionalBlock('Operatore ISO 14732')).toBe(false);
        const vis = getVisibleFieldKeys({ jointType: 'FW', qualificationType: 'Operatore ISO 14732' });
        expect(vis.dimensionalEnabled).toBe(false);
        expect(vis.keys).toEqual([]);
    });
});

'use strict';

/**
 * Profili tipo giunto ISO 9606-1 — BW / FW come registry scalabile.
 * Mirror: app/src/data/jointTypeProfiles.js (stesso contratto campi).
 *
 * Per un terzo tipo (STUD, derivazione, …): aggiungi una chiave in
 * JOINT_TYPE_PROFILES con campi visibili, spessore di prova e dettagli giunto.
 * Ingest e form non usano `if (fw) else`.
 *
 * ISO 14732: niente tabelle 9606 — `uses9606DimensionalBlock` è false.
 *
 * Varianti per norma (VQ-10): `JOINT_TYPE_PROFILES` resta il profilo ISO 9606-1 (default, invariato).
 * `JOINT_TYPE_PROFILES_BY_STANDARD['9606-2']` ridefinisce solo ciò che cambia: in ISO 9606-2 lo spessore di prova
 * è `t` del MATERIALE anche per BW (Tab. 3), non `s` depositato (Tab. 6 di 9606-1); per FW è Tab. 5. Il
 * metodo di trasferimento non esiste in 9606-2 (Annex A). Per 9606-1 BW resta `s` (deposito) e FW `t`.
 */

const DATE_FIELD_KEYS = [
    'exam_date',
    'issue_date',
    'expiry_date',
    'last_confirmation_date',
    'next_confirmation_due',
    'revalidation_date',
    'last_renewal_date',
];

const COMMON_9606_KEYS = [
    'welding_process_test',
    'welding_processes_validity',
    'product_type',
    'filler_material',
    'welding_position_test',
    'position_range',
    'weld_details',
    'qualification_designation',
    'pipe_diameter_test_mm',
    'pipe_diameter_min_mm',
    'pipe_diameter_max_mm',
    'transfer_mode',
    'shielding_gas',
    'material_group',
];

const JOINT_TYPE_PROFILES = {
    BW: {
        key: 'BW',
        label: 'Testa a testa (Butt Weld)',
        standard: 'ISO 9606-1',
        testThicknessKey: 'thickness_s_test_mm',
        testThicknessLabel: 'Spessore depositato s — prova (mm)',
        testThicknessHint: 's del provino (BV). Range di validità: Tabella 6 ISO 9606-1. Non copiare su FW.',
        validityThicknessHint: 'Campo di validità s/t secondo ISO 9606-1 Tabella 6. Non ricalcolare la designazione stampata.',
        validityTable: '6',
        thicknessKind: 'deposited_s',
        extraVisibleKeys: ['thickness_s_test_mm', 'thickness_min_mm', 'thickness_max_mm', 'thickness_max_unlimited'],
        hiddenKeys: ['thickness_t_test_mm'],
        jointDetailHint: 'ss/bs, backing (nb/mb), sl/ml se dichiarati sul certificato',
    },
    FW: {
        key: 'FW',
        label: 'Angolare (Fillet Weld)',
        standard: 'ISO 9606-1',
        testThicknessKey: 'thickness_t_test_mm',
        testThicknessLabel: 'Spessore materiale t del provino — prova (mm)',
        testThicknessHint: 't del materiale del provino (FV). Range di validità: Tabella 8 ISO 9606-1. Non usare a/z come campi 9606-1.',
        validityThicknessHint: 'Campo di validità secondo ISO 9606-1 Tabella 8. Non ricalcolare la designazione stampata.',
        validityTable: '8',
        thicknessKind: 'material_t',
        extraVisibleKeys: ['thickness_t_test_mm', 'thickness_min_mm', 'thickness_max_mm', 'thickness_max_unlimited'],
        hiddenKeys: ['thickness_s_test_mm'],
        jointDetailHint: 'ss/bs, backing, sl/ml se dichiarati sul certificato',
    },
};

const STANDARD_9606_1 = '9606-1';
const STANDARD_9606_2 = '9606-2';

const JOINT_TYPE_PROFILES_9606_2 = {
    BW: {
        key: 'BW',
        label: 'Testa a testa (Butt Weld)',
        standard: 'ISO 9606-2',
        testThicknessKey: 'thickness_t_test_mm',
        testThicknessLabel: 'Spessore materiale t del provino — prova (mm)',
        testThicknessHint: 't del materiale del provino (non lo spessore depositato s di ISO 9606-1). Range di validità: Tabella 3 ISO 9606-2.',
        validityThicknessHint: 'Campo di validità dello spessore del materiale secondo ISO 9606-2 Tabella 3. Non ricalcolare la designazione stampata.',
        validityTable: '3',
        thicknessKind: 'material_t',
        extraVisibleKeys: ['thickness_t_test_mm', 'thickness_min_mm', 'thickness_max_mm', 'thickness_max_unlimited'],
        hiddenKeys: ['thickness_s_test_mm'],
        hiddenCommonKeys: ['transfer_mode'],
        jointDetailHint: 'ss nb / ss mb / bs (Tab. 7), sl/ml se dichiarati sul certificato',
    },
    FW: {
        key: 'FW',
        label: 'Angolare (Fillet Weld)',
        standard: 'ISO 9606-2',
        testThicknessKey: 'thickness_t_test_mm',
        testThicknessLabel: 'Spessore materiale t del provino — prova (mm)',
        testThicknessHint: 't del materiale del provino. Range di validità: Tabella 5 ISO 9606-2.',
        validityThicknessHint: 'Campo di validità secondo ISO 9606-2 Tabella 5. Non ricalcolare la designazione stampata.',
        validityTable: '5',
        thicknessKind: 'material_t',
        extraVisibleKeys: ['thickness_t_test_mm', 'thickness_min_mm', 'thickness_max_mm', 'thickness_max_unlimited'],
        hiddenKeys: ['thickness_s_test_mm'],
        hiddenCommonKeys: ['transfer_mode'],
        jointDetailHint: 'sl/ml (Tab. 8) se dichiarati sul certificato',
    },
};

const JOINT_TYPE_PROFILES_BY_STANDARD = {
    [STANDARD_9606_1]: JOINT_TYPE_PROFILES,
    [STANDARD_9606_2]: JOINT_TYPE_PROFILES_9606_2,
};

/**
 * Famiglia di norma dei profili: `9606-2` se il testo (tipo qualifica o riferimento norma) cita ISO 9606-2,
 * altrimenti `9606-1` (default storico). Accetta anche la chiave diretta `'9606-2'`.
 */
function resolveProfileStandard(text) {
    return /9606[\s-]*2(?!\d)/i.test(String(text || '')) ? STANDARD_9606_2 : STANDARD_9606_1;
}

function profileTableFor(standard) {
    return JOINT_TYPE_PROFILES_BY_STANDARD[resolveProfileStandard(standard)];
}

/**
 * @param {string} code BW | FW
 * @param {{ standard?: string|null }} [opts] `standard`: famiglia (`'9606-2'`) o testo che la contiene;
 *   assente = ISO 9606-1 (comportamento invariato).
 */
function getJointTypeProfile(code, { standard = null } = {}) {
    const k = String(code || '').trim().toUpperCase();
    return profileTableFor(standard)[k] || null;
}

function listJointTypeProfileKeys() {
    return Object.keys(JOINT_TYPE_PROFILES);
}

function uses9606DimensionalBlock(qualificationType) {
    const t = String(qualificationType || '');
    if (/14732/i.test(t)) return false;
    return /9606/i.test(t);
}

function isPipeDiameterApplicable(productType) {
    const pt = String(productType || '').toUpperCase().trim();
    return pt !== 'P';
}

function getVisibleFieldKeys({ jointType, productType, qualificationType } = {}) {
    const datesLast = [...DATE_FIELD_KEYS];
    if (!uses9606DimensionalBlock(qualificationType)) {
        return {
            profile: null,
            keys: [],
            datesLast,
            dimensionalEnabled: false,
            profileGated: false,
        };
    }
    const standard = resolveProfileStandard(qualificationType);
    const profile = getJointTypeProfile(jointType, { standard });
    const hiddenCommon = new Set((profile && profile.hiddenCommonKeys) || []);
    if (!profile) {
        const keys = COMMON_9606_KEYS.filter((k) => !String(k).startsWith('pipe_diameter') || isPipeDiameterApplicable(productType));
        return {
            profile: null,
            keys,
            datesLast,
            dimensionalEnabled: false,
            profileGated: true,
        };
    }
    let keys = [...COMMON_9606_KEYS, ...profile.extraVisibleKeys];
    const hidden = new Set([...(profile.hiddenKeys || []), ...hiddenCommon]);
    keys = keys.filter((k) => !hidden.has(k));
    if (!isPipeDiameterApplicable(productType)) {
        keys = keys.filter((k) => !String(k).startsWith('pipe_diameter'));
    }
    return {
        profile,
        keys,
        datesLast,
        dimensionalEnabled: true,
        profileGated: false,
    };
}

function fieldIsVisible(key, ctx) {
    return getVisibleFieldKeys(ctx).keys.includes(key);
}

function buildProfilePromptSection(profileKey, { standard = null } = {}) {
    const profile = getJointTypeProfile(profileKey, { standard });
    if (!profile) {
        return `
--- PROFILO GIUNTO NON ANCORA NOTO ---
Estrai prima joint_type (BW|FW) e la riga stampata "ISO 9606-1: …" in qualification_designation.
NON inventare range. Distingui prova vs validità.
--- FINE PROFILO ---`.trim();
    }
    const testKey = profile.testThicknessKey;
    return `
--- PROFILO GIUNTO ${profile.key} (${profile.label}) ---
Due colonne sullo stesso record: PROVA vs VALIDITÀ. Non collassarle.
- welding_process_test: processo ISO 4063 della prova (codice sul rigo designazione).
- welding_processes_validity: processi coperti in validità (elenco, es. "135, 138"), distinti dalla prova.
- welding_position_test: posizione della prova; welding_positions = posizioni di validità.
- ${testKey}: ${profile.testThicknessHint}
- thickness_min_mm / thickness_max_mm / thickness_max_unlimited: SOLO campo di validità (Tabella ${profile.validityTable}), come stampato. Non copiare il valore di prova se il certificato ha un range diverso.
- pipe_diameter_test_mm vs pipe_diameter_mm (validità): solo se prodotto T.
- qualification_designation: stringa STAMPATA sul certificato (riga ${profile.standard}: …). NON ricalcolarla da min/max.
- weld_details: ${profile.jointDetailHint}
NON usare a/z come campi ${profile.standard.replace('ISO ', '')}. NON copiare spessore BW su FW o viceversa.
--- FINE PROFILO ${profile.key} ---`.trim();
}

module.exports = {
    DATE_FIELD_KEYS,
    COMMON_9606_KEYS,
    JOINT_TYPE_PROFILES,
    JOINT_TYPE_PROFILES_9606_2,
    JOINT_TYPE_PROFILES_BY_STANDARD,
    resolveProfileStandard,
    getJointTypeProfile,
    listJointTypeProfileKeys,
    uses9606DimensionalBlock,
    isPipeDiameterApplicable,
    getVisibleFieldKeys,
    fieldIsVisible,
    buildProfilePromptSection,
};

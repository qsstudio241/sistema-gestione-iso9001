'use strict';

/**
 * Regole di calcolo range di qualificazione ISO 15614-1:2017 — fonte unica per
 * UI, ingest e assistente AI su WPQR (procedure di saldatura).
 * Mantenere sincronizzato con app/src/data/weldingQualificationRules15614.js
 *
 * Estratto operativo: docs/reference/ISO-15614-1-range-validita-WPQR.md
 * Codifica regole verificate (26/07/2026 + P0 30/07/2026): Tabella 8 (gola),
 * Tabella 9 (diametro Level 2 + piastra->tubo), spessore minimo con prova d'urto,
 * Tabella 7 Level 2 bande 3-40mm, Tabella 5 acciai (matrice + footnote a/b/c).
 * Tabella 6 nichel: non implementata (stub). Tabella 7 Level 1: GAP estrazione.
 */

/**
 * Matrice ISO 15614-1 Tabella 5 (acciai, gruppi 1-11).
 * Chiave: gruppo materiale A del provino -> gruppo B -> combinazioni qualificate "X-Y".
 * Fonte: tabelle Markdown in NORMA_00019 (celle pulite), non testo a flusso.
 * @type {Record<number, Record<number, string[]>>}
 */
const TABLE_5_STEEL_COMBINATIONS = {
    1: { 1: ['1-1'] },
    2: {
        1: ['1-1', '2-1'],
        2: ['1-1', '2-1', '2-2'],
    },
    3: {
        1: ['1-1', '2-1', '3-1'],
        2: ['1-1', '2-1', '2-2', '3-1', '3-2'],
        3: ['1-1', '2-1', '2-2', '3-1', '3-2', '3-3'],
    },
    4: {
        1: ['4-1'],
        2: ['4-1', '4-2'],
        3: ['4-1', '4-2', '4-3'],
        4: ['4-1', '4-2', '4-3', '4-4'],
    },
    5: {
        1: ['5-1'],
        2: ['5-2'],
        3: ['5-3'],
        4: ['5-4'],
        5: ['5-1', '5-2', '5-5'],
    },
    6: {
        1: ['6-1'],
        2: ['6-1', '6-2'],
        3: ['6-1', '6-2', '6-3'],
        4: ['6-1', '6-2', '6-3', '6-4'],
        5: ['6-1', '6-2', '6-3', '6-4', '6-5'],
        6: ['6-1', '6-2', '6-3', '6-4', '6-5', '6-6'],
    },
    7: {
        1: ['7-1'],
        2: ['7-1', '7-2'],
        3: ['7-1', '7-2', '7-3'],
        4: ['7-4'],
        5: ['7-5'],
        6: ['7-5', '7-6'],
        7: ['7-7'],
    },
    8: {
        1: ['8-1'],
        2: ['8-1', '8-2'],
        3: ['8-1', '8-2', '8-3'],
        4: ['8-4'],
        5: ['8-1', '8-2', '8-4', '8-5', '8-6'],
        6: ['8-1', '8-2', '8-4', '8-5', '8-6'],
        7: ['8-7'],
        8: ['8-8'],
    },
    9: {
        1: ['9-1'],
        2: ['9-1', '9-2'],
        3: ['9-1', '9-2', '9-3'],
        4: ['9-4'],
        5: ['9-5'],
        6: ['9-6'],
        7: ['9-7'],
        8: ['9-8'],
        9: ['9-9'],
    },
    10: {
        1: ['10-1'],
        2: ['10-1', '10-2'],
        3: ['10-1', '10-2', '10-3'],
        4: ['10-4'],
        5: ['10-1', '10-2', '10-3', '10-4', '10-6'],
        6: ['10-1', '10-2', '10-4', '10-6'],
        7: ['10-7'],
        8: ['10-8'],
        9: ['10-9'],
        10: ['10-10'],
    },
    11: {
        1: ['11-1', '1-1'],
        2: ['11-1', '11-2'],
        3: ['11-1', '11-2', '11-3'],
        4: ['11-4'],
        5: ['11-5'],
        6: ['11-6'],
        7: ['11-7'],
        8: ['11-8'],
        9: ['11-9'],
        10: ['11-10'],
        11: ['1-1', '11-1', '11-11'],
    },
};

/** Footnote (a): gruppi 1/2/3/11 — snervamento uguale o inferiore. */
const FOOTNOTE_A_GROUPS = new Set([1, 2, 3, 11]);
/** Footnote (b): stesso sottogruppo e sottogruppi inferiori. */
const FOOTNOTE_B_GROUPS = new Set([4, 5, 6, 8, 9]);
/** Footnote (c): solo stesso sottogruppo. */
const FOOTNOTE_C_GROUPS = new Set([7, 10]);

/** Rank snervamento relativo entro gruppo (piu' alto = Re maggiore). Bare group = null. */
const YIELD_RANK_BY_SUBGROUP = {
    '1.1': 1, '1.2': 2, '1.3': 3, '1.4': 1,
    '2.1': 1, '2.2': 2,
    '3.1': 1, '3.2': 2, '3.3': 3,
    '11.1': 1, '11.2': 2, '11.3': 3,
};

/** Gradi commerciali comuni → ISO/TR 15608 (P0 minimo + estensioni tipiche). */
const STEEL_GRADE_TO_GROUP = {
    S235: '1.1', S235JR: '1.1', S235J2: '1.1',
    S275: '1.1', S275JR: '1.1', S275N: '1.1',
    S355: '1.2', S355JR: '1.2', S355J2: '1.2', S355J2N: '1.2', S355N: '1.2',
    P235GH: '1.1', P265GH: '1.1', P355GH: '1.2',
    S420: '1.3', S460: '1.3',
};

/**
 * Normalizza '1.2' | '1' | 'group 1.2' → { group, subgroup }.
 * @param {unknown} code
 * @returns {{ group: number, subgroup: string|null } | null}
 */
function normalizeMaterialGroupCode(code) {
    if (code == null || code === '') return null;
    const raw = String(code).trim();
    if (!raw) return null;

    const cleaned = raw
        .replace(/^(gruppo|group|gr\.?|ISO\/?TR\s*15608)\s*/i, '')
        .replace(/,/g, '.')
        .trim();

    const m = cleaned.match(/^(\d{1,2})(?:\.(\d{1,2}))?$/);
    if (!m) return null;

    const group = Number(m[1]);
    if (!Number.isFinite(group) || group < 1) return null;

    const subgroup = m[2] != null ? `${group}.${m[2]}` : null;
    return { group, subgroup };
}

/**
 * @param {{ group: number, subgroup: string|null }} parsed
 * @returns {number|null} parte decimale del sottogruppo, o null se solo gruppo padre
 */
function subgroupDecimal(parsed) {
    if (!parsed || !parsed.subgroup) return null;
    const parts = parsed.subgroup.split('.');
    const n = Number(parts[1]);
    return Number.isFinite(n) ? n : null;
}

/**
 * @param {{ group: number, subgroup: string|null }} parsed
 * @returns {number|null}
 */
function yieldRank(parsed) {
    if (!parsed) return null;
    if (!parsed.subgroup) return null; // gruppo padre: nessuna restrizione sottogruppo
    if (Object.prototype.hasOwnProperty.call(YIELD_RANK_BY_SUBGROUP, parsed.subgroup)) {
        return YIELD_RANK_BY_SUBGROUP[parsed.subgroup];
    }
    return subgroupDecimal(parsed);
}

/**
 * Verifica se la combinazione genitori e' tra quelle elencate in cella Tabella 5.
 * @param {string[]} combos
 * @param {number} groupA
 * @param {number} groupB
 */
function matrixListsParentCombo(combos, groupA, groupB) {
    if (!Array.isArray(combos) || !combos.length) return false;
    const key1 = `${groupA}-${groupB}`;
    const key2 = `${groupB}-${groupA}`;
    return combos.includes(key1) || combos.includes(key2);
}

/**
 * Footnote a/b/c su sottogruppi, quando entrambi i genitori sono nello stesso gruppo del provino.
 * @returns {{ ok: boolean, reason: string }}
 */
function checkSubgroupFootnotes(tested, parentA, parentB) {
    const g = tested.group;

    if (FOOTNOTE_A_GROUPS.has(g) && parentA.group === g && parentB.group === g) {
        const tRank = yieldRank(tested);
        if (tRank == null) {
            return { ok: true, reason: 'Footnote (a): gruppo padre senza sottogruppo — copre i sottogruppi del gruppo ' + g };
        }
        const rankA = yieldRank(parentA);
        const rankB = yieldRank(parentB);
        // Genitore senza sottogruppo: non possiamo dimostrare Re inferiore → non coperto in modo sicuro
        if (rankA == null || rankB == null) {
            return {
                ok: false,
                reason: 'Footnote (a): sottogruppo genitore assente — non verificabile snervamento uguale/inferiore',
            };
        }
        if (rankA <= tRank && rankB <= tRank) {
            return {
                ok: true,
                reason: 'Footnote (a): snervamento genitori uguale o inferiore al materiale di prova',
            };
        }
        return {
            ok: false,
            reason: 'Footnote (a): snervamento genitore superiore al materiale di prova (non coperto)',
        };
    }

    if (FOOTNOTE_B_GROUPS.has(g) && parentA.group === g && parentB.group === g) {
        const tSub = subgroupDecimal(tested);
        if (tSub == null) {
            return { ok: true, reason: 'Footnote (b): gruppo padre — copre i sottogruppi del gruppo ' + g };
        }
        const a = subgroupDecimal(parentA);
        const b = subgroupDecimal(parentB);
        if (a == null || b == null) {
            return { ok: false, reason: 'Footnote (b): sottogruppo genitore assente' };
        }
        if (a <= tSub && b <= tSub) {
            return { ok: true, reason: 'Footnote (b): stesso sottogruppo o sottogruppo inferiore' };
        }
        return { ok: false, reason: 'Footnote (b): sottogruppo genitore superiore al provino' };
    }

    if (FOOTNOTE_C_GROUPS.has(g) && parentA.group === g && parentB.group === g) {
        const tSub = subgroupDecimal(tested);
        if (tSub == null) {
            return { ok: true, reason: 'Footnote (c): gruppo padre — copertura a livello di gruppo' };
        }
        const a = subgroupDecimal(parentA);
        const b = subgroupDecimal(parentB);
        if (a === tSub && b === tSub) {
            return { ok: true, reason: 'Footnote (c): stesso sottogruppo del provino' };
        }
        return { ok: false, reason: 'Footnote (c): solo lo stesso sottogruppo e\' qualificato' };
    }

    // Combinazione multi-gruppo gia' ammessa dalla matrice: ok a livello di gruppo
    return { ok: true, reason: 'Combinazione ammessa dalla matrice Tabella 5 (livello gruppo)' };
}

/**
 * Verifica se una prova su materialGroupTested copre parentA + parentB (dissimile o omogeneo).
 * Usa matrice Table 5 + footnotes a/b/c. Assunzione P0: WPQR con un solo gruppo = prova omogenea
 * su quel gruppo (cella diagonale A=B=gruppo testato).
 *
 * @param {{ materialGroupTested: unknown, parentGroupA: unknown, parentGroupB: unknown }} params
 * @returns {{ covered: boolean, reason: string, qualifiedCombinations?: string[] }}
 */
function isParentMaterialCombinationCovered({
    materialGroupTested,
    parentGroupA,
    parentGroupB,
} = {}) {
    const tested = normalizeMaterialGroupCode(materialGroupTested);
    const parentA = normalizeMaterialGroupCode(parentGroupA);
    const parentB = normalizeMaterialGroupCode(parentGroupB);

    if (!tested || !parentA || !parentB) {
        return {
            covered: false,
            reason: 'Gruppo materiale non valido o assente (atteso codice ISO/TR 15608, es. 1.2)',
        };
    }

    // Nichel / fuori Tabella 5
    if (tested.group >= 41 || parentA.group >= 41 || parentB.group >= 41) {
        return {
            covered: false,
            reason: 'Tabella 6 (nichel) non implementata in P0',
        };
    }

    if (tested.group > 11 || parentA.group > 11 || parentB.group > 11) {
        return {
            covered: false,
            reason: 'Gruppo fuori Tabella 5 acciai (1-11)',
        };
    }

    const row = TABLE_5_STEEL_COMBINATIONS[tested.group];
    if (!row) {
        return { covered: false, reason: 'Gruppo di prova non presente in Tabella 5' };
    }

    // Prova omogenea: cella diagonale
    const qualifiedCombinations = row[tested.group] || [];
    if (!qualifiedCombinations.length) {
        return {
            covered: false,
            reason: `Nessuna combinazione qualificata per prova omogenea sul gruppo ${tested.group}`,
            qualifiedCombinations,
        };
    }

    if (!matrixListsParentCombo(qualifiedCombinations, parentA.group, parentB.group)) {
        return {
            covered: false,
            reason: `Tabella 5: prova su gruppo ${tested.subgroup || tested.group} non copre la combinazione ${parentA.subgroup || parentA.group}-${parentB.subgroup || parentB.group}`,
            qualifiedCombinations,
        };
    }

    const sub = checkSubgroupFootnotes(tested, parentA, parentB);
    return {
        covered: sub.ok,
        reason: sub.reason,
        qualifiedCombinations,
    };
}

/**
 * Mappa gradi commerciali comuni → codice 15608.
 * Accetta anche un codice gruppo gia' valido.
 * @param {unknown} gradeName
 * @returns {{ group: string|null, warning?: string }}
 */
function resolveSteelGradeToGroup(gradeName) {
    if (gradeName == null || String(gradeName).trim() === '') {
        return { group: null, warning: 'Grado materiale assente' };
    }
    const raw = String(gradeName).trim();

    // Gia' un codice gruppo
    const asCode = normalizeMaterialGroupCode(raw);
    if (asCode && (/^\d{1,2}(\.\d{1,2})?$/.test(raw.replace(/^(gruppo|group|gr\.?)\s*/i, '').trim()))) {
        return { group: asCode.subgroup || String(asCode.group) };
    }

    const compact = raw.toUpperCase().replace(/\s+/g, '').replace(/\+/g, '');
    // S355J2+N → S355J2N gia' gestito; prova chiavi progressive
    const keys = [
        compact,
        compact.replace(/JR$/, ''),
        compact.match(/^(S|P)\d{3}/)?.[0],
    ].filter(Boolean);

    for (const k of keys) {
        if (STEEL_GRADE_TO_GROUP[k]) {
            return { group: STEEL_GRADE_TO_GROUP[k] };
        }
    }

    // Pattern Sxxx / Pxxx generici
    const m = compact.match(/^(S|P)(\d{3})/);
    if (m) {
        const re = Number(m[2]);
        if (re <= 275) return { group: '1.1' };
        if (re <= 360) return { group: '1.2' };
        if (re <= 460) return { group: '1.3', warning: `Grado ${raw}: mappatura euristica Re→gruppo` };
    }

    return { group: null, warning: `Grado materiale sconosciuto: ${raw}` };
}

/**
 * Range di qualificazione gola giunti d'angolo (ISO 15614-1 Tabella 8, §8.3.2.2).
 * - t <= 3 mm    -> 0,7t a 2t
 * - 3 < t < 30mm -> 3 (fisso, non proporzionale) a 2t
 * - t >= 30 mm   -> minimo 5 mm, nessun massimo definito nell'estratto
 *
 * @param {{ testThicknessMm: number|string|null|undefined }} params
 * @returns {{ minMm: number, maxMm: number|null } | null}
 */
function computeQualifiedFilletThroatThicknessRange({ testThicknessMm } = {}) {
    const t = Number(testThicknessMm);
    if (!Number.isFinite(t) || t <= 0) return null;

    if (t <= 3) {
        return { minMm: t * 0.7, maxMm: t * 2 };
    }
    if (t < 30) {
        return { minMm: 3, maxMm: t * 2 };
    }
    return { minMm: 5, maxMm: null };
}

/**
 * Range di qualificazione spessore materiale base — Level 2 (ISO 15614-1
 * Tabella 7, colonna "Level 2"), SOLO per le bande 3-40mm dove la cifra
 * iniziale "0," e' risultata intatta nell'estrazione (confermata su due
 * estrazioni indipendenti del PDF). Ritorna null per t<=3mm (cella vuota
 * nell'estratto) e per t>40mm (tabella mostra "—", non definito).
 *
 * @param {{ testThicknessMm: number|string|null|undefined }} params
 * @returns {{ minMm: number, maxMm: number } | null}
 */
function computeQualifiedMaterialThicknessRangeLevel2({ testThicknessMm } = {}) {
    const t = Number(testThicknessMm);
    if (!Number.isFinite(t) || t <= 0) return null;

    if (t > 3 && t <= 12) {
        return { minMm: Math.max(t * 0.5, 3), maxMm: t * 1.3 };
    }
    if (t > 12 && t <= 40) {
        return { minMm: t * 0.5, maxMm: t * 1.1 };
    }
    return null; // GAP: t<=3 (cella vuota nell'estratto) o t>40 (non definito in tabella)
}

/**
 * Spessore minimo qualificato quando e' richiesta la prova d'urto (impact
 * test) — ISO 15614-1 §8.3.2.2, regola testuale non tabellare, confermata:
 * - t >= 16 mm -> minimo qualificato 16 mm
 * - t < 16 mm  -> minimo qualificato = t
 * - t <= 6 mm  -> minimo qualificato = 0,5 * t (prevale su t<16)
 *
 * Ritorna solo il MINIMO qualificato: il massimo resta governato dalla
 * Tabella 7 (vedi computeQualifiedMaterialThicknessRangeLevel2, GAP oltre 40mm).
 *
 * @param {{ testThicknessMm: number|string|null|undefined }} params
 * @returns {number|null} spessore minimo in mm, o null se input non valido
 */
function computeMinimumQualifiedThicknessWithImpactTest({ testThicknessMm } = {}) {
    const t = Number(testThicknessMm);
    if (!Number.isFinite(t) || t <= 0) return null;

    if (t <= 6) return t * 0.5;
    if (t < 16) return t;
    return 16;
}

/**
 * Il diametro e' variabile essenziale solo per Level 2 (ISO 15614-1 §8.3.3,
 * testo leggibile e non ambiguo).
 *
 * @param {'1'|'2'|1|2|null|undefined} qualificationLevel
 * @returns {boolean}
 */
function isDiameterEssentialVariable(qualificationLevel) {
    return String(qualificationLevel) === '2';
}

/**
 * Range di qualificazione diametro tubo — Level 2 (ISO 15614-1 Tabella 9,
 * §8.3.3): D_qualificato >= 0,5 * D_provino. Nessun limite massimo definito
 * nell'estratto. Per Level 1 il diametro non e' variabile essenziale: usare
 * isDiameterEssentialVariable() per decidere se applicare questa funzione.
 *
 * @param {{ testDiameterMm: number|string|null|undefined }} params
 * @returns {{ minMm: number, maxMm: null } | null}
 */
function describeQualifiedPipeDiameterRangeLevel2({ testDiameterMm } = {}) {
    const d = Number(testDiameterMm);
    if (!Number.isFinite(d) || d <= 0) return null;

    return { minMm: d * 0.5, maxMm: null };
}

/**
 * Regola "piastra copre tubo" (ISO 15614-1 §8.3.3, paragrafo di testo
 * integrale leggibile, non da tabella — quindi piu' affidabile della nota
 * analoga in weldingQualificationRules9606.js che era da fonte cliente):
 * una qualifica su piastra copre anche tubo con diametro esterno >500mm,
 * oppure >150mm se saldato in posizione PC, PF ruotata o PA ruotata.
 *
 * Nota bug fix 08/08/2026 (gap analysis GAP_WPQR_ESTENSIONI_ANNEX_B): la norma
 * raggruppa "PC, PF ruotata o PA ruotata" — SOLO PF e PA richiedono la
 * conferma esplicita "ruotata" (`rotatedPosition`); PC da sola qualifica
 * gia' per la soglia ridotta, senza bisogno di quel flag. La versione
 * precedente di questa funzione richiedeva erroneamente `rotatedPosition`
 * anche per PC.
 *
 * @param {{ weldingPositions?: string[]|string|null, rotatedPosition?: boolean }} params
 * @returns {{ minMm: number, note: string } }
 */
function describePlateCoversPipeDiameterLevel2({ weldingPositions = null, rotatedPosition = false } = {}) {
    const positions = Array.isArray(weldingPositions)
        ? weldingPositions
        : String(weldingPositions || '').split(/[,;/\s]+/).filter(Boolean);
    const upperPositions = positions.map((p) => String(p).toUpperCase());
    const hasPC = upperPositions.includes('PC');
    const hasRotatedPfOrPa = rotatedPosition && upperPositions.some((p) => p === 'PF' || p === 'PA');

    if (hasPC || hasRotatedPfOrPa) {
        return {
            minMm: 150,
            note: 'Qualifica su piastra copre tubo con diametro esterno >150 mm (posizione PC, o PF/PA ruotata) — ISO 15614-1 §8.3.3',
        };
    }
    return {
        minMm: 500,
        note: 'Qualifica su piastra copre tubo con diametro esterno >500 mm — ISO 15614-1 §8.3.3',
    };
}

function buildWpqrQualificationRulesPromptSection() {
    return `
--- REGOLE RANGE QUALIFICAZIONE ISO 15614-1 (WPQR) ---
- Level 2 qualifica anche Level 1 (non viceversa). Se il documento non specifica il livello, NON assumere 2 di default nel dato estratto: lascia null + warning.
- Gola giunti d'angolo (Tabella 8): t<=3mm -> 0,7t a 2t; 3<t<30mm -> 3mm (fisso) a 2t; t>=30mm -> minimo 5mm, nessun massimo definito.
- Diametro tubo Level 2 (Tabella 9): range qualificato >= 0,5 x D provino, nessun massimo definito. Level 1: il diametro non e' variabile essenziale (qualsiasi forma prodotto qualifica tutte le forme).
- Qualifica su piastra copre tubo con diametro esterno >500mm, o >150mm se saldato in posizione PC/PF/PA ruotata.
- Spessore materiale base Level 2 (Tabella 7): SOLO bande 3-40mm sono affidabili (0,5t/1,1t o 1,3t secondo banda); NON calcolare per Level 1 ne' oltre 40mm (gap nell'estrazione).
- Gruppo materiale (Tabella 5 acciai): in ingest estrai SOLO il gruppo/sottogruppo dichiarato; per copertura genitori usa isParentMaterialCombinationCovered (matrice + footnote a/b/c). Tabella 6 nichel non implementata.
--- FINE REGOLE ISO 15614-1 ---`.trim();
}

module.exports = {
    TABLE_5_STEEL_COMBINATIONS,
    computeQualifiedFilletThroatThicknessRange,
    computeQualifiedMaterialThicknessRangeLevel2,
    computeMinimumQualifiedThicknessWithImpactTest,
    isDiameterEssentialVariable,
    describeQualifiedPipeDiameterRangeLevel2,
    describePlateCoversPipeDiameterLevel2,
    normalizeMaterialGroupCode,
    isParentMaterialCombinationCovered,
    resolveSteelGradeToGroup,
    buildWpqrQualificationRulesPromptSection,
};

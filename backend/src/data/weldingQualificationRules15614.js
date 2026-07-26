'use strict';

/**
 * Regole di calcolo range di qualificazione ISO 15614-1:2017 — fonte unica per
 * UI, ingest e assistente AI su WPQR (procedure di saldatura).
 * Mantenere sincronizzato con app/src/data/weldingQualificationRules15614.js
 *
 * Estratto operativo: docs/reference/ISO-15614-1-range-validita-WPQR.md
 * Codifica SOLO le regole verificate con certezza nell'estrazione del testo
 * normativo (26/07/2026): Tabella 8 completa (gola giunti d'angolo), Tabella 9
 * (diametro tubo Level 2 + regola piastra->tubo), regola spessore minimo con
 * prova d'urto, Tabella 7 colonna Level 2 SOLO bande 3-40mm (colonna Level 1
 * scartata: 5 righe su 7 perdono la cifra iniziale "0," nell'estrazione,
 * rischio di calcolare un range 10x piu' ampio del reale). Matrice gruppi
 * materiale (Tabella 5/6) NON codificata: leggibile ma troppo complessa
 * (11x11 + eccezioni) per garantire fedelta' senza verifica visiva pagina
 * per pagina — vedi GAP dichiarato nell'estratto collegato.
 */

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
 * @param {{ weldingPositions?: string[]|string|null, rotatedPosition?: boolean }} params
 * @returns {{ minMm: number, note: string } }
 */
function describePlateCoversPipeDiameterLevel2({ weldingPositions = null, rotatedPosition = false } = {}) {
    const positions = Array.isArray(weldingPositions)
        ? weldingPositions
        : String(weldingPositions || '').split(/[,;/\s]+/).filter(Boolean);
    const hasRelevantPosition = rotatedPosition && positions.some((p) => ['PC', 'PF', 'PA'].includes(String(p).toUpperCase()));

    if (hasRelevantPosition) {
        return {
            minMm: 150,
            note: 'Qualifica su piastra copre tubo con diametro esterno >150 mm (posizione PC/PF/PA ruotata) — ISO 15614-1 §8.3.3',
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
- Gruppo materiale (Tabella 5/6): estrai SOLO il gruppo/sottogruppo dichiarato sul WPQR, non inferire coperture incrociate tra gruppi diversi.
--- FINE REGOLE ISO 15614-1 ---`.trim();
}

module.exports = {
    computeQualifiedFilletThroatThicknessRange,
    computeQualifiedMaterialThicknessRangeLevel2,
    computeMinimumQualifiedThicknessWithImpactTest,
    isDiameterEssentialVariable,
    describeQualifiedPipeDiameterRangeLevel2,
    describePlateCoversPipeDiameterLevel2,
    buildWpqrQualificationRulesPromptSection,
};

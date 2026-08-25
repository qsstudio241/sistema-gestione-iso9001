'use strict';

/**
 * Regole di calcolo range di qualificazione ISO 15614-2:2025 — WPQR alluminio.
 * Mantenere sincronizzato con app/src/data/weldingQualificationRules15614_2.js
 *
 * Estratto operativo: docs/reference/ISO-15614-2-range-validita-WPQR.md
 * Fonte: docs/Normative/Normative NORMA_00031_ UNI EN ISO 15614-2_2025 Rev. 0.md
 * (BS EN ISO 15614-2:2025, digitalizzata 25/08/2026).
 *
 * Codificato (pag. 32 norma, Tabella 5/6/7):
 * - Tabella 5 spessore materiale base BW (bande t)
 * - Tabella 6 gola FW (allineata a 15614-1 Tabella 8)
 * - Tabella 7 diametro tubo + piastra→tubo (>500; >150 in PA/PC ruotata)
 *
 * Non inventare: se una cella OCR è ambigua resta GAP documentato nell'estratto.
 */

/**
 * Range spessore materiale base — butt welds (ISO 15614-2:2025 Tabella 5).
 * Lettura verificata sul testo di pagina 32 (minimi assoluti 3/5 mm sulle bande
 * intermedie; 0,5t–2t su t≤3; oltre 150 mm max 1,5t).
 *
 * @param {{ testThicknessMm: number|string|null|undefined }} params
 * @returns {{ minMm: number, maxMm: number } | null}
 */
function computeQualifiedMaterialThicknessRange15614_2({ testThicknessMm } = {}) {
    const t = Number(testThicknessMm);
    if (!Number.isFinite(t) || t <= 0) return null;

    if (t <= 3) {
        return { minMm: parseFloat((0.5 * t).toFixed(2)), maxMm: parseFloat((2 * t).toFixed(2)) };
    }
    if (t <= 10) {
        return { minMm: 3, maxMm: parseFloat((2 * t).toFixed(2)) };
    }
    if (t <= 20) {
        return { minMm: 5, maxMm: parseFloat((2 * t).toFixed(2)) };
    }
    if (t <= 40) {
        return { minMm: 5, maxMm: parseFloat((2 * t).toFixed(2)) };
    }
    if (t <= 150) {
        return { minMm: 5, maxMm: parseFloat((2 * t).toFixed(2)) };
    }
    return { minMm: 5, maxMm: parseFloat((1.5 * t).toFixed(2)) };
}

/**
 * Range gola giunti d'angolo (ISO 15614-2:2025 Tabella 6) — stessa struttura
 * della Tabella 8 di ISO 15614-1.
 *
 * @param {{ testThicknessMm: number|string|null|undefined }} params
 * @returns {{ minMm: number, maxMm: number|null } | null}
 */
function computeQualifiedFilletThroatThicknessRange15614_2({ testThicknessMm } = {}) {
    const t = Number(testThicknessMm);
    if (!Number.isFinite(t) || t <= 0) return null;

    if (t <= 3) {
        return { minMm: parseFloat((0.7 * t).toFixed(2)), maxMm: parseFloat((2 * t).toFixed(2)) };
    }
    if (t < 30) {
        return { minMm: 3, maxMm: parseFloat((2 * t).toFixed(2)) };
    }
    return { minMm: 5, maxMm: null };
}

/**
 * Range diametro tubo (ISO 15614-2:2025 Tabella 7).
 * @param {{ testDiameterMm: number|string|null|undefined }} params
 * @returns {{ minMm: number, maxMm: number|null } | null}
 */
function computeQualifiedPipeDiameterRange15614_2({ testDiameterMm } = {}) {
    const d = Number(testDiameterMm);
    if (!Number.isFinite(d) || d <= 0) return null;

    if (d <= 25) {
        return { minMm: parseFloat((0.5 * d).toFixed(2)), maxMm: parseFloat((2 * d).toFixed(2)) };
    }
    return { minMm: Math.max(parseFloat((0.5 * d).toFixed(2)), 25), maxMm: null };
}

/**
 * Piastra → tubo (ISO 15614-2:2025 §8.3.2.4):
 * D > 500 mm, oppure D > 150 mm in posizione PA o PC (rotated).
 * Diverso da 15614-1 (che include anche PF/PA rotated).
 *
 * @param {{ weldingPositions?: string|null, rotatedPosition?: boolean }} params
 * @returns {{ coversPipeOverMm: number, note: string }}
 */
function describePlateCoversPipeDiameter15614_2({ weldingPositions, rotatedPosition } = {}) {
    const pos = String(weldingPositions || '').toUpperCase();
    const hasPaOrPc = /\bPA\b/.test(pos) || /\bPC\b/.test(pos);
    const rotated = rotatedPosition === true || rotatedPosition === 1 || rotatedPosition === '1';

    if (hasPaOrPc || rotated) {
        return {
            minMm: 150,
            coversPipeOverMm: 150,
            note: 'Piastra copre tubo D > 150 mm (posizione PA o PC / ruotata) — ISO 15614-2 §8.3.2.4',
        };
    }
    return {
        minMm: 500,
        coversPipeOverMm: 500,
        note: 'Piastra copre tubo D > 500 mm — ISO 15614-2 §8.3.2.4',
    };
}

/**
 * True se la norma di riferimento del WPQR è della famiglia 15614-2 (alluminio).
 * @param {unknown} standardReference
 * @returns {boolean}
 */
function isIso15614Part2(standardReference) {
    const s = String(standardReference || '');
    return /15614[\s\-]?2\b/i.test(s);
}

module.exports = {
    computeQualifiedMaterialThicknessRange15614_2,
    computeQualifiedFilletThroatThicknessRange15614_2,
    computeQualifiedPipeDiameterRange15614_2,
    describePlateCoversPipeDiameter15614_2,
    isIso15614Part2,
};

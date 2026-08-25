/**
 * Regole di calcolo range di qualificazione ISO 15614-2:2025 — WPQR alluminio.
 * Mantenere sincronizzato con backend/src/data/weldingQualificationRules15614_2.js
 *
 * Estratto operativo: docs/reference/ISO-15614-2-range-validita-WPQR.md
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

function computeQualifiedPipeDiameterRange15614_2({ testDiameterMm } = {}) {
  const d = Number(testDiameterMm);
  if (!Number.isFinite(d) || d <= 0) return null;

  if (d <= 25) {
    return { minMm: parseFloat((0.5 * d).toFixed(2)), maxMm: parseFloat((2 * d).toFixed(2)) };
  }
  return { minMm: Math.max(parseFloat((0.5 * d).toFixed(2)), 25), maxMm: null };
}

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

function isIso15614Part2(standardReference) {
  const s = String(standardReference || '');
  return /15614[\s\-]?2\b/i.test(s);
}

export {
  computeQualifiedMaterialThicknessRange15614_2,
  computeQualifiedFilletThroatThicknessRange15614_2,
  computeQualifiedPipeDiameterRange15614_2,
  describePlateCoversPipeDiameter15614_2,
  isIso15614Part2,
};

export default {
  computeQualifiedMaterialThicknessRange15614_2,
  computeQualifiedFilletThroatThicknessRange15614_2,
  computeQualifiedPipeDiameterRange15614_2,
  describePlateCoversPipeDiameter15614_2,
  isIso15614Part2,
};

'use strict';

/**
 * Regole di calcolo range di qualificazione ISO 9606-1:2017 — fonte unica per
 * UI, ingest e assistente AI su patentini saldatori.
 * Mantenere sincronizzato con app/src/data/weldingQualificationRules9606.js
 *
 * Estratto operativo: docs/reference/ISO-9606-1-range-validita-patentino.md
 * Codifica SOLO le regole verificate con certezza nell'estrazione del testo
 * normativo (Tabella 7 diametro tubo, riga t<3 Tabella 8 giunti d'angolo).
 */

const CONFIRMATION_INTERVAL_MONTHS = 6;

/**
 * @param {{ testDiameterMm: number|string|null|undefined }} params
 * @returns {{ minMm: number, maxMm: number|null } | null}
 */
function computeQualifiedPipeDiameterRange({ testDiameterMm } = {}) {
    const d = Number(testDiameterMm);
    if (!Number.isFinite(d) || d <= 0) return null;

    if (d <= 25) {
        return { minMm: d, maxMm: d * 2 };
    }
    return { minMm: Math.max(d * 0.5, 25), maxMm: null };
}

/**
 * @param {{ testThicknessMm: number|string|null|undefined }} params
 * @returns {{ minMm: number, maxMm: number } | null}
 */
function computeQualifiedFilletThicknessRange({ testThicknessMm } = {}) {
    const t = Number(testThicknessMm);
    if (!Number.isFinite(t) || t <= 0) return null;
    if (t >= 3) return null; // GAP: righe t>=3 non verificate, non inventare

    return { minMm: t, maxMm: Math.max(t * 2, 3) };
}

function buildWelderQualificationRulesPromptSection() {
    return `
--- REGOLE QUALIFICA SALDATORE ISO 9606-1 ---
- Conferma periodica obbligatoria ogni ${CONFIRMATION_INTERVAL_MONTHS} mesi (non e' la scadenza finale del certificato).
- Diametro tubo: se il certificato riporta un diametro provino D, il campo di validita' e' [D, 2D] se D<=25 mm, oppure [0,5*D (min 25 mm), nessun limite] se D>25 mm.
- NON calcolare range di spessore per giunti testa a testa: non e' verificabile in questo catalogo, estrai solo il valore/range se scritto esplicitamente sul certificato.
- Un cambio di processo di saldatura richiede nuova qualifica, salvo equivalenze note: 135<->138, 121<->125, 141/143/145 tra loro (142 solo 142).
--- FINE REGOLE ISO 9606-1 ---`.trim();
}

module.exports = {
    CONFIRMATION_INTERVAL_MONTHS,
    computeQualifiedPipeDiameterRange,
    computeQualifiedFilletThicknessRange,
    buildWelderQualificationRulesPromptSection,
};

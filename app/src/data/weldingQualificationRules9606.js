/**
 * Regole di calcolo range di qualificazione ISO 9606-1:2017 — fonte unica per
 * UI, ingest e assistente AI su patentini saldatori.
 *
 * Estratto operativo: docs/reference/ISO-9606-1-range-validita-patentino.md
 * Codifica SOLO le regole verificate con certezza nell'estrazione del testo
 * normativo (Tabella 7 diametro tubo, riga t<3 Tabella 8 giunti d'angolo).
 * Le altre tabelle (spessore giunti testa a testa, matrice posizioni) sono
 * risultate troppo destrutturate nell'estrazione automatica: NON sono
 * codificate qui per evitare di inventare valori normativi — vedi sezione
 * "GAP" nell'estratto collegato.
 */

/** Intervallo fisso di conferma periodica qualifica (ISO 9606-1 §9.2). */
const CONFIRMATION_INTERVAL_MONTHS = 6;

/**
 * Range di qualificazione per diametro esterno tubo (ISO 9606-1 Tabella 7).
 * - D <= 25 mm  -> da D a 2D
 * - D > 25 mm   -> da 0,5*D (minimo 25 mm) a infinito (nessun limite superiore)
 *
 * @param {{ testDiameterMm: number|string|null|undefined }} params
 * @returns {{ minMm: number, maxMm: number|null } | null} null se il diametro non e' valido
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
 * Range di qualificazione spessore per giunti d'angolo (ISO 9606-1 Tabella 8),
 * SOLO per la riga verificata (t < 3 mm). Per t >= 3 mm ritorna null: la
 * tabella non e' stata trascritta con certezza (vedi GAP nell'estratto).
 *
 * @param {{ testThicknessMm: number|string|null|undefined }} params
 * @returns {{ minMm: number, maxMm: number } | null}
 */
function computeQualifiedFilletThicknessRange({ testThicknessMm } = {}) {
  const t = Number(testThicknessMm);
  if (!Number.isFinite(t) || t <= 0) return null;
  if (t >= 3) return null; // GAP: righe t>=3 non verificate, non inventare

  return { minMm: t, maxMm: Math.max(t * 2, 3) };
}

/**
 * Nota aggiuntiva diametro tubo per provini SOLO piastra (nessun tubo testato), saldati
 * in posizione con rotazione del pezzo (es. PA/PB/PC/PD "in posizione rotante").
 *
 * ATTENZIONE — fonte non verificata in questo catalogo: la Tabella 7 completa (incl. note
 * su piastra/posizione rotante) e' risultata GAP nell'estrazione automatica del PDF (vedi
 * docs/reference/ISO-9606-1-range-validita-patentino.md). Questa regola è stata comunicata
 * come feedback operativo dal cliente reale Studio Mason (16/07/2026, riscontro su patentini
 * saldatori in campo) e NON da verifica diretta del testo normativo integrale. Va trattata
 * come proposta da confermare, non come dato normativo certo — non usarla per popolare
 * automaticamente record del registro senza revisione umana.
 *
 * @param {{ hasPipeDiameter?: boolean, weldingPositions?: string[]|string|null, rotatingPosition?: boolean }} params
 * @returns {string|null} testo suggerito per il campo diametro, o null se non applicabile
 */
function describePlateOnlyRotatingPositionDiameterNote({
  hasPipeDiameter = false,
  weldingPositions = null,
  rotatingPosition = false,
} = {}) {
  if (hasPipeDiameter) return null; // tubo già testato: la nota piastra non si applica

  const positions = Array.isArray(weldingPositions)
    ? weldingPositions
    : String(weldingPositions || '').split(/[,;/\s]+/).filter(Boolean);
  const hasRelevantPosition = positions.some((p) => ['PA', 'PB', 'PC', 'PD'].includes(String(p).toUpperCase()));
  if (!hasRelevantPosition) return null;

  return rotatingPosition
    ? 'Diametro tubo coperto: \u226575 mm (posizione di prova rotante su piastra — nota non verificata su copia integrale norma, da confermare; fonte: feedback cliente Studio Mason)'
    : 'Diametro tubo coperto: \u2265500 mm (saldatura su piastra, posizioni PA/PB/PC/PD — nota non verificata su copia integrale norma, da confermare; fonte: feedback cliente Studio Mason)';
}

/**
 * @param {{ maxLines?: number }} [opts]
 * @returns {string}
 */
function buildWelderQualificationRulesPromptSection(opts = {}) {
  return `
--- REGOLE QUALIFICA SALDATORE ISO 9606-1 ---
- Conferma periodica obbligatoria ogni ${CONFIRMATION_INTERVAL_MONTHS} mesi (non e' la scadenza finale del certificato).
- Diametro tubo: se il certificato riporta un diametro provino D, il campo di validita' e' [D, 2D] se D<=25 mm, oppure [0,5*D (min 25 mm), nessun limite] se D>25 mm.
- NON calcolare range di spessore per giunti testa a testa: non e' verificabile in questo catalogo, estrai solo il valore/range se scritto esplicitamente sul certificato.
- Un cambio di processo di saldatura richiede nuova qualifica, salvo equivalenze note: 135<->138, 121<->125, 141/143/145 tra loro (142 solo 142).
--- FINE REGOLE ISO 9606-1 ---`.trim();
}

export {
  CONFIRMATION_INTERVAL_MONTHS,
  computeQualifiedPipeDiameterRange,
  computeQualifiedFilletThicknessRange,
  describePlateOnlyRotatingPositionDiameterNote,
  buildWelderQualificationRulesPromptSection,
};

export default {
  CONFIRMATION_INTERVAL_MONTHS,
  computeQualifiedPipeDiameterRange,
  computeQualifiedFilletThicknessRange,
  describePlateOnlyRotatingPositionDiameterNote,
  buildWelderQualificationRulesPromptSection,
};

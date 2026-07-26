/**
 * ISO 14341:2020 — regole designazione fili-elettrodo / depositi GMAW per prompt ingest.
 * Non è un catalogo esaustivo di tutte le combinazioni (diverso da ISO 14175 gas).
 * Mirror: backend/src/data/fillerWire14341.js
 * Estratto: docs/reference/ISO-14341-consumabili-filo.md
 */

/** Simboli resistenza sistema A (snervamento / 47 J) — Tabella 1A */
export const STRENGTH_SYMBOLS_A = ['35', '38', '42', '46', '50'];

/** Prefissi resistenza sistema B (rottura / 27 J) — Tabella 1B; suffisso A|P */
export const STRENGTH_PREFIXES_B = ['43', '49', '55', '57'];

/** Simboli impatto Tabella 2 (temperatura °C) */
export const IMPACT_SYMBOLS = {
  Z: 'nessun requisito',
  A: '+20',
  Y: '+20',
  '0': '0',
  '2': '-20',
  '3': '-30',
  '4': '-40',
  '5': '-50',
  '6': '-60',
  '7': '-70',
  '8': '-80',
  '9': '-90',
  '10': '-100',
};

/** Esempi composizione da §11 / uso comune (Tabella 3A/3B non completa in estrazione) */
export const EXAMPLE_COMPOSITION_SYMBOLS = ['3Si1', '4Si1', 'S3', 'S11', 'Z4Mo1'];

/**
 * Sezione prompt AI per WPS/WPQR (campo filler_material).
 * @returns {string}
 */
export function buildFillerWire14341PromptSection() {
  return `
--- CONSUMABILI FILO ISO 14341 (filler_material) ---
Norma: classificazione fili-elettrodo e depositi GMAW (MIG/MAG) per acciai non legati / grano fine.
Campo: filler_material ← designazione di classificazione (NON confondere con filler_material_group FM1–FM6).
Sistemi:
- A (ISO 14341-A-…): snervamento + 47 J. Resistenza: ${STRENGTH_SYMBOLS_A.join(', ')}.
- B (ISO 14341-B-…): rottura + 27 J. Resistenza: 43A/43P, 49A/49P, 55A/55P, 57A/57P (A=as-welded, P=PWHT).
Struttura deposito: G + resistenza + impatto + gas(14175) + composizione filo.
Esempi:
- "ISO 14341-A-G 46 5 M21 3Si1" o corta "G 46 5 M21 3Si1"
- "G 42 4 M21 4Si1" (forma tipica su WPS/WPQR)
- Solo filo: "ISO 14341-A-G 3Si1"
Regole:
- Preferire designazione ISO 14341 se presente; non sostituire con solo nome commerciale.
- Se nella designazione c'è un gas (M21, C1, …) e shielding_gas è vuoto, estrarre anche shielding_gas (simbolo ISO 14175).
- Dimensione filo (es. 1,2 mm): può restare accanto alla designazione; non inventare simboli chimici non leggibili.
- Fuori scope (inox 14343, alluminio 18274, MMA, …): non forzare classificazione 14341.
--- FINE CONSUMABILI ISO 14341 ---`.trim();
}

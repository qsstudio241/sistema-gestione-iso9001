/**
 * Mapping deterministico doc_type ? folder_code suggerito.
 * Usato dall'AI classification e dal wizard upload per suggerire la cartella.
 * folder_code corrisponde ai codici nel template provisioning (migrazione 059  -  sgq_camellini_v1).
 *
 * Codici template di riferimento:
 *   1.1 MANUALE | 1.2 PROCEDURE | 1.3 ISTRUZIONI | 1.4 MODULI
 *   2.1 CERTIFICATI | 2.2 CAPITOLATI | 2.3 NORME E LEGGI
 *   4.1 ORGANIGRAMMA | 4.3 SKILL MATRIX | 4.4 PIANO FORMAZIONE
 *   9 PRODUZIONE | 12 AUDIT | 99 SCADENZARIO
 */

export const DOC_TYPE_FOLDER_MAP = {
  procedura:            '1.2',
  istruzione:           '1.3',
  modulo:               '1.4',
  manuale:              '1.1',
  norma:                '2.3',
  cert_taratura:        '2.1',
  certificato_materiale:'2.1',
  qualifica:            '4.3',
  patentino_saldatore:  '4.3',
  qualifica_14732:      '4.3',
  wps:                  '9.1',
  wpqr:                 '9.1',
  cert_ndt:             '9.3',
  report_ndt:           '9.3',
  dichiarazione_ce:     '2.1',
  piano_qualita:        '1.2',
  sal:                  '14',
  rdp:                  '9.1',
  capitolato:           '2.2',
  altro:                null,
};

/**
 * Restituisce il folder_code suggerito per un tipo documento.
 * Ritorna null se non c' -  mapping (l'utente dovr -  scegliere manualmente).
 * @param {string|null|undefined} docType
 * @returns {string|null}
 */
export function getSuggestedFolderCode(docType) {
  if (!docType) return null;
  return DOC_TYPE_FOLDER_MAP[docType] || null;
}

/** Etichette scaffale azienda (template 059/076) — preview commit Import PDF. */
export const FOLDER_CODE_LABELS = {
  '1.1': 'MANUALE',
  '1.2': 'PROCEDURE',
  '1.3': 'ISTRUZIONI',
  '1.4': 'MODULI',
  '2.1': 'CERTIFICATI',
  '2.2': 'CAPITOLATI',
  '2.3': 'NORME E LEGGI',
  '4.3': 'SKILL MATRIX',
  '4.5': 'QUALIFICHE SALDATORI',
  '9.1': 'WPS / WPQR',
  '9.3': 'CND / PROVE NON DISTRUTTIVE',
  '14': 'RIESAME DIREZIONE',
};

export function getSuggestedFolderLabel(docType) {
  const code = getSuggestedFolderCode(docType);
  if (!code) return null;
  const title = FOLDER_CODE_LABELS[code];
  return title ? `${title} (${code})` : code;
}

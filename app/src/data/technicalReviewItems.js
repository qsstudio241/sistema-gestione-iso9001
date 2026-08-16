/**
 * Punti riesame tecnico ISO 3834-3 §5.3 (elenco sintetico, non la norma integrale).
 * Chiave _completion riservata al timbro data/utente (ISO-2).
 */

export const TECHNICAL_REVIEW_COMPLETION_KEY = "_completion";

export const TECHNICAL_REVIEW_ITEMS = [
  { key: "materiale_base", label: "Materiale base" },
  { key: "requisiti_qualita", label: "Requisiti di qualità delle saldature" },
  { key: "posizione_accessibilita", label: "Posizione e accessibilità delle saldature" },
  { key: "specifica_procedure", label: "Specifica procedure saldatura / CND / trattamento termico" },
  { key: "criterio_qualificazione_procedure", label: "Criterio di qualificazione delle procedure" },
  { key: "qualificazione_personale", label: "Qualificazione del personale" },
  { key: "identificazione_rintracciabilita", label: "Identificazione e rintracciabilità" },
  { key: "controllo_qualita", label: "Controllo qualità" },
  { key: "ispezioni_prove", label: "Ispezioni e prove" },
  { key: "subfornitura", label: "Subfornitura" },
  { key: "trattamenti_termici", label: "Trattamenti termici" },
  { key: "altri_requisiti", label: "Altri requisiti di saldatura" },
  { key: "metodi_particolari", label: "Metodi particolari" },
  { key: "dimensioni_giunti", label: "Dimensioni dei giunti" },
  { key: "luogo_esecuzione", label: "Luogo di esecuzione" },
  { key: "condizioni_ambientali", label: "Condizioni ambientali" },
  { key: "gestione_nc", label: "Gestione delle non conformità" },
];

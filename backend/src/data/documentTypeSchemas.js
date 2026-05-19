/**
 * documentTypeSchemas.js — Versione backend (solo prompt AI e schema atteso)
 *
 * Non importare da app/src — i frontend schemas non sono accessibili dal backend.
 * Questo file è la controparte backend: contiene SOLO le parti necessarie
 * all'estrazione AI (aiPrompt, aiExpectedSchema, label).
 *
 * Mantenere sincronizzato con app/src/data/documentTypeSchemas.js.
 */

'use strict';

const DOCUMENT_TYPE_SCHEMAS = {

  patentino_saldatore: {
    label: 'Patentino saldatore (ISO 9606-1)',

    aiPrompt: `Stai analizzando un certificato di qualifica saldatore secondo ISO 9606-1 (o norma equivalente).
Estrai TUTTI i seguenti campi e restituiscili nell'oggetto "type_specific_data" del JSON di risposta.
Se un campo non è presente nel documento, usa null.

Campi da estrarre:
- welder_name: nome e cognome del saldatore
- certificate_number: numero univoco del certificato
- issuing_body: ente certificatore (TÜV, Bureau Veritas, DNV, RINA, IMQ, ecc.)
- welding_process: codice processo ISO 4063 (111, 135, 141, ecc.)
- joint_type: tipo giunto — "BW" (testa a testa) o "FW" (angolare)
- material_group: gruppo materiale base ISO/TR 15608 (es. "1.1", "6", "8")
- filler_material_group: gruppo materiale d'apporto (FM1-FM6 o null)
- welding_positions: array di posizioni ISO 6947 (es. ["PA","PF","PC"])
- thickness_min_mm: numero — spessore minimo qualificato in mm
- thickness_max_mm: numero — spessore massimo qualificato in mm
- pipe_diameter_mm: numero — diametro esterno tubi qualificato in mm (null se solo piastre)
- shielding_gas: codice gas ISO 14175 (es. "M21", "I1") o null
- exam_date: data esame in formato ISO 8601 (YYYY-MM-DD) o null
- expiry_date: data scadenza in formato ISO 8601 (YYYY-MM-DD) o null
- last_confirmation_date: data ultima conferma datore di lavoro in formato ISO 8601 o null
- next_confirmation_due: data prossima conferma in formato ISO 8601 o null
- standard_reference: norma (es. "ISO 9606-1:2012") o null`,

    aiExpectedSchema: {
      welder_name: 'string|null',
      certificate_number: 'string|null',
      issuing_body: 'string|null',
      welding_process: 'string|null',
      joint_type: 'BW|FW|null',
      material_group: 'string|null',
      filler_material_group: 'string|null',
      welding_positions: 'string[]|null',
      thickness_min_mm: 'number|null',
      thickness_max_mm: 'number|null',
      pipe_diameter_mm: 'number|null',
      shielding_gas: 'string|null',
      exam_date: 'YYYY-MM-DD|null',
      expiry_date: 'YYYY-MM-DD|null',
      last_confirmation_date: 'YYYY-MM-DD|null',
      next_confirmation_due: 'YYYY-MM-DD|null',
      standard_reference: 'string|null',
    },
  },

  wps: {
    label: 'WPS (Procedura di saldatura)',

    aiPrompt: `Stai analizzando una WPS (Welding Procedure Specification) secondo ISO 15614 o EN ISO 15609.
Estrai nell'oggetto "type_specific_data": wps_number, welding_process, base_material,
thickness_min_mm, thickness_max_mm, wpqr_ref. Usa null per i campi non trovati.`,

    aiExpectedSchema: {
      wps_number: 'string|null',
      welding_process: 'string|null',
      base_material: 'string|null',
      thickness_min_mm: 'number|null',
      thickness_max_mm: 'number|null',
      wpqr_ref: 'string|null',
    },
  },

  norma: {
    label: 'Norma tecnica',

    aiPrompt: `Stai analizzando una norma tecnica (ISO, EN, UNI, DIN, ecc.).
Estrai TUTTI i seguenti campi e restituiscili nell'oggetto "type_specific_data" del JSON di risposta.
Se un campo non è presente nel documento, usa null.

Campi da estrarre:
- standard_code: il codice completo (es. "BS EN ISO 9606-1:2017")
- norm_title: il titolo ufficiale senza il codice
- issuing_body: l'ente emittente principale (ISO, CEN, BSI, UNI, DIN, AFNOR, ANSI, AWS, ASME)
- edition_year: anno di pubblicazione/edizione (numero intero)
- supersedes: norma sostituita (se indicato nel testo)
- validity_status: "vigente" (default se non specificato diversamente), "superata", "annullata" o "in_revisione"
- language: codice lingua del documento (it, en, de, fr, es, multi)
- scope_summary: oggetto/scopo dalla Sezione 1 (max 200 caratteri)
- ics_code: codice ICS se presente (es. "25.160.01")
- technical_committee: comitato tecnico responsabile (es. "ISO/TC 44")
- is_harmonized: true se è una norma EN armonizzata, false altrimenti`,

    aiExpectedSchema: {
      standard_code: 'string|null',
      norm_title: 'string|null',
      issuing_body: 'string|null',
      edition_year: 'number|null',
      supersedes: 'string|null',
      validity_status: 'vigente|superata|annullata|in_revisione|null',
      language: 'it|en|de|fr|es|multi|null',
      scope_summary: 'string|null',
      ics_code: 'string|null',
      technical_committee: 'string|null',
      is_harmonized: 'boolean|null',
    },
  },
};

/**
 * Restituisce lo schema backend per il tipo documento dato, o null se non esiste.
 * @param {string|null|undefined} docType
 * @returns {{ label: string, aiPrompt: string, aiExpectedSchema: object }|null}
 */
function getSchemaForDocType(docType) {
  return DOCUMENT_TYPE_SCHEMAS[docType] || null;
}

module.exports = { DOCUMENT_TYPE_SCHEMAS, getSchemaForDocType };

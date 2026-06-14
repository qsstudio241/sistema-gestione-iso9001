'use strict';

/**
 * documentTypeSchemas.js � Versione backend (prompt AI e schema atteso)
 * Mantenere sincronizzato con app/src/data/documentTypeSchemas.js
 */

const AI_SCHEMAS = {

  patentino_saldatore: {
    label: 'Patentino saldatore (ISO 9606-1)',
    aiPrompt: `Stai analizzando un certificato di qualifica saldatore secondo ISO 9606-1 (o norma equivalente).
Estrai TUTTI i seguenti campi e restituiscili nell'oggetto "type_specific_data" del JSON di risposta.
Se un campo non e' presente nel documento, usa null.

Campi da estrarre:
- welder_name: nome e cognome del saldatore
- certificate_number: numero univoco del certificato
- issuing_body: ente che emette/certifica il patentino (TUV, Bureau Veritas, DNV, RINA, IIS, IMQ, ...)
- examiner_body: organismo o esaminatore che ha condotto la prova, se diverso dall'ente emittente (altrimenti null)
- welding_process: codice processo ISO 4063 (111, 121, 131, 135, 136, 138, 141, 145, 15, 311, ...)
- joint_type: tipo giunto "BW" (testa a testa) o "FW" (angolare)
- product_type: "P" se la prova e' su lamiera/piastra, "T" se su tubo
- weld_details: dettagli del giunto/condizioni (es. "ss nb" = single side no backing, "bs" = both sides, "ml" = multi layer, "sl" = single layer)
- material_group: gruppo materiale base ISO/TR 15608 (es. "1.1", "6", "8")
- filler_material_group: gruppo materiale d'apporto (FM1-FM6 o null)
- welding_positions: array di posizioni ISO 6947 (es. ["PA","PF","PC"])
- thickness_min_mm: numero - spessore minimo qualificato in mm
- thickness_max_mm: numero - spessore massimo qualificato in mm
- pipe_diameter_min_mm: numero - diametro esterno tubi minimo qualificato in mm (null se solo lamiera)
- pipe_diameter_max_mm: numero - diametro esterno tubi massimo qualificato in mm (null se solo lamiera)
- shielding_gas: codice gas ISO 14175 (es. "M21", "I1") o null
- exam_date: data esame/prova (YYYY-MM-DD) o null
- expiry_date: data scadenza (YYYY-MM-DD) o null
- last_confirmation_date: data ultima conferma del datore di lavoro (YYYY-MM-DD) o null
- next_confirmation_due: data prossima conferma (YYYY-MM-DD) o null
- revalidation_date: data di revalidazione (validita' estesa, di norma 3 anni) (YYYY-MM-DD) o null
- standard_reference: norma (es. "ISO 9606-1:2012") o null`,
    aiExpectedSchema: {
      welder_name: 'string|null',
      certificate_number: 'string|null',
      issuing_body: 'string|null',
      examiner_body: 'string|null',
      welding_process: 'string|null',
      joint_type: 'BW|FW|null',
      product_type: 'P|T|null',
      weld_details: 'string|null',
      material_group: 'string|null',
      filler_material_group: 'string|null',
      welding_positions: 'string[]|null',
      thickness_min_mm: 'number|null',
      thickness_max_mm: 'number|null',
      pipe_diameter_min_mm: 'number|null',
      pipe_diameter_max_mm: 'number|null',
      shielding_gas: 'string|null',
      exam_date: 'YYYY-MM-DD|null',
      expiry_date: 'YYYY-MM-DD|null',
      last_confirmation_date: 'YYYY-MM-DD|null',
      next_confirmation_due: 'YYYY-MM-DD|null',
      revalidation_date: 'YYYY-MM-DD|null',
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

  wpqr: {
    label: 'WPQR (Qualifica procedura)',
    aiPrompt: `Stai analizzando un WPQR (Welding Procedure Qualification Record) ISO 15614.
Estrai in type_specific_data: wpqr_number, welding_process, material_group, thickness_test_mm,
approval_date (YYYY-MM-DD), standard_reference. Usa null se assente.`,
    aiExpectedSchema: {
      wpqr_number: 'string|null',
      welding_process: 'string|null',
      material_group: 'string|null',
      thickness_test_mm: 'number|null',
      approval_date: 'YYYY-MM-DD|null',
      standard_reference: 'string|null',
    },
  },

  norma: {
    label: 'Norma tecnica',
    aiPrompt: `Stai analizzando una norma tecnica (ISO, EN, UNI, DIN, ecc.).
Estrai in type_specific_data: standard_code, norm_title, issuing_body, edition_year, supersedes,
validity_status, language, scope_summary, ics_code, technical_committee, is_harmonized. Usa null se assente.`,
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

  certificato_materiale: {
    label: 'Certificato materiale (EN 10204)',
    aiPrompt: `Certificato materiale EN 10204. Estrai in type_specific_data: certificate_type (2.1|2.2|3.1|3.2),
material_grade, heat_number, supplier_name, issue_date (YYYY-MM-DD). Usa null se assente.`,
    aiExpectedSchema: {
      certificate_type: '2.1|2.2|3.1|3.2|null',
      material_grade: 'string|null',
      heat_number: 'string|null',
      supplier_name: 'string|null',
      issue_date: 'YYYY-MM-DD|null',
    },
  },

  cert_ndt: {
    label: 'Certificato NDT (ISO 9712)',
    aiPrompt: `Certificato qualifica operatore NDT ISO 9712. Estrai: operator_name, certificate_number,
ndt_method (UT|RT|MT|PT|VT), certification_level (1|2|3), issuing_body, exam_date, expiry_date.`,
    aiExpectedSchema: {
      operator_name: 'string|null',
      certificate_number: 'string|null',
      ndt_method: 'UT|RT|MT|PT|VT|null',
      certification_level: '1|2|3|null',
      issuing_body: 'string|null',
      exam_date: 'YYYY-MM-DD|null',
      expiry_date: 'YYYY-MM-DD|null',
    },
  },

  cert_taratura: {
    label: 'Certificato taratura',
    aiPrompt: `Certificato taratura strumento. Estrai: instrument_id, instrument_type, calibration_lab,
certificate_number, calibration_date, expiry_date (YYYY-MM-DD).`,
    aiExpectedSchema: {
      instrument_id: 'string|null',
      instrument_type: 'string|null',
      calibration_lab: 'string|null',
      certificate_number: 'string|null',
      calibration_date: 'YYYY-MM-DD|null',
      expiry_date: 'YYYY-MM-DD|null',
    },
  },

  qualifica_14732: {
    label: 'Qualifica operatore (ISO 14732)',
    aiPrompt: `Qualifica operatore saldatura automatica ISO 14732. Estrai: operator_name, certificate_number,
welding_process, equipment_type, exam_date, expiry_date (YYYY-MM-DD).`,
    aiExpectedSchema: {
      operator_name: 'string|null',
      certificate_number: 'string|null',
      welding_process: 'string|null',
      equipment_type: 'string|null',
      exam_date: 'YYYY-MM-DD|null',
      expiry_date: 'YYYY-MM-DD|null',
    },
  },

  qualifica_14731: {
    label: 'Coordinatore saldatura (ISO 14731)',
    aiPrompt: `Diploma/certificato coordinatore di saldatura ISO 14731 (IWE, IWT, IWS, IWP).
Estrai in type_specific_data: person_name, certificate_number, coordinator_title (IWE|IWT|IWS|IWP),
diploma_number, issuing_body, issue_date, cpd_valid_until (YYYY-MM-DD). Usa null se assente.`,
    aiExpectedSchema: {
      person_name: 'string|null',
      certificate_number: 'string|null',
      coordinator_title: 'IWE|IWT|IWS|IWP|null',
      diploma_number: 'string|null',
      issuing_body: 'string|null',
      issue_date: 'YYYY-MM-DD|null',
      cpd_valid_until: 'YYYY-MM-DD|null',
    },
  },

  pes_pav: {
    label: 'Abilitazione PES/PAV (CEI 11-27)',
    aiPrompt: `Attestato PES/PAV addetti ai lavori elettrici CEI 11-27.
Estrai in type_specific_data: person_name, patent_type (PES|PAV|PES+PAV),
training_body, certificate_number, issue_date, expiry_date (YYYY-MM-DD). Usa null se assente.`,
    aiExpectedSchema: {
      person_name: 'string|null',
      patent_type: 'PES|PAV|PES+PAV|null',
      training_body: 'string|null',
      certificate_number: 'string|null',
      issue_date: 'YYYY-MM-DD|null',
      expiry_date: 'YYYY-MM-DD|null',
    },
  },

  sal: {
    label: 'SAL � Stato avanzamento lavori',
    aiPrompt: `Documento SAL consulenza SGQ. Estrai: client_name, standards_tracked, period_label.`,
    aiExpectedSchema: {
      client_name: 'string|null',
      standards_tracked: 'string|null',
      period_label: 'string|null',
    },
  },

  rdp: {
    label: 'RDP � Rapporto di prova',
    aiPrompt: `Rapporto di prova RDP. Estrai: report_number, test_type, component_ref, test_date (YYYY-MM-DD).`,
    aiExpectedSchema: {
      report_number: 'string|null',
      test_type: 'string|null',
      component_ref: 'string|null',
      test_date: 'YYYY-MM-DD|null',
    },
  },
};

// Alias tipo documento -> chiave schema canonica (coerenza document_type_guess).
const DOC_TYPE_ALIASES = {
  qualifica_operatore: 'qualifica_14732',
};

function resolveDocTypeKey(docType) {
  const key = String(docType || '').trim();
  return DOC_TYPE_ALIASES[key] || key;
}

function getSchemaForDocType(docType) {
  return AI_SCHEMAS[resolveDocTypeKey(docType)] || null;
}

module.exports = { DOCUMENT_TYPE_SCHEMAS: AI_SCHEMAS, getSchemaForDocType, resolveDocTypeKey };

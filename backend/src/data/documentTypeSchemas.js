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
Se un campo non � presente nel documento, usa null.

Campi da estrarre:
- welder_name, certificate_number, issuing_body, welding_process, joint_type (BW|FW),
- product_type (variabile essenziale ISO 9606-1 §11: SOLO "P" piastra o "T" tubo/pipe, nessuna terza
  categoria "tubo-piastra" - un giunto di derivazione/branch/bocchello resta "T" (è un tipo di giunto,
  §3.16, non un tipo prodotto); dedurre da "plate/piastra" vs "pipe/tube/tubo" nel testo, null se non specificato),
- weld_details (dettagli di giunto se presenti: backing, mono/multistrato, saldatura sx/dx, oppure
  derivazione/branch/bocchello tubo-piastra - riportalo qui testualmente per non perdere l'informazione
  anche quando product_type resta "T"; testo libero breve, null se assenti),
- material_group, filler_material_group, welding_positions (array), thickness_min_mm, thickness_max_mm,
- thickness_max_unlimited (booleano — true SOLO se il certificato dichiara esplicitamente un range
  aperto senza limite superiore, es. simboli "≥"/"=>"/"⩾" o testo "no restriction"/"senza limite
  superiore" sullo spessore massimo qualificato; in tal caso lascia thickness_max_mm: null e imposta
  thickness_max_unlimited: true. Se il campo è semplicemente assente dal documento — non un range
  aperto dichiarato — lascia entrambi null/false: NON confondere le due situazioni),
- pipe_diameter_mm, shielding_gas, exam_date, expiry_date, last_confirmation_date,
- next_confirmation_due, standard_reference (YYYY-MM-DD per le date)
- transfer_mode (metodo di trasferimento del metallo d'apporto - variabile essenziale ISO 9606-1 §5.2,
  presente come colonna dedicata "Transfer mode" nel modulo certificato ufficiale §9.3): valorizzalo
  SOLO se il processo di saldatura e' ad arco con filo continuo (131 MIG, 135 MAG, 136 filo animato,
  138 filo animato metallico) e il certificato riporta esplicitamente la modalita'. Valori ammessi:
  "spray_arc" (spray/getto), "pulsed_arc" (pulsato), "short_arc" (arco corto/short-circuit/dip),
  "globular" (globulare). Per altri processi (111, 121, 141, 145, 311, ecc.) lascia null: il
  parametro non si applica (non esiste "transfer mode" per elettrodo rivestito, TIG o arco sommerso).

Per standard_reference: riporta ESATTAMENTE l'edizione/anno scritto sul certificato (es. "ISO 9606-1:2012"
se il documento la cita esplicitamente). Se il certificato NON specifica alcun anno, usa "ISO 9606-1:2017"
(edizione corrente in vigore, ha sostituito la 2012/2013) come default, non 2012.

Istruzioni per le date di conferma semestrale (ISO 9606-1 §9.2):
- I certificati ISO 9606-1 hanno una tabella in seconda pagina intitolata
  "Conferma della validita / Confirmation of the validity" con colonne Data/Date e Data di scadenza/Expiry Date.
- last_confirmation_date: ultima data presente in quella tabella (la piu recente). Se vuota, usa null.
- next_confirmation_due: "Data di scadenza" dell ultima riga compilata della tabella 9.2. Se la
  tabella e vuota, usa null (il sistema calcolera exam_date + 6 mesi in automatico).
- expiry_date: data "Valid until" dalla sezione 9.3 a) del certificato (rinnovo da ente esaminatore).`,
    aiExpectedSchema: {
      welder_name: 'string|null',
      certificate_number: 'string|null',
      issuing_body: 'string|null',
      welding_process: 'string|null',
      joint_type: 'BW|FW|null',
      product_type: 'P|T|null',
      weld_details: 'string|null',
      material_group: 'string|null',
      filler_material_group: 'string|null',
      welding_positions: 'string[]|null',
      thickness_min_mm: 'number|null',
      thickness_max_mm: 'number|null',
      thickness_max_unlimited: 'boolean|null',
      pipe_diameter_mm: 'number|null',
      shielding_gas: 'string|null',
      exam_date: 'YYYY-MM-DD|null',
      expiry_date: 'YYYY-MM-DD|null',
      last_confirmation_date: 'YYYY-MM-DD|null',
      next_confirmation_due: 'YYYY-MM-DD|null',
      standard_reference: 'string|null',
      transfer_mode: 'spray_arc|pulsed_arc|short_arc|globular|null',
    },
  },

  wps: {
    label: 'WPS (Procedura di saldatura)',
    aiPrompt: `Stai analizzando una WPS (Welding Procedure Specification) secondo EN ISO 15609-1 (arco) o 15609-2 (gas), spesso qualificata via ISO 15614.
Estrai nell'oggetto "type_specific_data":
- wps_number, wpqr_ref, welding_process (codice ISO 4063),
- base_material (designazione), material_group (ISO/TR 15608),
- thickness_min_mm, thickness_max_mm, pipe_outside_diameter_mm (null se solo piastra),
- joint_type (BW|FW o descrizione), welding_positions (array ISO 6947),
- filler_material (designazione consumabile ISO 14341 se filo MAG/MIG acciaio, es. "G 42 4 M21 3Si1"),
- shielding_gas (codice ISO 14175 es. "M21"/"I1", o null se senza gas / WPS gas 15609-2),
- preheat_temp (Tp ISO 13916), interpass_temp (Ti ISO 13916),
- heat_input (range se presente, solo arco), current_range, voltage_range (solo arco; null su WPS gas),
- flame_type, fuel_gas (solo WPS gas 15609-2; null su arco).
Usa null per i campi non trovati. Non inventare range assenti dal testo.`,
    aiExpectedSchema: {
      wps_number: 'string|null',
      welding_process: 'string|null',
      base_material: 'string|null',
      material_group: 'string|null',
      thickness_min_mm: 'number|null',
      thickness_max_mm: 'number|null',
      pipe_outside_diameter_mm: 'string|number|null',
      joint_type: 'string|null',
      welding_positions: 'string[]|null',
      filler_material: 'string|null',
      wpqr_ref: 'string|null',
      shielding_gas: 'string|null',
      preheat_temp: 'string|null',
      interpass_temp: 'string|null',
      heat_input: 'string|null',
      current_range: 'string|null',
      voltage_range: 'string|null',
      flame_type: 'string|null',
      fuel_gas: 'string|null',
    },
  },

  wpqr: {
    label: 'WPQR (Qualifica procedura)',
    aiPrompt: `Stai analizzando un WPQR (Welding Procedure Qualification Record) secondo ISO 15614.
Estrai TUTTI i seguenti campi in "type_specific_data". Se un campo non e presente, usa null.

Campi di copertura (pag.1 RANGE OF QUALIFICATION, priorita alta):
- wpqr_number: numero certificato/WPQR, accetta suffisso rivisione (es. "24-03390-01")
- qualification_level: "1" o "2" solo se dichiarato esplicitamente (Level 1/2) - non dedurre
- standard_reference: norma di riferimento (es. "UNI EN ISO 15614-1:2019")
- welding_process: codice ISO 4063 - preferire un codice numerico esplicito nel testo (es. "Welding process: 135") a un alias generico
- joint_type: "BW", "FW" o "BW+FW"
- material_group: gruppo materiale ISO/TR 15608, preferire il sottogruppo (es. "1.2") se presente
- thickness_test_mm: spessore del provino testato (numero)
- thickness_min / thickness_max: range di spessore DICHIARATO sul verbale (non calcolarlo)
- thickness_max_unlimited: booleano — true SOLO se il verbale dichiara esplicitamente un range aperto
  senza limite superiore (simboli "≥", "=>", "⩾", oppure testo "no restriction"/"senza limite
  superiore"), tipico dei giunti ad angolo (Fillet Weld: es. "t1 = => 5 ; t2 => 5"). In questo caso
  lascia thickness_max: null e imposta thickness_max_unlimited: true. Se il campo è semplicemente
  assente dal documento (non un range aperto dichiarato), lascia entrambi null/false — NON confondere
  le due situazioni
- diameter_min / diameter_max: range diametro tubo se applicabile
- throat_test_mm: spessore gola (throat) del provino testato, SOLO per giunti d'angolo/FW,
  se dichiarato esplicitamente sul verbale (Tabella 8) - numero, null se non applicabile o assente
- welding_positions: array posizioni ISO 6947 (es. ["PA"])
- filler_material: designazione materiale d'apporto (ISO 14341 se filo GMAW acciaio, es. "G 42 4 M21 3Si1")
- pwht: booleano, PWHT applicato
- wps_ref: identificativo testuale della WPS di riferimento
- examiner_body: ente/esaminatore (TUV, Bureau Veritas, DNV, RINA, IMQ, TEC Eurolab, Sideius, ecc.)
- welder_name: saldatore che ha eseguito la prova
- approval_date: data di emissione/approvazione del verbale (YYYY-MM-DD), preferire "Record issued"

Parametri prova (pag.2, priorita media):
- base_material_spec: specifica materiale base (es. "S355J2+N")
- shielding_gas: gas di protezione ISO 14175 (es. "M20", "M21"); se solo in designazione 14341, estrarre il simbolo gas
- current_type: tipo di corrente (es. "DC-EP")
- metal_transfer: modalita di trasferimento metallo
- mechanization: "manual"|"partly_mechanized"|"mechanized"|"automatic"
- single_multi_run: "single" o "multi"
- heat_input_note: nota breve sull'apporto termico, se presente
- preheat_temp: temperatura preriscaldo (Tp, ISO 13916), es. "min 100 C"
- interpass_temp: temperatura interpass (Ti, ISO 13916), es. "max 250 C"

IMPORTANTE: non ricalcolare i range con formule - estrarre solo i valori dichiarati sul verbale.`,
    aiExpectedSchema: {
      wpqr_number: 'string|null',
      qualification_level: '1|2|null',
      standard_reference: 'string|null',
      welding_process: 'string|null',
      joint_type: 'BW|FW|BW+FW|null',
      material_group: 'string|null',
      thickness_test_mm: 'number|null',
      thickness_min: 'number|null',
      thickness_max: 'number|null',
      thickness_max_unlimited: 'boolean|null',
      diameter_min: 'number|null',
      diameter_max: 'number|null',
      throat_test_mm: 'number|null',
      welding_positions: 'string[]|null',
      filler_material: 'string|null',
      pwht: 'boolean|null',
      wps_ref: 'string|null',
      examiner_body: 'string|null',
      welder_name: 'string|null',
      approval_date: 'YYYY-MM-DD|null',
      base_material_spec: 'string|null',
      shielding_gas: 'string|null',
      current_type: 'string|null',
      metal_transfer: 'string|null',
      mechanization: 'manual|partly_mechanized|mechanized|automatic|null',
      single_multi_run: 'single|multi|null',
      heat_input_note: 'string|null',
      preheat_temp: 'string|null',
      interpass_temp: 'string|null',
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
      validity_status: 'vigente|superata|annullata|in_revisione|da_verificare|null',
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

  // cert_ndt (ISO 9712:2022) — schema allineato a FE (documentTypeSchemas.js app/)
  // Campi per scadenziario + copertura personale NDT su commessa (ISO 3834 §8.2)
  cert_ndt: {
    label: 'Certificato NDT (ISO 9712)',
    aiPrompt: `Stai analizzando un certificato di qualifica operatore NDT secondo ISO 9712 (o versione precedente).
Estrai TUTTI i seguenti campi nell'oggetto "type_specific_data". Usa null se il campo non è presente.

Campi da estrarre:
- operator_name: cognome e nome del titolare (testo)
- certificate_number: numero certificato esatto come scritto (es. "1234/VT/2/CICPND/2022")
- ndt_method: SOLO uno tra VT | MT | PT | UT | RT | ET | AE | TT | ST | LT. Deduci dal titolo o dal testo italiano/inglese (es. "magnetoscopia"/"magnetic particle" → MT, "ultrasuoni"/"ultrasonic" → UT, "radiografico"/"radiographic" → RT, "liquidi penetranti"/"penetrant" → PT, "visivo"/"visual" → VT, "eddy current" → ET)
- certification_level: SOLO "1", "2" o "3" (non testo come "secondo" o "II")
- ndt_sector: codice ISO 9712 Annex A. Settori di PRODOTTO (A.2): c=castings/getti, f=forgings/forgiati, w=welds/saldature, t=tubes/tubi, wp=wrought products/laminati (esclusi forgiati), p=composites/compositi. Settori INDUSTRIALI (A.3): m=manufacturing/fabbricazione, s=pre-and in-service testing (prova pre-servizio e in servizio, include fabbricazione), r=railway maintenance/manutenzione ferroviaria, a=aerospace/aerospaziale. REGOLA: se il certificato indica sia settore di prodotto (anche "plurisettoriale") sia settore industriale, restituisci il codice INDUSTRIALE. Esempi: "Prova pre-servizio e in servizio di attrezzature, impianti e strutture" → s; "fabbricazione metalli" / manufacturing → m. "Plurisettoriale" da solo (senza industriale) → null. Restituisci solo il codice; null se assente.
- certification_scheme: nome dello schema (es. "CICPND", "PCN", "SNT-TC-1A", "ASNT", "COFREND"). Cerca nel numero certificato, nell'intestazione o nel logo dell'ente.
- scope_detail: tecnica specifica se presente (es. "PA" per phased array, "TOFD", "DR" per digital radiography). Null se non specificato.
- issuing_body: ente che ha emesso/firmato il certificato (es. "CICPND", "Bureau Veritas", "TÜV Rheinland", "RINA", "APAVE")
- exam_date: data esame qualifica (YYYY-MM-DD)
- expiry_date: data di scadenza validità certificato (YYYY-MM-DD). ISO 9712 §9.2: normalmente 5 anni dall'esame
- revalidation_date: data di rivalidazione/rinnovo se riportata (YYYY-MM-DD); null se non presente. NON copiare expiry_date qui se il documento non ha una data di rinnovo esplicita.`,
    aiExpectedSchema: {
      operator_name:        'string|null',
      certificate_number:   'string|null',
      ndt_method:           'VT|MT|PT|UT|RT|ET|AE|TT|ST|LT|null',
      certification_level:  '1|2|3|null',
      ndt_sector:           'c|f|w|t|wp|p|m|s|r|a|null',
      certification_scheme: 'string|null',
      scope_detail:         'string|null',
      issuing_body:         'string|null',
      exam_date:            'YYYY-MM-DD|null',
      expiry_date:          'YYYY-MM-DD|null',
      revalidation_date:    'YYYY-MM-DD|null',
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
    aiPrompt: `Stai analizzando una qualifica operatore/preparatore di saldatura automatica o meccanizzata secondo ISO 14732.
Estrai in type_specific_data: operator_name, certificate_number, issuing_body, welding_type (automatic|mechanized),
welding_process, equipment_type, welding_positions (array), single_multi_run (single|multi),
exam_date, expiry_date, last_confirmation_date, next_confirmation_due (YYYY-MM-DD),
qualification_method (iso_15614|iso_15613|iso_9606|production_test). Usa null se assente.
IMPORTANTE: NON assumere un intervallo di validita' fisso. ISO 14732 ha rivalidazione a 6 anni (opzione a) o
ciclo 3 anni con controllo NDT (opzione b), diversi dai 3/2 anni di ISO 9606-1 per saldatori manuali.`,
    aiExpectedSchema: {
      operator_name: 'string|null',
      certificate_number: 'string|null',
      issuing_body: 'string|null',
      welding_type: 'automatic|mechanized|null',
      welding_process: 'string|null',
      equipment_type: 'string|null',
      welding_positions: 'string[]|null',
      single_multi_run: 'single|multi|null',
      exam_date: 'YYYY-MM-DD|null',
      expiry_date: 'YYYY-MM-DD|null',
      last_confirmation_date: 'YYYY-MM-DD|null',
      next_confirmation_due: 'YYYY-MM-DD|null',
      qualification_method: 'iso_15614|iso_15613|iso_9606|production_test|null',
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

  dichiarazione_ce: {
    label: 'Dichiarazione CE',
    aiPrompt: `Dichiarazione CE di conformita. Estrai: manufacturer, product_name, directive_ref,
certificate_number, issue_date (YYYY-MM-DD), notified_body.`,
    aiExpectedSchema: {
      manufacturer: 'string|null',
      product_name: 'string|null',
      directive_ref: 'string|null',
      certificate_number: 'string|null',
      issue_date: 'YYYY-MM-DD|null',
      notified_body: 'string|null',
    },
  },

  report_ndt: {
    label: 'Report NDT',
    aiPrompt: `Rapporto prove NDT. Estrai: report_number, ndt_method (UT|RT|MT|PT|VT),
component_ref, test_date (YYYY-MM-DD), operator_name, result_summary.`,
    aiExpectedSchema: {
      report_number: 'string|null',
      ndt_method: 'UT|RT|MT|PT|VT|null',
      component_ref: 'string|null',
      test_date: 'YYYY-MM-DD|null',
      operator_name: 'string|null',
      result_summary: 'string|null',
    },
  },
};

function getSchemaForDocType(docType) {
  return AI_SCHEMAS[docType] || null;
}

module.exports = { DOCUMENT_TYPE_SCHEMAS: AI_SCHEMAS, getSchemaForDocType };

/**
 * Matrice conformità legislativa ambientale — seed checklist custom
 * Fonte: app/src/data/checklistTemplates.js (ISO_14001_LEGISLATIVO_TEMPLATE)
 * Rigenerare: node backend/scripts/buildLegislativoAmbientaleTemplate.js
 */

const TEMPLATE_MARKER = "[SGQ_TEMPLATE:LEG_AMBIENTE_152]";

const LEGISLATIVO_AMBIENTALE_TEMPLATE = {
  "name": "Conformità legislativa ambientale (D.Lgs. 152/06)",
  "description": "[SGQ_TEMPLATE:LEG_AMBIENTE_152] Matrice verifica adempimenti legali ambientali (VIA, AIA, rifiuti…). Non è audit ISO 14001 SGA.",
  "hasOutcomeButtons": true,
  "sections": [
    {
      "code": "14001_s4",
      "title": "4 - AMBIENTE E SICUREZZA",
      "displayOrder": 1,
      "items": [
        {
          "code": "2",
          "title": "EDILIZIA/AGIBILITA'",
          "displayOrder": 2,
          "responseType": "verbale"
        },
        {
          "code": "3",
          "title": "INDUSTRIE INSALUBRI",
          "displayOrder": 3,
          "responseType": "verbale"
        },
        {
          "code": "4",
          "title": "IMPIANTI TERMICI",
          "displayOrder": 4,
          "responseType": "verbale"
        },
        {
          "code": "5",
          "title": "INCIDENTI RILEVANTI",
          "displayOrder": 5,
          "responseType": "verbale"
        },
        {
          "code": "6",
          "title": "PREVENZIONE INCENDI / RISCHIO INCENDI",
          "displayOrder": 6,
          "responseType": "verbale"
        },
        {
          "code": "7",
          "title": "PIANO DI EMERGENZA",
          "displayOrder": 7,
          "responseType": "verbale"
        },
        {
          "code": "8",
          "title": "ADDETTI ALLE EMERGENZE",
          "displayOrder": 8,
          "responseType": "verbale"
        },
        {
          "code": "9",
          "title": "GAS TOSSICI",
          "displayOrder": 9,
          "responseType": "verbale"
        },
        {
          "code": "10",
          "title": "AMIANTO E RELATIVI RISCHI",
          "displayOrder": 10,
          "responseType": "verbale"
        },
        {
          "code": "11",
          "title": "TRASPORTO MATERIALI PERICOLOSI (ADR / RID)",
          "displayOrder": 11,
          "responseType": "verbale"
        },
        {
          "code": "12",
          "title": "SOSTANZE E PREPARATI PERICOLOSI / RISCHIO CHIMICO PER LA SALUTE E LA SICUREZZA",
          "displayOrder": 12,
          "responseType": "verbale"
        },
        {
          "code": "13",
          "title": "PCB / PCT",
          "displayOrder": 13,
          "responseType": "verbale"
        },
        {
          "code": "14",
          "title": "RADIAZIONI IONIZZANTI E RELATIVI RISCHI",
          "displayOrder": 14,
          "responseType": "verbale"
        }
      ]
    },
    {
      "code": "14001_s5",
      "title": "5. AMBIENTE",
      "displayOrder": 2,
      "items": [
        {
          "code": "15",
          "title": "VALUTAZIONE IMPATTO AMBIENTALE (VIA) e VALUTAZIONE AMBIENTALE STRATEGICA (VAS)",
          "displayOrder": 15,
          "responseType": "verbale"
        },
        {
          "code": "16",
          "title": "AUTORIZZAZIONE INTEGRATA AMBIENTALE (AIA) e IPPC",
          "displayOrder": 16,
          "responseType": "verbale"
        },
        {
          "code": "17",
          "title": "AUTORIZZAZIONE UNICA AMBIENTALE (AUA)",
          "displayOrder": 17,
          "responseType": "verbale"
        },
        {
          "code": "18",
          "title": "APPROVVIGIONAMENTO IDRICO",
          "displayOrder": 18,
          "responseType": "verbale"
        },
        {
          "code": "19",
          "title": "SCARICHI IDRICI",
          "displayOrder": 19,
          "responseType": "verbale"
        },
        {
          "code": "20",
          "title": "QUALITA' DELL'ARIA",
          "displayOrder": 20,
          "responseType": "verbale"
        },
        {
          "code": "21",
          "title": "EMISSIONI IN ATMOSFERA",
          "displayOrder": 21,
          "responseType": "verbale"
        },
        {
          "code": "22",
          "title": "EMISSIONI ODORIGENE",
          "displayOrder": 22,
          "responseType": "verbale"
        },
        {
          "code": "23",
          "title": "RIFIUTI",
          "displayOrder": 23,
          "responseType": "verbale"
        },
        {
          "code": "24",
          "title": "GESTIONE IMBALLAGGI (CONAI E CONSORZI DI FILIERA)",
          "displayOrder": 24,
          "responseType": "verbale"
        },
        {
          "code": "25",
          "title": "DISCARICHE E IMPIANTI DI INCENERIMENTO",
          "displayOrder": 25,
          "responseType": "verbale"
        },
        {
          "code": "26",
          "title": "TERRE E ROCCE DA SCAVO",
          "displayOrder": 26,
          "responseType": "verbale"
        },
        {
          "code": "27",
          "title": "BONIFICA SITI CONTAMINATI",
          "displayOrder": 27,
          "responseType": "verbale"
        },
        {
          "code": "28",
          "title": "CONTAMINAZIONE SUOLO E SOTTOSUOLO (Serbatoi Interrati)",
          "displayOrder": 28,
          "responseType": "verbale"
        },
        {
          "code": "29",
          "title": "GAS AD EFFETTO SERRA E LESIVI DELL'OZONO",
          "displayOrder": 29,
          "responseType": "verbale"
        },
        {
          "code": "30",
          "title": "INQUINAMENTO ACUSTICO",
          "displayOrder": 30,
          "responseType": "verbale"
        },
        {
          "code": "31",
          "title": "GESTIONE ENERGETICA ED ENERGY MANAGER",
          "displayOrder": 31,
          "responseType": "verbale"
        },
        {
          "code": "32",
          "title": "MOBILITY MANAGER",
          "displayOrder": 32,
          "responseType": "verbale"
        },
        {
          "code": "33",
          "title": "INQUINAMENTO ELETTROMAGNETICO",
          "displayOrder": 33,
          "responseType": "verbale"
        },
        {
          "code": "34",
          "title": "INQUINAMENTO LUMINOSO",
          "displayOrder": 34,
          "responseType": "verbale"
        },
        {
          "code": "35",
          "title": "SOSTENIBILITA' / CORPORATE SUSTAINABILITY REPORTING DIRECTIVE (CSRD)",
          "displayOrder": 35,
          "responseType": "verbale"
        },
        {
          "code": "36",
          "title": "MEDI IMPIANTI DI COMBUSTIONE",
          "displayOrder": 36,
          "responseType": "verbale"
        },
        {
          "code": "37",
          "title": "GRANDI IMPIANTI DI COMBUSTIONE",
          "displayOrder": 37,
          "responseType": "verbale"
        },
        {
          "code": "38",
          "title": "ATTIVITA' DI GESTIONE DEI RIFIUTI ED IMPIANTI DI RECUPERO (art. 208 e segg. D.Lgs. 152/06)",
          "displayOrder": 38,
          "responseType": "verbale"
        },
        {
          "code": "39",
          "title": "OLI USATI",
          "displayOrder": 39,
          "responseType": "verbale"
        },
        {
          "code": "40",
          "title": "RIFIUTI SANITARI/ORIGINE ANIMALE, SOTTOPRODOTTI DI ORIGINE ANIMALE",
          "displayOrder": 40,
          "responseType": "verbale"
        },
        {
          "code": "41",
          "title": "UTILIZZO FANGHI IN AGRICOLTURA",
          "displayOrder": 41,
          "responseType": "verbale"
        },
        {
          "code": "42",
          "title": "SOTTOPRODOTTI",
          "displayOrder": 42,
          "responseType": "verbale"
        },
        {
          "code": "43",
          "title": "ATTIVITA' DI AUTOSMALTIMENTO DI RIFIUTI PERICOLOSI",
          "displayOrder": 43,
          "responseType": "verbale"
        },
        {
          "code": "44",
          "title": "RISPARMIO ED EFFICIENZA ENERGETICA",
          "displayOrder": 44,
          "responseType": "verbale"
        },
        {
          "code": "45",
          "title": "EUDR, European Union Deforestation Regulation",
          "displayOrder": 45,
          "responseType": "verbale"
        },
        {
          "code": "46",
          "title": "PPWR (Packaging and Packaging Waste Regulation)",
          "displayOrder": 46,
          "responseType": "verbale"
        },
        {
          "code": "47",
          "title": "Prescrizioni AIA, AUA",
          "displayOrder": 47,
          "responseType": "verbale"
        }
      ]
    }
  ]
};

function isLegislativoAmbientaleDescription(description) {
  return typeof description === 'string' && description.includes(TEMPLATE_MARKER);
}

module.exports = { TEMPLATE_MARKER, LEGISLATIVO_AMBIENTALE_TEMPLATE, isLegislativoAmbientaleDescription };

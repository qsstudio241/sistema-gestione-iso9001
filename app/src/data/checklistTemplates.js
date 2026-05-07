/**
 * Checklist Templates - Fallback Statico
 * Sistema Gestione ISO 9001 - QS Studio
 * 
 * Template checklist utilizzato come fallback quando backend API non disponibile.
 * Dati estratti da: database/migrations/010_update_iso9001_35questions.sql
 * 
 * TODO: Sostituire con caricamento dinamico da GET /api/v1/standards/questions
 */

/**
 * Template ISO 9001:2015 (35 domande)
 * Fonte: CheckList\ChekList9001.txt (cliente)
 */
export const ISO_9001_TEMPLATE = {
  standardId: 1,
  standardCode: "ISO_9001_2015",
  standardName: "ISO 9001:2015",
  sections: [
    {
      sectionCode: "clause4",
      sectionTitle: "4 – Contesto dell'Organizzazione",
      displayOrder: 1,
      questions: [
        { questionId: 87,  clauseRef: "4.1", questionText: "Comprendere l'Organizzazione e il suo contesto", questionType: "conformity", isMandatory: true, displayOrder: 1 },
        { questionId: 88,  clauseRef: "4.2", questionText: "Esigenze e aspettative delle parti interessate", questionType: "conformity", isMandatory: true, displayOrder: 2 },
        { questionId: 89,  clauseRef: "4.3", questionText: "Campo di applicazione", questionType: "conformity", isMandatory: true, displayOrder: 3 },
        { questionId: 90,  clauseRef: "4.4", questionText: "Informazioni necessarie per supportare l'attuazione dei processi", questionType: "conformity", isMandatory: true, displayOrder: 4 }
      ]
    },
    {
      sectionCode: "clause5",
      sectionTitle: "5 – Leadership",
      displayOrder: 2,
      questions: [
        { questionId: 91,  clauseRef: "5.1",   questionText: "Leadership e Impegno", questionType: "conformity", isMandatory: true, displayOrder: 5 },
        { questionId: 92,  clauseRef: "5.2.1", questionText: "Politica per la Qualità", questionType: "conformity", isMandatory: true, displayOrder: 6 },
        { questionId: 93,  clauseRef: "5.2.2", questionText: "Comunicazione della Politica per la Qualità", questionType: "conformity", isMandatory: true, displayOrder: 7 },
        { questionId: 94,  clauseRef: "5.3",   questionText: "Ruoli organizzativi, responsabilità e autorità", questionType: "conformity", isMandatory: true, displayOrder: 8 }
      ]
    },
    {
      sectionCode: "clause6",
      sectionTitle: "6 – Pianificazione",
      displayOrder: 3,
      questions: [
        { questionId: 95, clauseRef: "6.1", questionText: "Azioni per affrontare rischi e opportunità", questionType: "conformity", isMandatory: true, displayOrder: 9 },
        { questionId: 96, clauseRef: "6.2", questionText: "Obiettivi per la Qualità", questionType: "conformity", isMandatory: true, displayOrder: 10 }
      ]
    },
    {
      sectionCode: "clause7",
      sectionTitle: "7 – Supporto",
      displayOrder: 4,
      questions: [
        { questionId: 97,  clauseRef: "7.1.2",   questionText: "Persone", questionType: "conformity", isMandatory: true, displayOrder: 13 },
        { questionId: 98,  clauseRef: "7.1.3",   questionText: "Infrastruttura", questionType: "conformity", isMandatory: true, displayOrder: 14 },
        { questionId: 99,  clauseRef: "7.1.4",   questionText: "Ambiente", questionType: "conformity", isMandatory: true, displayOrder: 15 },
        { questionId: 100, clauseRef: "7.1.5.1", questionText: "Idoneità allo scopo delle risorse per il monitoraggio e la misurazione", questionType: "conformity", isMandatory: true, displayOrder: 16 },
        { questionId: 101, clauseRef: "7.1.5.2", questionText: "Riferibilità metrologica per la taratura/verifica delle apparecchiature di misura", questionType: "conformity", isMandatory: true, displayOrder: 17 },
        { questionId: 102, clauseRef: "7.2",     questionText: "Evidenza delle competenze del personale", questionType: "conformity", isMandatory: true, displayOrder: 19 },
        { questionId: 103, clauseRef: "7.3",     questionText: "Consapevolezza", questionType: "conformity", isMandatory: true, displayOrder: 20 },
        { questionId: 104, clauseRef: "7.4",     questionText: "Comunicazione", questionType: "conformity", isMandatory: true, displayOrder: 21 },
        { questionId: 105, clauseRef: "7.5",     questionText: "Informazioni Documentate", questionType: "conformity", isMandatory: true, displayOrder: 22 }
      ]
    },
    {
      sectionCode: "clause8",
      sectionTitle: "8 – Attività Operative",
      displayOrder: 5,
      questions: [
        { questionId: 194, clauseRef: "8.1",   questionText: "Pianificazione e controllo operativi", questionType: "conformity", isMandatory: true, displayOrder: 39 },
         { questionId: 106, clauseRef: "8.2",   questionText: "Requisiti per prodotti e servizi", questionType: "conformity", isMandatory: true, displayOrder: 23 },
         { questionId: 107, clauseRef: "8.2.3", questionText: "Riesame dei requisiti", questionType: "conformity", isMandatory: true, displayOrder: 24 },
         { questionId: 108, clauseRef: "8.3",   questionText: "Progettazione", questionType: "conformity", isMandatory: true, displayOrder: 25 },
         { questionId: 109, clauseRef: "8.4.1", questionText: "Valutazione, selezione, monitoraggio delle prestazioni e rivalutazione dei fornitori esterni", questionType: "conformity", isMandatory: true, displayOrder: 26 },
        { questionId: 195, clauseRef: "8.4.2", questionText: "Tipo e grado di controllo dei processi, prodotti e servizi forniti esternamente", questionType: "conformity", isMandatory: true, displayOrder: 40 },
        { questionId: 196, clauseRef: "8.4.3", questionText: "Informazioni ai fornitori esterni", questionType: "conformity", isMandatory: true, displayOrder: 41 },
        { questionId: 197, clauseRef: "8.5.1", questionText: "Controllo della produzione e dell'erogazione del servizio", questionType: "conformity", isMandatory: true, displayOrder: 42 },
         { questionId: 110, clauseRef: "8.5.2", questionText: "Rintracciabilità degli output", questionType: "conformity", isMandatory: true, displayOrder: 27 },
         { questionId: 111, clauseRef: "8.5.3", questionText: "Proprietà del cliente/fornitore", questionType: "conformity", isMandatory: true, displayOrder: 28 },
        { questionId: 198, clauseRef: "8.5.4", questionText: "Conservazione degli output", questionType: "conformity", isMandatory: true, displayOrder: 43 },
         { questionId: 112, clauseRef: "8.5.5", questionText: "Post vendita", questionType: "conformity", isMandatory: true, displayOrder: 29 },
         { questionId: 113, clauseRef: "8.5.6", questionText: "Controllo delle modifiche", questionType: "conformity", isMandatory: true, displayOrder: 30 },
         { questionId: 114, clauseRef: "8.6",   questionText: "Rilascio dei prodotti/servizi", questionType: "conformity", isMandatory: true, displayOrder: 31 },
        { questionId: 199, clauseRef: "8.7.1", questionText: "Gestione degli output non conformi (azioni da intraprendere)", questionType: "conformity", isMandatory: true, displayOrder: 44 },
         { questionId: 115, clauseRef: "8.7.2", questionText: "Descrizione delle Non Conformità, Azioni adottate, concessioni ottenute", questionType: "conformity", isMandatory: true, displayOrder: 32 }
      ]
    },
    {
      sectionCode: "clause9",
      sectionTitle: "9 – Valutazione delle Prestazioni",
      displayOrder: 6,
      questions: [
        { questionId: 116, clauseRef: "9.1.1", questionText: "Valutazione delle prestazioni del SGQ (KPI)", questionType: "conformity", isMandatory: true, displayOrder: 33 },
        { questionId: 117, clauseRef: "9.1.2", questionText: "Customer Satisfaction", questionType: "conformity", isMandatory: true, displayOrder: 34 },
        { questionId: 118, clauseRef: "9.2.2", questionText: "Attuazione del programma di audit e risultati di audit", questionType: "conformity", isMandatory: true, displayOrder: 35 },
        { questionId: 119, clauseRef: "9.3.3", questionText: "Risultati dei Riesami di Direzione", questionType: "conformity", isMandatory: true, displayOrder: 36 }
      ]
    },
    {
      sectionCode: "clause10",
      sectionTitle: "10 – Miglioramento",
      displayOrder: 7,
      questions: [
        { questionId: 120, clauseRef: "10.2", questionText: "Non conformità e Azioni Correttive", questionType: "conformity", isMandatory: true, displayOrder: 37 },
        { questionId: 121, clauseRef: "10.3", questionText: "Miglioramento continuo", questionType: "conformity", isMandatory: true, displayOrder: 38 }
      ]
    }
  ]
};

/**
 * Template ISO 14001:2015 – Checklist Legislativa Ambiente & Sicurezza
 * 2 sezioni normative — 46 domande
 * Fonte: CheckList\ChekList14001.txt (cliente)
 * questionId: null = domande non ancora nel DB (sync silenzioso; vedere migration 012)
 */
export const ISO_14001_TEMPLATE = {
  standardId: 2,
  standardCode: "ISO_14001_2015",
  standardName: "ISO 14001:2015",
  sections: [
    {
      sectionCode: "14001_s4",
      sectionTitle: "4 – AMBIENTE E SICUREZZA",
      displayOrder: 1,
      questions: [
        { questionId: 122, clauseRef: "2",  questionText: "EDILIZIA/AGIBILITA'", questionType: "conformity", isMandatory: true, displayOrder: 2 },
        { questionId: 123, clauseRef: "3",  questionText: "INDUSTRIE INSALUBRI", questionType: "conformity", isMandatory: true, displayOrder: 3 },
        { questionId: 124, clauseRef: "4",  questionText: "IMPIANTI TERMICI", questionType: "conformity", isMandatory: true, displayOrder: 4 },
        { questionId: 125, clauseRef: "5",  questionText: "INCIDENTI RILEVANTI", questionType: "conformity", isMandatory: true, displayOrder: 5 },
        { questionId: 126, clauseRef: "6",  questionText: "PREVENZIONE INCENDI / RISCHIO INCENDI", questionType: "conformity", isMandatory: true, displayOrder: 6 },
        { questionId: 127, clauseRef: "7",  questionText: "PIANO DI EMERGENZA", questionType: "conformity", isMandatory: true, displayOrder: 7 },
        { questionId: 128, clauseRef: "8",  questionText: "ADDETTI ALLE EMERGENZE", questionType: "conformity", isMandatory: true, displayOrder: 8 },
        { questionId: 129, clauseRef: "9",  questionText: "GAS TOSSICI", questionType: "conformity", isMandatory: true, displayOrder: 9 },
        { questionId: 130, clauseRef: "10", questionText: "AMIANTO E RELATIVI RISCHI", questionType: "conformity", isMandatory: true, displayOrder: 10 },
        { questionId: 131, clauseRef: "11", questionText: "TRASPORTO MATERIALI PERICOLOSI (ADR / RID)", questionType: "conformity", isMandatory: true, displayOrder: 11 },
        { questionId: 132, clauseRef: "12", questionText: "SOSTANZE E PREPARATI PERICOLOSI / RISCHIO CHIMICO PER LA SALUTE E LA SICUREZZA", questionType: "conformity", isMandatory: true, displayOrder: 12 },
        { questionId: 133, clauseRef: "13", questionText: "PCB / PCT", questionType: "conformity", isMandatory: true, displayOrder: 13 },
        { questionId: 134, clauseRef: "14", questionText: "RADIAZIONI IONIZZANTI E RELATIVI RISCHI", questionType: "conformity", isMandatory: true, displayOrder: 14 }
      ]
    },
    {
      sectionCode: "14001_s5",
      sectionTitle: "5. AMBIENTE",
      displayOrder: 2,
      questions: [
        { questionId: 135, clauseRef: "15", questionText: "VALUTAZIONE IMPATTO AMBIENTALE (VIA) e VALUTAZIONE AMBIENTALE STRATEGICA (VAS)", questionType: "conformity", isMandatory: true, displayOrder: 15 },
        { questionId: 136, clauseRef: "16", questionText: "AUTORIZZAZIONE INTEGRATA AMBIENTALE (AIA) e IPPC", questionType: "conformity", isMandatory: true, displayOrder: 16 },
        { questionId: 137, clauseRef: "17", questionText: "AUTORIZZAZIONE UNICA AMBIENTALE (AUA)", questionType: "conformity", isMandatory: true, displayOrder: 17 },
        { questionId: 138, clauseRef: "18", questionText: "APPROVVIGIONAMENTO IDRICO", questionType: "conformity", isMandatory: true, displayOrder: 18 },
        { questionId: 139, clauseRef: "19", questionText: "SCARICHI IDRICI", questionType: "conformity", isMandatory: true, displayOrder: 19 },
        { questionId: 140, clauseRef: "20", questionText: "QUALITA' DELL'ARIA", questionType: "conformity", isMandatory: true, displayOrder: 20 },
        { questionId: 141, clauseRef: "21", questionText: "EMISSIONI IN ATMOSFERA", questionType: "conformity", isMandatory: true, displayOrder: 21 },
        { questionId: 142, clauseRef: "22", questionText: "EMISSIONI ODORIGENE", questionType: "conformity", isMandatory: true, displayOrder: 22 },
        { questionId: 143, clauseRef: "23", questionText: "RIFIUTI", questionType: "conformity", isMandatory: true, displayOrder: 23 },
        { questionId: 144, clauseRef: "24", questionText: "GESTIONE IMBALLAGGI (CONAI E CONSORZI DI FILIERA)", questionType: "conformity", isMandatory: true, displayOrder: 24 },
        { questionId: 145, clauseRef: "25", questionText: "DISCARICHE E IMPIANTI DI INCENERIMENTO", questionType: "conformity", isMandatory: true, displayOrder: 25 },
        { questionId: 146, clauseRef: "26", questionText: "TERRE E ROCCE DA SCAVO", questionType: "conformity", isMandatory: true, displayOrder: 26 },
        { questionId: 147, clauseRef: "27", questionText: "BONIFICA SITI CONTAMINATI", questionType: "conformity", isMandatory: true, displayOrder: 27 },
        { questionId: 148, clauseRef: "28", questionText: "CONTAMINAZIONE SUOLO E SOTTOSUOLO (Serbatoi Interrati)", questionType: "conformity", isMandatory: true, displayOrder: 28 },
        { questionId: 149, clauseRef: "29", questionText: "GAS AD EFFETTO SERRA E LESIVI DELL'OZONO", questionType: "conformity", isMandatory: true, displayOrder: 29 },
        { questionId: 150, clauseRef: "30", questionText: "INQUINAMENTO ACUSTICO", questionType: "conformity", isMandatory: true, displayOrder: 30 },
        { questionId: 151, clauseRef: "31", questionText: "GESTIONE ENERGETICA ED ENERGY MANAGER", questionType: "conformity", isMandatory: true, displayOrder: 31 },
        { questionId: 152, clauseRef: "32", questionText: "MOBILITY MANAGER", questionType: "conformity", isMandatory: true, displayOrder: 32 },
        { questionId: 153, clauseRef: "33", questionText: "INQUINAMENTO ELETTROMAGNETICO", questionType: "conformity", isMandatory: true, displayOrder: 33 },
        { questionId: 154, clauseRef: "34", questionText: "INQUINAMENTO LUMINOSO", questionType: "conformity", isMandatory: true, displayOrder: 34 },
        { questionId: 155, clauseRef: "35", questionText: "SOSTENIBILITA' / CORPORATE SUSTAINABILITY REPORTING DIRECTIVE (CSRD)", questionType: "conformity", isMandatory: true, displayOrder: 35 },
        { questionId: 156, clauseRef: "36", questionText: "MEDI IMPIANTI DI COMBUSTIONE", questionType: "conformity", isMandatory: true, displayOrder: 36 },
        { questionId: 157, clauseRef: "37", questionText: "GRANDI IMPIANTI DI COMBUSTIONE", questionType: "conformity", isMandatory: true, displayOrder: 37 },
        { questionId: 158, clauseRef: "38", questionText: "ATTIVITA' DI GESTIONE DEI RIFIUTI ED IMPIANTI DI RECUPERO (art. 208 e segg. D.Lgs. 152/06)", questionType: "conformity", isMandatory: true, displayOrder: 38 },
        { questionId: 159, clauseRef: "39", questionText: "OLI USATI", questionType: "conformity", isMandatory: true, displayOrder: 39 },
        { questionId: 160, clauseRef: "40", questionText: "RIFIUTI SANITARI/ORIGINE ANIMALE, SOTTOPRODOTTI DI ORIGINE ANIMALE", questionType: "conformity", isMandatory: true, displayOrder: 40 },
        { questionId: 161, clauseRef: "41", questionText: "UTILIZZO FANGHI IN AGRICOLTURA", questionType: "conformity", isMandatory: true, displayOrder: 41 },
        { questionId: 162, clauseRef: "42", questionText: "SOTTOPRODOTTI", questionType: "conformity", isMandatory: true, displayOrder: 42 },
        { questionId: 163, clauseRef: "43", questionText: "ATTIVITA' DI AUTOSMALTIMENTO DI RIFIUTI PERICOLOSI", questionType: "conformity", isMandatory: true, displayOrder: 43 },
        { questionId: 164, clauseRef: "44", questionText: "RISPARMIO ED EFFICIENZA ENERGETICA", questionType: "conformity", isMandatory: true, displayOrder: 44 },
        { questionId: 165, clauseRef: "45", questionText: "EUDR, European Union Deforestation Regulation", questionType: "conformity", isMandatory: true, displayOrder: 45 },
        { questionId: 166, clauseRef: "46", questionText: "PPWR (Packaging and Packaging Waste Regulation)", questionType: "conformity", isMandatory: true, displayOrder: 46 },
        { questionId: 167, clauseRef: "47", questionText: "Prescrizioni AIA, AUA", questionType: "conformity", isMandatory: true, displayOrder: 47 }
      ]
    }
  ]
};

/**
 * Template ISO 3834-2:2021 (Requisiti di qualità per la saldatura per fusione dei materiali metallici)
 * Requisiti completi — 36 domande di audit (clausole norma ISO 3834-2)
 * Usato da Mason per audit di seconda parte su committenti.
 * questionId: null = domande non ancora nel DB (sync silenzioso)
 */
export const RDP_MSN_TEMPLATE = {
  standardId: 7,
  standardCode: "RDP_MSN",
  standardName: "Rapporto di Prova / Audit Fornitori (ISO 3834)",
  sections: [
    {
      sectionCode: "3834_s4",
      sectionTitle: "4 – Riesame dei requisiti e riesame tecnico",
      displayOrder: 1,
      questions: [
        { questionId: null, clauseRef: "1",  questionText: "Riesame dei requisiti contrattuali prima dell'offerta/ordine (4.2)", questionType: "conformity", isMandatory: true, displayOrder: 1 },
        { questionId: null, clauseRef: "2",  questionText: "Riesame tecnico della fattibilità della saldatura (4.3)", questionType: "conformity", isMandatory: true, displayOrder: 2 },
        { questionId: null, clauseRef: "3",  questionText: "Eventuali subappalti di saldatura documentati e comunicati al cliente (6)", questionType: "conformity", isMandatory: true, displayOrder: 3 }
      ]
    },
    {
      sectionCode: "3834_s7",
      sectionTitle: "7 – Personale di saldatura",
      displayOrder: 2,
      questions: [
        { questionId: null, clauseRef: "4",  questionText: "Saldatori e operatori qualificati secondo norme applicabili (ISO 9606, ISO 14732) (7.1)", questionType: "conformity", isMandatory: true, displayOrder: 4 },
        { questionId: null, clauseRef: "5",  questionText: "Coordinatori di saldatura con competenze tecniche adeguate (IWE/IWT/IWS) (7.2)", questionType: "conformity", isMandatory: true, displayOrder: 5 },
        { questionId: null, clauseRef: "6",  questionText: "Addetti al controllo di saldatura qualificati (NDT, ispezione) (8)", questionType: "conformity", isMandatory: true, displayOrder: 6 }
      ]
    },
    {
      sectionCode: "3834_s10",
      sectionTitle: "10 – Attrezzature di saldatura e accessorie",
      displayOrder: 3,
      questions: [
        { questionId: null, clauseRef: "7",  questionText: "Attrezzature di saldatura idonee, disponibili e manutenute (10.1)", questionType: "conformity", isMandatory: true, displayOrder: 7 },
        { questionId: null, clauseRef: "8",  questionText: "Attrezzature di taglio, fissaggio e movimentazione adeguate (10.1)", questionType: "conformity", isMandatory: true, displayOrder: 8 },
        { questionId: null, clauseRef: "9",  questionText: "Strumenti di misura tarati e idonei (calibrazione documentata) (10.2)", questionType: "conformity", isMandatory: true, displayOrder: 9 }
      ]
    },
    {
      sectionCode: "3834_s11",
      sectionTitle: "11 – Attività di saldatura (pianificazione e WPS)",
      displayOrder: 4,
      questions: [
        { questionId: null, clauseRef: "10", questionText: "Specifiche di procedura di saldatura (WPS) disponibili e approvate (11.1)", questionType: "conformity", isMandatory: true, displayOrder: 10 },
        { questionId: null, clauseRef: "11", questionText: "Procedure qualificate (WPQR/PQR) secondo norme applicabili (ISO 15614) (11.2)", questionType: "conformity", isMandatory: true, displayOrder: 11 },
        { questionId: null, clauseRef: "12", questionText: "Pianificazione della produzione include sequenza e condizioni di saldatura (11.3)", questionType: "conformity", isMandatory: true, displayOrder: 12 },
        { questionId: null, clauseRef: "13", questionText: "Materiali di apporto conformi alle specifiche e correttamente conservati (11.4)", questionType: "conformity", isMandatory: true, displayOrder: 13 },
        { questionId: null, clauseRef: "14", questionText: "Materiali base conformi alle specifiche contrattuali (11.4)", questionType: "conformity", isMandatory: true, displayOrder: 14 },
        { questionId: null, clauseRef: "15", questionText: "Trattamento termico post-saldatura (PWHT) pianificato e documentato se richiesto (11.5)", questionType: "conformity", isMandatory: true, displayOrder: 15 }
      ]
    },
    {
      sectionCode: "3834_s12",
      sectionTitle: "12 – Controllo e prove (prima, durante e dopo la saldatura)",
      displayOrder: 5,
      questions: [
        { questionId: null, clauseRef: "16", questionText: "Controlli pre-saldatura: pulizia, geometria, posizionamento, puntatura (12.1)", questionType: "conformity", isMandatory: true, displayOrder: 16 },
        { questionId: null, clauseRef: "17", questionText: "Controlli in corso d'opera: parametri saldatura, sequenza, interpass (12.2)", questionType: "conformity", isMandatory: true, displayOrder: 17 },
        { questionId: null, clauseRef: "18", questionText: "Controlli post-saldatura: esame visivo (VT) su tutti i giunti (12.3)", questionType: "conformity", isMandatory: true, displayOrder: 18 },
        { questionId: null, clauseRef: "19", questionText: "Controlli non distruttivi (NDT) secondo norma e contratto (PT, MT, RT, UT) (12.3)", questionType: "conformity", isMandatory: true, displayOrder: 19 },
        { questionId: null, clauseRef: "20", questionText: "Prove distruttive (DT) e prove di accettazione eseguite e documentate (12.3)", questionType: "conformity", isMandatory: true, displayOrder: 20 }
      ]
    },
    {
      sectionCode: "3834_s14",
      sectionTitle: "14 – Non conformità e azioni correttive",
      displayOrder: 6,
      questions: [
        { questionId: null, clauseRef: "21", questionText: "Difetti rilevati riparati secondo procedura qualificata o rilavorati (14.1)", questionType: "conformity", isMandatory: true, displayOrder: 21 },
        { questionId: null, clauseRef: "22", questionText: "Non conformità registrate con analisi causa e azione correttiva (14.2)", questionType: "conformity", isMandatory: true, displayOrder: 22 },
        { questionId: null, clauseRef: "23", questionText: "Prodotti non conformi identificati e segregati per evitare uso involontario (14.3)", questionType: "conformity", isMandatory: true, displayOrder: 23 }
      ]
    },
    {
      sectionCode: "3834_s15",
      sectionTitle: "15 – Identificazione e rintracciabilità",
      displayOrder: 7,
      questions: [
        { questionId: null, clauseRef: "24", questionText: "Materiali base identificati e rintracciabili durante tutto il processo (15.1)", questionType: "conformity", isMandatory: true, displayOrder: 24 },
        { questionId: null, clauseRef: "25", questionText: "Materiali di apporto identificati e rintracciabili durante tutto il processo (15.1)", questionType: "conformity", isMandatory: true, displayOrder: 25 },
        { questionId: null, clauseRef: "26", questionText: "Giunti saldati identificati e rintracciabili rispetto a WPS e saldatore (15.2)", questionType: "conformity", isMandatory: true, displayOrder: 26 }
      ]
    },
    {
      sectionCode: "3834_s16",
      sectionTitle: "16 – Registrazioni della qualità",
      displayOrder: 8,
      questions: [
        { questionId: null, clauseRef: "27", questionText: "Registrazioni delle qualifiche di saldatori e operatori disponibili e aggiornate (16)", questionType: "conformity", isMandatory: true, displayOrder: 27 },
        { questionId: null, clauseRef: "28", questionText: "Qualifiche delle procedure di saldatura (WPQR) documentate e aggiornate (16)", questionType: "conformity", isMandatory: true, displayOrder: 28 },
        { questionId: null, clauseRef: "29", questionText: "Certificati dei materiali base e di apporto conservati e rintracciabili (16)", questionType: "conformity", isMandatory: true, displayOrder: 29 },
        { questionId: null, clauseRef: "30", questionText: "Rapporti di controllo e prove (VT, NDT, DT) conservati e accessibili (16)", questionType: "conformity", isMandatory: true, displayOrder: 30 },
        { questionId: null, clauseRef: "31", questionText: "Registrazioni del trattamento termico (PWHT) disponibili se applicabile (16)", questionType: "conformity", isMandatory: true, displayOrder: 31 },
        { questionId: null, clauseRef: "32", questionText: "Dossier di saldatura completo per ogni commessa/struttura prodotta (16)", questionType: "conformity", isMandatory: true, displayOrder: 32 }
      ]
    },
    {
      sectionCode: "3834_s17",
      sectionTitle: "17 – Dichiarazione di conformità",
      displayOrder: 9,
      questions: [
        { questionId: null, clauseRef: "33", questionText: "Dichiarazione di conformità alla norma ISO 3834-2 disponibile e aggiornata (17)", questionType: "conformity", isMandatory: true, displayOrder: 33 },
        { questionId: null, clauseRef: "34", questionText: "Marcatura CE / dichiarazioni di prestazione per prodotti saldati (se applicabile) (17)", questionType: "conformity", isMandatory: true, displayOrder: 34 },
        { questionId: null, clauseRef: "35", questionText: "Certificazione di terza parte o attestazione di conformità ISO 3834-2 (se richiesta) (17)", questionType: "conformity", isMandatory: true, displayOrder: 35 },
        { questionId: null, clauseRef: "36", questionText: "Piano di gestione qualità di saldatura (WQMP) redatto e applicato (generale)", questionType: "conformity", isMandatory: true, displayOrder: 36 }
      ]
    }
  ]
};

/**
 * Template ISO 3834-2 — Checklist In Campo per Audit Fornitori (Mason Srl)
 * 22 domande suddivise in 4 sezioni operative.
 * Fonte: Checklist_in campo_TIPO_audit_fornitori.pdf
 * questionId: null = domande non ancora nel DB (sync silenzioso)
 */
export const ISO_3834_TEMPLATE = {
  standardId: 6,
  standardCode: "ISO_3834_2",
  standardName: "ISO 3834-2 — Audit Fornitori in Campo",
  sections: [
    {
      sectionCode: "3834_s1",
      sectionTitle: "GESTIONE QUALIT\u00c0",
      displayOrder: 1,
      questions: [
        { questionId: null, clauseRef: "3834f_q1",  displayOrder: 1,  questionType: "conformity", isMandatory: true,
          questionText: "Il fornitore \u00e8 in possesso di certificazione UNI EN ISO 9001?" },
        { questionId: null, clauseRef: "3834f_q2",  displayOrder: 2,  questionType: "conformity", isMandatory: true,
          questionText: "Qualora il fornitore sia certificato ISO 3834 si effettua un corretto riesame dei requisiti?" },
        { questionId: null, clauseRef: "3834f_q3",  displayOrder: 3,  questionType: "conformity", isMandatory: true,
          questionText: "Vengono subappaltate alcune attivit\u00e0 (es. saldatura, ispezione, controlli non distruttivi, trattamenti termici)?" },
        { questionId: null, clauseRef: "3834f_q4",  displayOrder: 4,  questionType: "conformity", isMandatory: true,
          questionText: "\u00c8 stato stabilito un criterio di accettabilit\u00e0 fra le parti?" },
        { questionId: null, clauseRef: "3834f_q5",  displayOrder: 5,  questionType: "conformity", isMandatory: false,
          questionText: "Il fornitore ha preparato il PPAP in accordo alle specifiche di riferimento?" },
        { questionId: null, clauseRef: "3834f_q6",  displayOrder: 6,  questionType: "conformity", isMandatory: true,
          questionText: "Come vengono gestite le eventuali non conformit\u00e0?" }
      ]
    },
    {
      sectionCode: "3834_s2",
      sectionTitle: "CONTROLLO DOCUMENTALE",
      displayOrder: 2,
      questions: [
        { questionId: null, clauseRef: "3834f_q7",  displayOrder: 7,  questionType: "conformity", isMandatory: true,
          questionText: "La rintracciabilit\u00e0 del materiale \u00e8 garantita? Vengono gestiti i certificati con documenti secondo ISO 10204?" },
        { questionId: null, clauseRef: "3834f_q8",  displayOrder: 8,  questionType: "conformity", isMandatory: true,
          questionText: "\u00c8 presente un coordinatore di saldatura (IWT/IWE)?" },
        { questionId: null, clauseRef: "3834f_q9",  displayOrder: 9,  questionType: "conformity", isMandatory: true,
          questionText: "I saldatori e gli operatori di saldatura (WQ) sono in grado di eseguire le attivit\u00e0 di saldatura? Sono provvisti di qualifiche ISO 9606/ISO 14732?" },
        { questionId: null, clauseRef: "3834f_q10", displayOrder: 10, questionType: "conformity", isMandatory: true,
          questionText: "I procedimenti di saldatura (WPQR) sono correttamente qualificati (ISO 15614/ISO 15613)?" },
        { questionId: null, clauseRef: "3834f_q11", displayOrder: 11, questionType: "conformity", isMandatory: true,
          questionText: "Sono presenti specifiche di saldatura (WPS) applicabili ai componenti ispezionati?" },
        { questionId: null, clauseRef: "3834f_q12", displayOrder: 12, questionType: "conformity", isMandatory: true,
          questionText: "Il personale addetto alle prove non distruttive \u00e8 qualificato (certificazione CND secondo ISO 9712)?" }
      ]
    },
    {
      sectionCode: "3834_s3",
      sectionTitle: "ISPEZIONE IN CAMPO",
      displayOrder: 3,
      questions: [
        { questionId: null, clauseRef: "3834f_q13", displayOrder: 13, questionType: "conformity", isMandatory: true,
          questionText: "Il fornitore possiede adeguate attrezzature per la saldatura? Sono manutenute e i parametri di voltaggio/corrente controllati periodicamente?" },
        { questionId: null, clauseRef: "3834f_q14", displayOrder: 14, questionType: "conformity", isMandatory: true,
          questionText: "Sono disponibili i disegni tecnici nelle aree di saldatura?" },
        { questionId: null, clauseRef: "3834f_q15", displayOrder: 15, questionType: "conformity", isMandatory: true,
          questionText: "Controllo della pulizia del pezzo: il materiale base \u00e8 pulito e privo di sporcizia prima della saldatura?" },
        { questionId: null, clauseRef: "3834f_q16", displayOrder: 16, questionType: "conformity", isMandatory: false,
          questionText: "Le maschere di saldatura sono monitorate dimensionalmente? Sono etichettate e controllate periodicamente?" },
        { questionId: null, clauseRef: "3834f_q17", displayOrder: 17, questionType: "conformity", isMandatory: true,
          questionText: "La puntatura del pezzo presenta criticit\u00e0? C'\u00e8 personale dedicato con patentini e istruzioni operative dedicate?" },
        { questionId: null, clauseRef: "3834f_q18", displayOrder: 18, questionType: "conformity", isMandatory: true,
          questionText: "Eventuali riparazioni sul pezzo vengono registrate? Esistono WPS dedicate alle riparazioni?" },
        { questionId: null, clauseRef: "3834f_q19", displayOrder: 19, questionType: "conformity", isMandatory: true,
          questionText: "Le condizioni di stoccaggio del Materiale Base, d'Apporto e Gas risultano adeguate (umidit\u00e0, temperatura)?" }
      ]
    },
    {
      sectionCode: "3834_s4",
      sectionTitle: "CONTROLLO POST-SALDATURA",
      displayOrder: 4,
      questions: [
        { questionId: null, clauseRef: "3834f_q20", displayOrder: 20, questionType: "conformity", isMandatory: true,
          questionText: "Sono eseguiti e registrati Controlli Non Distruttivi (CND)? Quali sono e che estensione hanno?" },
        { questionId: null, clauseRef: "3834f_q21", displayOrder: 21, questionType: "conformity", isMandatory: true,
          questionText: "Si eseguono controlli dimensionali del pezzo in accordo ai disegni contrattuali? \u00c8 disponibile il rapporto dimensionale?" },
        { questionId: null, clauseRef: "3834f_q22", displayOrder: 22, questionType: "conformity", isMandatory: false,
          questionText: "\u00c8 contemplata una marcatura del pezzo finito?" }
      ]
    }
  ]
};

/**
 * Template ISO 45001:2018 (Sistema di Gestione per la Salute e Sicurezza sul Lavoro)
 * Clausole 4-10 — 53 domande di audit (migration 051, sezioni 45001_c4..c10)
 * questionId: null = le domande reali vengono caricate dal DB via API
 */
export const ISO_45001_TEMPLATE = {
  standardId: 3,
  standardCode: "ISO_45001_2018",
  standardName: "ISO 45001:2018",
  sections: [
    {
      sectionCode: "45001_c4",
      sectionTitle: "4 - Contesto dell'Organizzazione",
      displayOrder: 1,
      questions: [
        { questionId: null, questionText: "4.1 - Fattori esterni e interni pertinenti alle finalità del SGSSL e alla capacità di conseguire i risultati attesi determinati?", questionType: "conformity", isMandatory: true, displayOrder: 1 },
        { questionId: null, questionText: "4.2 - Parti interessate (lavoratori + altri) pertinenti al SGSSL, esigenze/aspettative e quali diventano requisiti legali determinati?", questionType: "conformity", isMandatory: true, displayOrder: 2 },
        { questionId: null, questionText: "4.3 - Campo di applicazione del SGSSL determinato (fattori 4.1, requisiti 4.2, attività correlate al lavoro); disponibile come informazione documentata?", questionType: "conformity", isMandatory: true, displayOrder: 3 },
        { questionId: null, questionText: "4.3 - Il SGSSL include le attività, prodotti e servizi nell'ambito del controllo o dell'influenza dell'organizzazione con impatto sulla SSL?", questionType: "conformity", isMandatory: true, displayOrder: 4 },
        { questionId: null, questionText: "4.4 - Il SGSSL è stabilito, attuato, mantenuto e migliorato in modo continuo, compresi i processi necessari e le loro interazioni?", questionType: "conformity", isMandatory: true, displayOrder: 5 }
      ]
    },
    {
      sectionCode: "45001_c5",
      sectionTitle: "5 - Leadership e Partecipazione dei Lavoratori",
      displayOrder: 2,
      questions: [
        { questionId: null, questionText: "5.1 - Alta direzione: piena responsabilità per prevenzione lesioni/malattie, risorse assicurate, SSL integrata nei processi di business, importanza SSL comunicata, risultati attesi conseguiti?", questionType: "conformity", isMandatory: true, displayOrder: 6 },
        { questionId: null, questionText: "5.1 - Alta direzione: guida persone verso l'efficacia SGSSL, promuove miglioramento continuo, sviluppa cultura SSL, protegge lavoratori da ritorsioni, assicura processi di consultazione e partecipazione?", questionType: "conformity", isMandatory: true, displayOrder: 7 },
        { questionId: null, questionText: "5.2 - Politica per la SSL stabilita: impegno a condizioni sicure/salubri, quadro per obiettivi SSL, impegno a requisiti legali, eliminazione pericoli, miglioramento continuo, consultazione/partecipazione lavoratori?", questionType: "conformity", isMandatory: true, displayOrder: 8 },
        { questionId: null, questionText: "5.2 - Politica SSL disponibile come informazione documentata, comunicata internamente e disponibile alle parti interessate?", questionType: "conformity", isMandatory: true, displayOrder: 9 },
        { questionId: null, questionText: "5.3 - Responsabilità e autorità per ruoli SGSSL assegnate, comunicate a tutti i livelli e mantenute come informazioni documentate? I lavoratori assumono responsabilità sugli aspetti che controllano?", questionType: "conformity", isMandatory: true, displayOrder: 10 },
        { questionId: null, questionText: "5.3 - Responsabilità e autorità specifiche assegnate per: conformità sistema alla norma; riferire all'alta direzione sulle prestazioni del SGSSL?", questionType: "conformity", isMandatory: true, displayOrder: 11 },
        { questionId: null, questionText: "5.4 - Processi per consultazione e partecipazione lavoratori a tutti i livelli stabiliti; modalità/tempo/formazione/risorse fornite, accesso a informazioni chiare garantito, ostacoli alla partecipazione eliminati?", questionType: "conformity", isMandatory: true, displayOrder: 12 },
        { questionId: null, questionText: "5.4 - Favorita consultazione lavoratori senza funzioni manageriali su: parti interessate, politica SSL, ruoli, requisiti legali, obiettivi SSL, controlli appaltatori, monitoraggio, programma audit, miglioramento continuo?", questionType: "conformity", isMandatory: true, displayOrder: 13 },
        { questionId: null, questionText: "5.4 - Favorita partecipazione lavoratori in: modalità consultazione/partecipazione, identificazione pericoli/valutazione rischi, azioni eliminazione pericoli, competenze, comunicazione, misure di controllo, investigazione incidenti/NC?", questionType: "conformity", isMandatory: true, displayOrder: 14 }
      ]
    },
    {
      sectionCode: "45001_c6",
      sectionTitle: "6 - Pianificazione",
      displayOrder: 3,
      questions: [
        { questionId: null, questionText: "6.1.1 - Determinati rischi e opportunità da affrontare per: assicurare risultati attesi SGSSL, prevenire effetti indesiderati, conseguire miglioramento continuo?", questionType: "conformity", isMandatory: true, displayOrder: 15 },
        { questionId: null, questionText: "6.1.1 - Rischi/opportunità valutati per cambiamenti pianificati prima dell'attuazione; informazioni documentate conservate su rischi/opportunità e processi/azioni per affrontarli?", questionType: "conformity", isMandatory: true, displayOrder: 16 },
        { questionId: null, questionText: "6.1.2.1 - Processi per identificazione continua e proattiva dei pericoli: fattori sociali, lavoro di routine e non, incidenti, emergenze, persone nel luogo di lavoro stabiliti?", questionType: "conformity", isMandatory: true, displayOrder: 17 },
        { questionId: null, questionText: "6.1.2.1 - Identificazione pericoli considera: progettazione aree/processi/attrezzature, cambiamenti nell'organizzazione, cambiamenti nella conoscenza dei pericoli?", questionType: "conformity", isMandatory: true, displayOrder: 18 },
        { questionId: null, questionText: "6.1.2.2 - Processi per valutare rischi SSL dai pericoli identificati e altri rischi SGSSL; metodologie e criteri per la valutazione definiti, documentati, proattivi e sistematici?", questionType: "conformity", isMandatory: true, displayOrder: 19 },
        { questionId: null, questionText: "6.1.2.3 - Processi per valutare opportunità SSL (miglioramento prestazioni, adattamento lavoro ai lavoratori, eliminazione pericoli) e altre opportunità di miglioramento SGSSL stabiliti?", questionType: "conformity", isMandatory: true, displayOrder: 20 },
        { questionId: null, questionText: "6.1.3 - Requisiti legali aggiornati e altri requisiti applicabili ai pericoli/rischi SSL determinati e accessibili; tenuti in conto nel SGSSL; mantenuti come informazioni documentate aggiornate?", questionType: "conformity", isMandatory: true, displayOrder: 21 },
        { questionId: null, questionText: "6.1.4 - Pianificate azioni per rischi/opportunità, requisiti legali e preparazione emergenze; modalità per integrarle, attuarle e valutarne l'efficacia definite (gerarchia misure considerata)?", questionType: "conformity", isMandatory: true, displayOrder: 22 },
        { questionId: null, questionText: "6.2.1 - Obiettivi SSL stabiliti per funzioni/livelli: coerenti con politica, misurabili, tengono conto di requisiti/valutazioni rischi/consultazione lavoratori; monitorati, comunicati, aggiornati, documentati?", questionType: "conformity", isMandatory: true, displayOrder: 23 },
        { questionId: null, questionText: "6.2.2 - Per ciascun obiettivo SSL determinato: cosa/risorse/responsabile/tempi/valutazione risultati (indicatori monitoraggio) e integrazione nei processi di business; documentato?", questionType: "conformity", isMandatory: true, displayOrder: 24 }
      ]
    },
    {
      sectionCode: "45001_c7",
      sectionTitle: "7 - Supporto",
      displayOrder: 4,
      questions: [
        { questionId: null, questionText: "7.1 - Risorse necessarie per istituzione, attuazione, mantenimento e miglioramento continuo del SGSSL determinate e fornite?", questionType: "conformity", isMandatory: true, displayOrder: 25 },
        { questionId: null, questionText: "7.2 - Competenze lavoratori determinate (inclusa identificazione pericoli); assicurate da istruzione/formazione/esperienza; azioni per acquisirle con valutazione efficacia; evidenze documentate conservate?", questionType: "conformity", isMandatory: true, displayOrder: 26 },
        { questionId: null, questionText: "7.3 - Lavoratori consapevoli di: politica/obiettivi SSL, contributo all'efficacia SGSSL, implicazioni NC, incidenti, pericoli/rischi SSL, capacità di allontanarsi da pericolo grave e immediato?", questionType: "conformity", isMandatory: true, displayOrder: 27 },
        { questionId: null, questionText: "7.4.1 - Processi comunicazione interna/esterna pertinenti al SGSSL (cosa/quando/con chi/come) stabiliti; diversità considerata; informazioni SSL coerenti e affidabili; comunicazioni documentate?", questionType: "conformity", isMandatory: true, displayOrder: 28 },
        { questionId: null, questionText: "7.4.2 - Comunicazione interna assicura diffusione informazioni SSL tra livelli/funzioni (compresi cambiamenti); lavoratori possono contribuire al miglioramento continuo?", questionType: "conformity", isMandatory: true, displayOrder: 29 },
        { questionId: null, questionText: "7.4.3 - Comunicazione esterna pertinente al SGSSL avviene in conformità ai processi comunicativi e ai requisiti legali e altri requisiti?", questionType: "conformity", isMandatory: true, displayOrder: 30 },
        { questionId: null, questionText: "7.5.1 - SGSSL comprende informazioni documentate richieste dalla norma e aggiuntive necessarie per l'efficacia del sistema?", questionType: "conformity", isMandatory: true, displayOrder: 31 },
        { questionId: null, questionText: "7.5.2 - Nella creazione/aggiornamento informazioni documentate assicurati: identificazione e descrizione, formato e supporto, riesame e approvazione?", questionType: "conformity", isMandatory: true, displayOrder: 32 },
        { questionId: null, questionText: "7.5.3 - Informazioni documentate SGSSL tenute sotto controllo (disponibili, protette, distribuzione/accesso/archiviazione/versioni/conservazione assicurati); informazioni esterne identificate e controllate?", questionType: "conformity", isMandatory: true, displayOrder: 33 }
      ]
    },
    {
      sectionCode: "45001_c8",
      sectionTitle: "8 - Attività Operative",
      displayOrder: 5,
      questions: [
        { questionId: null, questionText: "8.1.1 - Processi per soddisfare requisiti SGSSL pianificati, attuati, controllati, mantenuti: criteri definiti, controllo attuato, informazioni documentate conservate, lavoro adattato ai lavoratori?", questionType: "conformity", isMandatory: true, displayOrder: 34 },
        { questionId: null, questionText: "8.1.1 - Nei luoghi di lavoro con più datori di lavoro: parti pertinenti del SGSSL coordinate con le altre organizzazioni?", questionType: "conformity", isMandatory: true, displayOrder: 35 },
        { questionId: null, questionText: "8.1.2 - Processi per eliminazione pericoli e riduzione rischi SSL applicando gerarchia misure: eliminazione, sostituzione, ingegneristiche, amministrative/formazione, DPI stabiliti?", questionType: "conformity", isMandatory: true, displayOrder: 36 },
        { questionId: null, questionText: "8.1.3 - Processi per modifiche temporanee/permanenti pianificate con impatto SSL (nuovi prodotti/servizi, cambiamenti requisiti, conoscenza pericoli, tecnologia); conseguenze cambiamenti involontari riesaminate con azioni?", questionType: "conformity", isMandatory: true, displayOrder: 37 },
        { questionId: null, questionText: "8.1.4.1/8.1.4.2 - Processi per controllo approvvigionamento prodotti/servizi stabiliti; coordinamento con appaltatori per identificare pericoli e valutare/controllare rischi SSL?", questionType: "conformity", isMandatory: true, displayOrder: 38 },
        { questionId: null, questionText: "8.1.4.2/8.1.4.3 - Requisiti SGSSL soddisfatti da appaltatori; criteri SSL applicati nella selezione; funzioni affidate all'esterno tenute sotto controllo coerentemente con requisiti legali?", questionType: "conformity", isMandatory: true, displayOrder: 39 },
        { questionId: null, questionText: "8.2 - Processi per preparazione e risposta emergenze: risposta pianificata (primo soccorso), formazione, prove/esercitazioni periodiche, revisione dopo prove/emergenze, comunicazione a lavoratori/appaltatori/autorità?", questionType: "conformity", isMandatory: true, displayOrder: 40 },
        { questionId: null, questionText: "8.2 - Esigenze e capacità parti interessate considerate nello sviluppo della risposta pianificata; informazioni documentate sui processi e piani di risposta alle emergenze conservate?", questionType: "conformity", isMandatory: true, displayOrder: 41 },
        { questionId: null, questionText: "8.2 - Comunicazioni pertinenti sulle emergenze fornite anche a appaltatori, visitatori, servizi di emergenza, autorità governative e comunità locale?", questionType: "conformity", isMandatory: true, displayOrder: 42 }
      ]
    },
    {
      sectionCode: "45001_c9",
      sectionTitle: "9 - Valutazione delle Prestazioni",
      displayOrder: 6,
      questions: [
        { questionId: null, questionText: "9.1.1 - Determinati: cosa monitorare/misurare (requisiti legali, pericoli/rischi/opportunità, obiettivi SSL, efficacia controlli), metodi, criteri valutazione prestazioni SSL, frequenza, quando analizzare/comunicare risultati?", questionType: "conformity", isMandatory: true, displayOrder: 43 },
        { questionId: null, questionText: "9.1.1 - Apparecchiature monitoraggio/misurazione tarate o verificate e mantenute; evidenze documentate di risultati, manutenzione e taratura/verifica conservate?", questionType: "conformity", isMandatory: true, displayOrder: 44 },
        { questionId: null, questionText: "9.1.2 - Processi per valutare conformità a requisiti legali e altri requisiti: frequenza/metodi determinati, conformità valutata con azioni se necessario, stato conformità mantenuto, evidenze documentate conservate?", questionType: "conformity", isMandatory: true, displayOrder: 45 },
        { questionId: null, questionText: "9.2.1 - Audit interni condotti a intervalli pianificati per accertare conformità ai requisiti propri dell'organizzazione e alla norma, ed efficace attuazione e mantenimento del SGSSL?", questionType: "conformity", isMandatory: true, displayOrder: 46 },
        { questionId: null, questionText: "9.2.2 - Programma audit interno comprende: frequenza/metodi/responsabilità/consultazione/pianificazione/reporting; criteri e campo definiti; auditor obiettivi e imparziali; risultati riportati a manager e lavoratori; NC affrontate; evidenze documentate?", questionType: "conformity", isMandatory: true, displayOrder: 47 },
        { questionId: null, questionText: "9.3 - Alta direzione riesamina SGSSL a intervalli pianificati considerando: azioni precedenti, cambiamenti interni/esterni, politica/obiettivi SSL, prestazioni (incidenti/NC/monitoraggio/audit/consultazione), risorse, comunicazioni, miglioramento?", questionType: "conformity", isMandatory: true, displayOrder: 48 },
        { questionId: null, questionText: "9.3 - Output riesame direzione documentati su: idoneità/adeguatezza/efficacia SGSSL, miglioramento continuo, modifiche sistema, risorse, azioni, integrazione processi business, implicazioni strategiche; risultati comunicati ai lavoratori?", questionType: "conformity", isMandatory: true, displayOrder: 49 }
      ]
    },
    {
      sectionCode: "45001_c10",
      sectionTitle: "10 - Miglioramento",
      displayOrder: 7,
      questions: [
        { questionId: null, questionText: "10.1 - Opportunità di miglioramento (da punto 9) determinate; azioni necessarie per conseguire risultati attesi del SGSSL intraprese?", questionType: "conformity", isMandatory: true, displayOrder: 50 },
        { questionId: null, questionText: "10.2 - Processi per determinare e gestire incidenti e NC: reazione tempestiva, valutazione azioni correttive con coinvolgimento lavoratori, riesame valutazioni rischi, gerarchia misure applicata, efficacia azioni riesaminata, modifiche SGSSL se necessario?", questionType: "conformity", isMandatory: true, displayOrder: 51 },
        { questionId: null, questionText: "10.2 - Azioni correttive proporzionate agli effetti; evidenze documentate conservate (natura NC/incidenti, azioni, risultati/efficacia); informazioni comunicate ai lavoratori e rappresentanti?", questionType: "conformity", isMandatory: true, displayOrder: 52 },
        { questionId: null, questionText: "10.3 - Miglioramento continuo SGSSL mediante: miglioramento prestazioni SSL, promozione cultura SSL, partecipazione lavoratori, comunicazione risultati, conservazione evidenze documentate del miglioramento?", questionType: "conformity", isMandatory: true, displayOrder: 53 }
      ]
    }
  ]
};

/**
 * Registry di tutti i templates disponibili
 */
export const CHECKLIST_TEMPLATES = {
  1: ISO_9001_TEMPLATE,   // ISO 9001:2015
  2: ISO_14001_TEMPLATE,  // ISO 14001:2015
  3: ISO_45001_TEMPLATE,  // ISO 45001:2018
  6: ISO_3834_TEMPLATE,   // ISO 3834-2 Checklist In Campo (Mason)
  7: RDP_MSN_TEMPLATE,    // Rapporto di Prova / Audit Fornitori (clausole norma ISO 3834-2)
};

/**
 * Ottiene template checklist per standard_id
 * @param {number} standardId 
 * @returns {Object|null} Template oppure null
 */
export function getChecklistTemplate(standardId) {
  return CHECKLIST_TEMPLATES[standardId] || null;
}

/**
 * Verifica se template è disponibile
 * @param {number} standardId 
 * @returns {boolean}
 */
export function hasChecklistTemplate(standardId) {
  const template = CHECKLIST_TEMPLATES[standardId];
  return template && template.sections && template.sections.length > 0;
}

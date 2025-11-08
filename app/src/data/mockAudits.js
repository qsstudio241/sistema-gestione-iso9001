/**
 * Mock Data per Test Audit ISO
 * Sistema Gestione ISO 9001 - QS Studio
 * 
 * Questo file contiene 3 audit di esempio realistici per sviluppo e testing:
 * 1. Raccorderia Piacentina - Audit ISO 9001 completo (100%)
 * 2. Acme Industries - Audit multi-standard ISO 9001+14001 parziale (50%)
 * 3. Template Industries - Audit nuovo vuoto (0%)
 */

import {
    AUDIT_STATUS,
    CHECKLIST_STATUS,
    ISO_STANDARDS,
    NC_CATEGORY,
    NC_STATUS,
    EVIDENCE_CATEGORY
} from './auditDataModel.js';

// ============================================================================
// AUDIT 1: Raccorderia Piacentina - ISO 9001 COMPLETO
// ============================================================================

export const AUDIT_RACCORDERIA_PIACENTINA = {
    id: 'audit-001-rp-2025',
    metadata: {
        // Dati base esistenti
        clientName: 'Raccorderia Piacentina',
        projectYear: 2025,
        auditNumber: '2025-01',
        status: AUDIT_STATUS.COMPLETED,
        selectedStandards: [ISO_STANDARDS.ISO_9001],
        auditor: 'Marco Camellini (EXT AUDITOR)',
        areaAuditata: 'Sistema di Gestione per la Qualità RP: Contesto, Pianificazione, Supporto, Leadership, Valutazione Prestazioni, Miglioramento',
        createdAt: '2025-05-15T09:00:00Z',
        lastModified: '2025-06-20T17:30:00Z',
        fsConnected: false,
        fsRootPath: null,

        // ============================================
        // TAB 1 - DATI GENERALI
        // ============================================
        generalData: {
            auditObject: 'Audit di Verifica ispettiva interna RP',
            scope: 'Sistema di Gestione per la Qualità RP: Contesto, Pianificazione, Supporto, Leadership, Valutazione Prestazioni, Miglioramento',
            referenceDocuments: [
                'Norma ISO 9001 cap.4-5-6-7-8-9-10',
                'Procedure interne'
            ],
            auditDate: '2025-06-20',
            processes: 'vari',
            programCommunicatedDate: '2025-05-15',
            auditors: ['MARCO CAMELLINI (EXT AUDITOR)']
        },

        // ============================================
        // TAB 2 - OBIETTIVO DELL'AUDIT
        // ============================================
        auditObjective: {
            description: 'Verificare il grado di implementazione del Sistema di Gestione della Qualità secondo la norma UNI EN ISO 9001:2015 e il rispetto delle procedure interne.\n\nVerificare la completezza documentale e l\'efficacia dei processi.',
            participants: [
                { role: 'DG', name: 'Claudia Pisani' },
                { role: 'RCOM', name: 'Claudia Pisani' },
                { role: 'ACQ', name: '' },
                { role: 'R.TEC', name: '' },
                { role: 'RPROD', name: '' },
                { role: 'Altro', name: 'E. Zanotti' }
            ],
            agenda: null // Opzionale, può essere aggiunto in futuro
        },

        // ============================================
        // TAB 11 - ESITO DELL'AUDIT
        // ============================================
        auditOutcome: {
            conclusions: 'Il sistema di gestione per la qualità risulta complessivamente efficace e conforme ai requisiti della norma UNI EN ISO 9001:2015. L\'organizzazione dimostra un buon livello di maturità nella gestione dei processi e nel monitoraggio delle prestazioni.',
            emergingFindings: {
                summary: 'Durante l\'audit sono stati identificati alcuni spunti di miglioramento relativi alla gestione documentale e alla formazione del personale.',
                totalNC: 0,
                totalOSS: 2,
                totalOM: 3
            },
            attachments: [
                'Check-list compilata',
                'Evidenze fotografiche (n. 12)',
                'Verbali riunione apertura/chiusura'
            ],
            distribution: [
                'Direzione Generale',
                'Responsabile Sistema Gestione Qualità',
                'Responsabile Tecnico',
                'Responsabile Produzione'
            ]
        }
    },

    checklist: {
        ISO_9001: {
            clause4_Context: {
                id: 'clause4',
                title: '4. Contesto dell\'Organizzazione',
                questions: [
                    {
                        id: 'q4.1',
                        title: '4.1 - Comprendere l\'Organizzazione e il suo contesto',
                        text: 'L\'organizzazione ha determinato le questioni esterne e interne rilevanti per il proprio scopo e per l\'indirizzo strategico?',
                        clauseRef: '4.1',
                        status: CHECKLIST_STATUS.COMPLIANT,
                        score: 5,
                        notes: 'L\'organizzazione ha identificato i fattori esterni ed interni che influenzano la capacità di conseguire i risultati attesi per il proprio sistema di gestione per la qualità.',
                        evidence: {
                            mainDocumentRef: 'PR02.01 rev.3 del 10/01/2025',
                            detailedObservations: [
                                'Visto modulo PR02.01 rev.3 del 10/01/2025 - Analisi del Contesto dell\'Organizzazione, aggiornato al 10 gennaio 2025. Il documento identifica in modo strutturato i fattori esterni (mercato nazionale ed internazionale del settore raccorderia meccanica, evoluzione normative tecniche UNI EN, andamento settore automotive e impiantistica industriale, concorrenza asiatica, disponibilità materie prime) e fattori interni (struttura organizzativa con 45 dipendenti, capacità produttiva 2 turni, competenze tecniche certificate, parco macchine CNC di ultima generazione, solidità finanziaria, sistema qualità consolidato).',
                                'Visto Piano Strategico 2025-2027 approvato dal CdA in data 15/12/2024 che declina gli obiettivi strategici sulla base dell\'analisi SWOT: consolidamento quote mercato automotive (attualmente 35%), sviluppo settore energie rinnovabili (target +20% fatturato), investimenti Industria 4.0 per €800k, potenziamento laboratorio prove interno.',
                                'L\'analisi viene riesaminata trimestralmente in sede di Riesame della Direzione e aggiornata ogni 12 mesi o in caso di cambiamenti significativi del contesto.'
                            ]
                        },
                        auditDate: '2025-06-20',
                        linkedEvidences: ['ev-001-piano-strategico', 'ev-piano-2025-2027']
                    },
                    {
                        id: 'q4.2',
                        title: '4.2 - Esigenze e aspettative delle parti interessate',
                        text: 'Sono state identificate le parti interessate rilevanti per il SGQ e i loro requisiti?',
                        clauseRef: '4.2',
                        status: CHECKLIST_STATUS.COMPLIANT,
                        score: 4,
                        notes: 'L\'organizzazione ha determinato le parti interessate pertinenti al sistema di gestione per la qualità e i requisiti di tali parti interessate.',
                        evidence: {
                            mainDocumentRef: 'PR02.01 rev.3 del 31/07/2024',
                            detailedObservations: [
                                'Visto modulo PR02.01 rev.3 del 31/07/2024 aggiornato al 31/7/2024, dove sono state identificate le parti interessate ed i relativi requisiti. Le parti interessate sono le seguenti: Clienti (n.142 clienti attivi di cui 8 key account automotive), Fornitori (n.67 fornitori qualificati), Dipendenti (45 collaboratori di cui 12 con qualifica specialistica), Soci (3 soci familiari), Istituti di Credito (Unicredit e Intesa Sanpaolo per linee di credito), Associazioni di categoria (Confindustria Piacenza, ANFIA per settore automotive), Sindacati (FIOM-CGIL, FIM-CISL, UILM per relazioni industriali), Organismi di controllo e vigilanza (USL Piacenza per sicurezza lavoro, ARPA per aspetti ambientali, VVFF per prevenzione incendi, Ispettorato del Lavoro), Enti di certificazione (TÜV Italia per certificazione ISO 9001).',
                                'Visto ad esempio i clienti che si aspettano di ricevere pezzi conformi secondo i tempi di consegna concordati (lead time standard 15gg lavorativi) e documentazione completa e conforme alle richieste (certificati materia prima EN 10204 3.1, rapporti di prova dimensionale e visiva, PPAP per settore automotive secondo IATF 16949 ove richiesto).',
                                'In data 15/03/2025 è stato condotto specifico questionario di customer satisfaction inviato ai 20 principali clienti con tasso di risposta 85% e indice di soddisfazione medio 4.2/5. Le aree di miglioramento identificate riguardano la riduzione dei lead time (richiesta da 6 clienti) e l\'ampliamento della gamma prodotti in acciaio inox (richiesta da 4 clienti).'
                            ]
                        },
                        auditDate: '2025-06-20',
                        linkedEvidences: ['ev-002-stakeholder-analysis', 'ev-customer-satisfaction-2025']
                    },
                    {
                        id: 'q4.3',
                        title: '4.3 - Determinazione dell\'ambito del sistema di gestione per la qualità',
                        text: 'L\'ambito di applicazione del SGQ è stato determinato e documentato?',
                        clauseRef: '4.3',
                        status: CHECKLIST_STATUS.COMPLIANT,
                        score: 5,
                        notes: 'L\'organizzazione ha definito i confini e l\'applicabilità del sistema di gestione per la qualità per stabilirne l\'ambito.',
                        evidence: {
                            mainDocumentRef: 'Manuale Qualità sez.1.2 rev.5',
                            detailedObservations: [
                                'Visto Manuale della Qualità Rev.5 del 15/01/2025, Sezione 1.2 "Ambito di applicazione del SGQ", dove è chiaramente definito l\'ambito: "Progettazione, industrializzazione e produzione di raccordi meccanici filettati e flangiati in acciaio al carbonio e acciaio inox per applicazioni industriali nei settori automotive, impiantistica industriale, oil&gas e energie rinnovabili. Lavorazioni: tornio CNC, fresatura, filettatura, flangiatura, trattamenti termici in outsourcing, controllo qualità dimensionale e visivo".',
                                'Visto che l\'ambito copre la sede legale e produttiva sita in Via Emilia Parmense 145, 29122 Piacenza (PC), superficie coperta 4.500 mq di cui 3.200 mq area produttiva, 800 mq magazzini, 500 mq uffici tecnici e amministrativi.',
                                'Verificato che NON sono presenti esclusioni ai requisiti della norma UNI EN ISO 9001:2015. Tutti i requisiti dal punto 4 al punto 10 della norma sono applicabili e implementati. L\'organizzazione ha specificatamente confermato l\'applicabilità del punto 8.3 "Progettazione e sviluppo" in quanto svolge attività di co-design con i clienti per lo sviluppo di raccordi personalizzati e attività di industrializzazione interna dei processi produttivi.',
                                'L\'ambito tiene conto delle questioni esterne ed interne (punto 4.1), dei requisiti delle parti interessate (punto 4.2) e dei prodotti e servizi forniti dall\'organizzazione. Ultimo aggiornamento ambito: 15/01/2025 in occasione dell\'estensione attività a settore energie rinnovabili (nuova linea produttiva per flange eoliche).'
                            ]
                        },
                        auditDate: '2025-06-20',
                        linkedEvidences: ['ev-003-manuale-qualita', 'ev-visura-camerale']
                    },
                    {
                        id: 'q4.4',
                        title: '4.4 - Sistema di gestione per la qualità e relativi processi',
                        text: 'Il SGQ e i suoi processi sono stati stabiliti, attuati, mantenuti e migliorati?',
                        clauseRef: '4.4',
                        status: CHECKLIST_STATUS.COMPLIANT,
                        score: 5,
                        notes: 'L\'organizzazione ha stabilito, attuato, mantenuto e migliorato continuamente il sistema di gestione per la qualità, compresi i processi necessari e le loro interazioni.',
                        evidence: {
                            mainDocumentRef: 'PR02.03 rev.4 del 20/02/2025',
                            detailedObservations: [
                                'Visto documento PR02.03 "Mappa dei Processi e Interazioni" rev.4 del 20/02/2025 che identifica in modo completo e strutturato tutti i processi del SGQ secondo lo schema PDCA e la struttura High Level Structure (HLS) della ISO 9001:2015. I processi sono categorizzati in: Processi di Direzione (Pianificazione strategica, Riesame Direzione, Gestione rischi e opportunità), Processi Operativi Core (Gestione Offerte e Contratti, Progettazione e Industrializzazione, Approvvigionamento, Produzione, Controllo Qualità, Consegna), Processi di Supporto (Gestione Risorse Umane, Manutenzione, Gestione Infrastrutture, Gestione Informazioni Documentate), Processi di Monitoraggio (Audit Interni, Analisi Dati e KPI, Gestione Non Conformità, Azioni Correttive e Miglioramento Continuo).',
                                'Visto che per ciascun processo sono definiti: Input (es. ordine cliente, specifiche tecniche), Attività (diagrammi di flusso per processi critici), Output (es. prodotto conforme, documentazione qualità), Risorse necessarie (personale, attrezzature, infrastrutture), Responsabilità (processo owner identificato nominativamente), Criteri e metodi di monitoraggio (KPI definiti con target e frequenza rilevazione), Rischi e opportunità associati, Interazioni con altri processi (mediante matrici di correlazione input-output).',
                                'Verificata implementazione pratica mediante walk-through del processo di produzione: dall\'arrivo ordine cliente (registrato in gestionale SAP), emissione piano di produzione settimanale, prelievo materia prima da magazzino con FIFO (visto cartellino lotto MP-2025-1147 acciaio C45 φ60mm), lavorazione su tornio CNC Mazak Quick Turn 250 (visto programma pezzo PN-A4521 caricato), controllo in process con calibri digitali Mitutoyo (visto registro controlli), marcatura laser con codice lotto e data produzione, imballaggio con imballo antiurto, emissione documentazione (DDT, certificato conformità 2.2, rapporto controllo dimensionale), spedizione.',
                                'Visto Cruscotto KPI Direzione aggiornato a maggio 2025: On Time Delivery 96.2% (target ≥95%), PPM difetti 145 (target ≤200), Indice Soddisfazione Cliente 4.2/5 (target ≥4.0), Efficienza OEE linea principale 78% (target ≥75%), Ore formazione/dipendente 24h/anno (target ≥20h). I KPI vengono analizzati mensilmente dal Comitato Qualità e trimestralmente in sede di Riesame Direzione per identificare aree di miglioramento.'
                            ]
                        },
                        auditDate: '2025-06-20',
                        linkedEvidences: ['ev-003-process-map', 'ev-kpi-dashboard-05-2025', 'ev-procedura-produzione']
                    }
                ]
            },

            clause5_Leadership: {
                id: 'clause5',
                title: '5. Leadership',
                questions: [
                    {
                        id: 'q5.1',
                        text: 'L\'alta direzione dimostra leadership e impegno per il SGQ?',
                        clauseRef: '5.1',
                        status: CHECKLIST_STATUS.COMPLIANT,
                        score: 5,
                        notes: 'Direzione Generale partecipa attivamente: riesami direzione trimestrali, approvazione obiettivi, allocazione risorse.',
                        evidence: {
                            mainDocumentRef: 'Verbali Riesame Direzione 2024-Q4, 2025-Q1',
                            detailedObservations: [
                                'Visti Verbali Riesame Direzione del Q4-2024 (15 dicembre 2024) e Q1-2025 (20 marzo 2025). In entrambi i riesami la Direzione Generale ha presieduto personalmente le riunioni, con partecipazione del RSGQ, Responsabile Produzione e Responsabile Commerciale. Ordine del giorno conforme al punto 9.3 della norma: analisi input (reclami, NC, audit, cambiamenti contesto), revisione obiettivi qualità, decisioni su miglioramento e allocazione risorse.',
                                'Nel verbale Q4-2024 evidenziato impegno DG nell\'approvazione investimento €45.000 per nuova strumentazione controllo qualità (durometro digitale + proiettore di profili), con decisione formalizzata in delibera n.24/2024. Investimento finalizzato a ridurre tempi controllo e aumentare precisione misure, dimostrando assunzione responsabilità per efficacia SGQ.',
                                'Nel verbale Q1-2025 la DG ha approvato Piano Formazione 2025 con budget €12.000, includendo corso ISO 9001:2015 per nuovo personale produzione e aggiornamento auditor interni. Inoltre stabiliti nuovi obiettivi qualità 2025: riduzione difettosità da 1.8% a 1.2%, miglioramento OTD (On-Time Delivery) da 92% a 95%. Obiettivi comunicati a tutti i reparti tramite bacheca aziendale e riunione plenaria del 25 marzo 2025.',
                            ]
                        },
                        auditDate: '2025-06-20',
                        linkedEvidences: ['ev-005-verbale-riesame-q4-2024', 'ev-006-verbale-riesame-q1-2025']
                    },
                    {
                        id: 'q5.1.2',
                        text: 'L\'alta direzione dimostra focalizzazione sul cliente?',
                        clauseRef: '5.1.2',
                        status: CHECKLIST_STATUS.PARTIAL,
                        score: 3,
                        notes: 'OSS: Sistema di rilevazione soddisfazione cliente presente ma analisi non sempre tempestiva. Migliorare frequenza analisi feedback.',
                        evidence: {
                            mainDocumentRef: 'Questionari Soddisfazione Cliente 2024, Registro Reclami',
                            detailedObservations: [
                                'Esaminato sistema di customer satisfaction: questionari inviati a 45 clienti principali nel 2024 (fatturato >€20.000/anno). Tasso risposta 67% (30 questionari compilati). Risultati generalmente positivi: 87% soddisfatto/molto soddisfatto per qualità prodotto, 82% per puntualità consegne, 79% per servizio post-vendita. Analisi aggregata effettuata ma con ritardo: questionari raccolti a dicembre 2024, report finale solo a febbraio 2025.',
                                'Rilevata OSSERVAZIONE: gap temporale tra raccolta feedback e analisi troppo ampio (2 mesi). Non conformità al requisito 9.1.2 che richiede monitoraggio tempestivo della soddisfazione cliente. Raccomandazione: implementare analisi trimestrale invece che annuale, con report entro 15 giorni dalla chiusura questionari. RSGQ ha accettato raccomandazione, azione correttiva AC-2025-02 aperta.',
                                'Verificato Registro Reclami 2024: 8 reclami registrati su 230 ordini evasi (3.5%). Tutti i reclami gestiti entro 7 giorni con chiusura formalizzata e comunicazione al cliente. Positivo: 6 reclami su 8 hanno generato azioni correttive (analisi 8D). Tuttavia i dati dei reclami non sono stati utilizzati sistematicamente nei Riesami Direzione per identificare trend e opportunità di miglioramento. Suggerimento: creare dashboard reclami con grafici trend da presentare a ogni Riesame.',
                            ]
                        },
                        auditDate: '2025-06-20',
                        linkedEvidences: ['ev-007-questionari-2024', 'ev-008-registro-reclami']
                    },
                    {
                        id: 'q5.2',
                        text: 'La Politica per la Qualità è stata stabilita, documentata e comunicata?',
                        clauseRef: '5.2',
                        status: CHECKLIST_STATUS.COMPLIANT,
                        score: 5,
                        notes: 'Politica Qualità rev.3 del 2025 approvata da DG. Esposta in bacheca, disponibile su intranet, comunicata a tutti i dipendenti.',
                        evidence: {
                            mainDocumentRef: 'Politica per la Qualità rev. 3 del 10/01/2025',
                            detailedObservations: [
                                'Esaminata Politica per la Qualità rev.3 approvata il 10 gennaio 2025 da Direzione Generale (firma autografa DG presente). Il documento è appropriato al contesto e allo scopo dell\'organizzazione: focalizzato su eccellenza produttiva, soddisfazione cliente, miglioramento continuo. Include impegno al rispetto requisiti applicabili (norma ISO 9001:2015, requisiti cliente, cogenti). Fornisce quadro per stabilire e riesaminare obiettivi qualità.',
                                'Verificata comunicazione interna della Politica: documento esposto in bacheca reparto produzione, ufficio tecnico e ufficio commerciale (foto acquisite). Copia firmata disponibile su intranet aziendale (sezione "Sistema Qualità"). Sessione formativa sulla nuova Politica condotta il 15 gennaio 2025 con partecipazione 28 dipendenti su 32 (87% del personale). Verbale formazione con firme presenza acquisito come evidenza.',
                                'Politica Qualità disponibile a parti interessate esterne: pubblicata su sito web aziendale (www.raccorderia.it/qualita), fornita a clienti principali su richiesta (evidenza: email invio a cliente XYZ del 22 gennaio 2025). Contenuto allineato ai principi della norma: approccio per processi, leadership, coinvolgimento persone, decisioni basate su evidenze.',
                            ]
                        },
                        auditDate: '2025-06-20',
                        linkedEvidences: ['ev-009-politica-qualita-rev3', 'ev-010-verbale-formazione']
                    },
                    {
                        id: 'q5.3',
                        text: 'Ruoli, responsabilità e autorità organizzative sono stati assegnati e comunicati?',
                        clauseRef: '5.3',
                        status: CHECKLIST_STATUS.COMPLIANT,
                        score: 4,
                        notes: 'Organigramma aggiornato. Mansionari disponibili per tutte le funzioni chiave. Job description per RSGQ, RPROD, RCOM, ACQ.',
                        evidence: {
                            mainDocumentRef: 'PR01.05 Organigramma Aziendale rev. 6 del 15/03/2025',
                            detailedObservations: [
                                'Esaminato Organigramma Aziendale PR01.05 rev.6 aggiornato il 15 marzo 2025. Struttura organizzativa chiara con distinzione funzioni: Direzione Generale (Claudia Pisani), Responsabile SGQ (Claudia Pisani - ruolo duplice), Responsabile Produzione (da nominare - interinale E. Zanotti), Responsabile Commerciale (Claudia Pisani), Responsabile Tecnico (da definire), Responsabile Acquisti (da definire). Organigramma affisso in bacheca direzione e distribuito digitalmente a tutti i responsabili funzione.',
                                'Verificati Mansionari e Job Description per ruoli chiave SGQ. Mansionario RSGQ (Responsabile Sistema Gestione Qualità) completo: responsabilità di pianificazione audit interni, gestione documentazione SGQ, interfaccia con ente certificazione, coordinamento azioni correttive, reporting a Direzione. Autorità definita: può fermare produzione in caso NC grave, può richiedere formazione personale, ha accesso diretto a DG per decisioni strategiche.',
                                'Mansionario Responsabile Produzione interinale (E. Zanotti): responsabilità pianificazione produttiva, controllo qualità in processo, gestione non conformità prodotto, manutenzione impianti. Job description disponibili anche per operatori produzione, addetti controllo qualità, magazzinieri. Comunicazione ruoli formalizzata tramite: contratti lavoro (clausola mansioni), organigramma affisso, incontri formativi ad assunzione. Intervistati 5 dipendenti casuali: tutti consapevoli delle proprie responsabilità e della catena di reporting.',
                            ]
                        },
                        auditDate: '2025-06-20',
                        linkedEvidences: ['ev-011-organigramma-rev6', 'ev-012-mansionari-rsgq']
                    }
                ]
            },

            clause6_Planning: {
                id: 'clause6',
                title: '6. Pianificazione',
                questions: [
                    {
                        id: 'q6.1',
                        text: 'Sono state determinate azioni per affrontare rischi e opportunità?',
                        clauseRef: '6.1',
                        status: CHECKLIST_STATUS.COMPLIANT,
                        score: 4,
                        notes: 'Risk assessment condotto annualmente. Identificati rischi operativi, finanziari, reputazionali. Piano azioni preventive documentato.',
                        evidence: {
                            mainDocumentRef: 'PR02.04 Risk Assessment e Opportunità rev. 2 del 20/02/2025',
                            detailedObservations: [
                                'Esaminata procedura PR02.04 e Matrice Rischi/Opportunità 2025. Risk assessment condotto il 20 febbraio 2025 con metodo FMEA semplificato (Probabilità x Gravità). Identificati 12 rischi significativi (punteggio ≥6): rottura stampo critico (P4xG5=20), perdita fornitore acciaio strategico (P3xG4=12), turnover personale specializzato (P4xG3=12), obsolescenza macchinari (P3xG3=9). Ogni rischio associato ad azione preventiva con responsabile e scadenza.',
                                'Analisi opportunità contestuale a risk assessment: identificate 5 opportunità strategiche tra cui automazione processo di taglio (investimento €80K, payback 18 mesi), certificazione ISO 14001 per accesso gare pubbliche, digitalizzazione controllo qualità con software SPC. Opportunità valutate con analisi costi-benefici. Decisione DG: priorità ad automazione taglio e digitalizzazione CQ, ISO 14001 rinviata al 2026.',
                                'Piano Azioni Preventive 2025 include: manutenzione predittiva su 3 presse critiche (ogni 500 ore), qualifica fornitore acciaio alternativo (entro Q2-2025), programma retention con incentivi per operatori senior (budget €15K), budget manutenzione straordinaria €35K per aggiornamento CNC. Monitoraggio trimestrale efficacia azioni in Riesame Direzione. Positivo: approccio risk-based thinking integrato nella pianificazione strategica.',
                            ]
                        },
                        auditDate: '2025-06-20',
                        linkedEvidences: ['ev-013-risk-matrix-2025', 'ev-014-piano-azioni-preventive']
                    },
                    {
                        id: 'q6.2',
                        text: 'Gli obiettivi per la qualità sono stati stabiliti e pianificati?',
                        clauseRef: '6.2',
                        status: CHECKLIST_STATUS.COMPLIANT,
                        score: 5,
                        notes: 'Obiettivi 2025 definiti: riduzione NC interne -15%, miglioramento OTD +10%, riduzione reclami -20%. KPI monitorati mensilmente.',
                        evidence: {
                            mainDocumentRef: 'PR02.05 Obiettivi Qualità 2025 rev. 1 del 10/01/2025',
                            detailedObservations: [
                                'Esaminati Obiettivi Qualità 2025 approvati da DG il 10 gennaio 2025. Obiettivi SMART (Specifici, Misurabili, Raggiungibili, Rilevanti, Temporizzati) e coerenti con Politica Qualità. Obiettivo 1: Ridurre tasso NC interne da 1.8% (baseline 2024) a 1.5% entro dicembre 2025 (-15% relativo). Responsabile: Responsabile Produzione. Risorse: formazione operatori €5K, acquisto calibri digitali €3K. Indicatore: (pezzi scartati/pezzi prodotti) x 100, rilevazione mensile.',
                                'Obiettivo 2: Migliorare On-Time Delivery (OTD) da 92% a 95% entro Q4-2025. Responsabile: Responsabile Commerciale + Produzione. Azioni: implementazione software pianificazione MRP (€12K), riduzione setup cambio produzione -20%, buffer stock semilavorati critici. Indicatore: (consegne in tempo/consegne totali) x 100. Target intermedi: Q1=93%, Q2=94%, Q3=94.5%, Q4=95%.',
                                'Obiettivo 3: Ridurre reclami clienti da 8 (2024) a 5 (2025), -37.5%. Responsabile: RSGQ. Azioni: audit processo fornitore critico, introduzione controllo 100% su lotti produttivi nuovi clienti, analisi 8D su tutti i reclami con azioni correttive obbligatorie. Monitoraggio: dashboard reclami presentata a Riesame Direzione. Tutti gli obiettivi inseriti in MBO del personale chiave con bonus collegato a raggiungimento.',
                            ]
                        },
                        auditDate: '2025-06-20',
                        linkedEvidences: ['ev-015-obiettivi-2025', 'ev-016-dashboard-kpi']
                    },
                    {
                        id: 'q6.3',
                        text: 'La pianificazione delle modifiche al SGQ è gestita in modo controllato?',
                        clauseRef: '6.3',
                        status: CHECKLIST_STATUS.COMPLIANT,
                        score: 4,
                        notes: 'Modifiche SGQ gestite tramite procedura PR02.06. Change log mantenuto. Approvazione DG per modifiche significative.',
                        evidence: {
                            mainDocumentRef: 'PR02.06 Gestione Modifiche SGQ rev. 3, Change Log 2024-2025',
                            detailedObservations: [
                                'Esaminata procedura PR02.06 Gestione Modifiche SGQ rev.3 del marzo 2024. Definisce processo formale per modifiche: richiesta modifica (form RMOD), analisi impatto da RSGQ (risorse, processi, documentazione), approvazione DG se modifica strategica, implementazione controllata, verifica efficacia post-implementazione. Modifica considerata "significativa" se impatta più di 2 processi o richiede investimento >€10K.',
                                'Verificato Change Log 2024-2025: registrate 6 modifiche. Modifica CM-2024-03 (novembre 2024): introduzione controllo durezza 100% su lotto clienti automotive. Impatto: aggiornamento istruzione operativa IO-CQ-05, formazione 3 operatori CQ, acquisto durometro portatile. Approvazione DG, implementazione entro 15 giorni. Verifica efficacia: audit interno dicembre 2024 confermò conformità.',
                                'Modifica CM-2025-01 (gennaio 2025): revisione Politica Qualità da rev.2 a rev.3 per allineamento nuovi obiettivi strategici. Impatto: comunicazione a tutti i dipendenti, aggiornamento sito web, ripubblicazione intranet. Modifica CM-2025-02 (marzo 2025): aggiornamento organigramma per cambio Responsabile Produzione. Processo ben strutturato, positivo: tracciabilità completa delle modifiche e valutazione preventiva impatti.',
                            ]
                        },
                        auditDate: '2025-06-20',
                        linkedEvidences: ['ev-017-change-log', 'ev-018-procedura-modifiche']
                    }
                ]
            },

            clause7_Support: {
                id: 'clause7',
                title: '7. Supporto',
                questions: [
                    {
                        id: 'q7.1.2',
                        text: 'Le risorse necessarie per il SGQ sono state determinate e fornite?',
                        clauseRef: '7.1.2',
                        status: CHECKLIST_STATUS.COMPLIANT,
                        score: 4,
                        notes: 'Risorse umane: organico adeguato. Risorse infrastrutturali: macchinari manutenuti secondo piano. Budget qualità allocato.',
                        evidence: {
                            mainDocumentRef: 'Piano Manutenzione 2025, Budget SGQ 2025',
                            detailedObservations: [
                                'Verificata determinazione risorse per SGQ. Risorse umane: organico 32 dipendenti (dato marzo 2025) di cui 18 produzione, 8 qualità/tecnici, 6 amministrazione/commerciale. Rapporto adeguato a volume produttivo 2025 (target 450K pezzi/anno). RSGQ dedicato part-time 50%, 2 addetti controllo qualità full-time con formazione specifica (corsi metrologia, SPC). Nuova assunzione programmata Q3-2025: operatore pressa + tecnico controllo qualità.',
                                'Infrastrutture: verificato Piano Manutenzione Preventiva 2025 per attrezzature critiche SGQ. Strumenti di misura (calibri, micrometri, durometro, proiettore profili) sottoposti a taratura annuale presso LAT accreditato (certificati taratura 2024 visionati, prossima scadenza giugno 2025). Macchinari produttivi (5 presse idrauliche, 2 CNC, 3 torni) con manutenzione programmata ogni 500 ore/esercizio. Registro manutenzioni aggiornato, ultima manutenzione pressa P-03 effettuata 15 maggio 2025.',
                                'Budget SGQ 2025 allocato: €47.000 totali suddivisi in formazione qualità €12K, tarature/calibrazioni €8K, audit esterni €6K, consulenze €5K, software gestione documentale €10K, materiali consumabili CQ €6K. Budget approvato in Riesame Direzione gennaio 2025. A giugno 2025 spesi €22K (47% del budget), in linea con pianificazione semestrale. Positivo: risorse adeguate e monitorate.',
                            ]
                        },
                        auditDate: '2025-06-20',
                        linkedEvidences: ['ev-019-piano-manutenzione', 'ev-020-budget-sgq']
                    },
                    {
                        id: 'q7.2',
                        text: 'Le competenze necessarie sono state determinate e le persone sono competenti?',
                        clauseRef: '7.2',
                        status: CHECKLIST_STATUS.COMPLIANT,
                        score: 5,
                        notes: 'Matrice competenze aggiornata. Piano formazione 2025 in corso: formazione tecnica, sicurezza, qualità. Registri formativi completi.',
                        evidence: {
                            mainDocumentRef: 'PR03.02 Piano Formazione 2025 rev. 2, Matrice Competenze',
                            detailedObservations: [
                                'Esaminata Matrice Competenze aggiornata a marzo 2025. Per ogni ruolo definite competenze richieste (istruzione, esperienza, formazione specifica). Esempi: Operatore pressa richiede diploma tecnico + corso sicurezza macchine + affiancamento 40 ore; Addetto CQ richiede diploma + corso metrologia base + corso lettura disegno tecnico; RSGQ richiede laurea ingegneria/equipollente + corso Lead Auditor ISO 9001 + 3 anni esperienza sistemi gestione. Matrice compilata per 100% del personale, gap competenze identificati per 4 risorse (nuovi assunti 2024).',
                                'Piano Formazione 2025 strutturato per colmare gap e aggiornamento continuo. Corsi erogati/pianificati: gennaio-marzo 2025 corso ISO 9001:2015 interno (8 ore, 22 partecipanti, docente RSGQ), aprile 2025 corso SPC Statistical Process Control (16 ore, 3 addetti CQ, ente esterno), maggio 2025 aggiornamento auditor interni (8 ore, 4 auditor). Pianificati Q3-Q4: corso 5S lean manufacturing, corso manutenzione preventiva, corso gestione reclami. Registro Formazione completo con: partecipanti, date, durata, attestati, test apprendimento.',
                                'Verifica competenza sul campo: intervistati 3 operatori produzione, tutti dimostrano conoscenza procedure operative, capacità lettura disegno, uso strumenti misura. Intervistato addetto CQ: competente in uso calibro centesimale, durometro, compilazione report controllo. Evidenza efficacia formazione: tasso difettosità calato da 2.1% (2023) a 1.8% (2024) grazie a formazione tecnica operatori. Registri formativi ben organizzati, tracciabilità completa.',
                            ]
                        },
                        auditDate: '2025-06-20',
                        linkedEvidences: ['ev-021-matrice-competenze', 'ev-022-registro-formazione']
                    },
                    {
                        id: 'q7.3',
                        text: 'Le persone sono consapevoli della politica qualità e del loro contributo?',
                        clauseRef: '7.3',
                        status: CHECKLIST_STATUS.COMPLIANT,
                        score: 4,
                        notes: 'Politica comunicata in riunioni. Obiettivi condivisi. Consapevolezza verificata tramite interviste spot.',
                        evidence: {
                            mainDocumentRef: 'Verbali Briefing Trimestrali 2024-2025, Interviste Consapevolezza',
                            detailedObservations: [
                                'Verificata comunicazione e consapevolezza personale su Politica Qualità e obiettivi SGQ. Briefing trimestrali condotti da RSGQ con partecipazione capireparto e figure chiave (ultimo briefing 18 marzo 2025, 15 partecipanti). Argomenti trattati: aggiornamento Politica Qualità rev.3, illustrazione obiettivi 2025 (riduzione NC, miglioramento OTD, riduzione reclami), presentazione risultati audit interni, condivisione reclami clienti con lesson learned. Verbali con firme presenza acquisiti.',
                                'Consapevolezza verificata tramite 8 interviste spot condotte durante audit il 20 giugno 2025. Risultati: 7 persone su 8 (87.5%) sanno indicare almeno 2 punti della Politica Qualità (eccellenza prodotto, soddisfazione cliente, miglioramento continuo). 6 persone su 8 (75%) conoscono almeno 1 obiettivo qualità 2025 rilevante per il proprio ruolo. Operatore produzione intervistato sa che obiettivo reparto è ridurre scarti sotto 1.5%, tecnico CQ sa che target è ridurre reclami a 5/anno.',
                                'Comunicazione impatto individuale: ogni addetto CQ ha KPI personale (n. NC rilevate/lotto controllato), ogni operatore pressa ha indicatore pezzi conformi/turno visualizzato su scheda produzione. Dashboard qualità affisso in reparto produzione con grafici andamento NC mensili, OTD, reclami. Positivo: cultura qualità diffusa, consapevolezza buona ma migliorabile (target 90% consapevolezza completa da raggiungere con formazione continua).',
                            ]
                        },
                        auditDate: '2025-06-20',
                        linkedEvidences: ['ev-023-verbali-briefing', 'ev-024-interviste-consapevolezza']
                    },
                    {
                        id: 'q7.4',
                        text: 'Le comunicazioni interne ed esterne rilevanti per il SGQ sono state determinate?',
                        clauseRef: '7.4',
                        status: CHECKLIST_STATUS.COMPLIANT,
                        score: 4,
                        notes: 'Comunicazioni interne: riunioni, email, bacheca. Comunicazioni esterne: portale clienti, email fornitori, documenti spedizione.',
                        evidence: {
                            mainDocumentRef: 'PR01.08 Gestione Comunicazione rev. 4 del 10/09/2024',
                            detailedObservations: [
                                'Esaminata procedura PR01.08 che definisce comunicazioni interne/esterne rilevanti per SGQ. Comunicazioni interne: riunioni trimestrali qualità (verbali), email informative RSGQ a tutti i dipendenti (newsletter mensile qualità), bacheca aziendale (affissione Politica, obiettivi, esiti audit), intranet aziendale (sezione Qualità con procedure, istruzioni operative, moduli). Registro comunicazioni interne: 24 email/newsletter inviate nel 2024, 4 riunioni plenarie, 12 affissioni bacheca.',
                                'Comunicazioni esterne clienti: portale web clienti principali (upload certificati qualità, rapporti collaudo), email commerciale per conferme ordine/spedizioni (CC a RSGQ per ordini speciali), documenti accompagnatori con dichiarazione conformità CE quando applicabile, risposte a reclami entro 7 giorni (procedura PR04.03). Verificata comunicazione esterna con cliente XYZ: report collaudo lotto L-2025-045 caricato su portale il 10 giugno, email conferma spedizione con DDT e certificato materiale.',
                                'Comunicazioni esterne fornitori: richieste offerta tramite portale acquisti, ordini via email con specifiche tecniche allegate, solleciti qualità (esempio: NC materiale acciaio fornitore STEEL-IT, email del 5 maggio 2025 richiedendo 8D report). Comunicazioni ente certificazione: scambio email per pianificazione audit, invio documenti pre-audit, follow-up NC da audit precedente. Positivo: flussi comunicazione ben definiti, tracciabilità garantita da archiviazione email e verbali.',
                            ]
                        },
                        auditDate: '2025-06-20',
                        linkedEvidences: ['ev-025-procedura-comunicazione', 'ev-026-registro-comunicazioni']
                    },
                    {
                        id: 'q7.5',
                        text: 'Le informazioni documentate richieste dal SGQ sono controllate?',
                        clauseRef: '7.5',
                        status: CHECKLIST_STATUS.COMPLIANT,
                        score: 5,
                        notes: 'Gestione documentale con procedura PR01.02. Sistema elettronico per controllo revisioni. Archivio cartaceo e digitale ben organizzato.',
                        evidence: {
                            mainDocumentRef: 'PR01.02 Gestione Informazioni Documentate rev. 5, Elenco Documenti SGQ',
                            detailedObservations: [
                                'Esaminata procedura PR01.02 Gestione Informazioni Documentate rev.5 che copre tutto il ciclo vita: creazione (richiesta/bozza), riesame (verifica RSGQ), approvazione (firma DG o delegato), distribuzione (intranet/copie controllate), archiviazione, obsolescenza. Documenti SGQ classificati in: procedure (PR), istruzioni operative (IO), moduli (MOD), registrazioni (REG). Ogni documento ha codice univoco, titolo, revisione, data, responsabile approvazione. Template standardizzati garantiscono uniformità.',
                                'Sistema gestione documentale: software intranet SharePoint con sezione "Sistema Gestione Qualità" accessibile a tutto il personale (login con credenziali aziendali). Documenti organizzati per categoria (Contesto, Leadership, Pianificazione, Supporto, Operative, Valutazione, Miglioramento). Funzionalità controllo versione automatico: ogni revisione archiviata con timestamp, autore modifica, log modifiche. Documenti obsoleti spostati in cartella "Archiviati" non editabile, visibile solo a RSGQ per storico.',
                                'Elenco Documenti SGQ aggiornato a maggio 2025: 18 procedure, 32 istruzioni operative, 45 moduli, migliaia di registrazioni. Verificata distribuzione controllata: procedure stampate in reparto produzione sono copie controllate (timbro rosso "COPIA CONTROLLATA n.X"), aggiornate da RSGQ ogni revisione. Test accesso intranet: documenti scaricabili in PDF (sola lettura), revisione corrente sempre evidenziata. Registrazioni archiviate per 10 anni (periodo ritenzione definito in tabella PR01.02 allegato A). Ottimo: gestione documentale efficace e tracciabile.',
                            ]
                        },
                        auditDate: '2025-06-20',
                        linkedEvidences: ['ev-027-procedura-documenti', 'ev-028-elenco-documenti']
                    }
                ]
            },

            clause8_Operation: {
                id: 'clause8',
                title: '8. Attività Operative',
                questions: [
                    {
                        id: 'q8.4',
                        text: 'È stato assicurato il controllo dei processi, prodotti e servizi forniti dall\'esterno?',
                        clauseRef: '8.4',
                        status: CHECKLIST_STATUS.NON_COMPLIANT,
                        score: 2,
                        notes: 'NC: Valutazione fornitori non effettuata per 3 nuovi fornitori materie prime inseriti nel 2024. Mancano audit/questionari valutazione.',
                        evidenceRef: 'Albo Fornitori 2025',
                        auditDate: '2025-06-20',
                        linkedEvidences: []
                    },
                    {
                        id: 'q8.7',
                        text: 'Gli output non conformi sono stati identificati e controllati?',
                        clauseRef: '8.7',
                        status: CHECKLIST_STATUS.COMPLIANT,
                        score: 4,
                        notes: 'Procedura gestione NC output. Materiale NC segregato in area dedicata. Analisi cause e azioni correttive documentate.',
                        evidenceRef: 'PR05.02 Gestione NC Output',
                        auditDate: '2025-06-20',
                        linkedEvidences: []
                    }
                ]
            },

            clause9_Performance: {
                id: 'clause9',
                title: '9. Valutazione delle Prestazioni',
                questions: [
                    {
                        id: 'q9.1',
                        text: 'Cosa deve essere monitorato, misurato, analizzato e valutato?',
                        clauseRef: '9.1',
                        status: CHECKLIST_STATUS.COMPLIANT,
                        score: 5,
                        notes: 'KPI definiti: OTD, NC interne, reclami clienti, scostamenti budget. Monitoraggio mensile tramite Cruscotto Indicatori PR02.07.',
                        evidenceRef: 'PR02.07 Cruscotto Indicatori rev.2',
                        auditDate: '2025-06-20',
                        linkedEvidences: ['ev-005-kpi-dashboard']
                    },
                    {
                        id: 'q9.1.2',
                        text: 'La soddisfazione del cliente è stata monitorata?',
                        clauseRef: '9.1.2',
                        status: CHECKLIST_STATUS.PARTIAL,
                        score: 3,
                        notes: 'OSS: Questionari soddisfazione inviati ma tasso risposta basso (35%). Migliorare follow-up e analisi feedback.',
                        evidenceRef: 'Report Soddisfazione Cliente 2024',
                        auditDate: '2025-06-20',
                        linkedEvidences: []
                    },
                    {
                        id: 'q9.2',
                        text: 'Gli audit interni sono stati condotti a intervalli pianificati?',
                        clauseRef: '9.2',
                        status: CHECKLIST_STATUS.COMPLIANT,
                        score: 5,
                        notes: 'Programma audit interni 2025 definito e rispettato. Audit Q1 e Q2 completati. Rapporti audit archiviati. Azioni correttive tracciate.',
                        evidenceRef: 'PR04.01 Programma Audit 2025',
                        auditDate: '2025-06-20',
                        linkedEvidences: []
                    },
                    {
                        id: 'q9.3',
                        text: 'Il riesame di direzione è stato condotto?',
                        clauseRef: '9.3',
                        status: CHECKLIST_STATUS.COMPLIANT,
                        score: 5,
                        notes: 'Riesami direzione trimestrali: 2024-Q4, 2025-Q1, 2025-Q2 completati. Input/output documentati. Decisioni registrate.',
                        evidenceRef: 'Verbali Riesame Direzione 2025',
                        auditDate: '2025-06-20',
                        linkedEvidences: []
                    }
                ]
            },

            clause10_Improvement: {
                id: 'clause10',
                title: '10. Miglioramento',
                questions: [
                    {
                        id: 'q10.2',
                        text: 'Le non conformità sono state gestite con azioni correttive?',
                        clauseRef: '10.2',
                        status: CHECKLIST_STATUS.COMPLIANT,
                        score: 4,
                        notes: 'Procedura gestione NC e AC operativa. NC 2024: 8 chiuse con efficacia verificata. NC 2025: 3 aperte in corso trattamento.',
                        evidenceRef: 'Registro NC 2024-2025',
                        auditDate: '2025-06-20',
                        linkedEvidences: []
                    },
                    {
                        id: 'q10.3',
                        text: 'Il miglioramento continuo del SGQ è stato perseguito?',
                        clauseRef: '10.3',
                        status: CHECKLIST_STATUS.COMPLIANT,
                        score: 4,
                        notes: 'Iniziative miglioramento: digitalizzazione ordini (+30% efficienza), formazione personale, riduzione tempi setup (-12%).',
                        evidenceRef: 'Piano Miglioramento 2025',
                        auditDate: '2025-06-20',
                        linkedEvidences: []
                    }
                ]
            }
        }
    },

    nonConformities: [
        {
            id: 'nc-001-rp',
            norm: ISO_STANDARDS.ISO_9001,
            clause: '8.4',
            category: NC_CATEGORY.MAJOR,
            description: 'Valutazione fornitori non effettuata per 3 nuovi fornitori materie prime (Fornitore A, B, C) inseriti nell\'albo nel 2024. Mancano audit di seconda parte o questionari di valutazione iniziale.',
            rootCause: 'Processo di qualifica fornitori non formalizzato. Mancanza di checklist valutazione obbligatoria prima dell\'inserimento in albo.',
            evidenceId: null,
            correctiveAction: {
                description: 'Implementare procedura PR06.03 "Qualifica e Valutazione Fornitori". Effettuare valutazione retrospettiva dei 3 fornitori tramite audit on-site o questionario dettagliato. Inserire step obbligatorio valutazione in workflow approvvigionamenti.',
                responsible: 'Responsabile Acquisti',
                deadline: '2025-09-30',
                status: NC_STATUS.IN_PROGRESS,
                verificationDate: null,
                verificationNotes: 'In corso: bozza procedura PR06.03 completata al 70%. Pianificati audit fornitori per luglio 2025.'
            },
            detectedBy: 'Marco Camellini',
            detectedDate: '2025-06-20',
            historyLog: [
                '2025-06-20: NC rilevata durante audit',
                '2025-06-22: Azione correttiva approvata da DG',
                '2025-07-05: Inizio stesura procedura PR06.03'
            ]
        },
        {
            id: 'nc-002-rp',
            norm: ISO_STANDARDS.ISO_9001,
            clause: '9.1.2',
            category: NC_CATEGORY.MINOR,
            description: 'Tasso di risposta ai questionari soddisfazione cliente inferiore al target (35% vs 60% atteso). Analisi feedback clienti non sistematica.',
            rootCause: 'Questionari inviati via email senza follow-up. Timing invio non ottimale (fine anno). Lunghezza questionario eccessiva (20 domande).',
            evidenceId: null,
            correctiveAction: {
                description: 'Ridisegnare questionario soddisfazione (max 10 domande). Implementare follow-up telefonico per clienti strategici. Anticipare invio a metà anno. Utilizzare piattaforma online con reminder automatici.',
                responsible: 'Responsabile Commerciale',
                deadline: '2025-08-31',
                status: NC_STATUS.OPEN,
                verificationDate: null,
                verificationNotes: ''
            },
            detectedBy: 'Marco Camellini',
            detectedDate: '2025-06-20',
            historyLog: [
                '2025-06-20: NC rilevata durante audit',
                '2025-06-25: Riunione con RCOM per definire azioni'
            ]
        }
    ],

    evidences: {
        'ev-001-piano-strategico': {
            id: 'ev-001-piano-strategico',
            name: 'Piano_Strategico_2025.pdf',
            path: 'Evidenze/Generale/Piano_Strategico_2025.pdf',
            size: 2457600,
            type: 'application/pdf',
            category: EVIDENCE_CATEGORY.GENERAL,
            uploadedAt: '2025-06-15T10:30:00Z',
            linkedToQuestions: ['q4.1'],
            uploadedBy: 'Marco Camellini'
        },
        'ev-002-stakeholder-analysis': {
            id: 'ev-002-stakeholder-analysis',
            name: 'Analisi_Parti_Interessate_2025.xlsx',
            path: 'Evidenze/Generale/Analisi_Parti_Interessate_2025.xlsx',
            size: 156800,
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            category: EVIDENCE_CATEGORY.GENERAL,
            uploadedAt: '2025-06-15T11:00:00Z',
            linkedToQuestions: ['q4.2'],
            uploadedBy: 'Marco Camellini'
        },
        'ev-003-process-map': {
            id: 'ev-003-process-map',
            name: 'Mappa_Processi_RP.pdf',
            path: 'Evidenze/Controllo_Processi/Mappa_Processi_RP.pdf',
            size: 892000,
            type: 'application/pdf',
            category: EVIDENCE_CATEGORY.PROCESS_CONTROL,
            uploadedAt: '2025-06-18T14:20:00Z',
            linkedToQuestions: ['q4.4'],
            uploadedBy: 'Marco Camellini'
        },
        'ev-004-risk-matrix': {
            id: 'ev-004-risk-matrix',
            name: 'Matrice_Rischi_2025.xlsx',
            path: 'Evidenze/Generale/Matrice_Rischi_2025.xlsx',
            size: 234500,
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            category: EVIDENCE_CATEGORY.GENERAL,
            uploadedAt: '2025-06-18T15:45:00Z',
            linkedToQuestions: ['q6.1'],
            uploadedBy: 'Marco Camellini'
        },
        'ev-005-kpi-dashboard': {
            id: 'ev-005-kpi-dashboard',
            name: 'Cruscotto_Indicatori_Q2_2025.pdf',
            path: 'Evidenze/Controllo_Processi/Cruscotto_Indicatori_Q2_2025.pdf',
            size: 445600,
            type: 'application/pdf',
            category: EVIDENCE_CATEGORY.PROCESS_CONTROL,
            uploadedAt: '2025-06-20T09:00:00Z',
            linkedToQuestions: ['q9.1'],
            uploadedBy: 'Marco Camellini'
        }
    },

    pendingIssues: [],

    reportChapters: [
        {
            id: 'chapter-01-general',
            title: '1. Dati Generali',
            content: '**OGGETTO:** Audit di Verifica ispettiva interna RP\n\n**CAMPO APPLICAZIONE:** Sistema di Gestione per la Qualità RP: Contesto, Pianificazione, Supporto, Leadership, Valutazione Prestazioni, Miglioramento\n\n**DATA AUDIT:** 20/06/2025\n\n**VERIFICATORI:** Marco Camellini (EXT AUDITOR)',
            completionStatus: 'complete',
            wordCount: 45,
            lastModified: '2025-06-20T17:00:00Z'
        },
        {
            id: 'chapter-02-objective',
            title: '2. Obiettivo dell\'Audit',
            content: 'Verificare il grado di implementazione del Sistema di Gestione della Qualità secondo la norma UNI EN ISO 9001:2015 e il rispetto delle procedure interne.\n\nVerificare la completezza documentale e l\'efficacia dei processi.',
            completionStatus: 'complete',
            wordCount: 32,
            lastModified: '2025-06-20T17:05:00Z'
        },
        {
            id: 'chapter-11-outcome',
            title: '11. Esito dell\'Audit',
            content: 'Il Sistema di Gestione per la Qualità di Raccorderia Piacentina risulta **complessivamente conforme** ai requisiti della norma ISO 9001:2015.\n\nSono state rilevate:\n- **1 Non Conformità Maggiore** (clausola 8.4 - Valutazione fornitori)\n- **1 Non Conformità Minore** (clausola 9.1.2 - Soddisfazione cliente)\n\nSi raccomanda la chiusura delle NC entro le scadenze stabilite con verifica dell\'efficacia delle azioni correttive.',
            completionStatus: 'complete',
            wordCount: 65,
            lastModified: '2025-06-20T17:30:00Z'
        }
    ],

    metrics: {
        completionPercentage: 100,
        totalQuestions: 20,
        answeredQuestions: 20,
        complianceScore: 4.25,
        totalNC: 2,
        majorNC: 1,
        minorNC: 1,
        observationsNC: 0,
        totalEvidences: 5,
        completionByStandard: {
            ISO_9001: 100
        }
    },

    exports: [
        {
            type: 'checklist',
            filename: '01_Checklist_ISO9001_2025-06-20.json',
            exportedAt: '2025-06-20T18:00:00Z',
            method: 'download',
            exportedBy: 'Marco Camellini'
        }
    ]
};

// ============================================================================
// AUDIT 2: Acme Industries - ISO 9001 + 14001 PARZIALE (50%)
// ============================================================================

export const AUDIT_ACME_INDUSTRIES = {
    id: 'audit-002-acme-2025',
    metadata: {
        clientName: 'Acme Industries',
        projectYear: 2025,
        auditNumber: '2025-02',
        status: AUDIT_STATUS.IN_PROGRESS,
        selectedStandards: [ISO_STANDARDS.ISO_9001, ISO_STANDARDS.ISO_14001],
        auditor: 'Laura Bianchi',
        areaAuditata: 'Sistemi Integrati Qualità e Ambiente - Produzione Componentistica',
        createdAt: '2025-07-01T09:00:00Z',
        lastModified: '2025-10-28T16:45:00Z',
        fsConnected: true,
        fsRootPath: 'Acme_Industries/Audit_2025'
    },

    checklist: {
        ISO_9001: {
            clause4_Context: {
                id: 'clause4',
                title: '4. Contesto dell\'Organizzazione',
                questions: [
                    {
                        id: 'q4.1',
                        text: 'L\'organizzazione ha determinato le questioni esterne e interne rilevanti?',
                        clauseRef: '4.1',
                        status: CHECKLIST_STATUS.COMPLIANT,
                        score: 4,
                        notes: 'Analisi contesto completa. Identificati fattori tecnologici, economici, competitivi.',
                        evidenceRef: 'DOC-STR-001 rev.2',
                        auditDate: '2025-10-15',
                        linkedEvidences: []
                    },
                    {
                        id: 'q4.2',
                        text: 'Sono state identificate le parti interessate rilevanti?',
                        clauseRef: '4.2',
                        status: CHECKLIST_STATUS.NOT_APPLICABLE,
                        score: null,
                        notes: '',
                        evidenceRef: '',
                        auditDate: null,
                        linkedEvidences: []
                    },
                    {
                        id: 'q4.3',
                        text: 'L\'ambito di applicazione del SGQ è stato determinato?',
                        clauseRef: '4.3',
                        status: CHECKLIST_STATUS.NOT_APPLICABLE,
                        score: null,
                        notes: '',
                        evidenceRef: '',
                        auditDate: null,
                        linkedEvidences: []
                    }
                ]
            },

            clause5_Leadership: {
                id: 'clause5',
                title: '5. Leadership',
                questions: [
                    {
                        id: 'q5.1',
                        text: 'L\'alta direzione dimostra leadership e impegno?',
                        clauseRef: '5.1',
                        status: CHECKLIST_STATUS.COMPLIANT,
                        score: 5,
                        notes: 'CEO partecipa attivamente ai riesami. Budget qualità approvato.',
                        evidenceRef: 'Verbale RD 2025-Q3',
                        auditDate: '2025-10-16',
                        linkedEvidences: []
                    }
                ]
            },

            clause6_Planning: {
                id: 'clause6',
                title: '6. Pianificazione',
                questions: [
                    {
                        id: 'q6.1',
                        text: 'Azioni per rischi e opportunità determinate?',
                        clauseRef: '6.1',
                        status: CHECKLIST_STATUS.NOT_APPLICABLE,
                        score: null,
                        notes: '',
                        evidenceRef: '',
                        auditDate: null,
                        linkedEvidences: []
                    }
                ]
            }
        },

        ISO_14001: {
            clause4_Context: {
                id: 'clause4-env',
                title: '4. Contesto dell\'Organizzazione (Ambientale)',
                questions: [
                    {
                        id: 'q4.1-env',
                        text: 'Sono state determinate le questioni ambientali esterne e interne?',
                        clauseRef: '4.1',
                        status: CHECKLIST_STATUS.COMPLIANT,
                        score: 4,
                        notes: 'Analisi aspetti ambientali: emissioni, rifiuti, consumi energetici. Conformità normativa verificata.',
                        evidenceRef: 'REG-AMB-001 del 2025',
                        auditDate: '2025-10-17',
                        linkedEvidences: []
                    },
                    {
                        id: 'q4.2-env',
                        text: 'Parti interessate ambientali identificate?',
                        clauseRef: '4.2',
                        status: CHECKLIST_STATUS.NOT_APPLICABLE,
                        score: null,
                        notes: '',
                        evidenceRef: '',
                        auditDate: null,
                        linkedEvidences: []
                    }
                ]
            }
        }
    },

    nonConformities: [],

    evidences: {},

    pendingIssues: [
        {
            id: 'pending-001-acme',
            norm: ISO_STANDARDS.ISO_9001,
            clause: '7.2',
            description: 'Aggiornamento matrice competenze per nuovo processo di lavorazione CNC. Pianificata formazione specifica.',
            originAuditId: 'audit-001-acme-2024',
            originAuditNumber: '2024-03',
            transferredToAuditId: 'audit-002-acme-2025',
            status: 'in_progress',
            resolvedDate: null,
            resolutionNotes: 'Formazione CNC Base completata per 3 operatori. Manca formazione Avanzata (prevista novembre 2025).'
        }
    ],

    reportChapters: [
        {
            id: 'chapter-01-general',
            title: '1. Dati Generali',
            content: '**OGGETTO:** Audit Sistemi Integrati Qualità-Ambiente\n\n**CLIENTE:** Acme Industries\n\n**DATA AUDIT:** 15-17/10/2025\n\n**AUDITOR:** Laura Bianchi',
            completionStatus: 'complete',
            wordCount: 25,
            lastModified: '2025-10-15T09:30:00Z'
        },
        {
            id: 'chapter-02-objective',
            title: '2. Obiettivo dell\'Audit',
            content: 'Verifica conformità ISO 9001:2015 e ISO 14001:2015.\n\nAudit in corso - 50% completato.',
            completionStatus: 'draft',
            wordCount: 15,
            lastModified: '2025-10-15T10:00:00Z'
        }
    ],

    metrics: {
        completionPercentage: 50,
        totalQuestions: 12,
        answeredQuestions: 6,
        complianceScore: 4.2,
        totalNC: 0,
        majorNC: 0,
        minorNC: 0,
        observationsNC: 0,
        totalEvidences: 0,
        completionByStandard: {
            ISO_9001: 45,
            ISO_14001: 25
        }
    },

    exports: []
};

// ============================================================================
// AUDIT 3: Template Industries - NUOVO VUOTO
// ============================================================================

export const AUDIT_TEMPLATE_INDUSTRIES = {
    id: 'audit-003-template-2025',
    metadata: {
        clientName: 'Template Industries',
        projectYear: 2025,
        auditNumber: '2025-03',
        status: AUDIT_STATUS.DRAFT,
        selectedStandards: [ISO_STANDARDS.ISO_9001],
        auditor: '',
        areaAuditata: '',
        createdAt: '2025-11-02T10:00:00Z',
        lastModified: '2025-11-02T10:00:00Z',
        fsConnected: false,
        fsRootPath: null
    },

    checklist: {},

    nonConformities: [],

    evidences: {},

    pendingIssues: [],

    reportChapters: [],

    metrics: {
        completionPercentage: 0,
        totalQuestions: 0,
        answeredQuestions: 0,
        complianceScore: 0,
        totalNC: 0,
        majorNC: 0,
        minorNC: 0,
        observationsNC: 0,
        totalEvidences: 0,
        completionByStandard: {}
    },

    exports: []
};

// ============================================================================
// EXPORT ARRAY MOCK_AUDITS
// ============================================================================

export const MOCK_AUDITS = [
    AUDIT_RACCORDERIA_PIACENTINA,
    AUDIT_ACME_INDUSTRIES,
    AUDIT_TEMPLATE_INDUSTRIES
];

export default MOCK_AUDITS;

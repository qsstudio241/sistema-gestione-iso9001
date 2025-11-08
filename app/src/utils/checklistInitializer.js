/**
 * Checklist Initializer
 * Genera struttura checklist vuota per le norme ISO
 * Sistema Gestione ISO 9001 - QS Studio
 */

import { CHECKLIST_STATUS } from '../data/auditDataModel';

/**
 * Template domande ISO 9001:2015 (26 domande clausole 4-10)
 */
const ISO_9001_QUESTIONS_TEMPLATE = [
    // CLAUSOLA 4 - CONTESTO DELL'ORGANIZZAZIONE
    {
        clauseId: 'clause4_Context',
        clauseTitle: '4. Contesto dell\'Organizzazione',
        questions: [
            {
                id: 'q4.1',
                title: '4.1 - Comprendere l\'Organizzazione e il suo contesto',
                text: 'L\'organizzazione ha determinato le questioni esterne e interne rilevanti per il proprio scopo e per l\'indirizzo strategico?',
                clauseRef: '4.1'
            },
            {
                id: 'q4.2',
                title: '4.2 - Esigenze e aspettative delle parti interessate',
                text: 'Sono state identificate le parti interessate rilevanti per il SGQ e i loro requisiti?',
                clauseRef: '4.2'
            },
            {
                id: 'q4.3',
                title: '4.3 - Campo di applicazione del SGQ',
                text: 'Il campo di applicazione del SGQ è determinato, documentato e reso disponibile?',
                clauseRef: '4.3'
            },
            {
                id: 'q4.4',
                title: '4.4 - Sistema di gestione per la qualità e relativi processi',
                text: 'L\'organizzazione ha stabilito, attuato, mantenuto e migliorato il SGQ, compresi i processi e le loro interazioni?',
                clauseRef: '4.4'
            }
        ]
    },
    // CLAUSOLA 5 - LEADERSHIP
    {
        clauseId: 'clause5_Leadership',
        clauseTitle: '5. Leadership',
        questions: [
            {
                id: 'q5.1',
                title: '5.1 - Leadership e impegno',
                text: 'L\'alta direzione dimostra leadership e impegno verso il SGQ?',
                clauseRef: '5.1'
            },
            {
                id: 'q5.2',
                title: '5.2 - Politica per la qualità',
                text: 'È stata stabilita, attuata e mantenuta una politica per la qualità?',
                clauseRef: '5.2'
            },
            {
                id: 'q5.3',
                title: '5.3 - Ruoli, responsabilità e autorità',
                text: 'Ruoli, responsabilità e autorità sono assegnati, comunicati e compresi?',
                clauseRef: '5.3'
            }
        ]
    },
    // CLAUSOLA 6 - PIANIFICAZIONE
    {
        clauseId: 'clause6_Planning',
        clauseTitle: '6. Pianificazione',
        questions: [
            {
                id: 'q6.1',
                title: '6.1 - Azioni per affrontare rischi e opportunità',
                text: 'L\'organizzazione ha pianificato azioni per affrontare rischi e opportunità?',
                clauseRef: '6.1'
            },
            {
                id: 'q6.2',
                title: '6.2 - Obiettivi per la qualità e pianificazione',
                text: 'Sono stati stabiliti obiettivi per la qualità con relativi piani di azione?',
                clauseRef: '6.2'
            },
            {
                id: 'q6.3',
                title: '6.3 - Pianificazione delle modifiche',
                text: 'Le modifiche al SGQ sono pianificate e attuate in modo sistematico?',
                clauseRef: '6.3'
            }
        ]
    },
    // CLAUSOLA 7 - SUPPORTO
    {
        clauseId: 'clause7_Support',
        clauseTitle: '7. Supporto',
        questions: [
            {
                id: 'q7.1',
                title: '7.1 - Risorse',
                text: 'L\'organizzazione ha determinato e fornito le risorse necessarie per il SGQ?',
                clauseRef: '7.1'
            },
            {
                id: 'q7.2',
                title: '7.2 - Competenza',
                text: 'Sono state determinate le competenze necessarie e assicurata la formazione del personale?',
                clauseRef: '7.2'
            },
            {
                id: 'q7.3',
                title: '7.3 - Consapevolezza',
                text: 'Il personale è consapevole della politica, obiettivi e del proprio contributo al SGQ?',
                clauseRef: '7.3'
            },
            {
                id: 'q7.4',
                title: '7.4 - Comunicazione',
                text: 'Sono state determinate le comunicazioni interne ed esterne pertinenti al SGQ?',
                clauseRef: '7.4'
            },
            {
                id: 'q7.5',
                title: '7.5 - Informazioni documentate',
                text: 'Le informazioni documentate richieste dal SGQ sono controllate e mantenute?',
                clauseRef: '7.5'
            }
        ]
    },
    // CLAUSOLA 8 - ATTIVITÀ OPERATIVE
    {
        clauseId: 'clause8_Operation',
        clauseTitle: '8. Attività Operative',
        questions: [
            {
                id: 'q8.1',
                title: '8.1 - Pianificazione e controllo operativi',
                text: 'L\'organizzazione pianifica, attua e controlla i processi necessari per soddisfare i requisiti?',
                clauseRef: '8.1'
            },
            {
                id: 'q8.2',
                title: '8.2 - Requisiti per prodotti e servizi',
                text: 'I requisiti per prodotti/servizi sono determinati, riesaminati e comunicati?',
                clauseRef: '8.2'
            },
            {
                id: 'q8.3',
                title: '8.3 - Progettazione e sviluppo',
                text: 'Il processo di progettazione e sviluppo è pianificato, controllato e validato?',
                clauseRef: '8.3'
            },
            {
                id: 'q8.4',
                title: '8.4 - Controllo dei processi forniti dall\'esterno',
                text: 'I fornitori esterni sono valutati, selezionati e monitorati?',
                clauseRef: '8.4'
            },
            {
                id: 'q8.5',
                title: '8.5 - Produzione ed erogazione dei servizi',
                text: 'La produzione/erogazione è attuata in condizioni controllate?',
                clauseRef: '8.5'
            },
            {
                id: 'q8.6',
                title: '8.6 - Rilascio di prodotti e servizi',
                text: 'Sono attuate disposizioni pianificate per verificare che i requisiti siano soddisfatti?',
                clauseRef: '8.6'
            },
            {
                id: 'q8.7',
                title: '8.7 - Controllo degli output non conformi',
                text: 'Gli output non conformi sono identificati e controllati per prevenire uso/consegna non intenzionali?',
                clauseRef: '8.7'
            }
        ]
    },
    // CLAUSOLA 9 - VALUTAZIONE DELLE PRESTAZIONI
    {
        clauseId: 'clause9_Performance',
        clauseTitle: '9. Valutazione delle Prestazioni',
        questions: [
            {
                id: 'q9.1',
                title: '9.1 - Monitoraggio, misurazione, analisi e valutazione',
                text: 'L\'organizzazione determina cosa monitorare/misurare, metodi e tempistiche?',
                clauseRef: '9.1'
            },
            {
                id: 'q9.2',
                title: '9.2 - Audit interno',
                text: 'Sono condotti audit interni a intervalli pianificati per verificare conformità ed efficacia del SGQ?',
                clauseRef: '9.2'
            },
            {
                id: 'q9.3',
                title: '9.3 - Riesame di direzione',
                text: 'L\'alta direzione riesamina il SGQ a intervalli pianificati per assicurarne idoneità, adeguatezza ed efficacia?',
                clauseRef: '9.3'
            }
        ]
    },
    // CLAUSOLA 10 - MIGLIORAMENTO
    {
        clauseId: 'clause10_Improvement',
        clauseTitle: '10. Miglioramento',
        questions: [
            {
                id: 'q10.1',
                title: '10.1 - Generalità',
                text: 'L\'organizzazione determina e seleziona opportunità di miglioramento?',
                clauseRef: '10.1'
            },
            {
                id: 'q10.2',
                title: '10.2 - Non conformità e azioni correttive',
                text: 'Le non conformità sono gestite con azioni correttive per eliminare le cause?',
                clauseRef: '10.2'
            },
            {
                id: 'q10.3',
                title: '10.3 - Miglioramento continuo',
                text: 'L\'organizzazione migliora continuamente idoneità, adeguatezza ed efficacia del SGQ?',
                clauseRef: '10.3'
            }
        ]
    }
];

/**
 * Inizializza checklist vuota per ISO 9001
 * @returns {Object} Checklist con struttura completa ma domande NOT_ANSWERED
 */
export function initializeISO9001Checklist() {
    const checklist = {};

    ISO_9001_QUESTIONS_TEMPLATE.forEach(({ clauseId, clauseTitle, questions }) => {
        checklist[clauseId] = {
            id: clauseId.replace('clause', 'clause'),
            title: clauseTitle,
            questions: questions.map(q => ({
                ...q,
                status: CHECKLIST_STATUS.NOT_ANSWERED,
                score: 0,
                notes: '',
                evidence: {
                    mainDocumentRef: '',
                    detailedObservations: []
                },
                auditDate: new Date().toISOString().split('T')[0],
                linkedEvidences: []
            }))
        };
    });

    return checklist;
}

/**
 * Verifica se una checklist è vuota/non inizializzata
 * @param {Object} checklist - Checklist da verificare
 * @returns {boolean} True se vuota
 */
export function isChecklistEmpty(checklist) {
    return !checklist || Object.keys(checklist).length === 0;
}

/**
 * Conta domande totali in una checklist
 * @param {Object} checklist - Checklist ISO 9001
 * @returns {number} Numero totale domande
 */
export function countChecklistQuestions(checklist) {
    if (isChecklistEmpty(checklist)) return 0;

    return Object.values(checklist).reduce((total, clause) => {
        return total + (clause.questions?.length || 0);
    }, 0);
}

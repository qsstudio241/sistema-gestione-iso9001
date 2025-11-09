/**
 * Sistema Gestione ISO 9001 - Word Export Utility (Professional Template)
 * 
 * Template professionale per report audit conforme ISO 9001:2015
 * Basato su modello aziendale standard con:
 * - Header con logo e metadata
 * - Tabelle strutturate per dati generali
 * - Checklist con risultati colorati (NC/OSS/C)
 * - Footer con numerazione pagine
 * - Indice automatico
 */

import {
    Document,
    Paragraph,
    TextRun,
    Table,
    TableRow,
    TableCell,
    AlignmentType,
    HeadingLevel,
    BorderStyle,
    WidthType,
    VerticalAlign,
    Packer,
    PageNumber,
    TableOfContents,
    ShadingType,
    Footer
} from 'docx';
import { saveAs } from 'file-saver';

/**
 * Colori aziendali e palette template
 */
const COLORS = {
    primary: '2C3E50',        // Blu scuro header
    secondary: '34495E',      // Grigio scuro
    lightGray: 'E5E7EB',      // Grigio chiaro background header tabelle
    success: 'D1FAE5',        // Verde chiaro (Conforme)
    warning: 'FEF3C7',        // Giallo chiaro (Osservazione)
    danger: 'FEE2E2',         // Rosso chiaro (Non Conforme)
    info: 'DBEAFE',           // Blu chiaro (Opportunità Miglioramento)
    white: 'FFFFFF',
    black: '000000'
};

/**
 * Mapping status checklist → etichette e colori
 */
const STATUS_CONFIG = {
    'C': {
        label: 'Conforme',
        shortLabel: 'C',
        color: COLORS.success,
        textColor: '065F46'
    },
    'NC': {
        label: 'Non Conforme',
        shortLabel: 'NC',
        color: COLORS.danger,
        textColor: '991B1B'
    },
    'OSS': {
        label: 'Osservazione',
        shortLabel: 'OSS',
        color: COLORS.warning,
        textColor: '92400E'
    },
    'OM': {
        label: 'Opportunità di Miglioramento',
        shortLabel: 'OM',
        color: COLORS.info,
        textColor: '1E40AF'
    },
    'NA': {
        label: 'Non Applicabile',
        shortLabel: 'N/A',
        color: COLORS.lightGray,
        textColor: '6B7280'
    },
    'NOT_ANSWERED': {
        label: 'Non Risposto',
        shortLabel: '-',
        color: COLORS.white,
        textColor: '9CA3AF'
    },
    // Legacy format support
    'compliant': {
        label: 'Conforme',
        shortLabel: 'C',
        color: COLORS.success,
        textColor: '065F46'
    },
    'non_compliant': {
        label: 'Non Conforme',
        shortLabel: 'NC',
        color: COLORS.danger,
        textColor: '991B1B'
    },
    'partial': {
        label: 'Osservazione',
        shortLabel: 'OSS',
        color: COLORS.warning,
        textColor: '92400E'
    },
    'not_applicable': {
        label: 'Non Applicabile',
        shortLabel: 'N/A',
        color: COLORS.lightGray,
        textColor: '6B7280'
    }
};

/**
 * Formatta una data in formato italiano
 */
function formatDate(dateString) {
    if (!dateString) return 'N/D';
    const date = new Date(dateString);
    return date.toLocaleDateString('it-IT', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

/**
 * Formatta una data in formato lungo italiano
 */
function formatDateLong(dateString) {
    if (!dateString) return 'N/D';
    const date = new Date(dateString);
    return date.toLocaleDateString('it-IT', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
    });
}

/**
 * Crea la pagina di copertina con header professionale
 */
function createCoverPage(audit) {
    const metadata = audit.metadata;

    return [
        // Header con logo e titolo (simulato con tabella)
        new Table({
            rows: [
                new TableRow({
                    children: [
                        // Colonna logo (placeholder)
                        new TableCell({
                            children: [
                                new Paragraph({
                                    text: '[LOGO]',
                                    alignment: AlignmentType.CENTER,
                                    spacing: { before: 100, after: 100 }
                                }),
                                new Paragraph({
                                    text: metadata.clientName || 'Cliente',
                                    alignment: AlignmentType.CENTER,
                                    bold: true,
                                    size: 20
                                })
                            ],
                            width: { size: 25, type: WidthType.PERCENTAGE },
                            verticalAlign: VerticalAlign.CENTER,
                            borders: {
                                top: { style: BorderStyle.NONE },
                                bottom: { style: BorderStyle.NONE },
                                left: { style: BorderStyle.NONE },
                                right: { style: BorderStyle.SINGLE, size: 1, color: COLORS.lightGray }
                            }
                        }),
                        // Colonna titolo centrale
                        new TableCell({
                            children: [
                                new Paragraph({
                                    text: `AUDIT REPORT ${metadata.auditNumber || 'N/A'}`,
                                    alignment: AlignmentType.CENTER,
                                    bold: true,
                                    size: 32,
                                    color: COLORS.primary,
                                    spacing: { before: 200, after: 50 }
                                }),
                                new Paragraph({
                                    text: 'Check-List Interna Audit',
                                    alignment: AlignmentType.CENTER,
                                    size: 24,
                                    spacing: { after: 200 }
                                })
                            ],
                            width: { size: 50, type: WidthType.PERCENTAGE },
                            verticalAlign: VerticalAlign.CENTER,
                            borders: {
                                top: { style: BorderStyle.NONE },
                                bottom: { style: BorderStyle.NONE },
                                left: { style: BorderStyle.NONE },
                                right: { style: BorderStyle.SINGLE, size: 1, color: COLORS.lightGray }
                            }
                        }),
                        // Colonna metadata
                        new TableCell({
                            children: [
                                new Paragraph({
                                    text: `PR${metadata.auditNumber?.split('-')[1] || '00'}.04`,
                                    alignment: AlignmentType.CENTER,
                                    size: 18
                                }),
                                new Paragraph({
                                    text: 'Rev.0',
                                    alignment: AlignmentType.CENTER,
                                    size: 18
                                }),
                                new Paragraph({
                                    text: formatDate(metadata.auditDate),
                                    alignment: AlignmentType.CENTER,
                                    size: 18
                                })
                            ],
                            width: { size: 25, type: WidthType.PERCENTAGE },
                            verticalAlign: VerticalAlign.CENTER,
                            borders: {
                                top: { style: BorderStyle.NONE },
                                bottom: { style: BorderStyle.NONE },
                                left: { style: BorderStyle.NONE },
                                right: { style: BorderStyle.NONE }
                            }
                        })
                    ]
                })
            ],
            width: { size: 100, type: WidthType.PERCENTAGE },
            margins: {
                top: 100,
                bottom: 100,
                left: 100,
                right: 100
            }
        }),

        new Paragraph({
            text: '',
            spacing: { after: 800 }
        }),

        // Indice (Table of Contents)
        new Paragraph({
            text: 'Sommario',
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 }
        }),

        new TableOfContents('Sommario', {
            hyperlink: true,
            headingStyleRange: '1-3'
        }),

        new Paragraph({
            text: '',
            pageBreakBefore: true
        })
    ];
}

/**
 * Crea la sezione "1 - DATI GENERALI" con tabella strutturata
 */
function createGeneralDataSection(generalData, metadata) {
    if (!generalData) generalData = {};

    const sections = [
        new Paragraph({
            text: '1 – DATI GENERALI',
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 0, after: 300 }
        })
    ];

    // Tabella dati generali strutturata come nel modello
    const dataTable = new Table({
        rows: [
            // Row 1: OGGETTO
            new TableRow({
                children: [
                    new TableCell({
                        children: [new Paragraph({ text: 'OGGETTO:', bold: true })],
                        shading: { fill: COLORS.lightGray, type: ShadingType.CLEAR },
                        width: { size: 30, type: WidthType.PERCENTAGE }
                    }),
                    new TableCell({
                        children: [new Paragraph({ text: generalData.auditObject || 'Audit di Verifica ispettiva interna' })],
                        columnSpan: 3
                    })
                ]
            }),
            // Row 2: CAMPO APPLICAZIONE
            new TableRow({
                children: [
                    new TableCell({
                        children: [new Paragraph({ text: 'CAMPO APPLICAZIONE:', bold: true })],
                        shading: { fill: COLORS.lightGray, type: ShadingType.CLEAR }
                    }),
                    new TableCell({
                        children: [new Paragraph({ text: generalData.scope || 'Sistema di Gestione per la Qualità RP' })],
                        columnSpan: 3
                    })
                ]
            }),
            // Row 3: DOCUMENTI
            new TableRow({
                children: [
                    new TableCell({
                        children: [new Paragraph({ text: 'DOCUMENTI:', bold: true })],
                        shading: { fill: COLORS.lightGray, type: ShadingType.CLEAR }
                    }),
                    new TableCell({
                        children: [
                            new Paragraph({
                                text: (generalData.referenceDocuments && generalData.referenceDocuments.length > 0)
                                    ? generalData.referenceDocuments.join(', ')
                                    : 'Norma UNI EN ISO 9001:2015, Procedure interne'
                            })
                        ],
                        columnSpan: 3
                    })
                ]
            }),
            // Row 4: DATA AUDIT
            new TableRow({
                children: [
                    new TableCell({
                        children: [new Paragraph({ text: 'DATA AUDIT:', bold: true })],
                        shading: { fill: COLORS.lightGray, type: ShadingType.CLEAR }
                    }),
                    new TableCell({
                        children: [new Paragraph({ text: formatDate(metadata.auditDate) })],
                        columnSpan: 3
                    })
                ]
            }),
            // Row 5: PROCESSI/FUNZIONI
            new TableRow({
                children: [
                    new TableCell({
                        children: [new Paragraph({ text: 'PROCESSI/FUNZIONI:', bold: true })],
                        shading: { fill: COLORS.lightGray, type: ShadingType.CLEAR }
                    }),
                    new TableCell({
                        children: [new Paragraph({ text: generalData.processes || 'Tutti i processi aziendali' })],
                        columnSpan: 3
                    })
                ]
            }),
            // Row 6: PROGRAMMA COMUNICATO IL
            new TableRow({
                children: [
                    new TableCell({
                        children: [new Paragraph({ text: 'PROGRAMMA COMUNICATO IL:', bold: true })],
                        shading: { fill: COLORS.lightGray, type: ShadingType.CLEAR }
                    }),
                    new TableCell({
                        children: [new Paragraph({ text: formatDate(generalData.programCommunicatedDate) })],
                        columnSpan: 3
                    })
                ]
            }),
            // Row 7: VERIFICATORE
            new TableRow({
                children: [
                    new TableCell({
                        children: [new Paragraph({ text: 'VERIFICATORE:', bold: true })],
                        shading: { fill: COLORS.lightGray, type: ShadingType.CLEAR }
                    }),
                    new TableCell({
                        children: [new Paragraph({ text: metadata.auditor || 'N/D' })],
                        columnSpan: 3
                    })
                ]
            })
        ],
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
            top: { style: BorderStyle.SINGLE, size: 1, color: COLORS.black },
            bottom: { style: BorderStyle.SINGLE, size: 1, color: COLORS.black },
            left: { style: BorderStyle.SINGLE, size: 1, color: COLORS.black },
            right: { style: BorderStyle.SINGLE, size: 1, color: COLORS.black },
            insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: COLORS.black },
            insideVertical: { style: BorderStyle.SINGLE, size: 1, color: COLORS.black }
        },
        margins: {
            top: 80,
            bottom: 80,
            left: 100,
            right: 100
        }
    });

    sections.push(dataTable);

    sections.push(new Paragraph({
        text: '',
        spacing: { after: 400 },
        pageBreakBefore: true
    }));

    return sections;
}

/**
 * Crea la sezione "2 - OBIETTIVO DELL'AUDIT"
 */
function createObjectiveSection(auditObjective) {
    const sections = [
        new Paragraph({
            text: '2 - OBIETTIVO DELL\'AUDIT',
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 0, after: 300 }
        })
    ];

    const description = auditObjective?.description ||
        'Verificare il grado di implementazione del Sistema di Gestione della Qualità secondo la norma UNI EN ISO 9001:2015 e il rispetto delle procedure interne.\n\nVerificare la completezza documentale e l\'efficacia dei processi.';

    sections.push(
        new Paragraph({
            text: description,
            spacing: { after: 300 }
        })
    );

    // Tabella partecipanti SCALABILE (funzione | nome cognome)
    if (auditObjective?.participants && auditObjective.participants.length > 0) {
        sections.push(
            new Paragraph({
                text: 'Presenti per l\'organizzazione:',
                bold: true,
                spacing: { before: 300, after: 150 }
            })
        );

        // Crea righe dinamicamente da array participants
        const participantRows = auditObjective.participants.map(p =>
            new TableRow({
                children: [
                    new TableCell({
                        children: [new Paragraph({
                            text: p.role || 'N/D',
                            alignment: AlignmentType.CENTER
                        })],
                        shading: { fill: COLORS.lightGray, type: ShadingType.CLEAR },
                        margins: { top: 80, bottom: 80 }
                    }),
                    new TableCell({
                        children: [new Paragraph({
                            text: p.name || '',
                            alignment: AlignmentType.CENTER
                        })],
                        margins: { top: 80, bottom: 80 }
                    })
                ]
            })
        );

        const participantsTable = new Table({
            rows: [
                // Header row
                new TableRow({
                    children: [
                        new TableCell({
                            children: [new Paragraph({
                                text: 'Funzione',
                                bold: true,
                                alignment: AlignmentType.CENTER
                            })],
                            shading: { fill: COLORS.lightGray, type: ShadingType.CLEAR },
                            width: { size: 30, type: WidthType.PERCENTAGE }
                        }),
                        new TableCell({
                            children: [new Paragraph({
                                text: 'Nome e Cognome',
                                bold: true,
                                alignment: AlignmentType.CENTER
                            })],
                            shading: { fill: COLORS.lightGray, type: ShadingType.CLEAR },
                            width: { size: 70, type: WidthType.PERCENTAGE }
                        })
                    ]
                }),
                ...participantRows
            ],
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: {
                top: { style: BorderStyle.SINGLE, size: 1 },
                bottom: { style: BorderStyle.SINGLE, size: 1 },
                left: { style: BorderStyle.SINGLE, size: 1 },
                right: { style: BorderStyle.SINGLE, size: 1 },
                insideHorizontal: { style: BorderStyle.SINGLE, size: 1 },
                insideVertical: { style: BorderStyle.SINGLE, size: 1 }
            }
        });

        sections.push(participantsTable);
    }

    sections.push(new Paragraph({
        text: '',
        spacing: { after: 400 },
        pageBreakBefore: true
    }));

    return sections;
}

/**
 * Helper: formatta le evidenze di una domanda in testo leggibile
 * Include: mainDocumentRef + detailedObservations + notes auditor
 */
function formatEvidenceText(evidence, auditorNotes) {
    let text = '';

    // Documento di riferimento principale
    if (evidence?.mainDocumentRef) {
        text += evidence.mainDocumentRef;
    }

    // Osservazioni dettagliate (bullet list)
    if (evidence?.detailedObservations && evidence.detailedObservations.length > 0) {
        if (text) text += '\n\n';
        text += evidence.detailedObservations
            .filter(obs => obs && obs.trim()) // Rimuovi osservazioni vuote
            .map(obs => `• ${obs}`)
            .join('\n');
    }

    // Commenti auditor (IMPORTANTE: contiene valutazione dell'auditor)
    if (auditorNotes && auditorNotes.trim()) {
        if (text) text += '\n\n';
        text += auditorNotes;
    }

    return text || 'Nessuna evidenza documentata';
}

/**
 * Helper: crea una singola riga tabella per una domanda
 */
function createQuestionRow(question) {
    const statusConfig = STATUS_CONFIG[question.status] || STATUS_CONFIG['NOT_ANSWERED'];
    const evidenceText = formatEvidenceText(question.evidence, question.notes);

    // Costruisci testo con riferimento puntato (es. "4.1 - Comprendere l'Organizzazione...")
    const questionRef = question.clauseRef || '';
    const questionText = question.question || question.text || 'Domanda non definita';
    const fullQuestionText = questionRef ? `${questionRef} - ${questionText}` : questionText;

    return new TableRow({
        children: [
            // Colonna 1: Attività/processo (con riferimento puntato 4.1, 4.2, etc.)
            new TableCell({
                children: [new Paragraph({
                    text: fullQuestionText,
                    spacing: { before: 0, after: 0 }
                })],
                verticalAlign: VerticalAlign.TOP,
                margins: { top: 100, bottom: 100, left: 100, right: 100 },
                width: { size: 45, type: WidthType.PERCENTAGE }
            }),
            // Colonna 2: Valutazione di efficacia (status colorato)
            new TableCell({
                children: [new Paragraph({
                    text: statusConfig.label,
                    alignment: AlignmentType.CENTER,
                    bold: true,
                    color: statusConfig.textColor
                })],
                verticalAlign: VerticalAlign.CENTER,
                shading: { fill: statusConfig.color, type: ShadingType.CLEAR },
                margins: { top: 100, bottom: 100, left: 50, right: 50 },
                width: { size: 20, type: WidthType.PERCENTAGE }
            }),
            // Colonna 3: Dettaglio attività operative auditate (evidenze)
            new TableCell({
                children: [new Paragraph({
                    text: evidenceText,
                    spacing: { before: 0, after: 0 }
                })],
                verticalAlign: VerticalAlign.TOP,
                margins: { top: 100, bottom: 100, left: 100, right: 100 },
                width: { size: 35, type: WidthType.PERCENTAGE }
            })
        ]
    });
}

/**
 * Helper: crea header row per tabelle checklist
 */
function createTableHeaderRow() {
    return new TableRow({
        tableHeader: true,
        children: [
            new TableCell({
                children: [new Paragraph({
                    text: 'Attività/processo',
                    bold: true,
                    alignment: AlignmentType.CENTER
                })],
                shading: { fill: COLORS.lightGray, type: ShadingType.CLEAR },
                verticalAlign: VerticalAlign.CENTER,
                margins: { top: 100, bottom: 100 }
            }),
            new TableCell({
                children: [new Paragraph({
                    text: 'Valutazione di efficacia',
                    bold: true,
                    alignment: AlignmentType.CENTER
                })],
                shading: { fill: COLORS.lightGray, type: ShadingType.CLEAR },
                verticalAlign: VerticalAlign.CENTER,
                margins: { top: 100, bottom: 100 }
            }),
            new TableCell({
                children: [new Paragraph({
                    text: 'Dettaglio attività operative auditate',
                    bold: true,
                    alignment: AlignmentType.CENTER
                })],
                shading: { fill: COLORS.lightGray, type: ShadingType.CLEAR },
                verticalAlign: VerticalAlign.CENTER,
                margins: { top: 100, bottom: 100 }
            })
        ]
    });
}

/**
 * Helper: crea tabella completa per una clausola
 * SCALABILE: gestisce automaticamente qualsiasi numero di domande
 */
function createClauseTable(questions) {
    if (!questions || questions.length === 0) {
        return new Table({
            rows: [
                createTableHeaderRow(),
                new TableRow({
                    children: [
                        new TableCell({
                            children: [new Paragraph({
                                text: 'Nessuna domanda presente in questa clausola',
                                italics: true,
                                alignment: AlignmentType.CENTER
                            })],
                            columnSpan: 3,
                            margins: { top: 200, bottom: 200 }
                        })
                    ]
                })
            ],
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: {
                top: { style: BorderStyle.SINGLE, size: 1, color: COLORS.black },
                bottom: { style: BorderStyle.SINGLE, size: 1, color: COLORS.black },
                left: { style: BorderStyle.SINGLE, size: 1, color: COLORS.black },
                right: { style: BorderStyle.SINGLE, size: 1, color: COLORS.black }
            }
        });
    }

    // Mappa tutte le domande in righe (SCALABILE: 1 domanda o 1000 domande)
    const questionRows = questions.map(q => createQuestionRow(q));

    return new Table({
        rows: [
            createTableHeaderRow(),
            ...questionRows
        ],
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
            top: { style: BorderStyle.SINGLE, size: 1, color: COLORS.black },
            bottom: { style: BorderStyle.SINGLE, size: 1, color: COLORS.black },
            left: { style: BorderStyle.SINGLE, size: 1, color: COLORS.black },
            right: { style: BorderStyle.SINGLE, size: 1, color: COLORS.black },
            insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: COLORS.black },
            insideVertical: { style: BorderStyle.SINGLE, size: 1, color: COLORS.black }
        }
    });
}

/**
 * Crea la sezione "3 - CHECKLIST DI AUDIT" completa
 * VERSIONE SCALABILE: si adatta automaticamente a modifiche della checklist
 */
function createChecklistSection(checklist) {
    // Null guard
    if (!checklist || Object.keys(checklist).length === 0) {
        return [
            new Paragraph({
                text: 'Checklist non inizializzata.',
                italics: true,
                color: '6B7280',
                spacing: { after: 400 }
            })
        ];
    }

    const sections = [];

    // Sezione 3 - RILIEVI PENDENTI (placeholder)
    sections.push(
        new Paragraph({
            text: '3 - RILIEVI PENDENTI',
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 0, after: 300 }
        }),
        new Paragraph({
            text: 'Nessun rilievo pendente da audit precedenti.',
            italics: true,
            spacing: { after: 400 }
        })
    );

    // Loop dinamico su tutte le norme (SCALABILE: funziona con N norme)
    Object.entries(checklist).forEach(([normKey, normData]) => {
        // Null guard per normData
        if (!normData || typeof normData !== 'object') return;

        // Loop dinamico su tutte le clausole ISO 9001 (SCALABILE: funziona con N clausole)
        // Ogni clausola diventa un capitolo principale (4-10)
        const clauses = Object.entries(normData).sort(([a], [b]) => {
            // Ordina numericamente (4, 5, 6... invece di 10, 4, 5...)
            const numA = parseFloat(a.match(/\d+/)?.[0] || 0);
            const numB = parseFloat(b.match(/\d+/)?.[0] || 0);
            return numA - numB;
        });

        clauses.forEach(([clauseKey, clause]) => {
            // Null guard per clause
            if (!clause || typeof clause !== 'object') return;

            // Estrai numero clausola pulito (es. "4" da "clause4_Context")
            const cleanClauseNumber = clauseKey.match(/\d+/)?.[0] || clauseKey;
            const clauseTitle = clause.title || '';

            // Rimuovi il numero dalla title se già presente (es. "4. Contesto..." → "Contesto...")
            const titleWithoutNumber = clauseTitle.replace(/^\d+\.?\s*-?\s*/, '');

            // Heading clausola come capitolo principale (HEADING_1): "4 - CONTESTO DELL'ORGANIZZAZIONE"
            sections.push(
                new Paragraph({
                    text: `${cleanClauseNumber} - ${titleWithoutNumber.toUpperCase()}`,
                    heading: HeadingLevel.HEADING_1,
                    spacing: { before: 400, after: 200 }
                })
            );

            // Tabella unica per la clausola con TUTTE le domande
            // Ogni riga avrà "4.1 - Testo domanda" nella prima colonna
            sections.push(
                createClauseTable(clause.questions || []),
                new Paragraph({
                    text: '',
                    spacing: { after: 300 }
                })
            );
        });
    }); return sections;
}

/**
 * Helper: crea tabella sintesi rilievi per clausola
 * Genera automaticamente da checklist: Elemento/Processo | CONF | NC | OSS | COM | OM | N.A.
 */
function createRileviSummaryTable(checklist) {
    if (!checklist || Object.keys(checklist).length === 0) {
        return new Paragraph({
            text: 'Checklist non disponibile per generare sintesi rilievi.',
            italics: true,
            color: '6B7280'
        });
    }

    const rows = [];

    // Header row
    rows.push(
        new TableRow({
            tableHeader: true,
            children: [
                new TableCell({
                    children: [new Paragraph({
                        text: 'Elemento / Processo della norma auditato',
                        bold: true,
                        alignment: AlignmentType.CENTER,
                        size: 20
                    })],
                    shading: { fill: COLORS.lightGray, type: ShadingType.CLEAR },
                    verticalAlign: VerticalAlign.CENTER,
                    margins: { top: 80, bottom: 80 },
                    width: { size: 50, type: WidthType.PERCENTAGE }
                }),
                new TableCell({
                    children: [new Paragraph({ text: 'CONF', bold: true, alignment: AlignmentType.CENTER, size: 18 })],
                    shading: { fill: COLORS.lightGray, type: ShadingType.CLEAR },
                    verticalAlign: VerticalAlign.CENTER
                }),
                new TableCell({
                    children: [new Paragraph({ text: 'NC', bold: true, alignment: AlignmentType.CENTER, size: 18 })],
                    shading: { fill: COLORS.lightGray, type: ShadingType.CLEAR },
                    verticalAlign: VerticalAlign.CENTER
                }),
                new TableCell({
                    children: [new Paragraph({ text: 'OSS', bold: true, alignment: AlignmentType.CENTER, size: 18 })],
                    shading: { fill: COLORS.lightGray, type: ShadingType.CLEAR },
                    verticalAlign: VerticalAlign.CENTER
                }),
                new TableCell({
                    children: [new Paragraph({ text: 'OM', bold: true, alignment: AlignmentType.CENTER, size: 18 })],
                    shading: { fill: COLORS.lightGray, type: ShadingType.CLEAR },
                    verticalAlign: VerticalAlign.CENTER
                }),
                new TableCell({
                    children: [new Paragraph({ text: 'N.A.', bold: true, alignment: AlignmentType.CENTER, size: 18 })],
                    shading: { fill: COLORS.lightGray, type: ShadingType.CLEAR },
                    verticalAlign: VerticalAlign.CENTER
                })
            ]
        })
    );

    // Riga speciale: AP - Azioni pendenti (sempre presente)
    rows.push(
        new TableRow({
            children: [
                new TableCell({
                    children: [new Paragraph({
                        text: 'AP  Azioni pendenti derivanti da precedenti Audit',
                        size: 20
                    })],
                    margins: { top: 60, bottom: 60, left: 80, right: 80 }
                }),
                new TableCell({
                    children: [new Paragraph({
                        text: 'X',
                        alignment: AlignmentType.CENTER,
                        bold: true
                    })],
                    shading: { fill: COLORS.success, type: ShadingType.CLEAR },
                    verticalAlign: VerticalAlign.CENTER
                }),
                new TableCell({
                    children: [new Paragraph({ text: '', alignment: AlignmentType.CENTER })],
                    verticalAlign: VerticalAlign.CENTER
                }),
                new TableCell({
                    children: [new Paragraph({ text: '', alignment: AlignmentType.CENTER })],
                    verticalAlign: VerticalAlign.CENTER
                }),
                new TableCell({
                    children: [new Paragraph({ text: '', alignment: AlignmentType.CENTER })],
                    verticalAlign: VerticalAlign.CENTER
                }),
                new TableCell({
                    children: [new Paragraph({ text: '', alignment: AlignmentType.CENTER })],
                    verticalAlign: VerticalAlign.CENTER
                })
            ]
        })
    );

    // Itera su tutte le norme e clausole
    Object.entries(checklist).forEach(([normKey, normData]) => {
        if (!normData || typeof normData !== 'object') return;

        // Ordina clausole numericamente
        const clauses = Object.entries(normData).sort(([a], [b]) => {
            const numA = parseFloat(a.match(/\d+\.?\d*/)?.[0] || a);
            const numB = parseFloat(b.match(/\d+\.?\d*/)?.[0] || b);
            return numA - numB;
        });

        clauses.forEach(([clauseKey, clause]) => {
            if (!clause || !clause.questions) return;

            // MODIFICA: Itera su OGNI domanda invece di aggregare per clausola
            clause.questions.forEach(question => {
                const status = question.status;

                // Determina quale colonna marcare
                let markColumn = '';
                if (status === 'NC' || status === 'non_compliant') markColumn = 'NC';
                else if (status === 'OSS' || status === 'partial') markColumn = 'OSS';
                else if (status === 'OM') markColumn = 'OM';
                else if (status === 'NA' || status === 'not_applicable') markColumn = 'NA';
                else if (status === 'C' || status === 'compliant') markColumn = 'CONF';

                // Usa clauseRef per il numero punto (es. "4.1", "5.1.2")
                const questionRef = question.clauseRef || question.id || '';
                const questionTitle = question.title || question.text || '';

                // Estrai solo il titolo pulito senza il numero (che è già in clauseRef)
                const cleanTitle = questionTitle.replace(/^\d+\.?\d*\.?\d*\s*-?\s*/, '');

                // Crea riga tabella per OGNI domanda
                rows.push(
                    new TableRow({
                        children: [
                            new TableCell({
                                children: [new Paragraph({
                                    text: `${questionRef}  ${cleanTitle}`,
                                    size: 20
                                })],
                                margins: { top: 60, bottom: 60, left: 80, right: 80 }
                            }),
                            new TableCell({
                                children: [new Paragraph({
                                    text: markColumn === 'CONF' ? 'X' : '',
                                    alignment: AlignmentType.CENTER,
                                    bold: true
                                })],
                                shading: markColumn === 'CONF' ? { fill: COLORS.success, type: ShadingType.CLEAR } : undefined,
                                verticalAlign: VerticalAlign.CENTER
                            }),
                            new TableCell({
                                children: [new Paragraph({
                                    text: markColumn === 'NC' ? 'X' : '',
                                    alignment: AlignmentType.CENTER,
                                    bold: true
                                })],
                                shading: markColumn === 'NC' ? { fill: COLORS.danger, type: ShadingType.CLEAR } : undefined,
                                verticalAlign: VerticalAlign.CENTER
                            }),
                            new TableCell({
                                children: [new Paragraph({
                                    text: markColumn === 'OSS' ? 'X' : '',
                                    alignment: AlignmentType.CENTER,
                                    bold: true
                                })],
                                shading: markColumn === 'OSS' ? { fill: COLORS.warning, type: ShadingType.CLEAR } : undefined,
                                verticalAlign: VerticalAlign.CENTER
                            }),
                            new TableCell({
                                children: [new Paragraph({
                                    text: markColumn === 'OM' ? 'X' : '',
                                    alignment: AlignmentType.CENTER,
                                    bold: true
                                })],
                                shading: markColumn === 'OM' ? { fill: COLORS.info, type: ShadingType.CLEAR } : undefined,
                                verticalAlign: VerticalAlign.CENTER
                            }),
                            new TableCell({
                                children: [new Paragraph({
                                    text: markColumn === 'NA' ? 'X' : '',
                                    alignment: AlignmentType.CENTER,
                                    bold: true
                                })],
                                shading: markColumn === 'NA' ? { fill: COLORS.lightGray, type: ShadingType.CLEAR } : undefined,
                                verticalAlign: VerticalAlign.CENTER
                            })
                        ]
                    })
                );
            });
        });
    });

    return new Table({
        rows: rows,
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
            top: { style: BorderStyle.SINGLE, size: 1, color: COLORS.black },
            bottom: { style: BorderStyle.SINGLE, size: 1, color: COLORS.black },
            left: { style: BorderStyle.SINGLE, size: 1, color: COLORS.black },
            right: { style: BorderStyle.SINGLE, size: 1, color: COLORS.black },
            insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: COLORS.black },
            insideVertical: { style: BorderStyle.SINGLE, size: 1, color: COLORS.black }
        }
    });
}

/**
 * Helper: calcola metriche real-time dalla checklist
 * Conta NC, OSS, OM, NA, C, NOT_ANSWERED e totali
 */
function calculateMetricsFromChecklist(checklist) {
    const metrics = {
        totalNC: 0,
        totalOSS: 0,
        totalOM: 0,
        totalNA: 0,
        totalC: 0,
        totalNotAnswered: 0,
        totalQuestions: 0,
        answeredQuestions: 0
    };

    if (!checklist || Object.keys(checklist).length === 0) {
        return metrics;
    }

    // Itera su tutte le norme e clausole
    Object.values(checklist).forEach(normData => {
        if (!normData || typeof normData !== 'object') return;

        Object.values(normData).forEach(clause => {
            if (!clause || !clause.questions) return;

            clause.questions.forEach(q => {
                metrics.totalQuestions++;

                const status = q.status;

                // Conta per status
                if (status === 'C' || status === 'compliant') {
                    metrics.totalC++;
                    metrics.answeredQuestions++;
                } else if (status === 'NC' || status === 'non_compliant') {
                    metrics.totalNC++;
                    metrics.answeredQuestions++;
                } else if (status === 'OSS' || status === 'partial') {
                    metrics.totalOSS++;
                    metrics.answeredQuestions++;
                } else if (status === 'OM') {
                    metrics.totalOM++;
                    metrics.answeredQuestions++;
                } else if (status === 'NA' || status === 'not_applicable') {
                    metrics.totalNA++;
                    metrics.answeredQuestions++;
                } else {
                    // NOT_ANSWERED o undefined
                    metrics.totalNotAnswered++;
                }
            });
        });
    });

    return metrics;
}

/**
 * Crea la sezione "11 - ESITO DELL'AUDIT"
 */
function createOutcomeSection(auditOutcome, checklist) {
    const sections = [
        new Paragraph({
            text: '11 - ESITO DELL\'AUDIT',
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 0, after: 300 },
            pageBreakBefore: true
        })
    ];

    if (!auditOutcome) {
        sections.push(
            new Paragraph({
                text: 'Sezione non compilata. Completare i dati nella scheda "Esito Audit" dell\'applicazione.',
                italics: true,
                color: '6B7280',
                spacing: { after: 400 }
            })
        );
        return sections;
    }

    // Conclusioni
    sections.push(
        new Paragraph({
            text: 'Conclusioni',
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 200, after: 150 }
        }),
        new Paragraph({
            text: auditOutcome.conclusions || 'Nessuna conclusione documentata.',
            spacing: { after: 300 },
            italics: !auditOutcome.conclusions
        })
    );

    // TABELLA SINTESI RILIEVI (generata dinamicamente da checklist)
    sections.push(
        new Paragraph({
            text: 'RILIEVI',
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 300, after: 150 },
            alignment: AlignmentType.CENTER
        }),
        createRileviSummaryTable(checklist),
        new Paragraph({
            text: '',
            spacing: { after: 300 }
        })
    );

    // RILIEVI EMERSI - Calcola metriche real-time dalla checklist
    const metrics = calculateMetricsFromChecklist(checklist);

    sections.push(
        new Paragraph({
            text: 'Rilievi Emersi',
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 300, after: 150 }
        })
    );

    // Tabella metriche (dati aggiornati in tempo reale)
    const metricsTable = new Table({
        rows: [
            new TableRow({
                children: [
                    new TableCell({
                        children: [new Paragraph({ text: 'Non Conformità (NC)', bold: true })],
                        margins: { top: 80, bottom: 80, left: 100, right: 100 }
                    }),
                    new TableCell({
                        children: [new Paragraph({
                            text: String(metrics.totalNC),
                            bold: true,
                            alignment: AlignmentType.CENTER,
                            size: 28
                        })],
                        shading: metrics.totalNC > 0 ? { fill: COLORS.danger } : undefined,
                        verticalAlign: VerticalAlign.CENTER
                    })
                ]
            }),
            new TableRow({
                children: [
                    new TableCell({
                        children: [new Paragraph({ text: 'Osservazioni (OSS)', bold: true })],
                        margins: { top: 80, bottom: 80, left: 100, right: 100 }
                    }),
                    new TableCell({
                        children: [new Paragraph({
                            text: String(metrics.totalOSS),
                            bold: true,
                            alignment: AlignmentType.CENTER,
                            size: 28
                        })],
                        shading: metrics.totalOSS > 0 ? { fill: COLORS.warning } : undefined,
                        verticalAlign: VerticalAlign.CENTER
                    })
                ]
            }),
            new TableRow({
                children: [
                    new TableCell({
                        children: [new Paragraph({ text: 'Opportunità di Miglioramento (OM)', bold: true })],
                        margins: { top: 80, bottom: 80, left: 100, right: 100 }
                    }),
                    new TableCell({
                        children: [new Paragraph({
                            text: String(metrics.totalOM),
                            bold: true,
                            alignment: AlignmentType.CENTER,
                            size: 28
                        })],
                        shading: metrics.totalOM > 0 ? { fill: COLORS.info } : undefined,
                        verticalAlign: VerticalAlign.CENTER
                    })
                ]
            })
        ],
        width: { size: 60, type: WidthType.PERCENTAGE },
        borders: {
            top: { style: BorderStyle.SINGLE, size: 1 },
            bottom: { style: BorderStyle.SINGLE, size: 1 },
            left: { style: BorderStyle.SINGLE, size: 1 },
            right: { style: BorderStyle.SINGLE, size: 1 },
            insideHorizontal: { style: BorderStyle.SINGLE, size: 1 },
            insideVertical: { style: BorderStyle.SINGLE, size: 1 }
        }
    });

    sections.push(metricsTable, new Paragraph({ text: '', spacing: { after: 200 } }));

    // Summary testuale (usa anche metrics real-time)
    const summaryText = auditOutcome?.emergingFindings?.summary ||
        `Totale domande: ${metrics.totalQuestions}\n` +
        `Risposte evase: ${metrics.answeredQuestions}\n` +
        `Non conformità: ${metrics.totalNC}\n` +
        `Osservazioni: ${metrics.totalOSS}\n` +
        `Opportunità di miglioramento: ${metrics.totalOM}`;

    sections.push(
        new Paragraph({
            text: summaryText,
            spacing: { after: 300 }
        })
    );

    // Allegati
    if (auditOutcome.attachments && auditOutcome.attachments.length > 0) {
        sections.push(
            new Paragraph({
                text: 'Allegati',
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 300, after: 150 }
            })
        );

        auditOutcome.attachments.forEach((attachment, index) => {
            sections.push(
                new Paragraph({
                    text: `${index + 1}. ${attachment}`,
                    spacing: { after: 80 }
                })
            );
        });

        sections.push(new Paragraph({ text: '', spacing: { after: 200 } }));
    }

    // Distribuzione
    if (auditOutcome.distribution && auditOutcome.distribution.length > 0) {
        sections.push(
            new Paragraph({
                text: 'Distribuzione',
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 300, after: 150 }
            })
        );

        auditOutcome.distribution.forEach((recipient, index) => {
            sections.push(
                new Paragraph({
                    text: `${index + 1}. ${recipient}`,
                    spacing: { after: 80 }
                })
            );
        });
    }

    return sections;
}

/**
 * Crea footer con numero pagina stile "Pag. X di Y"
 */
function createFooter() {
    return {
        default: new Footer({
            children: [
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                        new TextRun('Pag. '),
                        new TextRun({
                            children: [PageNumber.CURRENT]
                        }),
                        new TextRun(' di '),
                        new TextRun({
                            children: [PageNumber.TOTAL_PAGES]
                        })
                    ]
                })
            ]
        })
    };
}

/**
 * Funzione principale: genera il documento Word professionale completo
 */
export async function exportAuditToWord(audit) {
    if (!audit || !audit.metadata) {
        throw new Error('Audit non valido: metadata mancante');
    }

    const { metadata } = audit;

    // Costruisci tutte le sezioni del documento
    const documentChildren = [
        ...createCoverPage(audit),
        ...createGeneralDataSection(metadata.generalData, metadata),
        ...createObjectiveSection(metadata.auditObjective),
        ...createChecklistSection(audit.checklist),
        ...createOutcomeSection(metadata.auditOutcome, audit.checklist)
    ];

    // Crea il documento Word con stili professionali
    const doc = new Document({
        styles: {
            default: {
                document: {
                    run: {
                        font: 'Arial',
                        size: 22 // 11pt
                    },
                    paragraph: {
                        spacing: {
                            line: 276,
                            before: 0,
                            after: 160
                        }
                    }
                }
            },
            paragraphStyles: [
                {
                    id: 'Heading1',
                    name: 'Heading 1',
                    basedOn: 'Normal',
                    next: 'Normal',
                    run: {
                        size: 28,
                        bold: true,
                        color: COLORS.primary,
                        font: 'Arial'
                    },
                    paragraph: {
                        spacing: {
                            before: 400,
                            after: 200
                        }
                    }
                },
                {
                    id: 'Heading2',
                    name: 'Heading 2',
                    basedOn: 'Normal',
                    next: 'Normal',
                    run: {
                        size: 24,
                        bold: true,
                        color: COLORS.secondary,
                        font: 'Arial'
                    },
                    paragraph: {
                        spacing: {
                            before: 300,
                            after: 150
                        }
                    }
                },
                {
                    id: 'Heading3',
                    name: 'Heading 3',
                    basedOn: 'Normal',
                    next: 'Normal',
                    run: {
                        size: 22,
                        bold: true,
                        color: '4B5563',
                        font: 'Arial'
                    },
                    paragraph: {
                        spacing: {
                            before: 200,
                            after: 100
                        }
                    }
                }
            ]
        },
        sections: [
            {
                properties: {
                    page: {
                        margin: {
                            top: 1440,
                            right: 1440,
                            bottom: 1440,
                            left: 1440
                        }
                    }
                },
                footers: createFooter(),
                children: documentChildren
            }
        ]
    });

    // Genera nome file
    const clientName = metadata.clientName?.replace(/[^a-z0-9]/gi, '_') || 'Cliente';
    const auditNumber = metadata.auditNumber?.replace(/[^a-z0-9]/gi, '_') || 'N-A';
    const fileName = `Audit_${auditNumber}_${clientName}.docx`;

    // Converti in blob e scarica
    const blob = await Packer.toBlob(doc);
    saveAs(blob, fileName);

    return fileName;
}

/**
 * Funzione avanzata: salva con File System Access API
 */
export async function exportAuditToFileSystem(audit) {
    if (!audit || !audit.metadata) {
        throw new Error('Audit non valido: metadata mancante');
    }

    try {
        const dirHandle = await window.showDirectoryPicker({
            mode: 'readwrite',
            startIn: 'documents'
        });

        const auditFolder = await dirHandle.getDirectoryHandle('Audit', { create: true });

        const year = audit.metadata.projectYear || new Date().getFullYear();
        const clientName = audit.metadata.clientName?.replace(/[^a-z0-9]/gi, '_') || 'Cliente';
        const folderName = `${year}-${clientName}`;

        const clientFolder = await auditFolder.getDirectoryHandle(folderName, { create: true });

        // Genera documento (stessa logica di exportAuditToWord)
        const { metadata } = audit;
        const documentChildren = [
            ...createCoverPage(audit),
            ...createGeneralDataSection(metadata.generalData, metadata),
            ...createObjectiveSection(metadata.auditObjective),
            ...createChecklistSection(audit.checklist),
            ...createOutcomeSection(metadata.auditOutcome, audit.checklist)
        ];

        const doc = new Document({
            sections: [{ footers: createFooter(), children: documentChildren }]
        });

        const blob = await Packer.toBlob(doc);

        const auditNumber = metadata.auditNumber?.replace(/[^a-z0-9]/gi, '_') || 'N-A';
        const fileName = `Audit_${auditNumber}_${clientName}.docx`;

        const fileHandle = await clientFolder.getFileHandle(fileName, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();

        return {
            success: true,
            path: `Audit/${folderName}/${fileName}`,
            fileName
        };
    } catch (error) {
        if (error.name === 'AbortError') {
            throw new Error('Salvataggio annullato dall\'utente');
        }
        throw error;
    }
}

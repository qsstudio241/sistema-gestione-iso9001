/**
 * Sistema Gestione ISO 9001 - Word Export Utility
 * 
 * Genera report audit in formato Word (.docx) conforme alla norma UNI EN ISO 9001:2015
 * con template professionale e struttura normativa.
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
    Packer
} from 'docx';
import { saveAs } from 'file-saver';

/**
 * Formatta una data in formato italiano
 */
function formatDate(dateString) {
    if (!dateString) return 'N/D';
    const date = new Date(dateString);
    return date.toLocaleDateString('it-IT', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
    });
}

/**
 * Mappa status checklist a etichetta italiana
 */
const STATUS_LABELS = {
    'C': 'Conforme',
    'NC': 'Non Conforme',
    'OSS': 'Osservazione',
    'OM': 'Opportunità di Miglioramento',
    'NA': 'Non Applicabile',
    'NOT_ANSWERED': 'Non Risposto',
    // Legacy format support
    'compliant': 'Conforme',
    'non_compliant': 'Non Conforme',
    'partial': 'Osservazione',
    'not_applicable': 'Non Applicabile'
};

/**
 * Genera l'intestazione del documento
 */
function createHeader(audit) {
    const metadata = audit.metadata;

    return [
        new Paragraph({
            text: 'REPORT AUDIT INTERNO',
            heading: HeadingLevel.TITLE,
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 }
        }),
        new Paragraph({
            text: `Sistema di Gestione per la Qualità ISO 9001:2015`,
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 }
        }),
        new Paragraph({
            children: [
                new TextRun({ text: 'Cliente: ', bold: true }),
                new TextRun(metadata.clientName || 'N/D')
            ],
            spacing: { after: 100 }
        }),
        new Paragraph({
            children: [
                new TextRun({ text: 'Numero Audit: ', bold: true }),
                new TextRun(metadata.auditNumber || 'N/D')
            ],
            spacing: { after: 100 }
        }),
        new Paragraph({
            children: [
                new TextRun({ text: 'Data: ', bold: true }),
                new TextRun(formatDate(metadata.auditDate))
            ],
            spacing: { after: 100 }
        }),
        new Paragraph({
            children: [
                new TextRun({ text: 'Auditor: ', bold: true }),
                new TextRun(metadata.auditor || 'N/D')
            ],
            spacing: { after: 400 }
        })
    ];
}

/**
 * Genera la sezione Dati Generali (Tab 1)
 */
function createGeneralDataSection(generalData) {
    if (!generalData) return [];

    return [
        new Paragraph({
            text: '1. DATI GENERALI DELL\'AUDIT',
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 }
        }),
        new Paragraph({
            children: [
                new TextRun({ text: 'Oggetto dell\'Audit: ', bold: true }),
                new TextRun(generalData.auditObject || 'N/D')
            ],
            spacing: { after: 100 }
        }),
        new Paragraph({
            children: [
                new TextRun({ text: 'Campo di applicazione: ', bold: true }),
                new TextRun(generalData.scope || 'N/D')
            ],
            spacing: { after: 100 }
        }),
        new Paragraph({
            children: [
                new TextRun({ text: 'Processi auditati: ', bold: true }),
                new TextRun(generalData.processes || 'N/D')
            ],
            spacing: { after: 100 }
        }),
        new Paragraph({
            children: [
                new TextRun({ text: 'Data comunicazione programma: ', bold: true }),
                new TextRun(formatDate(generalData.programCommunicatedDate))
            ],
            spacing: { after: 200 }
        })
    ];
}

/**
 * Genera la sezione Obiettivo Audit (Tab 2)
 */
function createObjectiveSection(auditObjective) {
    if (!auditObjective) return [];

    const paragraphs = [
        new Paragraph({
            text: '2. OBIETTIVO DELL\'AUDIT',
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 }
        }),
        new Paragraph({
            text: auditObjective.description || 'N/D',
            spacing: { after: 200 }
        })
    ];

    if (auditObjective.participants && auditObjective.participants.length > 0) {
        paragraphs.push(
            new Paragraph({
                children: [
                    new TextRun({ text: 'Partecipanti: ', bold: true }),
                    new TextRun(auditObjective.participants.join(', '))
                ],
                spacing: { after: 200 }
            })
        );
    }

    return paragraphs;
}

/**
 * Genera la tabella checklist per una singola clausola
 */
function createClauseTable(clauseNumber, clause) {
    const rows = [
        // Header row
        new TableRow({
            tableHeader: true,
            children: [
                new TableCell({
                    children: [new Paragraph({
                        text: 'Requisito',
                        bold: true,
                        alignment: AlignmentType.CENTER
                    })],
                    width: { size: 5500, type: WidthType.DXA }, // ~9.7 cm
                    verticalAlign: VerticalAlign.CENTER,
                    shading: { fill: 'E5E7EB' }
                }),
                new TableCell({
                    children: [new Paragraph({
                        text: 'Esito',
                        bold: true,
                        alignment: AlignmentType.CENTER
                    })],
                    width: { size: 1200, type: WidthType.DXA }, // ~2.1 cm
                    verticalAlign: VerticalAlign.CENTER,
                    shading: { fill: 'E5E7EB' }
                }),
                new TableCell({
                    children: [new Paragraph({
                        text: 'Note/Evidenze',
                        bold: true,
                        alignment: AlignmentType.CENTER
                    })],
                    width: { size: 5300, type: WidthType.DXA }, // ~9.3 cm
                    verticalAlign: VerticalAlign.CENTER,
                    shading: { fill: 'E5E7EB' }
                })
            ]
        })
    ];

    // Question rows
    clause.questions.forEach((question) => {
        const statusLabel = STATUS_LABELS[question.status] || 'Non Risposto';

        // Formatta evidenze con spacing migliorato
        const evidenceParagraphs = [];
        if (question.evidence) {
            if (question.evidence.mainDocumentRef) {
                evidenceParagraphs.push(
                    new Paragraph({
                        text: question.evidence.mainDocumentRef,
                        bold: true,
                        spacing: { after: 100 }
                    })
                );
            }
            if (question.evidence.detailedObservations && question.evidence.detailedObservations.length > 0) {
                question.evidence.detailedObservations.forEach((obs, index) => {
                    evidenceParagraphs.push(
                        new Paragraph({
                            text: `• ${obs}`,
                            spacing: { after: index < question.evidence.detailedObservations.length - 1 ? 80 : 0 }
                        })
                    );
                });
            }
        }

        if (evidenceParagraphs.length === 0) {
            evidenceParagraphs.push(
                new Paragraph({
                    text: 'Nessuna evidenza documentata',
                    italics: true,
                    color: '6B7280'
                })
            );
        }

        rows.push(
            new TableRow({
                children: [
                    new TableCell({
                        children: [new Paragraph({
                            text: question.question,
                            spacing: { after: 0 }
                        })],
                        verticalAlign: VerticalAlign.TOP,
                        margins: {
                            top: 100,
                            bottom: 100,
                            left: 100,
                            right: 100
                        }
                    }),
                    new TableCell({
                        children: [new Paragraph({
                            text: statusLabel,
                            alignment: AlignmentType.CENTER,
                            bold: true
                        })],
                        verticalAlign: VerticalAlign.CENTER,
                        shading: statusLabel === 'Non Conforme' ? { fill: 'FEE2E2' } :
                            statusLabel === 'Osservazione' ? { fill: 'FEF3C7' } :
                                statusLabel === 'Conforme' ? { fill: 'D1FAE5' } : undefined
                    }),
                    new TableCell({
                        children: evidenceParagraphs,
                        verticalAlign: VerticalAlign.TOP,
                        margins: {
                            top: 100,
                            bottom: 100,
                            left: 100,
                            right: 100
                        }
                    })
                ]
            })
        );
    }); return new Table({
        rows,
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
}

/**
 * Genera la sezione Checklist (Tab 3-10)
 */
function createChecklistSection(checklist) {
    if (!checklist || Object.keys(checklist).length === 0) {
        return [
            new Paragraph({
                text: '3. CHECKLIST DI AUDIT',
                heading: HeadingLevel.HEADING_1,
                spacing: { before: 400, after: 200 }
            }),
            new Paragraph({
                text: 'Checklist non inizializzata.',
                italics: true,
                spacing: { after: 200 }
            })
        ];
    }

    const sections = [
        new Paragraph({
            text: '3. CHECKLIST DI AUDIT',
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 }
        })
    ];

    // Itera su ogni norma (ISO9001, ISO14001, etc.)
    Object.entries(checklist).forEach(([normKey, normData]) => {
        sections.push(
            new Paragraph({
                text: `Norma: ${normKey.toUpperCase()}`,
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 300, after: 200 }
            })
        );

        // Itera su ogni clausola
        Object.entries(normData).forEach(([clauseKey, clause]) => {
            sections.push(
                new Paragraph({
                    text: `Clausola ${clauseKey}: ${clause.title}`,
                    heading: HeadingLevel.HEADING_3,
                    spacing: { before: 200, after: 100 }
                }),
                createClauseTable(clauseKey, clause),
                new Paragraph({ text: '', spacing: { after: 200 } }) // Spacing dopo tabella
            );
        });
    });

    return sections;
}

/**
 * Genera la sezione Esito Audit (Tab 11)
 */
function createOutcomeSection(auditOutcome) {
    const sections = [
        new Paragraph({
            text: '4. ESITO DELL\'AUDIT',
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 },
            pageBreakBefore: true // Inizia sezione in nuova pagina
        })
    ];

    // Se auditOutcome è completamente vuoto/undefined
    if (!auditOutcome) {
        sections.push(
            new Paragraph({
                text: 'Sezione non compilata. Completare i dati nella scheda "Esito Audit" dell\'applicazione.',
                italics: true,
                color: '6B7280',
                spacing: { after: 200 }
            })
        );
        return sections;
    }

    // 4.1 Conclusioni
    sections.push(
        new Paragraph({
            text: '4.1 Conclusioni',
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 200, after: 150 }
        }),
        new Paragraph({
            text: auditOutcome.conclusions || 'Nessuna conclusione documentata.',
            spacing: { after: 300 },
            italics: !auditOutcome.conclusions
        })
    );

    // 4.2 Rilievi Emergenti
    if (auditOutcome.emergingFindings) {
        const findings = auditOutcome.emergingFindings;
        sections.push(
            new Paragraph({
                text: '4.2 Rilievi Emergenti',
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 300, after: 150 }
            })
        );

        // Tabella metriche rilievi
        const metricsTable = new Table({
            rows: [
                new TableRow({
                    children: [
                        new TableCell({
                            children: [new Paragraph({ text: 'Tipo Rilievo', bold: true, alignment: AlignmentType.CENTER })],
                            shading: { fill: 'E5E7EB' },
                            verticalAlign: VerticalAlign.CENTER
                        }),
                        new TableCell({
                            children: [new Paragraph({ text: 'Numero', bold: true, alignment: AlignmentType.CENTER })],
                            shading: { fill: 'E5E7EB' },
                            verticalAlign: VerticalAlign.CENTER
                        })
                    ]
                }),
                new TableRow({
                    children: [
                        new TableCell({
                            children: [new Paragraph({ text: 'Non Conformità (NC)' })],
                            margins: { top: 80, bottom: 80, left: 100, right: 100 }
                        }),
                        new TableCell({
                            children: [new Paragraph({
                                text: String(findings.totalNC || 0),
                                alignment: AlignmentType.CENTER,
                                bold: true
                            })],
                            shading: findings.totalNC > 0 ? { fill: 'FEE2E2' } : undefined,
                            verticalAlign: VerticalAlign.CENTER
                        })
                    ]
                }),
                new TableRow({
                    children: [
                        new TableCell({
                            children: [new Paragraph({ text: 'Osservazioni (OSS)' })],
                            margins: { top: 80, bottom: 80, left: 100, right: 100 }
                        }),
                        new TableCell({
                            children: [new Paragraph({
                                text: String(findings.totalOSS || 0),
                                alignment: AlignmentType.CENTER,
                                bold: true
                            })],
                            shading: findings.totalOSS > 0 ? { fill: 'FEF3C7' } : undefined,
                            verticalAlign: VerticalAlign.CENTER
                        })
                    ]
                }),
                new TableRow({
                    children: [
                        new TableCell({
                            children: [new Paragraph({ text: 'Opportunità di Miglioramento (OM)' })],
                            margins: { top: 80, bottom: 80, left: 100, right: 100 }
                        }),
                        new TableCell({
                            children: [new Paragraph({
                                text: String(findings.totalOM || 0),
                                alignment: AlignmentType.CENTER,
                                bold: true
                            })],
                            shading: findings.totalOM > 0 ? { fill: 'DBEAFE' } : undefined,
                            verticalAlign: VerticalAlign.CENTER
                        })
                    ]
                })
            ],
            width: { size: 70, type: WidthType.PERCENTAGE },
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

        if (findings.summary) {
            sections.push(
                new Paragraph({
                    text: 'Riepilogo rilievi:',
                    bold: true,
                    spacing: { before: 100, after: 100 }
                }),
                new Paragraph({
                    text: findings.summary,
                    spacing: { after: 300 }
                })
            );
        }
    }

    // 4.3 Allegati
    if (auditOutcome.attachments && auditOutcome.attachments.length > 0) {
        sections.push(
            new Paragraph({
                text: '4.3 Allegati',
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

    // 4.4 Distribuzione
    if (auditOutcome.distribution && auditOutcome.distribution.length > 0) {
        sections.push(
            new Paragraph({
                text: '4.4 Distribuzione Report',
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
 * Genera il footer con informazioni documentate
 */
function createFooter(audit) {
    return [
        new Paragraph({
            text: '',
            spacing: { before: 400 }
        }),
        new Paragraph({
            text: '___________________________________________________________________________',
            alignment: AlignmentType.CENTER,
            spacing: { before: 200, after: 100 }
        }),
        new Paragraph({
            children: [
                new TextRun({
                    text: `Documento generato il ${formatDate(new Date().toISOString())} | `,
                    size: 18,
                    italics: true
                }),
                new TextRun({
                    text: `Audit ID: ${audit.metadata.id}`,
                    size: 18,
                    italics: true
                })
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 100 }
        }),
        new Paragraph({
            children: [
                new TextRun({
                    text: 'Sistema di Gestione per la Qualità conforme alla norma UNI EN ISO 9001:2015',
                    size: 18,
                    italics: true
                })
            ],
            alignment: AlignmentType.CENTER
        })
    ];
}

/**
 * Funzione principale: genera il documento Word completo
 */
export async function exportAuditToWord(audit) {
    if (!audit || !audit.metadata) {
        throw new Error('Audit non valido: metadata mancante');
    }

    const { metadata } = audit;

    // Costruisci tutte le sezioni del documento
    const documentChildren = [
        ...createHeader(audit),
        ...createGeneralDataSection(metadata.generalData),
        ...createObjectiveSection(metadata.auditObjective),
        ...createChecklistSection(audit.checklist),
        ...createOutcomeSection(metadata.auditOutcome),
        ...createFooter(audit)
    ];

    // Crea il documento Word
    const doc = new Document({
        styles: {
            default: {
                document: {
                    run: {
                        font: 'Calibri',
                        size: 22 // 11pt (22 half-points)
                    },
                    paragraph: {
                        spacing: {
                            line: 276, // 1.15 line spacing
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
                        size: 32, // 16pt
                        bold: true,
                        color: '1F2937'
                    },
                    paragraph: {
                        spacing: {
                            before: 480,
                            after: 240
                        }
                    }
                },
                {
                    id: 'Heading2',
                    name: 'Heading 2',
                    basedOn: 'Normal',
                    next: 'Normal',
                    run: {
                        size: 28, // 14pt
                        bold: true,
                        color: '374151'
                    },
                    paragraph: {
                        spacing: {
                            before: 360,
                            after: 180
                        }
                    }
                },
                {
                    id: 'Heading3',
                    name: 'Heading 3',
                    basedOn: 'Normal',
                    next: 'Normal',
                    run: {
                        size: 24, // 12pt
                        bold: true,
                        color: '4B5563'
                    },
                    paragraph: {
                        spacing: {
                            before: 280,
                            after: 140
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
                            top: 1440,    // 1 inch = 1440 twips
                            right: 1440,
                            bottom: 1440,
                            left: 1440
                        }
                    }
                },
                children: documentChildren
            }
        ]
    });

    // Genera il nome file
    const clientName = metadata.clientName?.replace(/[^a-z0-9]/gi, '_') || 'Cliente';
    const auditNumber = metadata.auditNumber?.replace(/[^a-z0-9]/gi, '_') || 'N-A';
    const fileName = `Audit_${auditNumber}_${clientName}.docx`;

    // Converti in blob e scarica
    const blob = await Packer.toBlob(doc);
    saveAs(blob, fileName);

    return fileName;
}

/**
 * Funzione avanzata: salva con File System Access API in cartella organizzata
 */
export async function exportAuditToFileSystem(audit) {
    if (!audit || !audit.metadata) {
        throw new Error('Audit non valido: metadata mancante');
    }

    try {
        // Richiedi accesso alla directory principale
        const dirHandle = await window.showDirectoryPicker({
            mode: 'readwrite',
            startIn: 'documents'
        });

        // Crea struttura: /Audit/{anno}-{cliente}/
        const auditFolder = await dirHandle.getDirectoryHandle('Audit', { create: true });

        const year = audit.metadata.projectYear || new Date().getFullYear();
        const clientName = audit.metadata.clientName?.replace(/[^a-z0-9]/gi, '_') || 'Cliente';
        const folderName = `${year}-${clientName}`;

        const clientFolder = await auditFolder.getDirectoryHandle(folderName, { create: true });

        // Genera il documento
        const { metadata } = audit;
        const documentChildren = [
            ...createHeader(audit),
            ...createGeneralDataSection(metadata.generalData),
            ...createObjectiveSection(metadata.auditObjective),
            ...createChecklistSection(audit.checklist),
            ...createOutcomeSection(metadata.auditOutcome),
            ...createFooter(audit)
        ];

        const doc = new Document({
            sections: [{ children: documentChildren }]
        });

        const blob = await Packer.toBlob(doc);

        // Salva il file nella cartella organizzata
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

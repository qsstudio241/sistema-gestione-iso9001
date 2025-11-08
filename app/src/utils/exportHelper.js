import { saveAs } from 'file-saver';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';
import jsPDF from 'jspdf';

/**
 * Export Helper Centralizzato per SGQ ISO 9001:2015
 * Gestisce export in JSON, Word e PDF conforme ai requisiti ISO
 */

// ============= EXPORT JSON =============

export const exportToJSON = async (data, filename = 'sgq_export') => {
    try {
        const jsonString = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        saveAs(blob, `${filename}_${getDateString()}.json`);
        return { success: true, message: 'Export JSON completato con successo' };
    } catch (error) {
        console.error('Errore export JSON:', error);
        return { success: false, message: `Errore export JSON: ${error.message}` };
    }
};

// ============= EXPORT WORD =============

export const exportAuditToWord = async (audit) => {
    try {
        const doc = new Document({
            sections: [{
                properties: {},
                children: [
                    // Intestazione
                    new Paragraph({
                        text: 'REPORT AUDIT INTERNO',
                        heading: HeadingLevel.HEADING_1,
                        alignment: AlignmentType.CENTER,
                        spacing: { after: 300 }
                    }),
                    new Paragraph({
                        text: 'Sistema di Gestione per la Qualità UNI EN ISO 9001:2015',
                        alignment: AlignmentType.CENTER,
                        spacing: { after: 600 }
                    }),

                    // Dati Audit
                    createWordSection('DATI GENERALI', [
                        `ID Audit: ${audit.id}`,
                        `Data Audit: ${formatDate(audit.dataAudit)}`,
                        `Tipo Audit: ${audit.tipo || 'Interno'}`,
                        `Stato: ${audit.stato || 'Completato'}`,
                        `Auditor: ${audit.auditor || 'Non specificato'}`
                    ]),

                    createWordSection('CAMPO DI APPLICAZIONE (punto 9.2)', [
                        `Area/Processo: ${audit.area || 'Non specificato'}`,
                        `Punto norma ISO: ${audit.puntoISO || 'Non specificato'}`,
                        `Criteri audit: ${audit.criteri || 'Conformità ai requisiti ISO 9001:2015'}`
                    ]),

                    createWordSection('RISULTATI AUDIT', [
                        `Conformità rilevate: ${audit.conformita?.length || 0}`,
                        `Non conformità rilevate: ${audit.nonConformita?.length || 0}`,
                        `Osservazioni: ${audit.osservazioni?.length || 0}`
                    ]),

                    // Non Conformità
                    ...(audit.nonConformita && audit.nonConformita.length > 0
                        ? createNonConformitaSection(audit.nonConformita)
                        : [new Paragraph({ text: 'Nessuna non conformità rilevata', spacing: { before: 200, after: 200 } })]),

                    // Azioni Correttive
                    ...(audit.azioniCorrettive && audit.azioniCorrettive.length > 0
                        ? createAzioniCorrettiveSection(audit.azioniCorrettive)
                        : []),

                    // Conclusioni
                    createWordSection('CONCLUSIONI', [
                        audit.conclusioni || 'Il Sistema di Gestione per la Qualità risulta conforme ai requisiti della norma UNI EN ISO 9001:2015.'
                    ]),

                    // Firma
                    new Paragraph({ text: '', spacing: { before: 400 } }),
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: `Data compilazione: ${formatDate(new Date())}`,
                                italics: true
                            })
                        ]
                    }),
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: 'Firma Auditor: _________________________',
                                italics: true
                            })
                        ],
                        spacing: { before: 200 }
                    })
                ]
            }]
        });

        const blob = await Packer.toBlob(doc);
        saveAs(blob, `audit_${audit.id}_${getDateString()}.docx`);
        return { success: true, message: 'Report audit esportato in Word' };
    } catch (error) {
        console.error('Errore export Word:', error);
        return { success: false, message: `Errore export Word: ${error.message}` };
    }
};

export const exportNonConformitaToWord = async (nc) => {
    try {
        const doc = new Document({
            sections: [{
                properties: {},
                children: [
                    new Paragraph({
                        text: 'SCHEDA NON CONFORMITÀ',
                        heading: HeadingLevel.HEADING_1,
                        alignment: AlignmentType.CENTER,
                        spacing: { after: 300 }
                    }),
                    new Paragraph({
                        text: 'Punto 10.2 - UNI EN ISO 9001:2015',
                        alignment: AlignmentType.CENTER,
                        spacing: { after: 600 }
                    }),

                    createWordSection('DATI NON CONFORMITÀ', [
                        `ID: ${nc.id}`,
                        `Data rilevazione: ${formatDate(nc.dataRilevazione)}`,
                        `Stato: ${nc.stato}`,
                        `Gravità: ${nc.gravita || 'Media'}`
                    ]),

                    createWordSection('DESCRIZIONE', [
                        nc.descrizione || 'Non specificata'
                    ]),

                    createWordSection('ANALISI DELLE CAUSE', [
                        nc.analisiCause || 'Da completare'
                    ]),

                    createWordSection('AZIONI CORRETTIVE (punto 10.2)', [
                        nc.azioniCorrettive || 'Da definire'
                    ]),

                    createWordSection('VERIFICA EFFICACIA', [
                        `Data verifica: ${nc.dataVerifica ? formatDate(nc.dataVerifica) : 'Da pianificare'}`,
                        `Esito: ${nc.esitoVerifica || 'In attesa'}`
                    ]),

                    new Paragraph({ text: '', spacing: { before: 400 } }),
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: `Documento generato il: ${formatDate(new Date())}`,
                                italics: true,
                                size: 20
                            })
                        ]
                    })
                ]
            }]
        });

        const blob = await Packer.toBlob(doc);
        saveAs(blob, `non_conformita_${nc.id}_${getDateString()}.docx`);
        return { success: true, message: 'Non conformità esportata in Word' };
    } catch (error) {
        console.error('Errore export Word:', error);
        return { success: false, message: `Errore export Word: ${error.message}` };
    }
};

// ============= EXPORT PDF =============

export const exportAuditToPDF = (audit) => {
    try {
        const doc = new jsPDF();
        let yPos = 20;
        const lineHeight = 7;
        const pageHeight = doc.internal.pageSize.height;

        // Helper per aggiungere testo con gestione pagina
        const addText = (text, fontSize = 10, isBold = false) => {
            if (yPos > pageHeight - 20) {
                doc.addPage();
                yPos = 20;
            }
            doc.setFontSize(fontSize);
            if (isBold) doc.setFont(undefined, 'bold');
            else doc.setFont(undefined, 'normal');
            doc.text(text, 15, yPos);
            yPos += lineHeight;
        };

        // Intestazione
        doc.setFontSize(16);
        doc.setFont(undefined, 'bold');
        doc.text('REPORT AUDIT INTERNO', 105, yPos, { align: 'center' });
        yPos += 10;
        doc.setFontSize(11);
        doc.setFont(undefined, 'normal');
        doc.text('Sistema di Gestione per la Qualità UNI EN ISO 9001:2015', 105, yPos, { align: 'center' });
        yPos += 15;

        // Dati generali
        addText('DATI GENERALI', 12, true);
        yPos += 2;
        addText(`ID Audit: ${audit.id}`);
        addText(`Data Audit: ${formatDate(audit.dataAudit)}`);
        addText(`Tipo: ${audit.tipo || 'Interno'}`);
        addText(`Stato: ${audit.stato || 'Completato'}`);
        addText(`Auditor: ${audit.auditor || 'Non specificato'}`);
        yPos += 5;

        // Campo applicazione
        addText('CAMPO DI APPLICAZIONE (punto 9.2)', 12, true);
        yPos += 2;
        addText(`Area/Processo: ${audit.area || 'Non specificato'}`);
        addText(`Punto norma ISO: ${audit.puntoISO || 'Non specificato'}`);
        yPos += 5;

        // Risultati
        addText('RISULTATI AUDIT', 12, true);
        yPos += 2;
        addText(`Conformità rilevate: ${audit.conformita?.length || 0}`);
        addText(`Non conformità rilevate: ${audit.nonConformita?.length || 0}`);
        yPos += 5;

        // Non Conformità
        if (audit.nonConformita && audit.nonConformita.length > 0) {
            addText('NON CONFORMITÀ RILEVATE', 12, true);
            yPos += 2;
            audit.nonConformita.forEach((nc, index) => {
                addText(`${index + 1}. ${nc.descrizione || 'Non specificata'}`, 9);
            });
            yPos += 5;
        }

        // Conclusioni
        addText('CONCLUSIONI', 12, true);
        yPos += 2;
        const conclusioni = audit.conclusioni || 'Il Sistema di Gestione per la Qualità risulta conforme.';
        const conclusioniLines = doc.splitTextToSize(conclusioni, 180);
        conclusioniLines.forEach(line => addText(line, 10));

        // Footer
        yPos = pageHeight - 15;
        doc.setFontSize(9);
        doc.setFont(undefined, 'italic');
        doc.text(`Documento generato il: ${formatDate(new Date())}`, 15, yPos);

        doc.save(`audit_${audit.id}_${getDateString()}.pdf`);
        return { success: true, message: 'Report audit esportato in PDF' };
    } catch (error) {
        console.error('Errore export PDF:', error);
        return { success: false, message: `Errore export PDF: ${error.message}` };
    }
};

export const exportNonConformitaToPDF = (nc) => {
    try {
        const doc = new jsPDF();
        let yPos = 20;

        doc.setFontSize(16);
        doc.setFont(undefined, 'bold');
        doc.text('SCHEDA NON CONFORMITÀ', 105, yPos, { align: 'center' });
        yPos += 10;
        doc.setFontSize(11);
        doc.text('Punto 10.2 - UNI EN ISO 9001:2015', 105, yPos, { align: 'center' });
        yPos += 15;

        const addSection = (title, content) => {
            doc.setFontSize(12);
            doc.setFont(undefined, 'bold');
            doc.text(title, 15, yPos);
            yPos += 7;
            doc.setFontSize(10);
            doc.setFont(undefined, 'normal');
            const lines = doc.splitTextToSize(content, 180);
            lines.forEach(line => {
                doc.text(line, 15, yPos);
                yPos += 6;
            });
            yPos += 3;
        };

        addSection('DATI', `ID: ${nc.id}\nData: ${formatDate(nc.dataRilevazione)}\nStato: ${nc.stato}`);
        addSection('DESCRIZIONE', nc.descrizione || 'Non specificata');
        addSection('ANALISI CAUSE', nc.analisiCause || 'Da completare');
        addSection('AZIONI CORRETTIVE', nc.azioniCorrettive || 'Da definire');

        doc.save(`non_conformita_${nc.id}_${getDateString()}.pdf`);
        return { success: true, message: 'Non conformità esportata in PDF' };
    } catch (error) {
        console.error('Errore export PDF:', error);
        return { success: false, message: `Errore export PDF: ${error.message}` };
    }
};

// ============= EXPORT COMPLETO SISTEMA =============

export const exportSistemaCompleto = async (data, formato = 'json') => {
    const filename = `sgq_completo_${getDateString()}`;

    if (formato === 'json') {
        return await exportToJSON(data, filename);
    } else if (formato === 'word') {
        // Export completo in Word con tutte le sezioni
        return await exportSistemaToWord(data, filename);
    } else if (formato === 'pdf') {
        return exportSistemaToPDF(data, filename);
    }
};

const exportSistemaToWord = async (data, filename) => {
    try {
        const doc = new Document({
            sections: [{
                properties: {},
                children: [
                    new Paragraph({
                        text: 'SISTEMA DI GESTIONE PER LA QUALITÀ',
                        heading: HeadingLevel.HEADING_1,
                        alignment: AlignmentType.CENTER,
                        spacing: { after: 200 }
                    }),
                    new Paragraph({
                        text: 'UNI EN ISO 9001:2015',
                        alignment: AlignmentType.CENTER,
                        spacing: { after: 400 }
                    }),
                    new Paragraph({
                        text: `Export completo del: ${formatDate(new Date())}`,
                        alignment: AlignmentType.CENTER,
                        spacing: { after: 600 }
                    }),

                    createWordSection('AUDIT INTERNI (Punto 9.2)', [
                        `Totale audit: ${data.audits?.length || 0}`,
                        `Audit completati: ${data.audits?.filter(a => a.stato === 'completato').length || 0}`,
                        `Audit pianificati: ${data.audits?.filter(a => a.stato === 'pianificato').length || 0}`
                    ]),

                    createWordSection('NON CONFORMITÀ (Punto 10.2)', [
                        `Totale non conformità: ${data.nonConformita?.length || 0}`,
                        `Aperte: ${data.nonConformita?.filter(nc => nc.stato === 'aperta').length || 0}`,
                        `Chiuse: ${data.nonConformita?.filter(nc => nc.stato === 'chiusa').length || 0}`
                    ]),

                    createWordSection('PROCESSI (Punto 4.4)', [
                        `Totale processi mappati: ${data.processi?.length || 0}`
                    ]),

                    createWordSection('RISCHI E OPPORTUNITÀ (Punto 6.1)', [
                        `Totale elementi identificati: ${data.rischiOpportunita?.length || 0}`
                    ]),

                    createWordSection('INFORMAZIONI DOCUMENTATE (Punto 7.5)', [
                        `Totale documenti: ${data.documenti?.length || 0}`
                    ])
                ]
            }]
        });

        const blob = await Packer.toBlob(doc);
        saveAs(blob, `${filename}.docx`);
        return { success: true, message: 'Sistema completo esportato in Word' };
    } catch (error) {
        console.error('Errore export Word:', error);
        return { success: false, message: `Errore: ${error.message}` };
    }
};

const exportSistemaToPDF = (data, filename) => {
    try {
        const doc = new jsPDF();
        let y = 20;

        doc.setFontSize(18);
        doc.setFont(undefined, 'bold');
        doc.text('SISTEMA DI GESTIONE PER LA QUALITÀ', 105, y, { align: 'center' });
        y += 10;
        doc.setFontSize(14);
        doc.text('UNI EN ISO 9001:2015', 105, y, { align: 'center' });
        y += 15;
        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');
        doc.text(`Export del: ${formatDate(new Date())}`, 105, y, { align: 'center' });
        y += 20;

        const addSummary = (title, value) => {
            doc.setFont(undefined, 'bold');
            doc.text(title, 15, y);
            doc.setFont(undefined, 'normal');
            doc.text(`: ${value}`, 80, y);
            y += 8;
        };

        addSummary('Audit totali', data.audits?.length || 0);
        addSummary('Non conformità', data.nonConformita?.length || 0);
        addSummary('Processi mappati', data.processi?.length || 0);
        addSummary('Rischi/Opportunità', data.rischiOpportunita?.length || 0);
        addSummary('Documenti', data.documenti?.length || 0);

        doc.save(`${filename}.pdf`);
        return { success: true, message: 'Sistema completo esportato in PDF' };
    } catch (error) {
        console.error('Errore export PDF:', error);
        return { success: false, message: `Errore: ${error.message}` };
    }
};

// ============= UTILITY FUNCTIONS =============

const createWordSection = (title, content) => {
    const paragraphs = [
        new Paragraph({
            text: title,
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 300, after: 150 }
        })
    ];

    if (Array.isArray(content)) {
        content.forEach(line => {
            paragraphs.push(new Paragraph({
                text: line,
                spacing: { after: 100 }
            }));
        });
    } else {
        paragraphs.push(new Paragraph({
            text: content,
            spacing: { after: 100 }
        }));
    }

    return paragraphs;
};

const createNonConformitaSection = (nonConformita) => {
    const paragraphs = [
        new Paragraph({
            text: 'NON CONFORMITÀ RILEVATE',
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 300, after: 150 }
        })
    ];

    nonConformita.forEach((nc, index) => {
        paragraphs.push(
            new Paragraph({
                children: [
                    new TextRun({
                        text: `${index + 1}. `,
                        bold: true
                    }),
                    new TextRun({
                        text: nc.descrizione || 'Non specificata'
                    })
                ],
                spacing: { after: 100 }
            })
        );
    });

    return paragraphs;
};

const createAzioniCorrettiveSection = (azioni) => {
    const paragraphs = [
        new Paragraph({
            text: 'AZIONI CORRETTIVE (Punto 10.2)',
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 300, after: 150 }
        })
    ];

    azioni.forEach((azione, index) => {
        paragraphs.push(
            new Paragraph({
                children: [
                    new TextRun({
                        text: `${index + 1}. `,
                        bold: true
                    }),
                    new TextRun({
                        text: azione.descrizione || 'Non specificata'
                    })
                ],
                spacing: { after: 100 }
            })
        );
    });

    return paragraphs;
};

const formatDate = (date) => {
    if (!date) return 'Non specificata';
    const d = new Date(date);
    return d.toLocaleDateString('it-IT', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
    });
};

const getDateString = () => {
    const now = new Date();
    return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
};

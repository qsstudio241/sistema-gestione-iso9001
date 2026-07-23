/**
 * Export Word ISO 3834-2 — pipeline end-to-end (gap analysis ISO 3834, PROJECT_ROADMAP.md).
 *
 * Verifica, usando il template reale app/public/templates/ISO3834-audit-report.docx:
 *   (a) il .docx prodotto è un package OOXML valido (ZIP apribile, word/document.xml presente
 *       e XML ben formato — nessun parsererror)
 *   (b) tutti i placeholder {...} del template sono stati sostituiti (nessun segnaposto residuo)
 *   (c) nessuna eccezione runtime nella pipeline generateDocxBlob/injectOoxmlMarkers per lo
 *       standard ISO_3834_2 (marker CHECKLIST_MARKER/RILIEVI_MARKER, tabelle checklist)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import PizZip from "pizzip";
import * as fileSaver from "file-saver";
import { generateAuditDocxBlobForTesting } from "../utils/wordExport.js";

vi.mock("file-saver", () => ({ saveAs: vi.fn(), default: { saveAs: vi.fn() } }));

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const templatePath = path.join(__dirname, "../../public/templates/ISO3834-audit-report.docx");

/** Legge il blob prodotto (jsdom Blob) come ArrayBuffer via FileReader (pattern usato altrove nei test wordExport). */
function blobToArrayBuffer(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsArrayBuffer(blob);
    });
}

function makeIso3834Audit() {
    return {
        metadata: {
            auditNumber: "QS_260723_01",
            procedureCode: "PR04.04",
            clientName: "Officine Metalmeccaniche Test Srl",
            auditPartyType: "second_party",
            fornitoreName: "Officine Metalmeccaniche Test Srl",
            fornitoreAddress: "Via dell'Industria 12, 41100 Modena",
            auditorName: "Luca Verdi",
            selectedStandards: ["ISO_3834_2"],
            generalData: {
                auditObject: "Saldatura strutture metalliche carpenteria",
                scope: "Reparto produzione - linea saldatura",
                referenceDocuments: ["WPS-001", "WPQR-014"],
                processes: "Saldatura ad arco (135/141)",
                programCommunicatedDate: "2026-07-10",
                auditors: ["Luca Verdi"],
            },
            auditObjective: {
                description: "Verificare il mantenimento dei requisiti ISO 3834-2 presso il fornitore.",
                participants: [{ role: "Responsabile Qualità Saldatura", name: "Mario Bianchi" }],
            },
            auditOutcome: {
                conclusions: "Fornitore conforme con osservazioni minori.",
            },
        },
        checklist: {
            ISO_3834_2: {
                s1: {
                    title: "Riesame dei requisiti e revisione tecnica",
                    questions: [
                        {
                            questionId: 9001,
                            clauseRef: "3834-2 §5",
                            status: "C",
                            text: "L'azienda dispone di WPS approvate per i procedimenti impiegati?",
                            notes: "WPS-001 verificata a campione.",
                        },
                        {
                            questionId: 9002,
                            clauseRef: "3834-2 §6",
                            status: "NC",
                            text: "Il personale saldatore è qualificato secondo ISO 9606?",
                            notes: "Un saldatore con qualifica scaduta da 3 mesi.",
                        },
                    ],
                },
                s2: {
                    title: "Controllo e prove",
                    questions: [
                        {
                            questionId: 9003,
                            clauseRef: "3834-2 §10",
                            status: "OSS",
                            text: "I controlli non distruttivi sono eseguiti secondo piano di controllo?",
                            notes: "Registrazioni presenti ma non sempre datate.",
                        },
                        {
                            questionId: 9004,
                            clauseRef: "3834-2 §11",
                            status: "OM",
                            text: "Le apparecchiature di saldatura sono soggette a manutenzione programmata?",
                            notes: "Suggerito registro manutenzione dedicato.",
                        },
                        {
                            questionId: 9005,
                            clauseRef: "3834-2 §12",
                            status: "NA",
                            text: "Sono previsti trattamenti termici post-saldatura?",
                            notes: "Non applicabile: spessori sotto soglia.",
                        },
                        {
                            questionId: 9006,
                            clauseRef: "3834-2 §13",
                            status: "NV",
                            text: "È presente un piano di taratura degli strumenti di misura?",
                            notes: "",
                        },
                    ],
                },
            },
        },
        attachments: [
            {
                questionId: 9002,
                fileName: "qualifica_saldatore.pdf",
                serverAttachmentId: 70021,
                mimeType: "application/pdf",
            },
        ],
        pendingIssues: [],
    };
}

describe("Export Word ISO_3834_2 — pipeline end-to-end (template reale)", () => {
    let originalFetch;

    beforeEach(() => {
        originalFetch = global.fetch;
        const templateBuf = fs.readFileSync(templatePath);
        const templateArrayBuffer = templateBuf.buffer.slice(
            templateBuf.byteOffset,
            templateBuf.byteOffset + templateBuf.byteLength
        );
        global.fetch = vi.fn(async (url) => {
            if (String(url).includes("ISO3834-audit-report.docx")) {
                return { ok: true, status: 200, arrayBuffer: async () => templateArrayBuffer };
            }
            return { ok: false, status: 404, arrayBuffer: async () => new ArrayBuffer(0) };
        });
    });

    afterEach(() => {
        if (originalFetch) global.fetch = originalFetch;
        else delete global.fetch;
    });

    it("genera un .docx senza eccezioni runtime per ISO_3834_2 (marker + tabelle checklist)", async () => {
        const audit = makeIso3834Audit();
        const getViewUrl = (id) => `https://api.example.test/attachments/${id}/view?token=TOK`;

        await expect(
            generateAuditDocxBlobForTesting(audit, getViewUrl, { standardKey: "ISO_3834_2" })
        ).resolves.toBeInstanceOf(Blob);
    });

    it("(a) il .docx prodotto è un package OOXML valido (ZIP apribile, document.xml ben formato)", async () => {
        const audit = makeIso3834Audit();
        const getViewUrl = (id) => `https://api.example.test/attachments/${id}/view?token=TOK`;

        const blob = await generateAuditDocxBlobForTesting(audit, getViewUrl, { standardKey: "ISO_3834_2" });
        expect(blob.size).toBeGreaterThan(0);

        const arrayBuffer = await blobToArrayBuffer(blob);
        const zip = new PizZip(arrayBuffer);

        // ZIP/OOXML riapribile: parti minime obbligatorie di un package Word
        expect(zip.files["[Content_Types].xml"]).toBeTruthy();
        expect(zip.files["_rels/.rels"]).toBeTruthy();
        expect(zip.files["word/document.xml"]).toBeTruthy();

        const documentXml = zip.files["word/document.xml"].asText();
        expect(documentXml.length).toBeGreaterThan(0);

        // XML ben formato: DOMParser (jsdom) segnala <parsererror> se il documento non è valido
        const doc = new DOMParser().parseFromString(documentXml, "application/xml");
        const parserError = doc.getElementsByTagName("parsererror");
        expect(parserError.length, `document.xml non valido: ${documentXml.slice(0, 500)}`).toBe(0);
    });

    it("(b) nessun placeholder {...} residuo nel testo finale", async () => {
        const audit = makeIso3834Audit();
        const getViewUrl = (id) => `https://api.example.test/attachments/${id}/view?token=TOK`;

        const blob = await generateAuditDocxBlobForTesting(audit, getViewUrl, { standardKey: "ISO_3834_2" });
        const arrayBuffer = await blobToArrayBuffer(blob);
        const zip = new PizZip(arrayBuffer);

        const partsToCheck = Object.keys(zip.files).filter((p) =>
            /^word\/(document|header\d+|footer\d+)\.xml$/.test(p)
        );
        expect(partsToCheck.length).toBeGreaterThan(0);

        for (const partPath of partsToCheck) {
            const xml = zip.files[partPath].asText();
            const plainText = Array.from(xml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g))
                .map((m) => m[1])
                .join("");
            // Nessun segnaposto docxtemplater residuo (es. {clientName}, {auditor}, {#participants})
            expect(plainText, `placeholder residuo in ${partPath}`).not.toMatch(/\{[a-zA-Z#/][\w]*\}/);
            // I marker OOXML devono essere stati sostituiti dal contenuto reale
            expect(plainText).not.toContain("CHECKLIST_MARKER");
            expect(plainText).not.toContain("RILIEVI_MARKER");
        }

        // Contenuto reale iniettato nel corpo del documento
        const bodyXml = zip.files["word/document.xml"].asText();
        const bodyText = Array.from(bodyXml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)).map((m) => m[1]).join("");
        expect(bodyText).toContain("Officine Metalmeccaniche Test Srl");
        expect(bodyText).toContain("saldatore è qualificato secondo ISO 9606");
    });

    it("(c) inietta correttamente le tabelle checklist (stati C/NC/OSS/OM/NA/NV) senza eccezioni", async () => {
        const audit = makeIso3834Audit();
        const getViewUrl = (id) => `https://api.example.test/attachments/${id}/view?token=TOK`;

        const blob = await generateAuditDocxBlobForTesting(audit, getViewUrl, { standardKey: "ISO_3834_2" });
        const arrayBuffer = await blobToArrayBuffer(blob);
        const zip = new PizZip(arrayBuffer);
        const documentXml = zip.files["word/document.xml"].asText();

        // Tabelle checklist con celle colorate per stato (STATUS_CFG in wordExportHelpers.js)
        expect(documentXml).toContain("Conforme");
        expect(documentXml).toContain("Non Conforme");
        expect(documentXml).toContain("Osservazione");
        expect(documentXml).toContain("Opp. Miglioramento");
        expect(documentXml).toContain("Non Applicabile");
        expect(documentXml).toContain("Non Valutato");

        // Allegato non-immagine collegato alla domanda 9002 (NC): link cliccabile con URL view
        expect(documentXml).toContain("HYPERLINK");
        expect(documentXml).toContain("https://api.example.test/attachments/70021/view?token=TOK");
    });

    it("saveAs riceve un file .docx con nome basato su cliente e numero audit", async () => {
        const { exportAuditToWord } = await import("../utils/wordExport.js");
        const audit = makeIso3834Audit();
        const getViewUrl = (id) => `https://api.example.test/attachments/${id}/view?token=TOK`;

        const fileName = await exportAuditToWord(audit, getViewUrl, { standardKey: "ISO_3834_2" });
        expect(fileName).toMatch(/\.docx$/);
        expect(fileName).toContain("Officine_Metalmeccaniche_Test_Srl");
        expect(fileSaver.saveAs).toHaveBeenCalledOnce();
    });
});

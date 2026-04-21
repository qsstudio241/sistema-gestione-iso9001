/**
 * Riparazione OOXML tag spezzati + docxtemplater su template reale ISO9001.
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import { repairDocxtemplaterFragmentedTags } from "../utils/wordExport.js";
import { buildChecklistSectionOoxml } from "../utils/wordExportHelpers.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tmplPath = path.join(__dirname, "../../public/templates/ISO9001-audit-report.docx");

function allWText(xml) {
    const a = [];
    const re = /<w:t[^>]*>([^<]*)<\/w:t>/g;
    let m;
    while ((m = re.exec(xml))) a.push(m[1]);
    return a.join("|");
}

describe("repairDocxtemplaterFragmentedTags + ISO9001 template", () => {
    it("riempie auditObject, auditor nel corpo e clientName in header dopo repair", () => {
        const buf = fs.readFileSync(tmplPath);
        const z = new PizZip(buf);
        for (const p of Object.keys(z.files).filter((x) =>
            /^word\/(document|header\d+|footer\d+)\.xml$/.test(x)
        )) {
            z.file(p, repairDocxtemplaterFragmentedTags(z.files[p].asText()));
        }
        const d = new Docxtemplater(z, {
            paragraphLoop: true,
            linebreaks: true,
            nullGetter: () => "",
        });
        d.render({
            clientName: "TEST_CLIENTE",
            auditObject: "TEST_OGGETTO",
            auditNumber: "AUD-1",
            procedureCode: "PR01",
            auditDate: "27/03/2026",
            scope: "S",
            referenceDocuments: "R",
            processes: "P",
            programCommunicatedDate: "—",
            auditor: "VERIFICATORE_PROVA",
            objectiveDescription: "O",
            participants: [{ role: "a", name: "b" }],
            conclusions: "c",
            ncCount: "0",
            ossCount: "0",
            omCount: "0",
            nvCount: "0",
            naCount: "0",
            summaryText: "sum",
        });
        const docXml = d.getZip().files["word/document.xml"].asText();
        const hdrXml = d.getZip().files["word/header1.xml"].asText();
        const docPlain = allWText(docXml);
        const hdrPlain = allWText(hdrXml);
        expect(docPlain).toContain("TEST_OGGETTO");
        expect(docPlain).toContain("VERIFICATORE_PROVA");
        expect(hdrPlain).toContain("TEST_CLIENTE");
        expect(hdrPlain).toContain("AUD-1");
    });

    it("checklist OOXML: link allegato con HYPERLINK e URL view", () => {
        const xml = buildChecklistSectionOoxml(
            {
                ISO_9001: {
                    s1: {
                        questions: [
                            {
                                questionId: 501,
                                status: "C",
                                text: "Domanda test",
                            },
                        ],
                    },
                },
            },
            [
                {
                    questionId: 501,
                    fileName: "prova.pdf",
                    serverAttachmentId: 50101,
                    mimeType: "application/pdf",
                },
            ],
            [],
            (id) => `https://api.example.test/attachments/${id}/view?token=TOK`,
            {},
            null,
            [],
            {}
        );
        expect(xml).toContain("HYPERLINK");
        expect(xml).toContain("https://api.example.test/attachments/50101/view?token=TOK");
    });

    it("ISO3834 template: fornitoreIndirizzo e ispettore sostituiti correttamente", () => {
        const iso3834Path = path.join(__dirname, "../../public/templates/ISO3834-audit-report.docx");
        const buf = fs.readFileSync(iso3834Path);
        const z = new PizZip(buf);
        for (const p of Object.keys(z.files).filter((x) =>
            /^word\/(document|header\d+|footer\d+)\.xml$/.test(x)
        )) {
            z.file(p, repairDocxtemplaterFragmentedTags(z.files[p].asText()));
        }
        const d = new Docxtemplater(z, { paragraphLoop: true, linebreaks: true, nullGetter: () => "" });
        d.render({
            clientName:           "FORNIT TEST SRL",
            fornitoreIndirizzo:   "Via Roma 1, 00100 Roma",
            auditor:              "REFERENTE_TEST",
            ispettore:            "ISPETTORE_TEST",
            auditDate:            "01/05/2026",
            auditObject:          "Audit saldatura",
            auditNumber:          "2026-TEST",
            procedureCode:        "PR04.04",
            referenceDocuments:   "DWG-001",
            processes:            "Tutti i processi",
            objectiveDescription: "Verifica ISO 3834",
            participants:         [{ role: "Tecnico", name: "Rossi" }],
            conclusions:          "Esito positivo",
            ncCount: "0", ossCount: "0", omCount: "0", nvCount: "0", naCount: "0", summaryText: "",
            organizationName: "", organizationVat: "",
            fornitoreName: "", committenteName: "", auditPartyTypeLabel: "", summaryText: "",
            programCommunicatedDate: "—",
        });
        const docXml   = d.getZip().files["word/document.xml"].asText();
        const docPlain = allWText(docXml);
        expect(docPlain).toContain("Via Roma 1, 00100 Roma");
        expect(docPlain).toContain("ISPETTORE_TEST");
        expect(docPlain).toContain("REFERENTE_TEST");
        // Nessun placeholder residuo visibile
        expect(docPlain).not.toContain("{fornitoreIndirizzo}");
        expect(docPlain).not.toContain("{ispettore}");
        expect(docPlain).not.toContain("{processes}");
        expect(docPlain).not.toContain("{scope}");
    });

    it("checklist OOXML: embed foto anche con mime normalizzato", () => {
        const imageRegistry = [];
        const xml = buildChecklistSectionOoxml(
            {
                ISO_3834_2: {
                    s1: {
                        questions: [
                            {
                                questionId: 601,
                                status: "C",
                                text: "Foto controllo",
                            },
                        ],
                    },
                },
            },
            [
                {
                    questionId: 601,
                    fileName: "foto1.jpg",
                    serverAttachmentId: 60101,
                    mimeType: "IMAGE/JPEG; charset=binary",
                    imageBase64: "data:image/jpeg;base64,AAA",
                },
            ],
            [],
            (id) => `https://api.example.test/attachments/${id}/view?token=TOK`,
            { photoMode: "preview" },
            imageRegistry,
            [],
            {}
        );

        expect(imageRegistry).toHaveLength(1);
        expect(imageRegistry[0].ext).toBe("jpg");
        expect(xml).toContain("<w:drawing>");
    });
});

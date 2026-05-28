/**
 * Ordine capitoli Word: conclusioni dopo rilievi, sommario TOC senza cache obsoleta.
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import PizZip from "pizzip";
import {
    wordExportSplitTopLevelBlocks,
    reorderConclusionsAfterRilievi,
    clearStaleTocCacheInDocumentXml,
    normalizeAuditReportDocumentStructure,
} from "../utils/wordExport.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const templatesDir = path.join(__dirname, "../../public/templates");

function blockTexts(xml) {
    return wordExportSplitTopLevelBlocks(xml).map((b) => b.text);
}

function idxConclusionsAfterRilievi(texts) {
    const ril = texts.findIndex((t) => t.includes("RILIEVI_MARKER"));
    const concHead = texts.findIndex((t) => /^Conclusioni\s*$/i.test(t));
    const concBody = texts.findIndex((t) => /\{conclusions\}/.test(t));
    return { ril, concHead, concBody };
}

describe("wordExport — ordine capitoli e sommario", () => {
    it("reorderConclusionsAfterRilievi sposta Conclusioni dopo RILIEVI (XML minimale)", () => {
        const xml =
            "<w:body>" +
            "<w:p><w:r><w:t>CHECKLIST_MARKER</w:t></w:r></w:p>" +
            "<w:p><w:pPr><w:pStyle w:val=\"Titolo1\"/></w:pPr><w:r><w:t>11 - ESITO</w:t></w:r></w:p>" +
            "<w:p><w:pPr><w:pStyle w:val=\"Titolo2\"/></w:pPr><w:r><w:t>Conclusioni</w:t></w:r></w:p>" +
            "<w:p><w:r><w:t>{conclusions}</w:t></w:r></w:p>" +
            "<w:p><w:pPr><w:pStyle w:val=\"Titolo2\"/></w:pPr><w:r><w:t>RILIEVI</w:t></w:r></w:p>" +
            "<w:p><w:r><w:t>RILIEVI_MARKER</w:t></w:r></w:p>" +
            "<w:p><w:r><w:t>{summaryText}</w:t></w:r></w:p>" +
            "</w:body>";
        const out = reorderConclusionsAfterRilievi(xml);
        const { ril, concHead, concBody } = idxConclusionsAfterRilievi(blockTexts(out));
        expect(ril).toBeGreaterThan(-1);
        expect(concHead).toBeGreaterThan(ril);
        expect(concBody).toBeGreaterThan(concHead);
    });

    it("VerbaleVisita-generic: conclusioni dopo rilievi dopo normalizzazione", () => {
        const fp = path.join(templatesDir, "VerbaleVisita-generic.docx");
        expect(fs.existsSync(fp)).toBe(true);
        const z = new PizZip(fs.readFileSync(fp));
        const raw = z.files["word/document.xml"].asText();
        const norm = normalizeAuditReportDocumentStructure(raw);
        const { ril, concHead } = idxConclusionsAfterRilievi(blockTexts(norm));
        expect(ril).toBeGreaterThan(-1);
        expect(concHead).toBeGreaterThan(ril);
    });

    it("ISO9001: conclusioni già dopo rilievi (invariato)", () => {
        const fp = path.join(templatesDir, "ISO9001-audit-report.docx");
        const z = new PizZip(fs.readFileSync(fp));
        const raw = z.files["word/document.xml"].asText();
        const norm = normalizeAuditReportDocumentStructure(raw);
        const { ril, concHead } = idxConclusionsAfterRilievi(blockTexts(norm));
        expect(ril).toBeGreaterThan(-1);
        expect(concHead).toBeGreaterThan(ril);
    });

    it("clearStaleTocCache rimuove righe _Toc obsolete nel campo Sommario", () => {
        const fp = path.join(templatesDir, "ISO9001-audit-report.docx");
        const z = new PizZip(fs.readFileSync(fp));
        const raw = z.files["word/document.xml"].asText();
        const before = (raw.match(/w:hyperlink w:anchor="_Toc/g) || []).length;
        expect(before).toBeGreaterThan(0);
        const cleaned = clearStaleTocCacheInDocumentXml(raw);
        const after = (cleaned.match(/w:hyperlink w:anchor="_Toc/g) || []).length;
        expect(after).toBeLessThan(before);
        expect(/w:instrText[^>]*>\s*TOC /i.test(cleaned)).toBe(true);
    });
});

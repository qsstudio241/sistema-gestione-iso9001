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
    normalizeVerbaleVisitaSectionHeadings,
} from "../utils/wordExport.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const templatesDir = path.join(__dirname, "../../public/templates");

function blockTexts(xml) {
    return wordExportSplitTopLevelBlocks(xml).map((b) => b.text);
}

function idxConclusionsAfterRilievi(texts) {
    const ril = texts.findIndex((t) => t.includes("RILIEVI_MARKER"));
    const concHead = texts.findIndex((t) => /^3\.2\s*[\u2013\u2014-]\s*CONCLUSIONI\s*$/i.test(t) || /^Conclusioni\s*$/i.test(t));
    const concBody = texts.findIndex((t) => /\{conclusions\}/.test(t));
    return { ril, concHead, concBody };
}

describe("wordExport  -  ordine capitoli e sommario", () => {
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

    it("VerbaleVisita-generic (template patchato): titoli 3.x già in Titolo 1", () => {
        const fp = path.join(templatesDir, "VerbaleVisita-generic.docx");
        const z = new PizZip(fs.readFileSync(fp));
        const raw = z.files["word/document.xml"].asText();
        expect(raw).toContain("3 \u2013 ESITO DELL'AUDIT");
        expect(raw).toContain("3.1 \u2013 RILIEVI");
        expect(raw).toContain("3.2 \u2013 CONCLUSIONI");
    });

    it("VerbaleVisita-generic: titoli sezione 3 in Titolo 1 numerati (normalizzazione runtime)", () => {
        const fp = path.join(templatesDir, "VerbaleVisita-generic.docx");
        const z = new PizZip(fs.readFileSync(fp));
        const raw = z.files["word/document.xml"].asText();
        const norm = normalizeAuditReportDocumentStructure(raw);
        const texts = blockTexts(norm);
        expect(texts.some((t) => /^3 [\u2013\u2014-] ESITO DELL'AUDIT$/i.test(t))).toBe(true);
        expect(texts.some((t) => /^3\.1 [\u2013\u2014-] RILIEVI$/i.test(t))).toBe(true);
        expect(texts.some((t) => /^3\.2 [\u2013\u2014-] CONCLUSIONI$/i.test(t))).toBe(true);
        expect(texts.some((t) => /^Conclusioni\s*$/i.test(t))).toBe(false);
        expect(texts.some((t) => /^RILIEVI\s*$/i.test(t))).toBe(false);

        const blocks = wordExportSplitTopLevelBlocks(norm);
        for (const label of ["3 \u2013 ESITO DELL'AUDIT", "3.1 \u2013 RILIEVI", "3.2 \u2013 CONCLUSIONI"]) {
            const blk = blocks.find((b) => b.text === label);
            expect(blk, label).toBeTruthy();
            expect(blk.xml).toMatch(/w:pStyle w:val="Titolo1"/);
            expect(blk.xml).not.toMatch(/w:jc w:val="center"/);
        }
    });

    it("normalizeVerbaleVisitaSectionHeadings converte Titolo2 centrato in Titolo1", () => {
        const xml =
            "<w:body>" +
            "<w:p><w:pPr><w:pStyle w:val=\"Titolo1\"/></w:pPr><w:r><w:t>1 \u2013 DATI GENERALI</w:t></w:r></w:p>" +
            "<w:p><w:r><w:t>CHECKLIST_MARKER</w:t></w:r></w:p>" +
            "<w:p><w:pPr><w:pStyle w:val=\"Titolo1\"/></w:pPr><w:r><w:t>ESITO DELL'AUDIT</w:t></w:r></w:p>" +
            "<w:p><w:pPr><w:pStyle w:val=\"Titolo2\"/><w:jc w:val=\"center\"/></w:pPr><w:r><w:t>RILIEVI</w:t></w:r></w:p>" +
            "<w:p><w:pPr><w:pStyle w:val=\"Titolo2\"/></w:pPr><w:r><w:t>Conclusioni</w:t></w:r></w:p>" +
            "</w:body>";
        const out = normalizeVerbaleVisitaSectionHeadings(xml);
        expect(out).toContain("3 \u2013 ESITO DELL'AUDIT");
        expect(out).toContain("3.1 \u2013 RILIEVI");
        expect(out).toContain("3.2 \u2013 CONCLUSIONI");
        expect(out).not.toMatch(/w:jc w:val="center"/);
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

    it("ISO9001: conclusioni già  dopo rilievi (invariato)", () => {
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

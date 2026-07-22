/**
 * ADR-009 Fase 3 — Sistema Integrato (isIntegratedSystem) e export ZIP multi-standard.
 *
 * buildTemplateData(audit, normKey):
 *   normKey=null  → conclusioni unificate + metriche aggregate su TUTTI gli standard
 *                   presenti in audit.checklist (comportamento "integrato").
 *   normKey='X'   → conclusioni per-norma + metriche filtrate su quello standard
 *                   (comportamento "non integrato", invariato pre-ADR-009).
 *
 * exportAuditToWordZip: genera un unico file ZIP con N report .docx, uno per standard.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import PizZip from "pizzip";
import * as fileSaver from "file-saver";
import { buildTemplateData, exportAuditToWordZip } from "../utils/wordExport.js";

vi.mock("file-saver", () => ({ saveAs: vi.fn() }));

const multiStandardAudit = {
  metadata: {
    auditNumber: "AUD-2026-01",
    clientName: "Azienda Multi SGI",
    selectedStandards: ["ISO_9001", "ISO_14001"],
    auditOutcome: {
      conclusions: "Conclusione unificata del sistema integrato.",
      byStandard: {
        ISO_9001: { conclusions: "Conclusione solo 9001." },
        ISO_14001: { conclusions: "Conclusione solo 14001." },
      },
    },
  },
  checklist: {
    ISO_9001: {
      clause4: {
        questions: [
          { status: "C", clauseRef: "4.1" },
          { status: "NC", clauseRef: "4.2" },
        ],
      },
    },
    ISO_14001: {
      clause4: {
        questions: [
          { status: "OSS", clauseRef: "4.1" },
          { status: "NC", clauseRef: "4.3" },
        ],
      },
    },
  },
};

describe("buildTemplateData — Sistema Integrato (ADR-009 Fase 3)", () => {
  it("normKey=null → usa conclusioni unificate (non quelle per-norma)", () => {
    const data = buildTemplateData(multiStandardAudit, null);
    expect(data.conclusions).toBe("Conclusione unificata del sistema integrato.");
  });

  it("normKey=null → metriche NC aggregate su TUTTI gli standard (2 NC totali)", () => {
    const data = buildTemplateData(multiStandardAudit, null);
    expect(data.ncCount).toBe("2"); // 1 NC in ISO_9001 + 1 NC in ISO_14001
    expect(data.ossCount).toBe("1");
    expect(data.cCount).toBe("1");
  });

  it("normKey='ISO_9001' → usa conclusioni per-norma (comportamento non-integrato)", () => {
    const data = buildTemplateData(multiStandardAudit, "ISO_9001");
    expect(data.conclusions).toBe("Conclusione solo 9001.");
  });

  it("normKey='ISO_9001' → NON filtra le metriche (calculateMetrics usa sempre l'intera checklist passata)", () => {
    // NB: il filtro della checklist avviene in generateDocxBlob (auditForGen.checklist),
    // non in buildTemplateData. Qui verifichiamo solo il comportamento di conclusions.
    const data = buildTemplateData(multiStandardAudit, "ISO_14001");
    expect(data.conclusions).toBe("Conclusione solo 14001.");
  });
});

describe("exportAuditToWordZip — bundle multi-standard (ADR-009 Fase 3)", () => {
  let originalFetch;

  const buildMinimalTemplateArrayBuffer = () => {
    const zip = new PizZip();
    zip.file(
      "[Content_Types].xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`
    );
    zip.file(
      "_rels/.rels",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
    );
    zip.file(
      "word/document.xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>{clientName}</w:t></w:r></w:p>
    <w:p><w:r><w:t>CHECKLIST_MARKER</w:t></w:r></w:p>
    <w:p><w:r><w:t>RILIEVI_MARKER</w:t></w:r></w:p>
    <w:sectPr/>
  </w:body>
</w:document>`
    );
    zip.file(
      "word/_rels/document.xml.rels",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`
    );
    return zip.generate({ type: "arraybuffer" });
  };

  beforeEach(() => {
    originalFetch = global.fetch;
    const templateArrayBuffer = buildMinimalTemplateArrayBuffer();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      arrayBuffer: async () => templateArrayBuffer,
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (originalFetch) global.fetch = originalFetch;
    else delete global.fetch;
  });

  it("genera un unico file ZIP e chiama saveAs con estensione .zip", async () => {
    const fileName = await exportAuditToWordZip(
      multiStandardAudit,
      null,
      ["ISO_9001", "ISO_14001"]
    );
    expect(fileName).toMatch(/\.zip$/);
    expect(fileName).toContain("Azienda_Multi_SGI");
    expect(fileSaver.saveAs).toHaveBeenCalledOnce();
  });

  it("il blob ZIP contiene un file .docx per ciascuno standard richiesto", async () => {
    await exportAuditToWordZip(multiStandardAudit, null, ["ISO_9001", "ISO_14001"]);
    const [zipBlob] = fileSaver.saveAs.mock.calls[0];
    // blob.arrayBuffer() non è garantito in jsdom: legge via FileReader (come blobToBase64).
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(zipBlob);
    });
    const base64Data = dataUrl.split(",")[1] || dataUrl;
    const zip = new PizZip(base64Data, { base64: true });
    const docxFiles = Object.keys(zip.files).filter(f => f.endsWith(".docx"));
    expect(docxFiles.length).toBe(2);
    expect(docxFiles.some(f => f.includes("ISO9001"))).toBe(true);
    expect(docxFiles.some(f => f.includes("ISO14001"))).toBe(true);
  });

  it("rifiuta con errore se richiesto un solo standard (ZIP richiede almeno 2)", async () => {
    await expect(
      exportAuditToWordZip(multiStandardAudit, null, ["ISO_9001"])
    ).rejects.toThrow(/almeno 2 standard/);
  });

  it("rifiuta con errore se l'audit non ha metadata", async () => {
    await expect(
      exportAuditToWordZip({}, null, ["ISO_9001", "ISO_14001"])
    ).rejects.toThrow(/non valido/);
  });
});

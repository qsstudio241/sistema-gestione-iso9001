/**
 * Test Android Fallback - Export Word
 *
 * Verifica che export Word funzioni su Android quando File System Access API
 * non è disponibile (fallback blob download)
 *
 * Standard: ISO 9001:2015 punto 6.1 (risk mitigation)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import PizZip from "pizzip";
import {
  exportAuditToFileSystem,
  exportAuditToWorkspace,
} from "../utils/wordExport";
import * as fileSaver from "file-saver";

// Mock file-saver
vi.mock("file-saver", () => ({
  saveAs: vi.fn(),
}));

// Mock audit data
const mockAudit = {
  metadata: {
    auditNumber: "AUDIT-001",
    clientName: "Test Cliente",
    projectYear: 2025,
    generalData: {
      organization: "Test Org",
      address: "Via Test 123",
    },
    auditObjective: {
      purpose: "Verifica conformità",
      scope: "Tutti i processi",
    },
    auditOutcome: {
      overallOutcome: "compliant",
      findings: [],
    },
  },
  checklist: [
    {
      section: "4.1",
      sectionTitle: "Contesto organizzazione",
      questions: [
        {
          clause_ref: "4.1",
          question_text: "Test question",
          status: "compliant",
          response_notes: "Test note",
        },
      ],
    },
  ],
  attachments: [],
};

describe("Android Export Word Fallback", () => {
  let originalShowDirectoryPicker;
  let originalFetch;
  let templateArrayBuffer;

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
    // Salva originale
    originalShowDirectoryPicker = window.showDirectoryPicker;
    originalFetch = global.fetch;

    templateArrayBuffer = buildMinimalTemplateArrayBuffer();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      arrayBuffer: async () => templateArrayBuffer,
    });

    // Reset mock
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Ripristina originale
    if (originalShowDirectoryPicker) {
      window.showDirectoryPicker = originalShowDirectoryPicker;
    } else {
      delete window.showDirectoryPicker;
    }
    if (originalFetch) {
      global.fetch = originalFetch;
    } else {
      delete global.fetch;
    }
  });

  describe("exportAuditToFileSystem()", () => {
    it("dovrebbe usare blob download quando File System API non disponibile (Android)", async () => {
      // Simula Android: rimuovi File System API
      delete window.showDirectoryPicker;

      const result = await exportAuditToFileSystem(mockAudit);

      // Verifica fallback attivato
      expect(result.fallback).toBe(true);
      expect(result.fileName).toContain("Test_Cliente_AUDIT_001"); // formato: client_number
      expect(result.path).toContain("Download/");

      // Verifica che saveAs sia stato chiamato (blob download)
      expect(fileSaver.saveAs).toHaveBeenCalledOnce();
    });

    it("dovrebbe usare File System API quando disponibile (Desktop)", async () => {
      // Simula Desktop: mock File System API
      const mockDirectoryHandle = {
        getDirectoryHandle: vi.fn().mockImplementation((name, opts) => ({
          getDirectoryHandle: vi.fn().mockResolvedValue({
            getFileHandle: vi.fn().mockResolvedValue({
              createWritable: vi.fn().mockResolvedValue({
                write: vi.fn(),
                close: vi.fn(),
              }),
            }),
          }),
        })),
      };

      window.showDirectoryPicker = vi
        .fn()
        .mockResolvedValue(mockDirectoryHandle);

      const result = await exportAuditToFileSystem(mockAudit);

      // Verifica NO fallback
      expect(result.fallback).toBeUndefined();
      expect(result.fileName).toContain("Test_Cliente_AUDIT_001"); // formato: client_number
      expect(result.path).toContain("Audit/");

      // Verifica che File System API sia stato usato
      expect(window.showDirectoryPicker).toHaveBeenCalledOnce();
      expect(fileSaver.saveAs).not.toHaveBeenCalled();
    });
  });

  describe("exportAuditToWorkspace()", () => {
    it("dovrebbe usare blob download quando File System API non disponibile", async () => {
      // Simula Android
      delete window.showDirectoryPicker;

      const mockFsProvider = {
        ready: vi.fn().mockReturnValue(true),
      };

      const result = await exportAuditToWorkspace(mockAudit, mockFsProvider);

      // Verifica fallback
      expect(result.fallback).toBe(true);
      expect(result.path).toContain("Download/");
      expect(fileSaver.saveAs).toHaveBeenCalledOnce();
    });

    it("dovrebbe usare blob download quando workspace non configurato", async () => {
      // Simula Desktop MA workspace non ready
      window.showDirectoryPicker = vi.fn();

      const mockFsProvider = {
        ready: vi.fn().mockReturnValue(false),
      };

      const result = await exportAuditToWorkspace(mockAudit, mockFsProvider);

      // Verifica fallback (anche su desktop se workspace non ready)
      expect(result.fallback).toBe(true);
      expect(fileSaver.saveAs).toHaveBeenCalledOnce();
    });

    it("dovrebbe validare audit prima di export", async () => {
      delete window.showDirectoryPicker;

      // Audit invalido (no metadata)
      await expect(exportAuditToFileSystem({})).rejects.toThrow(
        "metadata mancante"
      );
      await expect(
        exportAuditToWorkspace({ metadata: null }, {})
      ).rejects.toThrow("metadata mancante");
    });
  });

  describe("Console Warnings", () => {
    it("dovrebbe compilare DOCX valido in fallback Android", async () => {
      delete window.showDirectoryPicker;

      await exportAuditToFileSystem(mockAudit);

      expect(fileSaver.saveAs).toHaveBeenCalledOnce();
      const [blobArg] = fileSaver.saveAs.mock.calls[0];
      expect(blobArg).toBeInstanceOf(Blob);
      expect(blobArg.size).toBeGreaterThan(0);

      if (blobArg.type) {
        expect(blobArg.type).toContain(
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        );
      }
    });
  });
});

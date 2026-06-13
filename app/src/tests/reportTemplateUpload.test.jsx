/**
 * Test L1  validazione upload/duplica template Word (ReportTemplatesAdminPage)
 */
import { describe, it, expect } from "vitest";
import {
  validateDocxFile,
  MAX_TEMPLATE_BYTES,
  stripDocxExtension,
  validateDuplicateTemplateName,
  formatMarkerWarning,
  formatNcMarkerWarning,
  isSystemReportTemplate,
  formatTemplateOrigin,
} from "../utils/reportTemplateUpload";

function createFile(name, size, type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
  const buffer = new ArrayBuffer(size);
  return new File([buffer], name, { type });
}

describe("validateDocxFile  template report", () => {
  it("accetta .docx entro 5 MB", () => {
    const file = createFile("verbale.docx", 1024);
    expect(validateDocxFile(file)).toBeNull();
  });

  it("rifiuta estensioni diverse da .docx", () => {
    const file = createFile("verbale.pdf", 1024, "application/pdf");
    expect(validateDocxFile(file)).toMatch(/\.docx/);
  });

  it("rifiuta file oltre 5 MB", () => {
    const file = createFile("grande.docx", MAX_TEMPLATE_BYTES + 1);
    expect(validateDocxFile(file)).toMatch(/5 MB/);
  });

  it("richiede un file selezionato", () => {
    expect(validateDocxFile(null)).toMatch(/Seleziona/);
  });
});

describe("stripDocxExtension", () => {
  it("rimuove .docx dal nome file", () => {
    expect(stripDocxExtension("VerbaleVisita.docx")).toBe("VerbaleVisita");
  });
});

describe("validateDuplicateTemplateName", () => {
  it("accetta nome non vuoto", () => {
    expect(validateDuplicateTemplateName("Verbale 5S")).toBeNull();
  });

  it("rifiuta nome vuoto o solo spazi", () => {
    expect(validateDuplicateTemplateName("")).toMatch(/Inserisci/);
    expect(validateDuplicateTemplateName("   ")).toMatch(/Inserisci/);
  });

  it("rifiuta nome oltre 255 caratteri", () => {
    expect(validateDuplicateTemplateName("x".repeat(256))).toMatch(/255/);
  });
});

describe("formatMarkerWarning", () => {
  it("restituisce messaggio se mancano marker", () => {
    const msg = formatMarkerWarning(["CHECKLIST_MARKER"]);
    expect(msg).toMatch(/CHECKLIST_MARKER/);
    expect(msg).toMatch(/Attenzione/);
  });

  it("restituisce null se nessun marker mancante", () => {
    expect(formatMarkerWarning(null)).toBeNull();
    expect(formatMarkerWarning([])).toBeNull();
  });
});

describe("formatNcMarkerWarning", () => {
  it("restituisce messaggio se mancano segnaposto NC", () => {
    const msg = formatNcMarkerWarning(["{ncNumber}", "{#actions}"]);
    expect(msg).toMatch(/ncNumber/);
    expect(msg).toMatch(/Attenzione/);
  });

  it("restituisce null se nessun segnaposto mancante", () => {
    expect(formatNcMarkerWarning(null)).toBeNull();
    expect(formatNcMarkerWarning([])).toBeNull();
  });
});

describe("origine template", () => {
  it("identifica template di sistema", () => {
    expect(isSystemReportTemplate({ is_system: 1, organization_id: null })).toBe(true);
    expect(formatTemplateOrigin({ organization_id: null })).toBe("Sistema");
  });

  it("identifica template studio", () => {
    expect(isSystemReportTemplate({ organization_id: 1001 })).toBe(false);
    expect(formatTemplateOrigin({ organization_id: 1001 })).toBe("Studio");
  });
});

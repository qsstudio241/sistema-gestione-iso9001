import { describe, it, expect } from "vitest";
import { officePreviewKind, getFileExt } from "../utils/officePreviewKind";

describe("officePreviewKind", () => {
  it("riconosce Word OOXML dall'estensione", () => {
    expect(officePreviewKind("verbale.docx")).toBe("word");
    expect(officePreviewKind("modello.DOCM")).toBe("word");
  });

  it("non apre .doc e .rtf legacy nel viewer", () => {
    expect(officePreviewKind("vecchio.doc")).toBeNull();
    expect(officePreviewKind("nota.rtf")).toBeNull();
  });

  it("riconosce Excel dai formati SheetJS", () => {
    expect(officePreviewKind("scadenze.xlsx")).toBe("excel");
    expect(officePreviewKind("storico.xls")).toBe("excel");
    expect(officePreviewKind("macro.xlsm")).toBe("excel");
  });

  it("usa il MIME OOXML se manca l'estensione", () => {
    expect(officePreviewKind("senzaestensione", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")).toBe("word");
    expect(officePreviewKind("senzaestensione", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")).toBe("excel");
  });

  it("non tratta application/msword come anteprima", () => {
    expect(officePreviewKind("file", "application/msword")).toBeNull();
  });
});

describe("getFileExt", () => {
  it("estrae l'estensione in minuscolo", () => {
    expect(getFileExt("A.DOCX")).toBe(".docx");
    expect(getFileExt("niente")).toBe("");
    expect(getFileExt("")).toBe("");
  });
});

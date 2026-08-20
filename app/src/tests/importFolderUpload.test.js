import { describe, it, expect } from "vitest";
import {
  MAX_IMPORT_JOB_FILES,
  basenameImportRelativePath,
  takeImportFiles,
} from "../utils/importFolderUpload";

describe("importFolderUpload", () => {
  it("basenameImportRelativePath toglie le cartelle", () => {
    expect(basenameImportRelativePath("Commesse/Rossi-2024/capitolato.pdf")).toBe(
      "capitolato.pdf"
    );
    expect(basenameImportRelativePath("solo.pdf")).toBe("solo.pdf");
  });

  it("takeImportFiles tiene solo PDF e taglia al limite", () => {
    const files = [
      { name: "a.pdf" },
      { name: "foto.jpg" },
      { name: "b.PDF" },
    ];
    const out = takeImportFiles(files);
    expect(out.files).toHaveLength(2);
    expect(out.skippedNonPdf).toBe(1);
    expect(out.truncated).toBe(false);
  });

  it("takeImportFiles tronca oltre MAX_IMPORT_JOB_FILES", () => {
    const files = Array.from({ length: MAX_IMPORT_JOB_FILES + 3 }, (_, i) => ({
      name: `f${i}.pdf`,
    }));
    const out = takeImportFiles(files);
    expect(out.files).toHaveLength(MAX_IMPORT_JOB_FILES);
    expect(out.truncated).toBe(true);
    expect(out.skippedNonPdf).toBe(0);
  });
});

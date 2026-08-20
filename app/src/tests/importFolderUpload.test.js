import { describe, it, expect, vi } from "vitest";
import {
  MAX_IMPORT_JOB_FILES,
  basenameImportRelativePath,
  takeImportFiles,
  bindDirectoryPicker,
} from "../utils/importFolderUpload";

describe("importFolderUpload", () => {
  it("basenameImportRelativePath toglie le cartelle", () => {
    expect(basenameImportRelativePath("Commesse/Rossi-2024/capitolato.pdf")).toBe(
      "capitolato.pdf"
    );
    expect(basenameImportRelativePath("solo.pdf")).toBe("solo.pdf");
  });

  it("takeImportFiles tiene tutti i tipi e salta solo junk OS", () => {
    const files = [
      { name: "a.pdf" },
      { name: "capitolato.docx" },
      { name: "foto.jpg" },
      { name: "Thumbs.db" },
      { name: "b.PDF" },
    ];
    const out = takeImportFiles(files);
    expect(out.files).toHaveLength(4);
    expect(out.skippedJunk).toBe(1);
    expect(out.truncated).toBe(false);
  });

  it("bindDirectoryPicker imposta webkitdirectory", () => {
    const el = { setAttribute: vi.fn(), multiple: false };
    bindDirectoryPicker(el);
    expect(el.setAttribute).toHaveBeenCalledWith("webkitdirectory", "");
    expect(el.setAttribute).toHaveBeenCalledWith("directory", "");
    expect(el.multiple).toBe(true);
  });

  it("takeImportFiles tronca oltre MAX_IMPORT_JOB_FILES", () => {
    const files = Array.from({ length: MAX_IMPORT_JOB_FILES + 3 }, (_, i) => ({
      name: `f${i}.docx`,
    }));
    const out = takeImportFiles(files);
    expect(out.files).toHaveLength(MAX_IMPORT_JOB_FILES);
    expect(out.truncated).toBe(true);
    expect(out.skippedJunk).toBe(0);
  });
});

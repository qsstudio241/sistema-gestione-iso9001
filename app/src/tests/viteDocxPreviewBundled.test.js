import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

describe("vite.config — docx-preview bundlato", () => {
  it("non marca docx-preview come external (altrimenti Visualizza Word è morto in produzione)", () => {
    const src = readFileSync(resolve("vite.config.mjs"), "utf8");
    expect(src).not.toMatch(/external:\s*\(id\)\s*=>\s*id\s*===\s*['"]docx-preview['"]/);
    expect(src).toContain("id.includes('docx-preview')");
    expect(src).toContain("vendor-docx-preview");
  });
});

/**
 * Elenco operativo full-width — contract CSS (HITL post LUX-A).
 * jsdom non valuta il cascade: assert sul sorgente CSS.
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

const SQ_CSS = resolve("src/pages/QualificationsPage.css");
const TWIN_CSS = [
  resolve("src/pages/NCPage.css"),
  resolve("src/pages/ComplianceMapsPage.css"),
  resolve("src/pages/ContractChecklistTemplatesPage.css"),
  resolve("src/components/CompaniesPage.css"),
  resolve("src/pages/DeadlinesPage.css"),
];

/** Blocco regole di un selettore prima del primo @media (desktop base). */
function desktopBlock(css, selector) {
  const mediaIdx = css.search(/@media\s*\(/);
  const head = mediaIdx >= 0 ? css.slice(0, mediaIdx) : css;
  const escaped = selector.replace(/\./g, "\\.");
  const match = head.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  return match ? match[1] : "";
}

function assertFullWidthPageBlock(block, label) {
  expect(block.length, label).toBeGreaterThan(0);
  expect(block, label).not.toMatch(/max-width:\s*1100px/);
  expect(block, label).not.toMatch(/max-width:\s*1400px/);
  const mw = block.match(/max-width:\s*([^;]+)/);
  if (mw) {
    const value = mw[1].trim().toLowerCase();
    expect(
      ["none", "100%", "100vw"].some((ok) => value.startsWith(ok)),
      `${label}: max-width=${value}`
    ).toBe(true);
  }
}

describe("Elenco operativo full-width (.sq-page + gemelli)", () => {
  it("desktop: .sq-page non è limitato a max-width 1100px", () => {
    const css = readFileSync(SQ_CSS, "utf8");
    assertFullWidthPageBlock(desktopBlock(css, ".sq-page"), ".sq-page");
    expect(desktopBlock(css, ".sq-page")).toMatch(/width:\s*100%/);
  });

  it("gemelli elenco (NC, CM, CCT, Companies, Deadlines) full-width", () => {
    const selectors = [
      ".nc-page",
      ".cm-page",
      ".cct-page",
      ".companies-page",
      ".dl-page",
    ];
    TWIN_CSS.forEach((path, i) => {
      const css = readFileSync(path, "utf8");
      assertFullWidthPageBlock(desktopBlock(css, selectors[i]), selectors[i]);
    });
  });

  it("form/dettaglio stretti restano con cap 1100 (non toccati)", () => {
    const rdp = readFileSync(resolve("src/pages/RDPModule.css"), "utf8");
    const ndt = readFileSync(resolve("src/pages/NdtReportsPage.css"), "utf8");
    expect(rdp).toMatch(/\.rdp-form-page\s*\{[^}]*max-width:\s*1100px/s);
    expect(ndt).toMatch(/\.ndt-form-page\s*\{[^}]*max-width:\s*1100px/s);
  });
});

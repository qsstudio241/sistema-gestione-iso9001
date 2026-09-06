/**
 * LUX-A — contract CSS: Libreria full-width (no cap 1100px desktop).
 * jsdom non valuta il cascade: assert sul sorgente CSS.
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

const CSS_PATH = resolve("src/pages/NormLibraryPage.css");

/** Blocco regole di `.nl-page` prima del primo @media (desktop base). */
function desktopNlPageBlock(css) {
  const mediaIdx = css.search(/@media\s*\(/);
  const head = mediaIdx >= 0 ? css.slice(0, mediaIdx) : css;
  const match = head.match(/\.nl-page\s*\{([^}]*)\}/);
  return match ? match[1] : "";
}

/** Corpo del primo @media (max-width: 768px). */
function mobileMediaBody(css) {
  const start = css.search(/@media\s*\(max-width:\s*768px\)\s*\{/);
  if (start < 0) return "";
  const openBrace = css.indexOf("{", start);
  let depth = 0;
  for (let i = openBrace; i < css.length; i += 1) {
    if (css[i] === "{") depth += 1;
    else if (css[i] === "}") {
      depth -= 1;
      if (depth === 0) return css.slice(openBrace + 1, i);
    }
  }
  return "";
}

describe("NormLibraryPage full-width (LUX-A)", () => {
  it("desktop: .nl-page non è più limitato a max-width 1100px", () => {
    const css = readFileSync(CSS_PATH, "utf8");
    const block = desktopNlPageBlock(css);
    expect(block.length).toBeGreaterThan(0);
    expect(block).not.toMatch(/max-width:\s*1100px/);
    // Accetta none / 100% / assenza di cap stretto
    const mw = block.match(/max-width:\s*([^;]+)/);
    if (mw) {
      const value = mw[1].trim().toLowerCase();
      expect(
        ["none", "100%", "100vw"].some((ok) => value.startsWith(ok))
      ).toBe(true);
    }
  });

  it("testo header resta leggibile (max-width 52rem); digitize non forzato a full-bleed", () => {
    const css = readFileSync(CSS_PATH, "utf8");
    expect(css).toMatch(/\.nl-header p\s*\{[^}]*max-width:\s*52rem/s);
    // Non allargare forzatamente il form digitize (niente width:100% / max-width:none sul form)
    const digMatch = css.match(/\.nl-digitize-form\s*\{([^}]*)\}/);
    expect(digMatch).toBeTruthy();
    expect(digMatch[1]).not.toMatch(/max-width:\s*none/);
    expect(digMatch[1]).not.toMatch(/width:\s*100%/);
  });

  it("mobile ≤768px: media ancora presente con .nl-page e stack colonna", () => {
    const css = readFileSync(CSS_PATH, "utf8");
    expect(css).toMatch(/@media\s*\(max-width:\s*768px\)/);
    const mediaBody = mobileMediaBody(css);
    expect(mediaBody.length).toBeGreaterThan(0);
    expect(mediaBody).toMatch(/\.nl-page\s*\{[^}]*max-width:\s*100%/s);
    expect(mediaBody).toMatch(/\.nl-header\s*\{[^}]*flex-direction:\s*column/s);
    expect(mediaBody).toMatch(/-webkit-overflow-scrolling:\s*touch/);
  });
});

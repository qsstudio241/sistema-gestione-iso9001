/**
 * @vitest-environment node
 *
 * jsdom non valuta le media query: si legge il CSS e si verifica che il blocco
 * mobile (≤768px) eviti overflow/sovrapposizioni su header, footer e Assistente.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";

function readCss(relPath) {
  return readFileSync(resolve(process.cwd(), relPath), "utf8");
}

/** Primo blocco `@media (max-width: 768px)` (o 700/640 se indicato). */
function firstMedia(css, marker = "@media (max-width: 768px)") {
  const start = css.indexOf(marker);
  if (start < 0) return "";
  const from = css.slice(start);
  const open = from.indexOf("{");
  let depth = 0;
  for (let i = open; i < from.length; i += 1) {
    if (from[i] === "{") depth += 1;
    else if (from[i] === "}") {
      depth -= 1;
      if (depth === 0) return from.slice(0, i + 1);
    }
  }
  return from;
}

describe("Chrome mobile — scroll e spazio", () => {
  it("AppLayout nasconde il footer e lascia spazio alla bottom nav", () => {
    const css = readCss("src/layouts/AppLayout.css");
    const media = firstMedia(css);
    expect(media).toContain("@media (max-width: 768px)");
    expect(media).toMatch(/\.layout-footer\s*\{\s*display:\s*none/);
    expect(media).toMatch(/padding-bottom:\s*calc\(var\(--bottom-nav-height\)/);
    expect(media).toContain("safe-area-inset-bottom");
    expect(media).toMatch(/\.layout-scope-select[\s\S]*min-width:\s*0/);
    expect(media).toMatch(/overflow-x:\s*hidden/);
  });

  it("Assistente AI non usa più un'altezza calc(100vh) sul mobile", () => {
    const css = readCss("src/pages/AiAssistantPage.css");
    const media = firstMedia(css);
    expect(media).toContain("@media (max-width: 768px)");
    expect(media).toMatch(/\.ai-assistant-page[\s\S]*height:\s*auto/);
    expect(media).toMatch(/\.ai-assistant-page[\s\S]*overflow:\s*visible/);
    expect(media).not.toMatch(/height:\s*calc\(100vh/);
    expect(media).toMatch(/\.ai-assistant-input-area[\s\S]*position:\s*sticky/);
    expect(media).toMatch(/\.af-nav-actions[\s\S]*grid-template-columns:\s*1fr 1fr/);
  });

  it("card KPI Qualifiche/NC/Scadenzari vanno in griglia 2 colonne", () => {
    const sq = firstMedia(readCss("src/pages/QualificationsPage.css"), "@media (max-width:700px)");
    const nc = firstMedia(readCss("src/pages/NCPage.css"), "@media (max-width: 640px)");
    const dl = firstMedia(readCss("src/pages/DeadlinesPage.css"));
    expect(sq).toMatch(/\.sq-stats-bar[\s\S]*grid-template-columns:\s*repeat\(2/);
    expect(nc).toMatch(/\.nc-stats-bar[\s\S]*grid-template-columns:\s*repeat\(2/);
    expect(dl).toMatch(/\.dl-stats-bar[\s\S]*grid-template-columns:\s*repeat\(2/);
  });

  it("tab in-page restano scrollabili in orizzontale", () => {
    const shared = firstMedia(readCss("src/components/SharedComponents.css"));
    expect(shared).toMatch(/\.tabs-container[\s\S]*overflow-x:\s*auto/);
    const anag = readCss("src/pages/AnagrafichePage.css");
    expect(anag).toMatch(/\.tab-nav[\s\S]*overflow-x:\s*auto/);
    const risks = readCss("src/pages/RisksPage.css");
    expect(risks).toMatch(/\.risks-tabs[\s\S]*overflow-x:\s*auto/);
  });
});

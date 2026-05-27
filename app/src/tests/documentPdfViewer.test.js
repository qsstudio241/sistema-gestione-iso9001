import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { prefersMobilePdfFallback, openPdfBlob } from "../components/DocumentPdfViewer";

describe("prefersMobilePdfFallback", () => {
  const originalMatchMedia = window.matchMedia;

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    vi.restoreAllMocks();
  });

  it("ritorna true con pointer coarse (tipico mobile)", () => {
    window.matchMedia = vi.fn((query) => ({
      matches: query === "(pointer: coarse)",
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    expect(prefersMobilePdfFallback()).toBe(true);
  });

  it("ritorna false su desktop senza touch", () => {
    window.matchMedia = vi.fn(() => ({
      matches: false,
      media: "",
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    Object.defineProperty(navigator, "userAgent", {
      value: "Mozilla/5.0 (Windows NT 10.0)",
      configurable: true,
    });
    expect(prefersMobilePdfFallback()).toBe(false);
  });
});

describe("openPdfBlob", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("usa link in nuova scheda se share non disponibile", async () => {
    const blob = new Blob(["%PDF"], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click");

    await openPdfBlob(blob, url, "test.pdf");

    expect(clickSpy).toHaveBeenCalled();
    URL.revokeObjectURL(url);
  });
});

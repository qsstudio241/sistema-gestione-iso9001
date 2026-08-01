import { describe, it, expect } from "vitest";
import { resolveBackendUploadUrl } from "../utils/resolveBackendUploadUrl.js";

describe("resolveBackendUploadUrl", () => {
  const api = "https://sistemi.fr-busato.it:8443/api/v1";

  it("converte /uploads/... in URL assoluto backend (bug link certificato su Netlify)", () => {
    expect(
      resolveBackendUploadUrl(
        "/uploads/qualifications/qual_1785590838566_PRS-2136-25-ITA-DNV.pdf",
        api
      )
    ).toBe(
      "https://sistemi.fr-busato.it:8443/uploads/qualifications/qual_1785590838566_PRS-2136-25-ITA-DNV.pdf"
    );
  });

  it("accetta path senza slash iniziale e lascia invariati gli URL assoluti", () => {
    expect(resolveBackendUploadUrl("uploads/x.pdf", api)).toBe(
      "https://sistemi.fr-busato.it:8443/uploads/x.pdf"
    );
    expect(resolveBackendUploadUrl("https://cdn.example/a.pdf", api)).toBe(
      "https://cdn.example/a.pdf"
    );
  });

  it("restituisce null per valori vuoti", () => {
    expect(resolveBackendUploadUrl(null, api)).toBeNull();
    expect(resolveBackendUploadUrl("", api)).toBeNull();
  });
});

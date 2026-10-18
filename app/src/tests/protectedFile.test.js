import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  isUploadsPath,
  buildProtectedFileUrl,
  protectedFileName,
  fileNameWithExt,
  protectedFileErrorMessage,
} from "../utils/protectedFile.js";
import apiService, { ApiError } from "../services/apiService";

const API = "https://sistemi.fr-busato.it:8443/api/v1";

describe("protectedFile utils", () => {
  it("riconosce solo percorsi interni /uploads", () => {
    expect(isUploadsPath("/uploads/qualifications/a.pdf")).toBe(true);
    expect(isUploadsPath("uploads/a.pdf")).toBe(true);
    expect(isUploadsPath("https://x.test/uploads/a.pdf")).toBe(false);
    expect(isUploadsPath("/api/v1/files/a.pdf")).toBe(false);
    expect(isUploadsPath(null)).toBe(false);
    expect(isUploadsPath("")).toBe(false);
  });

  it("buildProtectedFileUrl punta alla rotta autenticata, mai a /uploads", () => {
    const url = buildProtectedFileUrl("/uploads/qualifications/qual_1_x.pdf", API);
    expect(url).toBe(`${API}/files/content?path=${encodeURIComponent("/uploads/qualifications/qual_1_x.pdf")}`);
    expect(url).not.toMatch(/https:\/\/[^/]+\/uploads\//);
    expect(buildProtectedFileUrl("uploads/a.pdf", `${API}/`)).toBe(
      `${API}/files/content?path=${encodeURIComponent("/uploads/a.pdf")}`,
    );
  });

  it("buildProtectedFileUrl restituisce null per valori non interni o vuoti", () => {
    expect(buildProtectedFileUrl("https://cdn.example/a.pdf", API)).toBeNull();
    expect(buildProtectedFileUrl(null, API)).toBeNull();
    expect(buildProtectedFileUrl("", API)).toBeNull();
  });

  it("nome download = tipo + id (+ estensione dal MIME), senza PII", () => {
    expect(protectedFileName("qualifica", 12, "application/pdf")).toBe("qualifica-12.pdf");
    expect(protectedFileName("wpqr", 7, "image/jpeg")).toBe("wpqr-7.jpg");
    expect(protectedFileName("materiale", 3)).toBe("materiale-3");
    expect(protectedFileName("qualifica", "Mario Rossi/../x")).toBe("qualifica-MarioRossix");
    expect(fileNameWithExt("qualifica-12", "application/pdf")).toBe("qualifica-12.pdf");
    expect(fileNameWithExt("verbale.pdf", "application/pdf")).toBe("verbale.pdf");
  });

  it("messaggi di errore per 401/403/404/rete", () => {
    expect(protectedFileErrorMessage(401)).toMatch(/accedi di nuovo/i);
    expect(protectedFileErrorMessage(403)).toMatch(/permessi/i);
    expect(protectedFileErrorMessage(404)).toMatch(/non trovato/i);
    expect(protectedFileErrorMessage(0)).toMatch(/connessione/i);
    expect(protectedFileErrorMessage(500)).toMatch(/riprova/i);
  });
});

describe("apiService.fetchProtectedFileBlob", () => {
  const realFetch = globalThis.fetch;

  beforeEach(() => {
    vi.spyOn(apiService, "getToken").mockReturnValue("tok-123");
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
    vi.restoreAllMocks();
  });

  function jsonResponse(status, body) {
    return { ok: status >= 200 && status < 300, status, json: async () => body, blob: async () => new Blob(["x"]) };
  }

  it("invia Authorization Bearer e il path in query, restituisce il blob", async () => {
    const blob = new Blob(["%PDF"], { type: "application/pdf" });
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, blob: async () => blob });
    const out = await apiService.fetchProtectedFileBlob("/uploads/qualifications/a.pdf");
    expect(out).toBe(blob);
    const [url, init] = globalThis.fetch.mock.calls[0];
    expect(url).toBe(`${apiService.baseUrl}/files/content?path=${encodeURIComponent("/uploads/qualifications/a.pdf")}`);
    expect(init.headers.Authorization).toBe("Bearer tok-123");
    expect(init.cache).toBe("no-store");
  });

  it("percorso non /uploads: 400 senza chiamare la rete", async () => {
    globalThis.fetch = vi.fn();
    await expect(apiService.fetchProtectedFileBlob("https://x.test/a.pdf")).rejects.toMatchObject({
      status: 400,
      code: "INVALID_FILE_PATH",
    });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it.each([403, 404, 500])("errore %s propagato come ApiError con status", async (status) => {
    globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse(status, { error: "no", code: "X" }));
    const err = await apiService.fetchProtectedFileBlob("/uploads/a.pdf").catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(status);
  });

  it("401: un solo refresh token poi riprova e riesce", async () => {
    const refresh = vi.spyOn(apiService, "refreshToken").mockResolvedValue(true);
    const blob = new Blob(["ok"]);
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(401, { error: "scaduto" }))
      .mockResolvedValueOnce({ ok: true, status: 200, blob: async () => blob });
    const out = await apiService.fetchProtectedFileBlob("/uploads/a.pdf");
    expect(out).toBe(blob);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  it("401 con refresh fallito: ApiError 401", async () => {
    vi.spyOn(apiService, "refreshToken").mockResolvedValue(false);
    globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse(401, { error: "scaduto" }));
    const err = await apiService.fetchProtectedFileBlob("/uploads/a.pdf").catch((e) => e);
    expect(err.status).toBe(401);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it("errore di rete: ApiError status 0", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    const err = await apiService.fetchProtectedFileBlob("/uploads/a.pdf").catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(0);
  });
});

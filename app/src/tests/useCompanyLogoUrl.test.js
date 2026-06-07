import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useCompanyLogoUrl } from "../hooks/useCompanyLogoUrl";

vi.mock("../services/apiService", () => ({
  default: {
    baseUrl: "https://api.test/api/v1",
    getToken: () => "test-token",
    getCompanyLogoUrl: (id) => `https://api.test/companies/${id}/logo`,
  },
}));

describe("useCompanyLogoUrl", () => {
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;

  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => "blob:logo-test");
    URL.revokeObjectURL = vi.fn();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(new Blob(["x"], { type: "image/png" })),
    });
  });

  afterEach(() => {
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    vi.restoreAllMocks();
  });

  it("restituisce null senza logo_url", () => {
    const { result } = renderHook(() => useCompanyLogoUrl(42, null, 0));
    expect(result.current).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("carica il logo con Authorization header", async () => {
    const { result } = renderHook(() =>
      useCompanyLogoUrl(42, "logos/logo_42.png", 123)
    );

    await waitFor(() => {
      expect(result.current).toBe("blob:logo-test");
    });

    expect(fetch).toHaveBeenCalledWith(
      "https://api.test/companies/42/logo?t=123",
      {
        headers: { Authorization: "Bearer test-token" },
      }
    );
  });

  it("usa fallback legacy quando endpoint principale non ritorna immagine", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: () => "text/html; charset=utf-8" },
        blob: () => Promise.resolve(new Blob(["<html>login</html>"], { type: "text/html" })),
      })
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: () => "image/png" },
        blob: () => Promise.resolve(new Blob(["x"], { type: "image/png" })),
      });

    const { result } = renderHook(() =>
      useCompanyLogoUrl(42, "logos/logo_42.png", 0)
    );

    await waitFor(() => {
      expect(result.current).toBe("blob:logo-test");
    });

    expect(fetch).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("https://api.test/uploads/logos/logo_42.png"),
      {
        headers: { Authorization: "Bearer test-token" },
      }
    );
  });
});

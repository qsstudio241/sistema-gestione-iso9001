/**
 * getCompanies deve applicare limit=500 di default (menu Ambito / dropdown anagrafiche).
 * Il backend GET /companies ha default 50: senza override le aziende oltre la 50ª spariscono.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import apiService from "../services/apiService";

describe("apiService.getCompanies — default limit", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("aggiunge limit=500 se non specificato", async () => {
    const spy = vi.spyOn(apiService, "get").mockResolvedValue({ data: [] });
    await apiService.getCompanies();
    expect(spy).toHaveBeenCalledWith("/companies?limit=500");
  });

  it("mantiene limit=500 insieme ad altri filtri", async () => {
    const spy = vi.spyOn(apiService, "get").mockResolvedValue({ data: [] });
    await apiService.getCompanies({ auditor_org_id: 12 });
    const url = spy.mock.calls[0][0];
    expect(url).toContain("limit=500");
    expect(url).toContain("auditor_org_id=12");
  });

  it("rispetta un limit esplicito più basso (paginazione)", async () => {
    const spy = vi.spyOn(apiService, "get").mockResolvedValue({ data: [] });
    await apiService.getCompanies({ limit: 50, page: 2 });
    const url = spy.mock.calls[0][0];
    expect(url).toContain("limit=50");
    expect(url).not.toContain("limit=500");
    expect(url).toContain("page=2");
  });
});

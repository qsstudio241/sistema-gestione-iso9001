import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  APP_COMPANY_SCOPE_KEY,
  resolveAppCompanyScope,
  readStoredAppCompanyScope,
  persistAppCompanyScope,
  isCompanyScopeLocked,
  sanitizeScopeAgainstCompanies,
} from "../utils/appCompanyScope";

const admin = { role: "admin", organization_id: 1001, company_access: [] };
const superadmin = { role: "superadmin", organization_id: 1001, company_access: [] };
const lockedClient = {
  role: "viewer",
  organization_id: 1001,
  company_access: [{ company_id: 47, permission: "write" }],
};
const multiClient = {
  role: "viewer",
  organization_id: 1001,
  company_access: [
    { company_id: 11, permission: "read" },
    { company_id: 47, permission: "write" },
  ],
};

describe("appCompanyScope", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", {
      store: {},
      getItem(key) {
        return this.store[key] ?? null;
      },
      setItem(key, val) {
        this.store[key] = String(val);
      },
      removeItem(key) {
        delete this.store[key];
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("admin senza preferenza -> tutto lo studio", () => {
    expect(resolveAppCompanyScope(admin)).toBe("");
    expect(isCompanyScopeLocked(admin)).toBe(false);
  });

  it("superadmin senza preferenza -> tutto lo studio", () => {
    expect(resolveAppCompanyScope(superadmin)).toBe("");
  });

  it("admin con preferenza salvata la ripristina", () => {
    persistAppCompanyScope(1001, "47");
    expect(resolveAppCompanyScope(admin)).toBe("47");
  });

  it("preferenza di un altro tenant viene ignorata", () => {
    persistAppCompanyScope(9999, "47");
    expect(readStoredAppCompanyScope(1001)).toBe("");
    expect(resolveAppCompanyScope(admin)).toBe("");
  });

  it("cliente con una sola azienda: sempre quella, locked", () => {
    persistAppCompanyScope(1001, "");
    expect(isCompanyScopeLocked(lockedClient)).toBe(true);
    expect(resolveAppCompanyScope(lockedClient)).toBe("47");
  });

  it("cliente multi-azienda: non puo' stare su tutto lo studio", () => {
    expect(resolveAppCompanyScope(multiClient)).toBe("11");
    persistAppCompanyScope(1001, "47");
    expect(resolveAppCompanyScope(multiClient)).toBe("47");
    persistAppCompanyScope(1001, "99");
    expect(resolveAppCompanyScope(multiClient)).toBe("11");
  });

  it("sanitize: id inesistente per admin torna a tutto lo studio", () => {
    expect(sanitizeScopeAgainstCompanies(admin, "47", [{ id: 11 }])).toBe("");
    expect(sanitizeScopeAgainstCompanies(admin, "11", [{ id: 11 }])).toBe("11");
  });

  it("sanitize: lista ancora vuota non azzera l'id (caricamento in corso)", () => {
    expect(sanitizeScopeAgainstCompanies(admin, "47", [])).toBe("47");
  });

  it("sanitize non toglie l'azienda a un cliente locked", () => {
    expect(sanitizeScopeAgainstCompanies(lockedClient, "47", [])).toBe("47");
  });

  it("sanitize: cliente con id non permesso torna alla primaria", () => {
    expect(sanitizeScopeAgainstCompanies(multiClient, "99", [{ id: 99 }])).toBe("11");
  });

  it("persist vuoto salva company_id vuoto", () => {
    persistAppCompanyScope(1001, "");
    const raw = JSON.parse(localStorage.getItem(APP_COMPANY_SCOPE_KEY));
    expect(raw.company_id).toBe("");
    expect(raw.organization_id).toBe(1001);
  });

  it("migra l'azienda dalla chiave Qualifiche se manca la chiave globale", () => {
    localStorage.setItem("sgq-qualifications-company-scope", "47");
    expect(readStoredAppCompanyScope(1001)).toBe("47");
    const raw = JSON.parse(localStorage.getItem(APP_COMPANY_SCOPE_KEY));
    expect(raw.company_id).toBe("47");
    expect(raw.organization_id).toBe(1001);
    expect(resolveAppCompanyScope(admin)).toBe("47");
  });

  it("non sovrascrive Tutto lo studio se la chiave globale esiste gia'", () => {
    persistAppCompanyScope(1001, "");
    localStorage.setItem("sgq-qualifications-company-scope", "47");
    expect(readStoredAppCompanyScope(1001)).toBe("");
    expect(resolveAppCompanyScope(admin)).toBe("");
  });

  it("ignora chiavi legacy vuote o 'studio' e prende il primo id numerico", () => {
    localStorage.setItem("sgq-qualifications-company-scope", "");
    localStorage.setItem("sgq-projects-company-scope", "studio");
    localStorage.setItem("sgq-sal-company-scope", "11");
    expect(readStoredAppCompanyScope(1001)).toBe("11");
  });
});

import { describe, it, expect } from "vitest";
import {
  resolveNumericCompanyScope,
  auditMatchesCompanyScope,
} from "./auditCompanyScope";

function audit({ companyId, clientName }) {
  return { metadata: { companyId, clientName } };
}

describe("resolveNumericCompanyScope", () => {
  it("Tutto lo studio e Patrimonio non sono un tenant numerico", () => {
    expect(resolveNumericCompanyScope("")).toBeNull();
    expect(resolveNumericCompanyScope(null)).toBeNull();
    expect(resolveNumericCompanyScope("studio")).toBeNull();
  });

  it("Ambito azienda restituisce l'id numerico", () => {
    expect(resolveNumericCompanyScope("11")).toBe(11);
    expect(resolveNumericCompanyScope(11)).toBe(11);
  });
});

describe("auditMatchesCompanyScope", () => {
  const mason = audit({ companyId: 11, clientName: "Mason Demo" });
  const admin = audit({ companyId: 20, clientName: "Admin_test" });
  const legacy = audit({ companyId: null, clientName: "Admin_test" });

  it("Tutto lo studio: tutti gli audit", () => {
    expect(auditMatchesCompanyScope(mason, "")).toBe(true);
    expect(auditMatchesCompanyScope(admin, "")).toBe(true);
    expect(auditMatchesCompanyScope(legacy, "")).toBe(true);
  });

  it("Ambito azienda: solo quella company_id", () => {
    expect(auditMatchesCompanyScope(mason, "11")).toBe(true);
    expect(auditMatchesCompanyScope(admin, "11")).toBe(false);
    expect(auditMatchesCompanyScope(admin, "20")).toBe(true);
  });

  it("audit legacy senza company_id: match sul nome Ambito", () => {
    expect(
      auditMatchesCompanyScope(legacy, "20", { scopeCompanyName: "Admin_test" })
    ).toBe(true);
    expect(
      auditMatchesCompanyScope(legacy, "11", { scopeCompanyName: "Mason Demo" })
    ).toBe(false);
  });

  it("se c'è company_id, il nome non sovrascrive il tenant", () => {
    expect(
      auditMatchesCompanyScope(admin, "11", { scopeCompanyName: "Admin_test" })
    ).toBe(false);
  });

  it("Patrimonio studio: nessun audit cliente", () => {
    expect(auditMatchesCompanyScope(mason, "studio")).toBe(false);
  });
});

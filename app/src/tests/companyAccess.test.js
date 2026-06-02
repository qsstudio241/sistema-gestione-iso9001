import { describe, it, expect } from "vitest";
import {
  hasCompanyAccess,
  canEditCompany,
  getPrimaryCompanyId,
  getCompanyPermission,
} from "../utils/companyAccess";

describe("companyAccess utils", () => {
  const writeClient = {
    role: "viewer",
    company_access: [{ company_id: 11, permission: "write" }],
  };
  const readClient = {
    role: "viewer",
    company_access: [{ company_id: 11, permission: "read" }],
  };

  it("hasCompanyAccess true con righe", () => {
    expect(hasCompanyAccess(writeClient)).toBe(true);
    expect(hasCompanyAccess({ role: "auditor" })).toBe(false);
  });

  it("canEditCompany rispetta permission write/read", () => {
    expect(canEditCompany(writeClient, 11)).toBe(true);
    expect(canEditCompany(readClient, 11)).toBe(false);
    expect(canEditCompany({ role: "auditor" }, 11)).toBe(true);
    expect(canEditCompany({ role: "viewer" }, 11)).toBe(false);
  });

  it("getPrimaryCompanyId restituisce prima company", () => {
    expect(getPrimaryCompanyId(writeClient)).toBe(11);
    expect(getCompanyPermission(readClient, 11)).toBe("read");
  });
});

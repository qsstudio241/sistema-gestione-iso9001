/**
 * Test L1 — licenseUtils.hasLicensedModule
 * Bridge P0 gap ISO 3834: saldatura implica accesso a cnd.
 */
import { describe, it, expect } from "vitest";
import { hasLicensedModule } from "../utils/licenseUtils";

describe("hasLicensedModule", () => {
  it("licensed_modules assente = tutti i moduli attivi (retrocompatibilit\u00e0)", () => {
    expect(hasLicensedModule({}, "cnd")).toBe(true);
    expect(hasLicensedModule({ licensed_modules: [] }, "cnd")).toBe(true);
  });

  it("restituisce true se la chiave e' direttamente nella lista", () => {
    const user = { licensed_modules: ["audit", "cnd"] };
    expect(hasLicensedModule(user, "cnd")).toBe(true);
  });

  it("restituisce false se la chiave non e' presente e non e' implicita", () => {
    const user = { licensed_modules: ["audit", "nc"] };
    expect(hasLicensedModule(user, "cnd")).toBe(false);
  });

  it("bridge P0: 'saldatura' implica accesso a 'cnd' anche senza licenza cnd esplicita", () => {
    const user = { licensed_modules: ["audit", "saldatura"] };
    expect(hasLicensedModule(user, "cnd")).toBe(true);
    // saldatura resta comunque visibile
    expect(hasLicensedModule(user, "saldatura")).toBe(true);
  });

  it("'cnd' standalone NON implica 'saldatura' (relazione a senso unico)", () => {
    const user = { licensed_modules: ["audit", "cnd"] };
    expect(hasLicensedModule(user, "saldatura")).toBe(false);
  });
});

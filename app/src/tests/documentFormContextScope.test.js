import { describe, it, expect } from "vitest";
import { resolveRegistryFormContextScope } from "../utils/documentFormContextScope";

describe("resolveRegistryFormContextScope", () => {
  const companies = [
    { id: 16, name: "FP MODENA" },
    { company_id: 42, name: "DNV" },
  ];

  it("blocca ambito Patrimonio Studio", () => {
    const scope = resolveRegistryFormContextScope({
      registryCompanyScope: "studio",
      isStudioScope: true,
      companies,
    });
    expect(scope).toEqual({
      locked: true,
      content_scope: "studio",
      company_id: null,
      label: "Patrimonio Studio",
    });
  });

  it("blocca ambito azienda cliente dal filtro registro", () => {
    const scope = resolveRegistryFormContextScope({
      registryCompanyScope: "16",
      isStudioScope: false,
      companies,
    });
    expect(scope).toEqual({
      locked: true,
      content_scope: "client",
      company_id: 16,
      label: "FP MODENA",
    });
  });

  it("non blocca con Tutto lo studio", () => {
    const scope = resolveRegistryFormContextScope({
      registryCompanyScope: "",
      isStudioScope: false,
      companies,
    });
    expect(scope).toEqual({ locked: false });
  });
});

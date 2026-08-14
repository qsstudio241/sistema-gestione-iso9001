/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const authState = {
  user: { role: "admin", organization_name: "Al.project", company_access: [] },
};

const scopeState = {
  companyId: "",
  setCompanyId: () => {},
  companies: [{ id: 11, name: "C.M.P. SRL" }],
  locked: false,
  companyScoped: false,
  scopeCompanyName: "Tutto lo studio",
};

vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => authState,
}));

vi.mock("../contexts/CompanyScopeContext", () => ({
  useCompanyScope: () => scopeState,
}));

import CompanyScopeSelect from "../components/CompanyScopeSelect.jsx";

function optionLabels() {
  return screen.getAllByRole("option").map((el) => el.textContent);
}

describe("CompanyScopeSelect", () => {
  it("mostra etichetta Ambito e menu anche se la lista aziende e' ancora vuota", () => {
    scopeState.companies = [];
    scopeState.companyScoped = false;
    authState.user = { role: "admin", organization_name: "Al.project", company_access: [] };
    render(<CompanyScopeSelect />);
    expect(screen.getByText("Ambito")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Ambito azienda" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Tutto lo studio" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Patrimonio dello studio" })).not.toBeInTheDocument();
  });

  it("personale studio: Tutto lo studio, Patrimonio, poi aziende A-Z senza il nome anagrafica", () => {
    scopeState.companies = [
      { id: 3, name: "Zebra Spa" },
      { id: 1, name: "Al.project" },
      { id: 2, name: "ADA Azienda Test Fase 1" },
    ];
    scopeState.companyScoped = false;
    authState.user = { role: "admin", organization_name: "Al.project", company_access: [] };
    render(<CompanyScopeSelect />);
    expect(optionLabels()).toEqual([
      "Tutto lo studio",
      "Patrimonio dello studio",
      "ADA Azienda Test Fase 1",
      "Zebra Spa",
    ]);
    expect(screen.queryByRole("option", { name: "Al.project" })).not.toBeInTheDocument();
  });

  it("senza azienda con lo stesso nome del tenant: niente Patrimonio, aziende A-Z", () => {
    scopeState.companies = [
      { id: 2, name: "Zebra Spa" },
      { id: 1, name: "ADA Azienda Test Fase 1" },
    ];
    scopeState.companyScoped = false;
    authState.user = { role: "admin", organization_name: "Al.project", company_access: [] };
    render(<CompanyScopeSelect />);
    expect(optionLabels()).toEqual(["Tutto lo studio", "ADA Azienda Test Fase 1", "Zebra Spa"]);
    expect(screen.queryByRole("option", { name: "Patrimonio dello studio" })).not.toBeInTheDocument();
  });

  it("utente company_access: niente Tutto lo studio ne' Patrimonio", () => {
    scopeState.companies = [
      { id: 11, name: "C.M.P. SRL" },
      { id: 1, name: "Al.project" },
    ];
    scopeState.companyScoped = true;
    authState.user = {
      role: "viewer",
      organization_name: "Al.project",
      company_access: [{ company_id: 11 }],
    };
    render(<CompanyScopeSelect />);
    expect(screen.queryByRole("option", { name: "Tutto lo studio" })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Patrimonio dello studio" })).not.toBeInTheDocument();
    expect(optionLabels()).toEqual(["Al.project", "C.M.P. SRL"]);
  });
});

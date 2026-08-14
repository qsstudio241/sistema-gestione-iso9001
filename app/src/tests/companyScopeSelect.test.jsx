/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

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

async function openAndLabels(user) {
  await user.click(screen.getByRole("combobox", { name: "Ambito azienda" }));
  return screen.getAllByRole("option").map((el) => el.textContent);
}

describe("CompanyScopeSelect", () => {
  it("mostra etichetta Ambito e menu anche se la lista aziende e' ancora vuota", async () => {
    const user = userEvent.setup();
    scopeState.companies = [];
    scopeState.companyScoped = false;
    authState.user = { role: "admin", organization_name: "Al.project", company_access: [] };
    render(<CompanyScopeSelect />);
    expect(screen.getByText("Ambito")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Ambito azienda" })).toBeInTheDocument();
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
    await user.click(screen.getByRole("combobox", { name: "Ambito azienda" }));
    expect(screen.getByRole("option", { name: "Tutto lo studio" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Patrimonio dello studio" })).toHaveAttribute(
      "data-value",
      "studio"
    );
  });

  it("personale studio: Tutto lo studio, Patrimonio, poi aziende A-Z senza il nome anagrafica", async () => {
    const user = userEvent.setup();
    scopeState.companies = [
      { id: 3, name: "Zebra Spa" },
      { id: 1, name: "Al.project" },
      { id: 2, name: "ADA Azienda Test Fase 1" },
    ];
    scopeState.companyScoped = false;
    authState.user = { role: "admin", organization_name: "Al.project", company_access: [] };
    render(<CompanyScopeSelect />);
    expect(await openAndLabels(user)).toEqual([
      "Tutto lo studio",
      "Patrimonio dello studio",
      "ADA Azienda Test Fase 1",
      "Zebra Spa",
    ]);
    expect(screen.queryByRole("option", { name: "Al.project" })).not.toBeInTheDocument();
  });

  it("senza azienda omonima: Patrimonio resta visibile con valore studio", async () => {
    const user = userEvent.setup();
    scopeState.companies = [
      { id: 2, name: "Zebra Spa" },
      { id: 1, name: "ADA Azienda Test Fase 1" },
    ];
    scopeState.companyScoped = false;
    authState.user = { role: "admin", organization_name: "Al.project", company_access: [] };
    render(<CompanyScopeSelect />);
    expect(await openAndLabels(user)).toEqual([
      "Tutto lo studio",
      "Patrimonio dello studio",
      "ADA Azienda Test Fase 1",
      "Zebra Spa",
    ]);
    expect(screen.getByRole("option", { name: "Patrimonio dello studio" })).toHaveAttribute(
      "data-value",
      "studio"
    );
  });

  it("utente company_access: niente Tutto lo studio ne' Patrimonio", async () => {
    const user = userEvent.setup();
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
    const labels = await openAndLabels(user);
    expect(screen.queryByRole("option", { name: "Tutto lo studio" })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Patrimonio dello studio" })).not.toBeInTheDocument();
    expect(labels).toEqual(["Al.project", "C.M.P. SRL"]);
  });

  it("utente locked: testo fisso, niente combobox", () => {
    scopeState.locked = true;
    scopeState.scopeCompanyName = "C.M.P. SRL";
    render(<CompanyScopeSelect />);
    expect(screen.getByText("Ambito")).toBeInTheDocument();
    expect(screen.getByLabelText("Ambito azienda non modificabile")).toHaveTextContent("C.M.P. SRL");
    expect(screen.queryByRole("combobox", { name: "Ambito azienda" })).not.toBeInTheDocument();
    scopeState.locked = false;
  });

  it("con companyId studio mostra Patrimonio, non Tutto, se esiste l'azienda-studio", () => {
    scopeState.companyId = "studio";
    scopeState.companies = [
      { id: 1, name: "Al.project" },
      { id: 2, name: "ADA Azienda Test Fase 1" },
    ];
    scopeState.companyScoped = false;
    authState.user = { role: "admin", organization_name: "Al.project", company_access: [] };
    render(<CompanyScopeSelect />);
    expect(screen.getByRole("combobox", { name: "Ambito azienda" })).toHaveValue(
      "Patrimonio dello studio"
    );
    scopeState.companyId = "";
  });

  it("digitando si filtrano le voci per etichetta", async () => {
    const user = userEvent.setup();
    const setCompanyId = vi.fn();
    scopeState.setCompanyId = setCompanyId;
    scopeState.companies = [
      { id: 3, name: "Zebra Spa" },
      { id: 2, name: "ADA Azienda Test Fase 1" },
    ];
    scopeState.companyScoped = false;
    authState.user = { role: "admin", organization_name: "Al.project", company_access: [] };
    render(<CompanyScopeSelect />);
    const combo = screen.getByRole("combobox", { name: "Ambito azienda" });
    await user.click(combo);
    await user.type(combo, "ada");
    expect(screen.getAllByRole("option").map((el) => el.textContent)).toEqual([
      "ADA Azienda Test Fase 1",
    ]);
    await user.click(screen.getByRole("option", { name: "ADA Azienda Test Fase 1" }));
    expect(setCompanyId).toHaveBeenCalledWith("2");
  });
});

/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const scopeState = {
  companyId: "",
  setCompanyId: () => {},
  companies: [{ id: 11, name: "C.M.P. SRL" }],
  locked: false,
  companyScoped: false,
  scopeCompanyName: "Tutto lo studio",
};

vi.mock("../contexts/CompanyScopeContext", () => ({
  useCompanyScope: () => scopeState,
}));

import CompanyScopeSelect from "../components/CompanyScopeSelect.jsx";

describe("CompanyScopeSelect", () => {
  it("mostra etichetta Ambito e menu anche se la lista aziende e' ancora vuota", () => {
    scopeState.companies = [];
    render(<CompanyScopeSelect />);
    expect(screen.getByText("Ambito")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Ambito azienda" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Tutto lo studio" })).toBeInTheDocument();
  });

  it("elenca le aziende quando la lista e' arrivata", () => {
    scopeState.companies = [{ id: 11, name: "C.M.P. SRL" }];
    render(<CompanyScopeSelect />);
    expect(screen.getByRole("option", { name: "C.M.P. SRL" })).toBeInTheDocument();
  });
});

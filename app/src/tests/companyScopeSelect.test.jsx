/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import CompanyScopeSelect from "../components/CompanyScopeSelect.jsx";

vi.mock("../contexts/CompanyScopeContext", () => ({
  useCompanyScope: () => ({
    companyId: "",
    setCompanyId: () => {},
    companies: [{ id: 11, name: "C.M.P. SRL" }],
    locked: false,
    companyScoped: false,
    scopeCompanyName: "Tutto lo studio",
  }),
}));

describe("CompanyScopeSelect", () => {
  it("mostra etichetta Ambito allineata al menu, con Tutto lo studio", () => {
    render(<CompanyScopeSelect />);
    expect(screen.getByText("Ambito")).toBeInTheDocument();
    const select = screen.getByRole("combobox", { name: "Ambito azienda" });
    expect(select).toBeInTheDocument();
    expect(select).toHaveValue("");
    expect(screen.getByRole("option", { name: "Tutto lo studio" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "C.M.P. SRL" })).toBeInTheDocument();
  });
});

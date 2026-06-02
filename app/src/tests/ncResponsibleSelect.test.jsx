import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import NcResponsibleSelect, {
  formatContactOptionLabel,
} from "../components/NcResponsibleSelect.jsx";

const CONTACTS = [
  { id: 1, name: "Mario Rossi", email: "mario@studio.it", role_type: "attuazione", active: true },
  { id: 2, name: "Luigi Verdi", email: "luigi@studio.it", role_type: "verifica", active: true },
];

describe("formatContactOptionLabel", () => {
  it("mostra nome e ruolo senza email", () => {
    expect(formatContactOptionLabel(CONTACTS[0])).toBe("Mario Rossi (Attuazione)");
    expect(formatContactOptionLabel(CONTACTS[0])).not.toMatch(/@/);
  });
});

describe("NcResponsibleSelect", () => {
  it("mostra select rubrica e seleziona referente", () => {
    const onContactIdChange = vi.fn();
    const onTextChange = vi.fn();
    render(
      <NcResponsibleSelect
        contacts={CONTACTS}
        roleFilter={["attuazione", "generico"]}
        contactId={null}
        textValue=""
        useExternal={false}
        onContactIdChange={onContactIdChange}
        onTextChange={onTextChange}
        onUseExternalChange={() => {}}
      />,
    );
    const select = screen.getByRole("combobox");
    expect(screen.getByRole("option", { name: "\u2014 Seleziona dalla rubrica \u2014" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Mario Rossi (Attuazione)" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /mario@studio/i })).not.toBeInTheDocument();
    fireEvent.change(select, { target: { value: "1" } });
    expect(onContactIdChange).toHaveBeenCalledWith(1);
    expect(onTextChange).toHaveBeenCalledWith("Mario Rossi");
  });

  it("passa a testo libero con checkbox esterno", () => {
    const onUseExternalChange = vi.fn();
    render(
      <NcResponsibleSelect
        contacts={CONTACTS}
        contactId={null}
        textValue=""
        useExternal={false}
        onContactIdChange={() => {}}
        onTextChange={() => {}}
        onUseExternalChange={onUseExternalChange}
      />,
    );
    fireEvent.click(screen.getByRole("checkbox"));
    expect(onUseExternalChange).toHaveBeenCalledWith(true);
  });
});

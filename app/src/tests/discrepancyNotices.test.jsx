import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DiscrepancyNotices from "../components/DiscrepancyNotices";

const NOTICE = {
  code: "WPQR.CODE_CERT_MISMATCH",
  field: "certificate_number",
  fingerprint: "abc",
  status: "aperto",
  message_it: "⚠️ Il numero del certificato non coincide con il codice WPQR. Sul certificato RINA c'è la lettera O (16VE01735PO2/A), nel codice c'è lo zero (16VE01735P02/A). Controlla sul PDF.",
};

const LOCKED = "Sola lettura: non puoi confermare, correggere o segnalare l'avviso";

describe("DiscrepancyNotices", () => {
  it("mostra il testo e le tre azioni", () => {
    render(<DiscrepancyNotices notices={[NOTICE]} canAct canCorrect onAction={() => {}} />);
    expect(screen.getByText(/lettera O \(16VE01735PO2\/A\)/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Conferma" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Correggi" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Segnala" })).toBeEnabled();
  });

  it("in sola lettura le tre azioni restano visibili e disabilitate", () => {
    render(<DiscrepancyNotices notices={[NOTICE]} canAct={false} canCorrect={false} />);
    for (const name of ["Conferma", "Correggi", "Segnala"]) {
      const btn = screen.getByRole("button", { name });
      expect(btn).toBeDisabled();
      expect(btn).toHaveAttribute("title", LOCKED);
    }
  });

  it("Conferma, Correggi e Segnala chiamano l'azione e Correggi punta il campo", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    const onFocusField = vi.fn();
    render(
      <DiscrepancyNotices
        notices={[NOTICE]}
        canAct
        canCorrect
        onAction={onAction}
        onFocusField={onFocusField}
      />
    );
    await user.click(screen.getByRole("button", { name: "Conferma" }));
    await user.click(screen.getByRole("button", { name: "Correggi" }));
    await user.click(screen.getByRole("button", { name: "Segnala" }));
    expect(onAction.mock.calls.map((c) => c[1])).toEqual(["conferma", "correggi", "segnala"]);
    expect(onFocusField).toHaveBeenCalledWith("certificate_number");
  });
});

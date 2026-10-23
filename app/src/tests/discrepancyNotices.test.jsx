import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DiscrepancyNotices, { WpqrSignalsList } from "../components/DiscrepancyNotices";
import texts from "@sgq-notice-texts";

const NOTICE = {
  code: "WPQR.CODE_CERT_MISMATCH",
  field: "certificate_number",
  fingerprint: "abc",
  status: "aperto",
  current_value: "16VE01735P02/A",
  message_it: "⚠️ Il numero del certificato non coincide con il codice WPQR. Sul certificato RINA c'è la lettera O (16VE01735PO2/A), nel codice c'è lo zero (16VE01735P02/A). Controlla sul PDF.",
};

const LOCKED = "Sola lettura: non puoi confermare, correggere o segnalare l'avviso";

describe("DiscrepancyNotices", () => {
  it("mostra il testo, le tre azioni e le frasi sotto i pulsanti", () => {
    render(<DiscrepancyNotices notices={[NOTICE]} canAct canCorrect onAction={() => {}} />);
    expect(screen.getByText(/lettera O \(16VE01735PO2\/A\)/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Conferma" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Correggi" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Segnala" })).toBeEnabled();
    expect(screen.getByText(texts.HELP.conferma)).toBeTruthy();
    expect(screen.getByText(texts.HELP.correggi)).toBeTruthy();
    expect(screen.getByText(texts.HELP.segnala)).toBeTruthy();
  });

  it("in sola lettura le tre azioni restano visibili e la frase è nel testo", () => {
    render(<DiscrepancyNotices notices={[NOTICE]} canAct={false} canCorrect={false} />);
    for (const name of ["Conferma", "Correggi", "Segnala"]) {
      expect(screen.getByRole("button", { name })).toBeDisabled();
    }
    expect(screen.getByText(LOCKED)).toBeTruthy();
    expect(screen.getByText(texts.HELP.conferma)).toBeTruthy();
  });

  it("Conferma parte solo con la motivazione", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(<DiscrepancyNotices notices={[NOTICE]} canAct canCorrect onAction={onAction} />);
    await user.click(screen.getByRole("button", { name: "Conferma" }));
    await user.click(screen.getByRole("button", { name: texts.UI.submitConfirm }));
    expect(onAction).not.toHaveBeenCalled();
    expect(screen.getByText(texts.UI.noteRequired)).toBeTruthy();
    await user.type(screen.getByPlaceholderText(texts.UI.notePlaceholder), "Sul PDF c'è la lettera O.");
    await user.click(screen.getByRole("button", { name: texts.UI.submitConfirm }));
    expect(onAction).toHaveBeenCalledWith(NOTICE, "conferma", expect.objectContaining({
      note: "Sul PDF c'è la lettera O.",
    }));
  });

  it("Correggi invia il valore nuovo e Segnala mostra i tre esempi", async () => {
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
    await user.click(screen.getByRole("button", { name: "Correggi" }));
    expect(onFocusField).toHaveBeenCalledWith("certificate_number");
    expect(screen.getByText(/Valore attuale: 16VE01735P02\/A/)).toBeTruthy();
    await user.type(screen.getByLabelText(texts.UI.valueLabel), "16VE01735PO2/A");
    await user.click(screen.getByRole("button", { name: texts.UI.submitCorrect }));
    expect(onAction).toHaveBeenCalledWith(NOTICE, "correggi", expect.objectContaining({
      new_value: "16VE01735PO2/A",
    }));

    await user.click(screen.getByRole("button", { name: "Segnala" }));
    for (const item of texts.REASONS) {
      expect(screen.getByText(item.example)).toBeTruthy();
    }
    await user.click(screen.getByRole("button", { name: texts.UI.submitSignal }));
    expect(screen.getByText(texts.UI.reasonRequired)).toBeTruthy();
  });

  it("lo storico di una correzione mostra chi, quando e i due valori", () => {
    render(
      <DiscrepancyNotices
        notices={[]}
        history={[{
          rule_code: "WPQR.CODE_CERT_MISMATCH",
          fingerprint: "old",
          status: "corretto",
          message_it: "Avviso chiuso dopo la correzione.",
          acted_by_name: "Ada Admin",
          acted_at: "2026-10-23T10:00:00.000Z",
          previous_value: "16VE01735P02/A",
          new_value: "16VE01735PO2/A",
        }]}
      />
    );
    expect(screen.getByTestId("notice-history").textContent).toContain("Ada Admin");
    expect(screen.getByTestId("notice-history").textContent).toContain("16VE01735P02/A");
    expect(screen.getByTestId("notice-history").textContent).toContain("16VE01735PO2/A");
  });
});

describe("WpqrSignalsList", () => {
  it("filtra motivo e stato e non mostra una pagina inventata", () => {
    const onReason = vi.fn();
    const onStatus = vi.fn();
    render(
      <WpqrSignalsList
        reason=""
        status=""
        onReason={onReason}
        onStatus={onStatus}
        signals={[{
          id: 7,
          status: "segnalato",
          reason: "parere",
          note: "Edizione dubbia",
          wpqr_code: "ZZ-1",
          pdf_page: null,
          request_draft: "Nota per il responsabile. La pagina del PDF non è indicata sul record.",
        }]}
      />
    );
    expect(screen.getByText(texts.UI.inAppOnly)).toBeTruthy();
    expect(screen.getByText(/non è indicata sul record/)).toBeTruthy();
    expect(screen.queryByText(/Pagina del PDF: \d/)).toBeNull();
    expect(screen.getByLabelText(texts.UI.filterReason)).toBeTruthy();
    expect(screen.getByLabelText(texts.UI.filterStatus)).toBeTruthy();
  });
});

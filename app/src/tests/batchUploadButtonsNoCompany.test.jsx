/**
 * @vitest-environment jsdom
 *
 * Regola: i pulsanti batch restano visibili anche senza azienda (disabled).
 * Non smontarli — e gli hook devono stare sempre sopra il return.
 */
import React, { useState } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import WpqrUploadButton from "../components/WpqrUploadButton.jsx";
import WpsUploadButton from "../components/WpsUploadButton.jsx";

vi.mock("../services/apiService", () => ({ default: {} }));
vi.mock("../components/IngestReviewDialog", () => ({ default: () => null }));

function ToggleCompany({ Button, label }) {
  const [id, setId] = useState("");
  return (
    <>
      <button type="button" onClick={() => setId("47")}>
        scegli
      </button>
      <Button companyId={id} companyName="C.M.P." onUploadComplete={() => {}} />
      <span data-testid="scope">{id || "none"}</span>
      <span data-testid="label">{label}</span>
    </>
  );
}

describe("pulsanti batch senza azienda", () => {
  it("WPQR: bottone visibile e disabled se manca l'azienda", () => {
    render(<WpqrUploadButton companyId="" companyName="" onUploadComplete={() => {}} />);
    const btn = screen.getByRole("button", { name: /Carica WPQR \(batch\)/i });
    expect(btn).toHaveAttribute("aria-disabled", "true");
  });

  it("WPS: bottone visibile e disabled se manca l'azienda", () => {
    render(<WpsUploadButton companyId="" companyName="" onUploadComplete={() => {}} />);
    const btn = screen.getByRole("button", { name: /Seleziona PDF WPS/i });
    expect(btn).toHaveAttribute("aria-disabled", "true");
  });

  it("WPQR: passare da nessuna azienda a un id non viola le Rules of Hooks", async () => {
    const user = userEvent.setup();
    render(<ToggleCompany Button={WpqrUploadButton} label="wpqr" />);
    expect(screen.getByRole("button", { name: /Carica WPQR \(batch\)/i })).toHaveAttribute("aria-disabled", "true");
    await user.click(screen.getByRole("button", { name: "scegli" }));
    expect(screen.getByTestId("scope").textContent).toBe("47");
    expect(screen.getByRole("button", { name: /Carica WPQR \(batch\)/i })).not.toHaveAttribute("aria-disabled", "true");
  });
});

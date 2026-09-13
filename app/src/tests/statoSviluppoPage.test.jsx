/**
 * Cruscotto stato sviluppo — solo superadmin, 3 colonne filtrabili.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import StatoSviluppoPage from "../pages/StatoSviluppoPage";
import { STATO_SVILUPPO, countStatoSviluppo } from "../data/statoSviluppo";

const authState = { role: "superadmin" };

vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({ user: { role: authState.role } }),
}));

describe("StatoSviluppoPage", () => {
  beforeEach(() => {
    authState.role = "superadmin";
  });

  it("blocca l'accesso se non sei superadmin", () => {
    authState.role = "admin";
    render(<StatoSviluppoPage />);
    expect(screen.getByText(/Accesso riservato al superadmin/i)).toBeInTheDocument();
    expect(screen.queryByTestId("ss-board")).not.toBeInTheDocument();
  });

  it("mostra le tre colonne Fatto / In corso / Prossimo", () => {
    render(<StatoSviluppoPage />);
    expect(screen.getByRole("heading", { name: "Stato dello sviluppo" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Fatto/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /In corso/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Prossimo/ })).toBeInTheDocument();
    expect(screen.getByText("Audit multi-standard")).toBeInTheDocument();
    expect(screen.getAllByText(/Aspetta una tua decisione/).length).toBeGreaterThan(0);
  });

  it("filtra una colonna dalla card in alto e la riapre al secondo click", async () => {
    const user = userEvent.setup();
    render(<StatoSviluppoPage />);

    await user.click(screen.getByRole("button", { name: /Prossimo/i }));
    expect(screen.getByRole("heading", { name: /Prossimo/ })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /^Fatto/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Prossimo/i }));
    expect(screen.getByRole("heading", { name: /Fatto/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /In corso/ })).toBeInTheDocument();
  });
});

describe("countStatoSviluppo", () => {
  it("conta le tre colonne dello snapshot", () => {
    const counts = countStatoSviluppo();
    expect(counts.done).toBe(STATO_SVILUPPO.done.length);
    expect(counts.inProgress).toBe(STATO_SVILUPPO.inProgress.length);
    expect(counts.next).toBe(STATO_SVILUPPO.next.length);
    expect(counts.done).toBeGreaterThan(0);
    expect(counts.inProgress).toBeGreaterThan(0);
    expect(counts.next).toBeGreaterThan(0);
  });
});

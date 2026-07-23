/**
 * Test slice UAL-4 — ForgotPasswordPage (pagina pubblica "Password dimenticata?").
 * Verifica: validazione base, messaggio generico identico per esito
 * successo/errore (anti user-enumeration lato UI), navigazione.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ForgotPasswordPage from "../pages/ForgotPasswordPage";

const mockNavigate = vi.fn();
const mockForgotPassword = vi.fn();

vi.mock("../contexts/RouterContext", () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock("../services/apiService", () => ({
  default: {
    forgotPassword: (...args) => mockForgotPassword(...args),
  },
}));

const GENERIC_MESSAGE_FRAGMENT = "riceverai un'email con le istruzioni";

beforeEach(() => {
  mockNavigate.mockReset();
  mockForgotPassword.mockReset();
});

describe("ForgotPasswordPage — validazione form", () => {
  it("rifiuta l'invio con email vuota, senza chiamare l'API", async () => {
    const user = userEvent.setup();
    render(<ForgotPasswordPage />);

    await user.click(screen.getByRole("button", { name: "Invia istruzioni" }));

    expect(screen.getByText("Inserire un indirizzo email.")).toBeInTheDocument();
    expect(mockForgotPassword).not.toHaveBeenCalled();
  });
});

describe("ForgotPasswordPage — messaggio generico anti user-enumeration", () => {
  it("mostra il messaggio generico di successo per un'email che esiste", async () => {
    mockForgotPassword.mockResolvedValueOnce({ success: true, message: "qualsiasi" });
    const user = userEvent.setup();
    render(<ForgotPasswordPage />);

    await user.type(screen.getByLabelText(/Email/), "esiste@test.it");
    await user.click(screen.getByRole("button", { name: "Invia istruzioni" }));

    await waitFor(() => {
      expect(screen.getByText(new RegExp(GENERIC_MESSAGE_FRAGMENT))).toBeInTheDocument();
    });
    expect(mockForgotPassword).toHaveBeenCalledWith("esiste@test.it");
  });

  it("mostra ESATTAMENTE lo stesso messaggio generico anche se l'API fallisce (es. email inesistente/rate limit)", async () => {
    mockForgotPassword.mockRejectedValueOnce(new Error("qualsiasi errore interno"));
    const user = userEvent.setup();
    render(<ForgotPasswordPage />);

    await user.type(screen.getByLabelText(/Email/), "nonesiste@test.it");
    await user.click(screen.getByRole("button", { name: "Invia istruzioni" }));

    await waitFor(() => {
      expect(screen.getByText(new RegExp(GENERIC_MESSAGE_FRAGMENT))).toBeInTheDocument();
    });
    // Nessun messaggio di errore tecnico mostrato: l'utente vede solo il messaggio generico.
    expect(screen.queryByText(/errore interno/i)).not.toBeInTheDocument();
  });

  it("torna al login dal messaggio di conferma", async () => {
    mockForgotPassword.mockResolvedValueOnce({ success: true });
    const user = userEvent.setup();
    render(<ForgotPasswordPage />);

    await user.type(screen.getByLabelText(/Email/), "utente@test.it");
    await user.click(screen.getByRole("button", { name: "Invia istruzioni" }));

    await waitFor(() => screen.getByRole("button", { name: "Vai al login" }));
    await user.click(screen.getByRole("button", { name: "Vai al login" }));

    expect(mockNavigate).toHaveBeenCalledWith("/");
  });
});

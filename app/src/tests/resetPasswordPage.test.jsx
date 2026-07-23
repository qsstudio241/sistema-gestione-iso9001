/**
 * Test slice UAL-4 — ResetPasswordPage (pagina pubblica "Reimposta la password").
 * Verifica: verifica token (loading/valido/invalido), validazione password lato
 * form, invio corretto e messaggio di successo. Stesso pattern di
 * acceptInvitePage.test.jsx (UAL-3).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ResetPasswordPage from "../pages/ResetPasswordPage";

const mockNavigate = vi.fn();
const mockCheckResetToken = vi.fn();
const mockResetPassword = vi.fn();

vi.mock("../contexts/RouterContext", () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock("../services/apiService", () => ({
  default: {
    checkResetToken: (...args) => mockCheckResetToken(...args),
    resetPassword: (...args) => mockResetPassword(...args),
  },
}));

beforeEach(() => {
  mockNavigate.mockReset();
  mockCheckResetToken.mockReset();
  mockResetPassword.mockReset();
});

describe("ResetPasswordPage — verifica del token", () => {
  it("mostra un messaggio di caricamento mentre verifica il token", () => {
    mockCheckResetToken.mockReturnValue(new Promise(() => {})); // pending
    render(<ResetPasswordPage token="tok-123" />);
    expect(screen.getByText("Verifica del link in corso...")).toBeInTheDocument();
  });

  it("mostra un errore comprensibile per un token scaduto o invalido", async () => {
    mockCheckResetToken.mockRejectedValue(new Error("Il link per reimpostare la password è scaduto."));
    render(<ResetPasswordPage token="tok-scaduto" />);

    await waitFor(() => {
      expect(screen.getByText("Il link per reimpostare la password è scaduto.")).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Richiedi un nuovo link" })).toBeInTheDocument();
  });

  it("senza token in URL mostra subito l'errore, senza chiamare l'API", () => {
    render(<ResetPasswordPage token="" />);
    expect(screen.getByText("Link non valido.")).toBeInTheDocument();
    expect(mockCheckResetToken).not.toHaveBeenCalled();
  });

  it("mostra il form password con l'email dell'utente per un token valido", async () => {
    mockCheckResetToken.mockResolvedValue({ data: { email: "utente@test.it" } });
    render(<ResetPasswordPage token="tok-valido" />);

    await waitFor(() => {
      expect(screen.getByLabelText(/Nuova password/)).toBeInTheDocument();
    });
    expect(screen.getByText("utente@test.it")).toBeInTheDocument();
  });
});

describe("ResetPasswordPage — invio del form", () => {
  beforeEach(() => {
    mockCheckResetToken.mockResolvedValue({ data: { email: "utente@test.it" } });
  });

  it("rifiuta una password troppo corta senza chiamare l'API", async () => {
    const user = userEvent.setup();
    render(<ResetPasswordPage token="tok-valido" />);

    await waitFor(() => screen.getByLabelText(/Nuova password/));

    await user.type(screen.getByLabelText(/Nuova password/), "corta");
    await user.type(screen.getByLabelText(/Conferma password/), "corta");
    await user.click(screen.getByRole("button", { name: "Reimposta password" }));

    expect(screen.getByText("La password deve avere almeno 8 caratteri.")).toBeInTheDocument();
    expect(mockResetPassword).not.toHaveBeenCalled();
  });

  it("rifiuta se le due password non coincidono", async () => {
    const user = userEvent.setup();
    render(<ResetPasswordPage token="tok-valido" />);

    await waitFor(() => screen.getByLabelText(/Nuova password/));

    await user.type(screen.getByLabelText(/Nuova password/), "password123");
    await user.type(screen.getByLabelText(/Conferma password/), "password456");
    await user.click(screen.getByRole("button", { name: "Reimposta password" }));

    expect(screen.getByText("Le due password non coincidono.")).toBeInTheDocument();
    expect(mockResetPassword).not.toHaveBeenCalled();
  });

  it("invia token e password all'API e mostra il messaggio di successo", async () => {
    mockResetPassword.mockResolvedValue({ success: true });
    const user = userEvent.setup();
    render(<ResetPasswordPage token="tok-valido" />);

    await waitFor(() => screen.getByLabelText(/Nuova password/));

    await user.type(screen.getByLabelText(/Nuova password/), "password123");
    await user.type(screen.getByLabelText(/Conferma password/), "password123");
    await user.click(screen.getByRole("button", { name: "Reimposta password" }));

    await waitFor(() => {
      expect(mockResetPassword).toHaveBeenCalledWith("tok-valido", "password123");
    });
    expect(await screen.findByText(/Password reimpostata correttamente/)).toBeInTheDocument();
  });

  it("mostra l'errore del server se reset-password fallisce (es. token consumato nel frattempo)", async () => {
    mockResetPassword.mockRejectedValue(new Error("Il link è già stato utilizzato."));
    const user = userEvent.setup();
    render(<ResetPasswordPage token="tok-valido" />);

    await waitFor(() => screen.getByLabelText(/Nuova password/));

    await user.type(screen.getByLabelText(/Nuova password/), "password123");
    await user.type(screen.getByLabelText(/Conferma password/), "password123");
    await user.click(screen.getByRole("button", { name: "Reimposta password" }));

    expect(await screen.findByText("Il link è già stato utilizzato.")).toBeInTheDocument();
  });
});
